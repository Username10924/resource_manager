import sqlite3
import json
from datetime import datetime, date
from typing import Any, Dict, List, Optional, Tuple
import config

class Database:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(Database, cls).__new__(cls)
            cls._instance._init_db()
        return cls._instance
    
    def _init_db(self):
        self.conn = sqlite3.connect(
            config.DATABASE_CONFIG["database"],
            check_same_thread=config.DATABASE_CONFIG["check_same_thread"]
        )
        self.conn.row_factory = sqlite3.Row
        self._create_tables()
    
    def _create_tables(self):
        cursor = self.conn.cursor()
        
        # Users table (Line Managers and Solution Architects)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                role TEXT NOT NULL,
                full_name TEXT NOT NULL,
                department TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Employees table
        cursor.execute('''
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
        ''')
        
        # Employee schedule table (monthly breakdown)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS employee_schedules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id INTEGER NOT NULL,
                month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
                year INTEGER NOT NULL,
                reserved_hours_per_day REAL DEFAULT 0,
                available_hours_per_month REAL GENERATED ALWAYS AS ((6 - reserved_hours_per_day) * 20) VIRTUAL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(employee_id, month, year),
                FOREIGN KEY (employee_id) REFERENCES employees (id)
            )
        ''')
        
        # Projects table
        cursor.execute('''
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
                attachments TEXT, -- JSON string of file paths
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (solution_architect_id) REFERENCES users (id)
            )
        ''')
        
        # Project bookings (horizontal allocation)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS project_bookings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_id INTEGER NOT NULL,
                employee_id INTEGER NOT NULL,
                month INTEGER NOT NULL CHECK(month BETWEEN 1 AND 12),
                year INTEGER NOT NULL,
                booked_hours REAL NOT NULL,
                booking_date DATE NOT NULL,
                status TEXT DEFAULT 'booked' CHECK(status IN ('booked', 'completed', 'cancelled')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(project_id, employee_id, month, year),
                FOREIGN KEY (project_id) REFERENCES projects (id),
                FOREIGN KEY (employee_id) REFERENCES employees (id)
            )
        ''')
        
        # Audit log for tracking changes
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER,
                action TEXT NOT NULL,
                table_name TEXT NOT NULL,
                record_id INTEGER,
                changes TEXT, -- JSON string of changes
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        
        self.conn.commit()
    
    # query helpers
    def execute(self, query: str, params: Tuple = ()) -> sqlite3.Cursor:
        cursor = self.conn.cursor()
        cursor.execute(query, params)
        return cursor
    
    def execute_many(self, query: str, params_list: List[Tuple]) -> sqlite3.Cursor:
        cursor = self.conn.cursor()
        cursor.executemany(query, params_list)
        return cursor
    
    def fetch_one(self, query: str, params: Tuple = ()) -> Optional[Dict]:
        cursor = self.execute(query, params)
        row = cursor.fetchone()
        return dict(row) if row else None
    
    def fetch_all(self, query: str, params: Tuple = ()) -> List[Dict]:
        cursor = self.execute(query, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    
    def commit(self):
        self.conn.commit()
    
    def close(self):
        self.conn.close()

# Database singleton
db = Database()