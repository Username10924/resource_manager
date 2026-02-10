const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://dplanner.alkhathlan.dev/api";

if (!process.env.NEXT_PUBLIC_BACKEND_URL) {
  console.warn("NEXT_PUBLIC_BACKEND_URL is not set, using default backend URL");
}

// Helper function for API calls
async function fetchAPI(endpoint: string, options: RequestInit = {}) {
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

  // Log the request for debugging
  console.log("API Request:", { url, method: config.method || "GET", body: options.body });

  const response = await fetch(url, config);

  if (!response.ok) {
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

    throw new Error(errorMessage);
  }

  return response.json();
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
    fetchAPI(`/employees/${id}`, {
      method: "PUT",
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
    const accessToken = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
    const userStr = typeof window !== "undefined" ? localStorage.getItem("user") : null;
    const user = userStr ? JSON.parse(userStr) : null;

    const formData = new FormData();
    formData.append("file", file);

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
      throw new Error(error.detail || error.message || "Upload failed");
    }

    return response.json();
  },
};

// Dashboard API
export const dashboardAPI = {
  getResourceStats: (managerId?: number) => 
    fetchAPI(`/dashboard/resources${managerId ? `?manager_id=${managerId}` : ''}`),
  getProjectStats: () => fetchAPI("/dashboard/projects"),
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
