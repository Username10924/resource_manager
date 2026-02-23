"use client";

import { useMemo, useState, useEffect, useRef } from "react";

type RoadmapProject = {
  id: number;
  name: string;
  status?: string;
  progress?: number;
  business_unit?: string | null;
  start_date: string | null;
  end_date: string | null;
  architect_name?: string | null;
  ba_name?: string | null;
};

type BookingForGantt = {
  project_id: number;
  employee_id: number;
  full_name?: string;
  status?: string;
  role?: string | null;
};

type ResourceEntry = {
  name: string;
  role?: string | null;
};

type ParsedProject = {
  id: number;
  name: string;
  status: string;
  progress: number;
  businessUnit: string;
  start: Date;
  end: Date;
};

type TooltipState = {
  project: ParsedProject;
  resources: ResourceEntry[];
  pmBa: ResourceEntry[];
  x: number;
  y: number;
};

const CELL_WIDTH = 52;
const NAME_COL_WIDTH = 260;

function toMonthStart(value: string | null): Date | null {
  if (!value) return null;

  const ymd = value.match(/^(\d{4})-(\d{2})(?:-\d{2})?$/);
  if (ymd) {
    const year = Number(ymd[1]);
    const monthIndex = Number(ymd[2]) - 1;
    if (Number.isFinite(year) && Number.isFinite(monthIndex) && monthIndex >= 0 && monthIndex <= 11) {
      return new Date(year, monthIndex, 1);
    }
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatMonthYear(date: Date): string {
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

function monthDiff(start: Date, end: Date): number {
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
}

function getMonthRange(start: Date, end: Date): Date[] {
  const result: Date[] = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    result.push(new Date(cursor));
    cursor.setMonth(cursor.getMonth() + 1);
  }

  return result;
}

function statusBarBg(status: string): string {
  switch (status) {
    case "active":
      return "#2563eb"; // blue-600
    case "completed":
      return "#059669"; // emerald-600
    case "planned":
    case "planning":
      return "#d97706"; // amber-600
    case "on_hold":
    case "on-hold":
      return "#ea580c"; // orange-600
    default:
      return "#dc2626"; // red-600
  }
}

function statusBarTrackBg(status: string): string {
  switch (status) {
    case "active":
      return "#93c5fd"; // blue-300
    case "completed":
      return "#6ee7b7"; // emerald-300
    case "planned":
    case "planning":
      return "#fcd34d"; // amber-300
    case "on_hold":
    case "on-hold":
      return "#fdba74"; // orange-300
    default:
      return "#fca5a5"; // red-300
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "active":
      return "bg-blue-50 text-blue-700 ring-1 ring-blue-200";
    case "completed":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    case "planned":
    case "planning":
      return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    case "on_hold":
    case "on-hold":
      return "bg-orange-50 text-orange-700 ring-1 ring-orange-200";
    default:
      return "bg-red-50 text-red-700 ring-1 ring-red-200";
  }
}

function statusLabel(status: string): string {
  return status.replace(/[_-]/g, " ");
}

export default function ProjectRoadmapGantt({
  projects,
  bookings = [],
}: {
  projects: RoadmapProject[];
  bookings?: BookingForGantt[];
}) {
  // Build resource map: project_id -> unique { name, role }[]
  const resourceMap = useMemo(() => {
    const map: Record<number, ResourceEntry[]> = {};
    bookings.forEach((b) => {
      if ((b.status || "").toLowerCase() === "cancelled") return;
      if (!b.full_name) return;
      if (!map[b.project_id]) map[b.project_id] = [];
      if (!map[b.project_id].some((r) => r.name === b.full_name)) {
        map[b.project_id].push({ name: b.full_name, role: b.role ?? null });
      }
    });
    return map;
  }, [bookings]);

  // Build PM/BA map: project_id -> [{ name, role }]
  const pmBaMap = useMemo(() => {
    const map: Record<number, ResourceEntry[]> = {};
    projects.forEach((p) => {
      const entries: ResourceEntry[] = [];
      if (p.architect_name) entries.push({ name: p.architect_name, role: "Project Manager" });
      if (p.ba_name) entries.push({ name: p.ba_name, role: "Business Analyst" });
      if (entries.length > 0) map[p.id] = entries;
    });
    return map;
  }, [projects]);

  // Tooltip state
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Hide tooltip on scroll so it doesn't float in a wrong position
  useEffect(() => {
    const hide = () => setTooltip(null);
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, []);

  // Parse all projects to discover available years
  const allParsed = useMemo(() => {
    return projects
      .map((project) => {
        const parsedStart = toMonthStart(project.start_date);
        const parsedEnd = toMonthStart(project.end_date);

        if (!parsedStart && !parsedEnd) return null;

        const rawStart = parsedStart ?? parsedEnd;
        const rawEnd = parsedEnd ?? parsedStart;

        if (!rawStart || !rawEnd) return null;

        const start = rawStart <= rawEnd ? rawStart : rawEnd;
        const end = rawStart <= rawEnd ? rawEnd : rawStart;

        return {
          id: project.id,
          name: project.name,
          status: (project.status || "unknown").toLowerCase(),
          progress: project.progress ?? 0,
          businessUnit: project.business_unit || "",
          start,
          end,
        } as ParsedProject;
      })
      .filter(Boolean) as ParsedProject[];
  }, [projects]);

  // Discover all years that have projects starting in them
  const availableYears = useMemo(() => {
    const yearSet = new Set<number>();
    allParsed.forEach((p) => yearSet.add(p.start.getFullYear()));
    const years = Array.from(yearSet).sort((a, b) => a - b);
    return years;
  }, [allParsed]);

  const currentYear = new Date().getFullYear();
  const defaultYear = availableYears.includes(currentYear)
    ? currentYear
    : availableYears[availableYears.length - 1] ?? currentYear;

  const [selectedYear, setSelectedYear] = useState<number>(defaultYear);

  // Filter: show projects that START in the selected year (end can be any year)
  const rows = useMemo(() => {
    const filtered = allParsed.filter((p) => p.start.getFullYear() === selectedYear);
    filtered.sort((a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime());
    return filtered;
  }, [allParsed, selectedYear]);

  // Compute the window: starts Jan of selected year, ends at the latest end date month (or Dec of selected year)
  const { windowStart, windowEnd, months } = useMemo(() => {
    const wStart = new Date(selectedYear, 0, 1);
    let wEnd = new Date(selectedYear, 11, 1);

    // Extend the window to cover all project end dates
    rows.forEach((p) => {
      if (p.end > wEnd) {
        wEnd = new Date(p.end.getFullYear(), p.end.getMonth(), 1);
      }
    });

    return {
      windowStart: wStart,
      windowEnd: wEnd,
      months: getMonthRange(wStart, wEnd),
    };
  }, [selectedYear, rows]);

  // Group months by year for the grouped header
  const yearGroups = useMemo(() => {
    const groups: { year: number; months: Date[]; startIndex: number }[] = [];
    let currentGroup: { year: number; months: Date[]; startIndex: number } | null = null;

    months.forEach((month, index) => {
      const year = month.getFullYear();
      if (!currentGroup || currentGroup.year !== year) {
        currentGroup = { year, months: [], startIndex: index };
        groups.push(currentGroup);
      }
      currentGroup.months.push(month);
    });

    return groups;
  }, [months]);

  const timelineWidth = months.length * CELL_WIDTH;

  // Today marker position
  const todayPosition = useMemo(() => {
    const now = new Date();
    const nowMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    if (nowMonth < windowStart || nowMonth > windowEnd) return null;
    const index = monthDiff(windowStart, nowMonth);
    const dayProgress = (now.getDate() - 1) / 30;
    return index * CELL_WIDTH + dayProgress * CELL_WIDTH;
  }, [windowStart, windowEnd]);

  return (
    <div className="space-y-4">
      {/* Year selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-zinc-600">Year:</span>
        <div className="flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 gap-0.5">
          {availableYears.map((year) => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-all ${
                selectedYear === year
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
              }`}
            >
              {year}
            </button>
          ))}
        </div>
        <span className="ml-2 text-xs text-zinc-400">
          {rows.length} project{rows.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4">
        {[
          { status: "active", label: "Active", color: "bg-blue-600" },
          { status: "planning", label: "Planning", color: "bg-amber-500" },
          { status: "on-hold", label: "On Hold", color: "bg-orange-500" },
          { status: "completed", label: "Completed", color: "bg-emerald-600" },
        ].map((item) => (
          <div key={item.status} className="flex items-center gap-1.5 text-xs text-zinc-600">
            <div className={`h-2.5 w-6 rounded-sm ${item.color}`} />
            {item.label}
          </div>
        ))}
        <div className="flex items-center gap-1.5 text-xs text-zinc-400 ml-2">
          <div className="h-px w-4 bg-red-400" />
          Today
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
          <div className="text-sm text-zinc-500">No projects starting in {selectedYear}</div>
          <div className="mt-1 text-xs text-zinc-400">Select a different year to view projects</div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div style={{ minWidth: NAME_COL_WIDTH + timelineWidth }}>
            {/* Header: Year group row + Month row */}
            <div
              className="grid border-b border-zinc-200 bg-zinc-50"
              style={{ gridTemplateColumns: `${NAME_COL_WIDTH}px ${timelineWidth}px` }}
            >
              {/* Project column header - spans both header rows */}
              <div className="border-r border-zinc-200 flex items-center px-4">
                <span className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Project</span>
              </div>

              {/* Timeline headers */}
              <div>
                {/* Year row */}
                <div className="grid border-b border-zinc-200" style={{ gridTemplateColumns: yearGroups.map((g) => `${g.months.length * CELL_WIDTH}px`).join(" ") }}>
                  {yearGroups.map((group) => (
                    <div
                      key={group.year}
                      className="border-r border-zinc-200 px-2 py-2 text-center text-xs font-bold text-zinc-800"
                    >
                      {group.year}
                    </div>
                  ))}
                </div>

                {/* Month row */}
                <div
                  className="grid"
                  style={{ gridTemplateColumns: `repeat(${months.length}, ${CELL_WIDTH}px)` }}
                >
                  {months.map((month) => {
                    const isCurrentMonth =
                      month.getFullYear() === new Date().getFullYear() &&
                      month.getMonth() === new Date().getMonth();
                    return (
                      <div
                        key={`${month.getFullYear()}-${month.getMonth()}`}
                        className={`border-r border-zinc-200 px-1 py-2 text-center text-[11px] font-medium ${
                          isCurrentMonth ? "bg-blue-50 text-blue-700 font-semibold" : "text-zinc-500"
                        }`}
                      >
                        {month.toLocaleDateString(undefined, { month: "short" })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Project rows */}
            {rows.map((project) => {
              const clippedStart = project.start < windowStart ? windowStart : project.start;
              const clippedEnd = project.end > windowEnd ? windowEnd : project.end;

              const startIndex = Math.max(0, monthDiff(windowStart, clippedStart));
              const span = Math.max(1, monthDiff(clippedStart, clippedEnd) + 1);

              const barLeft = startIndex * CELL_WIDTH + 2;
              const barWidth = span * CELL_WIDTH - 4;

              const progressWidth = Math.round((project.progress / 100) * barWidth);

              // Build the label that goes inside the bar
              const barLabel = [
                project.progress > 0 ? `${project.progress}%` : null,
                project.businessUnit || null,
              ].filter(Boolean).join(" · ");

              return (
                <div
                  key={project.id}
                  className="grid border-b border-zinc-100 hover:bg-zinc-50/50 transition-colors"
                  style={{ gridTemplateColumns: `${NAME_COL_WIDTH}px ${timelineWidth}px` }}
                >
                  {/* Project name cell */}
                  <div className="border-r border-zinc-200 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-zinc-900">{project.name}</span>
                      <span
                        className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[10px] font-medium capitalize ${statusBadgeClass(project.status)}`}
                      >
                        {statusLabel(project.status)}
                      </span>
                    </div>
                    <div className="mt-1 text-[11px] text-zinc-400">
                      {formatMonthYear(project.start)} — {formatMonthYear(project.end)}
                    </div>
                  </div>

                  {/* Timeline bar cell */}
                  <div className="relative h-14">
                    {/* Grid lines */}
                    <div
                      className="absolute inset-0 grid"
                      style={{ gridTemplateColumns: `repeat(${months.length}, ${CELL_WIDTH}px)` }}
                    >
                      {months.map((month) => {
                        const isYearBoundary = month.getMonth() === 0;
                        return (
                          <div
                            key={`${project.id}-${month.getFullYear()}-${month.getMonth()}`}
                            className={`border-r ${isYearBoundary ? "border-zinc-200" : "border-zinc-100"}`}
                          />
                        );
                      })}
                    </div>

                    {/* Today marker */}
                    {todayPosition !== null && (
                      <div
                        className="absolute top-0 bottom-0 w-px bg-red-400 z-10"
                        style={{ left: todayPosition }}
                      />
                    )}

                    {/* Project bar: track (lighter) + filled progress (darker) */}
                    <div
                      className="absolute top-3 h-8 rounded-md overflow-hidden cursor-pointer"
                      style={{
                        left: barLeft,
                        width: barWidth,
                        backgroundColor: statusBarTrackBg(project.status),
                      }}
                      onMouseEnter={(e) => {
                        setTooltip({
                          project,
                          resources: resourceMap[project.id] || [],
                          pmBa: pmBaMap[project.id] || [],
                          x: e.clientX,
                          y: e.clientY,
                        });
                      }}
                      onMouseMove={(e) => {
                        setTooltip((prev) =>
                          prev ? { ...prev, x: e.clientX, y: e.clientY } : null
                        );
                      }}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      {/* Filled progress portion */}
                      <div
                        className="absolute inset-y-0 left-0 rounded-l-md"
                        style={{
                          width: progressWidth,
                          backgroundColor: statusBarBg(project.status),
                        }}
                      />

                      {/* Label inside the bar */}
                      {barWidth >= 48 && barLabel && (
                        <div
                          className="absolute inset-0 flex items-center px-2 z-[1]"
                        >
                          <span
                            className="truncate text-[10px] font-semibold leading-none"
                            style={{
                              color: progressWidth > barWidth * 0.5 ? "#fff" : "#1f2937",
                              textShadow: progressWidth > barWidth * 0.5 ? "0 1px 2px rgba(0,0,0,0.2)" : "none",
                            }}
                          >
                            {barLabel}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Hover tooltip */}
      {tooltip && (
        <div
          ref={tooltipRef}
          className="pointer-events-none fixed z-50 w-max max-w-[260px]"
          style={{
            left: tooltip.x,
            top: tooltip.y - 8,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="rounded-lg bg-zinc-900 px-3 py-2.5 shadow-xl ring-1 ring-white/10">
            {/* Project name */}
            <p className="truncate text-[11px] font-semibold text-white leading-tight">
              {tooltip.project.name}
            </p>

            {/* Divider */}
            <div className="my-1.5 h-px bg-zinc-700" />

            {/* PM / BA */}
            {tooltip.pmBa.length > 0 && (
              <ul className="mb-1.5 space-y-0.5">
                {tooltip.pmBa.map((r) => (
                  <li key={r.role} className="flex items-center gap-1.5">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-blue-700 text-[9px] font-bold text-blue-100">
                      {r.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                    </span>
                    <div className="min-w-0">
                      <span className="truncate text-[11px] text-zinc-200 leading-tight block">{r.name}</span>
                      <span className="text-[9px] text-zinc-400">{r.role}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {/* Team resources */}
            {tooltip.resources.length > 0 ? (
              <>
                {tooltip.pmBa.length > 0 && <div className="mb-1.5 h-px bg-zinc-700" />}
                <p className="mb-1 text-[10px] font-medium text-zinc-400 uppercase tracking-wide">
                  {tooltip.resources.length} team resource{tooltip.resources.length !== 1 ? "s" : ""}
                </p>
                <ul className="space-y-0.5">
                  {tooltip.resources.map((r) => (
                    <li key={r.name} className="flex items-center gap-1.5">
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-zinc-700 text-[9px] font-bold text-zinc-200">
                        {r.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                      </span>
                      <div className="min-w-0">
                        <span className="truncate text-[11px] text-zinc-200 leading-tight block">{r.name}</span>
                        {r.role && <span className="text-[9px] text-zinc-400">{r.role}</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              tooltip.pmBa.length === 0 && (
                <p className="text-[11px] text-zinc-500 italic">No resources assigned</p>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}
