from typing import Optional, Dict, Any, List
from datetime import date, datetime
from database import db
from controllers.settings_controller import SettingsController

class EmployeeReservation:
    def __init__(self, **kwargs):
        self.id = kwargs.get('id')
        self.employee_id = kwargs.get('employee_id')
        self.start_date = kwargs.get('start_date')
        self.end_date = kwargs.get('end_date')
        self.reserved_hours_per_day = kwargs.get('reserved_hours_per_day', 0)
        self.reason = kwargs.get('reason')
        self.status = kwargs.get('status', 'active')
        self.created_at = kwargs.get('created_at')
        self.updated_at = kwargs.get('updated_at')
    
    @staticmethod
    def create(employee_id: int, start_date: date, end_date: date, 
               reserved_hours_per_day: float, reason: str = None) -> 'EmployeeReservation':
        """Create a new reservation"""
        if end_date < start_date:
            raise ValueError("End date must be after or equal to start date")
        
        max_hours = SettingsController.get_work_hours_per_day()
        if reserved_hours_per_day < 0 or reserved_hours_per_day > max_hours:
            raise ValueError(f"Reserved hours per day must be between 0 and {max_hours}")
        
        # Check for overlapping reservations
        overlap_query = '''
            SELECT id FROM employee_reservations
            WHERE employee_id = ? 
                AND status = 'active'
                AND (
                    (start_date <= ? AND end_date >= ?)
                    OR (start_date <= ? AND end_date >= ?)
                    OR (start_date >= ? AND end_date <= ?)
                )
        '''
        existing = db.fetch_one(overlap_query, (
            employee_id,
            start_date, start_date,
            end_date, end_date,
            start_date, end_date
        ))
        
        if existing:
            raise ValueError("Overlapping reservation already exists for this period")
        
        query = '''
            INSERT INTO employee_reservations 
            (employee_id, start_date, end_date, reserved_hours_per_day, reason)
            VALUES (?, ?, ?, ?, ?)
        '''
        cursor = db.execute(query, (employee_id, start_date, end_date, 
                                   reserved_hours_per_day, reason))
        db.commit()
        return EmployeeReservation.get_by_id(cursor.lastrowid)
    
    @staticmethod
    def get_by_id(reservation_id: int) -> Optional['EmployeeReservation']:
        query = 'SELECT * FROM employee_reservations WHERE id = ?'
        row = db.fetch_one(query, (reservation_id,))
        return EmployeeReservation(**row) if row else None
    
    @staticmethod
    def get_by_employee(employee_id: int, include_cancelled: bool = False) -> List['EmployeeReservation']:
        """Get all reservations for an employee"""
        if include_cancelled:
            query = '''
                SELECT * FROM employee_reservations 
                WHERE employee_id = ?
                ORDER BY start_date DESC
            '''
        else:
            query = '''
                SELECT * FROM employee_reservations 
                WHERE employee_id = ? AND status = 'active'
                ORDER BY start_date DESC
            '''
        rows = db.fetch_all(query, (employee_id,))
        return [EmployeeReservation(**row) for row in rows]
    
    @staticmethod
    def get_active_reservations_for_date_range(employee_id: int, start_date: date, 
                                                end_date: date) -> List['EmployeeReservation']:
        """Get active reservations that overlap with a given date range"""
        query = '''
            SELECT * FROM employee_reservations
            WHERE employee_id = ? 
                AND status = 'active'
                AND (
                    (start_date <= ? AND end_date >= ?)
                    OR (start_date <= ? AND end_date >= ?)
                    OR (start_date >= ? AND end_date <= ?)
                )
            ORDER BY start_date
        '''
        rows = db.fetch_all(query, (
            employee_id,
            start_date, start_date,
            end_date, end_date,
            start_date, end_date
        ))
        return [EmployeeReservation(**row) for row in rows]
    
    def update(self, **kwargs) -> 'EmployeeReservation':
        """Update reservation details"""
        updates = []
        params = []
        
        if 'start_date' in kwargs:
            updates.append('start_date = ?')
            params.append(kwargs['start_date'])
        if 'end_date' in kwargs:
            updates.append('end_date = ?')
            params.append(kwargs['end_date'])
        if 'reserved_hours_per_day' in kwargs:
            max_hours = SettingsController.get_work_hours_per_day()
            if kwargs['reserved_hours_per_day'] < 0 or kwargs['reserved_hours_per_day'] > max_hours:
                raise ValueError(f"Reserved hours per day must be between 0 and {max_hours}")
            updates.append('reserved_hours_per_day = ?')
            params.append(kwargs['reserved_hours_per_day'])
        if 'reason' in kwargs:
            updates.append('reason = ?')
            params.append(kwargs['reason'])
        if 'status' in kwargs:
            updates.append('status = ?')
            params.append(kwargs['status'])
        
        if updates:
            updates.append('updated_at = CURRENT_TIMESTAMP')
            params.append(self.id)
            query = f'UPDATE employee_reservations SET {", ".join(updates)} WHERE id = ?'
            db.execute(query, tuple(params))
            db.commit()
        
        return EmployeeReservation.get_by_id(self.id)
    
    def cancel(self) -> 'EmployeeReservation':
        """Cancel this reservation"""
        return self.update(status='cancelled')
    
    def delete(self) -> bool:
        """Delete this reservation"""
        try:
            query = 'DELETE FROM employee_reservations WHERE id = ?'
            db.execute(query, (self.id,))
            db.commit()
            return True
        except Exception as e:
            db.rollback()
            raise e
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'employee_id': self.employee_id,
            'start_date': self.start_date.isoformat() if isinstance(self.start_date, date) else self.start_date,
            'end_date': self.end_date.isoformat() if isinstance(self.end_date, date) else self.end_date,
            'reserved_hours_per_day': self.reserved_hours_per_day,
            'reason': self.reason,
            'status': self.status,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }
