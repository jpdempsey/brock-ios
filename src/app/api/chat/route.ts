import { NextRequest } from 'next/server'
import { openai, CHAT_MODEL } from '@/lib/openai/client'
import { supabase } from '@/lib/supabase/client'
import { toolDefs, tools } from '@/tools/index'
import { BrockMemorySystem } from '@/lib/memory'
import { errorResponse } from '@/lib/utils/response'

export const runtime = 'edge'

export async function POST(req: NextRequest) {
  try {
    const { threadId, userMessage } = await req.json()
    
    if (!userMessage) {
      return errorResponse('User message is required', 400)
    }

    if (!threadId) {
      return errorResponse('Thread ID is required', 400)
    }

    // Initialize memory system
    const memorySystem = new BrockMemorySystem()
    
    // Get global profile and thread context
    const [profile, context] = await Promise.all([
      memorySystem.getGlobalProfile(),
      memorySystem.getThreadContext(threadId)
    ])

    // Check if this is the first message in the thread
    const { data: existingMessages } = await supabase
      .from('chat_messages')
      .select('id')
      .eq('thread_id', threadId)
      .limit(1)
    
    const isFirstMessage = !existingMessages || existingMessages.length === 0

    // Build system prompt with context
    const systemPrompt = memorySystem.buildSystemPrompt(profile, context)

    // Save user message to database
    await supabase
      .from('chat_messages')
      .insert({
        thread_id: threadId,
        sender: 'user',
        content: userMessage
      })

    // Prepare messages for OpenAI
    const messages = [
      { role: 'system', content: systemPrompt },
      // Include recent context messages
      ...context.recent_messages.map(msg => ({
        role: msg.sender === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content
      })),
      { role: 'user', content: userMessage }
    ]

    // Create streaming response
    const response = await openai.chat.completions.create({
      model: CHAT_MODEL,
      messages,
      tools: toolDefs,
      stream: true,
      temperature: 0.7,
      max_tokens: 1000
    })

    // Create readable stream for SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder()
        let assistantMessage = ''
        let toolCalls: any[] = []
        
        const sendSSE = (event: string, data: any) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`))
        }

        try {
          for await (const chunk of response) {
            const delta = chunk.choices[0]?.delta

            if (delta?.content) {
              assistantMessage += delta.content
              sendSSE('message', { content: delta.content })
            }

            if (delta?.tool_calls) {
              for (const toolCall of delta.tool_calls) {
                if (!toolCalls[toolCall.index]) {
                  toolCalls[toolCall.index] = {
                    id: toolCall.id,
                    type: 'function',
                    function: { name: '', arguments: '' }
                  }
                }

                if (toolCall.function?.name) {
                  toolCalls[toolCall.index].function.name = toolCall.function.name
                }

                if (toolCall.function?.arguments) {
                  toolCalls[toolCall.index].function.arguments += toolCall.function.arguments
                }
              }
            }

            if (chunk.choices[0]?.finish_reason === 'tool_calls') {
              // Execute tool calls and get results
              const toolResults: any[] = []
              
              for (const toolCall of toolCalls) {
                if (toolCall.function.name && tools[toolCall.function.name]) {
                  sendSSE('tool_start', { name: toolCall.function.name })
                  
                  try {
                    const args = JSON.parse(toolCall.function.arguments)
                    const result = await tools[toolCall.function.name](args)
                    sendSSE('tool_result', { name: toolCall.function.name, result })
                    
                    // Store tool result for second OpenAI call
                    toolResults.push({
                      tool_call_id: toolCall.id,
                      role: 'tool',
                      content: JSON.stringify(result)
                    })
                  } catch (error) {
                    sendSSE('tool_error', { 
                      name: toolCall.function.name, 
                      error: error instanceof Error ? error.message : 'Unknown error' 
                    })
                    
                    // Store error result
                    toolResults.push({
                      tool_call_id: toolCall.id,
                      role: 'tool',
                      content: JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' })
                    })
                  }
                }
              }
              
              // Make second call to OpenAI with tool results
              if (toolResults.length > 0) {
                const followUpMessages = [
                  ...messages,
                  {
                    role: 'assistant',
                    content: assistantMessage || null,
                    tool_calls: toolCalls
                  },
                  ...toolResults
                ]
                
                const followUpResponse = await openai.chat.completions.create({
                  model: CHAT_MODEL,
                  messages: followUpMessages,
                  stream: true,
                  temperature: 0.7,
                  max_tokens: 1000
                })
                
                // Stream the follow-up response
                for await (const followUpChunk of followUpResponse) {
                  const followUpDelta = followUpChunk.choices[0]?.delta
                  
                  if (followUpDelta?.content) {
                    assistantMessage += followUpDelta.content
                    sendSSE('message', { content: followUpDelta.content })
                  }
                }
              }
            }
          }

          // Save assistant message to database
          if (assistantMessage.trim()) {
            await supabase
              .from('chat_messages')
              .insert({
                thread_id: threadId,
                sender: 'brock',
                content: assistantMessage.trim(),
                metadata: toolCalls.length > 0 ? { tool_calls: toolCalls } : null
              })

            // Generate thread title if this is the first message
            if (isFirstMessage) {
              console.log('🏷️ Generating title for first message:', userMessage)
              const titlePrompt = `Generate a short, descriptive title (2-4 words max) for this conversation. Only respond with the title, no quotes or extra text.

User message: "${userMessage}"

Examples:
- "Marathon Training" 
- "Nutrition Help"
- "Workout Plan"
- "Goal Setting"`
              
              try {
                const titleResponse = await openai.chat.completions.create({
                  model: CHAT_MODEL,
                  messages: [{ role: 'user', content: titlePrompt }],
                  max_tokens: 15,
                  temperature: 0.2
                })
                
                let generatedTitle = titleResponse.choices[0]?.message?.content?.trim()
                
                // Clean up the title (remove quotes, etc.)
                if (generatedTitle) {
                  generatedTitle = generatedTitle.replace(/['"]/g, '').trim()
                  console.log('🏷️ Generated title:', generatedTitle)
                  
                  const { error: updateError } = await supabase
                    .from('chat_threads')
                    .update({ 
                      title: generatedTitle,
                      updated_at: new Date().toISOString() 
                    })
                    .eq('id', threadId)
                    
                  if (updateError) {
                    console.error('Error updating thread title:', updateError)
                  } else {
                    console.log('✅ Thread title updated successfully')
                  }
                } else {
                  console.log('⚠️ No title generated, using timestamp update only')
                  await supabase
                    .from('chat_threads')
                    .update({ updated_at: new Date().toISOString() })
                    .eq('id', threadId)
                }
              } catch (titleError) {
                console.error('❌ Error generating thread title:', titleError)
                // Fallback: just update timestamp
                await supabase
                  .from('chat_threads')
                  .update({ updated_at: new Date().toISOString() })
                  .eq('id', threadId)
              }
            } else {
              // Update thread timestamp
              await supabase
                .from('chat_threads')
                .update({ updated_at: new Date().toISOString() })
                .eq('id', threadId)
            }
          }

          sendSSE('done', {})
          controller.close()
        } catch (error) {
          console.error('Streaming error:', error)
          sendSSE('error', { message: 'An error occurred during streaming' })
          controller.close()
        }
      }
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    })

  } catch (error) {
    console.error('Chat API error:', error)
    return errorResponse('Internal server error', 500)
  }
}
