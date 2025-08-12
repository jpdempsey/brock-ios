import { NextResponse } from 'next/server'
import type { APIResponse } from '@/types'

export function successResponse<T>(data: T, message?: string): NextResponse<APIResponse<T>> {
  return NextResponse.json({
    data,
    message
  })
}

export function errorResponse(error: string, status: number = 400): NextResponse<APIResponse> {
  return NextResponse.json({
    error
  }, { status })
}

export function handleAPIError(error: unknown): NextResponse<APIResponse> {
  console.error('API Error:', error)
  
  if (error instanceof Error) {
    return errorResponse(error.message, 500)
  }
  
  return errorResponse('An unexpected error occurred', 500)
}

