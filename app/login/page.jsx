"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Login from '../../components/Login';
import { login } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState(null);

  const handleSubmit = async (data) => {
    setError(null);
    try {
      // Login with Express backend API
      await login(data.identifier, data.password);

      // Redirect to dashboard on success
      router.push('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      // Display error to user
      setError(error.message || 'Login failed. Please check your credentials and try again.');
      throw error;
    }
  };

  return <Login onSubmit={handleSubmit} error={error} />;
}
