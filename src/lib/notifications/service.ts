import { supabase } from '@/lib/supabase/client'

export type NotificationType = 
  | 'chat_message'      // Brock sent a chat message
  | 'account_update'    // Something was added to account (goal, activity, etc.)
  | 'proactive_checkin' // Proactive check-in from Brock
  | 'goal_reminder'     // Goal deadline reminder
  | 'system'           // System notifications

export interface NotificationData {
  type: NotificationType
  title: string
  message: string
  threadId?: string
  goalId?: string
  activityId?: string
  priority?: number // 1=highest, 10=lowest
  data?: Record<string, any>
  expiresInHours?: number
}

/**
 * Notification Service - Helper functions for creating different types of notifications
 */
export class NotificationService {
  
  /**
   * Create a notification and add it to the queue
   */
  static async createNotification(notificationData: NotificationData): Promise<boolean> {
    try {
      const {
        type,
        title,
        message,
        threadId,
        goalId,
        activityId,
        priority = 5,
        data = {},
        expiresInHours = 24 * 7 // 7 days default
      } = notificationData

      // Calculate expiration time
      const expiresAt = new Date()
      expiresAt.setHours(expiresAt.getHours() + expiresInHours)

      // Insert notification into queue
      const { error } = await supabase
        .from('notification_queue')
        .insert({
          type,
          title,
          message,
          thread_id: threadId,
          goal_id: goalId,
          activity_id: activityId,
          priority,
          data,
          expires_at: expiresAt.toISOString(),
          status: 'pending'
        })

      if (error) {
        console.error('Error creating notification:', error)
        return false
      }

      console.log(`📬 Created ${type} notification: ${title}`)
      return true

    } catch (error) {
      console.error('Error in createNotification:', error)
      return false
    }
  }

  /**
   * Create a chat message notification
   */
  static async createChatNotification(threadId: string, threadTitle: string, message: string): Promise<boolean> {
    return this.createNotification({
      type: 'chat_message',
      title: 'Brock',
      message: message,
      threadId,
      priority: 2, // High priority
      data: { threadTitle },
      expiresInHours: 48 // 2 days
    })
  }

  /**
   * Create a proactive check-in notification
   */
  static async createProactiveCheckinNotification(threadId: string, message: string, timeOfDay: string): Promise<boolean> {
    const title = timeOfDay === 'morning' ? '🌅 Morning Check-in' : '🌇 Afternoon Check-in'
    
    return this.createNotification({
      type: 'proactive_checkin',
      title,
      message,
      threadId,
      priority: 3, // Medium-high priority
      data: { timeOfDay },
      expiresInHours: 12 // Expire after 12 hours
    })
  }

  /**
   * Create an account update notification
   */
  static async createAccountUpdateNotification(
    title: string, 
    message: string, 
    updateType: string,
    relatedId?: string
  ): Promise<boolean> {
    const data: Record<string, any> = { updateType }
    let goalId: string | undefined
    let activityId: string | undefined

    // Determine which ID field to use based on update type
    if (updateType === 'goal' && relatedId) {
      goalId = relatedId
    } else if (updateType === 'activity' && relatedId) {
      activityId = relatedId
    }

    if (relatedId) {
      data.relatedId = relatedId
    }

    return this.createNotification({
      type: 'account_update',
      title,
      message,
      goalId,
      activityId,
      priority: 4, // Medium priority
      data,
      expiresInHours: 72 // 3 days
    })
  }

  /**
   * Create a goal reminder notification
   */
  static async createGoalReminderNotification(goalId: string, goalTitle: string, message: string): Promise<boolean> {
    return this.createNotification({
      type: 'goal_reminder',
      title: `Goal Reminder: ${goalTitle}`,
      message,
      goalId,
      priority: 3, // Medium-high priority
      data: { goalTitle },
      expiresInHours: 24 // 1 day
    })
  }

  /**
   * Create a system notification
   */
  static async createSystemNotification(title: string, message: string, priority: number = 5): Promise<boolean> {
    return this.createNotification({
      type: 'system',
      title,
      message,
      priority,
      expiresInHours: 168 // 7 days
    })
  }

  /**
   * Get pending notifications (for iOS app to poll)
   */
  static async getPendingNotifications(limit: number = 50) {
    try {
      const { data: notifications, error } = await supabase
        .from('notification_queue')
        .select(`
          id,
          type,
          title,
          message,
          thread_id,
          goal_id,
          activity_id,
          priority,
          data,
          created_at
        `)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString()) // Not expired
        .order('priority', { ascending: true }) // Higher priority first
        .order('created_at', { ascending: true }) // Older first within same priority
        .limit(limit)

      if (error) {
        console.error('Error fetching notifications:', error)
        return []
      }

      return notifications || []

    } catch (error) {
      console.error('Error in getPendingNotifications:', error)
      return []
    }
  }

  /**
   * Mark notifications as delivered
   */
  static async markAsDelivered(notificationIds: string[]): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notification_queue')
        .update({
          status: 'delivered',
          delivered_at: new Date().toISOString(),
          delivery_attempts: 1,
          last_attempt_at: new Date().toISOString()
        })
        .in('id', notificationIds)

      if (error) {
        console.error('Error marking notifications as delivered:', error)
        return false
      }

      console.log(`📬 Marked ${notificationIds.length} notifications as delivered`)
      return true

    } catch (error) {
      console.error('Error in markAsDelivered:', error)
      return false
    }
  }

  /**
   * Mark notifications as read
   */
  static async markAsRead(notificationIds: string[]): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notification_queue')
        .update({
          status: 'read',
          read_at: new Date().toISOString()
        })
        .in('id', notificationIds)

      if (error) {
        console.error('Error marking notifications as read:', error)
        return false
      }

      console.log(`📬 Marked ${notificationIds.length} notifications as read`)
      return true

    } catch (error) {
      console.error('Error in markAsRead:', error)
      return false
    }
  }

  /**
   * Clean up expired notifications
   */
  static async cleanupExpiredNotifications(): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('notification_queue')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select('id')

      if (error) {
        console.error('Error cleaning up notifications:', error)
        return 0
      }

      const count = data?.length || 0
      if (count > 0) {
        console.log(`🗑️ Cleaned up ${count} expired notifications`)
      }

      return count

    } catch (error) {
      console.error('Error in cleanupExpiredNotifications:', error)
      return 0
    }
  }
}
