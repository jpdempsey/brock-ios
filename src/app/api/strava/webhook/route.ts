import { NextRequest } from 'next/server'
import { successResponse, errorResponse, handleAPIError } from '@/lib/utils/response'

// POST /api/strava/webhook - Create webhook subscription
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action = 'create' } = body

    if (action === 'create') {
      return await createWebhookSubscription()
    } else if (action === 'delete') {
      return await deleteWebhookSubscription()
    } else if (action === 'list') {
      return await listWebhookSubscriptions()
    }

    return errorResponse('Invalid action. Use create, delete, or list')
  } catch (error) {
    return handleAPIError(error)
  }
}

// GET /api/strava/webhook - List webhook subscriptions
export async function GET() {
  try {
    return await listWebhookSubscriptions()
  } catch (error) {
    return handleAPIError(error)
  }
}

async function createWebhookSubscription() {
  try {
    const clientId = process.env.STRAVA_CLIENT_ID
    const clientSecret = process.env.STRAVA_CLIENT_SECRET
    const callbackUrl = `${process.env.NEXTAUTH_URL}/api/webhooks/strava`
    const verifyToken = process.env.STRAVA_WEBHOOK_VERIFY_TOKEN || 'BROCK_STRAVA_WEBHOOK_2025'

    if (!clientId || !clientSecret) {
      return errorResponse('Strava credentials not configured')
    }

    console.log('Creating webhook subscription:', { callbackUrl, verifyToken })

    const response = await fetch('https://www.strava.com/api/v3/push_subscriptions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        callback_url: callbackUrl,
        verify_token: verifyToken
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Webhook subscription failed:', response.status, errorText)
      return errorResponse(`Failed to create webhook: ${response.status} ${errorText}`)
    }

    const data = await response.json()
    console.log('Webhook subscription created:', data)

    return successResponse(data, 'Webhook subscription created successfully')
  } catch (error) {
    console.error('Error creating webhook subscription:', error)
    return errorResponse(`Error creating webhook: ${error}`)
  }
}

async function deleteWebhookSubscription() {
  try {
    const clientId = process.env.STRAVA_CLIENT_ID
    const clientSecret = process.env.STRAVA_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      return errorResponse('Strava credentials not configured')
    }

    // First, list subscriptions to get the ID
    const listResponse = await fetch(`https://www.strava.com/api/v3/push_subscriptions?client_id=${clientId}&client_secret=${clientSecret}`)
    
    if (!listResponse.ok) {
      return errorResponse('Failed to list webhook subscriptions')
    }

    const subscriptions = await listResponse.json()
    console.log('Current subscriptions:', subscriptions)

    if (subscriptions.length === 0) {
      return successResponse([], 'No webhook subscriptions to delete')
    }

    // Delete each subscription
    const results = []
    for (const subscription of subscriptions) {
      const deleteResponse = await fetch(`https://www.strava.com/api/v3/push_subscriptions/${subscription.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
        }),
      })

      if (deleteResponse.ok) {
        results.push({ id: subscription.id, status: 'deleted' })
        console.log('Deleted webhook subscription:', subscription.id)
      } else {
        results.push({ id: subscription.id, status: 'failed', error: await deleteResponse.text() })
      }
    }

    return successResponse(results, 'Webhook deletion completed')
  } catch (error) {
    console.error('Error deleting webhook subscription:', error)
    return errorResponse(`Error deleting webhook: ${error}`)
  }
}

async function listWebhookSubscriptions() {
  try {
    const clientId = process.env.STRAVA_CLIENT_ID
    const clientSecret = process.env.STRAVA_CLIENT_SECRET

    if (!clientId || !clientSecret) {
      return errorResponse('Strava credentials not configured')
    }

    const response = await fetch(`https://www.strava.com/api/v3/push_subscriptions?client_id=${clientId}&client_secret=${clientSecret}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      return errorResponse(`Failed to list webhooks: ${response.status} ${errorText}`)
    }

    const subscriptions = await response.json()
    console.log('Current webhook subscriptions:', subscriptions)

    return successResponse(subscriptions, `Found ${subscriptions.length} webhook subscription(s)`)
  } catch (error) {
    console.error('Error listing webhook subscriptions:', error)
    return errorResponse(`Error listing webhooks: ${error}`)
  }
}
