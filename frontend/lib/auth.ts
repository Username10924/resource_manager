export type UserRole = 'line_manager' | 'solution_architect' | 'dashboard_viewer' | 'admin';

export interface User {
  id: number;
  username: string;
  role: UserRole;
  full_name: string;
  department: string | null;
}

export const authService = {
  login: async (username: string, role: UserRole): Promise<User> => {
    // Call the backend login endpoint
    const response = await fetch('https://resource-manager-kg4d.onrender.com/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, role }),
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
    
    // Save user to localStorage with username for API authentication
    localStorage.setItem('user', JSON.stringify(user));
    return user;
  },

  register: async (username: string, role: UserRole, fullName: string, department?: string): Promise<User> => {
    // Call the backend register endpoint
    const response = await fetch('https://resource-manager-kg4d.onrender.com/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ username, role, full_name: fullName, department }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: 'Registration failed' }));
      throw new Error(errorData.detail || 'Registration failed');
    }

    const data = await response.json();
    const user: User = {
      id: data.user.id,
      username: data.user.username,
      role: data.user.role,
      full_name: data.user.full_name,
      department: data.user.department,
    };
    
    // Save user to localStorage with username for API authentication
    localStorage.setItem('user', JSON.stringify(user));
    return user;
  },

  logout: () => {
    localStorage.removeItem('user');
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

  isAuthenticated: (): boolean => {
    return !!authService.getCurrentUser();
  },
};
