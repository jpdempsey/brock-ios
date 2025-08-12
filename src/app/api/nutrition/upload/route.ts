import { NextRequest } from 'next/server'
import { supabase } from '@/lib/supabase/client'
import { successResponse, errorResponse, handleAPIError } from '@/lib/utils/response'
import type { NutritionEntry } from '@/types'

export const runtime = 'edge'

// POST /api/nutrition/upload - Upload HealthKit nutrition data
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { entries } = body

    if (!Array.isArray(entries)) {
      return errorResponse('Entries must be an array')
    }

    // Transform entries to match database schema
    const nutritionEntries: Partial<NutritionEntry>[] = entries.map((entry: any) => ({
      start_at: entry.startAt || entry.start_at,
      end_at: entry.endAt || entry.end_at,
      kind: mapHealthKitType(entry.type || entry.kind),
      value: entry.value,
      unit: entry.unit,
      source: entry.source || 'healthkit',
      sample_uuid: entry.sampleUUID || entry.sample_uuid
    }))

    // Use upsert to handle duplicates based on sample_uuid
    const { data: insertedEntries, error } = await supabase
      .from('nutrition_entries')
      .upsert(nutritionEntries, { 
        onConflict: 'sample_uuid',
        ignoreDuplicates: false 
      })
      .select()

    if (error) {
      return errorResponse(error.message)
    }

    return successResponse(
      insertedEntries, 
      `Successfully uploaded ${insertedEntries?.length || 0} nutrition entries`
    )
  } catch (error) {
    return handleAPIError(error)
  }
}

// Helper function to map HealthKit types to our database schema
function mapHealthKitType(healthKitType: string): string {
  const typeMap: Record<string, string> = {
    'HKQuantityTypeIdentifierDietaryEnergyConsumed': 'energy',
    'HKQuantityTypeIdentifierDietaryProtein': 'protein',
    'HKQuantityTypeIdentifierDietaryCarbohydrates': 'carbs',
    'HKQuantityTypeIdentifierDietaryFatTotal': 'fat'
  }
  
  return typeMap[healthKitType] || 'unknown'
}

