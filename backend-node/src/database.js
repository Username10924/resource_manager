const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');
const config = require('./config');

class DB {
  constructor() {
    this.db = null;
    this.ready = false;
    this.initPromise = null;
  }

  async init() {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = (async () => {
      const SQL = await initSqlJs();

      // Load existing database or create new one
      if (fs.existsSync(config.DATABASE_CONFIG.database)) {
        const fileBuffer = fs.readFileSync(config.DATABASE_CONFIG.database);
        this.db = new SQL.Database(fileBuffer);
      } else {
        this.db = new SQL.Database();
      }

      this._createTables();
      this.ready = true;

      // Auto-save periodically
      setInterval(() => this._save(), 5000);
    })();

    return this.initPromise;
  }

  _save() {
    if (this.db && this.ready) {
      try {
        const data = this.db.export();
        const buffer = Buffer.from(data);
        fs.writeFileSync(config.DATABASE_CONFIG.database, buffer);
      } catch (e) {
        console.error('Error saving database:', e);
      }
    }
  }

  _createTables() {
    // Run migrations first
    this._runMigrations();

    // Users table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL,
        full_name TEXT NOT NULL,
        department TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Employees table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS employees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        full_name TEXT NOT NULL,
        department TEXT NOT NULL,
        position TEXT NOT NULL,
        line_manager_id INTEGER NOT NULL,
        total_hours_per_day INTEGER DEFAULT 6,
        available_days_per_year INTEGER DEFAULT 240,
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'on_leave')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (line_manager_id) REFERENCES users (id)
      )
    `);

    // Employee schedule table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS employee_schedules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
        year INTEGER NOT NULL,
        reserved_hours_per_day REAL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(employee_id, month, year),
        FOREIGN KEY (employee_id) REFERENCES employees (id)
      )
    `);

    // Employee reservations table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS employee_reservations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        employee_id INTEGER NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        reserved_hours_per_day REAL NOT NULL CHECK(reserved_hours_per_day >= 0),
        reason TEXT,
        status TEXT DEFAULT 'active' CHECK(status IN ('active', 'cancelled')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (employee_id) REFERENCES employees (id),
        CHECK(end_date >= start_date)
      )
    `);

    // Projects table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS projects (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_code TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        status TEXT DEFAULT 'planned' CHECK(status IN ('planned', 'active', 'on_hold', 'completed', 'cancelled')),
        progress INTEGER DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
        solution_architect_id INTEGER NOT NULL,
        start_date DATE,
        end_date DATE,
        attachments TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (solution_architect_id) REFERENCES users (id)
      )
    `);

    // Project bookings table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS project_bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        project_id INTEGER NOT NULL,
        employee_id INTEGER NOT NULL,
        start_date DATE NOT NULL,
        end_date DATE NOT NULL,
        booked_hours REAL NOT NULL,
        status TEXT DEFAULT 'booked' CHECK(status IN ('booked', 'completed', 'cancelled')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (project_id) REFERENCES projects (id),
        FOREIGN KEY (employee_id) REFERENCES employees (id),
        CHECK(end_date >= start_date)
      )
    `);

    // Audit log table
    this.db.run(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        action TEXT NOT NULL,
        table_name TEXT NOT NULL,
        record_id INTEGER,
        changes TEXT,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `);

    this._save();
  }

  _runMigrations() {
    // Check if tables exist first
    try {
      const tableInfo = this.db.exec(`
        SELECT sql FROM sqlite_master
        WHERE type='table' AND name='employee_reservations'
      `);

      if (tableInfo.length > 0 && tableInfo[0].values.length > 0) {
        const sql = tableInfo[0].values[0][0];
        if (sql && sql.includes('reserved_hours_per_day <= 6')) {
          console.log('Migrating employee_reservations table...');
          // Migration logic here if needed
        }
      }
    } catch (e) {
      // Table doesn't exist yet
    }
  }

  execute(query, params = []) {
    try {
      this.db.run(query, params);
      this._save();
      return {
        lastInsertRowid: this.db.exec('SELECT last_insert_rowid()')[0]?.values[0]?.[0] || 0,
        changes: this.db.getRowsModified()
      };
    } catch (e) {
      console.error('Execute error:', e, 'Query:', query);
      throw e;
    }
  }

  fetchOne(query, params = []) {
    try {
      const stmt = this.db.prepare(query);
      stmt.bind(params);

      if (stmt.step()) {
        const columns = stmt.getColumnNames();
        const values = stmt.get();
        stmt.free();

        const row = {};
        columns.forEach((col, i) => {
          row[col] = values[i];
        });
        return row;
      }

      stmt.free();
      return null;
    } catch (e) {
      console.error('FetchOne error:', e, 'Query:', query);
      throw e;
    }
  }

  fetchAll(query, params = []) {
    try {
      const stmt = this.db.prepare(query);
      stmt.bind(params);

      const rows = [];
      const columns = stmt.getColumnNames();

      while (stmt.step()) {
        const values = stmt.get();
        const row = {};
        columns.forEach((col, i) => {
          row[col] = values[i];
        });
        rows.push(row);
      }

      stmt.free();
      return rows;
    } catch (e) {
      console.error('FetchAll error:', e, 'Query:', query);
      throw e;
    }
  }

  close() {
    this._save();
    if (this.db) {
      this.db.close();
    }
  }
}

// Export singleton instance
const db = new DB();
module.exports = db;
