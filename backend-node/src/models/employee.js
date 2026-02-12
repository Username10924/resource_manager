const db = require('../database');

class Employee {
  constructor(data) {
    this.id = data.id;
    this.full_name = data.full_name;
    this.department = data.department;
    this.position = data.position;
    this.line_manager_id = data.line_manager_id;
    this.total_hours_per_day = data.total_hours_per_day || 6;
    this.available_days_per_year = data.available_days_per_year || 240;
    this.status = data.status || 'active';
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  static create(fullName, department, position, lineManagerId, availableDaysPerYear = 240) {
    const result = db.execute(
      `INSERT INTO employees (full_name, department, position, line_manager_id, available_days_per_year)
       VALUES (?, ?, ?, ?, ?)`,
      [fullName, department, position, lineManagerId, availableDaysPerYear]
    );

    const employee = Employee.getById(result.lastInsertRowid);
    if (employee) {
      employee.initializeSchedule();
    }
    return employee;
  }

  static getById(empId) {
    const row = db.fetchOne('SELECT * FROM employees WHERE id = ?', [empId]);
    return row ? new Employee(row) : null;
  }

  static getByLineManager(managerId) {
    const rows = db.fetchAll(
      'SELECT * FROM employees WHERE line_manager_id = ? AND status = "active" ORDER BY full_name',
      [managerId]
    );
    return rows.map(row => new Employee(row));
  }

  static getAllActive() {
    const rows = db.fetchAll(
      'SELECT * FROM employees WHERE status = "active" ORDER BY department, full_name'
    );
    return rows.map(row => new Employee(row));
  }

  initializeSchedule(year = null) {
    if (!year) {
      year = new Date().getFullYear();
    }

    const result = db.fetchOne(
      'SELECT COUNT(*) as count FROM employee_schedules WHERE employee_id = ? AND year = ?',
      [this.id, year]
    );

    if (result.count === 0) {
      const stmt = db.db.prepare(
        `INSERT INTO employee_schedules (employee_id, month, year, reserved_hours_per_day)
         VALUES (?, ?, ?, ?)`
      );
      for (let month = 1; month <= 12; month++) {
        stmt.run(this.id, month, year, 0);
      }
    }
  }

  update(data) {
    const updates = [];
    const params = [];

    if (data.full_name !== undefined) {
      updates.push('full_name = ?');
      params.push(data.full_name);
    }
    if (data.department !== undefined) {
      updates.push('department = ?');
      params.push(data.department);
    }
    if (data.position !== undefined) {
      updates.push('position = ?');
      params.push(data.position);
    }
    if (data.available_days_per_year !== undefined) {
      updates.push('available_days_per_year = ?');
      params.push(data.available_days_per_year);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(this.id);
      db.execute(`UPDATE employees SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    return Employee.getById(this.id);
  }

  delete() {
    // Delete associated schedules
    db.execute('DELETE FROM employee_schedules WHERE employee_id = ?', [this.id]);
    // Delete associated project bookings
    db.execute('DELETE FROM project_bookings WHERE employee_id = ?', [this.id]);
    // Delete associated reservations
    db.execute('DELETE FROM employee_reservations WHERE employee_id = ?', [this.id]);
    // Delete employee
    db.execute('DELETE FROM employees WHERE id = ?', [this.id]);
    return true;
  }

  getSchedule(year = null) {
    if (!year) {
      year = new Date().getFullYear();
    }

    return db.fetchAll(
      `SELECT * FROM employee_schedules
       WHERE employee_id = ? AND year = ?
       ORDER BY month`,
      [this.id, year]
    );
  }

  getMonthlySchedule(month, year = null) {
    if (!year) {
      year = new Date().getFullYear();
    }

    return db.fetchOne(
      `SELECT * FROM employee_schedules
       WHERE employee_id = ? AND month = ? AND year = ?`,
      [this.id, month, year]
    );
  }

  toDict() {
    return {
      id: this.id,
      full_name: this.full_name,
      department: this.department,
      position: this.position,
      line_manager_id: this.line_manager_id,
      total_hours_per_day: this.total_hours_per_day,
      available_days_per_year: this.available_days_per_year,
      status: this.status,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
}

module.exports = Employee;
