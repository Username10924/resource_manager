const Employee = require('../models/employee');
const User = require('../models/user');
const EmployeeSchedule = require('../models/schedule');
const SettingsController = require('./settingsController');

class EmployeeController {
  static createEmployee(employeeData) {
    const requiredFields = ['full_name', 'department', 'position', 'line_manager_id'];

    for (const field of requiredFields) {
      if (!employeeData[field]) {
        return { error: `Missing required field: ${field}` };
      }
    }

    // Check if line manager exists
    const manager = User.getById(employeeData.line_manager_id);
    if (!manager || manager.role !== 'line_manager') {
      return { error: 'Invalid line manager' };
    }

    const employee = Employee.create(
      employeeData.full_name,
      employeeData.department,
      employeeData.position,
      employeeData.line_manager_id,
      employeeData.available_days_per_year || 240
    );

    return { success: true, employee: employee.toDict() };
  }

  static getEmployeeById(employeeId) {
    const employee = Employee.getById(employeeId);
    if (!employee) {
      return null;
    }

    const result = employee.toDict();

    // Get line manager details
    const manager = User.getById(employee.line_manager_id);
    if (manager) {
      result.line_manager = manager.full_name;
    }

    // Get current year schedule
    const currentYear = new Date().getFullYear();
    const schedule = employee.getSchedule(currentYear);
    result.schedule = schedule;

    return result;
  }

  static updateEmployeeSchedule(employeeId, month, year, reservedHours) {
    const employee = Employee.getById(employeeId);
    if (!employee) {
      return { error: 'Employee not found' };
    }

    let schedule = EmployeeSchedule.getEmployeeSchedule(employeeId, month, year);
    if (!schedule) {
      // Initialize schedule if it doesn't exist
      employee.initializeSchedule(year);
      schedule = EmployeeSchedule.getEmployeeSchedule(employeeId, month, year);
    }

    try {
      const updatedSchedule = schedule.updateReservedHours(reservedHours);
      return {
        success: true,
        schedule: updatedSchedule.toDict()
      };
    } catch (e) {
      return { error: e.message };
    }
  }

  static getEmployeeScheduleDetails(employeeId, year = null) {
    const employee = Employee.getById(employeeId);
    if (!employee) {
      return { error: 'Employee not found' };
    }

    if (!year) {
      year = new Date().getFullYear();
    }

    const schedule = EmployeeSchedule.getEmployeeYearlySchedule(employeeId, year);

    // Get dynamic settings
    const settings = SettingsController.getSettings();
    const workHoursPerDay = settings.work_hours_per_day;
    const workDaysPerMonth = settings.work_days_per_month;

    // Calculate totals - recalculate available hours dynamically
    let totalReserved = 0;
    let totalAvailable = 0;

    for (const s of schedule) {
      const reservedHoursPerDay = s.reserved_hours_per_day || 0;
      totalReserved += reservedHoursPerDay * workDaysPerMonth;
      totalAvailable += (workHoursPerDay - reservedHoursPerDay) * workDaysPerMonth;
    }

    return {
      employee: employee.toDict(),
      schedule,
      totals: {
        total_reserved_hours: totalReserved,
        total_available_hours: totalAvailable,
        work_days_per_month: workDaysPerMonth,
        work_hours_per_day: workHoursPerDay
      }
    };
  }

  static updateEmployee(employeeId, employeeData) {
    const employee = Employee.getById(employeeId);
    if (!employee) {
      return { error: 'Employee not found' };
    }

    try {
      // Only allow updating specific fields
      const allowedFields = ['full_name', 'department', 'position', 'available_days_per_year'];
      const updateData = {};
      for (const [key, value] of Object.entries(employeeData)) {
        if (allowedFields.includes(key)) {
          updateData[key] = value;
        }
      }

      if (Object.keys(updateData).length === 0) {
        return { error: 'No valid fields to update' };
      }

      const updatedEmployee = employee.update(updateData);
      return { success: true, employee: updatedEmployee.toDict() };
    } catch (e) {
      return { error: `Failed to update employee: ${e.message}` };
    }
  }

  static deleteEmployee(employeeId) {
    const employee = Employee.getById(employeeId);
    if (!employee) {
      return { error: 'Employee not found' };
    }

    try {
      employee.delete();
      return { success: true, message: 'Employee deleted successfully' };
    } catch (e) {
      return { error: `Failed to delete employee: ${e.message}` };
    }
  }
}

module.exports = EmployeeController;
