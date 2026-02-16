"use client";

import { useMemo, useState } from "react";
import Button from "@/components/Button";

type YearFilterMode = "current" | "previous" | "combined";

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

const CELL_WIDTH = 56;
const NAME_COL_WIDTH = 280;

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

function statusClass(status: string): string {
  switch (status) {
    case "active":
      return "bg-emerald-100 text-emerald-700";
    case "completed":
      return "bg-zinc-100 text-zinc-700";
    case "planned":
      return "bg-yellow-100 text-yellow-700";
    case "on_hold":
      return "bg-orange-100 text-orange-700";
    default:
      return "bg-red-100 text-red-700";
  }
}

export default function ProjectRoadmapGantt({ projects }: { projects: RoadmapProject[] }) {
  const [yearFilterMode, setYearFilterMode] = useState<YearFilterMode>("current");

  const now = new Date();
  const currentYear = now.getFullYear();
  const previousYear = currentYear - 1;

  const selectedYears = useMemo(() => {
    if (yearFilterMode === "current") return [currentYear];
    if (yearFilterMode === "previous") return [previousYear];
    return [previousYear, currentYear];
  }, [yearFilterMode, currentYear, previousYear]);

  const windowStart = useMemo(
    () => new Date(Math.min(...selectedYears), 0, 1),
    [selectedYears]
  );
  const windowEnd = useMemo(
    () => new Date(Math.max(...selectedYears), 11, 1),
    [selectedYears]
  );

  const months = useMemo(() => getMonthRange(windowStart, windowEnd), [windowStart, windowEnd]);

  const rows = useMemo(() => {
    const parsed = projects
      .map((project) => {
        const parsedStart = toMonthStart(project.start_date);
        const parsedEnd = toMonthStart(project.end_date);

        if (!parsedStart && !parsedEnd) return null;

        const rawStart = parsedStart ?? parsedEnd;
        const rawEnd = parsedEnd ?? parsedStart;

        if (!rawStart || !rawEnd) return null;

        const start = rawStart <= rawEnd ? rawStart : rawEnd;
        const end = rawStart <= rawEnd ? rawEnd : rawStart;

        if (end < windowStart || start > windowEnd) return null;

        return {
          id: project.id,
          name: project.name,
          status: (project.status || "unknown").toLowerCase(),
          start,
          end,
        } as ParsedProject;
      })
      .filter(Boolean) as ParsedProject[];

    parsed.sort((a, b) => a.start.getTime() - b.start.getTime() || a.end.getTime() - b.end.getTime());
    return parsed;
  }, [projects, windowStart, windowEnd]);

  const timelineWidth = months.length * CELL_WIDTH;
  const includeYearInMonthLabel = selectedYears.length > 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-zinc-700">Year Filter:</span>
        <Button
          size="sm"
          variant={yearFilterMode === "current" ? "primary" : "secondary"}
          onClick={() => setYearFilterMode("current")}
        >
          Current Year ({currentYear})
        </Button>
        <Button
          size="sm"
          variant={yearFilterMode === "previous" ? "primary" : "secondary"}
          onClick={() => setYearFilterMode("previous")}
        >
          Previous Year ({previousYear})
        </Button>
        <Button
          size="sm"
          variant={yearFilterMode === "combined" ? "primary" : "secondary"}
          onClick={() => setYearFilterMode("combined")}
        >
          Combined ({previousYear} + {currentYear})
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-6 text-sm text-zinc-600">
          No projects with valid start/end dates in the selected year range.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white">
          <div style={{ minWidth: NAME_COL_WIDTH + timelineWidth }}>
            <div className="grid border-b border-zinc-200 bg-zinc-50" style={{ gridTemplateColumns: `${NAME_COL_WIDTH}px ${timelineWidth}px` }}>
              <div className="border-r border-zinc-200 px-4 py-3 text-sm font-semibold text-zinc-900">Project</div>
              <div>
                <div className="grid" style={{ gridTemplateColumns: `repeat(${months.length}, ${CELL_WIDTH}px)` }}>
                  {months.map((month) => (
                    <div key={`${month.getFullYear()}-${month.getMonth()}`} className="border-r border-zinc-200 px-2 py-3 text-center text-xs font-medium text-zinc-600">
                      {month.toLocaleDateString(undefined, {
                        month: "short",
                        ...(includeYearInMonthLabel ? { year: "2-digit" } : null),
                      } as Intl.DateTimeFormatOptions)}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {rows.map((project) => {
              const clippedStart = project.start < windowStart ? windowStart : project.start;
              const clippedEnd = project.end > windowEnd ? windowEnd : project.end;

              const startIndex = Math.max(0, monthDiff(windowStart, clippedStart));
              const span = Math.max(1, monthDiff(clippedStart, clippedEnd) + 1);

              const barLeft = startIndex * CELL_WIDTH + 2;
              const barWidth = span * CELL_WIDTH - 4;

              return (
                <div key={project.id} className="grid border-b border-zinc-200" style={{ gridTemplateColumns: `${NAME_COL_WIDTH}px ${timelineWidth}px` }}>
                  <div className="border-r border-zinc-200 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium text-zinc-900">{project.name}</span>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusClass(project.status)}`}>
                        {project.status.replace("_", " ")}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-zinc-500">
                      {formatMonthYear(project.start)} - {formatMonthYear(project.end)}
                    </div>
                  </div>

                  <div className="relative h-14">
                    <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${months.length}, ${CELL_WIDTH}px)` }}>
                      {months.map((month) => (
                        <div key={`${project.id}-${month.getFullYear()}-${month.getMonth()}`} className="border-r border-zinc-100" />
                      ))}
                    </div>
                    <div className="absolute top-4 h-6 rounded-md bg-zinc-900" style={{ left: barLeft, width: barWidth }} title={`${project.name} (${formatMonthYear(project.start)} - ${formatMonthYear(project.end)})`} />
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
