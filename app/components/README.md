# Authentication System Documentation

## Overview
This directory contains the authentication system for XDrive Logistics Ltd, including login, protected routes, and role-based access control.

## Components

### AuthContext.tsx
Authentication context provider that manages user state and authentication logic.

**Features:**
- Login with email/password
- Logout functionality
- Role-based user detection (mobile vs desktop)
- Persistent sessions via Supabase Auth session handling

**Usage:**
```tsx
import { useAuth } from '../components/AuthContext';

function MyComponent() {
  const { user, login, logout, isLoading } = useAuth();
  // ... use authentication
}
```

### ProtectedRoute.tsx
Wrapper component for protecting pages that require authentication.

**Usage:**
```tsx
import ProtectedRoute from '../components/ProtectedRoute';

export default function MyPage() {
  return (
    <ProtectedRoute>
      {/* Protected content here */}
    </ProtectedRoute>
  );
}
```

## Pages

### Login (/login)
- Email and password input fields
- Error message display
- Automatic redirect based on user role
- 2FA notification (future feature)

### Mobile Ops (/m)
Mobile-optimized interface with:
- 2x2 grid of action tiles
- Active Jobs, Pickup, Delivery, History sections
- Mobile-friendly touch interface

### Admin (/admin)
Desktop-optimized admin dashboard with:
- Sidebar navigation
- Dashboard overview with statistics
- Quick actions
- Multiple sections: Dashboard, Invoices, Jobs, Drivers, Settings

## Security Considerations

### Current Implementation

⚠️ **IMPORTANT**: The current implementation is for development/demonstration purposes only.

**Known Limitations:**
1. **Frontend Supabase client auth**: Authentication and role hydration run in the web app via Supabase SDK
2. **RLS/policy dependency**: Data safety depends on correct Supabase RLS and membership policies

### Production Recommendations

Before deploying to production, implement:

1. **Role and tenant policy hardening**
   - Keep membership and role resolution consistent across proxy and app layers
   - Maintain strict tenant scoping for all reads/writes

2. **Session and route hardening**
   - Keep server-side route protection (`proxy.ts`) authoritative
   - Ensure expired sessions and invalid roles are denied consistently

3. **Two-Factor Authentication (2FA)**
   - Implement TOTP or SMS-based 2FA
   - Store backup codes securely

4. **Additional Security Measures**
   - Add Content Security Policy (CSP) headers
   - Implement rate limiting on login attempts
   - Add audit logging for authentication events
   - Use HTTPS exclusively
   - Regular security audits

## Test Credentials

Create test users directly in Supabase Auth for your environment.
Do not store any real or demo passwords in repository files.

## Environment Variables

See `.env.example` for configuration options:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

**Note**: Production credentials and secrets must be stored only in deployment secret managers.

## Role-Based Routing

Users are redirected based on role after login:
- **driver** → `/driver/jobs`
- **company/admin/owner** → `/admin`
- **customer** → restricted pages only where access is granted

## Future Enhancements

- [ ] Backend API integration
- [ ] Two-factor authentication (2FA)
- [ ] Session expiration and refresh
- [ ] Password reset functionality
- [ ] User management interface
- [ ] Audit logging
- [ ] SSO/OAuth integration options
