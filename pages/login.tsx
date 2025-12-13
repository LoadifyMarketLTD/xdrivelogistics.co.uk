import Login from '../components/Login';

/**
 * Login page using the new Login component with CSS Module design
 * 
 * NOTE: This project currently uses App Router (/app directory).
 * This creates a route conflict since /app/login/page.jsx already exists.
 * 
 * To use this version:
 * 1. Remove or rename /app/login/page.jsx
 * 2. OR rename this file to create a different route (e.g., signin.tsx)
 * 3. OR use the App Router version at /app/login-new/page.tsx instead
 * 
 * See components/LOGIN_COMPONENT_README.md for complete documentation.
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
