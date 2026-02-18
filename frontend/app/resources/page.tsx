
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { employeeAPI, dashboardAPI, Employee, Schedule, Reservation, projectAPI, settingsAPI, Settings } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import Input from '@/components/Input';
import { formatMonth, getMonthsList, processEmployeeScheduleWithBookings, formatRangeDuration } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { SkeletonResourcesPage, SkeletonModal, SkeletonScheduleHistory } from '@/components/Skeleton';
import { VisualScheduleTimeline } from '@/components/VisualScheduleTimeline';
import type { VisualScheduleItem } from '@/components/VisualScheduleTimeline';

export default function ResourcesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isAddEmployeeModalOpen, setIsAddEmployeeModalOpen] = useState(false);
  const [isEditEmployeeModalOpen, setIsEditEmployeeModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [pageSettings, setPageSettings] = useState<Settings>({ work_hours_per_day: 7, work_days_per_month: 18.333333333, months_in_year: 12 });

  useEffect(() => {
    loadData();
    settingsAPI.getSettings().then(setPageSettings).catch(() => {});
  }, []);

  const loadData = async () => {
    try {
      const statsData = await dashboardAPI.getResourceStats(user?.id);

      // Extract employees from statsData (which includes schedule data)
      let employeesWithSchedule: any[] = [];
      if (statsData && statsData.departments) {
        Object.values(statsData.departments).forEach((dept: any) => {
          if (dept.employees) {
            employeesWithSchedule.push(...dept.employees);
          }
        });
      }

      // Fetch bookings separately with error handling
      let bookings: any[] = [];
      try {
        bookings = await projectAPI.getAllBookings();
      } catch (bookingError) {
        console.error('Error fetching bookings, continuing with empty bookings:', bookingError);
      }

      // Process employees with correct monthly booking calculations
      const processedEmployees = employeesWithSchedule.map((emp: any) =>
        processEmployeeScheduleWithBookings(emp, bookings)
      );

      setEmployees(processedEmployees);
      setStats(statsData);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const openScheduleModal = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsScheduleModalOpen(true);
  };

  const openEditModal = (employee: Employee) => {
    setEditingEmployee(employee);
    setIsEditEmployeeModalOpen(true);
  };

  const handleDeleteEmployee = async (employee: Employee) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete ${employee.full_name}? This action cannot be undone.`
    );

    if (confirmed) {
      try {
        await employeeAPI.delete(employee.id);
        toast.success(`${employee.full_name} has been deleted successfully`);
        await loadData();
      } catch (error) {
        console.error('Error deleting employee:', error);
        toast.error('Failed to delete employee. Please try again.');
      }
    }
  };

  if (loading) {
    return <SkeletonResourcesPage />;
  }

  return (
    <>
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-zinc-900">Resources</h1>
              <p className="mt-2 text-sm text-zinc-600">
                Manage employee schedules and availability
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" onClick={() => router.push('/resources/reservations')}>
                Manage Reservations
              </Button>
              <Button onClick={() => setIsAddEmployeeModalOpen(true)}>
                Add Employee
              </Button>
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <Card>
              <CardContent className="py-5">
                <div className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Available This Month</div>
                <div className="mt-2 text-3xl font-bold text-zinc-900">
                  {(() => {
                    const now = new Date();
                    const currentMonth = now.getMonth() + 1;
                    const currentYear = now.getFullYear();
                    let totalAvailable = 0;

                    employees.forEach((emp: Employee) => {
                      const empSchedule = (emp as any).schedule || [];
                      const currentMonthSchedule = empSchedule.find(
                        (s: any) => s.month === currentMonth && s.year === currentYear
                      );

                      if (currentMonthSchedule) {
                        const capacity = currentMonthSchedule.available_hours_per_month || 0;
                        const projectBooked = currentMonthSchedule.project_booked_hours || 0;
                        const reserved = currentMonthSchedule.reserved_hours || 0;
                        totalAvailable += Math.max(0, capacity - projectBooked - reserved);
                      }
                    });

                    return Math.round(totalAvailable).toLocaleString();
                  })()}
                  <span className="text-base font-medium text-zinc-400 ml-1">h</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-5">
                <div className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Available (Year)</div>
                <div className="mt-2 text-3xl font-bold text-zinc-900">
                  {(() => {
                    const currentYear = new Date().getFullYear();
                    let total = 0;

                    employees.forEach((emp: Employee) => {
                      const empSchedule = (emp as any).schedule || [];
                      empSchedule.forEach((s: any) => {
                        if (s.year === currentYear) {
                          const capacity = s.available_hours_per_month || 0;
                          const projectBooked = s.project_booked_hours || 0;
                          const reserved = s.reserved_hours || 0;
                          total += Math.max(0, capacity - projectBooked - reserved);
                        }
                      });
                    });

                    return Math.round(total).toLocaleString();
                  })()}
                  <span className="text-base font-medium text-zinc-400 ml-1">h</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-5">
                <div className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Project Booked (Year)</div>
                <div className="mt-2 text-3xl font-bold text-zinc-900">
                  {(() => {
                    const currentYear = new Date().getFullYear();
                    let total = 0;
                    employees.forEach((emp: Employee) => {
                      ((emp as any).schedule || []).forEach((s: any) => {
                        if (s.year === currentYear) total += s.project_booked_hours || 0;
                      });
                    });
                    return Math.round(total).toLocaleString();
                  })()}
                  <span className="text-base font-medium text-zinc-400 ml-1">h</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-5">
                <div className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Reserved (Year)</div>
                <div className="mt-2 text-3xl font-bold text-zinc-900">
                  {(() => {
                    const currentYear = new Date().getFullYear();
                    let total = 0;
                    employees.forEach((emp: Employee) => {
                      ((emp as any).schedule || []).forEach((s: any) => {
                        if (s.year === currentYear) total += s.reserved_hours || 0;
                      });
                    });
                    return Math.round(total).toLocaleString();
                  })()}
                  <span className="text-base font-medium text-zinc-400 ml-1">h</span>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-5">
                <div className="text-xs font-medium text-zinc-500 uppercase tracking-wide">Utilization (Year)</div>
                <div className="mt-2 text-3xl font-bold text-zinc-900">
                  {(() => {
                    const currentYear = new Date().getFullYear();
                    let totalUtilized = 0;
                    let totalCapacity = 0;
                    const monthlyCapacity = pageSettings.work_hours_per_day * pageSettings.work_days_per_month;

                    employees.forEach((emp: Employee) => {
                      ((emp as any).schedule || []).forEach((s: any) => {
                        if (s.year === currentYear) {
                          totalUtilized += (s.project_booked_hours || 0) + (s.reserved_hours || 0);
                          totalCapacity += monthlyCapacity;
                        }
                      });
                    });

                    const pct = totalCapacity > 0 ? Math.min(100, (totalUtilized / totalCapacity) * 100) : 0;
                    return pct.toFixed(1);
                  })()}
                  <span className="text-base font-medium text-zinc-400 ml-1">%</span>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Employees Table */}
        <Card>
          <CardHeader>
            <CardTitle>Team Members</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-zinc-200 bg-zinc-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Department
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-zinc-500">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white">
                  {employees.map((employee) => (
                    <tr key={employee.id} className="hover:bg-zinc-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-zinc-900">
                        {employee.full_name}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600">
                        {employee.position}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-zinc-600">
                        {employee.department}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(employee)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/resources/${employee.id}/schedule`)}
                            className="text-zinc-700 hover:text-zinc-900 underline underline-offset-4 hover:bg-zinc-50"
                          >
                            Manage Schedule
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteEmployee(employee)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Schedule Modal */}
        {selectedEmployee && (
          <ScheduleModal
            isOpen={isScheduleModalOpen}
            onClose={() => {
              setIsScheduleModalOpen(false);
              setSelectedEmployee(null);
            }}
            employee={selectedEmployee}
            onUpdate={loadData}
          />
        )}

        {/* Add Employee Modal */}
        <AddEmployeeModal
          isOpen={isAddEmployeeModalOpen}
          onClose={() => setIsAddEmployeeModalOpen(false)}
          onAdd={loadData}
        />

        {/* Edit Employee Modal */}
        {editingEmployee && (
          <EditEmployeeModal
            isOpen={isEditEmployeeModalOpen}
            onClose={() => {
              setIsEditEmployeeModalOpen(false);
              setEditingEmployee(null);
            }}
            employee={editingEmployee}
            onUpdate={loadData}
          />
        )}
    </>
  );
}

function ScheduleModal({
  isOpen,
  onClose,
  employee,
  onUpdate,
}: {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  onUpdate: () => void;
}) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [settings, setSettings] = useState<Settings>({ work_hours_per_day: 7, work_days_per_month: 18.333333333, months_in_year: 12 });
  const today = new Date().toISOString().split('T')[0];
  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [timelineWindow, setTimelineWindow] = useState<{ start: string; end: string }>(() => {
    const start = startOfWeekISO(new Date());
    const end = addDaysISO(start, 55);
    return { start, end };
  });

  const [reservationForm, setReservationForm] = useState<{
    start_date: string;
    end_date: string;
    reserved_hours_per_day: number | '';
    reason: string;
  }>({
    start_date: today,
    end_date: nextMonth,
    reserved_hours_per_day: '',
    reason: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Fetch business rules settings
      const fetchSettings = async () => {
        try {
          const fetchedSettings = await settingsAPI.getSettings();
          setSettings(fetchedSettings);
        } catch (error) {
          console.error('Error fetching settings:', error);
          // Keep default values if fetch fails
        }
      };
      fetchSettings();

      // Reset form when opening modal
      setReservationForm({
        start_date: today,
        end_date: nextMonth,
        reserved_hours_per_day: '',
        reason: '',
      });
      setLoading(true);
      const windowStart = startOfWeekISO(new Date());
      setTimelineWindow({ start: windowStart, end: addDaysISO(windowStart, 55) });
      loadScheduleData();
    }
  }, [isOpen, employee.id]);

  const loadScheduleData = async () => {
    try {
      const [reservationData, bookingData] = await Promise.all([
        employeeAPI.getReservations(employee.id, false),
        dashboardAPI.getEmployeeBookings(employee.id),
      ]);
      setReservations(reservationData);
      setBookings(Array.isArray(bookingData) ? bookingData : []);
    } catch (error) {
      console.error('Error loading schedule data:', error);
      toast.error('Failed to load reservations/bookings. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof typeof reservationForm, value: string | number) => {
    setReservationForm((prev) => ({ ...prev, [field]: value }));
  };

  // Calculate working days (excludes weekends)
  const calculateWorkingDays = (startDate: string, endDate: string): number => {
    if (!startDate || !endDate) return 0;

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      return 0;
    }

    let count = 0;
    const currentDate = new Date(start);

    while (currentDate <= end) {
      const dayOfWeek = currentDate.getDay();
      // Weekend: Friday (5) and Saturday (6). Sunday is a workday.
      if (dayOfWeek !== 5 && dayOfWeek !== 6) {
        count++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    return count;
  };

  const workingDays = calculateWorkingDays(reservationForm.start_date, reservationForm.end_date);
  const maxHours = workingDays * settings.work_hours_per_day;
  const totalReservedHours = workingDays * (reservationForm.reserved_hours_per_day || 0);
  const availableHoursPerDay = settings.work_hours_per_day - (reservationForm.reserved_hours_per_day || 0);

  const handleSave = async () => {
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
      await loadScheduleData();
      onUpdate();
      toast.success('Reservation created successfully!');
      // Reset form
      setReservationForm({
        start_date: today,
        end_date: nextMonth,
        reserved_hours_per_day: '',
        reason: '',
      });
    } catch (error: any) {
      console.error('Error creating reservation:', error);
      const errorMsg = error.message || 'Failed to create reservation';
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteReservation = async (reservationId: number) => {
    const confirmed = window.confirm('Are you sure you want to delete this reservation?');
    if (!confirmed) return;

    try {
      await employeeAPI.deleteReservation(employee.id, reservationId);
      toast.success('Reservation deleted successfully');
      await loadScheduleData();
      onUpdate();
    } catch (error: any) {
      console.error('Error deleting reservation:', error);
      toast.error(error.message || 'Failed to delete reservation');
    }
  };

  const timelineItems: VisualScheduleItem[] = [
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
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Manage Reservations - ${employee.full_name}`} size="lg">
      {loading ? (
        <SkeletonModal />
      ) : (
        <div className="space-y-6">
          {/* Create New Reservation */}
          <div className="rounded-lg border border-zinc-200 p-4">
            <h4 className="mb-4 text-sm font-semibold text-zinc-900">Create New Reservation</h4>

            <div className="mb-4">
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
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                type="date"
                label="Start Date"
                value={reservationForm.start_date}
                onChange={(e) => handleInputChange('start_date', e.target.value)}
              />
              <Input
                type="date"
                label="End Date"
                value={reservationForm.end_date}
                onChange={(e) => handleInputChange('end_date', e.target.value)}
              />
            </div>
            <div className="mt-2 text-xs text-zinc-500">
              Duration:{' '}
              <span className="font-medium text-zinc-600">
                {formatRangeDuration(reservationForm.start_date, reservationForm.end_date)}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                type="number"
                label="Reserved Hours (hrs/day)"
                value={reservationForm.reserved_hours_per_day}
                onChange={(e) => handleInputChange('reserved_hours_per_day', parseFloat(e.target.value) || 0)}
                min="0"
                max={settings.work_hours_per_day.toString()}
                step="0.5"
                placeholder="Enter hours per day"
              />
              <Input
                type="text"
                label="Reason (optional)"
                value={reservationForm.reason}
                onChange={(e) => handleInputChange('reason', e.target.value)}
                placeholder="e.g., Vacation, Training"
              />
            </div>

            <div className="mt-4 rounded-lg bg-zinc-50 p-4 space-y-2">
              <div className="text-sm text-zinc-900">
                <span className="font-medium">Working Days:</span> <span className="font-bold">{workingDays}</span> days
              </div>
              <div className="text-sm text-zinc-900">
                <span className="font-medium">Total Reserved Hours:</span> <span className="font-bold">{totalReservedHours.toFixed(1)}</span> hrs
              </div>
              <div className="text-sm text-zinc-900">
                <span className="font-medium">Available Hours per Day:</span> <span className="font-bold">{availableHoursPerDay.toFixed(1)}</span> hrs
              </div>
              <div className="text-xs text-zinc-700 mt-1">
                (Weekends are excluded from working days calculation)
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Creating...' : 'Create Reservation'}
              </Button>
            </div>
          </div>

          {/* Existing Reservations */}
          {reservations.length > 0 && (
            <div>
              <h4 className="mb-3 text-sm font-semibold text-zinc-900">Active Reservations</h4>
              <div className="space-y-2">
                {reservations.map((reservation) => (
                  <div
                    key={reservation.id}
                    className={`flex items-center justify-between rounded-lg border p-3 ${
                      reservation.status === 'cancelled'
                        ? 'border-zinc-200 bg-zinc-50'
                        : 'border-zinc-200 bg-white'
                    }`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <div className="text-sm font-medium text-zinc-900">
                          {new Date(reservation.start_date + 'T00:00:00').toLocaleDateString()} - {new Date(reservation.end_date + 'T00:00:00').toLocaleDateString()}
                        </div>
                        {reservation.status === 'cancelled' && (
                          <span className="text-xs px-2 py-1 bg-zinc-200 text-zinc-700 rounded">Cancelled</span>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-zinc-600">
                        Reserved: {reservation.reserved_hours_per_day}h/day
                        {reservation.reason && ` • ${reservation.reason}`}
                      </div>
                    </div>
                    {reservation.status === 'active' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteReservation(reservation.id)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function AddEmployeeModal({
  isOpen,
  onClose,
  onAdd,
}: {
  isOpen: boolean;
  onClose: () => void;
  onAdd: () => void;
}) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    full_name: '',
    department: '',
    position: '',
    line_manager_id: user?.id || 1,
  });
  const [isDepartmentOpen, setIsDepartmentOpen] = useState(false);

  const departments = [
    'DTMO',
    'Business Analyst',
    'Solution Architecture',
    'Development',
    'Integration',
    'Operations',
    'Data & Analytics',
    'Enterprise Architecture',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await employeeAPI.create(formData);
      toast.success(`${formData.full_name} has been added successfully`);
      onAdd();
      onClose();
      setFormData({ full_name: '', department: '', position: '', line_manager_id: user?.id || 1 });
    } catch (error) {
      console.error('Error creating employee:', error);
      toast.error('Failed to add employee. Please try again.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Add New Employee" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Full Name"
          value={formData.full_name}
          onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
          required
        />
        <div className="relative">
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Department <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsDepartmentOpen(!isDepartmentOpen)}
              className="w-full px-3 py-2 text-left text-sm bg-white border border-zinc-200 rounded-md shadow-sm hover:border-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400 transition-all duration-200 flex items-center justify-between group"
            >
              <span className={formData.department ? 'text-zinc-900' : 'text-zinc-500'}>
                {formData.department || 'Select a department'}
              </span>
              <svg
                className={`w-5 h-5 text-zinc-400 transition-transform duration-200 flex-shrink-0 ${isDepartmentOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isDepartmentOpen && (
              <div className="absolute z-10 w-full mt-2 bg-white border border-zinc-200 rounded-md shadow-sm max-h-60 overflow-auto">
                {departments.map((dept) => (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, department: dept });
                      setIsDepartmentOpen(false);
                    }}
                    className={`w-full px-4 py-3 text-left text-sm hover:bg-zinc-50 transition-colors duration-150 first:rounded-t-md last:rounded-b-md ${
                      formData.department === dept
                        ? 'bg-zinc-50 text-zinc-700 font-medium'
                        : 'text-zinc-700'
                    }`}
                  >
                    {dept}
                  </button>
                ))}
              </div>
            )}
          </div>
          {!formData.department && (
            <input
              type="text"
              required
              className="absolute opacity-0 pointer-events-none"
              value={formData.department}
              onChange={() => {}}
            />
          )}
        </div>
        <Input
          label="Position"
          value={formData.position}
          onChange={(e) => setFormData({ ...formData, position: e.target.value })}
          required
        />
        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Add Employee</Button>
        </div>
      </form>
    </Modal>
  );
}

function EditEmployeeModal({
  isOpen,
  onClose,
  employee,
  onUpdate,
}: {
  isOpen: boolean;
  onClose: () => void;
  employee: Employee;
  onUpdate: () => void;
}) {
  const [formData, setFormData] = useState({
    full_name: employee.full_name,
    department: employee.department,
    position: employee.position,
  });
  const [isDepartmentOpen, setIsDepartmentOpen] = useState(false);

  const departments = [
    'DTMO',
    'Business Analyst',
    'Solution Architecture',
    'Development',
    'Integration',
    'Operations',
    'Data & Analytics',
    'Enterprise Architecture',
  ];

  // Update form data when employee changes
  useEffect(() => {
    setFormData({
      full_name: employee.full_name,
      department: employee.department,
      position: employee.position,
    });
  }, [employee]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await employeeAPI.update(employee.id, formData);
      toast.success(`${formData.full_name} has been updated successfully`);
      onUpdate();
      onClose();
    } catch (error) {
      console.error('Error updating employee:', error);
      toast.error('Failed to update employee. Please try again.');
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Employee" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Full Name"
          value={formData.full_name}
          onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
          required
        />
        <div className="relative">
          <label className="block text-sm font-medium text-zinc-700 mb-1">
            Department <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsDepartmentOpen(!isDepartmentOpen)}
              className="w-full px-3 py-2 text-left text-sm bg-white border border-zinc-200 rounded-md shadow-sm hover:border-zinc-300 focus:outline-none focus:ring-1 focus:ring-zinc-400 focus:border-zinc-400 transition-all duration-200 flex items-center justify-between group"
            >
              <span className={formData.department ? 'text-zinc-900' : 'text-zinc-500'}>
                {formData.department || 'Select a department'}
              </span>
              <svg
                className={`w-5 h-5 text-zinc-400 transition-transform duration-200 flex-shrink-0 ${isDepartmentOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {isDepartmentOpen && (
              <div className="absolute z-10 w-full mt-2 bg-white border border-zinc-200 rounded-md shadow-sm max-h-60 overflow-auto">
                {departments.map((dept) => (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, department: dept });
                      setIsDepartmentOpen(false);
                    }}
                    className={`w-full px-4 py-3 text-left text-sm hover:bg-zinc-50 transition-colors duration-150 first:rounded-t-md last:rounded-b-md ${
                      formData.department === dept
                        ? 'bg-zinc-50 text-zinc-700 font-medium'
                        : 'text-zinc-700'
                    }`}
                  >
                    {dept}
                  </button>
                ))}
              </div>
            )}
          </div>
          {!formData.department && (
            <input
              type="text"
              required
              className="absolute opacity-0 pointer-events-none"
              value={formData.department}
              onChange={() => {}}
            />
          )}
        </div>
        <Input
          label="Position"
          value={formData.position}
          onChange={(e) => setFormData({ ...formData, position: e.target.value })}
          required
        />
        <div className="flex justify-end gap-3 pt-4">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit">Update Employee</Button>
        </div>
      </form>
    </Modal>
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
