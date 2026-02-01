# API Endpoints Reference

This document lists all the API endpoints that the frontend expects from the backend.

## Base URL
```
http://localhost:5000/api
```

## Employee Endpoints

### GET /employees
Get all employees
- Response: `Array<Employee>`

### GET /employees/:id
Get employee by ID
- Response: `Employee`

### POST /employees
Create new employee
- Body: `{ name, role, department, available_days_per_year }`
- Response: `Employee`

### PUT /employees/:id
Update employee
- Body: `{ name?, role?, department?, available_days_per_year? }`
- Response: `Employee`

### DELETE /employees/:id
Delete employee
- Response: `{ success: boolean }`

### GET /employees/:id/schedule
Get employee schedule
- Response: `Array<Schedule>`

### PUT /employees/:id/schedule
Update employee schedule
- Body: `{ operations_hours, development_hours, other_hours, available_hours_per_month, month? }`
- Response: `Schedule`

## Project Endpoints

### GET /projects
Get all projects
- Response: `Array<Project>`

### GET /projects/:id
Get project by ID
- Response: `Project`

### POST /projects
Create new project
- Body: `{ name, description, status, progress }`
- Response: `Project`

### PUT /projects/:id
Update project
- Body: `{ name?, description?, status?, progress? }`
- Response: `Project`

### DELETE /projects/:id
Delete project
- Response: `{ success: boolean }`

### GET /projects/:id/bookings
Get project bookings
- Response: `Array<Booking>`

### POST /projects/:id/bookings
Create booking
- Body: `{ employee_id, hours, month }`
- Response: `Booking`

## Dashboard Endpoints

### GET /dashboard/resources
Get resource statistics
- Response: `{ total_employees, total_available_hours, departments, managers }`

### GET /dashboard/projects
Get project statistics
- Response: `{ total_projects, active_projects, total_bookings, avg_progress }`

## Data Models

### Employee
```typescript
{
  id: number;
  name: string;
  role: string;
  department: string;
  manager_id: number | null;
  available_days_per_year: number;
  created_at: string;
  updated_at: string;
}
```

### Schedule
```typescript
{
  id: number;
  employee_id: number;
  operations_hours: number;
  development_hours: number;
  other_hours: number;
  available_hours_per_month: number;
  month: string; // YYYY-MM format
}
```

### Project
```typescript
{
  id: number;
  name: string;
  description: string;
  status: string; // 'planning', 'active', 'on-hold', 'completed'
  progress: number; // 0-100
  attachments: string | null;
  created_by: number;
  created_at: string;
  updated_at: string;
}
```

### Booking
```typescript
{
  id: number;
  project_id: number;
  employee_id: number;
  hours: number;
  month: string; // YYYY-MM format
  created_at: string;
}
```
