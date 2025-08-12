import { supabase } from '@/lib/supabase/client'

interface StravaTokens {
  access_token: string
  refresh_token: string
  expires_at: string
  athlete_id: number
}

interface StravaActivity {
  id: number
  name: string
  sport_type: string
  start_date: string
  start_date_local: string
  distance: number
  moving_time: number
  elapsed_time: number
  total_elevation_gain: number
  type: string
  average_speed?: number
  max_speed?: number
  average_heartrate?: number
  max_heartrate?: number
  elev_high?: number
  elev_low?: number
  external_id?: string
  upload_id?: number
}

export class StravaClient {
  private baseUrl = 'https://www.strava.com/api/v3'

  async getValidAccessToken(): Promise<string | null> {
    try {
      // Get stored config (single row)
      const { data: config, error } = await supabase
        .from('strava_config')
        .select('*')
        .single()

      if (error || !config) {
        console.error('No Strava config found:', error)
        return null
      }

      const now = new Date()
      const expiresAt = new Date(config.expires_at)

      // If token is still valid (with 5 minute buffer), return it
      if (expiresAt.getTime() - now.getTime() > 5 * 60 * 1000) {
        return config.access_token
      }

      // Token expired, refresh it
      const newTokens = await this.refreshAccessToken(config.refresh_token)
      if (!newTokens) {
        return null
      }

      return newTokens.access_token
    } catch (error) {
      console.error('Error getting access token:', error)
      return null
    }
  }

  private async refreshAccessToken(refreshToken: string): Promise<StravaTokens | null> {
    try {
      const clientId = process.env.STRAVA_CLIENT_ID
      const clientSecret = process.env.STRAVA_CLIENT_SECRET

      if (!clientId || !clientSecret) {
        console.error('Strava credentials not configured')
        return null
      }

      const response = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      })

      if (!response.ok) {
        console.error('Token refresh failed:', await response.text())
        return null
      }

      const data = await response.json()
      
      // Update stored config
      const { error } = await supabase
        .from('strava_config')
        .update({
          access_token: data.access_token,
          refresh_token: data.refresh_token,
          expires_at: new Date(data.expires_at * 1000).toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('refresh_token', refreshToken)

      if (error) {
        console.error('Error updating tokens:', error)
        return null
      }

      return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_at: new Date(data.expires_at * 1000).toISOString(),
        athlete_id: data.athlete?.id
      }
    } catch (error) {
      console.error('Error refreshing token:', error)
      return null
    }
  }

  async makeApiCall(endpoint: string, options: RequestInit = {}): Promise<any> {
    const accessToken = await this.getValidAccessToken()
    if (!accessToken) {
      throw new Error('No valid Strava access token available')
    }

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })

    if (!response.ok) {
      throw new Error(`Strava API error: ${response.status} ${response.statusText}`)
    }

    return response.json()
  }

  async getActivities(page = 1, perPage = 30): Promise<StravaActivity[]> {
    return this.makeApiCall(`/athlete/activities?page=${page}&per_page=${perPage}`)
  }

  async getActivity(activityId: number): Promise<StravaActivity> {
    return this.makeApiCall(`/activities/${activityId}`)
  }

  async getAthlete(): Promise<any> {
    return this.makeApiCall('/athlete')
  }

  // Get activities after a specific date
  async getActivitiesAfter(afterDate: Date, page = 1, perPage = 30): Promise<StravaActivity[]> {
    const after = Math.floor(afterDate.getTime() / 1000)
    return this.makeApiCall(`/athlete/activities?after=${after}&page=${page}&per_page=${perPage}`)
  }
}

export const stravaClient = new StravaClient()
