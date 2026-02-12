'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';

import Button from '@/components/Button';
import Input from '@/components/Input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import { SkeletonProjectsPage, Skeleton } from '@/components/Skeleton';
import { VisualScheduleTimeline } from '@/components/VisualScheduleTimeline';
import type { VisualScheduleItem } from '@/components/VisualScheduleTimeline';
import { dashboardAPI, employeeAPI, projectAPI, type Employee, type Project } from '@/lib/api';

export default function ProjectBookingPage() {
  const router = useRouter();
  const params = useParams<{ projectId: string }>();
  const projectId = Number(params.projectId);

  const [project, setProject] = useState<Project | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const [employeeAvailability, setEmployeeAvailability] = useState<any>(null);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [timelineItems, setTimelineItems] = useState<VisualScheduleItem[]>([]);

  const [searchFilter, setSearchFilter] = useState('');

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

  const timelineWindow = useMemo(() => {
    const base = bookingData.startDate ? new Date(bookingData.startDate + 'T00:00:00') : new Date();
    const start = startOfWeekISO(base);
    return { start, end: addDaysISO(start, 83) };
  }, [bookingData.startDate]);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!Number.isFinite(projectId)) {
      router.push('/projects');
      return;
    }

    const load = async () => {
      setLoading(true);
      try {
        const [proj, emps] = await Promise.all([projectAPI.getById(projectId), employeeAPI.getAll()]);
        setProject(proj);
        setEmployees(Array.isArray(emps) ? emps : []);
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [projectId, router]);

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
        const [bookings, reservations] = await Promise.all([
          dashboardAPI.getEmployeeBookings(selectedEmployee.id),
          employeeAPI.getReservations(selectedEmployee.id, false),
        ]);

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
  }, [selectedEmployee]);

  const calculateWorkingDays = (startDate: string, endDate: string) => {
    if (!startDate || !endDate) return 0;

    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');

    if (end < start) return 0;

    let workingDays = 0;
    const current = new Date(start);

    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) workingDays++;
      current.setDate(current.getDate() + 1);
    }

    return workingDays;
  };

  const workingDays = calculateWorkingDays(bookingData.startDate, bookingData.endDate);
  const totalHours = workingDays * (bookingData.hoursPerDay || 0);

  const maxHoursFromAvailability = employeeAvailability?.availability?.available_hours ?? null;
  const totalMaxHours = workingDays * 6;
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

    if (totalHours > maxHours) {
      if (utilizedHours > 0) {
        alert(
          `Cannot book ${totalHours} hours (${bookingData.hoursPerDay} hrs/day × ${workingDays} days). Employee only has ${maxHours} hours available in this period.\n\nAlready utilized: ${utilizedHours} hours (${bookedHours} booked + ${reservedHours} reserved)\nMaximum capacity: ${totalMaxHours} hours (${workingDays} working days × 6 hrs/day)`
        );
      } else {
        alert(
          `Cannot book ${totalHours} hours (${bookingData.hoursPerDay} hrs/day × ${workingDays} days). Maximum ${maxHours} hours for ${workingDays} working days (6hrs/day).`
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

  if (loading) return <SkeletonProjectsPage />;

  if (!project) {
    return (
      <div className="space-y-4">
        <div className="text-sm text-gray-600">Project not found.</div>
        <Button onClick={() => router.push('/projects')}>Back</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
            Book Resources
          </h1>
          <p className="mt-2 text-sm text-gray-600">{project.name}</p>
        </div>
        <Button variant="secondary" onClick={() => router.push('/projects')}>Back</Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Select Team Member</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search team members..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full px-3 py-2 pl-9 text-sm bg-white border border-gray-300 rounded-lg shadow-sm hover:border-gray-400 focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-200 transition-all duration-200"
                />
                <svg
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>

            <div className="space-y-2 max-h-[70vh] overflow-y-auto">
              {employees
                .filter((employee) =>
                  employee.full_name.toLowerCase().includes(searchFilter.toLowerCase()) ||
                  employee.department.toLowerCase().includes(searchFilter.toLowerCase()) ||
                  employee.position.toLowerCase().includes(searchFilter.toLowerCase())
                )
                .sort((a, b) => a.full_name.localeCompare(b.full_name))
                .map((employee) => (
                  <button
                    key={employee.id}
                    onClick={() => setSelectedEmployee(employee)}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      selectedEmployee?.id === employee.id
                        ? 'border-gray-400 bg-gray-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium text-gray-900">{employee.full_name}</div>
                    <div className="mt-1 text-xs text-gray-600">{employee.position} • {employee.department}</div>
                  </button>
                ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Booking Details</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedEmployee ? (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
                <div className="text-sm text-gray-600">Select a team member to book resources</div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-lg bg-gray-50 p-4">
                  <div className="text-sm font-medium text-gray-900">Selected: {selectedEmployee.full_name}</div>
                  <div className="mt-1 text-xs text-gray-600">{selectedEmployee.position} • {selectedEmployee.department}</div>
                </div>

                <VisualScheduleTimeline
                  windowStart={timelineWindow.start}
                  windowEnd={timelineWindow.end}
                  selectionStart={bookingData.startDate}
                  selectionEnd={bookingData.endDate}
                  onSelectionChange={(start, end) => setBookingData({ ...bookingData, startDate: start, endDate: end })}
                  rowLabel={selectedEmployee.full_name}
                  rowSublabel={`${selectedEmployee.position} • ${selectedEmployee.department}`}
                  items={timelineItems}
                  cellWidth={44}
                  leftColumnWidth={280}
                />

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={bookingData.startDate}
                      onChange={(e) => setBookingData({ ...bookingData, startDate: e.target.value })}
                      className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg shadow-sm hover:border-gray-400 focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-200 transition-all duration-200"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <input
                      type="date"
                      value={bookingData.endDate}
                      onChange={(e) => setBookingData({ ...bookingData, endDate: e.target.value })}
                      min={bookingData.startDate}
                      className="w-full px-3 py-2 text-sm bg-white border border-gray-300 rounded-lg shadow-sm hover:border-gray-400 focus:outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-200 transition-all duration-200"
                    />
                  </div>
                </div>

                {loadingAvailability ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                    <div className="text-sm text-gray-600">Loading availability...</div>
                  </div>
                ) : null}

                {workingDays > 0 ? (
                  <div
                    className={`rounded-lg border p-3 ${
                      utilizedHours > 0 ? 'border-amber-200 bg-amber-50' : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="text-sm text-gray-900">
                      📅 {workingDays} working days ({new Date(bookingData.startDate).toLocaleDateString()} -{' '}
                      {new Date(bookingData.endDate).toLocaleDateString()})
                    </div>
                    <div className="text-xs text-gray-700 mt-1">Maximum capacity: {totalMaxHours} hours (6 hrs/day)</div>

                    {utilizedHours > 0 && employeeAvailability?.availability ? (
                      <div className="mt-2 pt-2 border-t border-amber-200">
                        <div className="text-xs text-amber-800">
                          <span className="font-semibold">Already utilized:</span> {utilizedHours} hours
                          {bookedHours > 0 ? <span> ({bookedHours}h booked)</span> : null}
                          {reservedHours > 0 ? <span> ({reservedHours}h reserved)</span> : null}
                        </div>
                        <div className={`text-sm font-semibold mt-1 ${maxHours > 0 ? 'text-green-700' : 'text-red-700'}`}>
                          Available to book: {maxHours} hours
                        </div>
                      </div>
                    ) : null}

                    {!loadingAvailability && !employeeAvailability?.availability && utilizedHours === 0 ? (
                      <div className="text-xs text-green-700 mt-1 font-semibold">Available to book: {maxHours} hours</div>
                    ) : null}
                  </div>
                ) : null}

                <Input
                  type="number"
                  label="Hours per Day"
                  value={bookingData.hoursPerDay}
                  onChange={(e) =>
                    setBookingData({ ...bookingData, hoursPerDay: parseFloat(e.target.value) || 0 })
                  }
                  min="0"
                  max="6"
                  step="0.5"
                  placeholder="Enter hours per day"
                />

                {bookingData.hoursPerDay > 0 && workingDays > 0 ? (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-2">
                    <div className="text-sm text-gray-900">
                      <span className="font-medium">Working Days:</span> <span className="font-bold">{workingDays}</span> days
                    </div>
                    <div className="text-sm text-gray-900">
                      <span className="font-medium">Total Hours:</span> <span className="font-bold">{totalHours.toFixed(1)}</span> hrs
                    </div>
                    <div className="text-xs text-gray-700 mt-1">({bookingData.hoursPerDay} hrs/day × {workingDays} working days)</div>
                  </div>
                ) : null}

                {totalHours > 0 && totalHours <= maxHours && workingDays > 0 ? (
                  <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                    <div className="text-sm text-green-900">✓ Within capacity</div>
                    <div className="text-xs text-green-700 mt-1">Remaining capacity after booking: {(maxHours - totalHours).toFixed(1)} hours</div>
                  </div>
                ) : null}

                {totalHours > maxHours ? (
                  <div className="rounded-lg border border-red-300 bg-red-50 p-3">
                    <div className="text-sm font-semibold text-red-900">Exceeds available hours!</div>
                    <div className="text-xs text-red-800 mt-1">
                      Requested {totalHours.toFixed(1)} hours ({bookingData.hoursPerDay} hrs/day × {workingDays} days) but only {maxHours} hours available.
                      {utilizedHours > 0 ? <span> ({utilizedHours} hours already utilized)</span> : null}
                    </div>
                  </div>
                ) : null}

                <div className="flex justify-end gap-3 pt-4">
                  <Button type="button" variant="secondary" onClick={() => router.push('/projects')}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleBooking}
                    disabled={totalHours > maxHours || bookingData.hoursPerDay <= 0 || maxHours <= 0}
                    className={totalHours > maxHours || maxHours <= 0 ? 'opacity-50 cursor-not-allowed' : ''}
                  >
                    Confirm Booking
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
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
