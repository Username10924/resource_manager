import { useState, useEffect } from 'react';
import Modal from './Modal';
import { Card, CardContent, CardHeader, CardTitle } from './Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { FaUser, FaBriefcase, FaEnvelope, FaBuilding, FaChartBar, FaClock, FaProjectDiagram, FaChevronRight } from 'react-icons/fa';
import { employeeAPI } from '@/lib/api';

interface EmployeeStatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  employee: any;
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

export default function EmployeeStatsModal({ isOpen, onClose, employee, size = '5xl' }: EmployeeStatsModalProps) {
  const [selectedMonth, setSelectedMonth] = useState<{ month: number; year: number; monthName: string } | null>(null);
  const [projectBookings, setProjectBookings] = useState<ProjectBooking[]>([]);
  const [loadingProjects, setLoadingProjects] = useState(false);

  if (!employee) return null;

  const getMonthlyData = () => {
    if (!employee.schedule) return [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    return employee.schedule.map((sched: any) => {
      const totalCapacity = 6 * 20; // 6 hours/day * 20 workdays = 120 hours
      return {
        month: monthNames[sched.month - 1],
        monthNum: sched.month,
        year: sched.year,
        available: sched.available_hours_per_month,
        booked: sched.booked_hours || 0,
        utilization: totalCapacity > 0 
          ? ((sched.booked_hours || 0) / totalCapacity) * 100 
          : 0,
      };
    });
  };

  const loadProjectBookings = async (month: number, year: number, monthName: string) => {
    setLoadingProjects(true);
    setSelectedMonth({ month, year, monthName });
    try {
      const bookings = await employeeAPI.getProjects(employee.id, month, year);
      setProjectBookings(bookings);
    } catch (error) {
      console.error('Error loading project bookings:', error);
      setProjectBookings([]);
    } finally {
      setLoadingProjects(false);
    }
  };

  const handleCloseProjectDetails = () => {
    setSelectedMonth(null);
    setProjectBookings([]);
  };

  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 90) return '#ef4444';
    if (utilization >= 75) return '#10b981';
    if (utilization >= 50) return '#f59e0b';
    return '#6b7280';
  };

  const monthlyData = getMonthlyData();
  const totalAvailable = monthlyData.reduce((sum: number, m: any) => sum + m.available, 0);
  const totalBooked = monthlyData.reduce((sum: number, m: any) => sum + m.booked, 0);
  const avgUtilization = totalAvailable > 0 ? (totalBooked / totalAvailable) * 100 : 0;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Employee Statistics" size={size}>
      <div className="space-y-6">
        {/* Employee Header */}
        <div className="flex items-center space-x-4 rounded-lg bg-gradient-to-r from-gray-50 to-gray-100 p-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gray-600 text-2xl font-bold text-white">
            {employee.full_name.charAt(0)}
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900">{employee.full_name}</h2>
            <div className="mt-1 flex flex-wrap gap-3 text-sm text-gray-600">
              <span className="flex items-center gap-1">
                <FaBriefcase className="text-gray-600" />
                {employee.job_title}
              </span>
              <span className="flex items-center gap-1">
                <FaBuilding className="text-green-600" />
                {employee.department}
              </span>
              <span className="flex items-center gap-1">
                <FaEnvelope className="text-purple-600" />
                {employee.email}
              </span>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <div className="text-sm font-medium text-gray-600">Total Available</div>
                <div className="mt-1 text-2xl font-bold text-gray-600">{totalAvailable}h</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <div className="text-sm font-medium text-gray-600">Total Booked</div>
                <div className="mt-1 text-2xl font-bold text-green-600">{totalBooked}h</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-center">
                <div className="text-sm font-medium text-gray-600">Avg Utilization</div>
                <div className="mt-1 text-2xl font-bold text-purple-600">{avgUtilization.toFixed(1)}%</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Monthly Hours Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Hours Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="month" 
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                  }}
                />
                <Legend />
                <Bar dataKey="available" fill="#9ca3af" name="Available Hours" radius={[4, 4, 0, 0]} />
                <Bar dataKey="booked" fill="#10b981" name="Booked Hours" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Utilization Rate Chart */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Utilization Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis 
                  dataKey="month" 
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                  label={{ value: 'Utilization %', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number | undefined) => value !== undefined ? [`${value.toFixed(1)}%`, 'Utilization'] : ['', '']}
                />
                <Bar dataKey="utilization" radius={[8, 8, 0, 0]}>
                  {monthlyData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={getUtilizationColor(entry.utilization)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Monthly Details Table */}
        <Card>
          <CardHeader>
            <CardTitle>Monthly Schedule Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-700">Month</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-700">Available</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-700">Booked</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-700">Free</th>
                    <th className="px-4 py-2 text-right font-medium text-gray-700">Utilization</th>
                    <th className="px-4 py-2 text-center font-medium text-gray-700">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {monthlyData.map((data: any, index: number) => (
                    <tr 
                      key={index} 
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => loadProjectBookings(data.monthNum, data.year, data.month)}
                    >
                      <td className="px-4 py-2 font-medium text-gray-900">{data.month}</td>
                      <td className="px-4 py-2 text-right text-gray-600">{data.available}h</td>
                      <td className="px-4 py-2 text-right text-gray-600">{data.booked}h</td>
                      <td className="px-4 py-2 text-right text-gray-600">{Math.max(0, data.available - data.booked)}h</td>
                      <td className="px-4 py-2 text-right">
                        <span 
                          className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium"
                          style={{ 
                            backgroundColor: `${getUtilizationColor(data.utilization)}20`,
                            color: getUtilizationColor(data.utilization)
                          }}
                        >
                          {data.utilization.toFixed(1)}%
                        </span>
                      </td>
                      <td className="px-4 py-2 text-center">
                        <FaChevronRight className="inline-block text-gray-400" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Project Details Modal */}
        {selectedMonth && (
          <Card className="mt-4 border-2 border-gray-200 bg-gray-50">
            <CardHeader className="bg-gradient-to-r from-gray-100 to-gray-200">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FaProjectDiagram className="text-gray-600" />
                  Project Details - {selectedMonth.monthName} {selectedMonth.year}
                </CardTitle>
                <button
                  onClick={handleCloseProjectDetails}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </button>
              </div>
            </CardHeader>
            <CardContent className="bg-white">
              {loadingProjects ? (
                <div className="py-8 text-center text-gray-500">Loading project details...</div>
              ) : projectBookings.length === 0 ? (
                <div className="py-8 text-center text-gray-500">No projects assigned for this month</div>
              ) : (
                <div className="space-y-4">
                  {projectBookings.map((booking: ProjectBooking) => (
                    <div key={booking.id} className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-white">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-semibold text-gray-700 text-lg">{booking.project_code}</span>
                            <span 
                              className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                                booking.project_status === 'active' 
                                  ? 'bg-green-100 text-green-800' 
                                  : booking.project_status === 'completed'
                                  ? 'bg-gray-100 text-gray-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {booking.project_status}
                            </span>
                          </div>
                          <h4 className="text-gray-900 font-medium mb-1">{booking.project_name}</h4>
                          <div className="text-xs text-gray-500 flex items-center gap-1 mt-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            {new Date(booking.start_date).toLocaleDateString()} - {new Date(booking.end_date).toLocaleDateString()}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-gray-900">{booking.booked_hours}h</div>
                          <div className="text-xs text-gray-500">booked</div>
                        </div>
                      </div>
                      
                      {booking.attachments && booking.attachments.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <div className="text-xs font-medium text-gray-600 mb-2 flex items-center gap-1">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
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
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-700 rounded-md text-xs font-medium transition-colors border border-gray-200"
                              >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                {attachment.filename}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  
                  <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 border-2 border-gray-200">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-700 font-semibold text-lg">Total Hours for {selectedMonth?.monthName}</span>
                      <span className="text-2xl font-bold text-gray-700">
                        {projectBookings.reduce((sum, b) => sum + b.booked_hours, 0)}h
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Modal>
  );
}
