'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

import Button from '@/components/Button';
import Input from '@/components/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { SkeletonModal } from '@/components/Skeleton';
import { VisualScheduleTimeline } from '@/components/VisualScheduleTimeline';
import type { VisualScheduleItem } from '@/components/VisualScheduleTimeline';
import TimelineDateRangePicker from '@/components/TimelineDateRangePicker';
import { dashboardAPI, employeeAPI, settingsAPI, type Employee, type Reservation, type Settings } from '@/lib/api';

export default function EmployeeSchedulePage() {
  const router = useRouter();
  const params = useParams<{ employeeId: string }>();
  const employeeId = Number(params.employeeId);

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [settings, setSettings] = useState<Settings>({ work_hours_per_day: 7, work_days_per_month: 18.333333333, months_in_year: 12 });

  const todayISO = useMemo(() => formatISODateLocal(new Date()), []);
  const nextMonthISO = useMemo(() => {
    const d = new Date();
    d.setMonth(d.getMonth() + 1);
    return formatISODateLocal(d);
  }, []);

  const [reservationForm, setReservationForm] = useState({
    start_date: todayISO,
    end_date: nextMonthISO,
    reserved_hours_per_day: '' as number | '',
    reason: '',
  });

  const [range, setRange] = useState(() => ({ start: todayISO, end: nextMonthISO }));
  const [selectionAvailability, setSelectionAvailability] = useState<any>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());

  const timelineWindow = useMemo(() => {
    return { start: `${viewYear}-01-01`, end: `${viewYear}-12-31` };
  }, [viewYear]);

  useEffect(() => {
    // Keep selection anchored to today (clamped into the visible year) when switching years.
    const yearStart = `${viewYear}-01-01`;
    const yearEnd = `${viewYear}-12-31`;
    const today = formatISODateLocal(new Date());
    const start = today < yearStart ? yearStart : today > yearEnd ? yearEnd : today;
    setReservationForm((p) => ({ ...p, start_date: start, end_date: start }));
  }, [viewYear]);

  useEffect(() => {
    if (!Number.isFinite(employeeId)) {
      toast.error('Invalid employee');
      router.push('/resources');
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const yearStart = `${viewYear}-01-01`;
        const yearEnd = `${viewYear}-12-31`;

        const [emp, allReservations, yearAvailability] = await Promise.all([
          employeeAPI.getById(employeeId),
          employeeAPI.getReservations(employeeId, true),
          employeeAPI.getAvailabilityForDateRange(employeeId, yearStart, yearEnd),
        ]);
        setEmployee(emp);
        setReservations(Array.isArray(allReservations) ? allReservations : []);
        setBookings(Array.isArray(yearAvailability?.bookings) ? yearAvailability.bookings : []);

        try {
          const fetched = await settingsAPI.getSettings();
          setSettings(fetched);
        } catch {
          // keep defaults
        }
      } catch (e) {
        console.error(e);
        toast.error('Failed to load schedule');
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [employeeId, router, viewYear]);

  useEffect(() => {
    // Keep visible range in sync when committed reservation dates update.
    setRange({ start: reservationForm.start_date, end: reservationForm.end_date });
  }, [reservationForm.start_date, reservationForm.end_date]);

  useEffect(() => {
    const loadAvailability = async () => {
      if (!Number.isFinite(employeeId)) return;
      if (!reservationForm.start_date || !reservationForm.end_date) return;

      setLoadingAvailability(true);
      try {
        const data = await employeeAPI.getAvailabilityForDateRange(
          employeeId,
          reservationForm.start_date,
          reservationForm.end_date
        );
        setSelectionAvailability(data);
      } catch (e) {
        console.error(e);
        setSelectionAvailability(null);
      } finally {
        setLoadingAvailability(false);
      }
    };

    loadAvailability();
  }, [employeeId, reservationForm.start_date, reservationForm.end_date]);

  const timelineItems: VisualScheduleItem[] = useMemo(
    () => [
      ...bookings.map((b: any) => ({
        id: b.id,
        kind: 'booking' as const,
        start_date: b.start_date,
        end_date: b.end_date,
        label: b.project_name || 'Booked',
        sublabel: b.project_code,
      })),
      ...reservations.map((r: any) => ({
        id: r.id,
        kind: 'reservation' as const,
        start_date: r.start_date,
        end_date: r.end_date,
        label: r.reason || 'Reserved',
        sublabel: r.status === 'active' ? `${r.reserved_hours_per_day}h/day` : r.status,
        status: r.status,
      })),
    ],
    [bookings, reservations]
  );

  const workingDays = selectionAvailability?.availability?.working_days ?? calculateWorkingDays(reservationForm.start_date, reservationForm.end_date);
  const maxHoursTotal = selectionAvailability?.availability?.max_hours_total ?? null;
  const utilizedHours = selectionAvailability?.availability?.total_utilized_hours ?? 0;
  const bookedHours = selectionAvailability?.availability?.total_booked_hours ?? 0;
  const reservedHours = selectionAvailability?.availability?.total_reserved_hours ?? 0;
  const availableHours = selectionAvailability?.availability?.available_hours ?? null;

  const requestedTotalHours = workingDays * (reservationForm.reserved_hours_per_day || 0);
  const remainingAfterRequest =
    availableHours !== null ? Math.max(0, availableHours - requestedTotalHours) : null;

  const handleCreateReservation = async () => {
    if (!employee) return;

    if (typeof reservationForm.reserved_hours_per_day !== 'number' || reservationForm.reserved_hours_per_day <= 0) {
      toast.error('Please enter reserved hours per day');
      return;
    }

    if (!reservationForm.start_date || !reservationForm.end_date) {
      toast.error('Please select both start and end dates');
      return;
    }

    if (new Date(reservationForm.end_date) < new Date(reservationForm.start_date)) {
      toast.error('End date must be after start date');
      return;
    }

    setSaving(true);
    try {
      await employeeAPI.createReservation(employee.id, reservationForm);
      toast.success('Reservation created');

      const yearStart = `${viewYear}-01-01`;
      const yearEnd = `${viewYear}-12-31`;
      const [allReservations, yearAvailability] = await Promise.all([
        employeeAPI.getReservations(employee.id, true),
        employeeAPI.getAvailabilityForDateRange(employee.id, yearStart, yearEnd),
      ]);
      setReservations(Array.isArray(allReservations) ? allReservations : []);
      setBookings(Array.isArray(yearAvailability?.bookings) ? yearAvailability.bookings : []);

      try {
        const updatedRangeAvailability = await employeeAPI.getAvailabilityForDateRange(
          employee.id,
          reservationForm.start_date,
          reservationForm.end_date
        );
        setSelectionAvailability(updatedRangeAvailability);
      } catch {
        // ignore
      }

      setReservationForm({
        start_date: todayISO,
        end_date: nextMonthISO,
        reserved_hours_per_day: '',
        reason: '',
      });
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed to create reservation');
    } finally {
      setSaving(false);
    }
  };

  const contextMenuItems = useMemo(() => {
    const hasValidHours = typeof reservationForm.reserved_hours_per_day === 'number' && reservationForm.reserved_hours_per_day > 0;
    const withinCapacity = availableHours === null ? true : requestedTotalHours <= availableHours;

    return [
      {
        id: 'create-reservation',
        label: 'Create reservation for selected range',
        disabled: saving || !hasValidHours || workingDays <= 0 || !withinCapacity,
        onSelect: handleCreateReservation,
      },
      {
        id: 'clear',
        label: 'Clear selection',
        onSelect: () => setReservationForm((p) => ({ ...p, start_date: todayISO, end_date: todayISO })),
      },
    ];
  }, [availableHours, handleCreateReservation, requestedTotalHours, reservationForm.reserved_hours_per_day, saving, todayISO, workingDays]);

  const handleDeleteReservation = async (reservationId: number) => {
    if (!employee) return;

    const confirmed = window.confirm('Are you sure you want to delete this reservation?');
    if (!confirmed) return;

    try {
      await employeeAPI.deleteReservation(employee.id, reservationId);
      toast.success('Reservation deleted');
      const yearStart = `${viewYear}-01-01`;
      const yearEnd = `${viewYear}-12-31`;
      const [allReservations, yearAvailability] = await Promise.all([
        employeeAPI.getReservations(employee.id, true),
        employeeAPI.getAvailabilityForDateRange(employee.id, yearStart, yearEnd),
      ]);
      setReservations(Array.isArray(allReservations) ? allReservations : []);
      setBookings(Array.isArray(yearAvailability?.bookings) ? yearAvailability.bookings : []);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed to delete reservation');
    }
  };

  return (
    <div className="h-[calc(100vh-6rem)] min-h-[650px] flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-zinc-900">Schedule</h1>
          <p className="mt-1 text-xs text-zinc-500">Drag to select a range, right-click for actions</p>
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
            onClick={() => setReservationForm((p) => ({ ...p, start_date: todayISO, end_date: todayISO }))}
          >
            Clear Selection
          </Button>
          <Button onClick={handleCreateReservation} disabled={saving}>
            {saving ? 'Creating…' : 'Create Reservation'}
          </Button>
          <Button variant="secondary" onClick={() => router.push('/resources')}>Back</Button>
        </div>
      </div>

      {loading || !employee ? (
        <SkeletonModal />
      ) : (
        <div className="flex flex-col gap-3 flex-1 min-h-0">
          <div className="rounded-md border border-zinc-200 bg-white p-3">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
              <div className="lg:col-span-2">
                <div className="text-sm font-semibold text-zinc-900">{employee.full_name}</div>
                <div className="mt-0.5 text-xs text-zinc-600">{employee.position} • {employee.department}</div>
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
                    setRange({ start: normalizedStart, end: normalizedEnd });
                    setReservationForm((prev) => ({ ...prev, start_date: normalizedStart, end_date: normalizedEnd }));
                  }}
                />
              </div>
              <Input
                type="number"
                label="Reserved Hours (hrs/day)"
                value={reservationForm.reserved_hours_per_day}
                onChange={(e) =>
                  setReservationForm((p) => ({
                    ...p,
                    reserved_hours_per_day: parseFloat(e.target.value) || 0,
                  }))
                }
                min="0"
                max={settings.work_hours_per_day.toString()}
                step="0.5"
                placeholder="e.g., 6"
              />
              <Input
                type="text"
                label="Reason (optional)"
                value={reservationForm.reason}
                onChange={(e) => setReservationForm((p) => ({ ...p, reason: e.target.value }))}
                placeholder="Vacation, training..."
              />
            </div>
            <div className="mt-2 text-xs text-zinc-600 whitespace-nowrap overflow-hidden text-ellipsis font-mono tabular-nums">
              Working days: <span className="font-semibold">{workingDays}</span>
              {maxHoursTotal !== null ? (
                <>
                  {' '}• Max: <span className="font-semibold">{maxHoursTotal}h</span>
                </>
              ) : null}
              {' '}• Utilized: <span className="font-semibold">{utilizedHours}h</span>
              {bookedHours > 0 ? <> (Booked {bookedHours}h)</> : null}
              {reservedHours > 0 ? <> (Reserved {reservedHours}h)</> : null}
              {availableHours !== null ? (
                <>
                  {' '}• Available: <span className="font-semibold">{availableHours}h</span>
                </>
              ) : null}
              {' '}• Request: <span className="font-semibold">{requestedTotalHours.toFixed(1)}h</span>
              {remainingAfterRequest !== null ? (
                <>
                  {' '}• Remaining: <span className="font-semibold">{remainingAfterRequest.toFixed(1)}h</span>
                </>
              ) : null}
              <span className="ml-2 text-zinc-500">{loadingAvailability ? 'Checking availability…' : ''}</span>
            </div>
          </div>

          <div className="flex-1 min-h-0">
            <div className="h-full">
              <VisualScheduleTimeline
                windowStart={timelineWindow.start}
                windowEnd={timelineWindow.end}
                selectionStart={range.start}
                selectionEnd={range.end}
                onSelectionPreview={(start, end) => setRange({ start, end })}
                onSelectionChange={(start, end) => {
                  setRange({ start, end });
                  setReservationForm((prev) => ({ ...prev, start_date: start, end_date: end }));
                }}
                commitSelectionOnMouseUp
                rowLabel={employee.full_name}
                rowSublabel={`${employee.position} • ${employee.department}`}
                items={timelineItems}
                cellWidth={32}
                leftColumnWidth={200}
                minBodyHeight={200}
                contextMenuItems={contextMenuItems}
                wheelToHorizontal
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function calculateWorkingDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate) return 0;

  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) {
    return 0;
  }

  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    // Weekend: Friday (5) and Saturday (6). Sunday is a workday.
    if (day !== 5 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }

  return count;
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
