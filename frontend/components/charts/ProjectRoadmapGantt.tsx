"use client";

import { useMemo, useState } from "react";

type RoadmapProject = {
  id: number;
  name: string;
  status?: string;
  start_date: string | null;
  end_date: string | null;
};

type ParsedProject = {
  id: number;
  name: string;
  status: string;
  start: Date;
  end: Date;
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

function statusBarColor(status: string): string {
  switch (status) {
    case "active":
      return "bg-emerald-500";
    case "completed":
      return "bg-zinc-400";
    case "planned":
    case "planning":
      return "bg-amber-400";
    case "on_hold":
    case "on-hold":
      return "bg-orange-500";
    default:
      return "bg-red-400";
  }
}

function statusBadgeClass(status: string): string {
  switch (status) {
    case "active":
      return "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200";
    case "completed":
      return "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200";
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

export default function ProjectRoadmapGantt({ projects }: { projects: RoadmapProject[] }) {
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
                  ? "bg-zinc-900 text-white shadow-sm"
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
      <div className="flex flex-wrap items-center gap-3">
        {[
          { status: "active", label: "Active", color: "bg-emerald-500" },
          { status: "planning", label: "Planning", color: "bg-amber-400" },
          { status: "on-hold", label: "On Hold", color: "bg-orange-500" },
          { status: "completed", label: "Completed", color: "bg-zinc-400" },
        ].map((item) => (
          <div key={item.status} className="flex items-center gap-1.5 text-xs text-zinc-600">
            <div className={`h-2.5 w-2.5 rounded-sm ${item.color}`} />
            {item.label}
          </div>
        ))}
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
                          isCurrentMonth ? "bg-zinc-100 text-zinc-900 font-semibold" : "text-zinc-500"
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

                    {/* Project bar */}
                    <div
                      className={`absolute top-4 h-6 rounded-md shadow-sm ${statusBarColor(project.status)}`}
                      style={{ left: barLeft, width: barWidth }}
                      title={`${project.name} (${formatMonthYear(project.start)} – ${formatMonthYear(project.end)})`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
