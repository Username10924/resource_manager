"use client";

import { useMemo, useState, useRef, useEffect } from "react";

type MilestoneResource = { id: number; name: string };

type ChartMilestone = {
  id: number;
  project_id: number;
  name: string;
  date: string;
  description?: string | null;
  resources: MilestoneResource[];
};

type ChartProject = {
  id: number;
  name: string;
  project_code?: string;
  start_date: string | null;
  end_date: string | null;
  milestones: ChartMilestone[];
};

type TooltipState = {
  milestone: ChartMilestone;
  projectName: string;
  x: number;
  y: number;
};

const ROW_HEIGHT = 48;
const NAME_COL = 220;
const CELL_W = 52;

function toMonthStart(v: string | null): Date | null {
  if (!v) return null;
  const m = v.match(/^(\d{4})-(\d{2})/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, 1);
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), 1);
}

function monthDiff(a: Date, b: Date) {
  return (b.getFullYear() - a.getFullYear()) * 12 + b.getMonth() - a.getMonth();
}

function getMonthRange(start: Date, end: Date): Date[] {
  const out: Date[] = [];
  const cur = new Date(start);
  while (cur <= end) { out.push(new Date(cur)); cur.setMonth(cur.getMonth() + 1); }
  return out;
}

export default function ProjectMilestonesChart({ projects }: { projects: ChartProject[] }) {
  // Only projects that have milestones
  const projectsWithMilestones = useMemo(
    () => projects.filter((p) => p.milestones && p.milestones.length > 0),
    [projects]
  );

  // All milestone dates to compute timeline window
  const allDates = useMemo(() => {
    const dates: Date[] = [];
    projectsWithMilestones.forEach((p) =>
      p.milestones.forEach((m) => {
        const d = new Date(m.date + "T00:00:00");
        if (!isNaN(d.getTime())) dates.push(d);
      })
    );
    return dates;
  }, [projectsWithMilestones]);

  const availableYears = useMemo(() => {
    const s = new Set<number>();
    allDates.forEach((d) => s.add(d.getFullYear()));
    return Array.from(s).sort((a, b) => a - b);
  }, [allDates]);

  const currentYear = new Date().getFullYear();
  const defaultYear = availableYears.includes(currentYear)
    ? currentYear
    : availableYears[availableYears.length - 1] ?? currentYear;

  const [selectedYear, setSelectedYear] = useState<number | "all">(defaultYear);

  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const hide = () => setTooltip(null);
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, []);

  // Compute window
  const { windowStart, windowEnd, months } = useMemo(() => {
    const y = typeof selectedYear === "number" ? selectedYear : null;
    const relevant = allDates.filter((d) => y === null || d.getFullYear() === y);
    if (relevant.length === 0) {
      const yr = y ?? currentYear;
      const ws = new Date(yr, 0, 1);
      return { windowStart: ws, windowEnd: new Date(yr, 11, 1), months: getMonthRange(ws, new Date(yr, 11, 1)) };
    }
    const minDate = relevant.reduce((a, b) => (a < b ? a : b));
    const maxDate = relevant.reduce((a, b) => (a > b ? a : b));
    const ws = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
    const we = new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
    // Pad one month each side when possible
    ws.setMonth(ws.getMonth() - 1);
    we.setMonth(we.getMonth() + 1);
    return { windowStart: ws, windowEnd: we, months: getMonthRange(ws, we) };
  }, [selectedYear, allDates, currentYear]);

  // Year groups for header
  const yearGroups = useMemo(() => {
    const groups: { year: number; count: number }[] = [];
    months.forEach((m) => {
      const y = m.getFullYear();
      const last = groups[groups.length - 1];
      if (!last || last.year !== y) groups.push({ year: y, count: 1 });
      else last.count++;
    });
    return groups;
  }, [months]);

  const timelineWidth = months.length * CELL_W;

  const todayPos = useMemo(() => {
    const now = new Date();
    const nowMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    if (nowMonth < windowStart || nowMonth > windowEnd) return null;
    const idx = monthDiff(windowStart, nowMonth);
    return idx * CELL_W + ((now.getDate() - 1) / 30) * CELL_W;
  }, [windowStart, windowEnd]);

  // Filter rows
  const rows = useMemo(() => {
    return projectsWithMilestones
      .map((p) => {
        const filtered = p.milestones.filter((m) => {
          const d = new Date(m.date + "T00:00:00");
          if (isNaN(d.getTime())) return false;
          if (selectedYear === "all") return true;
          return d.getFullYear() === selectedYear;
        });
        return { project: p, milestones: filtered };
      })
      .filter((r) => r.milestones.length > 0);
  }, [projectsWithMilestones, selectedYear]);

  const totalMilestones = rows.reduce((s, r) => s + r.milestones.length, 0);

  if (projectsWithMilestones.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-400">
        No milestones found. Add milestones to projects to see them here.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-zinc-600">Year:</span>
          <div className="flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 gap-0.5">
            <button
              onClick={() => setSelectedYear("all")}
              className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-all ${selectedYear === "all" ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"}`}
            >All</button>
            {availableYears.map((y) => (
              <button key={y} onClick={() => setSelectedYear(y)}
                className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-all ${selectedYear === y ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"}`}
              >{y}</button>
            ))}
          </div>
        </div>
        <span className="text-xs text-zinc-400">{totalMilestones} milestone{totalMilestones !== 1 ? "s" : ""} across {rows.length} project{rows.length !== 1 ? "s" : ""}</span>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
          No milestones in {selectedYear}.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div style={{ minWidth: NAME_COL + timelineWidth }}>
            {/* Header */}
            <div className="grid border-b border-zinc-200 bg-zinc-50" style={{ gridTemplateColumns: `${NAME_COL}px ${timelineWidth}px` }}>
              <div className="border-r border-zinc-200 flex items-center px-4 py-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-700">Project</span>
              </div>
              <div>
                {/* Year row */}
                <div className="grid border-b border-zinc-200"
                  style={{ gridTemplateColumns: yearGroups.map((g) => `${g.count * CELL_W}px`).join(" ") }}>
                  {yearGroups.map((g) => (
                    <div key={g.year} className="border-r border-zinc-200 px-2 py-1.5 text-center text-xs font-bold text-zinc-700">{g.year}</div>
                  ))}
                </div>
                {/* Month row */}
                <div className="grid" style={{ gridTemplateColumns: `repeat(${months.length}, ${CELL_W}px)` }}>
                  {months.map((month) => {
                    const isCur = month.getFullYear() === new Date().getFullYear() && month.getMonth() === new Date().getMonth();
                    return (
                      <div key={`${month.getFullYear()}-${month.getMonth()}`}
                        className={`border-r border-zinc-200 px-1 py-1.5 text-center text-[11px] font-medium ${isCur ? "bg-blue-50 text-blue-700 font-semibold" : "text-zinc-500"}`}>
                        {month.toLocaleDateString(undefined, { month: "short" })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Rows */}
            {rows.map(({ project, milestones: pMilestones }) => (
              <div key={project.id} className="grid border-b border-zinc-100 hover:bg-zinc-50 transition-colors"
                style={{ gridTemplateColumns: `${NAME_COL}px ${timelineWidth}px`, minHeight: ROW_HEIGHT }}>
                {/* Project name */}
                <div className="border-r border-zinc-200 px-4 py-3 flex flex-col justify-center">
                  <span className="text-sm font-medium text-zinc-900 truncate">{project.name}</span>
                  {project.project_code && <span className="text-[11px] text-zinc-400">{project.project_code}</span>}
                </div>

                {/* Timeline */}
                <div className="relative" style={{ minHeight: ROW_HEIGHT }}>
                  {/* Grid lines */}
                  <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${months.length}, ${CELL_W}px)` }}>
                    {months.map((month) => (
                      <div key={`${project.id}-${month.getFullYear()}-${month.getMonth()}`}
                        className={`border-r ${month.getMonth() === 0 ? "border-zinc-300" : "border-zinc-100"}`} />
                    ))}
                  </div>

                  {/* Today marker */}
                  {todayPos !== null && (
                    <div className="absolute top-0 bottom-0 w-px bg-red-400 z-10" style={{ left: todayPos }} />
                  )}

                  {/* Milestone diamonds */}
                  {pMilestones.map((m) => {
                    const mDate = new Date(m.date + "T00:00:00");
                    if (isNaN(mDate.getTime())) return null;
                    const mMonth = new Date(mDate.getFullYear(), mDate.getMonth(), 1);
                    if (mMonth < windowStart || mMonth > windowEnd) return null;
                    const idx = monthDiff(windowStart, mMonth);
                    const dayProg = (mDate.getDate() - 1) / 30;
                    const left = idx * CELL_W + dayProg * CELL_W;

                    return (
                      <div key={m.id} className="absolute z-20" style={{ left, top: "50%", transform: "translate(-50%, -50%)" }}>
                        {/* Diamond shape via rotate-45 square */}
                        <div
                          className="w-4 h-4 bg-violet-600 cursor-pointer hover:bg-violet-700 transition-colors"
                          style={{ transform: "rotate(45deg)", boxShadow: "0 1px 4px rgba(0,0,0,0.2)" }}
                          onMouseEnter={(e) => setTooltip({ milestone: m, projectName: project.name, x: e.clientX, y: e.clientY })}
                          onMouseMove={(e) => setTooltip((prev) => prev ? { ...prev, x: e.clientX, y: e.clientY } : null)}
                          onMouseLeave={() => setTooltip(null)}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-zinc-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-violet-600" style={{ transform: "rotate(45deg)" }} />
          Milestone
        </div>
        <div className="flex items-center gap-1.5">
          <div className="h-px w-4 bg-red-400" />
          Today
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div ref={tooltipRef} className="pointer-events-none fixed z-50 w-max max-w-[240px]"
          style={{ left: tooltip.x, top: tooltip.y - 8, transform: "translate(-50%, -100%)" }}>
          <div className="rounded-lg bg-zinc-900 px-3 py-2.5 shadow-xl ring-1 ring-white/10 space-y-1">
            <p className="text-[11px] font-semibold text-white">{tooltip.milestone.name}</p>
            <p className="text-[10px] text-zinc-400">{tooltip.projectName}</p>
            <p className="text-[10px] text-zinc-300">{tooltip.milestone.date}</p>
            {tooltip.milestone.description && (
              <p className="text-[10px] text-zinc-400 italic">{tooltip.milestone.description}</p>
            )}
            {tooltip.milestone.resources.length > 0 && (
              <div className="pt-1 border-t border-zinc-700">
                <p className="text-[9px] text-zinc-400 uppercase tracking-wide mb-0.5">Resources</p>
                {tooltip.milestone.resources.map((r) => (
                  <p key={r.id} className="text-[10px] text-zinc-300">{r.name}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
