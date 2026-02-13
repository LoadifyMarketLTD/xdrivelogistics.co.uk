# Authentication System Documentation

## Overview
This directory contains the authentication system for Danny Courier Ltd, including login, protected routes, and role-based access control.

## Components

### AuthContext.tsx
Authentication context provider that manages user state and authentication logic.

**Features:**
- Login with email/password
- Logout functionality
- Role-based user detection (mobile vs desktop)
- Persistent sessions via localStorage

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

### Current Implementation (Development Only)

⚠️ **IMPORTANT**: The current implementation is for development/demonstration purposes only.

**Known Limitations:**
1. **Client-side authentication**: Credentials are validated in the browser
2. **localStorage usage**: Session data stored in localStorage (vulnerable to XSS)
3. **No token expiration**: Sessions don't expire
4. **No backend validation**: Authentication happens entirely client-side

### Production Recommendations

Before deploying to production, implement:

1. **Backend Authentication API**
   - Move credential validation to server
   - Use secure password hashing (bcrypt, argon2)
   - Implement JWT or session tokens

2. **Secure Session Management**
   - Use httpOnly cookies instead of localStorage
   - Implement session expiration and refresh tokens
   - Add CSRF protection

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

Default development credentials (can be overridden with environment variables):

**Mobile User:**
- Email: `mobile@dannycourier.co.uk`
- Password: `mobile123`

**Admin User:**
- Email: `admin@dannycourier.co.uk`
- Password: `admin123`

## Environment Variables

See `.env.example` for configuration options:
```bash
NEXT_PUBLIC_MOBILE_USER=mobile@dannycourier.co.uk
NEXT_PUBLIC_MOBILE_PASS=mobile123
NEXT_PUBLIC_ADMIN_USER=admin@dannycourier.co.uk
NEXT_PUBLIC_ADMIN_PASS=admin123
```

**Note**: These should only be used for development. Production should use a proper authentication backend.

## Role-Based Routing

Users are automatically redirected based on their role after login:
- **mobile** role → `/m` (Mobile Ops)
- **desktop** role → `/admin` (Admin Dashboard)

## Future Enhancements

- [ ] Backend API integration
- [ ] Two-factor authentication (2FA)
- [ ] Session expiration and refresh
- [ ] Password reset functionality
- [ ] User management interface
- [ ] Audit logging
- [ ] SSO/OAuth integration options
