import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * GET /api/invite/verify?token=<uuid>
 * Public endpoint: verifies an invite token and returns basic info.
 * Uses admin client to bypass RLS (unauthenticated users need this).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const token = searchParams.get('token')

  if (!token) {
    return NextResponse.json({ error: 'Token is required' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  const { data, error } = await adminClient
    .from('invitations')
    .select('email, role, accepted_at')
    .eq('token', token)
    .single()

  if (error || !data) {
    return NextResponse.json({ error: 'Invalid invite token' }, { status: 404 })
  }

  if (data.accepted_at) {
    return NextResponse.json({ status: 'accepted' })
  }

  return NextResponse.json({
    status: 'valid',
    email: data.email,
    role: data.role,
  })
}
