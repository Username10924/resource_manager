'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import Button from '@/components/Button';
import Input from '@/components/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { SkeletonProjectsPage, Skeleton } from '@/components/Skeleton';
import { VisualScheduleTimeline } from '@/components/VisualScheduleTimeline';
import type { VisualScheduleItem } from '@/components/VisualScheduleTimeline';
import TimelineDateRangePicker from '@/components/TimelineDateRangePicker';
import { dashboardAPI, employeeAPI, projectAPI, settingsAPI, type Employee, type Project, type Settings } from '@/lib/api';

export default function ProjectBookingPage() {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const projectId = Number(params.projectId);

  const [project, setProject] = useState<Project | null>(null);
  const projectStartDate = project?.start_date || null;
  const projectEndDate = project?.end_date || null;
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const [employeeAvailability, setEmployeeAvailability] = useState<any>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [timelineItems, setTimelineItems] = useState<VisualScheduleItem[]>([]);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());

  const [searchFilter, setSearchFilter] = useState('');
  const [settings, setSettings] = useState<Settings>({ work_hours_per_day: 6, work_days_per_month: 20, months_in_year: 12 });

  const getDefaultDates = () => {
    const today = new Date();
    const oneMonthLater = new Date(today);
    oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);
    return {
      startDate: formatISODateLocal(today),
      endDate: formatISODateLocal(oneMonthLater),
    };
  };

  const [bookingData, setBookingData] = useState({
    hoursPerDay: '' as any,
    ...getDefaultDates(),
  });

  const [range, setRange] = useState(() => ({
    start: getDefaultDates().startDate,
    end: getDefaultDates().endDate,
  }));

  const timelineWindow = useMemo(() => {
    return { start: `${viewYear}-01-01`, end: `${viewYear}-12-31` };
  }, [viewYear]);

  useEffect(() => {
    // When switching years, anchor selection to today (clamped into the selected year).
    const yearStart = `${viewYear}-01-01`;
    const yearEnd = `${viewYear}-12-31`;
    const todayIso = formatISODateLocal(new Date());
    const start = todayIso < yearStart ? yearStart : todayIso > yearEnd ? yearEnd : todayIso;
    const bounded = clampRangeToBounds(start, start, projectStartDate, projectEndDate);
    setRange(bounded);
    setBookingData((p) => ({ ...p, startDate: bounded.start, endDate: bounded.end }));
  }, [viewYear, projectStartDate, projectEndDate]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!Number.isFinite(projectId)) {
      router.push('/projects');
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const [proj, emps, fetchedSettings] = await Promise.all([projectAPI.getById(projectId), employeeAPI.getAll(), settingsAPI.getSettings()]);
        setSettings(fetchedSettings);
        setProject(proj);
        setEmployees(Array.isArray(emps) ? emps : []);
        const defaults = getDefaultDatesWithinBounds(proj.start_date || null, proj.end_date || null);
        setRange({ start: defaults.startDate, end: defaults.endDate });
        setBookingData((prev) => ({ ...prev, startDate: defaults.startDate, endDate: defaults.endDate }));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [projectId, router]);

  useEffect(() => {
    // Keep visible range in sync when booking dates are updated (commit).
    setRange({ start: bookingData.startDate, end: bookingData.endDate });
  }, [bookingData.startDate, bookingData.endDate]);

  useEffect(() => {
    const loadEmployeeAvailability = async () => {
      if (!selectedEmployee || !bookingData.startDate || !bookingData.endDate) return;

      setLoadingAvailability(true);
      try {
        const data = await employeeAPI.getAvailabilityForDateRange(
          selectedEmployee.id,
          bookingData.startDate,
          bookingData.endDate
        );
        setEmployeeAvailability(data);
      } catch (e) {
        console.error(e);
        setEmployeeAvailability(null);
      } finally {
        setLoadingAvailability(false);
      }
    };

    loadEmployeeAvailability();
  }, [selectedEmployee, bookingData.startDate, bookingData.endDate]);

  useEffect(() => {
    const loadTimeline = async () => {
      if (!selectedEmployee) return;

      try {
        const yearStart = `${viewYear}-01-01`;
        const yearEnd = `${viewYear}-12-31`;

        const [yearAvailability, allReservations] = await Promise.all([
          employeeAPI.getAvailabilityForDateRange(selectedEmployee.id, yearStart, yearEnd),
          employeeAPI.getReservations(selectedEmployee.id, true),
        ]);

        const bookings = Array.isArray(yearAvailability?.bookings) ? yearAvailability.bookings : [];
        const reservations = Array.isArray(allReservations) ? allReservations : [];

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
      } catch (e) {
        console.error(e);
        setTimelineItems([]);
      }
    };

    loadTimeline();
  }, [selectedEmployee, viewYear]);

  const calculateWorkingDays = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return 0;

    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');

    if (end < start) return 0;

    let workingDays = 0;
    const current = new Date(start);

    while (current <= end) {
      const dayOfWeek = current.getDay();
      // Weekend: Friday (5) and Saturday (6). Sunday is a workday.
      if (dayOfWeek !== 5 && dayOfWeek !== 6) workingDays++;
      current.setDate(current.getDate() + 1);
    }

    return workingDays;
  };

  const workingDays = calculateWorkingDays(range.start, range.end);
  const totalHours = workingDays * (bookingData.hoursPerDay || 0);

  const maxHoursFromAvailability = employeeAvailability?.availability?.available_hours ?? null;
  const totalMaxHours = workingDays * settings.work_hours_per_day;
  const maxHours =
    maxHoursFromAvailability !== null ? Math.min(totalMaxHours, maxHoursFromAvailability) : totalMaxHours;

  const utilizedHours = employeeAvailability?.availability?.total_utilized_hours ?? 0;
  const bookedHours = employeeAvailability?.availability?.total_booked_hours ?? 0;
  const reservedHours = employeeAvailability?.availability?.total_reserved_hours ?? 0;

  const handleBooking = async () => {
    if (!project) return;

    if (!selectedEmployee) {
      alert('Please select an employee');
      return;
    }

    if (!bookingData.startDate || !bookingData.endDate) {
      alert('Please select both start and end dates');
      return;
    }

    if (bookingData.hoursPerDay <= 0) {
      alert('Please enter valid hours per day (greater than 0)');
      return;
    }

    if (new Date(bookingData.endDate) < new Date(bookingData.startDate)) {
      alert('End date must be after or equal to start date');
      return;
    }

    if (projectStartDate && bookingData.startDate < projectStartDate) {
      alert(`Booking start date cannot be before project start date (${formatDisplayDate(projectStartDate)})`);
      return;
    }

    if (projectEndDate && bookingData.endDate > projectEndDate) {
      alert(`Booking end date cannot be after project end date (${formatDisplayDate(projectEndDate)})`);
      return;
    }

    if (totalHours > maxHours) {
      if (utilizedHours > 0) {
        alert(
          `Cannot book ${totalHours} hours (${bookingData.hoursPerDay} hrs/day × ${workingDays} days). Employee only has ${maxHours} hours available in this period.\n\nAlready utilized: ${utilizedHours} hours (${bookedHours} booked + ${reservedHours} reserved)\nMaximum capacity: ${totalMaxHours} hours (${workingDays} working days × ${settings.work_hours_per_day} hrs/day)`
        );
      } else {
        alert(
          `Cannot book ${totalHours} hours (${bookingData.hoursPerDay} hrs/day × ${workingDays} days). Maximum ${maxHours} hours for ${workingDays} working days (${settings.work_hours_per_day}hrs/day).`
        );
      }
      return;
    }

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

      await projectAPI.createBooking(project.id, bookingPayload);
      router.push('/projects');
    } catch (e: any) {
      console.error(e);
      alert(e?.message || 'Failed to create booking. Please try again.');
    }
  };

  const contextMenuItems = useMemo(() => {
    const hasEmployee = Boolean(selectedEmployee);
    const hasHoursPerDay = typeof bookingData.hoursPerDay === 'number' && bookingData.hoursPerDay > 0;

    return [
      {
        id: 'create-booking',
        label: 'Create booking for selected range',
        disabled: !hasEmployee || !hasHoursPerDay || workingDays <= 0 || totalHours > maxHours || maxHours <= 0,
        onSelect: handleBooking,
      },
      {
        id: 'clear',
        label: 'Clear selection',
        onSelect: () => setBookingData((p) => ({ ...p, startDate: p.startDate, endDate: p.startDate })),
      },
    ];
  }, [handleBooking, bookingData.hoursPerDay, maxHours, selectedEmployee, totalHours, workingDays]);

  if (loading) return <SkeletonProjectsPage />;

  if (!project) {
    return (
      <div className="space-y-4">
        <div className="text-sm text-zinc-600">Project not found.</div>
        <Button onClick={() => router.push('/projects')}>Back</Button>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-6rem)] min-h-[650px] flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Book Resources</h1>
          <p className="mt-1 text-xs text-zinc-500">{project.name} · Drag to select, right-click for actions</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Button variant="secondary" onClick={() => setViewYear((y) => y - 1)}>
              ‹
            </Button>
            <select
              value={viewYear}
              onChange={(e) => setViewYear(parseInt(e.target.value, 10))}
              className="h-10 px-3 text-sm bg-white border border-zinc-200 rounded-md shadow-sm focus:outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 transition-all duration-200"
            >
              {Array.from({ length: 7 }).map((_, idx) => {
                const year = new Date().getFullYear() - 3 + idx;
                return (
                  <option key={year} value={year}>
                    {year}
                  </option>
                );
              })}
            </select>
            <Button variant="secondary" onClick={() => setViewYear((y) => y + 1)}>
              ›
            </Button>
          </div>
          <Button
            variant="secondary"
            onClick={() => {
              setRange((r) => ({ start: r.start, end: r.start }));
              setBookingData((p) => ({ ...p, endDate: p.startDate }));
            }}
          >
            Clear Selection
          </Button>
          <Button onClick={handleBooking}>
            Create Booking
          </Button>
          <Button variant="secondary" onClick={() => router.push('/projects')}>Back</Button>
        </div>
      </div>

      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Project Timeline</span>
          <span className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm font-medium text-zinc-600">
            Start: {formatDisplayDate(projectStartDate)}
          </span>
          <span className="inline-flex items-center rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm font-medium text-zinc-600">
            End: {formatDisplayDate(projectEndDate)}
          </span>
        </div>
        <p className="mt-2 text-xs text-zinc-500">Bookings are only allowed within this project date range.</p>
      </div>

      <div className="rounded-md border border-zinc-200 bg-white p-3">
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-zinc-600 mb-1">Team Member</label>
            <select
              value={selectedEmployee?.id ?? ''}
              onChange={(e) => {
                const id = Number(e.target.value);
                const next = employees.find((emp) => emp.id === id) || null;
                setSelectedEmployee(next);
              }}
              className="w-full px-3 py-2 text-sm bg-white border border-zinc-200 rounded-md shadow-sm focus:outline-none focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200 transition-all duration-200"
            >
              <option value="" disabled>
                Select an employee
              </option>
              {employees
                .slice()
                .sort((a, b) => a.full_name.localeCompare(b.full_name))
                .map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.full_name} — {emp.department}
                  </option>
                ))}
            </select>
            <div className="mt-2 text-xs text-zinc-500 whitespace-nowrap overflow-hidden text-ellipsis font-mono tabular-nums">
              Selected: {range.start} → {range.end}
            </div>
            <TimelineDateRangePicker
              startDate={range.start}
              endDate={range.end}
              viewYear={viewYear}
              onChange={(start, end) => {
                const normalizedStart = start <= end ? start : end;
                const normalizedEnd = start <= end ? end : start;
                const bounded = clampRangeToBounds(normalizedStart, normalizedEnd, projectStartDate, projectEndDate);
                setRange(bounded);
                setBookingData((prev) => ({ ...prev, startDate: bounded.start, endDate: bounded.end }));
              }}
            />
          </div>

          <Input
            type="number"
            label="Hours per Day"
            value={bookingData.hoursPerDay}
            onChange={(e) => setBookingData({ ...bookingData, hoursPerDay: parseFloat(e.target.value) || 0 })}
            min="0"
            max={settings.work_hours_per_day.toString()}
            step="0.5"
            placeholder={`e.g., ${settings.work_hours_per_day}`}
          />

          <div className="rounded-md bg-zinc-50 border border-zinc-200 p-3">
            <div className="text-xs text-zinc-600 font-mono tabular-nums whitespace-nowrap">
              Working days: <span className="font-semibold">{workingDays}</span>
            </div>
            <div className="text-xs text-zinc-600 mt-1 font-mono tabular-nums whitespace-nowrap">
              Total hours: <span className="font-semibold">{totalHours.toFixed(1)}h</span>
            </div>
            <div className={`text-xs mt-1 font-mono tabular-nums whitespace-nowrap ${totalHours > maxHours ? 'text-red-700' : 'text-zinc-600'}`}>
              Available to book: <span className="font-semibold">{maxHours}h</span>
            </div>
            <div className="text-xs text-zinc-500 mt-2 h-4">
              {loadingAvailability ? 'Checking availability...' : <span className="invisible">Checking availability...</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 min-h-0">
        {!selectedEmployee ? (
          <div className="h-full rounded-md border border-zinc-200 bg-zinc-50 flex items-center justify-center">
            <div className="text-sm text-zinc-600">Select a team member to view the schedule</div>
          </div>
        ) : (
          <div className="h-full">
            <VisualScheduleTimeline
              windowStart={timelineWindow.start}
              windowEnd={timelineWindow.end}
              selectionStart={range.start}
              selectionEnd={range.end}
              onSelectionPreview={(start, end) => {
                const bounded = clampRangeToBounds(start, end, projectStartDate, projectEndDate);
                setRange(bounded);
              }}
              onSelectionChange={(start, end) => {
                const bounded = clampRangeToBounds(start, end, projectStartDate, projectEndDate);
                setRange(bounded);
                setBookingData({ ...bookingData, startDate: bounded.start, endDate: bounded.end });
              }}
              commitSelectionOnMouseUp
              rowLabel={selectedEmployee.full_name}
              rowSublabel={`${selectedEmployee.position} • ${selectedEmployee.department}`}
              items={timelineItems}
              cellWidth={32}
              leftColumnWidth={200}
              minBodyHeight={200}
              contextMenuItems={contextMenuItems}
              wheelToHorizontal
            />
          </div>
        )}
      </div>
    </div>
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

function getDefaultDatesWithinBounds(minDate: string | null, maxDate: string | null): {
  startDate: string;
  endDate: string;
} {
  const today = new Date();
  const oneMonthLater = new Date(today);
  oneMonthLater.setMonth(oneMonthLater.getMonth() + 1);

  const defaultStart = formatISODateLocal(today);
  const defaultEnd = formatISODateLocal(oneMonthLater);
  const bounded = clampRangeToBounds(defaultStart, defaultEnd, minDate, maxDate);

  return { startDate: bounded.start, endDate: bounded.end };
}

function clampRangeToBounds(
  start: string,
  end: string,
  minDate: string | null,
  maxDate: string | null
): { start: string; end: string } {
  const boundedStart = clampDateToBounds(start, minDate, maxDate);
  const boundedEnd = clampDateToBounds(end, minDate, maxDate);

  if (boundedStart <= boundedEnd) {
    return { start: boundedStart, end: boundedEnd };
  }

  return { start: boundedEnd, end: boundedStart };
}

function clampDateToBounds(date: string, minDate: string | null, maxDate: string | null): string {
  if (minDate && date < minDate) return minDate;
  if (maxDate && date > maxDate) return maxDate;
  return date;
}

function formatDisplayDate(value: string | null): string {
  if (!value) return 'Not set';
  return new Date(value + 'T00:00:00').toLocaleDateString();
}
