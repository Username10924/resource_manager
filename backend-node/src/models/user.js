const bcrypt = require('bcryptjs');
const db = require('../database');

class User {
  constructor(data) {
    this.id = data.id;
    this.username = data.username;
    this.password_hash = data.password_hash;
    this.role = data.role;
    this.full_name = data.full_name;
    this.department = data.department;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }

  static hashPassword(password) {
    return bcrypt.hashSync(password, 10);
  }

  verifyPassword(password) {
    return bcrypt.compareSync(password, this.password_hash);
  }

  static create(username, password, role, fullName, department = null) {
    const passwordHash = User.hashPassword(password);
    const result = db.execute(
      `INSERT INTO users (username, password_hash, role, full_name, department)
       VALUES (?, ?, ?, ?, ?)`,
      [username, passwordHash, role, fullName, department]
    );
    return User.getById(result.lastInsertRowid);
  }

  static getById(userId) {
    const row = db.fetchOne('SELECT * FROM users WHERE id = ?', [userId]);
    return row ? new User(row) : null;
  }

  static getByUsername(username) {
    const row = db.fetchOne('SELECT * FROM users WHERE username = ?', [username]);
    return row ? new User(row) : null;
  }

  static getByRole(role) {
    const rows = db.fetchAll('SELECT * FROM users WHERE role = ? ORDER BY full_name', [role]);
    return rows.map(row => new User(row));
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

    if (updates.length > 0) {
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(this.id);
      db.execute(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    return User.getById(this.id);
  }

  toDict() {
    return {
      id: this.id,
      username: this.username,
      role: this.role,
      full_name: this.full_name,
      department: this.department,
      created_at: this.created_at,
      updated_at: this.updated_at
    };
  }
}

module.exports = User;
