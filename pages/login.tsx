import Login from '../components/Login';

/**
 * Login page using the new Login component with CSS Module design
 * 
 * ⚠️ ROUTE CONFLICT WARNING ⚠️
 * This file creates a route conflict with /app/login/page.jsx
 * 
 * Next.js does not support having both App Router and Pages Router 
 * routes at the same path. The build will fail if both exist.
 * 
 * SOLUTIONS:
 * 1. Use /app/login-new instead (working immediately, no conflicts)
 * 2. Remove /app/login/page.jsx to use this file at /login
 * 3. Rename this file (e.g., signin.tsx) for a different route
 * 
 * See LOGIN_IMPLEMENTATION_README.md for complete documentation.
 */
export default function LoginPage() {
  const handleSubmit = async (data: { identifier: string; password: string; remember: boolean }) => {
    // Integration point for authentication
    console.log('Login submitted:', data);
    
    // Example: Integrate with your auth API
    // try {
    //   const response = await fetch('/api/auth/login', {
    //     method: 'POST',
    //     headers: { 'Content-Type': 'application/json' },
    //     body: JSON.stringify({ 
    //       email: data.identifier, 
    //       password: data.password,
    //       remember: data.remember
    //     })
    //   });
    //   
    //   if (response.ok) {
    //     const result = await response.json();
    //     if (typeof window !== 'undefined') {
    //       localStorage.setItem('token', result.token);
    //       window.location.href = '/dashboard';
    //     }
    //   } else {
    //     const error = await response.json();
    //     alert(error.message || 'Login failed');
    //   }
    // } catch (err) {
    //   console.error('Login error:', err);
    //   alert('Network error. Please try again.');
    // }
  };

  return <Login onSubmit={handleSubmit} />;
}
