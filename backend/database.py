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
        
        # Run migrations first
        self._run_migrations()
        
        # Solution architects are Project Managers in frontend
        cursor.execute('''
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
                status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive', 'on_leave')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (line_manager_id) REFERENCES users (id)
            )
        ''')
        
        # Employee schedule table (monthly breakdown)
        # available_hours_per_month is computed dynamically in Python using live settings
        cursor.execute('''
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
        ''')
        
        # Employee reservations table (date-range based)
        cursor.execute('''
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
        ''')
        
        # Projects table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS projects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                project_code TEXT UNIQUE NOT NULL,
                name TEXT NOT NULL,
                business_unit TEXT,
                description TEXT,
                status TEXT DEFAULT 'planned' CHECK(status IN ('planned', 'active', 'on_hold', 'completed', 'cancelled')),
                progress INTEGER DEFAULT 0 CHECK(progress BETWEEN 0 AND 100),
                solution_architect_id INTEGER NOT NULL,
                start_date DATE,
                end_date DATE,
                priority INTEGER DEFAULT 1 CHECK(priority BETWEEN 1 AND 12),
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

        # Per-employee business rules overrides
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS employee_business_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id INTEGER NOT NULL UNIQUE,
                work_hours_per_day REAL,
                work_days_per_month REAL,
                months_in_year INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (employee_id) REFERENCES employees (id)
            )
        ''')
        
        self.conn.commit()
    
    def _run_migrations(self):
        """Run database migrations"""
        cursor = self.conn.cursor()
        
        # Check if employee_reservations table has the old constraint
        cursor.execute('''
            SELECT sql FROM sqlite_master 
            WHERE type='table' AND name='employee_reservations'
        ''')
        result = cursor.fetchone()
        
        if result and 'reserved_hours_per_day <= 6' in result[0]:
            print("Migrating employee_reservations table to remove hardcoded constraint...")
            
            # Create new table with updated constraint
            cursor.execute('''
                CREATE TABLE employee_reservations_new (
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
            ''')
            
            # Copy data from old table
            cursor.execute('''
                INSERT INTO employee_reservations_new 
                SELECT * FROM employee_reservations
            ''')
            
            # Drop old table
            cursor.execute('DROP TABLE employee_reservations')
            
            # Rename new table
            cursor.execute('ALTER TABLE employee_reservations_new RENAME TO employee_reservations')
            
            self.conn.commit()
            print("Migration completed successfully!")

        # Remove hardcoded GENERATED column from employee_schedules
        cursor.execute("SELECT sql FROM sqlite_master WHERE type='table' AND name='employee_schedules'")
        es_result = cursor.fetchone()
        if es_result and 'GENERATED ALWAYS AS' in es_result[0]:
            print("Migrating employee_schedules to remove hardcoded GENERATED column...")
            cursor.execute('''
                CREATE TABLE employee_schedules_new (
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
            ''')
            cursor.execute('''
                INSERT INTO employee_schedules_new (id, employee_id, month, year, reserved_hours_per_day, created_at, updated_at)
                SELECT id, employee_id, month, year, reserved_hours_per_day, created_at, updated_at
                FROM employee_schedules
            ''')
            cursor.execute('DROP TABLE employee_schedules')
            cursor.execute('ALTER TABLE employee_schedules_new RENAME TO employee_schedules')
            self.conn.commit()
            print("employee_schedules migration completed!")

        # Add business_unit to projects table if missing
        cursor.execute('PRAGMA table_info(projects)')
        project_columns = [row[1] for row in cursor.fetchall()]
        if 'business_unit' not in project_columns:
            print("Migrating projects table to add business_unit column...")
            cursor.execute('ALTER TABLE projects ADD COLUMN business_unit TEXT')
            self.conn.commit()
            print("Projects migration completed successfully!")

        # Add priority to projects table if missing
        cursor.execute('PRAGMA table_info(projects)')
        project_columns = [row[1] for row in cursor.fetchall()]
        if 'priority' not in project_columns:
            print("Migrating projects table to add priority column...")
            cursor.execute('ALTER TABLE projects ADD COLUMN priority INTEGER DEFAULT 1')
            self.conn.commit()
            print("Projects priority migration completed successfully!")

        # Add business_analyst_id to projects table if missing
        cursor.execute('PRAGMA table_info(projects)')
        project_columns = [row[1] for row in cursor.fetchall()]
        if 'business_analyst_id' not in project_columns:
            print("Migrating projects table to add business_analyst_id column...")
            cursor.execute('ALTER TABLE projects ADD COLUMN business_analyst_id INTEGER REFERENCES employees(id)')
            self.conn.commit()
            print("Projects business_analyst_id migration completed successfully!")

        # Add role to project_bookings table if missing
        cursor.execute('PRAGMA table_info(project_bookings)')
        booking_columns = [row[1] for row in cursor.fetchall()]
        if 'role' not in booking_columns:
            print("Migrating project_bookings table to add role column...")
            cursor.execute('ALTER TABLE project_bookings ADD COLUMN role TEXT')
            self.conn.commit()
            print("project_bookings role migration completed successfully!")

        # Rename department: Solution Architect -> Solution Architecture
        cursor.execute("SELECT COUNT(*) FROM employees WHERE department = 'Solution Architect'")
        if cursor.fetchone()[0] > 0:
            print("Migrating department 'Solution Architect' -> 'Solution Architecture'...")
            cursor.execute("UPDATE employees SET department = 'Solution Architecture', updated_at = CURRENT_TIMESTAMP WHERE department = 'Solution Architect'")
            self.conn.commit()
            print("Solution Architect department rename completed!")

        # Create employee_business_rules table if not yet created (needed before seeding below)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS employee_business_rules (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                employee_id INTEGER NOT NULL UNIQUE,
                work_hours_per_day REAL,
                work_days_per_month REAL,
                months_in_year INTEGER,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (employee_id) REFERENCES employees (id)
            )
        ''')

        # Seed custom business rules for specific employees
        target_employees = ['Ziyad Albattah', 'Khalid Albakr', 'Julian Paglione', 'Tan Mutalib']
        for name in target_employees:
            cursor.execute("SELECT id FROM employees WHERE full_name = ?", (name,))
            emp = cursor.fetchone()
            if emp:
                cursor.execute("SELECT id FROM employee_business_rules WHERE employee_id = ?", (emp[0],))
                if not cursor.fetchone():
                    print(f"Seeding custom business rules for employee: {name}")
                    cursor.execute('''
                        INSERT INTO employee_business_rules (employee_id, work_hours_per_day, work_days_per_month, months_in_year)
                        VALUES (?, ?, ?, ?)
                    ''', (emp[0], 7, 5.2388, 12))
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