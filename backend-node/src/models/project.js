const db = require('../database');

class Project {
  constructor(data) {
    this.id = data.id;
    this.project_code = data.project_code;
    this.name = data.name;
    this.description = data.description;
    this.status = data.status || 'planned';
    this.progress = data.progress || 0;
    this.solution_architect_id = data.solution_architect_id;
    this.start_date = data.start_date;
    this.end_date = data.end_date;
    this.attachments = data.attachments ? JSON.parse(data.attachments) : [];
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  static create(projectCode, name, description, solutionArchitectId, startDate = null, endDate = null, attachments = []) {
    const attachmentsJson = JSON.stringify(attachments);
    const result = db.execute(
      `INSERT INTO projects (project_code, name, description, solution_architect_id, start_date, end_date, attachments)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [projectCode, name, description, solutionArchitectId, startDate, endDate, attachmentsJson]
    );
    return Project.getById(result.lastInsertRowid);
  }

  static getById(projectId) {
    const row = db.fetchOne('SELECT * FROM projects WHERE id = ?', [projectId]);
    return row ? new Project(row) : null;
  }

  static getByCode(projectCode) {
    const row = db.fetchOne('SELECT * FROM projects WHERE project_code = ?', [projectCode]);
    return row ? new Project(row) : null;
  }

  static getByArchitect(architectId) {
    const rows = db.fetchAll(
      'SELECT * FROM projects WHERE solution_architect_id = ? ORDER BY created_at DESC',
      [architectId]
    );
    return rows.map(row => new Project(row).toDict());
  }

  static getAll() {
    const rows = db.fetchAll(`
      SELECT p.*, u.full_name as architect_name
      FROM projects p
      LEFT JOIN users u ON p.solution_architect_id = u.id
      ORDER BY p.created_at DESC
    `);

    return rows.map(row => {
      const attachments = row.attachments ? JSON.parse(row.attachments) : [];
      return {
        ...row,
        attachments
      };
    });
  }

  update(data) {
    const updates = [];
    const params = [];

    if (data.name !== undefined) {
      updates.push('name = ?');
      params.push(data.name);
    }
    if (data.description !== undefined) {
      updates.push('description = ?');
      params.push(data.description);
    }
    if (data.status !== undefined) {
      updates.push('status = ?');
      params.push(data.status);
    }
    if (data.progress !== undefined) {
      updates.push('progress = ?');
      params.push(data.progress);
    }
    if (data.start_date !== undefined) {
      updates.push('start_date = ?');
      params.push(data.start_date);
    }
    if (data.end_date !== undefined) {
      updates.push('end_date = ?');
      params.push(data.end_date);
    }
    if (data.solution_architect_id !== undefined) {
      updates.push('solution_architect_id = ?');
      params.push(data.solution_architect_id);
    }
    if (data.attachments !== undefined) {
      updates.push('attachments = ?');
      params.push(JSON.stringify(data.attachments));
    }

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(this.id);
      db.execute(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    return Project.getById(this.id);
  }

  delete() {
    // First delete all associated bookings
    db.execute('DELETE FROM project_bookings WHERE project_id = ?', [this.id]);
    // Then delete the project
    db.execute('DELETE FROM projects WHERE id = ?', [this.id]);
    return true;
  }

  addBooking(employeeId, startDate, endDate, bookedHours) {
    if (endDate < startDate) {
      throw new Error("End date must be after start date");
    }

    // Check if employee exists
    const Employee = require('./employee');
    const employee = Employee.getById(employeeId);
    if (!employee) {
      throw new Error("Employee not found");
    }

    // Check for overlapping bookings
    const existingBooking = db.fetchOne(`
      SELECT id, booked_hours, start_date, end_date FROM project_bookings
      WHERE project_id = ? AND employee_id = ?
        AND status != 'cancelled'
        AND (
          (start_date <= ? AND end_date >= ?)
          OR (start_date <= ? AND end_date >= ?)
          OR (start_date >= ? AND end_date <= ?)
        )
    `, [
      this.id, employeeId,
      startDate, startDate,
      endDate, endDate,
      startDate, endDate
    ]);

    if (existingBooking) {
      throw new Error(
        `Overlapping booking exists from ${existingBooking.start_date} ` +
        `to ${existingBooking.end_date}. Please adjust the dates or cancel the existing booking.`
      );
    }

    // Create new booking
    const result = db.execute(
      `INSERT INTO project_bookings (project_id, employee_id, start_date, end_date, booked_hours)
       VALUES (?, ?, ?, ?, ?)`,
      [this.id, employeeId, startDate, endDate, bookedHours]
    );

    return { booking_id: result.lastInsertRowid, message: 'Booking successful' };
  }

  getBookings() {
    return db.fetchAll(`
      SELECT pb.*, e.full_name, e.department
      FROM project_bookings pb
      JOIN employees e ON pb.employee_id = e.id
      WHERE pb.project_id = ?
      ORDER BY pb.start_date DESC
    `, [this.id]);
  }

  getDateRangeBookings(startDate, endDate) {
    return db.fetchAll(`
      SELECT pb.*, e.full_name, e.department
      FROM project_bookings pb
      JOIN employees e ON pb.employee_id = e.id
      WHERE pb.project_id = ?
        AND pb.status != 'cancelled'
        AND (
          (pb.start_date <= ? AND pb.end_date >= ?)
          OR (pb.start_date <= ? AND pb.end_date >= ?)
          OR (pb.start_date >= ? AND pb.end_date <= ?)
        )
      ORDER BY pb.start_date, e.full_name
    `, [
      this.id,
      startDate, startDate,
      endDate, endDate,
      startDate, endDate
    ]);
  }

  toDict() {
    const formatDate = (d) => {
      if (d === null || d === undefined) return null;
      if (typeof d === 'string') return d;
      return d.toISOString().split('T')[0];
    };

    return {
      id: this.id,
      project_code: this.project_code,
      name: this.name,
      description: this.description,
      status: this.status,
      progress: this.progress,
      solution_architect_id: this.solution_architect_id,
      start_date: formatDate(this.start_date),
      end_date: formatDate(this.end_date),
      attachments: this.attachments,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
}

module.exports = Project;
