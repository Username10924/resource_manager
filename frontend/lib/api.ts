const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://dplanner.alkhathlan.dev/api";

if (!process.env.NEXT_PUBLIC_BACKEND_URL) {
  console.warn("NEXT_PUBLIC_BACKEND_URL is not set, using default backend URL");
}

// Helper function for API calls with automatic retry logic
async function fetchAPI(endpoint: string, options: RequestInit = {}) {
  const MAX_RETRIES = 3;
  const RETRY_DELAY = 1000; // 1 second delay between retries

  // Get access token from localStorage for authentication
  const accessToken = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;

  const url = `${API_BASE_URL}${endpoint}`;
  const config = {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
      ...options.headers,
    },
  };

  // Retry loop
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // Log the request for debugging
      console.log("API Request:", { 
        url, 
        method: config.method || "GET", 
        body: options.body, 
        attempt: attempt > 1 ? `${attempt}/${MAX_RETRIES}` : undefined 
      });

      const response = await fetch(url, config);

      if (!response.ok) {
        // Auto-logout on expired/invalid credentials
        if (response.status === 401 && typeof window !== 'undefined') {
          try {
            localStorage.removeItem('user');
            localStorage.removeItem('access_token');
          } catch {
            // ignore
          }
          // Avoid infinite reload loops
          if (window.location.pathname !== '/') {
            window.location.href = '/';
          }
        }

        const error = await response.json().catch(() => ({ detail: "An error occurred" }));
        // FastAPI returns errors in 'detail' field, but also support 'message' for compatibility
        let errorMessage: string;

        if (typeof error.detail === "string") {
          errorMessage = error.detail;
        } else if (Array.isArray(error.detail)) {
          // Handle validation errors which might be an array
          errorMessage = error.detail
            .map((e: any) => (typeof e === "string" ? e : e.msg || JSON.stringify(e)))
            .join(", ");
        } else if (typeof error.detail === "object") {
          errorMessage = JSON.stringify(error.detail);
        } else if (error.message) {
          errorMessage = error.message;
        } else {
          errorMessage = `API Error: ${response.status}`;
        }

        const apiError: any = new Error(errorMessage);
        apiError.status = response.status;
        
        // Don't retry client errors (4xx) - they won't be fixed by retrying
        if (response.status >= 400 && response.status < 500) {
          throw apiError;
        }
        
        // Retry server errors (5xx)
        throw apiError;
      }

      return response.json();
    } catch (error: any) {
      const isLastAttempt = attempt === MAX_RETRIES;
      
      // Don't retry client errors (4xx)
      const isClientError = error.status >= 400 && error.status < 500;
      
      // If this is the last attempt or it's a client error, throw it
      if (isLastAttempt || isClientError) {
        if (!isClientError) {
          console.error(`API call failed after ${MAX_RETRIES} attempts:`, error);
        }
        throw error;
      }

      // Log retry attempt
      console.warn(`API call failed (attempt ${attempt}/${MAX_RETRIES}), retrying in ${RETRY_DELAY}ms...`, error);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
    }
  }

  // This should never be reached, but TypeScript needs it
  throw new Error("Unexpected error in retry logic");
}

// Employee API
export const employeeAPI = {
  getAll: () => fetchAPI("/employees"),
  getById: (id: number) => fetchAPI(`/employees/${id}`),
  create: (data: any) =>
    fetchAPI("/employees", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: number, data: any) =>
    fetchAPI(`/employees/${id}/update`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  delete: (id: number) =>
    fetchAPI(`/employees/${id}`, {
      method: "DELETE",
    }),
  getSchedule: (id: number) => fetchAPI(`/employees/${id}/schedule`),
  updateSchedule: (id: number, data: any) =>
    fetchAPI(`/employees/${id}/schedule`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  getAvailability: (id: number, month: number, year: number) =>
    fetchAPI(`/employees/${id}/availability/${month}/${year}`),
  getProjects: (id: number, month: number, year: number) =>
    fetchAPI(`/employees/${id}/projects/${month}/${year}`),
  // Reservation APIs
  getReservations: (id: number, includeCancelled: boolean = false) =>
    fetchAPI(`/employees/${id}/reservations?include_cancelled=${includeCancelled}`),
  createReservation: (employeeId: number, data: any) =>
    fetchAPI(`/employees/${employeeId}/reservations`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  updateReservation: (employeeId: number, reservationId: number, data: any) =>
    fetchAPI(`/employees/${employeeId}/reservations/${reservationId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  deleteReservation: (employeeId: number, reservationId: number) =>
    fetchAPI(`/employees/${employeeId}/reservations/${reservationId}`, {
      method: "DELETE",
    }),
  cancelReservation: (employeeId: number, reservationId: number) =>
    fetchAPI(`/employees/${employeeId}/reservations/${reservationId}/cancel`, {
      method: "POST",
    }),
  getAvailabilityForDateRange: (employeeId: number, startDate: string, endDate: string) =>
    fetchAPI(
      `/employees/${employeeId}/availability-range?start_date=${startDate}&end_date=${endDate}`
    ),
};

// Project API
export const projectAPI = {
  getAll: () => fetchAPI("/projects"),
  getById: (id: number) => fetchAPI(`/projects/${id}`),
  create: (data: any) =>
    fetchAPI("/projects", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  update: (id: number, data: any) =>
    fetchAPI(`/projects/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    }),
  delete: (id: number) =>
    fetchAPI(`/projects/${id}`, {
      method: "DELETE",
    }),
  getBookings: (id: number) => fetchAPI(`/projects/${id}/bookings`),
  getAllBookings: () => fetchAPI("/projects/all-bookings"),
  deleteBooking: (bookingId: number) =>
    fetchAPI(`/projects/bookings/${bookingId}`, {
      method: "DELETE",
    }),
  createBooking: (projectId: number, data: any) =>
    fetchAPI(`/projects/${projectId}/bookings`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  uploadAttachment: async (projectId: number, file: File) => {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 1000;
    const accessToken = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    const userStr = typeof window !== "undefined" ? localStorage.getItem("user") : null;
    const user = userStr ? JSON.parse(userStr) : null;

    const formData = new FormData();
    formData.append("file", file);

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = await fetch(`${API_BASE_URL}/projects/${projectId}/attachments`, {
          method: "POST",
          headers: {
            ...(accessToken && { Authorization: `Bearer ${accessToken}` }),
            ...(user?.username && { "X-Username": user.username }),
          },
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({ detail: "Upload failed" }));
          const uploadError: any = new Error(error.detail || error.message || "Upload failed");
          uploadError.status = response.status;
          
          // Don't retry client errors (4xx)
          if (response.status >= 400 && response.status < 500) {
            throw uploadError;
          }
          
          throw uploadError;
        }

        return response.json();
      } catch (error: any) {
        const isLastAttempt = attempt === MAX_RETRIES;
        const isClientError = error.status >= 400 && error.status < 500;
        
        if (isLastAttempt || isClientError) {
          if (!isClientError) {
            console.error(`File upload failed after ${MAX_RETRIES} attempts:`, error);
          }
          throw error;
        }

        console.warn(`File upload failed (attempt ${attempt}/${MAX_RETRIES}), retrying in ${RETRY_DELAY}ms...`, error);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      }
    }

    throw new Error("Unexpected error in retry logic");
  },
};

// Dashboard API
export const dashboardAPI = {
  getResourceStats: (managerId?: number) => 
    fetchAPI(`/dashboard/resources${managerId ? `?manager_id=${managerId}` : ''}`),
  getProjectStats: () => fetchAPI("/dashboard/projects"),
  // Get all bookings for an employee
  getEmployeeBookings: (employeeId: number, year?: number) => {
    const currentYear = year || new Date().getFullYear();
    return fetchAPI(`/projects/all-bookings`).then((bookings: any[]) => 
      bookings.filter(b => b.employee_id === employeeId)
    );
  },
};

// User API
export const userAPI = {
  getAll: () => fetchAPI("/users"),
  getArchitects: () => fetchAPI("/users/architects"),
};

export type Employee = {
  id: number;
  full_name: string;
  position: string;
  department: string;
  line_manager_id: number | null;
  total_hours_per_day: number;
  available_days_per_year: number;
  status: string;
  created_at: string;
  updated_at: string;
};

export type Schedule = {
  id: number;
  employee_id: number;
  month: number;
  year: number;
  reserved_hours_per_day: number;
  available_hours_per_month: number;
  created_at?: string;
  updated_at?: string;
};

export type Project = {
  id: number;
  name: string;
  description: string;
  status: string;
  progress: number;
  start_date: string | null;
  end_date: string | null;
  attachments: Array<{ filename: string; path: string; uploaded_at: string }> | null;
  created_by: number;
  created_at: string;
  updated_at: string;
};

export type Booking = {
  id: number;
  project_id: number;
  employee_id: number;
  booked_hours: number;
  start_date: string;
  end_date: string;
  status?: string;
  full_name?: string;
  department?: string;
  created_at?: string;
  updated_at?: string;
};

export type User = {
  id: number;
  username: string;
  role: string;
  full_name: string;
  department: string | null;
  created_at: string;
  updated_at: string;
};

export type Reservation = {
  id: number;
  employee_id: number;
  start_date: string;
  end_date: string;
  reserved_hours_per_day: number;
  reason: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type Settings = {
  work_hours_per_day: number;
  work_days_per_month: number;
  months_in_year: number;
};

// Settings API
export const settingsAPI = {
  getSettings: (): Promise<Settings> => fetchAPI("/settings"),
  updateSettings: (data: Partial<Settings>) =>
    fetchAPI("/settings", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};
