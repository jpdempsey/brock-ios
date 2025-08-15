import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { successResponse, errorResponse, handleAPIError } from '@/lib/utils/response'

export const runtime = 'edge'

// Notification types
export type NotificationType = 
  | 'chat_message'      // Brock sent a chat message
  | 'account_update'    // Something was added to account (goal, activity, etc.)
  | 'proactive_checkin' // Proactive check-in from Brock
  | 'goal_reminder'     // Goal deadline reminder
  | 'system'           // System notifications

export interface CreateNotificationRequest {
  type: NotificationType
  title: string
  message: string
  threadId?: string
  goalId?: string
  activityId?: string
  priority?: number // 1=highest, 10=lowest
  data?: Record<string, any>
  expiresInHours?: number // Default 7 days
}

// POST /api/notifications - Add notification to queue
export async function POST(request: NextRequest) {
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
    }: CreateNotificationRequest = await request.json()

    // Validation
    if (!type || !title || !message) {
      return errorResponse('type, title, and message are required', 400)
    }

    // Calculate expiration time
    const expiresAt = new Date()
    expiresAt.setHours(expiresAt.getHours() + expiresInHours)

    // Insert notification into queue
    const { data: notification, error } = await supabase
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
      .select()
      .single()

    if (error) {
      console.error('Error creating notification:', error)
      return errorResponse(`Failed to create notification: ${error.message}`, 500)
    }

    console.log(`📬 Created ${type} notification: ${title}`)

    return successResponse({
      message: 'Notification created successfully',
      notification: {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        priority: notification.priority,
        createdAt: notification.created_at
      }
    })

  } catch (error) {
    console.error('Error in create notification:', error)
    return handleAPIError(error)
  }
}

// GET /api/notifications - Get pending notifications
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'pending'
    const limit = parseInt(searchParams.get('limit') || '50')
    const type = searchParams.get('type')

    let query = supabase
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
        status,
        created_at,
        delivered_at,
        read_at,
        expires_at
      `)
      .eq('status', status)
      .lt('expires_at', new Date().toISOString()) // Not expired
      .order('priority', { ascending: true }) // Higher priority first
      .order('created_at', { ascending: true }) // Older first within same priority
      .limit(limit)

    if (type) {
      query = query.eq('type', type)
    }

    const { data: notifications, error } = await query

    if (error) {
      return errorResponse(`Failed to fetch notifications: ${error.message}`, 500)
    }

    return successResponse({
      message: `Retrieved ${notifications?.length || 0} notifications`,
      notifications: notifications || [],
      count: notifications?.length || 0,
      filters: { status, type, limit }
    })

  } catch (error) {
    return handleAPIError(error)
  }
}

// PUT /api/notifications - Mark notifications as delivered/read
export async function PUT(request: NextRequest) {
  try {
    const { notificationIds, status, markAllAsRead } = await request.json()

    if (!notificationIds && !markAllAsRead) {
      return errorResponse('notificationIds or markAllAsRead is required', 400)
    }

    if (!['delivered', 'read', 'expired'].includes(status)) {
      return errorResponse('status must be delivered, read, or expired', 400)
    }

    let query = supabase.from('notification_queue')
    let updateData: any = { status }

    // Set timestamp based on status
    if (status === 'delivered') {
      updateData.delivered_at = new Date().toISOString()
      updateData.delivery_attempts = 1
      updateData.last_attempt_at = new Date().toISOString()
    } else if (status === 'read') {
      updateData.read_at = new Date().toISOString()
    }

    if (markAllAsRead) {
      // Mark all pending notifications as read
      query = query.eq('status', 'pending')
    } else {
      // Mark specific notifications
      query = query.in('id', notificationIds)
    }

    const { data, error } = await query
      .update(updateData)
      .select('id, type, title, status')

    if (error) {
      return errorResponse(`Failed to update notifications: ${error.message}`, 500)
    }

    console.log(`📬 Updated ${data?.length || 0} notifications to ${status}`)

    return successResponse({
      message: `Updated ${data?.length || 0} notifications to ${status}`,
      updated: data || [],
      count: data?.length || 0
    })

  } catch (error) {
    return handleAPIError(error)
  }
}

// DELETE /api/notifications - Clean up expired notifications
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cleanupExpired = searchParams.get('cleanup') === 'true'

    if (cleanupExpired) {
      // Delete expired notifications
      const { data, error } = await supabase
        .from('notification_queue')
        .delete()
        .lt('expires_at', new Date().toISOString())
        .select('id, type, title')

      if (error) {
        return errorResponse(`Failed to cleanup notifications: ${error.message}`, 500)
      }

      console.log(`🗑️ Cleaned up ${data?.length || 0} expired notifications`)

      return successResponse({
        message: `Cleaned up ${data?.length || 0} expired notifications`,
        deleted: data || [],
        count: data?.length || 0
      })
    }

    return errorResponse('Use ?cleanup=true to delete expired notifications', 400)

  } catch (error) {
    return handleAPIError(error)
  }
}
