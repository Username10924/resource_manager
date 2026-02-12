const express = require('express');
const router = express.Router();
const EmployeeController = require('../controllers/employeeController');
const SettingsController = require('../controllers/settingsController');
const Employee = require('../models/employee');
const EmployeeSchedule = require('../models/schedule');
const EmployeeReservation = require('../models/reservation');
const { authenticate } = require('../middleware/auth');
const db = require('../database');

// Create employee
router.post('/', authenticate, (req, res) => {
  try {
    let employeeData = req.body;

    // Line managers can only create employees under themselves
    if (req.currentUser.role === 'line_manager') {
      employeeData.line_manager_id = req.currentUser.id;
    }

    const result = EmployeeController.createEmployee(employeeData);
    if (result.error) {
      return res.status(400).json({ detail: result.error });
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// Get all employees
router.get('/', authenticate, (req, res) => {
  try {
    let managerId = req.query.manager_id ? parseInt(req.query.manager_id) : null;
    const department = req.query.department;

    // Line managers can only see their own employees
    if (req.currentUser.role === 'line_manager') {
      managerId = req.currentUser.id;
    }

    let employees;
    if (managerId) {
      employees = Employee.getByLineManager(managerId);
    } else {
      employees = Employee.getAllActive();
    }

    if (department) {
      employees = employees.filter(e => e.department === department);
    }

    res.json(employees.map(e => e.toDict()));
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// Get employee by ID
router.get('/:employeeId', authenticate, (req, res) => {
  try {
    const employeeId = parseInt(req.params.employeeId);
    const employee = Employee.getById(employeeId);

    if (!employee) {
      return res.status(404).json({ detail: 'Employee not found' });
    }

    // Line managers can only see their own employees
    if (req.currentUser.role === 'line_manager' && employee.line_manager_id !== req.currentUser.id) {
      return res.status(403).json({ detail: 'Access denied: You can only view your own employees' });
    }

    const result = EmployeeController.getEmployeeById(employeeId);
    res.json(result);
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// Update employee (PUT)
router.put('/:employeeId', authenticate, (req, res) => {
  try {
    const employeeId = parseInt(req.params.employeeId);
    const employee = Employee.getById(employeeId);

    if (!employee) {
      return res.status(404).json({ detail: 'Employee not found' });
    }

    // Line managers can only update their own employees
    if (req.currentUser.role === 'line_manager' && employee.line_manager_id !== req.currentUser.id) {
      return res.status(403).json({ detail: 'Access denied: You can only update your own employees' });
    }

    const result = EmployeeController.updateEmployee(employeeId, req.body);
    if (result.error) {
      return res.status(400).json({ detail: result.error });
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// Update employee (POST workaround)
router.post('/:employeeId/update', authenticate, (req, res) => {
  try {
    const employeeId = parseInt(req.params.employeeId);
    const employee = Employee.getById(employeeId);

    if (!employee) {
      return res.status(404).json({ detail: 'Employee not found' });
    }

    // Line managers can only update their own employees
    if (req.currentUser.role === 'line_manager' && employee.line_manager_id !== req.currentUser.id) {
      return res.status(403).json({ detail: 'Access denied: You can only update your own employees' });
    }

    const result = EmployeeController.updateEmployee(employeeId, req.body);
    if (result.error) {
      return res.status(400).json({ detail: result.error });
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// Update employee schedule
router.put('/:employeeId/schedule', authenticate, (req, res) => {
  try {
    const employeeId = parseInt(req.params.employeeId);
    const employee = Employee.getById(employeeId);

    if (!employee) {
      return res.status(404).json({ detail: 'Employee not found' });
    }

    // Line managers can only update their own employees
    if (req.currentUser.role === 'line_manager' && employee.line_manager_id !== req.currentUser.id) {
      return res.status(403).json({ detail: 'Access denied: You can only update your own employees' });
    }

    const { month, year, reserved_hours_per_day } = req.body;

    if (month < 1 || month > 12) {
      return res.status(400).json({ detail: 'Month must be between 1 and 12' });
    }

    if (reserved_hours_per_day < 0 || reserved_hours_per_day > 24) {
      return res.status(400).json({ detail: 'Reserved hours must be between 0 and 24' });
    }

    const result = EmployeeController.updateEmployeeSchedule(employeeId, month, year, reserved_hours_per_day);
    if (result.error) {
      return res.status(400).json({ detail: result.error });
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// Get employee schedule
router.get('/:employeeId/schedule', authenticate, (req, res) => {
  try {
    const employeeId = parseInt(req.params.employeeId);
    const year = req.query.year ? parseInt(req.query.year) : null;
    const employee = Employee.getById(employeeId);

    if (!employee) {
      return res.status(404).json({ detail: 'Employee not found' });
    }

    // Line managers can only see their own employees' schedules
    if (req.currentUser.role === 'line_manager' && employee.line_manager_id !== req.currentUser.id) {
      return res.status(403).json({ detail: "Access denied: You can only view your own employees' schedules" });
    }

    const result = EmployeeController.getEmployeeScheduleDetails(employeeId, year);
    if (result.error) {
      return res.status(404).json({ detail: result.error });
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// Get employee availability for a specific month
router.get('/:employeeId/availability/:month/:year', (req, res) => {
  try {
    const employeeId = parseInt(req.params.employeeId);
    const month = parseInt(req.params.month);
    const year = parseInt(req.params.year);

    const employee = Employee.getById(employeeId);
    if (!employee) {
      return res.status(404).json({ detail: 'Employee not found' });
    }

    const schedule = EmployeeSchedule.getEmployeeSchedule(employeeId, month, year);
    if (!schedule) {
      return res.status(404).json({ detail: 'Schedule not found for this period' });
    }

    // Get already booked hours
    const result = db.fetchOne(`
      SELECT SUM(booked_hours) as booked_hours
      FROM project_bookings
      WHERE employee_id = ?
        AND status != 'cancelled'
        AND strftime('%Y', start_date) <= CAST(? AS TEXT)
        AND strftime('%Y', end_date) >= CAST(? AS TEXT)
        AND CAST(strftime('%m', start_date) AS INTEGER) <= ?
        AND CAST(strftime('%m', end_date) AS INTEGER) >= ?
    `, [employeeId, year, year, month, month]);

    const bookedHours = result.booked_hours || 0;

    // Include reserved hours as part of the booked hours for utilization
    const workDaysPerMonth = SettingsController.getWorkDaysPerMonth();
    const reservedHoursMonthly = schedule.reserved_hours_per_day * workDaysPerMonth;
    const totalUtilizedHours = bookedHours + reservedHoursMonthly;

    const availableHours = schedule.getAvailableHours() - bookedHours;

    res.json({
      employee: employee.toDict(),
      schedule: schedule.toDict(),
      availability: {
        total_available: schedule.getAvailableHours(),
        already_booked: bookedHours,
        reserved_hours: reservedHoursMonthly,
        total_utilized: totalUtilizedHours,
        currently_available: Math.max(0, availableHours)
      }
    });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// Get employee's projects for a specific month
router.get('/:employeeId/projects/:month/:year', (req, res) => {
  try {
    const employeeId = parseInt(req.params.employeeId);
    const month = parseInt(req.params.month);
    const year = parseInt(req.params.year);

    const employee = Employee.getById(employeeId);
    if (!employee) {
      return res.status(404).json({ detail: 'Employee not found' });
    }

    const bookings = db.fetchAll(`
      SELECT pb.*, p.name as project_name, p.project_code, p.status as project_status,
             p.attachments
      FROM project_bookings pb
      JOIN projects p ON pb.project_id = p.id
      WHERE pb.employee_id = ?
        AND strftime('%Y', pb.start_date) <= CAST(? AS TEXT)
        AND strftime('%Y', pb.end_date) >= CAST(? AS TEXT)
        AND CAST(strftime('%m', pb.start_date) AS INTEGER) <= ?
        AND CAST(strftime('%m', pb.end_date) AS INTEGER) >= ?
      ORDER BY pb.start_date DESC
    `, [employeeId, year, year, month, month]);

    // Parse attachments JSON for each booking
    const result = bookings.map(booking => {
      const b = { ...booking };
      if (b.attachments) {
        try {
          b.attachments = JSON.parse(b.attachments);
        } catch {
          b.attachments = [];
        }
      } else {
        b.attachments = [];
      }
      return b;
    });

    res.json(result);
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// Get employee availability for a date range
router.get('/:employeeId/availability-range', (req, res) => {
  try {
    const employeeId = parseInt(req.params.employeeId);
    const startDateStr = req.query.start_date;
    const endDateStr = req.query.end_date;

    if (!startDateStr || !endDateStr) {
      return res.status(400).json({ detail: 'start_date and end_date are required' });
    }

    const employee = Employee.getById(employeeId);
    if (!employee) {
      return res.status(404).json({ detail: 'Employee not found' });
    }

    // Parse and validate dates
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ detail: 'Invalid date format. Use YYYY-MM-DD' });
    }

    if (end < start) {
      return res.status(400).json({ detail: 'End date must be after start date' });
    }

    // Get existing bookings that overlap with this date range
    const bookings = db.fetchAll(`
      SELECT pb.*, p.name as project_name, p.project_code
      FROM project_bookings pb
      JOIN projects p ON pb.project_id = p.id
      WHERE pb.employee_id = ?
        AND pb.status != 'cancelled'
        AND (
          (pb.start_date <= ? AND pb.end_date >= ?)
          OR (pb.start_date <= ? AND pb.end_date >= ?)
          OR (pb.start_date >= ? AND pb.end_date <= ?)
        )
      ORDER BY pb.start_date
    `, [
      employeeId,
      startDateStr, startDateStr,
      endDateStr, endDateStr,
      startDateStr, endDateStr
    ]);

    // Get reservations that overlap with this date range
    const reservations = EmployeeReservation.getActiveReservationsForDateRange(employeeId, startDateStr, endDateStr);

    // Calculate working days
    function countWorkingDays(startDate, endDate) {
      let workingDays = 0;
      const current = new Date(startDate);
      const endD = new Date(endDate);

      while (current <= endD) {
        if (current.getDay() !== 0 && current.getDay() !== 6) {
          workingDays++;
        }
        current.setDate(current.getDate() + 1);
      }
      return workingDays;
    }

    const totalWorkingDays = countWorkingDays(start, end);
    const maxHoursPerDay = SettingsController.getWorkHoursPerDay();
    const totalMaxHours = totalWorkingDays * maxHoursPerDay;

    // Calculate total booked hours for overlapping bookings
    let totalBookedHours = 0;
    for (const booking of bookings) {
      const bStart = new Date(booking.start_date);
      const bEnd = new Date(booking.end_date);

      const overlapStart = new Date(Math.max(start.getTime(), bStart.getTime()));
      const overlapEnd = new Date(Math.min(end.getTime(), bEnd.getTime()));

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

    // Calculate reserved hours
    let totalReservedHours = 0;
    for (const reservation of reservations) {
      const rStart = new Date(reservation.start_date);
      const rEnd = new Date(reservation.end_date);

      const overlapStart = new Date(Math.max(start.getTime(), rStart.getTime()));
      const overlapEnd = new Date(Math.min(end.getTime(), rEnd.getTime()));

      if (overlapStart <= overlapEnd) {
        const overlapWorkingDays = countWorkingDays(overlapStart, overlapEnd);
        totalReservedHours += reservation.reserved_hours_per_day * overlapWorkingDays;
      }
    }

    const totalUtilizedHours = totalBookedHours + totalReservedHours;
    const availableHours = Math.max(0, totalMaxHours - totalUtilizedHours);

    let avgUtilizedPerDay = 0;
    let avgAvailablePerDay = maxHoursPerDay;
    if (totalWorkingDays > 0) {
      avgUtilizedPerDay = totalUtilizedHours / totalWorkingDays;
      avgAvailablePerDay = Math.max(0, maxHoursPerDay - avgUtilizedPerDay);
    }

    res.json({
      employee: employee.toDict(),
      date_range: {
        start_date: startDateStr,
        end_date: endDateStr
      },
      bookings,
      reservations: reservations.map(r => r.toDict()),
      availability: {
        working_days: totalWorkingDays,
        max_hours_total: totalMaxHours,
        total_booked_hours: Math.round(totalBookedHours * 10) / 10,
        total_reserved_hours: Math.round(totalReservedHours * 10) / 10,
        total_utilized_hours: Math.round(totalUtilizedHours * 10) / 10,
        available_hours: Math.round(availableHours * 10) / 10,
        avg_utilized_per_day: Math.round(avgUtilizedPerDay * 100) / 100,
        avg_available_per_day: Math.round(avgAvailablePerDay * 100) / 100
      }
    });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// Delete employee
router.delete('/:employeeId', (req, res) => {
  try {
    const employeeId = parseInt(req.params.employeeId);
    const result = EmployeeController.deleteEmployee(employeeId);

    if (result.error) {
      const statusCode = result.error === 'Employee not found' ? 404 : 400;
      return res.status(statusCode).json({ detail: result.error });
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

module.exports = router;
