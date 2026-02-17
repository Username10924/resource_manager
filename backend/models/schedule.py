from typing import Optional, Dict, Any, List
from datetime import datetime
from database import db
from controllers.settings_controller import SettingsController

class EmployeeSchedule:
    def __init__(self, **kwargs):
        self.id = kwargs.get('id')
        self.employee_id = kwargs.get('employee_id')
        self.month = kwargs.get('month')
        self.year = kwargs.get('year')
        self.reserved_hours_per_day = kwargs.get('reserved_hours_per_day', 0)
        self.available_hours_per_month = kwargs.get('available_hours_per_month', 0)
        self.created_at = kwargs.get('created_at')
        self.updated_at = kwargs.get('updated_at')

    @staticmethod
    def enrich_schedule_dicts(rows):
        """Add dynamically computed available_hours_per_month to raw schedule dicts using live settings."""
        settings = SettingsController.get_settings()
        whpd = settings['work_hours_per_day']
        wdpm = settings['work_days_per_month']
        for row in rows:
            reserved = row.get('reserved_hours_per_day') or 0
            row['available_hours_per_month'] = max(0, (whpd - reserved) * wdpm)
        return rows
    
    @staticmethod
    def get_by_id(schedule_id: int) -> Optional['EmployeeSchedule']:
        query = 'SELECT * FROM employee_schedules WHERE id = ?'
        row = db.fetch_one(query, (schedule_id,))
        return EmployeeSchedule(**row) if row else None
    
    @staticmethod
    def get_employee_schedule(employee_id: int, month: int, year: int) -> Optional['EmployeeSchedule']:
        query = '''
            SELECT * FROM employee_schedules 
            WHERE employee_id = ? AND month = ? AND year = ?
        '''
        row = db.fetch_one(query, (employee_id, month, year))
        return EmployeeSchedule(**row) if row else None
    
    @staticmethod
    def get_employee_yearly_schedule(employee_id: int, year: int) -> List[Dict[str, Any]]:
        query = '''
            SELECT es.*, e.full_name, e.department
            FROM employee_schedules es
            JOIN employees e ON es.employee_id = e.id
            WHERE es.employee_id = ? AND es.year = ?
            ORDER BY es.month
        '''
        rows = db.fetch_all(query, (employee_id, year))
        return EmployeeSchedule.enrich_schedule_dicts(rows)
    
    @staticmethod
    def get_team_schedule(manager_id: int, month: int, year: int) -> List[Dict[str, Any]]:
        query = '''
            SELECT es.*, e.full_name, e.department, e.position, e.employee_id
            FROM employee_schedules es
            JOIN employees e ON es.employee_id = e.id
            WHERE e.line_manager_id = ? AND es.month = ? AND es.year = ?
            ORDER BY e.full_name
        '''
        return db.fetch_all(query, (manager_id, month, year))
    
    def update_reserved_hours(self, reserved_hours: float) -> 'EmployeeSchedule':
        """Update reserved hours and recalculate available hours"""
        work_hours_per_day = SettingsController.get_work_hours_per_day()
        if reserved_hours > work_hours_per_day:
            raise ValueError(f"Reserved hours cannot exceed {work_hours_per_day} hours per day")
        
        query = '''
            UPDATE employee_schedules 
            SET reserved_hours_per_day = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        '''
        db.execute(query, (reserved_hours, self.id))
        db.commit()
        
        # Get updated record
        updated = EmployeeSchedule.get_by_id(self.id)
        return updated
    
    def get_available_hours(self) -> float:
        """Calculate available hours for the month"""
        settings = SettingsController.get_settings()
        work_hours_per_day = settings['work_hours_per_day']
        work_days_per_month = settings['work_days_per_month']
        available = (work_hours_per_day - self.reserved_hours_per_day) * work_days_per_month
        return max(0, available)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'employee_id': self.employee_id,
            'month': self.month,
            'year': self.year,
            'reserved_hours_per_day': self.reserved_hours_per_day,
            'available_hours_per_month': self.get_available_hours(),
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }