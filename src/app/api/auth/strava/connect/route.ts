import { NextRequest } from 'next/server'
import { successResponse, errorResponse } from '@/lib/utils/response'

// Removed edge runtime to avoid Headers.delete immutable error

// GET /api/auth/strava/connect - Initiate Strava OAuth flow
export async function GET(request: NextRequest) {
  try {
    const clientId = process.env.STRAVA_CLIENT_ID
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/strava/callback`
    
    // Debug logs removed - OAuth working
    
    if (!clientId) {
      return errorResponse('Strava client ID not configured')
    }

    // Strava OAuth authorization URL
    const authUrl = new URL('https://www.strava.com/oauth/authorize')
    authUrl.searchParams.set('client_id', clientId)
    authUrl.searchParams.set('response_type', 'code')
    authUrl.searchParams.set('redirect_uri', redirectUri)
    authUrl.searchParams.set('approval_prompt', 'force')
    authUrl.searchParams.set('scope', 'read,activity:read_all')

    // For personal use, you can redirect directly or return the URL
    return Response.redirect(authUrl.toString())
  } catch (error) {
    console.error('Strava connect error:', error)
    return errorResponse('Failed to initiate Strava authentication')
  }
}
