import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { successResponse, errorResponse, handleAPIError } from '@/lib/utils/response'

export const runtime = 'edge'

// POST /api/notifications/register-device - Register device token for push notifications
export async function POST(request: NextRequest) {
  try {
    const { deviceToken, userId, deviceInfo } = await request.json()
    
    if (!deviceToken) {
      return errorResponse('Device token is required', 400)
    }
    
    // For now, we'll use a single user setup (you can extend this later)
    // In a multi-user setup, you'd validate the userId or use authentication
    
    const deviceData = {
      device_token: deviceToken,
      user_id: userId || 'default_user', // You can customize this based on your auth system
      platform: 'ios',
      device_info: deviceInfo || {},
      registered_at: new Date().toISOString(),
      is_active: true
    }
    
    // Upsert the device token (update if exists, insert if new)
    const { data, error } = await supabase
      .from('device_tokens')
      .upsert(deviceData, {
        onConflict: 'device_token',
        ignoreDuplicates: false
      })
      .select()
      .single()
    
    if (error) {
      console.error('Error registering device token:', error)
      return errorResponse(`Failed to register device token: ${error.message}`, 500)
    }
    
    console.log('✅ Device token registered successfully:', deviceToken.substring(0, 20) + '...')
    
    return successResponse({
      message: 'Device token registered successfully',
      deviceId: data.id
    })
    
  } catch (error) {
    console.error('Error in register-device:', error)
    return handleAPIError(error)
  }
}

// GET /api/notifications/register-device - Get registered devices (for debugging)
export async function GET() {
  try {
    const { data: devices, error } = await supabase
      .from('device_tokens')
      .select('id, device_token, platform, registered_at, is_active')
      .eq('is_active', true)
      .order('registered_at', { ascending: false })
    
    if (error) {
      return errorResponse(`Failed to fetch devices: ${error.message}`, 500)
    }
    
    // Mask device tokens for security
    const maskedDevices = devices?.map(device => ({
      ...device,
      device_token: device.device_token.substring(0, 20) + '...'
    }))
    
    return successResponse({
      message: 'Active devices retrieved successfully',
      devices: maskedDevices,
      count: devices?.length || 0
    })
    
  } catch (error) {
    return handleAPIError(error)
  }
}
