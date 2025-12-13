"use client";

import { useRouter } from 'next/navigation';
import Login from '../../components/Login';
import { login } from '../../lib/api';

export default function LoginPage() {
  const router = useRouter();

  const handleSubmit = async (data) => {
    try {
      // Login with Express backend API
      await login(data.identifier, data.password);

      // Redirect to dashboard on success
      router.push('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      // Display error to user
      alert(error.message || 'Login failed. Please check your credentials and try again.');
      throw error;
    }
  };

  return <Login onSubmit={handleSubmit} />;
}
