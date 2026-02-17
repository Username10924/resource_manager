"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  projectAPI,
  employeeAPI,
  dashboardAPI,
  userAPI,
  Project,
  Employee,
  Booking,
  User,
} from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/Card";
import Button from "@/components/Button";
import Modal from "@/components/Modal";
import Input from "@/components/Input";
import { formatMonth, getMonthsList, formatRangeDuration } from "@/lib/utils";
import { SkeletonProjectsPage, Skeleton } from "@/components/Skeleton";
import * as XLSX from "xlsx";
import { VisualScheduleTimeline } from "@/components/VisualScheduleTimeline";
import type { VisualScheduleItem } from "@/components/VisualScheduleTimeline";

const BUSINESS_UNIT_OPTIONS = [
  "Chemicals",
  "Corporate Audit",
  "Digital",
  "Dry Bulk",
  "Finance",
  "Fleet Planning",
  "Liner",
  "Logistics",
  "Legal",
  "Oil",
  "Shared Services",
  "Ship Management",
  "Sustainability & GRC",
];

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [projectBookings, setProjectBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"projects" | "bookings">("projects");
  const [allBookings, setAllBookings] = useState<any[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [isBulkImportModalOpen, setIsBulkImportModalOpen] = useState(false);

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [businessUnitFilter, setBusinessUnitFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "status" | "progress" | "recent">("recent");

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeTab === "bookings" && projects.length > 0) {
      loadAllBookings();
    }
  }, [activeTab, projects]);

  const loadData = async () => {
    try {
      const [projectsData, statsData] = await Promise.all([
        projectAPI.getAll(),
        dashboardAPI.getProjectStats(),
      ]);
      console.log("Projects Data:", projectsData);
      console.log("Stats Data:", statsData);
      setProjects(projectsData);
      setStats(statsData);
    } catch (error) {
      console.error("Error loading data:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadAllBookings = async () => {
    setLoadingBookings(true);
    try {
      console.log("Loading all bookings by fetching from each project...");

      // Fetch bookings from each project individually
      const bookingsPromises = projects.map(async (project) => {
        try {
          const bookings = await projectAPI.getBookings(project.id);
          // Add project info to each booking
          return bookings.map((b: any) => ({
            ...b,
            project_name: project.name,
            project_code: (project as any).project_code || `P${project.id}`,
          }));
        } catch (err) {
          console.error(`Error fetching bookings for project ${project.id}:`, err);
          return [];
        }
      });

      const allBookingsArrays = await Promise.all(bookingsPromises);
      const combinedBookings = allBookingsArrays.flat();

      console.log("Combined bookings:", combinedBookings);
      setAllBookings(combinedBookings);
    } catch (error) {
      console.error("Error loading bookings:", error);
      setAllBookings([]);
    } finally {
      setLoadingBookings(false);
    }
  };

  const handleDeleteBooking = async (bookingId: number) => {
    const confirmed = window.confirm("Are you sure you want to delete this booking?");
    if (!confirmed) return;

    try {
      await projectAPI.deleteBooking(bookingId);
      loadAllBookings();
      loadData(); // Refresh stats
    } catch (error) {
      console.error("Error deleting booking:", error);
      alert("Failed to delete booking: " + (error as Error).message);
    }
  };

  const openProjectDetails = async (project: Project) => {
    setSelectedProject(project);
    setIsDetailsModalOpen(true);
    try {
      const bookings = await projectAPI.getBookings(project.id);
      setProjectBookings(bookings);
    } catch (error) {
      console.error("Error loading bookings:", error);
      setProjectBookings([]);
    }
  };

  const openBookingModal = (project: Project) => {
    router.push(`/projects/${project.id}/book`);
  };

  const openEditModal = (project: Project) => {
    setSelectedProject(project);
    setIsEditModalOpen(true);
  };

  const openDeleteModal = (project: Project) => {
    setSelectedProject(project);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteProject = async () => {
    if (!selectedProject) return;

    try {
      await projectAPI.delete(selectedProject.id);
      setIsDeleteModalOpen(false);
      setSelectedProject(null);
      loadData();
    } catch (error) {
      console.error("Error deleting project:", error);
      alert("Failed to delete project: " + (error as Error).message);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "active":
        return "bg-emerald-50 text-emerald-700 border border-emerald-200";
      case "planning":
        return "bg-zinc-100 text-zinc-700 border border-zinc-200";
      case "completed":
        return "bg-zinc-100 text-zinc-700 border border-zinc-200";
      case "on-hold":
        return "bg-amber-50 text-amber-700 border border-amber-200";
      default:
        return "bg-zinc-100 text-zinc-700 border border-zinc-200";
    }
  };

  // Filtered & sorted projects
  const filteredProjects = projects
    .filter((project) => {
      // Search filter
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const matchesSearch =
          project.name.toLowerCase().includes(q) ||
          project.description?.toLowerCase().includes(q) ||
          ((project as any).project_code || "").toLowerCase().includes(q) ||
          ((project as any).business_unit || "").toLowerCase().includes(q);
        if (!matchesSearch) return false;
      }
      // Status filter
      if (statusFilter !== "all" && project.status.toLowerCase() !== statusFilter) return false;
      // Business unit filter
      if (businessUnitFilter !== "all" && ((project as any).business_unit || "") !== businessUnitFilter) return false;
      return true;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "status":
          return a.status.localeCompare(b.status);
        case "progress":
          return b.progress - a.progress;
        case "recent":
        default:
          return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
      }
    });

  // Unique business units from data
  const activeBusinessUnits = Array.from(
    new Set(projects.map((p) => (p as any).business_unit).filter(Boolean))
  ).sort();

  // Active filter count
  const activeFilterCount =
    (statusFilter !== "all" ? 1 : 0) +
    (businessUnitFilter !== "all" ? 1 : 0) +
    (searchQuery ? 1 : 0);

  if (loading) {
    return <SkeletonProjectsPage />;
  }

  return (
    <>
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-zinc-900">
              Projects
            </h1>
            <p className="mt-2 text-sm text-zinc-600">Manage projects and resource bookings</p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setIsBulkImportModalOpen(true)}>
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Bulk Import
              </span>
            </Button>
            <Button onClick={() => setIsCreateModalOpen(true)}>Create Project</Button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      {stats && (
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100">
                <svg className="h-5 w-5 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
              <div>
                <div className="text-2xl font-bold text-zinc-900">{stats.total_projects || 0}</div>
                <div className="text-xs text-zinc-500">Total Projects</div>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
                <svg className="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <div>
                <div className="text-2xl font-bold text-emerald-600">{stats.active_projects || 0}</div>
                <div className="text-xs text-zinc-500">Active Projects</div>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100">
                <svg className="h-5 w-5 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <div className="text-2xl font-bold text-zinc-700">{stats.total_bookings || 0}</div>
                <div className="text-xs text-zinc-500">Total Bookings</div>
              </div>
            </div>
          </div>
          <div className="rounded-lg border border-zinc-200 bg-white p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-100">
                <svg className="h-5 w-5 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <div>
                <div className="text-2xl font-bold text-zinc-900">{stats.avg_progress || 0}%</div>
                <div className="text-xs text-zinc-500">Avg Progress</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-zinc-200">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab("projects")}
            className={`whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors ${
              activeTab === "projects"
                ? "border-zinc-900 text-zinc-900"
                : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              Projects
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">{projects.length}</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab("bookings")}
            className={`whitespace-nowrap border-b-2 py-3 px-1 text-sm font-medium transition-colors ${
              activeTab === "bookings"
                ? "border-zinc-900 text-zinc-900"
                : "border-transparent text-zinc-500 hover:border-zinc-300 hover:text-zinc-700"
            }`}
          >
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              Manage Bookings
            </div>
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === "projects" && (
        <div className="space-y-4">
          {/* Search & Filters Bar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {/* Search */}
            <div className="relative flex-1 max-w-md">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Search projects by name, code, or description..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-zinc-200 bg-white py-2 pl-10 pr-4 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400 transition-all"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="planning">Planning</option>
                <option value="on-hold">On Hold</option>
                <option value="completed">Completed</option>
              </select>

              <select
                value={businessUnitFilter}
                onChange={(e) => setBusinessUnitFilter(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
              >
                <option value="all">All Business Units</option>
                {activeBusinessUnits.map((unit) => (
                  <option key={unit} value={unit}>{unit}</option>
                ))}
              </select>

              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700 focus:border-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-400"
              >
                <option value="recent">Most Recent</option>
                <option value="name">Name A-Z</option>
                <option value="status">Status</option>
                <option value="progress">Progress</option>
              </select>

              {activeFilterCount > 0 && (
                <button
                  onClick={() => {
                    setSearchQuery("");
                    setStatusFilter("all");
                    setBusinessUnitFilter("all");
                    setSortBy("recent");
                  }}
                  className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-medium text-zinc-600 hover:bg-zinc-100 transition-colors"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Clear filters ({activeFilterCount})
                </button>
              )}
            </div>
          </div>

          {/* Results count */}
          <div className="text-xs text-zinc-400">
            Showing {filteredProjects.length} of {projects.length} projects
          </div>

          {/* Project Cards */}
          {filteredProjects.length === 0 ? (
            <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center">
              <svg className="mx-auto h-10 w-10 text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <div className="mt-3 text-sm text-zinc-500">No projects match your filters</div>
              <button
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setBusinessUnitFilter("all");
                }}
                className="mt-2 text-sm font-medium text-zinc-700 hover:text-zinc-900 underline underline-offset-2"
              >
                Clear all filters
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {filteredProjects.map((project) => (
                <div
                  key={project.id}
                  className="group cursor-pointer rounded-lg border border-zinc-200 bg-white p-5 transition-all hover:border-zinc-300 hover:shadow-sm"
                  onClick={() => openProjectDetails(project)}
                >
                  {/* Top row: name + status */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold text-zinc-900 truncate">{project.name}</h3>
                        {(project as any).project_code && (
                          <span className="shrink-0 text-[11px] font-mono font-semibold text-zinc-500 bg-zinc-100 px-1.5 py-0.5 rounded">
                            {(project as any).project_code}
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-zinc-500 line-clamp-1">{project.description}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium capitalize ${getStatusColor(project.status)}`}>
                      {project.status}
                    </span>
                  </div>

                  {/* Meta row */}
                  {(project as any).business_unit && (
                    <div className="mt-2 text-[11px] text-zinc-400">
                      {(project as any).business_unit}
                    </div>
                  )}

                  {/* Progress Bar */}
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-[11px] text-zinc-500">Progress</span>
                      <span className="text-[11px] font-semibold text-zinc-700">{project.progress}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
                      <div
                        className={`h-full rounded-full transition-all ${
                          project.progress >= 100
                            ? "bg-emerald-500"
                            : project.progress >= 50
                            ? "bg-zinc-900"
                            : "bg-zinc-400"
                        }`}
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-3 flex gap-2 pt-3 border-t border-zinc-100">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openEditModal(project);
                      }}
                      className="flex-1 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openBookingModal(project);
                      }}
                      className="flex-1 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-zinc-800 transition-colors"
                    >
                      Book Resources
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        openDeleteModal(project);
                      }}
                      className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "bookings" && (
        <Card>
          <CardHeader>
            <CardTitle>All Bookings</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loadingBookings ? (
              <div className="p-8 text-center">
                <div className="text-sm text-zinc-600">Loading bookings...</div>
              </div>
            ) : !allBookings || allBookings.length === 0 ? (
              <div className="p-8 text-center">
                <div className="text-sm text-zinc-600">
                  No bookings found
                  <div className="mt-2 text-xs text-zinc-500">
                    {allBookings === null
                      ? "Error loading bookings"
                      : "No bookings have been created yet"}
                  </div>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-zinc-200 bg-zinc-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-600">
                        Project
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-600">
                        Employee
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-600">
                        Department
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-600">
                        Date Range
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-600">
                        Hours
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-600">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 bg-white">
                    {allBookings.map((booking) => (
                      <tr key={booking.id} className="hover:bg-zinc-50">
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="text-sm font-medium text-zinc-900">
                            {booking.project_name}
                          </div>
                          <div className="text-xs text-zinc-500">{booking.project_code}</div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="text-sm text-zinc-900">{booking.full_name}</div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600">
                          {booking.department}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="text-sm text-zinc-900">
                            {new Date(booking.start_date + "T00:00:00").toLocaleDateString()}
                          </div>
                          <div className="text-xs text-zinc-500">
                            to {new Date(booking.end_date + "T00:00:00").toLocaleDateString()}
                          </div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-900">
                          {booking.booked_hours}h
                          <span className="text-xs text-zinc-500 ml-1">(total)</span>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteBooking(booking.id)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Projects Grid */}
      <div className="hidden">{/* Placeholder for removed duplicate */}</div>

      {/* Bulk Import Modal */}
      <BulkImportModal
        isOpen={isBulkImportModalOpen}
        onClose={() => setIsBulkImportModalOpen(false)}
        onImport={loadData}
      />

      {/* Create Project Modal */}
      <CreateProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={loadData}
      />

      {/* Edit Project Modal */}
      {selectedProject && (
        <EditProjectModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedProject(null);
          }}
          project={selectedProject}
          onUpdate={loadData}
        />
      )}

      {/* Booking Modal */}
      {selectedProject && (
        <BookingModal
          isOpen={isBookingModalOpen}
          onClose={() => {
            setIsBookingModalOpen(false);
            setSelectedProject(null);
          }}
          project={selectedProject}
          onBook={loadData}
        />
      )}

      {/* Delete Confirmation Modal */}
      {selectedProject && (
        <Modal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setSelectedProject(null);
          }}
          title="Delete Project"
        >
          <div className="space-y-4">
            <p className="text-sm text-zinc-600">
              Are you sure you want to delete the project <strong>{selectedProject.name}</strong>?
              This will also delete all associated bookings and cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setIsDeleteModalOpen(false);
                  setSelectedProject(null);
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleDeleteProject} className="bg-red-600 hover:bg-red-700">
                Delete Project
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Project Details Modal */}
      {selectedProject && (
        <ProjectDetailsModal
          isOpen={isDetailsModalOpen}
          onClose={() => {
            setIsDetailsModalOpen(false);
            setSelectedProject(null);
            setProjectBookings([]);
          }}
          project={selectedProject}
          bookings={projectBookings}
        />
      )}
    </>
  );
}

function CreateProjectModal({
  isOpen,
  onClose,
  onCreate,
}: {
  isOpen: boolean;
  onClose: () => void;
  onCreate: () => void;
}) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isEmployeeOpen, setIsEmployeeOpen] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [formData, setFormData] = useState({
    project_code: "",
    name: "",
    business_unit: "",
    description: "",
    solution_architect_id: 0, // Will be set to first employee
    start_date: "",
    end_date: "",
  });

  useEffect(() => {
    if (isOpen) {
      loadEmployees();
      loadProjects();
      setEmployeeSearch("");
    }
  }, [isOpen]);

  // Auto-generate project code when project manager changes
  useEffect(() => {
    if (formData.solution_architect_id && employees.length > 0 && allProjects.length > 0) {
      generateProjectCode();
    }
  }, [formData.solution_architect_id, employees, allProjects]);

  const loadEmployees = async () => {
    try {
      const data = await employeeAPI.getAll();
      setEmployees(data);
      if (data.length > 0 && !formData.solution_architect_id) {
        setFormData((prev) => ({ ...prev, solution_architect_id: data[0].id }));
      }
    } catch (error) {
      console.error("Error loading employees:", error);
    }
  };

  const loadProjects = async () => {
    try {
      const data = await projectAPI.getAll();
      setAllProjects(data);
    } catch (error) {
      console.error("Error loading projects:", error);
    }
  };

  const getDepartmentPrefix = (department: string): string => {
    // Map department names to prefixes
    const departmentMap: Record<string, string> = {
      Finance: "FIN",
      Engineering: "ENG",
      IT: "IT",
      Marketing: "MKT",
      Sales: "SAL",
      HR: "HR",
      "Human Resources": "HR",
      Operations: "OPS",
      Product: "PRD",
      Design: "DES",
      Legal: "LEG",
      "Customer Support": "SUP",
      Research: "RES",
    };

    // Check if department exists in map
    if (departmentMap[department]) {
      return departmentMap[department];
    }

    // Otherwise, take first 3 letters and uppercase
    return department.substring(0, 3).toUpperCase();
  };

  const generateProjectCode = () => {
    const selectedEmployee = employees.find((e) => e.id === formData.solution_architect_id);
    if (!selectedEmployee || !selectedEmployee.department) return;

    const prefix = getDepartmentPrefix(selectedEmployee.department);

    // Find all projects with this prefix
    const prefixPattern = new RegExp(`^${prefix}-(\\d+)$`);
    const matchingProjects = allProjects.filter((p) => {
      const code = (p as any).project_code || p.name;
      return prefixPattern.test(code);
    });

    // Find the highest number
    let maxNumber = 0;
    matchingProjects.forEach((p) => {
      const code = (p as any).project_code || p.name;
      const match = code.match(prefixPattern);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) {
          maxNumber = num;
        }
      }
    });

    // Generate next code
    const nextNumber = maxNumber + 1;
    const projectCode = `${prefix}-${String(nextNumber).padStart(3, "0")}`;

    setFormData((prev) => ({ ...prev, project_code: projectCode }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      // Convert date strings to proper format or null
      const payload = {
        ...formData,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
      };
      console.log("[CREATE] Creating project with payload:", payload);
      const response = await projectAPI.create(payload);
      console.log("[CREATE] Project created:", response);

      // Upload attachments if any - response contains {success: true, project: {...}}
      const projectId = response.project?.id || response.id;
      if (attachments.length > 0 && projectId) {
        console.log(
          `[CREATE] Uploading ${attachments.length} attachments for project ID:`,
          projectId
        );
        for (const file of attachments) {
          try {
            console.log("[CREATE] Uploading file:", file.name);
            const uploadResult = await projectAPI.uploadAttachment(projectId, file);
            console.log("[CREATE] Upload successful:", uploadResult);
          } catch (uploadError) {
            console.error("[CREATE] Error uploading file:", file.name, uploadError);
            alert(`Failed to upload ${file.name}: ${uploadError}`);
          }
        }
      } else {
        console.log(
          "[CREATE] No attachments to upload or no project ID. Attachments:",
          attachments.length,
          "Project ID:",
          projectId
        );
      }

      onCreate();
      onClose();
      setFormData({
        project_code: "",
        name: "",
        business_unit: "",
        description: "",
        solution_architect_id: 0,
        start_date: "",
        end_date: "",
      });
      setAttachments([]);
    } catch (error) {
      console.error("[CREATE] Error creating project:", error);
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
      alert(`Failed to create project: ${errorMessage}`);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Create New Project" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-zinc-900 mb-1">Project Code</label>
          <input
            type="text"
            value={formData.project_code}
            readOnly
            className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-sm bg-zinc-50 text-zinc-600 cursor-not-allowed focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 focus:outline-none"
            placeholder="Auto-generated based on department"
          />
          <p className="mt-1 text-xs text-zinc-500">
            Auto-generated based on project manager's department
          </p>
        </div>

        <Input
          label="Project Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />

        <div>
          <label className="block text-sm font-medium text-zinc-900 mb-1">Business Unit</label>
          <select
            value={formData.business_unit}
            onChange={(e) => setFormData({ ...formData, business_unit: e.target.value })}
            className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 focus:outline-none"
          >
            <option value="">Select business unit</option>
            {BUSINESS_UNIT_OPTIONS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-900 mb-1">Description</label>
          <textarea
            className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 focus:outline-none"
            rows={4}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-900 mb-1">
            Project Manager <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsEmployeeOpen(!isEmployeeOpen);
                if (!isEmployeeOpen) setEmployeeSearch("");
              }}
              className="w-full px-3 py-2 text-left text-sm bg-white border border-zinc-200 rounded-md hover:border-zinc-400 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-all duration-200 flex items-center justify-between group"
            >
              <span className="text-zinc-900">
                {employees.find((e) => e.id === formData.solution_architect_id)?.full_name ||
                  "Select a project manager"}
              </span>
              <svg
                className={`w-5 h-5 text-zinc-400 transition-transform duration-200 flex-shrink-0 ${
                  isEmployeeOpen ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {isEmployeeOpen && (
              <div className="absolute z-10 w-full mt-2 bg-white border border-zinc-200 rounded-lg shadow-sm max-h-60 overflow-auto">
                <div className="sticky top-0 bg-white p-2 border-b border-zinc-100">
                  <input
                    type="text"
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    placeholder="Search project managers..."
                    className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md hover:border-zinc-400 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-all duration-200"
                  />
                </div>
                {employees
                  .slice()
                  .sort((a, b) => a.full_name.localeCompare(b.full_name))
                  .filter(
                    (employee) =>
                      employee.full_name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
                      employee.department.toLowerCase().includes(employeeSearch.toLowerCase()) ||
                      employee.position.toLowerCase().includes(employeeSearch.toLowerCase())
                  )
                  .map((employee) => (
                  <button
                    key={employee.id}
                    type="button"
                    onClick={() => {
                      setFormData((prev) => ({ ...prev, solution_architect_id: employee.id }));
                      setIsEmployeeOpen(false);
                      setEmployeeSearch("");
                    }}
                    className={`w-full px-4 py-3 text-left text-sm hover:bg-zinc-50 transition-colors duration-150 first:rounded-t-lg last:rounded-b-lg ${
                      formData.solution_architect_id === employee.id
                        ? "bg-zinc-50 text-zinc-700 font-medium"
                        : "text-zinc-700"
                    }`}
                  >
                    <div className="font-medium">{employee.full_name}</div>
                    <div className="text-xs text-zinc-500">{employee.department} - {employee.position}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
          {!formData.solution_architect_id && (
            <input
              type="text"
              required
              className="absolute opacity-0 pointer-events-none"
              value={formData.solution_architect_id}
              onChange={() => {}}
            />
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Start Date"
            type="date"
            value={formData.start_date}
            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
          />

          <Input
            label="End Date"
            type="date"
            value={formData.end_date}
            onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
          />
        </div>
        {formData.start_date && formData.end_date && (
          <div className="-mt-2 text-xs text-zinc-500">
            Duration:{" "}
            <span className="font-medium text-zinc-600">
              {formatRangeDuration(formData.start_date, formData.end_date)}
            </span>
          </div>
        )}

        {/* File Attachments */}
        <div>
          <label className="block text-sm font-medium text-zinc-900 mb-2">Attachments</label>
          <div
            className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
              isDragging ? "border-zinc-400 bg-zinc-50" : "border-zinc-300 hover:border-zinc-400"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const files = Array.from(e.dataTransfer.files);
              setAttachments((prev) => [...prev, ...files]);
            }}
          >
            <input
              type="file"
              multiple
              onChange={(e) => {
                if (e.target.files) {
                  const files = Array.from(e.target.files);
                  setAttachments((prev) => [...prev, ...files]);
                }
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="text-center">
              <svg
                className="mx-auto h-12 w-12 text-zinc-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="mt-2 text-sm text-zinc-600">
                <span className="font-semibold text-zinc-600">Click to upload</span> or drag and
                drop
              </p>
              <p className="mt-1 text-xs text-zinc-500">Any file type supported</p>
            </div>
          </div>

          {/* File List */}
          {attachments.length > 0 && (
            <div className="mt-3 space-y-2">
              {attachments.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between bg-zinc-50 rounded-lg px-3 py-2"
                >
                  <div className="flex items-center space-x-2 flex-1 min-w-0">
                    <svg
                      className="h-5 w-5 text-zinc-400 flex-shrink-0"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                      />
                    </svg>
                    <span className="text-sm text-zinc-700 truncate">{file.name}</span>
                    <span className="text-xs text-zinc-500 flex-shrink-0">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachments((prev) => prev.filter((_, i) => i !== index))}
                    className="ml-2 text-red-600 hover:text-red-800 flex-shrink-0"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Create Project</Button>
        </div>
      </form>
    </Modal>
  );
}

function EditProjectModal({
  isOpen,
  onClose,
  project,
  onUpdate,
}: {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  onUpdate: () => void;
}) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isEmployeeOpen, setIsEmployeeOpen] = useState(false);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [formData, setFormData] = useState({
    name: project.name,
    business_unit: (project as any).business_unit || "",
    description: project.description,
    status: project.status,
    progress: project.progress,
    solution_architect_id: (project as any).solution_architect_id || 0,
    start_date: (project as any).start_date || "",
    end_date: (project as any).end_date || "",
  });

  useEffect(() => {
    if (isOpen) {
      loadEmployees();
      // Reset state when modal opens
      setFormData({
        name: project.name,
        business_unit: (project as any).business_unit || "",
        description: project.description,
        status: project.status,
        progress: project.progress,
        solution_architect_id: (project as any).solution_architect_id || 0,
        start_date: (project as any).start_date || "",
        end_date: (project as any).end_date || "",
      });
      setEmployeeSearch("");
      setAttachments([]);
    }
  }, [isOpen, project]);

  const loadEmployees = async () => {
    try {
      const data = await employeeAPI.getAll();
      setEmployees(data);
    } catch (error) {
      console.error("Error loading employees:", error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.start_date && formData.end_date && formData.end_date < formData.start_date) {
      alert("Project end date must be after or equal to start date");
      return;
    }

    try {
      const payload = {
        ...formData,
        start_date: formData.start_date || null,
        end_date: formData.end_date || null,
      };

      console.log("[EDIT] Updating project with formData:", payload);
      await projectAPI.update(project.id, payload);

      // Upload new attachments if any
      if (attachments.length > 0) {
        console.log(
          `[EDIT] Uploading ${attachments.length} new attachments for project ID:`,
          project.id
        );
        for (const file of attachments) {
          try {
            console.log("[EDIT] Uploading file:", file.name);
            const uploadResult = await projectAPI.uploadAttachment(project.id, file);
            console.log("[EDIT] Upload successful:", uploadResult);
          } catch (uploadError) {
            console.error("[EDIT] Error uploading file:", file.name, uploadError);
            alert(`Failed to upload ${file.name}: ${uploadError}`);
          }
        }
      }

      onUpdate();
      onClose();
    } catch (error) {
      console.error("[EDIT] Error updating project:", error);
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred";
      alert(`Failed to update project: ${errorMessage}`);
    }
  };

  const handleFileSelect = (files: FileList | null) => {
    if (files) {
      setAttachments((prev) => [...prev, ...Array.from(files)]);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Project" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Show existing attachments */}
        {Array.isArray(project.attachments) && project.attachments.length > 0 && (
          <div>
            <label className="block text-sm font-medium text-zinc-900 mb-2">
              Existing Attachments
            </label>
            <div className="space-y-2">
              {project.attachments.map((attachment: any, index: number) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-zinc-50 rounded-lg border border-zinc-200"
                >
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-zinc-500"
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
                    <span className="text-sm text-zinc-900">{attachment.filename}</span>
                  </div>
                  <a
                    href={`https://dplanner.alkhathlan.dev/${attachment.path}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-600 hover:text-zinc-800 text-xs font-medium"
                  >
                    Download
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        <Input
          label="Project Name"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          required
        />

        <div>
          <label className="block text-sm font-medium text-zinc-900 mb-1">Business Unit</label>
          <select
            value={formData.business_unit}
            onChange={(e) => setFormData({ ...formData, business_unit: e.target.value })}
            className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 focus:outline-none"
          >
            <option value="">Select business unit</option>
            {BUSINESS_UNIT_OPTIONS.map((unit) => (
              <option key={unit} value={unit}>
                {unit}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-900 mb-1">Description</label>
          <textarea
            className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 focus:outline-none"
            rows={4}
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Start Date"
            type="date"
            value={formData.start_date}
            onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
          />

          <Input
            label="End Date"
            type="date"
            value={formData.end_date}
            onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
          />
        </div>
        {formData.start_date && formData.end_date && (
          <div className="-mt-2 text-xs text-zinc-500">
            Duration:{" "}
            <span className="font-medium text-zinc-600">
              {formatRangeDuration(formData.start_date, formData.end_date)}
            </span>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-zinc-900 mb-1">
            Project Manager <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                setIsEmployeeOpen(!isEmployeeOpen);
                if (!isEmployeeOpen) setEmployeeSearch("");
              }}
              className="w-full px-3 py-2 text-left text-sm bg-white border border-zinc-200 rounded-md hover:border-zinc-400 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-all duration-200 flex items-center justify-between group"
            >
              <span className="text-zinc-900">
                {employees.find((e) => e.id === formData.solution_architect_id)?.full_name ||
                  "Select a project manager"}
              </span>
              <svg
                className={`w-5 h-5 text-zinc-400 transition-transform duration-200 flex-shrink-0 ${
                  isEmployeeOpen ? "rotate-180" : ""
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </button>

            {isEmployeeOpen && (
              <div className="absolute z-10 w-full mt-2 bg-white border border-zinc-200 rounded-lg shadow-sm max-h-60 overflow-auto">
                <div className="sticky top-0 bg-white p-2 border-b border-zinc-100">
                  <input
                    type="text"
                    value={employeeSearch}
                    onChange={(e) => setEmployeeSearch(e.target.value)}
                    placeholder="Search project managers..."
                    className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md hover:border-zinc-400 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-all duration-200"
                  />
                </div>
                {employees
                  .slice()
                  .sort((a, b) => a.full_name.localeCompare(b.full_name))
                  .filter(
                    (employee) =>
                      employee.full_name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
                      employee.department.toLowerCase().includes(employeeSearch.toLowerCase()) ||
                      employee.position.toLowerCase().includes(employeeSearch.toLowerCase())
                  )
                  .map((employee) => (
                  <button
                    key={employee.id}
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, solution_architect_id: employee.id });
                      setIsEmployeeOpen(false);
                      setEmployeeSearch("");
                    }}
                    className={`w-full px-4 py-3 text-left text-sm hover:bg-zinc-50 transition-colors duration-150 first:rounded-t-lg last:rounded-b-lg ${
                      formData.solution_architect_id === employee.id
                        ? "bg-zinc-50 text-zinc-700 font-medium"
                        : "text-zinc-700"
                    }`}
                  >
                    <div className="font-medium">{employee.full_name}</div>
                    <div className="text-xs text-zinc-500">{employee.department} - {employee.position}</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-900 mb-1">Status</label>
          <select
            className="block w-full rounded-md border border-zinc-200 px-3 py-2 text-sm focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 focus:outline-none"
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          >
            <option value="planning">Planning</option>
            <option value="active">Active</option>
            <option value="on-hold">On Hold</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        <Input
          type="number"
          label="Progress (%)"
          value={formData.progress}
          onChange={(e) => setFormData({ ...formData, progress: parseInt(e.target.value) || 0 })}
          min="0"
          max="100"
          required
        />

        {/* New File Attachments */}
        <div>
          <label className="block text-sm font-medium text-zinc-900 mb-2">
            Add New Attachments
          </label>
          <div
            className={`relative border-2 border-dashed rounded-lg p-6 transition-colors ${
              isDragging ? "border-zinc-400 bg-zinc-50" : "border-zinc-300 hover:border-zinc-400"
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              handleFileSelect(e.dataTransfer.files);
            }}
          >
            <input
              type="file"
              multiple
              onChange={(e) => handleFileSelect(e.target.files)}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <div className="text-center">
              <svg
                className="mx-auto h-12 w-12 text-zinc-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="mt-2 text-sm text-zinc-600">
                Drag and drop files here, or click to select files
              </p>
            </div>
          </div>

          {/* New attachments list */}
          {attachments.length > 0 && (
            <div className="mt-3 space-y-2">
              {attachments.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-zinc-50 rounded-lg border border-zinc-200"
                >
                  <div className="flex items-center gap-2">
                    <svg
                      className="w-4 h-4 text-zinc-500"
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
                    <span className="text-sm text-zinc-900">{file.name}</span>
                    <span className="text-xs text-zinc-500">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeAttachment(index)}
                    className="text-red-600 hover:text-red-800 text-xs font-medium"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Update Project</Button>
        </div>
      </form>
    </Modal>
  );
}

function BookingModal({
  isOpen,
  onClose,
  project,
  onBook,
}: {
  isOpen: boolean;
  onClose: () => void;
  project: Project;
  onBook: () => void;
}) {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [employeeAvailability, setEmployeeAvailability] = useState<any>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [searchFilter, setSearchFilter] = useState("");
  const [timelineItems, setTimelineItems] = useState<VisualScheduleItem[]>([]);

  // Initialize with default dates
  const getDefaultDates = () => {
    const today = new Date();
    const oneMonthLater = new Date(today);
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
    return {
      startDate: today.toISOString().split("T")[0],
      endDate: oneMonthLater.toISOString().split("T")[0],
    };
  };

  const [bookingData, setBookingData] = useState({
    hoursPerDay: '' as any,
    ...getDefaultDates(),
  });
  const [loading, setLoading] = useState(true);

  const timelineWindow = (() => {
    const start = startOfWeekISO(bookingData.startDate ? new Date(bookingData.startDate + 'T00:00:00') : new Date());
    return { start, end: addDaysISO(start, 55) };
  })();

  useEffect(() => {
    if (isOpen) {
      loadEmployees();
      // Reset to default dates when modal opens
      setBookingData({
        hoursPerDay: '' as any,
        ...getDefaultDates(),
      });
      setSelectedEmployee(null);
      setEmployeeAvailability(null);
      setSearchFilter("");
      setTimelineItems([]);
    }
  }, [isOpen]);

  useEffect(() => {
    const loadTimeline = async () => {
      if (!selectedEmployee) return;

      try {
        const [bookings, reservations] = await Promise.all([
          dashboardAPI.getEmployeeBookings(selectedEmployee.id),
          employeeAPI.getReservations(selectedEmployee.id, false),
        ]);

        const bookingItems: VisualScheduleItem[] = (Array.isArray(bookings) ? bookings : []).map((b: any) => ({
          id: b.id,
          kind: 'booking',
          start_date: b.start_date,
          end_date: b.end_date,
          label: b.project_name || 'Booked',
          sublabel: b.project_code,
        }));

        const reservationItems: VisualScheduleItem[] = (Array.isArray(reservations) ? reservations : []).map((r: any) => ({
          id: r.id,
          kind: 'reservation',
          start_date: r.start_date,
          end_date: r.end_date,
          label: r.reason || 'Reserved',
          sublabel: r.status === 'active' ? `${r.reserved_hours_per_day}h/day` : r.status,
          status: r.status,
        }));

        setTimelineItems([...bookingItems, ...reservationItems]);
      } catch (error) {
        console.error('Error loading timeline data:', error);
        setTimelineItems([]);
      }
    };

    loadTimeline();
  }, [selectedEmployee]);

  // Load employee availability when employee or dates change
  useEffect(() => {
    if (selectedEmployee && bookingData.startDate && bookingData.endDate) {
      loadEmployeeAvailability();
    }
  }, [selectedEmployee, bookingData.startDate, bookingData.endDate]);

  const loadEmployees = async () => {
    try {
      const data = await employeeAPI.getAll();
      setEmployees(data);
    } catch (error) {
      console.error("Error loading employees:", error);
    } finally {
      setLoading(false);
    }
  };

  const loadEmployeeAvailability = async () => {
    if (!selectedEmployee) return;

    setLoadingAvailability(true);
    try {
      const data = await employeeAPI.getAvailabilityForDateRange(
        selectedEmployee.id,
        bookingData.startDate,
        bookingData.endDate
      );
      setEmployeeAvailability(data);
    } catch (error) {
      console.error("Error loading employee availability:", error);
      setEmployeeAvailability(null);
    } finally {
      setLoadingAvailability(false);
    }
  };

  const calculateWorkingDays = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return 0;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (end < start) return 0;

    let workingDays = 0;
    const current = new Date(start);

    while (current <= end) {
      const dayOfWeek = current.getDay();
      // Count weekdays (Monday = 1 to Friday = 5)
      // Weekend: Friday (5) and Saturday (6). Sunday is a workday.
      if (dayOfWeek !== 5 && dayOfWeek !== 6) {
        workingDays++;
      }
      current.setDate(current.getDate() + 1);
    }

    return workingDays;
  };

  const workingDays = calculateWorkingDays(bookingData.startDate, bookingData.endDate);

  // Calculate total hours from hours per day
  const totalHours = workingDays * (bookingData.hoursPerDay || 0);

  // Calculate max hours based on availability data (accounting for existing bookings/reservations)
  const maxHoursFromAvailability = employeeAvailability?.availability?.available_hours ?? null;
  const totalMaxHours = workingDays * 6; // 6 hours per working day (theoretical max)
  const maxHours =
    maxHoursFromAvailability !== null
      ? Math.min(totalMaxHours, maxHoursFromAvailability)
      : totalMaxHours;

  // Calculate max hours per day
  const maxHoursPerDay = workingDays > 0 ? maxHours / workingDays : 6;

  // Get utilized hours info for display
  const utilizedHours = employeeAvailability?.availability?.total_utilized_hours ?? 0;
  const bookedHours = employeeAvailability?.availability?.total_booked_hours ?? 0;
  const reservedHours = employeeAvailability?.availability?.total_reserved_hours ?? 0;

  const handleBooking = async () => {
    console.log("Booking data state:", bookingData);
    console.log("Selected employee:", selectedEmployee);

    if (!selectedEmployee) {
      alert("Please select an employee");
      return;
    }

    if (!bookingData.startDate || !bookingData.endDate) {
      alert("Please select both start and end dates");
      return;
    }

    if (bookingData.hoursPerDay <= 0) {
      alert("Please enter valid hours per day (greater than 0)");
      return;
    }

    if (new Date(bookingData.endDate) < new Date(bookingData.startDate)) {
      alert("End date must be after or equal to start date");
      return;
    }

    if (totalHours > maxHours) {
      if (utilizedHours > 0) {
        alert(
          `Cannot book ${totalHours} hours (${bookingData.hoursPerDay} hrs/day × ${workingDays} days). Employee only has ${maxHours} hours available in this period.\n\nAlready utilized: ${utilizedHours} hours (${bookedHours} booked + ${reservedHours} reserved)\nMaximum capacity: ${totalMaxHours} hours (${workingDays} working days × 6 hrs/day)`
        );
      } else {
        alert(
          `Cannot book ${totalHours} hours (${bookingData.hoursPerDay} hrs/day × ${workingDays} days). Maximum ${maxHours} hours for ${workingDays} working days (6hrs/day).`
        );
      }
      return;
    }

    // Double-check availability if we have data
    if (maxHoursFromAvailability !== null && totalHours > maxHoursFromAvailability) {
      alert(
        `Cannot book ${totalHours} hours (${bookingData.hoursPerDay} hrs/day × ${workingDays} days). Employee only has ${maxHoursFromAvailability} hours available after accounting for existing bookings and reservations.`
      );
      return;
    }

    try {
      const bookingPayload = {
        employee_id: selectedEmployee.id,
        start_date: bookingData.startDate,
        end_date: bookingData.endDate,
        booked_hours: totalHours,
      };

      console.log("Creating booking with payload:", bookingPayload);
      console.log("Project ID:", project.id);

      await projectAPI.createBooking(project.id, bookingPayload);
      onBook();
      onClose();
      setSelectedEmployee(null);
      setBookingData({ hoursPerDay: 0, ...getDefaultDates() });
    } catch (error: any) {
      console.error("Error creating booking:", error);
      console.error("Error details:", { message: error.message, stack: error.stack });
      const errorMessage = error?.message || "Failed to create booking. Please try again.";
      alert(errorMessage);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Book Resources - ${project.name}`} size="xl">
      {loading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <Skeleton className="mb-3 h-5 w-40" />
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </div>
            <div>
              <Skeleton className="mb-3 h-5 w-32" />
              <div className="space-y-4">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Employee Selection */}
            <div>
              <h4 className="mb-3 text-sm font-semibold text-zinc-900">Select Team Member</h4>

              {/* Search Filter */}
              <div className="mb-3">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search team members..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="w-full px-3 py-2 pl-9 text-sm bg-white border border-zinc-200 rounded-md hover:border-zinc-400 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-all duration-200"
                  />
                  <svg
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-zinc-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {employees
                  .filter((employee) =>
                    employee.full_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
                    employee.department.toLowerCase().includes(searchFilter.toLowerCase()) ||
                    employee.position.toLowerCase().includes(searchFilter.toLowerCase())
                  )
                  .sort((a, b) => a.full_name.localeCompare(b.full_name))
                  .map((employee) => (
                  <button
                    key={employee.id}
                    onClick={() => setSelectedEmployee(employee)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      selectedEmployee?.id === employee.id
                        ? "border-zinc-400 bg-zinc-50"
                        : "border-zinc-200 hover:border-zinc-300"
                    }`}
                  >
                    <div className="font-medium text-zinc-900">{employee.full_name}</div>
                    <div className="mt-1 text-xs text-zinc-600">
                      {employee.position} • {employee.department}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Booking Details */}
            <div>
              <h4 className="mb-3 text-sm font-semibold text-zinc-900">Booking Details</h4>

              {selectedEmployee ? (
                <div className="space-y-4">
                  <div className="rounded-lg bg-zinc-50 p-4">
                    <div className="text-sm font-medium text-zinc-900">
                      Selected: {selectedEmployee.full_name}
                    </div>
                    <div className="mt-1 text-xs text-zinc-600">
                      {selectedEmployee.position} • {selectedEmployee.department}
                    </div>
                  </div>

                  <VisualScheduleTimeline
                    windowStart={timelineWindow.start}
                    windowEnd={timelineWindow.end}
                    selectionStart={bookingData.startDate}
                    selectionEnd={bookingData.endDate}
                    onSelectionChange={(start, end) => setBookingData({ ...bookingData, startDate: start, endDate: end })}
                    rowLabel={selectedEmployee.full_name}
                    rowSublabel={`${selectedEmployee.position} • ${selectedEmployee.department}`}
                    items={timelineItems}
                  />

                  <div>
                    <label className="block text-sm font-medium text-zinc-900 mb-1">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={bookingData.startDate}
                      onChange={(e) =>
                        setBookingData({ ...bookingData, startDate: e.target.value })
                      }
                      className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md hover:border-zinc-400 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-all duration-200"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-900 mb-1">End Date</label>
                    <input
                      type="date"
                      value={bookingData.endDate}
                      onChange={(e) => setBookingData({ ...bookingData, endDate: e.target.value })}
                      min={bookingData.startDate}
                      className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md hover:border-zinc-400 focus:outline-none focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 transition-all duration-200"
                    />
                  </div>
                  <div className="text-xs text-zinc-500 -mt-2">
                    Duration:{" "}
                    <span className="font-medium text-zinc-600">
                      {formatRangeDuration(bookingData.startDate, bookingData.endDate)}
                    </span>
                  </div>

                  {/* Employee Availability Section */}
                  {loadingAvailability ? (
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
                      <div className="text-sm text-zinc-600">Loading availability...</div>
                    </div>
                  ) : (
                    employeeAvailability && (
                      <div className="space-y-3">
                        {/* Existing Bookings */}
                        {employeeAvailability.bookings &&
                          employeeAvailability.bookings.length > 0 && (
                            <div className="rounded-lg border border-orange-200 bg-orange-50 p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <svg
                                  className="w-4 h-4 text-orange-600"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                                <span className="text-sm font-semibold text-orange-900">
                                  Existing Bookings ({employeeAvailability.bookings.length})
                                </span>
                              </div>
                              <div className="space-y-2">
                                {employeeAvailability.bookings.map((booking: any) => (
                                  <div
                                    key={booking.id}
                                    className="text-xs text-orange-800 bg-white rounded p-2"
                                  >
                                    <div className="font-medium">{booking.project_name}</div>
                                    <div className="mt-1">
                                      {new Date(
                                        booking.start_date + "T00:00:00"
                                      ).toLocaleDateString()}{" "}
                                      -{" "}
                                      {new Date(
                                        booking.end_date + "T00:00:00"
                                      ).toLocaleDateString()}
                                    </div>
                                    <div className="mt-1">{booking.booked_hours} hours total</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                        {/* Reservations */}
                        {employeeAvailability.reservations &&
                          employeeAvailability.reservations.length > 0 && (
                            <div className="rounded-lg border border-purple-200 bg-purple-50 p-3">
                              <div className="flex items-center gap-2 mb-2">
                                <svg
                                  className="w-4 h-4 text-purple-600"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                  />
                                </svg>
                                <span className="text-sm font-semibold text-purple-900">
                                  Reserved Time ({employeeAvailability.reservations.length})
                                </span>
                              </div>
                              <div className="space-y-2">
                                {employeeAvailability.reservations.map((reservation: any) => (
                                  <div
                                    key={reservation.id}
                                    className="text-xs text-purple-800 bg-white rounded p-2"
                                  >
                                    <div className="font-medium">
                                      {reservation.reason || "Reserved"}
                                    </div>
                                    <div className="mt-1">
                                      {new Date(
                                        reservation.start_date + "T00:00:00"
                                      ).toLocaleDateString()}{" "}
                                      -{" "}
                                      {new Date(
                                        reservation.end_date + "T00:00:00"
                                      ).toLocaleDateString()}
                                    </div>
                                    <div className="mt-1">
                                      {reservation.reserved_hours_per_day} hrs/day reserved
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                        {/* No conflicts */}
                        {(!employeeAvailability.bookings ||
                          employeeAvailability.bookings.length === 0) &&
                          (!employeeAvailability.reservations ||
                            employeeAvailability.reservations.length === 0) && (
                            <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                              <div className="flex items-center gap-2">
                                <svg
                                  className="w-4 h-4 text-green-600"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                                <span className="text-sm font-medium text-green-900">
                                  No conflicts - Employee is available
                                </span>
                              </div>
                            </div>
                          )}
                      </div>
                    )
                  )}

                  {workingDays > 0 && (
                    <div
                      className={`rounded-lg border p-3 ${
                        utilizedHours > 0
                          ? "border-amber-200 bg-amber-50"
                          : "border-zinc-200 bg-zinc-50"
                      }`}
                    >
                      <div className="text-sm text-zinc-900">
                        {workingDays} working days (
                        {new Date(bookingData.startDate).toLocaleDateString()} -{" "}
                        {new Date(bookingData.endDate).toLocaleDateString()})
                      </div>
                      <div className="text-xs text-zinc-700 mt-1">
                        Maximum capacity: {totalMaxHours} hours (6 hrs/day)
                      </div>
                      {utilizedHours > 0 && employeeAvailability?.availability && (
                        <div className="mt-2 pt-2 border-t border-amber-200">
                          <div className="text-xs text-amber-800">
                            <span className="font-semibold">Already utilized:</span> {utilizedHours}{" "}
                            hours
                            {bookedHours > 0 && <span> ({bookedHours}h booked)</span>}
                            {reservedHours > 0 && <span> ({reservedHours}h reserved)</span>}
                          </div>
                          <div
                            className={`text-sm font-semibold mt-1 ${
                              maxHours > 0 ? "text-green-700" : "text-red-700"
                            }`}
                          >
                            Available to book: {maxHours} hours
                          </div>
                        </div>
                      )}
                      {!employeeAvailability?.availability && loadingAvailability && (
                        <div className="text-xs text-zinc-500 mt-1">Checking availability...</div>
                      )}
                      {!loadingAvailability &&
                        !employeeAvailability?.availability &&
                        utilizedHours === 0 && (
                          <div className="text-xs text-green-700 mt-1 font-semibold">
                            Available to book: {maxHours} hours
                          </div>
                        )}
                    </div>
                  )}

                  <Input
                    type="number"
                    label="Hours per Day"
                    value={bookingData.hoursPerDay}
                    onChange={(e) =>
                      setBookingData({ ...bookingData, hoursPerDay: parseFloat(e.target.value) || 0 })
                    }
                    min="0"
                    max="6"
                    step="0.5"
                    placeholder="Enter hours per day"
                  />

                  {bookingData.hoursPerDay > 0 && workingDays > 0 && (
                    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 space-y-2">
                      <div className="text-sm text-zinc-900">
                        <span className="font-medium">Working Days:</span> <span className="font-bold">{workingDays}</span> days
                      </div>
                      <div className="text-sm text-zinc-900">
                        <span className="font-medium">Total Hours:</span> <span className="font-bold">{totalHours.toFixed(1)}</span> hrs
                      </div>
                      <div className="text-xs text-zinc-700 mt-1">
                        ({bookingData.hoursPerDay} hrs/day × {workingDays} working days)
                      </div>
                    </div>
                  )}

                  {totalHours > 0 && totalHours <= maxHours && workingDays > 0 && (
                    <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                      <div className="text-sm text-green-900">
                        Within capacity
                      </div>
                      <div className="text-xs text-green-700 mt-1">
                        Remaining capacity after booking:{" "}
                        {(maxHours - totalHours).toFixed(1)} hours
                      </div>
                    </div>
                  )}

                  {totalHours > maxHours && (
                    <div className="rounded-lg border border-red-300 bg-red-50 p-3">
                      <div className="flex items-center gap-2 text-sm font-semibold text-red-900">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          />
                        </svg>
                        Exceeds available hours!
                      </div>
                      <div className="text-xs text-red-800 mt-1">
                        Requested {totalHours.toFixed(1)} hours ({bookingData.hoursPerDay} hrs/day × {workingDays} days) but only {maxHours} hours available.
                        {utilizedHours > 0 && (
                          <span> ({utilizedHours} hours already utilized)</span>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex justify-end gap-3 pt-4">
                    <Button type="button" variant="secondary" onClick={onClose}>
                      Cancel
                    </Button>
                    <Button
                      onClick={handleBooking}
                      disabled={
                        totalHours > maxHours || bookingData.hoursPerDay <= 0 || maxHours <= 0
                      }
                      className={
                        totalHours > maxHours || maxHours <= 0
                          ? "opacity-50 cursor-not-allowed"
                          : ""
                      }
                    >
                      Confirm Booking
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-8 text-center">
                  <div className="text-sm text-zinc-600">
                    Select a team member to book resources
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </Modal>
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
  project: Project;
  bookings: Booking[];
}) {
  const router = useRouter();

  // Group bookings by employee
  const employeeBookings = bookings.reduce((acc, booking) => {
    const key = booking.employee_id;
    if (!acc[key]) {
      acc[key] = {
        employee_name: booking.full_name,
        employee_id: booking.employee_id || "N/A",
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
  const totalTeamHours = employees.reduce((sum: number, emp: any) => sum + (emp.total_hours || 0), 0);

  const formatProjectDate = (value: string | null | undefined) => {
    if (!value) return "Not set";
    return new Date(value + "T00:00:00").toLocaleDateString();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={project.name} size="lg">
      <div className="space-y-6">
        {/* Project Info */}
        <div className="space-y-4">
          {/* Project Code */}
          {(project as any).project_code && (
            <div className="bg-zinc-50 border border-zinc-200 rounded-lg p-4">
              <h3 className="text-xs font-semibold text-zinc-900 uppercase tracking-wide mb-2">
                Project Code
              </h3>
              <div className="flex items-center gap-2">
                <svg
                  className="w-4 h-4 text-zinc-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
                  />
                </svg>
                <span className="text-lg font-mono font-bold text-zinc-900">
                  {(project as any).project_code}
                </span>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-semibold text-zinc-900 mb-2">Description</h3>
            <p className="text-sm text-zinc-600">{project.description}</p>
          </div>

          {(project as any).business_unit && (
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 mb-2">Business Unit</h3>
              <p className="text-sm text-zinc-600">{(project as any).business_unit}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-1">Start Date</h3>
              <p className="text-sm font-medium text-zinc-900">{formatProjectDate((project as any).start_date)}</p>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500 mb-1">End Date</h3>
              <p className="text-sm font-medium text-zinc-900">{formatProjectDate((project as any).end_date)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 mb-1">Status</h3>
              <span className="inline-block rounded-full px-3 py-1 text-xs font-medium bg-zinc-100 text-zinc-900">
                {project.status}
              </span>
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 mb-1">Progress</h3>
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
                    className="text-zinc-600 hover:text-zinc-800 text-sm font-medium"
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
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-zinc-900">Team Members</h3>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700">
              Total Team Hours: <span className="font-semibold text-zinc-900">{totalTeamHours}</span>
            </div>
          </div>
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
                                {new Date(booking.start_date).toLocaleDateString()} -{" "}
                                {new Date(booking.end_date).toLocaleDateString()}
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
                        <div className="text-2xl font-bold text-zinc-600">{emp.total_hours}</div>
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

          <div className="mt-4 flex justify-end">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                onClose();
                router.push(`/projects/${project.id}/book`);
              }}
              className="text-zinc-700 bg-zinc-100 hover:bg-zinc-200"
            >
              Book Resources
            </Button>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-zinc-200">
          <Button onClick={onClose}>Close</Button>
        </div>
      </div>
    </Modal>
  );
}

type BulkRow = {
  name: string;
  business_unit: string;
  project_manager: string;
  start_date: string;
  end_date: string;
  progress: number;
  completed: boolean;
  // resolved after matching
  solution_architect_id: number | null;
  project_code: string;
  error: string | null;
};

function BulkImportModal({
  isOpen,
  onClose,
  onImport,
}: {
  isOpen: boolean;
  onClose: () => void;
  onImport: () => void;
}) {
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [allProjects, setAllProjects] = useState<Project[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResults, setImportResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const [fileName, setFileName] = useState("");

  useEffect(() => {
    if (isOpen) {
      loadData();
      setRows([]);
      setImportResults(null);
      setFileName("");
    }
  }, [isOpen]);

  const loadData = async () => {
    try {
      const [emps, projs] = await Promise.all([employeeAPI.getAll(), projectAPI.getAll()]);
      setEmployees(emps);
      setAllProjects(projs);
    } catch (error) {
      console.error("Error loading data for bulk import:", error);
    }
  };

  const getDepartmentPrefix = (department: string): string => {
    const departmentMap: Record<string, string> = {
      Finance: "FIN", Engineering: "ENG", IT: "IT", Marketing: "MKT",
      Sales: "SAL", HR: "HR", "Human Resources": "HR", Operations: "OPS",
      Product: "PRD", Design: "DES", Legal: "LEG", "Customer Support": "SUP", Research: "RES",
    };
    if (departmentMap[department]) return departmentMap[department];
    return department.substring(0, 3).toUpperCase();
  };

  const generateProjectCode = (employeeId: number, existingCodes: string[]): string => {
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp || !emp.department) return "UNK-001";
    const prefix = getDepartmentPrefix(emp.department);
    const prefixPattern = new RegExp(`^${prefix}-(\\d+)$`);
    let maxNumber = 0;
    // Check both existing DB projects and already-generated codes in this batch
    const allCodes = [
      ...allProjects.map((p) => (p as any).project_code || ""),
      ...existingCodes,
    ];
    allCodes.forEach((code) => {
      const match = code.match(prefixPattern);
      if (match && match[1]) {
        const num = parseInt(match[1], 10);
        if (num > maxNumber) maxNumber = num;
      }
    });
    return `${prefix}-${String(maxNumber + 1).padStart(3, "0")}`;
  };

  const findEmployee = (name: string): Employee | null => {
    if (!name) return null;
    const normalised = name.trim().toLowerCase();
    // Exact match first
    const exact = employees.find((e) => e.full_name.toLowerCase() === normalised);
    if (exact) return exact;
    // Partial match - name contains or is contained
    const partial = employees.find(
      (e) =>
        e.full_name.toLowerCase().includes(normalised) ||
        normalised.includes(e.full_name.toLowerCase())
    );
    return partial || null;
  };

  const parseExcelDate = (value: any): string => {
    if (!value) return "";
    // If it's already a string that looks like a date
    if (typeof value === "string") {
      const d = new Date(value);
      if (!isNaN(d.getTime())) {
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      }
      return "";
    }
    // xlsx parses Excel dates as numbers (serial date)
    if (typeof value === "number") {
      const d = XLSX.SSF.parse_date_code(value);
      if (d) {
        return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
      }
    }
    return "";
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setImportResults(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: "array", cellDates: false });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });

      // Map column names (case-insensitive, trimmed)
      const generatedCodes: string[] = [];
      const parsed: BulkRow[] = jsonData.map((row: any) => {
        // Normalize keys for flexible matching
        const normalizedRow: Record<string, any> = {};
        Object.keys(row).forEach((k) => {
          normalizedRow[k.trim().toLowerCase()] = row[k];
        });

        const name = (normalizedRow["project name"] || "").toString().trim();
        const bu = (normalizedRow["bu/division"] || normalizedRow["bu"] || normalizedRow["division"] || normalizedRow["business unit"] || "").toString().trim();
        const pm = (normalizedRow["project manager"] || "").toString().trim();
        const startDate = parseExcelDate(normalizedRow["est. start date"] || normalizedRow["est start date"] || normalizedRow["start date"] || "");
        const endDate = parseExcelDate(normalizedRow["est. delivery date"] || normalizedRow["est delivery date"] || normalizedRow["delivery date"] || normalizedRow["end date"] || "");
        const progressRaw = normalizedRow["completion %"] || normalizedRow["completion"] || 0;
        const progress = Math.min(100, Math.max(0, Math.round(Number(String(progressRaw).replace("%", "")) || 0)));
        const completedRaw = (normalizedRow["completed"] || "").toString().trim().toLowerCase();
        const completed = completedRaw === "yes" || completedRaw === "true" || completedRaw === "1" || completedRaw === "completed";

        const matchedEmployee = findEmployee(pm);
        let projectCode = "";
        if (matchedEmployee) {
          projectCode = generateProjectCode(matchedEmployee.id, generatedCodes);
          generatedCodes.push(projectCode);
        }

        let error: string | null = null;
        if (!name) error = "Missing project name";
        else if (!matchedEmployee) error = `Project manager "${pm}" not found`;

        return {
          name,
          business_unit: bu,
          project_manager: pm,
          start_date: startDate,
          end_date: endDate,
          progress,
          completed,
          solution_architect_id: matchedEmployee?.id || null,
          project_code: projectCode,
          error,
        };
      });

      setRows(parsed.filter((r) => r.name)); // filter out completely empty rows
    };
    reader.readAsArrayBuffer(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  const handleImport = async () => {
    const validRows = rows.filter((r) => !r.error);
    if (validRows.length === 0) return;

    setImporting(true);
    let success = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const row of validRows) {
      try {
        const payload = {
          project_code: row.project_code,
          name: row.name,
          business_unit: row.business_unit || null,
          description: row.name, // use name as description since sheet doesn't have one
          solution_architect_id: row.solution_architect_id!,
          start_date: row.start_date || null,
          end_date: row.end_date || null,
        };
        const response = await projectAPI.create(payload);
        const projectId = response.project?.id || response.id;

        // If completed or has progress, update the project
        if (projectId && (row.completed || row.progress > 0)) {
          await projectAPI.update(projectId, {
            progress: row.completed ? 100 : row.progress,
            status: row.completed ? "completed" : row.progress > 0 ? "active" : "planned",
          });
        }
        success++;
      } catch (error) {
        failed++;
        errors.push(`"${row.name}": ${(error as Error).message}`);
      }
    }

    setImportResults({ success, failed, errors });
    setImporting(false);
    if (success > 0) onImport();
  };

  const validCount = rows.filter((r) => !r.error).length;
  const errorCount = rows.filter((r) => r.error).length;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Bulk Import Projects" size="5xl">
      <div className="space-y-4">
        {/* File Upload Area */}
        {rows.length === 0 && !importResults && (
          <div>
            <label
              className="flex flex-col items-center justify-center w-full h-48 border-2 border-dashed border-zinc-300 rounded-lg cursor-pointer hover:border-zinc-400 hover:bg-zinc-50 transition-colors"
            >
              <svg className="w-10 h-10 text-zinc-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <span className="text-sm font-medium text-zinc-700">Click to upload Excel file</span>
              <span className="text-xs text-zinc-500 mt-1">.xlsx or .xls</span>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
            <div className="mt-3 p-3 bg-zinc-50 rounded-lg border border-zinc-200">
              <p className="text-xs font-medium text-zinc-700 mb-1">Expected columns:</p>
              <p className="text-xs text-zinc-500">BU/Division, Project Name, Project Manager, Est. Start Date, Est. Delivery Date, Completion %, Completed</p>
            </div>
          </div>
        )}

        {/* Preview Table */}
        {rows.length > 0 && !importResults && (
          <>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-700">
                  <span className="font-medium">{fileName}</span> &mdash; {rows.length} row{rows.length !== 1 ? "s" : ""} found
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  <span className="text-emerald-600 font-medium">{validCount} valid</span>
                  {errorCount > 0 && <span className="text-red-600 font-medium ml-2">{errorCount} with errors</span>}
                </p>
              </div>
              <label className="text-xs text-zinc-500 hover:text-zinc-700 cursor-pointer underline">
                Choose different file
                <input type="file" accept=".xlsx,.xls" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
            <div className="overflow-x-auto max-h-96 overflow-y-auto border border-zinc-200 rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-zinc-600">#</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-zinc-600">Project Code</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-zinc-600">Project Name</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-zinc-600">BU/Division</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-zinc-600">Project Manager</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-zinc-600">Start Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-zinc-600">End Date</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-zinc-600">Progress</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-zinc-600">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100">
                  {rows.map((row, idx) => (
                    <tr key={idx} className={row.error ? "bg-red-50" : "hover:bg-zinc-50"}>
                      <td className="px-3 py-2 text-zinc-400">{idx + 1}</td>
                      <td className="px-3 py-2 font-mono text-xs">{row.project_code || "—"}</td>
                      <td className="px-3 py-2 font-medium text-zinc-900">{row.name}</td>
                      <td className="px-3 py-2 text-zinc-600">{row.business_unit || "—"}</td>
                      <td className="px-3 py-2">
                        {row.error ? (
                          <span className="text-red-600 text-xs">{row.error}</span>
                        ) : (
                          <span className="text-zinc-700">{row.project_manager}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-zinc-600">{row.start_date || "—"}</td>
                      <td className="px-3 py-2 text-zinc-600">{row.end_date || "—"}</td>
                      <td className="px-3 py-2 text-zinc-600">{row.progress}%</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          row.completed
                            ? "bg-zinc-100 text-zinc-700 border border-zinc-200"
                            : row.progress > 0
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-zinc-100 text-zinc-600 border border-zinc-200"
                        }`}>
                          {row.completed ? "completed" : row.progress > 0 ? "active" : "planned"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* Import Results */}
        {importResults && (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-4 rounded-lg bg-zinc-50 border border-zinc-200">
              <div className="flex-1">
                <p className="text-sm font-medium text-zinc-900">Import Complete</p>
                <p className="text-xs text-zinc-600 mt-1">
                  <span className="text-emerald-600 font-medium">{importResults.success} created</span>
                  {importResults.failed > 0 && (
                    <span className="text-red-600 font-medium ml-2">{importResults.failed} failed</span>
                  )}
                </p>
              </div>
            </div>
            {importResults.errors.length > 0 && (
              <div className="max-h-40 overflow-y-auto p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs font-medium text-red-700 mb-1">Errors:</p>
                {importResults.errors.map((err, i) => (
                  <p key={i} className="text-xs text-red-600">{err}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            {importResults ? "Close" : "Cancel"}
          </Button>
          {rows.length > 0 && !importResults && (
            <Button
              onClick={handleImport}
              disabled={validCount === 0 || importing}
            >
              {importing ? "Importing..." : `Import ${validCount} Project${validCount !== 1 ? "s" : ""}`}
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}

function startOfWeekISO(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diffToMonday = (day + 6) % 7;
  d.setDate(d.getDate() - diffToMonday);
  return formatISODateLocal(d);
}

function addDaysISO(isoDate: string, days: number): string {
  const parsed = parseISODateLocal(isoDate);
  const d = parsed ? new Date(parsed) : new Date();
  d.setDate(d.getDate() + days);
  return formatISODateLocal(d);
}

function parseISODateLocal(value: string): Date | null {
  if (!value || typeof value !== 'string') return null;
  const [y, m, d] = value.split('-').map((n) => parseInt(n, 10));
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function formatISODateLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
