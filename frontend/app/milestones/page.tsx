"use client";

import { useState, useEffect, useMemo } from "react";
import { projectAPI, employeeAPI, type Project, type Milestone, type Employee } from "@/lib/api";
import ProjectMilestonesChart from "@/components/charts/ProjectMilestonesChart";

// ─── Types ────────────────────────────────────────────────────────────────────

type FlatMilestone = Milestone & {
  project_id: number;
  project_name: string;
  project_code: string;
  displayStatus: "not_started" | "in_progress" | "completed" | "delayed";
};

type ModalMode = "create" | "edit" | null;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_META = {
  completed:   { label: "Completed",   dot: "bg-emerald-500", badge: "bg-emerald-100 text-emerald-700 ring-emerald-200", border: "border-l-emerald-500" },
  in_progress: { label: "In Progress", dot: "bg-orange-500",  badge: "bg-orange-100 text-orange-700 ring-orange-200",   border: "border-l-orange-500"  },
  not_started: { label: "Not Started", dot: "bg-zinc-400",    badge: "bg-zinc-100 text-zinc-600 ring-zinc-200",         border: "border-l-zinc-300"    },
  delayed:     { label: "Delayed",     dot: "bg-red-500",     badge: "bg-red-100 text-red-700 ring-red-200",            border: "border-l-red-500"     },
};

function getDisplayStatus(m: Milestone): FlatMilestone["displayStatus"] {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const ed = new Date((m.end_date || m.date) + "T00:00:00");
  if (m.status !== "completed" && ed < today) return "delayed";
  return (m.status as FlatMilestone["displayStatus"]) || "not_started";
}

function formatDate(d: string | undefined | null) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_OPTIONS: FlatMilestone["displayStatus"][] = ["not_started", "in_progress", "completed", "delayed"];
const EDITABLE_STATUSES = ["not_started", "in_progress", "completed"];

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-5 py-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wider text-zinc-400">{label}</p>
      <p className={`mt-1 text-3xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MilestonesPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filterProject, setFilterProject] = useState("all");
  const [filterStatus, setFilterStatus] = useState<"all" | FlatMilestone["displayStatus"]>("all");

  // Modal state
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingMilestone, setEditingMilestone] = useState<FlatMilestone | null>(null);
  const [form, setForm] = useState({
    project_id: "",
    name: "",
    start_date: "",
    end_date: "",
    status: "not_started",
    description: "",
    resources: [] as { id: number; name: string }[],
  });
  const [resourceSearch, setResourceSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<FlatMilestone | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ─── Load data ──────────────────────────────────────────────────────────────

  const load = async () => {
    try {
      setLoading(true);
      setError(null);
      const [projs, emps] = await Promise.all([
        projectAPI.getAll(),
        employeeAPI.getAll(),
      ]);
      setProjects(projs);
      setEmployees(emps);
    } catch (e: any) {
      setError(e.message || "Failed to load milestones");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  // ─── Flatten milestones ─────────────────────────────────────────────────────

  const allMilestones: FlatMilestone[] = useMemo(() => {
    const list: FlatMilestone[] = [];
    projects.forEach((p) => {
      (p.milestones || []).forEach((m) => {
        list.push({
          ...m,
          project_id: p.id,
          project_name: p.name,
          project_code: p.project_code,
          displayStatus: getDisplayStatus(m),
        });
      });
    });
    return list.sort((a, b) => {
      const order = { delayed: 0, in_progress: 1, not_started: 2, completed: 3 };
      if (order[a.displayStatus] !== order[b.displayStatus]) return order[a.displayStatus] - order[b.displayStatus];
      return (a.end_date || a.date).localeCompare(b.end_date || b.date);
    });
  }, [projects]);

  // ─── Stats ──────────────────────────────────────────────────────────────────

  const stats = useMemo(() => ({
    total:       allMilestones.length,
    completed:   allMilestones.filter((m) => m.displayStatus === "completed").length,
    in_progress: allMilestones.filter((m) => m.displayStatus === "in_progress").length,
    not_started: allMilestones.filter((m) => m.displayStatus === "not_started").length,
    delayed:     allMilestones.filter((m) => m.displayStatus === "delayed").length,
  }), [allMilestones]);

  // ─── Filtered list ──────────────────────────────────────────────────────────

  const filtered = useMemo(() => {
    return allMilestones.filter((m) => {
      if (filterProject !== "all" && String(m.project_id) !== filterProject) return false;
      if (filterStatus !== "all" && m.displayStatus !== filterStatus) return false;
      if (search) {
        const q = search.toLowerCase();
        if (!m.name.toLowerCase().includes(q) && !m.project_name.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [allMilestones, filterProject, filterStatus, search]);

  // ─── Modal helpers ──────────────────────────────────────────────────────────

  const openCreate = () => {
    setForm({ project_id: "", name: "", start_date: "", end_date: "", status: "not_started", description: "", resources: [] });
    setResourceSearch("");
    setModalMode("create");
  };

  const openEdit = (m: FlatMilestone) => {
    setEditingMilestone(m);
    setForm({
      project_id: String(m.project_id),
      name: m.name,
      start_date: m.start_date || m.date,
      end_date: m.end_date || m.date,
      status: m.status || "not_started",
      description: m.description || "",
      resources: m.resources || [],
    });
    setResourceSearch("");
    setModalMode("edit");
  };

  const closeModal = () => { setModalMode(null); setEditingMilestone(null); };

  const handleSave = async () => {
    if (!form.name.trim() || !form.start_date || !form.end_date) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        start_date: form.start_date,
        end_date: form.end_date,
        status: form.status,
        description: form.description || undefined,
        resources: form.resources,
      };
      if (modalMode === "create") {
        await projectAPI.createMilestone(Number(form.project_id), payload);
      } else if (editingMilestone) {
        await projectAPI.updateMilestone(editingMilestone.project_id, editingMilestone.id, payload);
      }
      closeModal();
      await load();
    } catch (e: any) {
      alert(e.message || "Failed to save milestone");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    try {
      await projectAPI.deleteMilestone(deleteConfirm.project_id, deleteConfirm.id);
      setDeleteConfirm(null);
      await load();
    } catch (e: any) {
      alert(e.message || "Failed to delete milestone");
    } finally {
      setDeleting(false);
    }
  };

  // Resource toggle
  const toggleResource = (emp: Employee) => {
    setForm((prev) => {
      const exists = prev.resources.some((r) => r.id === emp.id);
      return {
        ...prev,
        resources: exists
          ? prev.resources.filter((r) => r.id !== emp.id)
          : [...prev.resources, { id: emp.id, name: emp.full_name }],
      };
    });
  };

  const filteredEmployees = useMemo(() =>
    employees.filter((e) =>
      !resourceSearch || e.full_name.toLowerCase().includes(resourceSearch.toLowerCase())
    ).slice(0, 20),
    [employees, resourceSearch]
  );

  // ─── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-200 border-t-zinc-900" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600">
        {error}
        <button onClick={load} className="ml-3 underline">Retry</button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Milestones</h1>
          <p className="mt-0.5 text-sm text-zinc-500">Track and manage milestones across all projects</p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-zinc-700 transition-colors"
        >
          <span className="text-lg leading-none">+</span> Add Milestone
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard label="Total" value={stats.total} color="text-zinc-900" />
        <StatCard label="Completed" value={stats.completed} color="text-emerald-600" />
        <StatCard label="In Progress" value={stats.in_progress} color="text-orange-600" />
        <StatCard label="Not Started" value={stats.not_started} color="text-zinc-500" />
        <StatCard label="Delayed" value={stats.delayed} color="text-red-600" />
      </div>

      {/* Timeline Chart */}
      {projects.some((p) => p.milestones?.length) && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500">Timeline</h2>
          <ProjectMilestonesChart projects={projects} />
        </div>
      )}

      {/* Filter bar */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 text-sm">🔍</span>
            <input
              type="text"
              placeholder="Search milestones or projects…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-3 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none focus:ring-0"
            />
          </div>

          {/* Project filter */}
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 focus:border-zinc-400 focus:outline-none"
          >
            <option value="all">All Projects</option>
            {projects.filter((p) => p.milestones?.length).map((p) => (
              <option key={p.id} value={String(p.id)}>{p.name}</option>
            ))}
          </select>

          {/* Status filter */}
          <div className="flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 gap-0.5">
            {(["all", ...STATUS_OPTIONS] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterStatus(s as any)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all capitalize ${
                  filterStatus === s
                    ? "bg-zinc-800 text-white shadow-sm"
                    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                }`}
              >
                {s === "all" ? "All" : STATUS_META[s as keyof typeof STATUS_META]?.label ?? s}
                {s !== "all" && (
                  <span className="ml-1 text-[10px] opacity-70">
                    ({s === "delayed" ? stats.delayed : s === "completed" ? stats.completed : s === "in_progress" ? stats.in_progress : stats.not_started})
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Milestone list */}
      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-zinc-50 p-12 text-center text-sm text-zinc-400">
          {allMilestones.length === 0 ? "No milestones yet. Add milestones to your projects to see them here." : "No milestones match your filters."}
        </div>
      ) : (
        <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="grid border-b border-zinc-200 bg-zinc-50 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400"
            style={{ gridTemplateColumns: "3fr 2fr 1.5fr 1.5fr 2fr auto" }}>
            <span>Milestone</span>
            <span>Project</span>
            <span>Start</span>
            <span>End</span>
            <span>Resources</span>
            <span className="text-right">Actions</span>
          </div>

          <div className="divide-y divide-zinc-100">
            {filtered.map((m) => {
              const meta = STATUS_META[m.displayStatus];
              return (
                <div
                  key={`${m.project_id}-${m.id}`}
                  className={`grid items-center px-5 py-3.5 border-l-4 hover:bg-zinc-50 transition-colors ${meta.border}`}
                  style={{ gridTemplateColumns: "3fr 2fr 1.5fr 1.5fr 2fr auto" }}
                >
                  {/* Name + status */}
                  <div className="min-w-0 pr-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ${meta.badge}`}>
                        {meta.label}
                      </span>
                      <span className="text-sm font-medium text-zinc-900 truncate">{m.name}</span>
                    </div>
                    {m.description && (
                      <p className="mt-0.5 text-[11px] text-zinc-400 truncate">{m.description}</p>
                    )}
                  </div>

                  {/* Project */}
                  <div className="min-w-0 pr-3">
                    <p className="text-sm text-zinc-700 truncate">{m.project_name}</p>
                    <p className="text-[11px] text-zinc-400">{m.project_code}</p>
                  </div>

                  {/* Start */}
                  <span className="text-sm text-zinc-600">{formatDate(m.start_date || m.date)}</span>

                  {/* End */}
                  <span className={`text-sm ${m.displayStatus === "delayed" ? "font-semibold text-red-600" : "text-zinc-600"}`}>
                    {formatDate(m.end_date || m.date)}
                  </span>

                  {/* Resources */}
                  <div className="flex flex-wrap gap-1 pr-3">
                    {(m.resources || []).length === 0 ? (
                      <span className="text-[11px] text-zinc-300">—</span>
                    ) : (m.resources || []).slice(0, 2).map((r) => (
                      <span key={r.id} className="inline-flex rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600">{r.name}</span>
                    ))}
                    {(m.resources || []).length > 2 && (
                      <span className="inline-flex rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-500">
                        +{(m.resources || []).length - 2}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => openEdit(m)}
                      className="rounded-md p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition-colors"
                      title="Edit"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(m)}
                      className="rounded-md p-1.5 text-zinc-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      title="Delete"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t border-zinc-100 px-5 py-2.5 text-[11px] text-zinc-400">
            Showing {filtered.length} of {allMilestones.length} milestone{allMilestones.length !== 1 ? "s" : ""}
          </div>
        </div>
      )}

      {/* ─── Create / Edit Modal ──────────────────────────────────────────────── */}
      {modalMode !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={closeModal} />
          <div className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl ring-1 ring-zinc-200 overflow-hidden">
            {/* Modal header */}
            <div className="flex items-center justify-between border-b border-zinc-100 px-6 py-4">
              <h2 className="text-base font-semibold text-zinc-900">
                {modalMode === "create" ? "Add Milestone" : "Edit Milestone"}
              </h2>
              <button onClick={closeModal} className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 transition-colors text-lg leading-none">✕</button>
            </div>

            <div className="max-h-[75vh] overflow-y-auto px-6 py-5 space-y-4">
              {/* Project selector (create only) */}
              {modalMode === "create" && (
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Project *</label>
                  <select
                    value={form.project_id}
                    onChange={(e) => setForm((f) => ({ ...f, project_id: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none"
                  >
                    <option value="">Select a project…</option>
                    {projects.map((p) => (
                      <option key={p.id} value={String(p.id)}>{p.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Project info (edit only) */}
              {modalMode === "edit" && editingMilestone && (
                <div className="rounded-lg bg-zinc-50 px-4 py-2.5 text-sm text-zinc-600">
                  <span className="font-medium text-zinc-900">{editingMilestone.project_name}</span>
                  <span className="ml-2 text-zinc-400">{editingMilestone.project_code}</span>
                </div>
              )}

              {/* Name */}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Milestone Name *</label>
                <input
                  type="text"
                  placeholder="e.g. UAT Sign-off"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none"
                />
              </div>

              {/* Dates + status */}
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Start Date *</label>
                  <input
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">End Date *</label>
                  <input
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-zinc-700">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 focus:border-zinc-400 focus:outline-none"
                  >
                    {EDITABLE_STATUSES.map((s) => (
                      <option key={s} value={s}>{STATUS_META[s as keyof typeof STATUS_META]?.label ?? s}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">Description</label>
                <textarea
                  rows={2}
                  placeholder="Optional description…"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none resize-none"
                />
              </div>

              {/* Resources */}
              <div>
                <label className="mb-1 block text-xs font-medium text-zinc-700">
                  Resources
                  {form.resources.length > 0 && (
                    <span className="ml-2 inline-flex items-center rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-600">
                      {form.resources.length} selected
                    </span>
                  )}
                </label>
                {/* Selected chips */}
                {form.resources.length > 0 && (
                  <div className="mb-2 flex flex-wrap gap-1.5">
                    {form.resources.map((r) => (
                      <span key={r.id} className="inline-flex items-center gap-1 rounded-full bg-zinc-900 pl-2.5 pr-1.5 py-0.5 text-[11px] text-white">
                        {r.name}
                        <button
                          onClick={() => setForm((f) => ({ ...f, resources: f.resources.filter((x) => x.id !== r.id) }))}
                          className="text-zinc-300 hover:text-white leading-none"
                        >✕</button>
                      </span>
                    ))}
                  </div>
                )}
                <input
                  type="text"
                  placeholder="Search employees…"
                  value={resourceSearch}
                  onChange={(e) => setResourceSearch(e.target.value)}
                  className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-400 focus:outline-none"
                />
                {resourceSearch && (
                  <div className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-md">
                    {filteredEmployees.length === 0 ? (
                      <p className="px-3 py-2 text-xs text-zinc-400">No employees found</p>
                    ) : filteredEmployees.map((emp) => {
                      const selected = form.resources.some((r) => r.id === emp.id);
                      return (
                        <button
                          key={emp.id}
                          onClick={() => toggleResource(emp)}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${selected ? "bg-zinc-900 text-white" : "hover:bg-zinc-50 text-zinc-700"}`}
                        >
                          <span className="flex-1 truncate">{emp.full_name}</span>
                          <span className={`text-[10px] ${selected ? "text-zinc-300" : "text-zinc-400"}`}>{emp.department}</span>
                          {selected && <span className="text-xs">✓</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Modal footer */}
            <div className="flex justify-end gap-2 border-t border-zinc-100 px-6 py-4">
              <button onClick={closeModal} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name.trim() || !form.start_date || !form.end_date || (modalMode === "create" && !form.project_id)}
                className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? "Saving…" : modalMode === "create" ? "Create" : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Delete Confirm Modal ─────────────────────────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="fixed inset-0 bg-black/40" onClick={() => setDeleteConfirm(null)} />
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-zinc-200 space-y-4">
            <div>
              <h3 className="text-base font-semibold text-zinc-900">Delete Milestone</h3>
              <p className="mt-1.5 text-sm text-zinc-500">
                Are you sure you want to delete <span className="font-medium text-zinc-900">"{deleteConfirm.name}"</span>? This cannot be undone.
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setDeleteConfirm(null)} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-40 transition-colors"
              >
                {deleting ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
