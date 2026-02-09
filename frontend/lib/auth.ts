export type UserRole = 'line_manager' | 'solution_architect' | 'dashboard_viewer' | 'admin';

export interface User {
  id: number;
  username: string;
  role: UserRole;
  full_name: string;
  department: string | null;
}

export const authService = {
  login: async (username: string, password: string): Promise<User> => {
    // Call the backend login endpoint
    const response = await fetch('http://48.209.17.114:8000/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Login failed' }));
      throw new Error(errorData.detail || 'Login failed');
    }

    const data = await response.json();
    const user: User = {
      id: data.user.id,
      username: data.user.username,
      role: data.user.role,
      full_name: data.user.full_name,
      department: data.user.department,
    };
    
    // Save user and access token to localStorage
    localStorage.setItem('user', JSON.stringify(user));
    localStorage.setItem('access_token', data.access_token);
    return user;
  },

  logout: () => {
    localStorage.removeItem('user');
    localStorage.removeItem('access_token');
  },

  getCurrentUser: (): User | null => {
    if (typeof window === 'undefined') return null;
    const userStr = localStorage.getItem('user');
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  getAccessToken: (): string | null => {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('access_token');
  },

  isAuthenticated: (): boolean => {
    return !!authService.getCurrentUser() && !!authService.getAccessToken();
  },
};
