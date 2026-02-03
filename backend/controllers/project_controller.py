import json
from typing import List, Dict, Any, Optional
from datetime import date, datetime
from models.project import Project
from models.user import User
from models.employee import Employee
from models.schedule import EmployeeSchedule

class ProjectController:
    @staticmethod
    def create_project(project_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new project"""
        required_fields = ['project_code', 'name', 'description', 'solution_architect_id']
        
        for field in required_fields:
            if field not in project_data:
                return {'error': f'Missing required field: {field}'}
        
        # Check if solution architect exists
        architect = User.get_by_id(project_data['solution_architect_id'])
        if not architect or architect.role != 'solution_architect':
            return {'error': 'Invalid solution architect'}
        
        # Check if project code already exists
        existing = Project.get_by_code(project_data['project_code'])
        if existing:
            return {'error': 'Project code already exists'}
        
        project = Project.create(
            project_code=project_data['project_code'],
            name=project_data['name'],
            description=project_data['description'],
            solution_architect_id=project_data['solution_architect_id'],
            start_date=project_data.get('start_date'),
            end_date=project_data.get('end_date'),
            attachments=project_data.get('attachments', [])
        )
        
        return {'success': True, 'project': project.to_dict()}
    
    @staticmethod
    def update_project(project_id: int, update_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update project details"""
        project = Project.get_by_id(project_id)
        if not project:
            return {'error': 'Project not found'}
        
        try:
            updated_project = project.update(**update_data)
            return {'success': True, 'project': updated_project.to_dict()}
        except Exception as e:
            return {'error': str(e)}
    
    @staticmethod
    def delete_project(project_id: int) -> Dict[str, Any]:
        """Delete a project and all its bookings"""
        project = Project.get_by_id(project_id)
        if not project:
            return {'error': 'Project not found'}
        
        try:
            project.delete()
            return {'success': True, 'message': 'Project deleted successfully'}
        except Exception as e:
            return {'error': str(e)}
    
    @staticmethod
    def book_employee_for_project(project_id: int, booking_data: Dict[str, Any]) -> Dict[str, Any]:
        """Book an employee for a project with date range"""
        required_fields = ['employee_id', 'start_date', 'end_date', 'booked_hours']
        
        for field in required_fields:
            if field not in booking_data:
                return {'error': f'Missing required field: {field}'}
        
        project = Project.get_by_id(project_id)
        if not project:
            return {'error': 'Project not found'}
        
        employee = Employee.get_by_id(booking_data['employee_id'])
        if not employee:
            return {'error': 'Employee not found'}
        
        # Note: Availability checking has been simplified
        # You may want to implement more sophisticated availability logic
        # based on your business rules for date-based bookings
        
        try:
            result = project.add_booking(
                employee_id=booking_data['employee_id'],
                start_date=booking_data['start_date'],
                end_date=booking_data['end_date'],
                booked_hours=booking_data['booked_hours']
            )
            
            # Log the booking
            ProjectController._log_booking(project_id, employee.id, booking_data)
            
            return {'success': True, 'booking': result}
        except ValueError as e:
            return {'error': str(e)}
        except Exception as e:
            return {'error': f'Booking failed: {str(e)}'}
    
    @staticmethod
    def get_available_employees(start_date: date, end_date: date, department: str = None) -> List[Dict[str, Any]]:
        """Get employees with booking information for a date range"""
        from database import db
        
        # Get all active employees
        employees = Employee.get_all_active()
        
        available_employees = []
        for emp in employees:
            if department and emp.department != department:
                continue
            
            # Get overlapping bookings for this employee in the date range
            query = '''
                SELECT COUNT(*) as booking_count, 
                       COALESCE(SUM(booked_hours), 0) as total_booked_hours
                FROM project_bookings 
                WHERE employee_id = ? 
                    AND status != 'cancelled'
                    AND (
                        (start_date <= ? AND end_date >= ?)
                        OR (start_date <= ? AND end_date >= ?)
                        OR (start_date >= ? AND end_date <= ?)
                    )
            '''
            result = db.fetch_one(query, (
                emp.id,
                start_date, start_date,
                end_date, end_date,
                start_date, end_date
            ))
            
            booking_count = result['booking_count'] or 0
            total_booked_hours = result['total_booked_hours'] or 0
            
            # Add all employees with their booking information
            # The frontend/user can decide if they want to book overlapping periods
            available_employees.append({
                'employee': emp.to_dict(),
                'booking_count_in_range': booking_count,
                'total_booked_hours_in_range': total_booked_hours,
                'has_overlapping_bookings': booking_count > 0
            })
        
        return available_employees
    
    @staticmethod
    def _log_booking(project_id: int, employee_id: int, booking_data: Dict[str, Any]):
        """Log booking activity"""
        from database import db
        query = '''
            INSERT INTO audit_log (action, table_name, record_id, changes)
            VALUES (?, ?, ?, ?)
        '''
        changes = json.dumps({
            'project_id': project_id,
            'employee_id': employee_id,
            'booking_data': booking_data,
            'timestamp': datetime.now().isoformat()
        })
        db.execute(query, ('BOOK_EMPLOYEE', 'project_bookings', None, changes))
        db.commit()