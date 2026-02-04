'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import Button from '@/components/Button';
import Input from '@/components/Input';

interface User {
  id: number;
  username: string;
  full_name: string;
  role: 'line_manager' | 'solution_architect' | 'dashboard_viewer' | 'admin';
  department: string | null;
}

export default function Home() {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [fullName, setFullName] = useState('');
  const [department, setDepartment] = useState('');
  const [role, setRole] = useState<'line_manager' | 'solution_architect' | 'dashboard_viewer'>('line_manager');
  const [users, setUsers] = useState<User[]>([]);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const { login, register, user } = useAuth();
  const router = useRouter();

  // Fetch users when role changes (for login mode)
  useEffect(() => {
    if (isLogin) {
      fetchUsersByRole(role);
      setSelectedUserId(null); // Reset selection when role changes
    }
  }, [role, isLogin]);

  const fetchUsersByRole = async (userRole: string) => {
    try {
      const response = await fetch(`https://resource-manager-kg4d.onrender.com/api/users/by-role/${userRole}`);
      if (response.ok) {
        const data = await response.json();
        setUsers(data);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  useEffect(() => {
    if (user) {
      // Redirect based on role
      if (user.role === 'line_manager') {
        router.push('/resources');
      } else if (user.role === 'solution_architect') {
        router.push('/projects');
      } else if (user.role === 'dashboard_viewer') {
        router.push('/dashboard');
      }
    }
  }, [user, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isLogin) {
        // Login mode - use selected user
        if (!selectedUserId) {
          setError('Please select a user');
          setIsLoading(false);
          return;
        }
        const selectedUser = users.find(u => u.id === selectedUserId);
        if (!selectedUser) {
          setError('Invalid user selection');
          setIsLoading(false);
          return;
        }
        await login(selectedUser.username, role);
      } else {
        // Register mode - use username input
        if (!username.trim()) {
          setError('Please enter a username');
          setIsLoading(false);
          return;
        }
        if (!fullName.trim()) {
          setError('Please enter your full name');
          setIsLoading(false);
          return;
        }
        await register(username, role, fullName, department || undefined);
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-orange-50 via-white to-purple-50">
      <div className="w-full max-w-md px-4">
        {/* Logo and Title */}
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-orange-600 to-pink-600 bg-clip-text text-transparent">RMS</h1>
          <p className="mt-2 text-sm text-gray-600">Resource Management System</p>
        </div>

        {/* Login/Register Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-center">
              {isLogin ? 'Sign In' : 'Create Account'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* User Selection (Login only) or Username (Register only) */}
              {isLogin ? (
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select User
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                    className="w-full px-4 py-2.5 text-left bg-white border border-gray-300 rounded-lg shadow-sm hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent transition-all duration-200 flex items-center justify-between"
                  >
                    <span className={selectedUserId ? 'text-gray-900' : 'text-gray-500'}>
                      {selectedUserId 
                        ? users.find(u => u.id === selectedUserId)?.full_name 
                        : 'Choose a user'}
                    </span>
                    <svg
                      className={`h-5 w-5 text-gray-400 transition-transform duration-200 ${
                        isUserDropdownOpen ? 'transform rotate-180' : ''
                      }`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {isUserDropdownOpen && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {users.length === 0 ? (
                        <div className="px-4 py-3 text-sm text-gray-500 text-center">
                          No users found for this role
                        </div>
                      ) : (
                        users.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => {
                              setSelectedUserId(user.id);
                              setIsUserDropdownOpen(false);
                            }}
                            className={`w-full px-4 py-3 text-left text-sm hover:bg-gray-50 transition-colors duration-150 first:rounded-t-lg last:rounded-b-lg ${
                              selectedUserId === user.id
                                ? 'bg-gray-50 text-gray-700 font-medium'
                                : 'text-gray-700'
                            }`}
                          >
                            <div className="font-medium">{user.full_name}</div>
                            <div className="text-xs text-gray-500">{user.username}</div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                  {!selectedUserId && (
                    <input
                      type="text"
                      required
                      className="absolute opacity-0 pointer-events-none"
                      value={selectedUserId || ''}
                      onChange={() => {}}
                    />
                  )}
                </div>
              ) : (
                <Input
                  label="Username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              )}

              {/* Full Name (Register only) */}
              {!isLogin && (
                <>
                  <Input
                    label="Full Name"
                    type="text"
                    placeholder="Enter your full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                  />

                  <Input
                    label="Department (Optional)"
                    type="text"
                    placeholder="e.g., Engineering, Sales"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  />
                </>
              )}

              {/* Role Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  I am a
                </label>
                <div className="grid grid-cols-1 gap-3">
                  <button
                    type="button"
                    onClick={() => setRole('line_manager')}
                    className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                      role === 'line_manager'
                        ? 'border-orange-500 bg-gradient-to-r from-orange-50 to-pink-50 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex-shrink-0">
                      <div className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                        role === 'line_manager' ? 'border-orange-500' : 'border-gray-300'
                      }`}>
                        {role === 'line_manager' && (
                          <div className="h-3 w-3 rounded-full bg-gradient-to-r from-orange-500 to-pink-500"></div>
                        )}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">Line Manager</div>
                      <div className="mt-1 text-sm text-gray-600">
                        Manage employee schedules and team availability
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('solution_architect')}
                    className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                      role === 'solution_architect'
                        ? 'border-purple-500 bg-gradient-to-r from-purple-50 to-indigo-50 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex-shrink-0">
                      <div className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                        role === 'solution_architect' ? 'border-purple-500' : 'border-gray-300'
                      }`}>
                        {role === 'solution_architect' && (
                          <div className="h-3 w-3 rounded-full bg-gradient-to-r from-purple-500 to-indigo-500"></div>
                        )}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">Project Manager</div>
                      <div className="mt-1 text-sm text-gray-600">
                        Create projects and book team resources
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRole('dashboard_viewer')}
                    className={`flex items-start gap-3 rounded-xl border-2 p-4 text-left transition-all ${
                      role === 'dashboard_viewer'
                        ? 'border-gray-400 bg-gradient-to-r from-gray-50 to-gray-100 shadow-sm'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex-shrink-0">
                      <div className={`mt-0.5 h-5 w-5 rounded-full border-2 flex items-center justify-center ${
                        role === 'dashboard_viewer' ? 'border-gray-400' : 'border-gray-300'
                      }`}>
                        {role === 'dashboard_viewer' && (
                          <div className="h-3 w-3 rounded-full bg-gradient-to-r from-gray-400 to-gray-500"></div>
                        )}
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="font-semibold text-gray-900">Dashboard Viewer</div>
                      <div className="mt-1 text-sm text-gray-600">
                        View resource and project detailed dashboards
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div className="rounded-xl bg-red-50 border border-red-100 p-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              {/* Submit Button */}
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Please wait...' : isLogin ? 'Sign In' : 'Create Account'}
              </Button>

              {/* Toggle Login/Register */}
              <div className="text-center text-sm">
                <button
                  type="button"
                  onClick={() => {
                    setIsLogin(!isLogin);
                    setError('');
                  }}
                  className="text-orange-600 hover:text-orange-700 font-medium transition-colors"
                >
                  {isLogin ? "Add new user" : 'Already have an account? Sign In'}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Info Text */}
        <p className="mt-6 text-center text-xs text-gray-500">
          Choose your role to access the appropriate dashboard and features
        </p>
      </div>
    </div>
  );
}
