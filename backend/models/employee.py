from typing import Optional, Dict, Any, List
from datetime import datetime
from database import db

class Employee:
    def __init__(self, **kwargs):
        self.id = kwargs.get('id')
        self.full_name = kwargs.get('full_name')
        self.department = kwargs.get('department')
        self.position = kwargs.get('position')
        self.line_manager_id = kwargs.get('line_manager_id')
        self.total_hours_per_day = kwargs.get('total_hours_per_day', 6)
        self.available_days_per_year = kwargs.get('available_days_per_year', 240)
        self.status = kwargs.get('status', 'active')
        self.created_at = kwargs.get('created_at')
        self.updated_at = kwargs.get('updated_at')
    
    @staticmethod
    def create(full_name: str, department: str, 
               position: str, line_manager_id: int, available_days_per_year: int = 240) -> 'Employee':
        query = '''
            INSERT INTO employees (full_name, department, position, 
                                  line_manager_id, available_days_per_year)
            VALUES (?, ?, ?, ?, ?)
        '''
        cursor = db.execute(query, (full_name, department, 
                                   position, line_manager_id, available_days_per_year))
        db.commit()
        
        # Initialize schedule for the current year
        employee = Employee.get_by_id(cursor.lastrowid)
        if employee:
            employee.initialize_schedule()
        
        return employee
    
    @staticmethod
    def get_by_id(emp_id: int) -> Optional['Employee']:
        query = 'SELECT * FROM employees WHERE id = ?'
        row = db.fetch_one(query, (emp_id,))
        return Employee(**row) if row else None
    

    
    @staticmethod
    def get_by_line_manager(manager_id: int) -> List['Employee']:
        query = 'SELECT * FROM employees WHERE line_manager_id = ? AND status = "active" ORDER BY full_name'
        rows = db.fetch_all(query, (manager_id,))
        return [Employee(**row) for row in rows]
    
    @staticmethod
    def get_all_active() -> List['Employee']:
        query = 'SELECT * FROM employees WHERE status = "active" ORDER BY department, full_name'
        rows = db.fetch_all(query)
        return [Employee(**row) for row in rows]
    
    def initialize_schedule(self, year: int = None):
        """Initialize schedule for all months of the year"""
        if year is None:
            year = datetime.now().year
        
        # Check if schedule already exists
        check_query = 'SELECT COUNT(*) as count FROM employee_schedules WHERE employee_id = ? AND year = ?'
        result = db.fetch_one(check_query, (self.id, year))
        
        if result['count'] == 0:
            # Create schedule for all months
            months = [(self.id, month, year, 0) for month in range(1, 13)]
            insert_query = '''
                INSERT INTO employee_schedules (employee_id, month, year, reserved_hours_per_day)
                VALUES (?, ?, ?, ?)
            '''
            db.execute_many(insert_query, months)
            db.commit()
    
    def update(self, **kwargs) -> 'Employee':
        updates = []
        params = []
        
        if 'full_name' in kwargs:
            updates.append('full_name = ?')
            params.append(kwargs['full_name'])
        if 'department' in kwargs:
            updates.append('department = ?')
            params.append(kwargs['department'])
        if 'position' in kwargs:
            updates.append('position = ?')
            params.append(kwargs['position'])
        if 'available_days_per_year' in kwargs:
            updates.append('available_days_per_year = ?')
            params.append(kwargs['available_days_per_year'])
        if 'status' in kwargs:
            updates.append('status = ?')
            params.append(kwargs['status'])
        
        if updates:
            updates.append('updated_at = CURRENT_TIMESTAMP')
            params.append(self.id)
            query = f'UPDATE employees SET {", ".join(updates)} WHERE id = ?'
            db.execute(query, tuple(params))
            db.commit()
        
        return Employee.get_by_id(self.id)
    
    def delete(self) -> bool:
        """Delete employee and associated data"""
        try:
            # Delete associated schedules
            db.execute('DELETE FROM employee_schedules WHERE employee_id = ?', (self.id,))
            
            # Delete associated project bookings
            db.execute('DELETE FROM project_bookings WHERE employee_id = ?', (self.id,))
            
            # Delete employee
            db.execute('DELETE FROM employees WHERE id = ?', (self.id,))
            
            db.commit()
            return True
        except Exception as e:
            db.rollback()
            raise e
    
    def get_schedule(self, year: int = None) -> List[Dict[str, Any]]:
        if year is None:
            year = datetime.now().year
        
        query = '''
            SELECT * FROM employee_schedules 
            WHERE employee_id = ? AND year = ? 
            ORDER BY month
        '''
        rows = db.fetch_all(query, (self.id, year))
        return rows
    
    def get_monthly_schedule(self, month: int, year: int = None) -> Optional[Dict[str, Any]]:
        if year is None:
            year = datetime.now().year
        
        query = '''
            SELECT * FROM employee_schedules 
            WHERE employee_id = ? AND month = ? AND year = ?
        '''
        return db.fetch_one(query, (self.id, month, year))
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'full_name': self.full_name,
            'department': self.department,
            'position': self.position,
            'line_manager_id': self.line_manager_id,
            'total_hours_per_day': self.total_hours_per_day,
            'available_days_per_year': self.available_days_per_year,
            'status': self.status,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }