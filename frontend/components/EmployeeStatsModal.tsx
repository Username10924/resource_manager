import { useEffect, useState } from 'react';
import Modal from './Modal';
import { Card, CardContent, CardHeader, CardTitle } from './Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { FaBriefcase, FaBuilding, FaProjectDiagram, FaChevronRight, FaUserTie, FaClock } from 'react-icons/fa';
import { employeeAPI, settingsAPI, userAPI, type Reservation, type Settings } from '@/lib/api';
import { calculateMonthlyBookingHours, calculateWorkingDays } from '@/lib/utils';

interface EmployeeStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: any;
  allBookings?: any[];
  allReservations?: any[];
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '5xl';
}

interface ProjectBooking {
  id: number;
  project_id: number;
  project_name: string;
  project_code: string;
  project_status: string;
  booked_hours: number;
  start_date: string;
  end_date: string;
  status?: string;
  attachments?: Array<{
    filename: string;
    path: string;
    uploaded_at: string;
  }>;
}

type MonthlyReservation = Reservation & {
  monthly_hours: number;
  overlap_working_days: number;
};

function parseDateOnlyToLocal(value: string): Date {
  const [y, m, d] = value.split('-').map((n) => parseInt(n, 10));
  const date = new Date(y, (m || 1) - 1, d || 1);
  date.setHours(0, 0, 0, 0);
  return date;
}

function overlapsMonth(startDate: string, endDate: string, month: number, year: number): boolean {
  const start = parseDateOnlyToLocal(startDate);
  const end = parseDateOnlyToLocal(endDate);
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  monthStart.setHours(0, 0, 0, 0);
  monthEnd.setHours(0, 0, 0, 0);
  return start <= monthEnd && end >= monthStart;
}

function calculateMonthlyReservationHours(
  reservation: Reservation,
  month: number,
  year: number
): { hours: number; workingDays: number } {
  const resStart = parseDateOnlyToLocal(reservation.start_date);
  const resEnd = parseDateOnlyToLocal(reservation.end_date);

  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  monthStart.setHours(0, 0, 0, 0);
  monthEnd.setHours(0, 0, 0, 0);

  const overlapStart = resStart > monthStart ? resStart : monthStart;
  const overlapEnd = resEnd < monthEnd ? resEnd : monthEnd;
  if (overlapStart > overlapEnd) return { hours: 0, workingDays: 0 };

  const workingDays = calculateWorkingDays(overlapStart, overlapEnd);
  const hours = workingDays * (reservation.reserved_hours_per_day || 0);
  return { hours, workingDays };
}

export default function EmployeeStatsModal({ isOpen, onClose, employee, allBookings = [], allReservations = [], size = '5xl' }: EmployeeStatsModalProps) {
  const [selectedMonth, setSelectedMonth] = useState<{ month: number; year: number; monthName: string } | null>(null);
  const [projectBookings, setProjectBookings] = useState<ProjectBooking[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);
  const [monthlyReservations, setMonthlyReservations] = useState<MonthlyReservation[]>([]);
  const [loadingReservations, setLoadingReservations] = useState(false);
  const [lineManagerName, setLineManagerName] = useState<string>('N/A');
  const [settings, setSettings] = useState<Settings>({ work_hours_per_day: 7, work_days_per_month: 18.333333333, months_in_year: 12 });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const fetchedSettings = await settingsAPI.getSettings();
        setSettings(fetchedSettings);
      } catch (error) {
        console.error('Error fetching settings:', error);
      }
    };

    if (isOpen) {
      fetchSettings();
    }
  }, [isOpen]);

  useEffect(() => {
    const fetchLineManagerName = async () => {
      if (!isOpen || !employee) return;

      if (employee.line_manager_name) {
        setLineManagerName(employee.line_manager_name);
        return;
      }

      if (!employee.line_manager_id) {
        setLineManagerName('N/A');
        return;
      }

      try {
        const users = await userAPI.getAll();
        const manager = Array.isArray(users)
          ? users.find((user: any) => user.id === employee.line_manager_id)
          : null;
        setLineManagerName(manager?.full_name || `ID: ${employee.line_manager_id}`);
      } catch (error) {
        console.error('Error fetching line manager:', error);
        setLineManagerName(`ID: ${employee.line_manager_id}`);
      }
    };

    fetchLineManagerName();
  }, [isOpen, employee]);

  if (!employee) return null;

  const formatHours = (value: number) => {
    if (!Number.isFinite(value)) return '0h';
    const rounded = Math.round(value * 10) / 10;
    return `${rounded.toLocaleString(undefined, { maximumFractionDigits: 1 })}h`;
  };

  const clampPercent = (value: number) => {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, value));
  };

  const getMonthlyData = () => {
    if (!employee.schedule) return [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const nowYear = now.getFullYear();
    const nowMonth = now.getMonth() + 1;

    const totalCapacity = settings.work_hours_per_day * settings.work_days_per_month;

    return employee.schedule.map((sched: any) => {
      const projectBooked = sched.project_booked_hours || 0;
      const reserved = sched.reserved_hours || 0;
      const totalUtilized = sched.booked_hours || (projectBooked + reserved);
      const capacity = sched.available_hours_per_month || totalCapacity;
      const actualAvailable = Math.max(0, capacity - projectBooked - reserved);

      return {
        month: monthNames[sched.month - 1],
        monthNum: sched.month,
        year: sched.year,
        available: actualAvailable,
        booked: projectBooked,
        reserved: reserved,
        totalUtilized: totalUtilized,
        utilization: clampPercent(totalCapacity > 0 ? (totalUtilized / totalCapacity) * 100 : 0),
      };
    });
  };

  const loadMonthDetails = async (month: number, year: number, monthName: string) => {
    setSelectedMonth({ month, year, monthName });
    setLoadingProjects(true);
    setLoadingReservations(true);

    const [bookingsResult, reservationsResult] = await Promise.allSettled([
      employeeAPI.getProjects(employee.id, month, year),
      employeeAPI.getReservations(employee.id, true),
    ]);

    if (bookingsResult.status === 'fulfilled') {
      const bookings = bookingsResult.value;
      const bookingsWithMonthlyHours = bookings.map((booking: ProjectBooking) => ({
        ...booking,
        monthly_hours: calculateMonthlyBookingHours(booking.start_date, booking.end_date, booking.booked_hours, month, year),
      }));
      setProjectBookings(bookingsWithMonthlyHours as any);
    } else {
      console.error('Error loading project bookings:', bookingsResult.reason);
      setProjectBookings([]);
    }
    setLoadingProjects(false);

    if (reservationsResult.status === 'fulfilled') {
      const reservations = Array.isArray(reservationsResult.value) ? (reservationsResult.value as Reservation[]) : [];
      const filtered = reservations
        .filter((r) => overlapsMonth(r.start_date, r.end_date, month, year))
        .map((r) => {
          const { hours, workingDays } = calculateMonthlyReservationHours(r, month, year);
          return {
            ...r,
            monthly_hours: hours,
            overlap_working_days: workingDays,
          };
        })
        .sort((a, b) => (a.start_date > b.start_date ? 1 : a.start_date < b.start_date ? -1 : 0));

      setMonthlyReservations(filtered);
    } else {
      console.error('Error loading reservations:', reservationsResult.reason);
      setMonthlyReservations([]);
    }
    setLoadingReservations(false);
  };

  const handleCloseMonthDetails = () => {
    setSelectedMonth(null);
    setProjectBookings([]);
    setMonthlyReservations([]);
  };

  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 90) return '#ef4444';
    if (utilization >= 75) return '#18181b';
    if (utilization >= 50) return '#71717a';
    return '#d4d4d8';
  };

  const monthlyData = getMonthlyData();
  const totalAvailable = monthlyData.reduce((sum: number, m: any) => sum + m.available, 0);
  const totalBooked = monthlyData.reduce((sum: number, m: any) => sum + m.booked, 0);
  const totalReserved = monthlyData.reduce((sum: number, m: any) => sum + m.reserved, 0);
  const totalUtilized = monthlyData.reduce((sum: number, m: any) => sum + m.totalUtilized, 0);
  const monthlyCapacity = settings.work_hours_per_day * settings.work_days_per_month;
  const totalCapacity = monthlyCapacity * monthlyData.length;
  const avgUtilization = clampPercent(totalCapacity > 0 ? (totalUtilized / totalCapacity) * 100 : 0);

  const empBookings = allBookings.filter(
    (b) => b.employee_id === employee.id && (b.status || '').toLowerCase() !== 'cancelled'
  );
  const empProjectCount = new Set(empBookings.map((b: any) => b.project_id)).size;
  const empReservationCount = allReservations.filter((r: any) => r.employee_id === employee.id).length;

  // Group bookings by project for the compact project view
  const projectsMap = new Map<number, { project_id: number; project_name: string; project_code: string; project_status: string; total_hours: number; start_date: string; end_date: string }>();
  empBookings.forEach((b: any) => {
    const existing = projectsMap.get(b.project_id);
    if (existing) {
      existing.total_hours += b.booked_hours || 0;
      if (b.start_date < existing.start_date) existing.start_date = b.start_date;
      if (b.end_date > existing.end_date) existing.end_date = b.end_date;
    } else {
      projectsMap.set(b.project_id, {
        project_id: b.project_id,
        project_name: b.project_name || `Project #${b.project_id}`,
        project_code: b.project_code || '',
        project_status: b.project_status || 'active',
        total_hours: b.booked_hours || 0,
        start_date: b.start_date,
        end_date: b.end_date,
      });
    }
  });
  const employeeProjects = Array.from(projectsMap.values()).sort((a, b) => b.total_hours - a.total_hours);

  // Employee reservations for the compact reservation view
  const employeeReservations = allReservations
    .filter((r: any) => r.employee_id === employee.id)
    .map((r: any) => {
      const start = parseDateOnlyToLocal(r.start_date);
      const end = parseDateOnlyToLocal(r.end_date);
      const workDays = calculateWorkingDays(start, end);
      return {
        id: r.id,
        reason: r.reason?.trim() || 'Reserved',
        status: r.status || 'active',
        start_date: r.start_date,
        end_date: r.end_date,
        hours_per_day: r.reserved_hours_per_day || 0,
        total_hours: (r.reserved_hours_per_day || 0) * workDays,
      };
    })
    .sort((a, b) => b.total_hours - a.total_hours);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Employee Statistics" size={size}>
      <div className="space-y-6">
        <div className="flex items-center space-x-4 rounded-lg bg-zinc-50 p-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-zinc-900 text-2xl font-bold text-white">
            {employee.full_name.charAt(0)}
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-zinc-900">{employee.full_name}</h2>
            <div className="mt-1 flex flex-wrap gap-3 text-sm text-zinc-600">
              <span className="flex items-center gap-1">
                <FaBriefcase className="text-zinc-600" />
                {employee.job_title}
              </span>
              <span className="flex items-center gap-1">
                <FaBuilding className="text-zinc-900" />
                {employee.department}
              </span>
              <span className="flex items-center gap-1">
                <FaUserTie className="text-zinc-900" />
                {lineManagerName}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <div className="text-sm font-medium text-zinc-600">Total Available</div>
                <div className="mt-1 text-2xl font-bold text-zinc-600">{formatHours(totalAvailable)}</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <div className="text-sm font-medium text-zinc-600">Project Booked</div>
                <div className="mt-1 text-2xl font-bold text-zinc-900">{formatHours(totalBooked)}</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <div className="text-sm font-medium text-zinc-600">Reserved Hours</div>
                <div className="mt-1 text-2xl font-bold text-zinc-900">{formatHours(totalReserved)}</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <div className="text-sm font-medium text-zinc-600">Avg Utilization</div>
                <div className="mt-1 text-2xl font-bold text-zinc-900">{avgUtilization.toFixed(1)}%</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <div className="text-sm font-medium text-zinc-600">Projects</div>
                <div className="mt-1 text-2xl font-bold text-zinc-900">{empProjectCount}</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <div className="text-sm font-medium text-zinc-600">Reservations</div>
                <div className="mt-1 text-2xl font-bold text-zinc-900">{empReservationCount}</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {employeeProjects.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FaProjectDiagram className="text-zinc-500" />
                Enrolled Projects
                <span className="text-xs font-normal text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full ml-1">{employeeProjects.length}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {employeeProjects.map((proj) => {
                  const statusColors: Record<string, string> = {
                    active: 'bg-emerald-100 text-emerald-700',
                    completed: 'bg-zinc-100 text-zinc-600',
                    planned: 'bg-yellow-100 text-yellow-700',
                    on_hold: 'bg-orange-100 text-orange-700',
                    cancelled: 'bg-red-100 text-red-700',
                  };
                  const statusClass = statusColors[proj.project_status] || 'bg-zinc-100 text-zinc-600';
                  const startLabel = parseDateOnlyToLocal(proj.start_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                  const endLabel = parseDateOnlyToLocal(proj.end_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

                  return (
                    <div key={proj.project_id} className="rounded-lg border border-zinc-200 p-3 bg-white hover:border-zinc-300 transition-colors">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-zinc-900 truncate">{proj.project_name}</p>
                          {proj.project_code && (
                            <p className="text-xs text-zinc-500">{proj.project_code}</p>
                          )}
                        </div>
                        <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusClass}`}>
                          {proj.project_status.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-zinc-500">
                        <span>{startLabel} - {endLabel}</span>
                        <span className="font-semibold text-zinc-900">{formatHours(proj.total_hours)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {employeeReservations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FaClock className="text-zinc-500" />
                Enrolled Reservations
                <span className="text-xs font-normal text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-full ml-1">{employeeReservations.length}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {employeeReservations.map((res) => {
                  const statusColors: Record<string, string> = {
                    active: 'bg-emerald-100 text-emerald-700',
                    cancelled: 'bg-red-100 text-red-700',
                  };
                  const statusClass = statusColors[res.status] || 'bg-zinc-100 text-zinc-600';
                  const startLabel = parseDateOnlyToLocal(res.start_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                  const endLabel = parseDateOnlyToLocal(res.end_date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

                  return (
                    <div key={res.id} className="rounded-lg border border-zinc-200 p-3 bg-white hover:border-zinc-300 transition-colors">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold text-zinc-900 truncate">{res.reason}</p>
                          <p className="text-xs text-zinc-500">{res.hours_per_day}h/day</p>
                        </div>
                        <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusClass}`}>
                          {res.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-zinc-500">
                        <span>{startLabel} - {endLabel}</span>
                        <span className="font-semibold text-zinc-900">{formatHours(res.total_hours)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Monthly Hours Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" stroke="#71717a" style={{ fontSize: '12px' }} />
                <YAxis stroke="#71717a" style={{ fontSize: '12px' }} />
                <Tooltip
                  contentStyle={{ backgroundColor: 'white', border: '1px solid #e4e4e7', borderRadius: '8px' }}
                  formatter={(value: any, name: any) => {
                    const num = typeof value === 'number' ? value : Number(value);
                    if (!Number.isFinite(num)) return ['0h', name];
                    const rounded = Math.round(num * 10) / 10;
                    return [`${rounded.toLocaleString(undefined, { maximumFractionDigits: 1 })}h`, name];
                  }}
                />
                <Legend />
                <Bar dataKey="available" fill="#a1a1aa" name="Available Hours" radius={[4, 4, 0, 0]} />
                <Bar dataKey="booked" fill="#18181b" name="Project Booked" radius={[4, 4, 0, 0]} />
                <Bar dataKey="reserved" fill="#52525b" name="Reserved Hours" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Utilization Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="month" stroke="#71717a" style={{ fontSize: '12px' }} />
                <YAxis
                  stroke="#71717a"
                  style={{ fontSize: '12px' }}
                  label={{ value: 'Utilization %', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: 'white', border: '1px solid #e4e4e7', borderRadius: '8px' }}
                  formatter={(value: number | undefined) => (value !== undefined ? [`${value.toFixed(1)}%`, 'Utilization'] : ['', ''])}
                />
                <Bar dataKey="utilization" radius={[4, 4, 0, 0]}>
                  {monthlyData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={getUtilizationColor(entry.utilization)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Schedule Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-zinc-200 bg-zinc-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-zinc-700">Month</th>
                    <th className="px-4 py-2 text-right font-medium text-zinc-700">Available</th>
                    <th className="px-4 py-2 text-right font-medium text-zinc-700">Booked</th>
                    <th className="px-4 py-2 text-right font-medium text-zinc-700">Reserved</th>
                    <th className="px-4 py-2 text-right font-medium text-zinc-700">Utilization</th>
                    <th className="px-4 py-2 text-center font-medium text-zinc-700">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200">
                  {monthlyData.map((data: any, index: number) => (
                    <tr
                      key={index}
                      className="hover:bg-zinc-50 cursor-pointer transition-colors"
                      onClick={() => loadMonthDetails(data.monthNum, data.year, data.month)}
                    >
                      <td className="px-4 py-2 font-medium text-zinc-900">{data.month}</td>
                      <td className="px-4 py-2 text-right text-zinc-600">{formatHours(data.available)}</td>
                      <td className="px-4 py-2 text-right text-zinc-600">{formatHours(data.booked)}</td>
                      <td className="px-4 py-2 text-right text-zinc-600">{formatHours(data.reserved)}</td>
                      <td className="px-4 py-2 text-right">
                        <span
                          className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium"
                          style={{ backgroundColor: `${getUtilizationColor(data.utilization)}20`, color: getUtilizationColor(data.utilization) }}
                        >
                          {data.utilization.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <FaChevronRight className="inline-block text-zinc-400" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {selectedMonth && (
          <Card className="mt-4 border border-zinc-200 bg-zinc-50">
            <CardHeader className="bg-zinc-100">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FaProjectDiagram className="text-zinc-600" />
                  Details - {selectedMonth.monthName} {selectedMonth.year}
                </CardTitle>
                <button onClick={handleCloseMonthDetails} className="text-zinc-500 hover:text-zinc-700">
                  ✕
                </button>
              </div>
            </CardHeader>
            <CardContent className="bg-white">
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-zinc-700">Projects</h3>
                    {loadingProjects ? <span className="text-xs text-zinc-500">Loading...</span> : null}
                  </div>

                  {loadingProjects ? (
                    <div className="py-4 text-center text-zinc-500">Loading project details...</div>
                  ) : projectBookings.length === 0 ? (
                    <div className="py-4 text-center text-zinc-500">No projects assigned for this month</div>
                  ) : (
                    <div className="space-y-4">
                      {projectBookings.map((booking: ProjectBooking) => (
                        <div key={booking.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-white">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <span className="font-semibold text-zinc-700 text-lg">{booking.project_code}</span>
                                <span
                                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                    booking.project_status === 'active'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-zinc-100 text-zinc-600'
                                  }`}
                                >
                                  {booking.project_status}
                                </span>
                              </div>
                              <h4 className="text-zinc-900 font-medium mb-1">{booking.project_name}</h4>
                              <div className="text-xs text-zinc-500 flex items-center gap-1 mt-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                  />
                                </svg>
                                {new Date(booking.start_date).toLocaleDateString()} - {new Date(booking.end_date).toLocaleDateString()}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-2xl font-bold text-zinc-900">
                                {(booking as any).monthly_hours?.toFixed(1) || booking.booked_hours}h
                              </div>
                              <div className="text-xs text-zinc-500">this month</div>
                              {booking.booked_hours !== (booking as any).monthly_hours && (
                                <div className="text-xs text-zinc-400 mt-1">{booking.booked_hours}h total</div>
                              )}
                            </div>
                          </div>

                          {booking.attachments && booking.attachments.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-zinc-100">
                              <div className="text-xs font-medium text-zinc-600 mb-2 flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
                                  />
                                </svg>
                                Attachments ({booking.attachments.length})
                              </div>
                              <div className="flex flex-wrap gap-2">
                                {booking.attachments.map((attachment, idx: number) => (
                                  <a
                                    key={idx}
                                    href={`https://resource-manager-kg4d.onrender.com/${attachment.path}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-zinc-50 hover:bg-zinc-100 text-zinc-700 rounded-md text-xs font-medium transition-colors border border-zinc-200"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 01.293-.707l5.414-5.414a1 1 0 01.707-.293H17a2 2 0 012 2v14a2 2 0 01-2 2z"
                                      />
                                    </svg>
                                    {attachment.filename}
                                  </a>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}

                      <div className="bg-zinc-50 rounded-lg p-4 border border-zinc-200">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-700 font-semibold text-lg">Total Project Hours for {selectedMonth.monthName}</span>
                          <span className="text-2xl font-bold text-zinc-700">
                            {projectBookings.reduce((sum, b) => sum + ((b as any).monthly_hours || b.booked_hours), 0).toFixed(1)}h
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-zinc-100 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold text-zinc-700">Reservations</h3>
                    {loadingReservations ? <span className="text-xs text-zinc-500">Loading...</span> : null}
                  </div>

                  {loadingReservations ? (
                    <div className="py-4 text-center text-zinc-500">Loading reservation details...</div>
                  ) : monthlyReservations.length === 0 ? (
                    <div className="py-4 text-center text-zinc-500">No reservations for this month</div>
                  ) : (
                    <div className="space-y-3">
                      {monthlyReservations.map((r) => (
                        <div key={r.id} className="border rounded-lg p-4 bg-white">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-semibold text-zinc-800">{r.reason?.trim() ? r.reason : 'Reserved'}</span>
                                <span
                                  className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                                    r.status === 'active'
                                      ? 'bg-green-100 text-green-800'
                                      : 'bg-zinc-100 text-zinc-600'
                                  }`}
                                >
                                  {r.status}
                                </span>
                              </div>
                              <div className="mt-1 text-xs text-zinc-500 flex items-center gap-2">
                                <span>
                                  {parseDateOnlyToLocal(r.start_date).toLocaleDateString()} - {parseDateOnlyToLocal(r.end_date).toLocaleDateString()}
                                </span>
                                <span>•</span>
                                <span>{r.reserved_hours_per_day}h/day</span>
                                <span>•</span>
                                <span>{r.overlap_working_days} working days</span>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xl font-bold text-zinc-900">{r.monthly_hours.toFixed(1)}h</div>
                              <div className="text-xs text-zinc-500">this month</div>
                            </div>
                          </div>
                        </div>
                      ))}

                      <div className="bg-zinc-50 rounded-lg p-4 border border-zinc-200">
                        <div className="flex items-center justify-between">
                          <span className="text-zinc-700 font-semibold text-lg">Total Reserved Hours for {selectedMonth.monthName}</span>
                          <span className="text-2xl font-bold text-zinc-700">
                            {monthlyReservations
                              .filter((r) => r.status !== 'cancelled')
                              .reduce((sum, r) => sum + (r.monthly_hours || 0), 0)
                              .toFixed(1)}
                            h
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </Modal>
  );
}
