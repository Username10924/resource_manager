import json
from typing import Optional, Dict, Any, List
from datetime import datetime, date
from database import db

class Project:
    def __init__(self, **kwargs):
        self.id = kwargs.get('id')
        self.project_code = kwargs.get('project_code')
        self.name = kwargs.get('name')
        self.description = kwargs.get('description')
        self.status = kwargs.get('status', 'planned')
        self.progress = kwargs.get('progress', 0)
        self.solution_architect_id = kwargs.get('solution_architect_id')
        self.start_date = kwargs.get('start_date')
        self.end_date = kwargs.get('end_date')
        self.attachments = json.loads(kwargs['attachments']) if kwargs.get('attachments') else []
        self.created_at = kwargs.get('created_at')
        self.updated_at = kwargs.get('updated_at')
    
    @staticmethod
    def create(project_code: str, name: str, description: str, 
               solution_architect_id: int, start_date: date = None, 
               end_date: date = None, attachments: List[str] = None) -> 'Project':
        attachments_json = json.dumps(attachments or [])
        query = '''
            INSERT INTO projects (project_code, name, description, solution_architect_id, 
                                 start_date, end_date, attachments)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        '''
        cursor = db.execute(query, (project_code, name, description, solution_architect_id,
                                   start_date, end_date, attachments_json))
        db.commit()
        return Project.get_by_id(cursor.lastrowid)
    
    @staticmethod
    def get_by_id(project_id: int) -> Optional['Project']:
        query = 'SELECT * FROM projects WHERE id = ?'
        row = db.fetch_one(query, (project_id,))
        return Project(**row) if row else None
    
    @staticmethod
    def get_by_code(project_code: str) -> Optional['Project']:
        query = 'SELECT * FROM projects WHERE project_code = ?'
        row = db.fetch_one(query, (project_code,))
        return Project(**row) if row else None
    
    @staticmethod
    def get_by_architect(architect_id: int) -> List['Project']:
        query = 'SELECT * FROM projects WHERE solution_architect_id = ? ORDER BY created_at DESC'
        rows = db.fetch_all(query, (architect_id,))
        projects = [Project(**row) for row in rows]
        # Convert to dict to get parsed attachments
        return [p.to_dict() for p in projects]
    
    @staticmethod
    def get_all() -> List['Project']:
        query = '''
            SELECT p.*, u.full_name as architect_name 
            FROM projects p
            LEFT JOIN users u ON p.solution_architect_id = u.id
            ORDER BY p.created_at DESC
        '''
        rows = db.fetch_all(query)
        # Parse attachments JSON for each row
        for row in rows:
            if row.get('attachments'):
                try:
                    row['attachments'] = json.loads(row['attachments'])
                except (json.JSONDecodeError, TypeError):
                    row['attachments'] = []
            else:
                row['attachments'] = []
        return rows
    
    def update(self, **kwargs) -> 'Project':
        updates = []
        params = []
        
        if 'name' in kwargs:
            updates.append('name = ?')
            params.append(kwargs['name'])
        if 'description' in kwargs:
            updates.append('description = ?')
            params.append(kwargs['description'])
        if 'status' in kwargs:
            updates.append('status = ?')
            params.append(kwargs['status'])
        if 'progress' in kwargs:
            updates.append('progress = ?')
            params.append(kwargs['progress'])
        if 'start_date' in kwargs:
            updates.append('start_date = ?')
            params.append(kwargs['start_date'])
        if 'end_date' in kwargs:
            updates.append('end_date = ?')
            params.append(kwargs['end_date'])
        if 'solution_architect_id' in kwargs:
            updates.append('solution_architect_id = ?')
            params.append(kwargs['solution_architect_id'])
        if 'attachments' in kwargs:
            attachments_json = json.dumps(kwargs['attachments'])
            updates.append('attachments = ?')
            params.append(attachments_json)
        
        if updates:
            updates.append('updated_at = CURRENT_TIMESTAMP')
            params.append(self.id)
            query = f'UPDATE projects SET {", ".join(updates)} WHERE id = ?'
            db.execute(query, tuple(params))
            db.commit()
        
        return Project.get_by_id(self.id)
    
    def delete(self) -> bool:
        """Delete the project and all its bookings"""
        try:
            # First delete all associated bookings
            query = 'DELETE FROM project_bookings WHERE project_id = ?'
            db.execute(query, (self.id,))
            
            # Then delete the project
            query = 'DELETE FROM projects WHERE id = ?'
            db.execute(query, (self.id,))
            db.commit()
            return True
        except Exception as e:
            db.rollback()
            raise Exception(f'Failed to delete project: {str(e)}')
    
    def add_booking(self, employee_id: int, start_date: date, end_date: date, 
                   booked_hours: float) -> Dict[str, Any]:
        """Book an employee for this project with date range"""
        if end_date < start_date:
            raise ValueError("End date must be after start date")
        
        # Check if employee exists
        from models.employee import Employee
        employee = Employee.get_by_id(employee_id)
        if not employee:
            raise ValueError("Employee not found")
        
        # Note: For now, we're removing the complex availability checking
        # as it was tied to monthly schedules. You may want to implement
        # a new availability checking system based on date ranges.
        
        # Check for overlapping bookings
        check_query = '''
            SELECT id, booked_hours, start_date, end_date FROM project_bookings 
            WHERE project_id = ? AND employee_id = ? 
                AND status != 'cancelled'
                AND (
                    (start_date <= ? AND end_date >= ?)
                    OR (start_date <= ? AND end_date >= ?)
                    OR (start_date >= ? AND end_date <= ?)
                )
        '''
        existing_booking = db.fetch_one(check_query, (
            self.id, employee_id, 
            start_date, start_date,  # Check if existing booking overlaps start_date
            end_date, end_date,      # Check if existing booking overlaps end_date
            start_date, end_date     # Check if new booking fully contains existing
        ))
        
        if existing_booking:
            raise ValueError(
                f"Overlapping booking exists from {existing_booking['start_date']} "
                f"to {existing_booking['end_date']}. Please adjust the dates or cancel the existing booking."
            )
        
        # Create new booking
        query = '''
            INSERT INTO project_bookings (project_id, employee_id, start_date, end_date, 
                                        booked_hours)
            VALUES (?, ?, ?, ?, ?)
        '''
        cursor = db.execute(query, (self.id, employee_id, start_date, end_date, booked_hours))
        db.commit()
        
        return {'booking_id': cursor.lastrowid, 'message': 'Booking successful'}
    
    def get_bookings(self) -> List[Dict[str, Any]]:
        query = '''
            SELECT pb.*, e.full_name, e.department
            FROM project_bookings pb
            JOIN employees e ON pb.employee_id = e.id
            WHERE pb.project_id = ?
            ORDER BY pb.start_date DESC
        '''
        return db.fetch_all(query, (self.id,))
    
    def get_date_range_bookings(self, start_date: date, end_date: date) -> List[Dict[str, Any]]:
        """Get bookings that overlap with the given date range"""
        query = '''
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
        '''
        return db.fetch_all(query, (
            self.id, 
            start_date, start_date,
            end_date, end_date,
            start_date, end_date
        ))
    
    def to_dict(self) -> Dict[str, Any]:
        # Helper to format dates - they might be strings or date objects from DB
        def format_date(d):
            if d is None:
                return None
            if isinstance(d, str):
                return d  # Already a string, return as-is
            return d.isoformat()  # Date object, convert to ISO format
        
        return {
            'id': self.id,
            'project_code': self.project_code,
            'name': self.name,
            'description': self.description,
            'status': self.status,
            'progress': self.progress,
            'solution_architect_id': self.solution_architect_id,
            'start_date': format_date(self.start_date),
            'end_date': format_date(self.end_date),
            'attachments': self.attachments,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }