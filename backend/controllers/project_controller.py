import json
from typing import List, Dict, Any, Optional
from datetime import date, datetime
from models.project import Project
from models.employee import Employee
from models.schedule import EmployeeSchedule
from controllers.settings_controller import SettingsController

class ProjectController:
    @staticmethod
    def create_project(project_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new project"""
        required_fields = ['project_code', 'name', 'description', 'solution_architect_id']
        
        for field in required_fields:
            if field not in project_data:
                return {'error': f'Missing required field: {field}'}
        
        # Check if selected project manager (employee) exists
        manager = Employee.get_by_id(project_data['solution_architect_id'])
        if not manager:
            return {'error': 'Invalid project manager'}
        
        # Check if project code already exists
        existing = Project.get_by_code(project_data['project_code'])
        if existing:
            return {'error': 'Project code already exists'}
        
        project = Project.create(
            project_code=project_data['project_code'],
            name=project_data['name'],
            description=project_data['description'],
            solution_architect_id=project_data['solution_architect_id'],
            business_unit=project_data.get('business_unit'),
            start_date=project_data.get('start_date'),
            end_date=project_data.get('end_date'),
            priority=project_data.get('priority', 1),
            attachments=project_data.get('attachments', []),
            business_analyst_id=project_data.get('business_analyst_id')
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
        from database import db
        from models.reservation import EmployeeReservation
        from datetime import timedelta
        
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
        
        # Parse dates if they're strings
        start_date = booking_data['start_date']
        end_date = booking_data['end_date']
        booked_hours = booking_data['booked_hours']
        
        if isinstance(start_date, str):
            start_date = datetime.strptime(start_date, '%Y-%m-%d').date()
        if isinstance(end_date, str):
            end_date = datetime.strptime(end_date, '%Y-%m-%d').date()
        
        # Calculate working days
        def count_working_days(start, end):
            working_days = 0
            current = start
            while current <= end:
                if current.weekday() not in (4, 5):  # Weekend = Friday(4) + Saturday(5)
                    working_days += 1
                current += timedelta(days=1)
            return working_days
        
        total_working_days = count_working_days(start_date, end_date)
        max_hours_per_day = SettingsController.get_settings_for_employee(booking_data['employee_id'])['work_hours_per_day']
        total_max_hours = total_working_days * max_hours_per_day
        
        # Check existing bookings that overlap with this date range
        bookings_query = '''
            SELECT pb.*, p.name as project_name
            FROM project_bookings pb
            JOIN projects p ON pb.project_id = p.id
            WHERE pb.employee_id = ? 
              AND pb.status != 'cancelled'
              AND (
                  (pb.start_date <= ? AND pb.end_date >= ?)
                  OR (pb.start_date <= ? AND pb.end_date >= ?)
                  OR (pb.start_date >= ? AND pb.end_date <= ?)
              )
        '''
        existing_bookings = db.fetch_all(bookings_query, (
            booking_data['employee_id'],
            start_date, start_date,
            end_date, end_date,
            start_date, end_date
        ))
        
        # Calculate total booked hours from overlapping bookings
        total_booked_hours = 0
        for booking in existing_bookings:
            b_start = booking['start_date'] if isinstance(booking['start_date'], date) else datetime.strptime(str(booking['start_date']), '%Y-%m-%d').date()
            b_end = booking['end_date'] if isinstance(booking['end_date'], date) else datetime.strptime(str(booking['end_date']), '%Y-%m-%d').date()
            
            overlap_start = max(start_date, b_start)
            overlap_end = min(end_date, b_end)
            
            if overlap_start <= overlap_end:
                overlap_working_days = count_working_days(overlap_start, overlap_end)
                booking_total_working_days = count_working_days(b_start, b_end)
                
                if booking_total_working_days > 0:
                    hours_per_day = booking['booked_hours'] / booking_total_working_days
                    overlap_hours = hours_per_day * overlap_working_days
                    total_booked_hours += overlap_hours
        
        # Get reservations that overlap
        reservations = EmployeeReservation.get_active_reservations_for_date_range(
            booking_data['employee_id'], start_date, end_date
        )
        
        total_reserved_hours = 0
        for reservation in reservations:
            r_start = reservation.start_date if isinstance(reservation.start_date, date) else datetime.strptime(str(reservation.start_date), '%Y-%m-%d').date()
            r_end = reservation.end_date if isinstance(reservation.end_date, date) else datetime.strptime(str(reservation.end_date), '%Y-%m-%d').date()
            
            overlap_start = max(start_date, r_start)
            overlap_end = min(end_date, r_end)
            
            if overlap_start <= overlap_end:
                overlap_working_days = count_working_days(overlap_start, overlap_end)
                total_reserved_hours += reservation.reserved_hours_per_day * overlap_working_days
        
        total_utilized_hours = total_booked_hours + total_reserved_hours
        available_hours = max(0, total_max_hours - total_utilized_hours)
        
        # Validate that the requested hours don't exceed available hours
        if booked_hours > available_hours:
            return {
                'error': f'Cannot book {booked_hours} hours. Employee only has {round(available_hours, 1)} hours available in this period. '
                        f'Already utilized: {round(total_utilized_hours, 1)} hours ({round(total_booked_hours, 1)} booked + {round(total_reserved_hours, 1)} reserved). '
                        f'Maximum capacity: {total_max_hours} hours ({total_working_days} working days × {max_hours_per_day} hrs/day).'
            }
        
        try:
            result = project.add_booking(
                employee_id=booking_data['employee_id'],
                start_date=booking_data['start_date'],
                end_date=booking_data['end_date'],
                booked_hours=booking_data['booked_hours'],
                role=booking_data.get('role')
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
        
        # Convert date objects to strings for JSON serialization
        serializable_data = {}
        for key, value in booking_data.items():
            if isinstance(value, (date, datetime)):
                serializable_data[key] = value.isoformat()
            else:
                serializable_data[key] = value
        
        query = '''
            INSERT INTO audit_log (action, table_name, record_id, changes)
            VALUES (?, ?, ?, ?)
        '''
        changes = json.dumps({
            'project_id': project_id,
            'employee_id': employee_id,
            'booking_data': serializable_data,
            'timestamp': datetime.now().isoformat()
        })
        db.execute(query, ('BOOK_EMPLOYEE', 'project_bookings', None, changes))
        db.commit()