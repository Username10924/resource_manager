'use client';

import { useState, useEffect } from 'react';
import { employeeAPI, dashboardAPI, Employee, Schedule } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/Card';
import Button from '@/components/Button';
import Modal from '@/components/Modal';
import Input from '@/components/Input';
import { formatMonth, getMonthsList } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import toast from 'react-hot-toast';
import { SkeletonResourcesPage, SkeletonModal, SkeletonScheduleHistory } from '@/components/Skeleton';

export default function ResourcesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isAddEmployeeModalOpen, setIsAddEmployeeModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [employeesData, statsData] = await Promise.all([
        employeeAPI.getAll(),
        dashboardAPI.getResourceStats(),
      ]);
      setEmployees(employeesData);
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-cyan-50/30">
      <div className="mx-auto max-w-7xl px-6 py-8 lg:px-8">
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">Resources</h1>
              <p className="mt-2 text-sm text-gray-600">
                Manage employee schedules and availability
              </p>
            </div>
            <Button onClick={() => setIsAddEmployeeModalOpen(true)}>
              Add Employee
            </Button>
          </div>
        </div>

        {/* Stats Grid */}
        {stats && (
          <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="py-6">
                <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">Available Hours</div>
                <div className="mt-3 text-4xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">{stats.total_available_hours || 0}</div>
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
                <thead className="border-b border-gray-200 bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                      Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                      Role
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                      Department
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-600">
                      Available Days/Year
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {employees.map((employee) => (
                    <tr key={employee.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-gray-900">
                        {employee.full_name}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                        {employee.position}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                        {employee.department}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-sm text-gray-600">
                        {employee.available_days_per_year}
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-sm">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openScheduleModal(employee)}
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
      </div>
    </div>
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
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const currentDate = new Date();
  const [editingSchedule, setEditingSchedule] = useState<{
    month: number;
    year: number;
    reserved_hours_per_day: number;
  }>({
    month: currentDate.getMonth() + 1,
    year: currentDate.getFullYear(),
    reserved_hours_per_day: 0,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isMonthOpen, setIsMonthOpen] = useState(false);

  const months = getMonthsList();

  useEffect(() => {
    if (isOpen) {
      // Reset form to current month when opening modal
      const now = new Date();
      setEditingSchedule({
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        reserved_hours_per_day: 0,
      });
      setLoading(true);
      loadSchedules();
    }
  }, [isOpen, employee.id]);

  // Auto-update form when month/year changes to show existing schedule data
  useEffect(() => {
    if (Array.isArray(schedules)) {
      const existingSchedule = schedules.find(
        (s) => s.month === editingSchedule.month && s.year === editingSchedule.year
      );
      if (existingSchedule) {
        setEditingSchedule((prev) => ({
          ...prev,
          reserved_hours_per_day: existingSchedule.reserved_hours_per_day,
        }));
      } else {
        // Reset to 0 if no existing schedule for this month
        setEditingSchedule((prev) => ({
          ...prev,
          reserved_hours_per_day: 0,
        }));
      }
    }
  }, [editingSchedule.month, editingSchedule.year, schedules]);

  const loadSchedules = async () => {
    try {
      const data = await employeeAPI.getSchedule(employee.id);
      setSchedules(data);
    } catch (error) {
      console.error('Error loading schedules:', error);
      toast.error('Failed to load schedules. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof typeof editingSchedule, value: number) => {
    setEditingSchedule((prev) => ({ ...prev, [field]: value }));
  };

  // Calculate available hours based on current form input (updates in real-time)
  const availableHoursPerDay = 6 - (editingSchedule.reserved_hours_per_day || 0);
  const availableHoursPerMonth = availableHoursPerDay * 20;

  const handleSave = async () => {
    setSaving(true);
    try {
      await employeeAPI.updateSchedule(employee.id, editingSchedule);
      await loadSchedules();
      onUpdate();
      toast.success('Schedule saved successfully!');
      onClose();
    } catch (error: any) {
      console.error('Error updating schedule:', error);
      const errorMsg = error.message || 'Failed to save schedule';
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Manage Schedule - ${employee.full_name}`} size="lg">
      {loading ? (
        <SkeletonModal />
      ) : (
        <div className="space-y-6">
          {/* Current Schedule Editor */}
          <div className="rounded-lg border border-gray-200 p-4">
          <h4 className="mb-4 text-sm font-semibold text-gray-900">Set Schedule</h4>
          
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Month
              </label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsMonthOpen(!isMonthOpen)}
                  className="w-full px-3 py-2 text-left text-sm bg-white border border-gray-300 rounded-lg shadow-sm hover:border-blue-400 hover:shadow-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 flex items-center justify-between group"
                >
                  <span className="text-gray-900">
                    {formatMonth(`${editingSchedule.year}-${String(editingSchedule.month).padStart(2, '0')}`)}
                  </span>
                  <svg
                    className={`w-5 h-5 text-gray-400 transition-transform duration-200 flex-shrink-0 ${isMonthOpen ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                
                {isMonthOpen && (
                  <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-auto">
                    {months.map((month) => {
                      const [year, monthNum] = month.split('-');
                      const monthValue = parseInt(monthNum);
                      const yearValue = parseInt(year);
                      return (
                        <button
                          key={month}
                          type="button"
                          onClick={() => {
                            setEditingSchedule((prev) => ({ 
                              ...prev, 
                              month: monthValue,
                              year: yearValue
                            }));
                            setIsMonthOpen(false);
                          }}
                          className={`w-full px-4 py-3 text-left text-sm hover:bg-blue-50 transition-colors duration-150 first:rounded-t-lg last:rounded-b-lg ${
                            editingSchedule.month === monthValue && editingSchedule.year === yearValue
                              ? 'bg-blue-50 text-blue-700 font-medium'
                              : 'text-gray-700'
                          }`}
                        >
                          {formatMonth(month)}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <Input
              type="number"
              label="Reserved Hours (hrs/day)"
              value={editingSchedule.reserved_hours_per_day}
              onChange={(e) => handleInputChange('reserved_hours_per_day', parseFloat(e.target.value) || 0)}
              min="0"
              max="6"
              step="0.5"
            />
          </div>

          <div className="mt-4 rounded-lg bg-blue-50 p-4">
            <div className="text-sm font-medium text-blue-900">
              Available Hours per Day: <span className="text-xl font-bold">{availableHoursPerDay.toFixed(1)}</span> hrs
            </div>
            <div className="text-xs text-blue-700 mt-1">
              (Total: {availableHoursPerMonth.toFixed(0)} hrs/month @ 20 days/month)
            </div>
            <div className="mt-1 text-xs text-blue-700">
              (Calculated as: (6 - reserved hours per day) × 20 workdays)
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Schedule'}
            </Button>
          </div>
        </div>

        {/* Existing Schedules */}
        {schedules.length > 0 && (
          <div>
            <h4 className="mb-3 text-sm font-semibold text-gray-900">Schedule History</h4>
            <div className="space-y-2">
              {schedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="flex items-center justify-between rounded-lg border border-gray-200 p-3"
                >
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">
                      Month: {schedule.month || 'Current'}
                    </div>
                    <div className="mt-1 text-xs text-gray-600">
                      Ops: {schedule.operations_hours}h | Dev: {schedule.development_hours}h | Other: {schedule.other_hours}h
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-blue-600">
                    {schedule.available_hours_per_month} hrs/month
                  </div>
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
    available_days_per_year: 240,
  });
  const [isDepartmentOpen, setIsDepartmentOpen] = useState(false);

  const departments = [
    'Digital Solutions Delivery',
    'Digital Solutions Development and Integrations',
    'Digital Solutions Operations',
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await employeeAPI.create(formData);
      toast.success(`${formData.full_name} has been added successfully`);
      onAdd();
      onClose();
      setFormData({ full_name: '', department: '', position: '', line_manager_id: user?.id || 1, available_days_per_year: 240 });
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
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Department <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsDepartmentOpen(!isDepartmentOpen)}
              className="w-full px-3 py-2 text-left text-sm bg-white border border-gray-300 rounded-lg shadow-sm hover:border-blue-400 hover:shadow-md focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 flex items-center justify-between group"
            >
              <span className={formData.department ? 'text-gray-900' : 'text-gray-500'}>
                {formData.department || 'Select a department'}
              </span>
              <svg
                className={`w-5 h-5 text-gray-400 transition-transform duration-200 flex-shrink-0 ${isDepartmentOpen ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            
            {isDepartmentOpen && (
              <div className="absolute z-10 w-full mt-2 bg-white border border-gray-200 rounded-lg shadow-xl max-h-60 overflow-auto">
                {departments.map((dept) => (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, department: dept });
                      setIsDepartmentOpen(false);
                    }}
                    className={`w-full px-4 py-3 text-left text-sm hover:bg-blue-50 transition-colors duration-150 first:rounded-t-lg last:rounded-b-lg ${
                      formData.department === dept
                        ? 'bg-blue-50 text-blue-700 font-medium'
                        : 'text-gray-700'
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
        <Input
          type="number"
          label="Available Days per Year"
          value={formData.available_days_per_year}
          onChange={(e) => setFormData({ ...formData, available_days_per_year: parseInt(e.target.value) })}
          min="0"
          max="365"
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
