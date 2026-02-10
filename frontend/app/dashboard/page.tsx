"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import { projectAPI, Booking, dashboardAPI } from "@/lib/api";
import { formatMonth } from "@/lib/utils";
import StatsCard from "@/components/StatsCard";
import { SkeletonDashboardCharts } from "@/components/Skeleton";
import UtilizationChart from "@/components/charts/UtilizationChart";
import UtilizationBarChart from "@/components/charts/UtilizationBarChart";
import DepartmentPieChart from "@/components/charts/DepartmentPieChart";
import ProjectStatusChart from "@/components/charts/ProjectStatusChart";
import ProjectProgressChart from "@/components/charts/ProjectProgressChart";
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [projectBookings, setProjectBookings] = useState<Booking[]>([]);
  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    fetchDashboardData();
  }, [viewMode]);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    setError("");

    try {
      if (viewMode === "resources") {
        const data = await dashboardAPI.getResourceStats();
        setResourceData(data);
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
      available: data.total_available,
      utilized: data.total_booked, // Note: This is total utilized (booked + reserved)
      utilization: data.utilization_rate,
    }));
  };

  const getUtilizationBarData = () => {
    if (!resourceData) return [];
    return Object.entries(resourceData.monthly_summary).map(([month, data]) => ({
      month: monthNames[parseInt(month) - 1],
      utilization: data.utilization_rate,
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
        <h1 className="text-2xl font-bold text-gray-900">
          Hey {user?.full_name?.split(" ")[0] || "Ahmed"} -
        </h1>
        <p className="mt-1 text-sm text-gray-600">here's what's happening.</p>
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
            <div className="rounded-xl bg-red-50 border border-red-100 p-4 text-red-600">
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
              trend={{ value: 36, isPositive: true }}
            />
            <StatsCard
              title="DEPARTMENTS"
              value={Object.keys(resourceData.departments).length}
              trend={{ value: 14, isPositive: true }}
            />
            <StatsCard
              title="HOURS BOOKED"
              value={(() => {
                // Calculate total project booked hours from all employees
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
                return totalProjectBooked.toLocaleString();
              })()}
              trend={{ value: 36, isPositive: true }}
            />
            <StatsCard
              title="AVG UTILIZATION"
              value={`${(() => {
                const months = Object.values(resourceData.monthly_summary);
                const avgUtil =
                  months.reduce((sum, m) => sum + m.utilization_rate, 0) / months.length;
                return avgUtil.toFixed(1);
              })()}%`}
              trend={{ value: 36, isPositive: true }}
            />
          </div>

          {/* Charts Row 1: Utilization Over Time */}
          <Card className="bg-white border border-gray-100">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">
                Monthly Resource Utilization Trends
              </CardTitle>
            </CardHeader>
            <CardContent>
              <UtilizationChart data={getUtilizationChartData()} />
            </CardContent>
          </Card>

          {/* Charts Row 2: Two columns */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="bg-white border border-gray-100">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">
                  Utilization Rate by Month
                </CardTitle>
              </CardHeader>
              <CardContent>
                <UtilizationBarChart data={getUtilizationBarData()} />
              </CardContent>
            </Card>

            <Card className="bg-white border border-gray-100">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">
                  Department Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DepartmentPieChart data={getDepartmentPieData()} />
              </CardContent>
            </Card>
          </div>

          {/* Departments Breakdown */}
          <Card className="bg-white border border-gray-100">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">
                Department Details
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                {Object.entries(resourceData.departments).map(([dept, data]) => (
                  <div
                    key={dept}
                    className="rounded-2xl border border-gray-100 bg-gradient-to-br from-gray-50 to-white p-6"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{dept}</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {data.count} employee{data.count !== 1 ? "s" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {data.employees.map((emp: any) => (
                        <button
                          key={emp.id}
                          onClick={() => handleEmployeeClick(emp)}
                          className="flex items-center rounded-xl bg-white p-4 border border-gray-100 shadow-sm transition-all hover:shadow-md cursor-pointer"
                        >
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-[#9CA3AF] to-[#D1D5DB] text-white font-medium text-sm">
                            {emp.full_name
                              .split(" ")
                              .map((n: string) => n[0])
                              .join("")
                              .toUpperCase()}
                          </div>
                          <div className="ml-3 flex-1 text-left">
                            <p className="text-sm font-medium text-gray-900">{emp.full_name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{emp.job_title}</p>
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
              trend={{ value: 36, isPositive: true }}
            />
            <StatsCard
              title="ACTIVE PROJECTS"
              value={projectData.status_distribution.active || 0}
              trend={{ value: 14, isPositive: true }}
            />
            <StatsCard
              title="COMPLETED"
              value={projectData.status_distribution.completed || 0}
              trend={{ value: 36, isPositive: true }}
            />
            <StatsCard
              title="AVG PROGRESS"
              value={`${projectData.average_progress.toFixed(1)}%`}
              trend={{ value: 36, isPositive: true }}
            />
          </div>

          {/* Charts Row: Status and Progress */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card className="bg-white border border-gray-100">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">
                  Project Status Distribution
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ProjectStatusChart data={getProjectStatusData()} />
              </CardContent>
            </Card>

            <Card className="bg-white border border-gray-100">
              <CardHeader>
                <CardTitle className="text-lg font-semibold text-gray-900">
                  Project Progress Overview
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ProjectProgressChart data={getProjectProgressData()} />
              </CardContent>
            </Card>
          </div>

          {/* Projects List */}
          <Card className="bg-white border border-gray-100">
            <CardHeader>
              <CardTitle className="text-lg font-semibold text-gray-900">All Projects</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {projectData.projects.map((project: any) => (
                  <div
                    key={project.id}
                    onClick={() => handleProjectClick(project)}
                    className="rounded-2xl border border-gray-100 bg-gradient-to-br from-white to-gray-50 p-6 shadow-sm transition-all hover:shadow-lg cursor-pointer"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-[#9CA3AF] to-[#D1D5DB] text-white shadow-sm">
                            <FaProjectDiagram />
                          </div>
                          <div>
                            <h3 className="font-semibold text-gray-900 text-lg">{project.name}</h3>
                            <p className="mt-1 text-sm text-gray-600">{project.description}</p>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <span
                            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
                              project.status === "active"
                                ? "bg-emerald-100 text-emerald-700"
                                : project.status === "completed"
                                ? "bg-gray-100 text-gray-700"
                                : project.status === "planned"
                                ? "bg-yellow-100 text-yellow-700"
                                : project.status === "on_hold"
                                ? "bg-orange-100 text-orange-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {project.status.replace("_", " ")}
                          </span>
                          <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
                            {project.progress}% complete
                          </span>
                        </div>
                      </div>
                      <div className="ml-6 text-right">
                        <div className="text-sm font-medium text-gray-900">
                          {project.booking_stats?.unique_employees || 0} employees
                        </div>
                        <div className="text-sm text-gray-500 mt-1">
                          {project.booking_stats?.total_hours || 0} hours booked
                        </div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="h-2 w-full rounded-full bg-gray-100">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-[#9CA3AF] to-[#D1D5DB] transition-all"
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
              trend={{ value: 36, isPositive: true }}
            />
            <StatsCard
              title="DEPARTMENTS"
              value={Object.keys(resourceData.departments).length}
              trend={{ value: 14, isPositive: true }}
            />
            <StatsCard
              title="AVG UTILIZATION"
              value={`${(() => {
                const months = Object.values(resourceData.monthly_summary);
                const avgUtil =
                  months.reduce((sum, m) => sum + m.utilization_rate, 0) / months.length;
                return avgUtil.toFixed(1);
              })()}%`}
              trend={{ value: 36, isPositive: true }}
            />
          </div>

          {/* Employees by Department */}
          {Object.entries(resourceData.departments).map(([dept, data]) => (
            <Card key={dept} className="bg-white border border-gray-100">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg font-semibold text-gray-900">{dept}</CardTitle>
                  <span className="text-sm font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                    {data.count} employee{data.count !== 1 ? "s" : ""}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {data.employees.map((emp: any) => {
                    const empSchedule = emp.schedule || [];
                    // Calculate actual available hours (remaining after bookings and reservations)
                    const totalAvailable = empSchedule.reduce(
                      (sum: number, s: any) => {
                        const capacity = s.available_hours_per_month || 0;
                        const projectBooked = s.project_booked_hours || 0;
                        const reserved = s.reserved_hours || 0;
                        return sum + Math.max(0, capacity - projectBooked - reserved);
                      },
                      0
                    );
                    // Use project_booked_hours for displaying booked hours
                    const totalBooked = empSchedule.reduce(
                      (sum: number, s: any) => sum + (s.project_booked_hours || 0),
                      0
                    );
                    const totalCapacity = empSchedule.length * 120; // 120 hours per month
                    // Utilization should use total utilized (booked + reserved)
                    const totalUtilized = empSchedule.reduce(
                      (sum: number, s: any) => sum + (s.booked_hours || 0),
                      0
                    );
                    const utilization = totalCapacity > 0 ? (totalUtilized / totalCapacity) * 100 : 0;

                    return (
                      <button
                        key={emp.id}
                        onClick={() => handleEmployeeClick(emp)}
                        className="flex flex-col rounded-2xl border border-gray-100 bg-white p-5 shadow-sm transition-all hover:shadow-lg cursor-pointer text-left"
                      >
                        <div className="flex items-start space-x-3">
                          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#9CA3AF] to-[#D1D5DB] text-base font-semibold text-white shadow-sm">
                            {emp.full_name
                              .split(" ")
                              .map((n: string) => n[0])
                              .join("")
                              .toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-semibold text-gray-900 truncate">
                              {emp.full_name}
                            </h4>
                            <p className="text-sm text-gray-600 truncate">{emp.job_title}</p>
                            <p className="text-xs text-gray-400 mt-1 truncate">{emp.email}</p>
                          </div>
                        </div>

                        <div className="mt-4 space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-gray-500">Utilization</span>
                            <span className="font-semibold text-gray-900">
                              {utilization.toFixed(1)}%
                            </span>
                          </div>
                          <div className="h-2 w-full rounded-full bg-gray-100">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                utilization >= 90
                                  ? "bg-gradient-to-r from-red-500 to-pink-500"
                                  : utilization >= 75
                                  ? "bg-gradient-to-r from-emerald-500 to-teal-500"
                                  : utilization >= 50
                                  ? "bg-gradient-to-r from-orange-500 to-amber-500"
                                  : "bg-gradient-to-r from-gray-400 to-gray-500"
                              }`}
                              style={{ width: `${Math.min(utilization, 100)}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-gray-500">
                            <span>{totalBooked}h booked</span>
                            <span>{totalAvailable}h available</span>
                          </div>
                        </div>

                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <span className="text-xs text-gray-600 font-medium">
                            Click to view detailed stats →
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          ))}
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
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Description</h3>
            <p className="text-sm text-gray-600">{project.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Status</h3>
              <span
                className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${
                  project.status === "active"
                    ? "bg-emerald-100 text-emerald-700"
                    : project.status === "completed"
                    ? "bg-gray-100 text-gray-700"
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
              <h3 className="text-sm font-semibold text-gray-700 mb-1">Progress</h3>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#9CA3AF] to-[#D1D5DB] transition-all"
                    style={{ width: `${project.progress}%` }}
                  />
                </div>
                <span className="text-sm font-medium text-gray-900">{project.progress}%</span>
              </div>
            </div>
          </div>
        </div>

        {/* Attachments Section */}
        {Array.isArray(project.attachments) && project.attachments.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Attachments</h3>
            <div className="space-y-2">
              {project.attachments.map((attachment: any, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex items-center gap-3">
                    <svg
                      className="w-5 h-5 text-gray-500"
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
                      <p className="text-sm font-medium text-gray-900">{attachment.filename}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(attachment.uploaded_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <a
                    href={`https://dplanner.alkhathlan.dev/${attachment.path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-600 hover:text-gray-800 text-sm font-medium"
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Team Members</h3>
          {employees.length > 0 ? (
            <div className="space-y-3">
              {employees.map((emp) => (
                <Card key={emp.employee_id} className="border-l-4 border-l-gray-400">
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#9CA3AF] to-[#D1D5DB] flex items-center justify-center text-white font-semibold">
                            {emp.employee_name
                              .split(" ")
                              .map((n: string) => n[0])
                              .join("")
                              .toUpperCase()}
                          </div>
                          <div>
                            <h4 className="font-semibold text-gray-900">{emp.employee_name}</h4>
                            <p className="text-xs text-gray-500">{emp.department}</p>
                          </div>
                        </div>

                        {/* Booking details */}
                        <div className="mt-3 space-y-1">
                          {emp.bookings.map((booking: any, idx: number) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between text-sm bg-gray-50 rounded px-3 py-2"
                            >
                              <span className="text-gray-600">
                                {formatMonth(`${booking.start_date}`)} -{" "}
                                {formatMonth(`${booking.end_date}`)}
                              </span>
                              <span className="font-medium text-gray-900">
                                {booking.booked_hours} hours
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="ml-4 text-right">
                        <div className="text-xs text-gray-500">Total Hours</div>
                        <div className="text-2xl font-bold text-orange-600">{emp.total_hours}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
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
              <p className="mt-2 text-sm text-gray-600">No team members assigned yet</p>
              <p className="mt-1 text-xs text-gray-500">
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
