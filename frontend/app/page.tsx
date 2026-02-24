'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import Button from '@/components/Button';
import Input from '@/components/Input';
import Loading from '@/components/Loading';

export default function Home() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login, user, isLoading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      // Redirect based on role
      if (user.role === 'line_manager') {
        router.push('/resources');
      } else if (user.role === 'solution_architect' || user.role === 'dtmo') {
        router.push('/projects');
      } else if (user.role === 'dashboard_viewer') {
        router.push('/dashboard');
      } else if (user.role === 'admin') {
        router.push('/dashboard');
      }
    }
  }, [user, router]);

  // Prevent login UI from flashing while auth is being resolved or while redirecting.
  if (authLoading || user) {
    return (
      <div className="min-h-screen">
        <Loading />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (!username.trim()) {
        setError('Please enter your username');
        setIsLoading(false);
        return;
      }
      if (!password.trim()) {
        setError('Please enter your password');
        setIsLoading(false);
        return;
      }
      await login(username, password);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50">
      <div className="w-full max-w-md px-4">
        {/* Logo and Title */}
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold text-zinc-900">RMS</h1>
          <p className="mt-2 text-sm text-zinc-600">Resource Management System</p>
        </div>

        {/* Login Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-center">Sign In</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Username */}
              <Input
                label="Username"
                type="text"
                placeholder="Enter your username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                autoFocus
              />

              {/* Password */}
              <Input
                label="Password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              {/* Error Message */}
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-100 p-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>
          </CardContent>
        </Card>


      </div>
    </div>
  );
}
