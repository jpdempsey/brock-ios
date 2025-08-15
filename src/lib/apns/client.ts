import apn from 'node-apn'

// Notification types for different use cases
export type NotificationType = 
  | 'chat_message'      // Brock sent a chat message
  | 'account_update'    // Something was added to account (goal, activity, etc.)
  | 'proactive_checkin' // Proactive check-in from Brock
  | 'system'           // System notifications

export interface NotificationData {
  type: NotificationType
  title: string
  body: string
  threadId?: string
  goalId?: string
  activityId?: string
  badge?: number
  sound?: string
  data?: Record<string, any>
}

class APNSClient {
  private provider: apn.Provider | null = null
  
  constructor() {
    this.initializeProvider()
  }
  
  private initializeProvider() {
    // Check if we have the required environment variables
    const keyId = process.env.APNS_KEY_ID
    const teamId = process.env.APNS_TEAM_ID
    const keyPath = process.env.APNS_KEY_PATH
    const bundleId = process.env.APNS_BUNDLE_ID || 'com.brock.BrockApp'
    
    if (!keyId || !teamId || !keyPath) {
      console.log('⚠️ APNs credentials not configured. Push notifications will not work.')
      console.log('Required environment variables: APNS_KEY_ID, APNS_TEAM_ID, APNS_KEY_PATH')
      return
    }
    
    try {
      const options: apn.ProviderOptions = {
        token: {
          key: keyPath, // Path to your .p8 key file
          keyId: keyId,
          teamId: teamId,
        },
        production: process.env.NODE_ENV === 'production', // Use production APNs in prod
      }
      
      this.provider = new apn.Provider(options)
      console.log('✅ APNs provider initialized successfully')
      
    } catch (error) {
      console.error('❌ Failed to initialize APNs provider:', error)
    }
  }
  
  /**
   * Send push notification to a device
   */
  async sendNotification(deviceToken: string, notificationData: NotificationData): Promise<boolean> {
    if (!this.provider) {
      console.log('⚠️ APNs provider not initialized. Skipping push notification.')
      return false
    }
    
    try {
      const notification = new apn.Notification()
      
      // Basic notification content
      notification.title = notificationData.title
      notification.body = notificationData.body
      notification.sound = notificationData.sound || 'default'
      notification.badge = notificationData.badge || 1
      
      // Set notification category and priority based on type
      switch (notificationData.type) {
        case 'chat_message':
          notification.category = 'CHAT_MESSAGE'
          notification.priority = 10 // High priority
          notification.pushType = 'alert'
          break
          
        case 'proactive_checkin':
          notification.category = 'PROACTIVE_CHECKIN'
          notification.priority = 10
          notification.pushType = 'alert'
          break
          
        case 'account_update':
          notification.category = 'ACCOUNT_UPDATE'
          notification.priority = 5 // Normal priority
          notification.pushType = 'alert'
          break
          
        case 'system':
          notification.category = 'SYSTEM'
          notification.priority = 5
          notification.pushType = 'alert'
          break
      }
      
      // Add custom payload data
      notification.payload = {
        type: notificationData.type,
        threadId: notificationData.threadId,
        goalId: notificationData.goalId,
        activityId: notificationData.activityId,
        ...notificationData.data
      }
      
      // Set topic (bundle ID)
      notification.topic = process.env.APNS_BUNDLE_ID || 'com.brock.BrockApp'
      
      // Send the notification
      const result = await this.provider.send(notification, deviceToken)
      
      // Check for failures
      if (result.failed && result.failed.length > 0) {
        console.error('❌ APNs send failed:', result.failed)
        return false
      }
      
      console.log(`✅ APNs notification sent successfully (${notificationData.type})`)
      return true
      
    } catch (error) {
      console.error('❌ Error sending APNs notification:', error)
      return false
    }
  }
  
  /**
   * Send notification to multiple devices
   */
  async sendToMultipleDevices(deviceTokens: string[], notificationData: NotificationData): Promise<number> {
    let successCount = 0
    
    for (const token of deviceTokens) {
      const success = await this.sendNotification(token, notificationData)
      if (success) successCount++
    }
    
    return successCount
  }
  
  /**
   * Create notification data for different types
   */
  static createChatNotification(threadTitle: string, message: string, threadId: string): NotificationData {
    return {
      type: 'chat_message',
      title: 'Brock',
      body: message,
      threadId,
      sound: 'default',
      badge: 1
    }
  }
  
  static createProactiveCheckinNotification(message: string, threadId: string): NotificationData {
    return {
      type: 'proactive_checkin',
      title: 'Daily Check-in',
      body: message,
      threadId,
      sound: 'default',
      badge: 1
    }
  }
  
  static createAccountUpdateNotification(title: string, message: string, data?: Record<string, any>): NotificationData {
    return {
      type: 'account_update',
      title,
      body: message,
      sound: 'default',
      badge: 1,
      data
    }
  }
  
  /**
   * Shutdown the provider
   */
  shutdown() {
    if (this.provider) {
      this.provider.shutdown()
    }
  }
}

// Export singleton instance
export const apnsClient = new APNSClient()

// Graceful shutdown
process.on('SIGINT', () => {
  apnsClient.shutdown()
  process.exit(0)
})

process.on('SIGTERM', () => {
  apnsClient.shutdown()
  process.exit(0)
})
