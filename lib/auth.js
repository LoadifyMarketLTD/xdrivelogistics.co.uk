import { createServerSupabaseClient } from './supabaseClient'

/**
 * Verify authentication token and return user
 * @param {Request} request - Next.js request object
 * @returns {Promise<{user: Object|null, error: string|null}>}
 */
export async function verifyAuth(request) {
  const supabase = createServerSupabaseClient()
  
  if (!supabase) {
    return { user: null, error: 'Supabase not configured' }
  }

  const authHeader = request.headers.get('authorization')
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { user: null, error: 'Authorization header required' }
  }

  const token = authHeader.substring(7)
  
  try {
    // Verify the JWT token
    const { data: { user }, error } = await supabase.auth.getUser(token)
    
    if (error || !user) {
      return { user: null, error: 'Invalid or expired token' }
    }

    return { user, error: null }
  } catch (err) {
    console.error('Auth verification error:', err)
    return { user: null, error: 'Authentication failed' }
  }
}

/**
 * Get user profile with role information
 * @param {string} userId - User ID
 * @returns {Promise<{profile: Object|null, error: string|null}>}
 */
export async function getUserProfile(userId) {
  const supabase = createServerSupabaseClient()
  
  if (!supabase) {
    return { profile: null, error: 'Supabase not configured' }
  }

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error) {
      return { profile: null, error: error.message }
    }

    return { profile: data, error: null }
  } catch (err) {
    console.error('Profile fetch error:', err)
    return { profile: null, error: 'Failed to fetch profile' }
  }
}
