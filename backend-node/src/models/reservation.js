const db = require('../database');
const SettingsController = require('../controllers/settingsController');

class EmployeeReservation {
  constructor(data) {
    this.id = data.id;
    this.employee_id = data.employee_id;
    this.start_date = data.start_date;
    this.end_date = data.end_date;
    this.reserved_hours_per_day = data.reserved_hours_per_day || 0;
    this.reason = data.reason;
    this.status = data.status || 'active';
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  static create(employeeId, startDate, endDate, reservedHoursPerDay, reason = null) {
    if (endDate < startDate) {
      throw new Error("End date must be after or equal to start date");
    }

    const maxHours = SettingsController.getWorkHoursPerDay();
    if (reservedHoursPerDay < 0 || reservedHoursPerDay > maxHours) {
      throw new Error(`Reserved hours per day must be between 0 and ${maxHours}`);
    }

    const result = db.execute(
      `INSERT INTO employee_reservations
       (employee_id, start_date, end_date, reserved_hours_per_day, reason)
       VALUES (?, ?, ?, ?, ?)`,
      [employeeId, startDate, endDate, reservedHoursPerDay, reason]
    );

    return EmployeeReservation.getById(result.lastInsertRowid);
  }

  static getById(reservationId) {
    const row = db.fetchOne('SELECT * FROM employee_reservations WHERE id = ?', [reservationId]);
    return row ? new EmployeeReservation(row) : null;
  }

  static getByEmployee(employeeId, includeCancelled = false) {
    let query;
    if (includeCancelled) {
      query = `SELECT * FROM employee_reservations
               WHERE employee_id = ?
               ORDER BY start_date DESC`;
    } else {
      query = `SELECT * FROM employee_reservations
               WHERE employee_id = ? AND status = 'active'
               ORDER BY start_date DESC`;
    }
    const rows = db.fetchAll(query, [employeeId]);
    return rows.map(row => new EmployeeReservation(row));
  }

  static getActiveReservationsForDateRange(employeeId, startDate, endDate) {
    // Use strict inequalities to allow adjacent date ranges
    // Two ranges overlap if: start1 < end2 AND end1 > start2
    const rows = db.fetchAll(`
      SELECT * FROM employee_reservations
      WHERE employee_id = ?
        AND status = 'active'
        AND start_date < ?
        AND end_date > ?
      ORDER BY start_date
    `, [employeeId, endDate, startDate]);

    return rows.map(row => new EmployeeReservation(row));
  }

  update(data) {
    const updates = [];
    const params = [];

    if (data.start_date !== undefined) {
      updates.push('start_date = ?');
      params.push(data.start_date);
    }
    if (data.end_date !== undefined) {
      updates.push('end_date = ?');
      params.push(data.end_date);
    }
    if (data.reserved_hours_per_day !== undefined) {
      const maxHours = SettingsController.getWorkHoursPerDay();
      if (data.reserved_hours_per_day < 0 || data.reserved_hours_per_day > maxHours) {
        throw new Error(`Reserved hours per day must be between 0 and ${maxHours}`);
      }
      updates.push('reserved_hours_per_day = ?');
      params.push(data.reserved_hours_per_day);
    }
    if (data.reason !== undefined) {
      updates.push('reason = ?');
      params.push(data.reason);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(this.id);
      db.execute(`UPDATE employee_reservations SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    return EmployeeReservation.getById(this.id);
  }

  cancel() {
    return this.update({ status: 'cancelled' });
  }

  delete() {
    db.execute('DELETE FROM employee_reservations WHERE id = ?', [this.id]);
    return true;
  }

  toDict() {
    const formatDate = (d) => {
      if (d === null || d === undefined) return null;
      if (typeof d === 'string') return d;
      if (d instanceof Date) return d.toISOString().split('T')[0];
      return d;
    };

    return {
      id: this.id,
      employee_id: this.employee_id,
      start_date: formatDate(this.start_date),
      end_date: formatDate(this.end_date),
      reserved_hours_per_day: this.reserved_hours_per_day,
      reason: this.reason,
      status: this.status,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
}

module.exports = EmployeeReservation;
