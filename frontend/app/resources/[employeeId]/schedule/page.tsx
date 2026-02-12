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
    const start = startOfWeekISO(new Date());
    return { start, end: addDaysISO(start, 83) };
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            Schedule
          </h1>
          <p className="mt-2 text-sm text-gray-600">Visual schedule for reservations and project bookings</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={() => router.push('/resources')}>Back</Button>
        </div>
      </div>

      {loading || !employee ? (
        <SkeletonModal />
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{employee.full_name}</CardTitle>
            </CardHeader>
            <CardContent>
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
                cellWidth={44}
                leftColumnWidth={280}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Create Reservation</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Input
                  type="date"
                  label="Start Date"
                  value={reservationForm.start_date}
                  onChange={(e) => setReservationForm((p) => ({ ...p, start_date: e.target.value }))}
                />
                <Input
                  type="date"
                  label="End Date"
                  value={reservationForm.end_date}
                  onChange={(e) => setReservationForm((p) => ({ ...p, end_date: e.target.value }))}
                />
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                  placeholder="Enter hours per day"
                />
                <Input
                  type="text"
                  label="Reason (optional)"
                  value={reservationForm.reason}
                  onChange={(e) => setReservationForm((p) => ({ ...p, reason: e.target.value }))}
                  placeholder="e.g., Vacation, Training"
                />
              </div>

              <div className="mt-4 rounded-lg bg-gray-50 p-4 space-y-2">
                <div className="text-sm text-gray-900">
                  <span className="font-medium">Working Days:</span>{' '}
                  <span className="font-bold">{workingDays}</span> days
                </div>
                <div className="text-sm text-gray-900">
                  <span className="font-medium">Total Reserved Hours:</span>{' '}
                  <span className="font-bold">{totalReservedHours.toFixed(1)}</span> hrs
                </div>
                <div className="text-sm text-gray-900">
                  <span className="font-medium">Available Hours per Day:</span>{' '}
                  <span className="font-bold">{availableHoursPerDay.toFixed(1)}</span> hrs
                </div>
                <div className="text-xs text-gray-700 mt-1">(Weekends are excluded)</div>
              </div>

              <div className="mt-4 flex justify-end">
                <Button onClick={handleCreateReservation} disabled={saving}>
                  {saving ? 'Creating...' : 'Create Reservation'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Active Reservations</CardTitle>
            </CardHeader>
            <CardContent>
              {reservations.filter((r) => r.status === 'active').length === 0 ? (
                <div className="text-sm text-gray-600">No active reservations.</div>
              ) : (
                <div className="space-y-2">
                  {reservations
                    .filter((r) => r.status === 'active')
                    .map((reservation) => (
                      <div
                        key={reservation.id}
                        className="flex items-center justify-between rounded-lg border border-gray-200 bg-white p-3"
                      >
                        <div className="flex-1">
                          <div className="text-sm font-medium text-gray-900">
                            {new Date(reservation.start_date + 'T00:00:00').toLocaleDateString()} -{' '}
                            {new Date(reservation.end_date + 'T00:00:00').toLocaleDateString()}
                          </div>
                          <div className="mt-1 text-xs text-gray-600">
                            Reserved: {reservation.reserved_hours_per_day}h/day
                            {reservation.reason ? ` • ${reservation.reason}` : ''}
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteReservation(reservation.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          Delete
                        </Button>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
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
    if (day !== 0 && day !== 6) count++;
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
