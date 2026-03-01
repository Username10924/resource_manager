"use client";

import { useMemo, useState, useEffect } from "react";

type EmployeeEntry = {
  id: number;
  full_name: string;
  position?: string;
  department?: string;
};

type BookingEntry = {
  id: number;
  employee_id: number;
  project_id: number;
  project_name?: string;
  project_code?: string;
  start_date: string;
  end_date: string;
  status?: string;
  role?: string | null;
  booked_hours?: number;
};

type ReservationEntry = {
  id: number;
  employee_id: number;
  start_date: string;
  end_date: string;
  reason?: string | null;
  status?: string;
  reserved_hours_per_day?: number;
};

type LaneItem = {
  kind: "booking" | "reservation";
  id: number;
  project_id?: number;
  project_name?: string;
  project_code?: string;
  role?: string | null;
  booked_hours?: number;
  reason?: string | null;
  reserved_hours_per_day?: number;
  status?: string;
  start: Date;
  end: Date;
};

type EmployeeRow = {
  employee: EmployeeEntry;
  lanes: LaneItem[];
};

const CELL_WIDTH = 52;
const NAME_COL_WIDTH = 240;
const LANE_HEIGHT = 36;
const BAR_HEIGHT = 24;

const PROJECT_COLORS = [
  "#2563eb", // blue
  "#059669", // emerald
  "#7c3aed", // violet
  "#0891b2", // cyan
  "#be185d", // pink
  "#65a30d", // lime
  "#9333ea", // purple
  "#ea580c", // orange
  "#0369a1", // sky
  "#15803d", // green
];

const RESERVATION_COLOR = "#94a3b8";

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

export default function EmployeeRoadmapGantt({
  employees,
  bookings = [],
  reservations = [],
}: {
  employees: EmployeeEntry[];
  bookings?: BookingEntry[];
  reservations?: ReservationEntry[];
}) {
  // Assign stable colors to project IDs
  const projectColorMap = useMemo(() => {
    const map: Record<number, string> = {};
    const projectIds = [...new Set(bookings.map((b) => b.project_id))].sort((a, b) => a - b);
    projectIds.forEach((id, i) => {
      map[id] = PROJECT_COLORS[i % PROJECT_COLORS.length];
    });
    return map;
  }, [bookings]);

  // Build employee rows with lanes (one lane per booking/reservation)
  const allEmployeeRows = useMemo(() => {
    const rows: EmployeeRow[] = [];

    for (const emp of employees) {
      const empBookings = bookings
        .filter((b) => b.employee_id === emp.id && (b.status || "").toLowerCase() !== "cancelled")
        .map((b) => {
          const start = toMonthStart(b.start_date);
          const end = toMonthStart(b.end_date);
          if (!start || !end) return null;
          return {
            kind: "booking" as const,
            id: b.id,
            project_id: b.project_id,
            project_name: b.project_name,
            project_code: b.project_code,
            role: b.role,
            booked_hours: b.booked_hours,
            status: b.status,
            start: start <= end ? start : end,
            end: start <= end ? end : start,
          } as LaneItem;
        })
        .filter(Boolean) as LaneItem[];

      const empReservations = reservations
        .filter((r) => r.employee_id === emp.id && (r.status || "").toLowerCase() !== "cancelled")
        .map((r) => {
          const start = toMonthStart(r.start_date);
          const end = toMonthStart(r.end_date);
          if (!start || !end) return null;
          return {
            kind: "reservation" as const,
            id: r.id,
            reason: r.reason,
            reserved_hours_per_day: r.reserved_hours_per_day,
            status: r.status,
            start: start <= end ? start : end,
            end: start <= end ? end : start,
          } as LaneItem;
        })
        .filter(Boolean) as LaneItem[];

      const lanes = [...empBookings, ...empReservations].sort(
        (a, b) => a.start.getTime() - b.start.getTime()
      );

      // Include all employees — those without assignments show an empty row
      rows.push({ employee: emp, lanes });
    }

    return rows;
  }, [employees, bookings, reservations]);

  // Get sorted unique years from lane start dates
  const availableYears = useMemo(() => {
    const yearSet = new Set<number>();
    allEmployeeRows.forEach((row) => {
      row.lanes.forEach((lane) => yearSet.add(lane.start.getFullYear()));
    });
    return Array.from(yearSet).sort((a, b) => a - b);
  }, [allEmployeeRows]);

  const currentYear = new Date().getFullYear();
  const defaultYear: number | "all" | "remaining" = availableYears.includes(currentYear)
    ? currentYear
    : availableYears[availableYears.length - 1] ?? currentYear;

  const [selectedYear, setSelectedYear] = useState<number | "all" | "remaining">(defaultYear);

  const currentMonthStart = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  }, []);

  // Filter lanes based on selected year (always keep all employees)
  const filteredRows = useMemo(() => {
    if (selectedYear === "all") return allEmployeeRows;

    if (selectedYear === "remaining") {
      return allEmployeeRows.map((row) => ({
        ...row,
        lanes: row.lanes.filter((lane) => lane.end >= currentMonthStart),
      }));
    }

    return allEmployeeRows.map((row) => ({
      ...row,
      lanes: row.lanes.filter((lane) => lane.start.getFullYear() === selectedYear),
    }));
  }, [allEmployeeRows, selectedYear, currentMonthStart]);

  // Compute timeline window
  const { windowStart, windowEnd, months } = useMemo(() => {
    if (filteredRows.length === 0) {
      const y = typeof selectedYear === "number" ? selectedYear : new Date().getFullYear();
      const wStart = new Date(y, 0, 1);
      return { windowStart: wStart, windowEnd: new Date(y, 11, 1), months: getMonthRange(wStart, new Date(y, 11, 1)) };
    }

    const allLanes = filteredRows.flatMap((r) => r.lanes);
    let wStart: Date;
    let wEnd: Date;

    if (selectedYear === "all") {
      const minYear = Math.min(...allLanes.map((l) => l.start.getFullYear()));
      const maxYear = Math.max(...allLanes.map((l) => l.end.getFullYear()));
      wStart = new Date(minYear, 0, 1);
      wEnd = new Date(maxYear, 11, 1);
    } else if (selectedYear === "remaining") {
      wStart = new Date(currentMonthStart);
      wEnd = new Date(currentMonthStart);
      allLanes.forEach((l) => {
        if (l.end > wEnd) wEnd = new Date(l.end.getFullYear(), l.end.getMonth(), 1);
      });
    } else {
      wStart = new Date(selectedYear, 0, 1);
      wEnd = new Date(selectedYear, 11, 1);
      allLanes.forEach((l) => {
        if (l.end > wEnd) wEnd = new Date(l.end.getFullYear(), l.end.getMonth(), 1);
      });
    }

    return { windowStart: wStart, windowEnd: wEnd, months: getMonthRange(wStart, wEnd) };
  }, [filteredRows, selectedYear, currentMonthStart]);

  // Group months by year for the header
  const yearGroups = useMemo(() => {
    const groups: { year: number; months: Date[] }[] = [];
    let currentGroup: { year: number; months: Date[] } | null = null;
    months.forEach((month) => {
      const year = month.getFullYear();
      if (!currentGroup || currentGroup.year !== year) {
        currentGroup = { year, months: [] };
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

  // Tooltip state
  const [tooltip, setTooltip] = useState<{
    lane: LaneItem;
    x: number;
    y: number;
  } | null>(null);

  useEffect(() => {
    const hide = () => setTooltip(null);
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, []);

  function renderLaneBar(lane: LaneItem) {
    const clippedStart = lane.start < windowStart ? windowStart : lane.start;
    const clippedEnd = lane.end > windowEnd ? windowEnd : lane.end;

    if (clippedStart > windowEnd || clippedEnd < windowStart) return null;

    const startIndex = Math.max(0, monthDiff(windowStart, clippedStart));
    const span = Math.max(1, monthDiff(clippedStart, clippedEnd) + 1);

    const barLeft = startIndex * CELL_WIDTH + 2;
    const barWidth = span * CELL_WIDTH - 4;

    const barColor =
      lane.kind === "reservation"
        ? RESERVATION_COLOR
        : projectColorMap[lane.project_id!] ?? PROJECT_COLORS[0];

    const label =
      lane.kind === "booking"
        ? lane.project_name || `Project ${lane.project_id}`
        : lane.reason || "Reserved";

    return (
      <div
        key={`${lane.kind}-${lane.id}`}
        className="relative"
        style={{ height: LANE_HEIGHT }}
      >
        {/* Month grid lines */}
        <div
          className="absolute inset-0 grid"
          style={{ gridTemplateColumns: `repeat(${months.length}, ${CELL_WIDTH}px)` }}
        >
          {months.map((month) => (
            <div
              key={`${month.getFullYear()}-${month.getMonth()}`}
              className={`border-r ${month.getMonth() === 0 ? "border-zinc-300" : "border-zinc-100"}`}
            />
          ))}
        </div>

        {/* Bar */}
        <div
          className="absolute rounded-md cursor-pointer flex items-center px-2 overflow-hidden"
          style={{
            left: barLeft,
            width: barWidth,
            top: (LANE_HEIGHT - BAR_HEIGHT) / 2,
            height: BAR_HEIGHT,
            backgroundColor: barColor,
          }}
          onMouseEnter={(e) => setTooltip({ lane, x: e.clientX, y: e.clientY })}
          onMouseMove={(e) =>
            setTooltip((prev) => (prev ? { ...prev, x: e.clientX, y: e.clientY } : null))
          }
          onMouseLeave={() => setTooltip(null)}
        >
          {barWidth >= 40 && (
            <span
              className="truncate text-[10px] font-semibold text-white leading-none"
              style={{ textShadow: "0 1px 2px rgba(0,0,0,0.35)" }}
            >
              {label}
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Year selector */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-zinc-600">Year:</span>
        <div className="flex flex-wrap rounded-lg border border-zinc-200 bg-zinc-50 p-0.5 gap-0.5">
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
          <button
            onClick={() => setSelectedYear("remaining")}
            className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-all ${
              selectedYear === "remaining"
                ? "bg-zinc-800 text-white shadow-sm"
                : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
            }`}
          >
            Remaining
          </button>
          {availableYears.map((year) => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-all ${
                selectedYear === year
                  ? "bg-zinc-800 text-white shadow-sm"
                  : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
              }`}
            >
              {year}
            </button>
          ))}
        </div>
        <span className="ml-1 text-xs text-zinc-400">
          {filteredRows.length} employee{filteredRows.length !== 1 ? "s" : ""} &middot;{" "}
          {filteredRows.reduce((n, r) => n + r.lanes.length, 0)} assignment
          {filteredRows.reduce((n, r) => n + r.lanes.length, 0) !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1.5 text-xs text-zinc-600">
          <div className="h-2.5 w-6 rounded-sm bg-blue-600" />
          Project Booking
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-600">
          <div className="h-2.5 w-6 rounded-sm bg-slate-400" />
          Reservation
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-400 ml-2">
          <div className="h-px w-4 bg-red-400" />
          Today
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center">
          <div className="text-sm text-zinc-500">No employees found</div>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div style={{ minWidth: NAME_COL_WIDTH + timelineWidth }}>
            {/* Header */}
            <div
              className="grid border-b border-zinc-200 bg-zinc-50"
              style={{ gridTemplateColumns: `${NAME_COL_WIDTH}px ${timelineWidth}px` }}
            >
              <div className="border-r border-zinc-200 flex items-center px-4 py-3">
                <span className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">
                  Employee
                </span>
              </div>
              <div>
                {/* Year row */}
                <div
                  className="grid border-b border-zinc-200"
                  style={{
                    gridTemplateColumns: yearGroups
                      .map((g) => `${g.months.length * CELL_WIDTH}px`)
                      .join(" "),
                  }}
                >
                  {yearGroups.map((group) => (
                    <div
                      key={group.year}
                      className="border-r border-zinc-200 px-2 py-2 text-center text-xs font-bold text-zinc-700"
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
                          isCurrentMonth
                            ? "bg-blue-50 text-blue-700 font-semibold"
                            : "text-zinc-500"
                        }`}
                      >
                        {month.toLocaleDateString(undefined, { month: "short" })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Employee rows */}
            {filteredRows.map(({ employee, lanes }) => (
              <div
                key={employee.id}
                className="grid border-b border-zinc-100 hover:bg-zinc-50 transition-colors"
                style={{ gridTemplateColumns: `${NAME_COL_WIDTH}px ${timelineWidth}px` }}
              >
                {/* Employee name column */}
                <div className="border-r border-zinc-200 px-4 py-2 flex flex-col justify-center">
                  <div className="text-sm font-medium text-zinc-900 truncate">
                    {employee.full_name}
                  </div>
                  <div className="text-[11px] text-zinc-400 truncate">
                    {[employee.position, employee.department].filter(Boolean).join(" • ")}
                  </div>
                </div>

                {/* Timeline column */}
                <div className="relative">
                  {/* Today marker spanning all lanes */}
                  {todayPosition !== null && (
                    <div
                      className="absolute top-0 bottom-0 w-px bg-red-400 z-10 pointer-events-none"
                      style={{ left: todayPosition }}
                    />
                  )}
                  {/* Lane bars */}
                  {lanes.map((lane) => renderLaneBar(lane))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Hover tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none fixed z-50 w-max max-w-[240px]"
          style={{
            left: tooltip.x,
            top: tooltip.y - 8,
            transform: "translate(-50%, -100%)",
          }}
        >
          <div className="rounded-lg bg-zinc-900 px-3 py-2.5 shadow-xl ring-1 ring-white/10">
            {tooltip.lane.kind === "booking" ? (
              <>
                <p className="truncate text-[11px] font-semibold text-white leading-tight">
                  {tooltip.lane.project_name || `Project ${tooltip.lane.project_id}`}
                </p>
                {tooltip.lane.project_code && (
                  <p className="text-[10px] text-zinc-400">{tooltip.lane.project_code}</p>
                )}
                <div className="my-1.5 h-px bg-zinc-700" />
                <div className="space-y-0.5">
                  <p className="text-[10px] text-zinc-300">
                    {tooltip.lane.start.toLocaleDateString(undefined, {
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    &mdash;{" "}
                    {tooltip.lane.end.toLocaleDateString(undefined, {
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                  {tooltip.lane.role && (
                    <p className="text-[10px] text-zinc-400">Role: {tooltip.lane.role}</p>
                  )}
                  {tooltip.lane.booked_hours !== undefined && (
                    <p className="text-[10px] text-zinc-400">
                      Hours: {tooltip.lane.booked_hours}h
                    </p>
                  )}
                </div>
              </>
            ) : (
              <>
                <p className="truncate text-[11px] font-semibold text-white leading-tight">
                  {tooltip.lane.reason || "Reservation"}
                </p>
                <div className="my-1.5 h-px bg-zinc-700" />
                <div className="space-y-0.5">
                  <p className="text-[10px] text-zinc-300">
                    {tooltip.lane.start.toLocaleDateString(undefined, {
                      month: "short",
                      year: "numeric",
                    })}{" "}
                    &mdash;{" "}
                    {tooltip.lane.end.toLocaleDateString(undefined, {
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                  {tooltip.lane.reserved_hours_per_day !== undefined && (
                    <p className="text-[10px] text-zinc-400">
                      {tooltip.lane.reserved_hours_per_day}h/day reserved
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
