/**
 * API client for XDrive Logistics Express backend
 * Handles authentication and API requests to http://localhost:3001
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Make an API request
 * @param {string} endpoint - API endpoint (e.g., '/api/auth/login')
 * @param {object} options - Fetch options
 * @returns {Promise<any>}
 */
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  // Add auth token if available
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
  }

  try {
    const response = await fetch(url, config);
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

/**
 * Register a new user
 * @param {object} userData - User registration data
 * @returns {Promise<object>}
 */
export async function register(userData) {
  return apiRequest('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(userData),
  });
}

/**
 * Login user
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<{token: string, user: object}>}
 */
export async function login(email, password) {
  const data = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

  // Store token in localStorage
  if (data.token && typeof window !== 'undefined') {
    localStorage.setItem('authToken', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
  }

  return data;
}

/**
 * Logout user
 */
export function logout() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
  }
}

/**
 * Get current user from localStorage
 * @returns {object|null}
 */
export function getCurrentUser() {
  if (typeof window !== 'undefined') {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }
  return null;
}

/**
 * Check if user is authenticated
 * @returns {boolean}
 */
export function isAuthenticated() {
  if (typeof window !== 'undefined') {
    return !!localStorage.getItem('authToken');
  }
  return false;
}

/**
 * Get all bookings
 * @param {object} params - Query parameters
 * @returns {Promise<array>}
 */
export async function getBookings(params = {}) {
  const queryString = new URLSearchParams(params).toString();
  const endpoint = `/api/bookings${queryString ? `?${queryString}` : ''}`;
  return apiRequest(endpoint);
}

/**
 * Get dashboard statistics
 * @returns {Promise<object>}
 */
export async function getDashboardStats() {
  return apiRequest('/api/reports/dashboard-stats');
}

/**
 * Get gross margin report
 * @param {string} from - Start date (YYYY-MM-DD)
 * @param {string} to - End date (YYYY-MM-DD)
 * @returns {Promise<object>}
 */
export async function getGrossMargin(from, to) {
  const params = new URLSearchParams();
  if (from) params.append('from', from);
  if (to) params.append('to', to);
  return apiRequest(`/api/reports/gross-margin?${params.toString()}`);
}

/**
 * Health check
 * @returns {Promise<object>}
 */
export async function healthCheck() {
  return apiRequest('/health');
}
