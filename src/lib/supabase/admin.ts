import { createClient } from '@supabase/supabase-js'
import type { Database } from './types'

/**
 * Admin client using the service role key.
 * ONLY use this server-side for admin operations like:
 * - Inviting users
 * - Managing roles
 * - Bypassing RLS for admin tasks
 *
 * NEVER expose this client to the browser.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
