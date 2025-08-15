import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { apnsClient, NotificationData } from '@/lib/apns/client'
import { successResponse, errorResponse, handleAPIError } from '@/lib/utils/response'

export const runtime = 'edge'

// POST /api/notifications/send - Send push notification to all registered devices
export async function POST(request: NextRequest) {
  try {
    const { 
      type, 
      title, 
      body, 
      threadId, 
      goalId, 
      activityId, 
      userId,
      data 
    } = await request.json()
    
    if (!type || !title || !body) {
      return errorResponse('type, title, and body are required', 400)
    }
    
    // Get active device tokens
    const { data: devices, error } = await supabase
      .from('device_tokens')
      .select('device_token')
      .eq('is_active', true)
      .eq('user_id', userId || 'default_user') // Filter by user if provided
    
    if (error) {
      return errorResponse(`Failed to fetch device tokens: ${error.message}`, 500)
    }
    
    if (!devices || devices.length === 0) {
      return successResponse({
        message: 'No active devices found to send notifications to',
        deviceCount: 0,
        sentCount: 0
      })
    }
    
    // Prepare notification data
    const notificationData: NotificationData = {
      type,
      title,
      body,
      threadId,
      goalId,
      activityId,
      data
    }
    
    // Send notifications to all devices
    const deviceTokens = devices.map(device => device.device_token)
    const sentCount = await apnsClient.sendToMultipleDevices(deviceTokens, notificationData)
    
    console.log(`📱 Sent ${type} notification to ${sentCount}/${deviceTokens.length} devices`)
    
    return successResponse({
      message: `Notification sent successfully`,
      type,
      deviceCount: deviceTokens.length,
      sentCount,
      title,
      body
    })
    
  } catch (error) {
    console.error('Error in send notification:', error)
    return handleAPIError(error)
  }
}

// GET /api/notifications/send - Test endpoint with sample notifications
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const testType = searchParams.get('test')
  
  if (!testType) {
    return successResponse({
      message: 'Notification send endpoint',
      availableTests: [
        '?test=chat - Test chat message notification',
        '?test=account - Test account update notification',
        '?test=proactive - Test proactive checkin notification'
      ]
    })
  }
  
  try {
    let notificationData: NotificationData
    
    switch (testType) {
      case 'chat':
        notificationData = {
          type: 'chat_message',
          title: 'Brock',
          body: 'Hey! How was your workout today? 💪',
          threadId: 'test-thread-123'
        }
        break
        
      case 'account':
        notificationData = {
          type: 'account_update',
          title: 'New Activity Added',
          body: 'Your morning run has been synced from Strava! 🏃‍♂️',
          activityId: 'test-activity-123'
        }
        break
        
      case 'proactive':
        notificationData = {
          type: 'proactive_checkin',
          title: 'Daily Check-in',
          body: "Good afternoon! How's your energy level today? Ready to tackle those goals? 🎯",
          threadId: 'general-checkin-thread'
        }
        break
        
      default:
        return errorResponse('Invalid test type. Use: chat, account, or proactive', 400)
    }
    
    // Get device tokens
    const { data: devices } = await supabase
      .from('device_tokens')
      .select('device_token')
      .eq('is_active', true)
    
    if (!devices || devices.length === 0) {
      return successResponse({
        message: 'Test notification prepared, but no devices registered',
        notificationData,
        deviceCount: 0
      })
    }
    
    // Send test notification
    const deviceTokens = devices.map(device => device.device_token)
    const sentCount = await apnsClient.sendToMultipleDevices(deviceTokens, notificationData)
    
    return successResponse({
      message: `Test ${testType} notification sent!`,
      notificationData,
      deviceCount: deviceTokens.length,
      sentCount
    })
    
  } catch (error) {
    return handleAPIError(error)
  }
}
