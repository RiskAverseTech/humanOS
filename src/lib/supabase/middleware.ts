import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Route protection rules for the child role.
 * These paths are blocked at the middleware level.
 */
const CHILD_BLOCKED_ROUTES = ['/images', '/api/images']

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh the auth token
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Define public routes that don't require auth
  const publicRoutes = ['/login', '/invite', '/auth/callback', '/auth/confirm']
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  )

  // Redirect unauthenticated users to login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Redirect authenticated users away from auth pages
  if (user && (pathname === '/login' || pathname === '/')) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Role-based route gating for authenticated users
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('user_id', user.id)
      .single()

    if (profile) {
      // Set role in response header so server components can read it
      supabaseResponse.headers.set('x-user-role', profile.role)

      // Block child users from image generation routes
      if (profile.role === 'child') {
        const isBlocked = CHILD_BLOCKED_ROUTES.some((route) =>
          pathname.startsWith(route)
        )

        if (isBlocked) {
          const url = request.nextUrl.clone()
          url.pathname = '/dashboard'
          return NextResponse.redirect(url)
        }
      }

      // Settings is accessible to all roles; admin-only sections are gated in the UI
    }
  }

  return supabaseResponse
}
