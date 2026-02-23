import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { UserRole } from '@/lib/supabase/types'

/**
 * POST /api/invite
 * Admin-only: Create an invitation and send a magic link to the invitee.
 *
 * Body: { email: string, role: UserRole }
 */
export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Verify the requesting user is admin
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { email, role } = body as { email: string; role: UserRole }

    if (!email || !role) {
      return NextResponse.json({ error: 'Email and role are required' }, { status: 400 })
    }

    if (!['partner', 'child'].includes(role)) {
      return NextResponse.json({ error: 'Invalid role. Must be partner or child.' }, { status: 400 })
    }

    // Use admin client for invitation operations (bypasses RLS cleanly)
    const adminClient = createAdminClient()

    // Create the invitation record
    const { data: invitation, error: inviteError } = await adminClient
      .from('invitations')
      .insert({
        email,
        role,
        invited_by: user.id,
      })
      .select('token')
      .single()

    if (inviteError) {
      // Unique constraint = already invited
      if (inviteError.code === '23505') {
        return NextResponse.json(
          { error: 'This email has already been invited.' },
          { status: 409 }
        )
      }
      return NextResponse.json({ error: inviteError.message }, { status: 500 })
    }

    // Send an invite email via Supabase Auth
    const { error: authError } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/invite?token=${invitation!.token}`,
    })

    if (authError) {
      // Don't fail the whole operation — the invitation record is created
      // The admin can share the link manually
      console.error('Failed to send invite email:', authError.message)
    }

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite?token=${invitation!.token}`

    return NextResponse.json({
      success: true,
      inviteUrl,
      emailSent: !authError,
    })
  } catch (error) {
    console.error('Invite error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
