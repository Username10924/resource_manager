const Project = require('../models/project');
const User = require('../models/user');
const Employee = require('../models/employee');
const EmployeeReservation = require('../models/reservation');
const SettingsController = require('./settingsController');
const db = require('../database');

// Helper function to count working days
function countWorkingDays(start, end) {
  let workingDays = 0;
  const current = new Date(start);
  const endDate = new Date(end);

  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) or Saturday (6)
      workingDays++;
    }
    current.setDate(current.getDate() + 1);
  }
  return workingDays;
}

// Helper to parse date string to Date object
function parseDate(dateStr) {
  if (dateStr instanceof Date) return dateStr;
  return new Date(dateStr);
}

class ProjectController {
  static createProject(projectData) {
    const requiredFields = ['project_code', 'name', 'description', 'solution_architect_id'];

    for (const field of requiredFields) {
      if (!projectData[field]) {
        return { error: `Missing required field: ${field}` };
      }
    }

    // Check if solution architect exists
    const architect = User.getById(projectData.solution_architect_id);
    if (!architect || architect.role !== 'solution_architect') {
      return { error: 'Invalid solution architect' };
    }

    // Check if project code already exists
    const existing = Project.getByCode(projectData.project_code);
    if (existing) {
      return { error: 'Project code already exists' };
    }

    const project = Project.create(
      projectData.project_code,
      projectData.name,
      projectData.description,
      projectData.solution_architect_id,
      projectData.start_date || null,
      projectData.end_date || null,
      projectData.attachments || []
    );

    return { success: true, project: project.toDict() };
  }

  static updateProject(projectId, updateData) {
    const project = Project.getById(projectId);
    if (!project) {
      return { error: 'Project not found' };
    }

    try {
      const updatedProject = project.update(updateData);
      return { success: true, project: updatedProject.toDict() };
    } catch (e) {
      return { error: e.message };
    }
  }

  static deleteProject(projectId) {
    const project = Project.getById(projectId);
    if (!project) {
      return { error: 'Project not found' };
    }

    try {
      project.delete();
      return { success: true, message: 'Project deleted successfully' };
    } catch (e) {
      return { error: e.message };
    }
  }

  static bookEmployeeForProject(projectId, bookingData) {
    const requiredFields = ['employee_id', 'start_date', 'end_date', 'booked_hours'];

    for (const field of requiredFields) {
      if (bookingData[field] === undefined || bookingData[field] === null) {
        return { error: `Missing required field: ${field}` };
      }
    }

    const project = Project.getById(projectId);
    if (!project) {
      return { error: 'Project not found' };
    }

    const employee = Employee.getById(bookingData.employee_id);
    if (!employee) {
      return { error: 'Employee not found' };
    }

    // Parse dates
    const startDate = parseDate(bookingData.start_date);
    const endDate = parseDate(bookingData.end_date);
    const bookedHours = bookingData.booked_hours;

    // Calculate working days
    const totalWorkingDays = countWorkingDays(startDate, endDate);
    const maxHoursPerDay = SettingsController.getWorkHoursPerDay();
    const totalMaxHours = totalWorkingDays * maxHoursPerDay;

    // Check existing bookings that overlap with this date range
    const existingBookings = db.fetchAll(`
      SELECT pb.*, p.name as project_name
      FROM project_bookings pb
      JOIN projects p ON pb.project_id = p.id
      WHERE pb.employee_id = ?
        AND pb.status != 'cancelled'
        AND (
          (pb.start_date <= ? AND pb.end_date >= ?)
          OR (pb.start_date <= ? AND pb.end_date >= ?)
          OR (pb.start_date >= ? AND pb.end_date <= ?)
        )
    `, [
      bookingData.employee_id,
      bookingData.start_date, bookingData.start_date,
      bookingData.end_date, bookingData.end_date,
      bookingData.start_date, bookingData.end_date
    ]);

    // Calculate total booked hours from overlapping bookings
    let totalBookedHours = 0;
    for (const booking of existingBookings) {
      const bStart = parseDate(booking.start_date);
      const bEnd = parseDate(booking.end_date);

      const overlapStart = new Date(Math.max(startDate.getTime(), bStart.getTime()));
      const overlapEnd = new Date(Math.min(endDate.getTime(), bEnd.getTime()));

      if (overlapStart <= overlapEnd) {
        const overlapWorkingDays = countWorkingDays(overlapStart, overlapEnd);
        const bookingTotalWorkingDays = countWorkingDays(bStart, bEnd);

        if (bookingTotalWorkingDays > 0) {
          const hoursPerDay = booking.booked_hours / bookingTotalWorkingDays;
          const overlapHours = hoursPerDay * overlapWorkingDays;
          totalBookedHours += overlapHours;
        }
      }
    }

    // Get reservations that overlap
    const reservations = EmployeeReservation.getActiveReservationsForDateRange(
      bookingData.employee_id, bookingData.start_date, bookingData.end_date
    );

    let totalReservedHours = 0;
    for (const reservation of reservations) {
      const rStart = parseDate(reservation.start_date);
      const rEnd = parseDate(reservation.end_date);

      const overlapStart = new Date(Math.max(startDate.getTime(), rStart.getTime()));
      const overlapEnd = new Date(Math.min(endDate.getTime(), rEnd.getTime()));

      if (overlapStart <= overlapEnd) {
        const overlapWorkingDays = countWorkingDays(overlapStart, overlapEnd);
        totalReservedHours += reservation.reserved_hours_per_day * overlapWorkingDays;
      }
    }

    const totalUtilizedHours = totalBookedHours + totalReservedHours;
    const availableHours = Math.max(0, totalMaxHours - totalUtilizedHours);

    // Validate that the requested hours don't exceed available hours
    if (bookedHours > availableHours) {
      return {
        error: `Cannot book ${bookedHours} hours. Employee only has ${Math.round(availableHours * 10) / 10} hours available in this period. ` +
          `Already utilized: ${Math.round(totalUtilizedHours * 10) / 10} hours (${Math.round(totalBookedHours * 10) / 10} booked + ${Math.round(totalReservedHours * 10) / 10} reserved). ` +
          `Maximum capacity: ${totalMaxHours} hours (${totalWorkingDays} working days × ${maxHoursPerDay} hrs/day).`
      };
    }

    try {
      const result = project.addBooking(
        bookingData.employee_id,
        bookingData.start_date,
        bookingData.end_date,
        bookingData.booked_hours
      );

      // Log the booking
      ProjectController._logBooking(projectId, employee.id, bookingData);

      return { success: true, booking: result };
    } catch (e) {
      return { error: e.message };
    }
  }

  static getAvailableEmployees(startDate, endDate, department = null) {
    // Get all active employees
    const employees = Employee.getAllActive();

    const availableEmployees = [];
    for (const emp of employees) {
      if (department && emp.department !== department) {
        continue;
      }

      // Get overlapping bookings for this employee in the date range
      const result = db.fetchOne(`
        SELECT COUNT(*) as booking_count,
               COALESCE(SUM(booked_hours), 0) as total_booked_hours
        FROM project_bookings
        WHERE employee_id = ?
          AND status != 'cancelled'
          AND (
            (start_date <= ? AND end_date >= ?)
            OR (start_date <= ? AND end_date >= ?)
            OR (start_date >= ? AND end_date <= ?)
          )
      `, [
        emp.id,
        startDate, startDate,
        endDate, endDate,
        startDate, endDate
      ]);

      const bookingCount = result.booking_count || 0;
      const totalBookedHours = result.total_booked_hours || 0;

      availableEmployees.push({
        employee: emp.toDict(),
        booking_count_in_range: bookingCount,
        total_booked_hours_in_range: totalBookedHours,
        has_overlapping_bookings: bookingCount > 0
      });
    }

    return availableEmployees;
  }

  static _logBooking(projectId, employeeId, bookingData) {
    const changes = JSON.stringify({
      project_id: projectId,
      employee_id: employeeId,
      booking_data: bookingData,
      timestamp: new Date().toISOString()
    });

    db.execute(
      `INSERT INTO audit_log (action, table_name, record_id, changes)
       VALUES (?, ?, ?, ?)`,
      ['BOOK_EMPLOYEE', 'project_bookings', null, changes]
    );
  }
}

module.exports = ProjectController;
