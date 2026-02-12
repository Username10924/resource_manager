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
import { dashboardAPI, employeeAPI, settingsAPI, type Employee, type Reservation, type Settings } from '@/lib/api';

export default function EmployeeSchedulePage() {
  const router = useRouter();
  const params = useParams<{ employeeId: string }>();
  const employeeId = Number(params.employeeId);

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [settings, setSettings] = useState<Settings>({ work_hours_per_day: 6, work_days_per_month: 20, months_in_year: 12 });

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

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const timelineWindow = useMemo(() => {
    const year = new Date().getFullYear();
    return { start: `${year}-01-01`, end: `${year}-12-31` };
  }, []);

  useEffect(() => {
    if (!Number.isFinite(employeeId)) {
      toast.error('Invalid employee');
      router.push('/resources');
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const [emp, res, bks] = await Promise.all([
          employeeAPI.getById(employeeId),
          employeeAPI.getReservations(employeeId, false),
          dashboardAPI.getEmployeeBookings(employeeId),
        ]);
        setEmployee(emp);
        setReservations(Array.isArray(res) ? res : []);
        setBookings(Array.isArray(bks) ? bks : []);

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
  }, [employeeId, router]);

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

  const workingDays = useMemo(
    () => calculateWorkingDays(reservationForm.start_date, reservationForm.end_date),
    [reservationForm.start_date, reservationForm.end_date]
  );
  const totalReservedHours = workingDays * (reservationForm.reserved_hours_per_day || 0);
  const availableHoursPerDay = settings.work_hours_per_day - (reservationForm.reserved_hours_per_day || 0);

  const handleCreateReservation = async () => {
    if (!employee) return;

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

      const [res, bks] = await Promise.all([
        employeeAPI.getReservations(employee.id, false),
        dashboardAPI.getEmployeeBookings(employee.id),
      ]);
      setReservations(Array.isArray(res) ? res : []);
      setBookings(Array.isArray(bks) ? bks : []);

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

    return [
      {
        id: 'create-reservation',
        label: 'Create reservation for selected range',
        disabled: saving || !hasValidHours || workingDays <= 0,
        onSelect: handleCreateReservation,
      },
      {
        id: 'clear',
        label: 'Clear selection',
        onSelect: () => setReservationForm((p) => ({ ...p, start_date: todayISO, end_date: todayISO })),
      },
    ];
  }, [handleCreateReservation, reservationForm.reserved_hours_per_day, saving, todayISO, workingDays]);

  const handleDeleteReservation = async (reservationId: number) => {
    if (!employee) return;

    const confirmed = window.confirm('Are you sure you want to delete this reservation?');
    if (!confirmed) return;

    try {
      await employeeAPI.deleteReservation(employee.id, reservationId);
      toast.success('Reservation deleted');
      const res = await employeeAPI.getReservations(employee.id, false);
      setReservations(Array.isArray(res) ? res : []);
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'Failed to delete reservation');
    }
  };

  return (
    <div className="h-[calc(100vh-6rem)] min-h-[650px] flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Schedule</h1>
          <p className="mt-2 text-sm text-gray-600">Click-drag to highlight a range, then right-click for actions</p>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => router.push('/resources')}>Back</Button>
        </div>
      </div>

      {loading || !employee ? (
        <SkeletonModal />
      ) : (
        <div className="flex flex-col gap-3 flex-1 min-h-0">
          <div className="rounded-lg border border-gray-200 bg-white p-3">
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
              <div className="lg:col-span-2">
                <div className="text-sm font-semibold text-gray-900">{employee.full_name}</div>
                <div className="mt-0.5 text-xs text-gray-600">{employee.position} • {employee.department}</div>
                <div className="mt-2 text-xs text-gray-500 whitespace-nowrap overflow-hidden text-ellipsis font-mono tabular-nums">
                  Selected: {reservationForm.start_date} → {reservationForm.end_date}
                </div>
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
            <div className="mt-2 text-xs text-gray-600 whitespace-nowrap overflow-hidden text-ellipsis font-mono tabular-nums">
              Working days: <span className="font-semibold">{workingDays}</span> • Total reserved:{' '}
              <span className="font-semibold">{totalReservedHours.toFixed(1)}h</span> • Available/day:{' '}
              <span className="font-semibold">{availableHoursPerDay.toFixed(1)}h</span>
            </div>
          </div>

          <div className="flex-1 min-h-0">
            <div className="h-full">
              <VisualScheduleTimeline
                windowStart={timelineWindow.start}
                windowEnd={timelineWindow.end}
                selectionStart={reservationForm.start_date}
                selectionEnd={reservationForm.end_date}
                onSelectionChange={(start, end) =>
                  setReservationForm((prev) => ({ ...prev, start_date: start, end_date: end }))
                }
                rowLabel={employee.full_name}
                rowSublabel={`${employee.position} • ${employee.department}`}
                items={timelineItems}
                cellWidth={28}
                leftColumnWidth={320}
                minBodyHeight={520}
                contextMenuItems={contextMenuItems}
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
