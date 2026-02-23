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

// One palette entry per year slot — cycles if there are more years than entries
const YEAR_PALETTE = [
  { rowBg: "#f5f3ff", accent: "#7c3aed", separatorBg: "#ede9fe", separatorText: "#5b21b6", headerBg: "#ddd6fe" }, // violet
  { rowBg: "#f0f9ff", accent: "#0284c7", separatorBg: "#e0f2fe", separatorText: "#0369a1", headerBg: "#bae6fd" }, // sky
  { rowBg: "#f0fdf4", accent: "#16a34a", separatorBg: "#dcfce7", separatorText: "#15803d", headerBg: "#bbf7d0" }, // emerald
  { rowBg: "#fff7ed", accent: "#ea580c", separatorBg: "#ffedd5", separatorText: "#9a3412", headerBg: "#fed7aa" }, // orange
  { rowBg: "#fdf2f8", accent: "#be185d", separatorBg: "#fce7f3", separatorText: "#9d174d", headerBg: "#fbcfe8" }, // pink
  { rowBg: "#fefce8", accent: "#ca8a04", separatorBg: "#fef9c3", separatorText: "#854d0e", headerBg: "#fef08a" }, // yellow
  { rowBg: "#fff1f2", accent: "#e11d48", separatorBg: "#ffe4e6", separatorText: "#be123c", headerBg: "#fecdd3" }, // rose
];

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
    case "active":    return "#2563eb";
    case "completed": return "#059669";
    case "planned":
    case "planning":  return "#d97706";
    case "on_hold":
    case "on-hold":   return "#ea580c";
    default:          return "#dc2626";
  }
}

function statusBarTrackBg(status: string): string {
  switch (status) {
    case "active":    return "#93c5fd";
    case "completed": return "#6ee7b7";
    case "planned":
    case "planning":  return "#fcd34d";
    case "on_hold":
    case "on-hold":   return "#fdba74";
    default:          return "#fca5a5";
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "active":    return "bg-blue-50 text-blue-700 ring-1 ring-blue-200";
    case "completed": return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    case "planned":
    case "planning":  return "bg-amber-50 text-amber-700 ring-1 ring-amber-200";
    case "on_hold":
    case "on-hold":   return "bg-orange-50 text-orange-700 ring-1 ring-orange-200";
    default:          return "bg-red-50 text-red-700 ring-1 ring-red-200";
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

  useEffect(() => {
    const hide = () => setTooltip(null);
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, []);

  // Parse all projects
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

  // Sorted unique years
  const availableYears = useMemo(() => {
    const yearSet = new Set<number>();
    allParsed.forEach((p) => yearSet.add(p.start.getFullYear()));
    return Array.from(yearSet).sort((a, b) => a - b);
  }, [allParsed]);

  // Map year -> palette index (stable across renders)
  const yearColorIndex = useMemo(() => {
    const map: Record<number, number> = {};
    availableYears.forEach((y, i) => { map[y] = i % YEAR_PALETTE.length; });
    return map;
  }, [availableYears]);

  const currentYear = new Date().getFullYear();
  const defaultYear: number | "all" = availableYears.includes(currentYear)
    ? currentYear
    : availableYears[availableYears.length - 1] ?? currentYear;

  const [selectedYear, setSelectedYear] = useState<number | "all">(defaultYear);

  // Rows for the current selection
  const rows = useMemo(() => {
    if (selectedYear === "all") {
      return [...allParsed].sort(
        (a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime()
      );
    }
    const filtered = allParsed.filter((p) => p.start.getFullYear() === selectedYear);
    return filtered.sort((a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime());
  }, [allParsed, selectedYear]);

  // Window (start/end of the timeline)
  const { windowStart, windowEnd, months } = useMemo(() => {
    if (rows.length === 0) {
      const y = typeof selectedYear === "number" ? selectedYear : new Date().getFullYear();
      const wStart = new Date(y, 0, 1);
      return { windowStart: wStart, windowEnd: new Date(y, 11, 1), months: getMonthRange(wStart, new Date(y, 11, 1)) };
    }

    let wStart: Date;
    let wEnd: Date;

    if (selectedYear === "all") {
      wStart = new Date(rows[0].start.getFullYear(), 0, 1);
      wEnd = new Date(rows[0].end.getFullYear(), rows[0].end.getMonth(), 1);
      rows.forEach((p) => {
        if (p.start < wStart) wStart = new Date(p.start.getFullYear(), 0, 1);
        if (p.end > wEnd) wEnd = new Date(p.end.getFullYear(), p.end.getMonth(), 1);
      });
    } else {
      wStart = new Date(selectedYear, 0, 1);
      wEnd = new Date(selectedYear, 11, 1);
      rows.forEach((p) => {
        if (p.end > wEnd) wEnd = new Date(p.end.getFullYear(), p.end.getMonth(), 1);
      });
    }

    return { windowStart: wStart, windowEnd: wEnd, months: getMonthRange(wStart, wEnd) };
  }, [selectedYear, rows]);

  // Group months by year for header
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

  const todayPosition = useMemo(() => {
    const now = new Date();
    const nowMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    if (nowMonth < windowStart || nowMonth > windowEnd) return null;
    const index = monthDiff(windowStart, nowMonth);
    const dayProgress = (now.getDate() - 1) / 30;
    return index * CELL_WIDTH + dayProgress * CELL_WIDTH;
  }, [windowStart, windowEnd]);

  // For "all" view: group rows by start year to insert separator rows
  const rowGroups = useMemo(() => {
    if (selectedYear !== "all") return null;
    const groups: { year: number; rows: ParsedProject[] }[] = [];
    rows.forEach((p) => {
      const y = p.start.getFullYear();
      const last = groups[groups.length - 1];
      if (!last || last.year !== y) groups.push({ year: y, rows: [p] });
      else last.rows.push(p);
    });
    return groups;
  }, [selectedYear, rows]);

  return (
    <div className="space-y-4">
      {/* Year selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-zinc-600">Year:</span>
        <div className="flex flex-wrap rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 gap-0.5">
          {/* All button */}
          <button
            onClick={() => setSelectedYear("all")}
            className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-all ${
              selectedYear === "all"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
            }`}
          >
            All
          </button>
          {/* Individual year buttons, each in its palette color when selected */}
          {availableYears.map((year) => {
            const pal = YEAR_PALETTE[yearColorIndex[year]];
            const isSelected = selectedYear === year;
            return (
              <button
                key={year}
                onClick={() => setSelectedYear(year)}
                style={isSelected ? { backgroundColor: pal.accent, color: "#fff" } : undefined}
                className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-all ${
                  isSelected
                    ? "shadow-sm"
                    : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                }`}
              >
                {year}
              </button>
            );
          })}
        </div>
        {/* Year color swatches legend when "All" is active */}
        {selectedYear === "all" && availableYears.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 ml-1">
            {availableYears.map((year) => {
              const pal = YEAR_PALETTE[yearColorIndex[year]];
              return (
                <span key={year} className="flex items-center gap-1 text-xs font-medium" style={{ color: pal.accent }}>
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: pal.accent }} />
                  {year}
                </span>
              );
            })}
          </div>
        )}
        <span className="ml-1 text-xs text-zinc-400">
          {rows.length} project{rows.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Status legend */}
      <div className="flex flex-wrap items-center gap-4">
        {[
          { status: "active",    label: "Active",    color: "bg-blue-600"    },
          { status: "planning",  label: "Planning",  color: "bg-amber-500"   },
          { status: "on-hold",   label: "On Hold",   color: "bg-orange-500"  },
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
          <div className="text-sm text-zinc-500">
            {selectedYear === "all" ? "No projects found" : `No projects starting in ${selectedYear}`}
          </div>
          {selectedYear !== "all" && (
            <div className="mt-1 text-xs text-zinc-400">Select a different year to view projects</div>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div style={{ minWidth: NAME_COL_WIDTH + timelineWidth }}>
            {/* Header */}
            <div
              className="grid border-b border-zinc-200 bg-zinc-50"
              style={{ gridTemplateColumns: `${NAME_COL_WIDTH}px ${timelineWidth}px` }}
            >
              <div className="border-r border-zinc-200 flex items-center px-4">
                <span className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Project</span>
              </div>
              <div>
                {/* Year row */}
                <div
                  className="grid border-b border-zinc-200"
                  style={{ gridTemplateColumns: yearGroups.map((g) => `${g.months.length * CELL_WIDTH}px`).join(" ") }}
                >
                  {yearGroups.map((group) => {
                    const pal = YEAR_PALETTE[yearColorIndex[group.year] ?? 0];
                    return (
                      <div
                        key={group.year}
                        className="border-r border-zinc-200 px-2 py-2 text-center text-xs font-bold"
                        style={
                          selectedYear === "all"
                            ? { backgroundColor: pal.headerBg, color: pal.separatorText }
                            : { color: "#1f2937" }
                        }
                      >
                        {group.year}
                      </div>
                    );
                  })}
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

            {/* Project rows — grouped when in "all" view */}
            {selectedYear === "all" && rowGroups
              ? rowGroups.map(({ year, rows: groupRows }) => {
                  const pal = YEAR_PALETTE[yearColorIndex[year] ?? 0];
                  return (
                    <div key={year}>
                      {/* Year separator */}
                      <div
                        className="grid border-b"
                        style={{
                          gridTemplateColumns: `${NAME_COL_WIDTH}px ${timelineWidth}px`,
                          backgroundColor: pal.separatorBg,
                          borderColor: pal.accent + "55",
                        }}
                      >
                        <div
                          className="col-span-2 px-4 py-1.5 text-xs font-bold uppercase tracking-widest"
                          style={{ color: pal.separatorText }}
                        >
                          {year}
                        </div>
                      </div>

                      {/* Rows for this year */}
                      {groupRows.map((project) => renderProjectRow(project, pal.accent, pal.rowBg))}
                    </div>
                  );
                })
              : rows.map((project) => renderProjectRow(project, undefined, undefined))
            }
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
            <p className="truncate text-[11px] font-semibold text-white leading-tight">
              {tooltip.project.name}
            </p>
            <div className="my-1.5 h-px bg-zinc-700" />
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

  // ── helper rendered inside the component so it closes over state ──────────
  function renderProjectRow(project: ParsedProject, accentColor?: string, rowBg?: string) {
    const clippedStart = project.start < windowStart ? windowStart : project.start;
    const clippedEnd = project.end > windowEnd ? windowEnd : project.end;

    const startIndex = Math.max(0, monthDiff(windowStart, clippedStart));
    const span = Math.max(1, monthDiff(clippedStart, clippedEnd) + 1);

    const barLeft = startIndex * CELL_WIDTH + 2;
    const barWidth = span * CELL_WIDTH - 4;
    const progressWidth = Math.round((project.progress / 100) * barWidth);

    const barLabel = [
      project.progress > 0 ? `${project.progress}%` : null,
      project.businessUnit || null,
    ].filter(Boolean).join(" · ");

    return (
      <div
        key={project.id}
        className="grid border-b border-zinc-100 transition-colors"
        style={{
          gridTemplateColumns: `${NAME_COL_WIDTH}px ${timelineWidth}px`,
          backgroundColor: rowBg ?? undefined,
        }}
        onMouseEnter={(e) => {
          const el = e.currentTarget;
          el.style.filter = "brightness(0.97)";
        }}
        onMouseLeave={(e) => {
          const el = e.currentTarget;
          el.style.filter = "";
        }}
      >
        {/* Project name cell */}
        <div
          className="border-r border-zinc-200 px-4 py-3"
          style={accentColor ? { borderLeft: `3px solid ${accentColor}` } : undefined}
        >
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
                  className={`border-r ${isYearBoundary ? "border-zinc-300" : "border-zinc-100"}`}
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

          {/* Project bar */}
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
            <div
              className="absolute inset-y-0 left-0 rounded-l-md"
              style={{ width: progressWidth, backgroundColor: statusBarBg(project.status) }}
            />
            {barWidth >= 48 && barLabel && (
              <div className="absolute inset-0 flex items-center px-2 z-[1]">
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
  }
}
