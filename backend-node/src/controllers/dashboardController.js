const Employee = require('../models/employee');
const Project = require('../models/project');
const User = require('../models/user');
const SettingsController = require('./settingsController');
const db = require('../database');

class DashboardController {
  static getResourcesDashboard(managerId = null) {
    // Get dynamic settings
    const settings = SettingsController.getSettings();
    const workHoursPerDay = settings.work_hours_per_day;
    const workDaysPerMonth = settings.work_days_per_month;
    const monthlyCapacity = workHoursPerDay * workDaysPerMonth;

    let employees;
    let managerName;

    if (managerId) {
      employees = Employee.getByLineManager(managerId);
      const manager = User.getById(managerId);
      managerName = manager ? manager.full_name : "Unknown";
    } else {
      employees = Employee.getAllActive();
      managerName = "All Departments";
    }

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;

    // Prepare dashboard data
    const dashboardData = {
      manager: managerName,
      total_employees: employees.length,
      departments: {},
      monthly_summary: {}
    };

    // Initialize monthly summary
    for (let month = 1; month <= 12; month++) {
      dashboardData.monthly_summary[month] = {
        total_available: 0,
        total_booked: 0,
        total_capacity: 0,
        employee_count: 0,
        utilization_rate: 0
      };
    }

    // Process each employee
    for (const emp of employees) {
      // Department grouping
      const dept = emp.department;
      if (!dashboardData.departments[dept]) {
        dashboardData.departments[dept] = {
          count: 0,
          total_available_hours: 0,
          employees: []
        };
      }

      dashboardData.departments[dept].count++;

      // Get employee schedule with both project bookings AND reservations
      const scheduleData = db.fetchAll(`
        SELECT es.*,
               COALESCE(
                 (SELECT SUM(pb.booked_hours)
                  FROM project_bookings pb
                  WHERE pb.employee_id = es.employee_id
                    AND pb.status != 'cancelled'
                    AND strftime('%Y', pb.start_date) = CAST(es.year AS TEXT)
                    AND CAST(strftime('%m', pb.start_date) AS INTEGER) <= es.month
                    AND CAST(strftime('%m', pb.end_date) AS INTEGER) >= es.month
                 ), 0
               ) as project_booked_hours,
               COALESCE(
                 (SELECT SUM(er.reserved_hours_per_day * ${workDaysPerMonth})
                  FROM employee_reservations er
                  WHERE er.employee_id = es.employee_id
                    AND er.status = 'active'
                    AND strftime('%Y', er.start_date) = CAST(es.year AS TEXT)
                    AND CAST(strftime('%m', er.start_date) AS INTEGER) <= es.month
                    AND CAST(strftime('%m', er.end_date) AS INTEGER) >= es.month
                 ), 0
               ) as reserved_hours,
               COALESCE(
                 (SELECT SUM(pb.booked_hours)
                  FROM project_bookings pb
                  WHERE pb.employee_id = es.employee_id
                    AND pb.status != 'cancelled'
                    AND strftime('%Y', pb.start_date) = CAST(es.year AS TEXT)
                    AND CAST(strftime('%m', pb.start_date) AS INTEGER) <= es.month
                    AND CAST(strftime('%m', pb.end_date) AS INTEGER) >= es.month
                 ), 0
               ) + COALESCE(
                 (SELECT SUM(er.reserved_hours_per_day * ${workDaysPerMonth})
                  FROM employee_reservations er
                  WHERE er.employee_id = es.employee_id
                    AND er.status = 'active'
                    AND strftime('%Y', er.start_date) = CAST(es.year AS TEXT)
                    AND CAST(strftime('%m', er.start_date) AS INTEGER) <= es.month
                    AND CAST(strftime('%m', er.end_date) AS INTEGER) >= es.month
                 ), 0
               ) as booked_hours
        FROM employee_schedules es
        WHERE es.employee_id = ? AND es.year = ?
        ORDER BY es.month
      `, [emp.id, currentYear]);

      const empData = emp.toDict();
      empData.schedule = scheduleData;

      // Add to department
      dashboardData.departments[dept].employees.push(empData);

      // Update monthly summary and department totals
      for (const sched of scheduleData) {
        const month = sched.month;
        const reservedHoursPerDay = sched.reserved_hours_per_day || 0;
        const baseAvailable = (workHoursPerDay - reservedHoursPerDay) * workDaysPerMonth;
        const projectBooked = sched.project_booked_hours || 0;
        const reserved = sched.reserved_hours || 0;

        // Total utilized = project bookings + reservations
        const totalUtilized = projectBooked + reserved;

        // Actual available = base available - all utilized hours
        const actualAvailable = baseAvailable - totalUtilized;

        dashboardData.monthly_summary[month].total_available += actualAvailable;
        dashboardData.monthly_summary[month].total_booked += totalUtilized;
        dashboardData.monthly_summary[month].total_capacity += monthlyCapacity;
        dashboardData.monthly_summary[month].employee_count++;

        // Add to department's total available hours (only for current month)
        if (month === currentMonth) {
          dashboardData.departments[dept].total_available_hours += actualAvailable;
        }
      }
    }

    // Calculate utilization rates based on total capacity
    for (let month = 1; month <= 12; month++) {
      const summary = dashboardData.monthly_summary[month];
      if (summary.total_capacity > 0) {
        summary.utilization_rate = (summary.total_booked / summary.total_capacity) * 100;
      }
    }

    // Calculate total available hours across all departments
    let totalAvailableHours = 0;
    for (const deptData of Object.values(dashboardData.departments)) {
      totalAvailableHours += deptData.total_available_hours;
    }
    dashboardData.total_available_hours = totalAvailableHours;

    // Count unique managers
    const managersSet = new Set();
    for (const emp of employees) {
      if (emp.line_manager_id) {
        managersSet.add(emp.line_manager_id);
      }
    }
    dashboardData.managers = managersSet.size;

    return dashboardData;
  }

  static getProjectsDashboard(architectId = null) {
    let projectsData;
    let architectName;

    if (architectId) {
      projectsData = Project.getByArchitect(architectId);
      const architect = User.getById(architectId);
      architectName = architect ? architect.full_name : "Unknown";
    } else {
      projectsData = Project.getAll();
      architectName = "All Architects";
    }

    // Process projects
    const projects = [];
    const statusCounts = {
      planned: 0,
      active: 0,
      on_hold: 0,
      completed: 0,
      cancelled: 0
    };

    let totalProgress = 0;
    let activeProjects = 0;
    let totalBookings = 0;

    for (const proj of projectsData) {
      const projectDict = typeof proj.toDict === 'function' ? proj.toDict() : proj;

      // Get booking statistics
      const stats = db.fetchOne(`
        SELECT COUNT(*) as total_bookings,
               SUM(booked_hours) as total_hours,
               COUNT(DISTINCT employee_id) as unique_employees
        FROM project_bookings
        WHERE project_id = ? AND status != 'cancelled'
      `, [projectDict.id]);

      projectDict.booking_stats = {
        total_bookings: stats.total_bookings || 0,
        total_hours: stats.total_hours || 0,
        unique_employees: stats.unique_employees || 0
      };

      // Add to total bookings count
      totalBookings += stats.total_bookings || 0;

      projects.push(projectDict);

      // Update status counts
      const status = projectDict.status;
      if (statusCounts[status] !== undefined) {
        statusCounts[status]++;
      }

      // Update progress stats
      if (status === 'active') {
        totalProgress += projectDict.progress;
        activeProjects++;
      }
    }

    // Calculate average progress
    const avgProgress = activeProjects > 0 ? totalProgress / activeProjects : 0;

    return {
      architect: architectName,
      total_projects: projects.length,
      active_projects: statusCounts.active,
      total_bookings: totalBookings,
      status_distribution: statusCounts,
      avg_progress: Math.round(avgProgress * 10) / 10,
      average_progress: avgProgress,
      projects
    };
  }

  static getBookingOverview(year = null) {
    if (!year) {
      year = new Date().getFullYear();
    }

    const results = db.fetchAll(`
      SELECT
        p.name as project_name,
        p.status as project_status,
        CAST(strftime('%m', pb.start_date) AS INTEGER) as month,
        SUM(pb.booked_hours) as monthly_hours,
        COUNT(DISTINCT pb.employee_id) as employees_count
      FROM project_bookings pb
      JOIN projects p ON pb.project_id = p.id
      WHERE strftime('%Y', pb.start_date) = CAST(? AS TEXT)
        AND pb.status != 'cancelled'
      GROUP BY p.id, CAST(strftime('%m', pb.start_date) AS INTEGER)
      ORDER BY p.name, month
    `, [year]);

    // Organize by project
    const overview = {};
    for (const row of results) {
      const project = row.project_name;
      if (!overview[project]) {
        overview[project] = {
          status: row.project_status,
          monthly_bookings: {}
        };
      }

      overview[project].monthly_bookings[row.month] = {
        hours: row.monthly_hours,
        employees: row.employees_count
      };
    }

    return overview;
  }
}

module.exports = DashboardController;
