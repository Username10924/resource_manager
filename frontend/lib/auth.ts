export type UserRole = "line_manager" | "solution_architect" | "dashboard_viewer" | "admin" | "dtmo";

export interface User {
  id: number;
  username: string;
  role: UserRole;
  full_name: string;
  department: string | null;
}

function safeJsonParse(value: string): any | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function base64UrlDecode(input: string): string {
  const pad = '='.repeat((4 - (input.length % 4)) % 4);
  const base64 = (input + pad).replace(/-/g, '+').replace(/_/g, '/');

  // atob is available in browsers
  const decoded = atob(base64);
  // Handle UTF-8 payloads
  try {
    return decodeURIComponent(
      decoded
        .split('')
        .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join('')
    );
  } catch {
    return decoded;
  }
}

export function getJwtPayload(token: string): any | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length < 2) return null;
  const payloadStr = base64UrlDecode(parts[1]);
  return safeJsonParse(payloadStr);
}

export function isJwtExpired(token: string, skewSeconds: number = 30): boolean {
  const payload = getJwtPayload(token);
  const expSeconds = payload?.exp;
  if (typeof expSeconds !== 'number') return true;
  const nowSeconds = Math.floor(Date.now() / 1000);
  return expSeconds <= nowSeconds + skewSeconds;
}

export const authService = {
  login: async (username: string, password: string): Promise<User> => {
    // Call the backend login endpoint
    const response = await fetch("https://dplanner.alkhathlan.dev/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ detail: "Login failed" }));
      throw new Error(errorData.detail || "Login failed");
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
    localStorage.setItem("user", JSON.stringify(user));
    localStorage.setItem("access_token", data.access_token);
    return user;
  },

  logout: () => {
    localStorage.removeItem("user");
    localStorage.removeItem("access_token");
  },

  getCurrentUser: (): User | null => {
    if (typeof window === "undefined") return null;

    const token = localStorage.getItem('access_token');
    if (!token || isJwtExpired(token)) {
      authService.logout();
      return null;
    }

    const userStr = localStorage.getItem("user");
    if (!userStr) return null;
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  },

  getAccessToken: (): string | null => {
    if (typeof window === "undefined") return null;
    const token = localStorage.getItem('access_token');
    if (!token) return null;
    if (isJwtExpired(token)) {
      authService.logout();
      return null;
    }
    return token;
  },

  isAuthenticated: (): boolean => {
    return !!authService.getCurrentUser() && !!authService.getAccessToken();
  },
};
