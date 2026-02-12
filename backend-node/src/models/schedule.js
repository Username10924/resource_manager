const db = require('../database');
const SettingsController = require('../controllers/settingsController');

class EmployeeSchedule {
  constructor(data) {
    this.id = data.id;
    this.employee_id = data.employee_id;
    this.month = data.month;
    this.year = data.year;
    this.reserved_hours_per_day = data.reserved_hours_per_day || 0;
    this.available_hours_per_month = data.available_hours_per_month || 0;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  static getById(scheduleId) {
    const row = db.fetchOne('SELECT * FROM employee_schedules WHERE id = ?', [scheduleId]);
    return row ? new EmployeeSchedule(row) : null;
  }

  static getEmployeeSchedule(employeeId, month, year) {
    const row = db.fetchOne(
      `SELECT * FROM employee_schedules
       WHERE employee_id = ? AND month = ? AND year = ?`,
      [employeeId, month, year]
    );
    return row ? new EmployeeSchedule(row) : null;
  }

  static getEmployeeYearlySchedule(employeeId, year) {
    return db.fetchAll(`
      SELECT es.*, e.full_name, e.department
      FROM employee_schedules es
      JOIN employees e ON es.employee_id = e.id
      WHERE es.employee_id = ? AND es.year = ?
      ORDER BY es.month
    `, [employeeId, year]);
  }

  static getTeamSchedule(managerId, month, year) {
    return db.fetchAll(`
      SELECT es.*, e.full_name, e.department, e.position, e.id as employee_id
      FROM employee_schedules es
      JOIN employees e ON es.employee_id = e.id
      WHERE e.line_manager_id = ? AND es.month = ? AND es.year = ?
      ORDER BY e.full_name
    `, [managerId, month, year]);
  }

  updateReservedHours(reservedHours) {
    const workHoursPerDay = SettingsController.getWorkHoursPerDay();
    if (reservedHours > workHoursPerDay) {
      throw new Error(`Reserved hours cannot exceed ${workHoursPerDay} hours per day`);
    }

    db.execute(
      `UPDATE employee_schedules
       SET reserved_hours_per_day = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [reservedHours, this.id]
    );

    return EmployeeSchedule.getById(this.id);
  }

  getAvailableHours() {
    const settings = SettingsController.getSettings();
    const workHoursPerDay = settings.work_hours_per_day;
    const workDaysPerMonth = settings.work_days_per_month;
    const available = (workHoursPerDay - this.reserved_hours_per_day) * workDaysPerMonth;
    return Math.max(0, available);
  }

  toDict() {
    return {
      id: this.id,
      employee_id: this.employee_id,
      month: this.month,
      year: this.year,
      reserved_hours_per_day: this.reserved_hours_per_day,
      available_hours_per_month: this.getAvailableHours(),
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
}

module.exports = EmployeeSchedule;
