"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import { projectAPI, Booking, dashboardAPI, settingsAPI, Settings } from "@/lib/api";
import { calculateMonthlyBookingHours, formatMonth, processEmployeeScheduleWithBookings } from "@/lib/utils";
import StatsCard from "@/components/StatsCard";
import { SkeletonDashboardCharts } from "@/components/Skeleton";
import UtilizationChart from "@/components/charts/UtilizationChart";
import UtilizationBarChart from "@/components/charts/UtilizationBarChart";
import DepartmentPieChart from "@/components/charts/DepartmentPieChart";
import ProjectStatusChart from "@/components/charts/ProjectStatusChart";
import ProjectProgressChart from "@/components/charts/ProjectProgressChart";
import ProjectRoadmapGantt from "@/components/charts/ProjectRoadmapGantt";
import {
  FaUsers,
  FaBuilding,
  FaChartLine,
  FaProjectDiagram,
  FaCheckCircle,
  FaHourglassHalf,
  FaClock,
} from "react-icons/fa";
import EmployeeStatsModal from "@/components/EmployeeStatsModal";

type ViewMode = "resources" | "projects" | "employees";

interface ResourceDashboard {
  manager: string;
  total_employees: number;
  departments: Record<
    string,
    {
      count: number;
      total_available_hours: number;
      employees: any[];
    }
  >;
  monthly_summary: Record<
    number,
    {
      total_available: number;
      total_booked: number;
      total_capacity: number;
      utilization_rate: number;
    }
  >;
}

interface ProjectDashboard {
  architect: string;
  total_projects: number;
  status_distribution: Record<string, number>;
  average_progress: number;
  projects: any[];
}

export default function DashboardPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("resources");
  const [resourceData, setResourceData] = useState<ResourceDashboard | null>(null);
  const [projectData, setProjectData] = useState<ProjectDashboard | null>(null);
  const [allBookings, setAllBookings] = useState<any[]>([]);
  const [allReservations, setAllReservations] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [projectBookings, setProjectBookings] = useState<Booking[]>([]);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [settings, setSettings] = useState<Settings>({ work_hours_per_day: 7, work_days_per_month: 18.5, months_in_year: 12 });
  const [projectListYear, setProjectListYear] = useState<string>("all");
  const { user } = useAuth();

  const formatHours = (value: number) => {
    if (!Number.isFinite(value)) return '0h';
    const rounded = Math.round(value * 10) / 10;
    return `${rounded.toLocaleString(undefined, { maximumFractionDigits: 1 })}h`;
  };

  // Fetch business rules settings
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const fetchedSettings = await settingsAPI.getSettings();
        setSettings(fetchedSettings);
      } catch (error) {
        console.error('Error fetching settings:', error);
        // Keep default values if fetch fails
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    fetchDashboardData();
  }, [viewMode]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError("");

    try {
      if (viewMode === "resources" || viewMode === "employees") {
        // Fetch dashboard data + bookings + reservations
        const data = await dashboardAPI.getResourceStats();

        let bookings: any[] = [];
        let reservations: any[] = [];
        try {
          [bookings, reservations] = await Promise.all([
            projectAPI.getAllBookings(),
            dashboardAPI.getAllReservations(),
          ]);
        } catch (fetchError) {
          console.error("Error fetching bookings/reservations, continuing with empty arrays:", fetchError);
        }

        // Process all employees with correct monthly booking calculations
        const processedData = {
          ...data,
          departments: Object.fromEntries(
            Object.entries(data.departments).map(([dept, deptData]: [string, any]) => [
              dept,
              {
                ...deptData,
                employees: deptData.employees.map((emp: any) =>
                  processEmployeeScheduleWithBookings(emp, bookings)
                ),
              },
            ])
          ),
        };

        setResourceData(processedData);
        setAllBookings(bookings);
        setAllReservations(reservations);
      } else {
        const data = await dashboardAPI.getProjectStats();
        setProjectData(data);
      }
    } catch (err) {
      setError("An error occurred while fetching data");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const monthNames = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  // Prepare chart data for resources
  const getUtilizationChartData = () => {
    if (!resourceData) return [];
    return Object.entries(resourceData.monthly_summary).map(([month, data]) => ({
      month: monthNames[parseInt(month) - 1],
      available: Math.max(0, data.total_available || 0),
      utilized: data.total_booked, // Note: This is total utilized (booked + reserved)
      utilization: Math.min(100, Math.max(0, data.utilization_rate)),
    }));
  };

  const getUtilizationBarData = () => {
    if (!resourceData) return [];
    return Object.entries(resourceData.monthly_summary).map(([month, data]) => ({
      month: monthNames[parseInt(month) - 1],
      utilization: Math.min(100, Math.max(0, data.utilization_rate)),
    }));
  };

  const getDepartmentPieData = () => {
    if (!resourceData) return [];
    return Object.entries(resourceData.departments).map(([dept, data]) => ({
      name: dept,
      value: data.count,
    }));
  };

  // Prepare chart data for projects
  const getProjectStatusData = () => {
    if (!projectData) return [];
    return Object.entries(projectData.status_distribution).map(([status, count]) => ({
      name: status.replace("_", " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      value: count,
    }));
  };

  const getProjectProgressData = () => {
    if (!projectData) return [];
    return projectData.projects
      .slice(0, 8) // Show top 8 projects
      .map((project: any) => ({
        name: project.name.length > 20 ? project.name.substring(0, 20) + "..." : project.name,
        progress: project.progress,
      }));
  };

  const handleEmployeeClick = (employee: any) => {
    setSelectedEmployee(employee);
    setIsModalOpen(true);
  };

  const handleProjectClick = async (project: any) => {
    console.log("Clicking project:", project);
    setSelectedProject(project);
    setIsProjectModalOpen(true);
    try {
      console.log("Fetching bookings for project ID:", project.id);
      const bookings = await projectAPI.getBookings(project.id);
      console.log("API returned bookings:", bookings);
      setProjectBookings(bookings);
    } catch (error) {
      console.error("Error loading bookings:", error);
      setProjectBookings([]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header with Greeting */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">
          Hey {user?.full_name?.split(" ")[0] || "Ahmed"} -
        </h1>
        <p className="mt-1 text-sm text-zinc-600">here's what's happening.</p>
      </div>

      {/* View Toggle */}
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => setViewMode("resources")}
          variant={viewMode === "resources" ? "primary" : "secondary"}
        >
          Resources Dashboard
        </Button>
        <Button
          onClick={() => setViewMode("projects")}
          variant={viewMode === "projects" ? "primary" : "secondary"}
        >
          Projects Dashboard
        </Button>
        <Button
          onClick={() => setViewMode("employees")}
          variant={viewMode === "employees" ? "primary" : "secondary"}
        >
          Employees by Department
        </Button>
      </div>

      {/* Error Display */}
      {error && (
        <Card>
          <CardContent className="pt-6">
            <div className="rounded-lg bg-red-50 border border-red-100 p-4 text-red-600">
              {error}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {isLoading && <SkeletonDashboardCharts />}

      {/* Resources Dashboard */}
      {viewMode === "resources" && resourceData && !isLoading && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="TOTAL EMPLOYEES"
              value={resourceData.total_employees}
            />
            <StatsCard
              title="DEPARTMENTS"
              value={Object.keys(resourceData.departments).length}
            />
            <StatsCard
              title="HOURS BOOKED"
              value={(() => {
                // Primary source: sum from bookings (works even if schedules are missing/empty)
                const currentYear = new Date().getFullYear();
                if (Array.isArray(allBookings) && allBookings.length > 0) {
                  let total = 0;
                  for (const booking of allBookings) {
                    if ((booking?.status || '').toLowerCase() === 'cancelled') continue;
                    if (typeof booking?.booked_hours !== 'number') continue;
                    for (let month = 1; month <= 12; month++) {
                      total += calculateMonthlyBookingHours(
                        booking.start_date,
                        booking.end_date,
                        booking.booked_hours,
                        month,
                        currentYear
                      );
                    }
                  }
                  return Math.round(total).toLocaleString();
                }

                // Fallback: sum from employee schedules
                let totalProjectBooked = 0;
                Object.values(resourceData.departments).forEach((dept: any) => {
                  dept.employees.forEach((emp: any) => {
                    if (emp.schedule) {
                      emp.schedule.forEach((s: any) => {
                        totalProjectBooked += s.project_booked_hours || 0;
                      });
                    }
                  });
                });
                return Math.round(totalProjectBooked).toLocaleString();
              })()}
            />
            <StatsCard
              title="AVG UTILIZATION"
              value={`${(() => {
                const months = Object.values(resourceData.monthly_summary);
                const avgUtil =
                  months.reduce((sum, m) => sum + m.utilization_rate, 0) / months.length;
                return Math.min(100, Math.max(0, avgUtil)).toFixed(1);
              })()}%`}
            />
          </div>

          {/* Charts Row 1: Utilization Over Time */}
          <Card className="bg-white border border-zinc-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-zinc-900">
                Monthly Resource Utilization Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <UtilizationChart data={getUtilizationChartData()} />
            </CardContent>
          </Card>

          {/* Charts Row 2: Two columns */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="bg-white border border-zinc-200">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-zinc-900">
                  Utilization Rate by Month
                </CardTitle>
              </CardHeader>
              <CardContent>
                <UtilizationBarChart data={getUtilizationBarData()} />
              </CardContent>
            </Card>

            <Card className="bg-white border border-zinc-200">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-zinc-900">
                  Department Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DepartmentPieChart data={getDepartmentPieData()} />
              </CardContent>
            </Card>
          </div>

          {/* Departments Breakdown */}
          <Card className="bg-white border border-zinc-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-zinc-900">
                Department Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {Object.entries(resourceData.departments).map(([dept, data]) => (
                  <div
                    key={dept}
                    className="rounded-lg border border-zinc-200 bg-zinc-50 p-6"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-zinc-900">{dept}</h3>
                        <p className="text-sm text-zinc-500 mt-1">
                          {data.count} employee{data.count !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {data.employees.map((emp: any) => (
                        <button
                          key={emp.id}
                          onClick={() => handleEmployeeClick(emp)}
                          className="flex items-center rounded-lg bg-white p-4 border border-zinc-200 shadow-sm transition-all hover:border-zinc-300 cursor-pointer"
                        >
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-900 text-white font-medium text-sm">
                            {emp.full_name
                              .split(" ")
                              .map((n: string) => n[0])
                              .join("")
                              .toUpperCase()}
                          </div>
                          <div className="ml-3 flex-1 text-left">
                            <p className="text-sm font-medium text-zinc-900">{emp.full_name}</p>
                            <p className="text-xs text-zinc-500 mt-0.5">{emp.job_title}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Projects Dashboard */}
      {viewMode === "projects" && projectData && !isLoading && (
        <div className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="TOTAL PROJECTS"
              value={projectData.total_projects}
            />
            <StatsCard
              title="ACTIVE PROJECTS"
              value={projectData.status_distribution.active || 0}
            />
            <StatsCard
              title="COMPLETED"
              value={projectData.status_distribution.completed || 0}
            />
            <StatsCard
              title="AVG PROGRESS"
              value={`${projectData.average_progress.toFixed(1)}%`}
            />
          </div>

          {/* Charts Row: Status and Progress */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="bg-white border border-zinc-200">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-zinc-900">
                  Project Status Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ProjectStatusChart data={getProjectStatusData()} />
              </CardContent>
            </Card>

            <Card className="bg-white border border-zinc-200">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-zinc-900">
                  Project Progress Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ProjectProgressChart data={getProjectProgressData()} />
              </CardContent>
            </Card>
          </div>

          {/* Product Roadmap Gantt */}
          <Card className="bg-white border border-zinc-200">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-zinc-900">
                Product Roadmap Timeline (Monthly)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ProjectRoadmapGantt projects={projectData.projects} />
            </CardContent>
          </Card>

          {/* Projects List */}
          <Card className="bg-white border border-zinc-200">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg font-semibold text-zinc-900">All Projects</CardTitle>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-zinc-600">Year:</span>
                  <div className="flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 gap-0.5">
                    {["all", ...Array.from(new Set(
                      projectData.projects
                        .map((p: any) => p.start_date ? new Date(p.start_date + "T00:00:00").getFullYear() : null)
                        .filter(Boolean)
                    )).sort((a: any, b: any) => a - b)].map((year) => (
                      <button
                        key={String(year)}
                        onClick={() => setProjectListYear(String(year))}
                        className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                          projectListYear === String(year)
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                        }`}
                      >
                        {year === "all" ? "All" : year}
                      </button>
                    ))}
                  </div>
                  <span className="ml-1 text-xs text-zinc-400">
                    {projectData.projects.filter((p: any) => {
                      if (projectListYear === "all") return true;
                      if (!p.start_date) return false;
                      return new Date(p.start_date + "T00:00:00").getFullYear().toString() === projectListYear;
                    }).length} project{projectData.projects.filter((p: any) => {
                      if (projectListYear === "all") return true;
                      if (!p.start_date) return false;
                      return new Date(p.start_date + "T00:00:00").getFullYear().toString() === projectListYear;
                    }).length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {projectData.projects.filter((project: any) => {
                  if (projectListYear === "all") return true;
                  if (!project.start_date) return false;
                  return new Date(project.start_date + "T00:00:00").getFullYear().toString() === projectListYear;
                }).map((project: any) => (
                  <div
                    key={project.id}
                    onClick={() => handleProjectClick(project)}
                    className="rounded-lg border border-zinc-200 bg-white p-6 shadow-sm transition-all hover:border-zinc-300 cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-zinc-900 text-white shadow-sm">
                            <FaProjectDiagram />
                          </div>
                          <div>
                            <h3 className="font-semibold text-zinc-900 text-lg">{project.name}</h3>
                            <p className="mt-1 text-sm text-zinc-600">{project.description}</p>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                              project.status === "active"
                                ? "bg-emerald-100 text-emerald-700"
                                : project.status === "completed"
                                ? "bg-zinc-100 text-zinc-700"
                                : project.status === "planned"
                                ? "bg-yellow-100 text-yellow-700"
                                : project.status === "on_hold"
                                ? "bg-orange-100 text-orange-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {project.status.replace("_", " ")}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-700">
                            {project.progress}% complete
                          </span>
                        </div>
                      </div>
                      <div className="ml-6 text-right">
                        <div className="text-sm font-medium text-zinc-900">
                          {project.booking_stats?.unique_employees || 0} employees
                        </div>
                        <div className="text-sm text-zinc-500 mt-1">
                          {project.booking_stats?.total_hours || 0} hours booked
                        </div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="h-2 w-full rounded-full bg-zinc-100">
                        <div
                          className="h-2 rounded-full bg-zinc-900 transition-all"
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Employees by Department View */}
      {viewMode === "employees" && resourceData && !isLoading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            <StatsCard
              title="TOTAL EMPLOYEES"
              value={resourceData.total_employees}
            />
            <StatsCard
              title="DEPARTMENTS"
              value={Object.keys(resourceData.departments).length}
            />
            <StatsCard
              title="AVG UTILIZATION"
              value={`${(() => {
                const months = Object.values(resourceData.monthly_summary);
                if (months.length === 0) return "0.0";
                const avgUtil =
                  months.reduce((sum, m) => sum + m.utilization_rate, 0) / months.length;
                return Math.min(100, Math.max(0, avgUtil)).toFixed(1);
              })()}%`}
            />
          </div>

          {/* Employees by Department */}
          {Object.entries(resourceData.departments).map(([dept, data]) => {
            // Compute department-level stats from allBookings and allReservations
            const deptEmployeeIds = new Set(data.employees.map((e: any) => e.id));

            const deptBookings = allBookings.filter(
              (b) => deptEmployeeIds.has(b.employee_id) && (b.status || "").toLowerCase() !== "cancelled"
            );
            const deptTotalBookedHours = Math.round(
              deptBookings.reduce((sum: number, b: any) => sum + (b.booked_hours || 0), 0)
            );
            const deptProjectCount = new Set(deptBookings.map((b: any) => b.project_id)).size;

            const deptReservations = allReservations.filter(
              (r: any) => deptEmployeeIds.has(r.employee_id)
            );
            const deptReservationCount = deptReservations.length;
            const deptReservationHours = Math.round(
              deptReservations.reduce((sum: number, r: any) => {
                const start = new Date(r.start_date + "T00:00:00");
                const end = new Date(r.end_date + "T00:00:00");
                let workDays = 0;
                const cur = new Date(start);
                while (cur <= end) {
                  if (cur.getDay() !== 5 && cur.getDay() !== 6) workDays++;
                  cur.setDate(cur.getDate() + 1);
                }
                return sum + (r.reserved_hours_per_day || 0) * workDays;
              }, 0)
            );

            return (
            <Card key={dept} className="bg-white border border-zinc-200">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-zinc-900">{dept}</CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-medium text-zinc-600 bg-zinc-100 px-2.5 py-1 rounded-full">
                      {data.count} employee{data.count !== 1 ? "s" : ""}
                    </span>
                    <span className="text-xs font-medium text-blue-700 bg-blue-50 px-2.5 py-1 rounded-full">
                      {deptTotalBookedHours.toLocaleString()}h booked
                    </span>
                    <span className="text-xs font-medium text-violet-700 bg-violet-50 px-2.5 py-1 rounded-full">
                      {deptProjectCount} project{deptProjectCount !== 1 ? "s" : ""}
                    </span>
                    <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
                      {deptReservationCount} reservation{deptReservationCount !== 1 ? "s" : ""} ({deptReservationHours.toLocaleString()}h)
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {data.employees.map((emp: any) => {
                    const empSchedule = emp.schedule || [];
                    const now = new Date();
                    const nowYear = now.getFullYear();
                    const nowMonth = now.getMonth() + 1;
                    // Calculate actual available hours (remaining after bookings and reservations)
                    const totalAvailable = empSchedule.reduce(
                      (sum: number, s: any) => {
                        const isPastMonth =
                          typeof s.year === 'number' && typeof s.month === 'number'
                            ? s.year < nowYear || (s.year === nowYear && s.month < nowMonth)
                            : false;
                        if (isPastMonth) return sum;

                        const capacity = s.available_hours_per_month || 0;
                        const projectBooked = s.project_booked_hours || 0;
                        const reserved = s.reserved_hours || 0;
                        return sum + Math.max(0, capacity - projectBooked - reserved);
                      },
                      0
                    );
                    const safeTotalAvailable = Math.max(0, totalAvailable || 0);
                    // Use project_booked_hours for displaying booked hours
                    const totalBooked = empSchedule.reduce(
                      (sum: number, s: any) => sum + (s.project_booked_hours || 0),
                      0
                    );
                    // Use business rules from backend instead of hardcoded values
                    const monthlyCapacity = settings.work_hours_per_day * settings.work_days_per_month;
                    const totalCapacity = empSchedule.length * monthlyCapacity;
                    // Utilization should use total utilized (booked + reserved)
                    const totalUtilized = empSchedule.reduce(
                      (sum: number, s: any) => sum + (s.booked_hours || 0),
                      0
                    );
                    const utilization = totalCapacity > 0 ? (totalUtilized / totalCapacity) * 100 : 0;
                    const utilizationCapped = Math.min(100, Math.max(0, utilization));

                    return (
                      <button
                        key={emp.id}
                        onClick={() => handleEmployeeClick(emp)}
                        className="flex flex-col rounded-lg border border-zinc-200 bg-white p-5 shadow-sm transition-all hover:border-zinc-300 cursor-pointer text-left"
                      >
                        <div className="flex items-start space-x-3">
                          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-zinc-900 text-base font-semibold text-white">
                            {emp.full_name
                              .split(" ")
                              .map((n: string) => n[0])
                              .join("")
                              .toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-zinc-900 truncate">
                              {emp.full_name}
                            </h4>
                            <p className="text-sm text-zinc-600 truncate">{emp.job_title}</p>
                            <p className="text-xs text-zinc-400 mt-1 truncate">{emp.email}</p>
                          </div>
                        </div>

                        <div className="mt-4 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-zinc-500">Utilization</span>
                            <span className="font-semibold text-zinc-900">
                              {utilizationCapped.toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-zinc-100">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                utilization >= 90
                                  ? "bg-red-500"
                                  : utilization >= 75
                                  ? "bg-emerald-500"
                                  : utilization >= 50
                                  ? "bg-amber-500"
                                  : "bg-zinc-400"
                              }`}
                              style={{ width: `${Math.min(utilization, 100)}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-zinc-500">
                            <span>{formatHours(totalBooked)} booked</span>
                            <span>{formatHours(safeTotalAvailable)} available</span>
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-zinc-100">
                          <span className="text-xs text-zinc-600 font-medium">
                            Click to view detailed stats →
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}

      {/* Employee Stats Modal */}
      <EmployeeStatsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        employee={selectedEmployee}
      />

      {/* Project Details Modal */}
      {selectedProject && (
        <ProjectDetailsModal
          isOpen={isProjectModalOpen}
          onClose={() => {
            setIsProjectModalOpen(false);
            setSelectedProject(null);
            setProjectBookings([]);
          }}
          project={selectedProject}
          bookings={projectBookings}
        />
      )}
    </div>
  );
}

function ProjectDetailsModal({
  isOpen,
  onClose,
  project,
  bookings,
}: {
  isOpen: boolean;
  onClose: () => void;
  project: any;
  bookings: Booking[];
}) {
  // Debug logging
  console.log("Project:", project);
  console.log("Bookings received:", bookings);

  // Group bookings by employee
  const employeeBookings = bookings.reduce((acc, booking) => {
    const key = booking.employee_id;
    if (!acc[key]) {
      acc[key] = {
        employee_name: booking.full_name,
        employee_id: booking.employee_id,
        department: booking.department,
        total_hours: 0,
        bookings: [],
      };
    }
    acc[key].total_hours += booking.booked_hours;
    acc[key].bookings.push(booking);
    return acc;
  }, {} as Record<number, any>);

  const employees = Object.values(employeeBookings);
  console.log("Grouped employees:", employees);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={project.name} size="lg">
      <div className="space-y-6">
        {/* Project Info */}
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-zinc-600 mb-2">Description</h3>
            <p className="text-sm text-zinc-600">{project.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-600 mb-1">Status</h3>
              <span
                className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                  project.status === "active"
                    ? "bg-emerald-100 text-emerald-700"
                    : project.status === "completed"
                    ? "bg-zinc-100 text-zinc-700"
                    : project.status === "planned"
                    ? "bg-yellow-100 text-yellow-700"
                    : project.status === "on_hold"
                    ? "bg-orange-100 text-orange-700"
                    : "bg-red-100 text-red-700"
                }`}
              >
                {project.status.replace("_", " ")}
              </span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-600 mb-1">Progress</h3>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-zinc-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-zinc-900 transition-all"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-zinc-900">{project.progress}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Attachments Section */}
        {Array.isArray(project.attachments) && project.attachments.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-zinc-900 mb-4">Attachments</h3>
            <div className="space-y-2">
              {project.attachments.map((attachment: any, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-zinc-50 rounded-lg border border-zinc-200"
                >
                  <div className="flex items-center gap-3">
                    <svg
                      className="w-5 h-5 text-zinc-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                      />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-zinc-900">{attachment.filename}</p>
                      <p className="text-xs text-zinc-500">
                        {new Date(attachment.uploaded_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <a
                    href={`https://dplanner.alkhathlan.dev/${attachment.path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-600 hover:text-zinc-900 text-sm font-medium"
                  >
                    Download
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Team Members Section */}
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 mb-4">Team Members</h3>
          {employees.length > 0 ? (
            <div className="space-y-3">
              {employees.map((emp) => (
                <Card key={emp.employee_id} className="border-l-4 border-l-zinc-400">
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="h-10 w-10 rounded-full bg-zinc-900 flex items-center justify-center text-white font-semibold">
                            {emp.employee_name
                              .split(" ")
                              .map((n: string) => n[0])
                              .join("")
                              .toUpperCase()}
                          </div>
                          <div>
                            <h4 className="font-semibold text-zinc-900">{emp.employee_name}</h4>
                            <p className="text-xs text-zinc-500">{emp.department}</p>
                          </div>
                        </div>

                        {/* Booking details */}
                        <div className="mt-3 space-y-1">
                          {emp.bookings.map((booking: any, idx: number) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-sm bg-zinc-50 rounded px-3 py-2"
                            >
                              <span className="text-zinc-600">
                                {formatMonth(`${booking.start_date}`)} -{" "}
                                {formatMonth(`${booking.end_date}`)}
                              </span>
                              <span className="font-medium text-zinc-900">
                                {booking.booked_hours} hours total
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="ml-4 text-right">
                        <div className="text-xs text-zinc-500">Total Hours</div>
                        <div className="text-2xl font-bold text-orange-600">{emp.total_hours}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-zinc-50 rounded-lg border-2 border-dashed border-zinc-300">
              <svg
                className="mx-auto h-12 w-12 text-zinc-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
              <p className="mt-2 text-sm text-zinc-600">No team members assigned yet</p>
              <p className="mt-1 text-xs text-zinc-500">
                Book resources to add team members to this project
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}
