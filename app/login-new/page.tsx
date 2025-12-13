"use client";

import Login from '../../components/Login';

export default function LoginNewPage() {
  const handleSubmit = async (data: { identifier: string; password: string; remember: boolean }) => {
    // This is where you would integrate with your authentication system
    // For example, calling an API endpoint or Supabase
    // Note: Do not log sensitive data in production
    console.log('Login submitted'); // Redacted for security
    
    // Example integration with existing authentication:
    // const response = await fetch('/api/auth/login', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ email: data.identifier, password: data.password })
    // });
    // 
    // if (response.ok) {
    //   window.location.href = '/dashboard';
    // }
  };

  return <Login onSubmit={handleSubmit} />;
}
