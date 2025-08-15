import { NextRequest } from 'next/server'
import { NotificationService } from '@/lib/notifications/service'
import { successResponse, errorResponse, handleAPIError } from '@/lib/utils/response'

export const runtime = 'edge'

// GET /api/notifications/test - Test notification system with different types
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') || 'proactive'
    const message = searchParams.get('message')
    const title = searchParams.get('title')

    let success = false
    let notificationData: any = {}

    switch (type) {
      case 'proactive':
      case 'checkin':
        success = await NotificationService.createProactiveCheckinNotification(
          'test-thread-id',
          message || 'Hey! This is a test proactive check-in. How are you doing today? 💪',
          'afternoon'
        )
        notificationData = {
          type: 'proactive_checkin',
          title: '🌇 Afternoon Check-in',
          message: message || 'Hey! This is a test proactive check-in. How are you doing today? 💪'
        }
        break

      case 'chat':
        success = await NotificationService.createChatNotification(
          'test-thread-id',
          'Test Chat',
          message || 'This is a test chat message from Brock! 🤖'
        )
        notificationData = {
          type: 'chat_message',
          title: 'Brock',
          message: message || 'This is a test chat message from Brock! 🤖'
        }
        break

      case 'account':
      case 'update':
        success = await NotificationService.createAccountUpdateNotification(
          title || 'New Activity Added',
          message || 'Your morning run has been synced from Strava! 🏃‍♂️',
          'activity',
          'test-activity-id'
        )
        notificationData = {
          type: 'account_update',
          title: title || 'New Activity Added',
          message: message || 'Your morning run has been synced from Strava! 🏃‍♂️'
        }
        break

      case 'goal':
      case 'reminder':
        success = await NotificationService.createGoalReminderNotification(
          'test-goal-id',
          'Complete 5K Run',
          message || 'Don\'t forget about your 5K goal! You\'re doing great! 🎯'
        )
        notificationData = {
          type: 'goal_reminder',
          title: 'Goal Reminder: Complete 5K Run',
          message: message || 'Don\'t forget about your 5K goal! You\'re doing great! 🎯'
        }
        break

      case 'system':
        success = await NotificationService.createSystemNotification(
          title || 'System Test',
          message || 'This is a test system notification! 🔧',
          3 // Medium-high priority
        )
        notificationData = {
          type: 'system',
          title: title || 'System Test',
          message: message || 'This is a test system notification! 🔧'
        }
        break

      default:
        return errorResponse(`Invalid notification type: ${type}. Use: proactive, chat, account, goal, or system`, 400)
    }

    if (success) {
      console.log(`✅ Test notification created successfully: ${type}`)
      return successResponse({
        message: `Test ${type} notification created successfully!`,
        type,
        notification: notificationData,
        instructions: 'Check your iOS app - it should poll for this notification within 30 seconds'
      })
    } else {
      return errorResponse(`Failed to create ${type} notification`, 500)
    }

  } catch (error) {
    console.error('Error in test notification:', error)
    return handleAPIError(error)
  }
}

// POST /api/notifications/test - Create custom test notification
export async function POST(request: NextRequest) {
  try {
    const { 
      type = 'system',
      title = 'Test Notification',
      message = 'This is a custom test notification!',
      priority = 5,
      threadId,
      goalId,
      activityId,
      data = {}
    } = await request.json()

    const success = await NotificationService.createNotification({
      type,
      title,
      message,
      threadId,
      goalId,
      activityId,
      priority,
      data,
      expiresInHours: 24
    })

    if (success) {
      console.log(`✅ Custom test notification created: ${type}`)
      return successResponse({
        message: 'Custom test notification created successfully!',
        notification: {
          type,
          title,
          message,
          priority,
          threadId,
          goalId,
          activityId,
          data
        },
        instructions: 'Check your iOS app - it should poll for this notification within 30 seconds'
      })
    } else {
      return errorResponse('Failed to create custom test notification', 500)
    }

  } catch (error) {
    console.error('Error in custom test notification:', error)
    return handleAPIError(error)
  }
}
