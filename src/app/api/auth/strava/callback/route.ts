import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { successResponse, errorResponse, handleAPIError } from '@/lib/utils/response'

// Removed edge runtime to avoid Headers.delete immutable error

// GET /api/auth/strava/callback - Handle Strava OAuth callback
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')
    const error = searchParams.get('error')
    
    if (error) {
      return errorResponse(`Strava authorization failed: ${error}`)
    }
    
    if (!code) {
      return errorResponse('No authorization code received from Strava')
    }

    // Exchange authorization code for tokens
    const tokenResponse = await exchangeCodeForTokens(code)
    
    if (!tokenResponse.success) {
      return errorResponse(tokenResponse.error || 'Failed to exchange code for tokens')
    }

    // Store tokens in Supabase
    const storeResult = await storeStravaTokens(tokenResponse.data)
    
    if (!storeResult.success) {
      return errorResponse(storeResult.error || 'Failed to store Strava tokens')
    }

    // For personal use, redirect to a success page or return success
    const html = `
      <html>
        <head>
          <title>Strava Connected</title>
          <style>
            body { font-family: system-ui, sans-serif; text-align: center; padding: 50px; }
            h1 { color: #FC4C02; }
            .success { color: #28a745; }
          </style>
        </head>
        <body>
          <h1>🚴‍♂️ Strava Connected Successfully!</h1>
          <p class="success">Your Strava account has been connected to Brock AI Trainer.</p>
          <p>You can close this window and start syncing your activities.</p>
          <script>
            // Auto-close after 5 seconds for convenience
            setTimeout(() => {
              if (window.opener) {
                window.close();
              } else {
                window.location.href = '/';
              }
            }, 5000);
          </script>
        </body>
      </html>
    `
    
    return new Response(html, {
      status: 200,
      headers: { 
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    })
    
  } catch (error) {
    return handleAPIError(error)
  }
}

async function exchangeCodeForTokens(code: string) {
  try {
    const clientId = process.env.STRAVA_CLIENT_ID
    const clientSecret = process.env.STRAVA_CLIENT_SECRET
    const redirectUri = `${process.env.NEXTAUTH_URL}/api/auth/strava/callback`

    if (!clientId || !clientSecret) {
      return { success: false, error: 'Strava credentials not configured' }
    }

    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return { success: false, error: `Strava token exchange failed: ${errorText}` }
    }

    const data = await response.json()
    return { success: true, data }
    
  } catch (error) {
    return { success: false, error: `Token exchange error: ${error}` }
  }
}

async function storeStravaTokens(tokenData: any) {
  try {
    const {
      access_token,
      refresh_token,
      expires_at,
      athlete
    } = tokenData

    // Store in simplified strava_config table (single user)
    const { error } = await supabase
      .from('strava_config')
      .upsert({
        access_token,
        refresh_token,
        expires_at: new Date(expires_at * 1000).toISOString(),
        athlete_data: athlete,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'id'
      })

    if (error) {
      return { success: false, error: error.message }
    }

    return { success: true }
    
  } catch (error) {
    return { success: false, error: `Store tokens error: ${error}` }
  }
}
