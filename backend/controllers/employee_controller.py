from typing import List, Dict, Any, Optional
from models.employee import Employee
from models.user import User
from models.schedule import EmployeeSchedule
from controllers.settings_controller import SettingsController

class EmployeeController:
    @staticmethod
    def create_employee(employee_data: Dict[str, Any]) -> Dict[str, Any]:
        """Create a new employee"""
        required_fields = ['full_name', 'department', 
                          'position', 'line_manager_id']
        
        for field in required_fields:
            if field not in employee_data:
                return {'error': f'Missing required field: {field}'}
        
        # Check if line manager exists
        manager = User.get_by_id(employee_data['line_manager_id'])
        if not manager or manager.role != 'line_manager':
            return {'error': 'Invalid line manager'}
        
        employee = Employee.create(
            full_name=employee_data['full_name'],
            department=employee_data['department'],
            position=employee_data['position'],
            line_manager_id=employee_data['line_manager_id']
        )
        
        return {'success': True, 'employee': employee.to_dict()}
    
    @staticmethod
    def get_employee_by_id(employee_id: int) -> Optional[Dict[str, Any]]:
        """Get employee details by ID"""
        employee = Employee.get_by_id(employee_id)
        if not employee:
            return None
        
        result = employee.to_dict()
        
        # Get line manager details
        manager = User.get_by_id(employee.line_manager_id)
        if manager:
            result['line_manager'] = manager.full_name
        
        # Get current year schedule
        from datetime import datetime
        current_year = datetime.now().year
        schedule = employee.get_schedule(current_year)
        result['schedule'] = schedule
        
        return result
    
    @staticmethod
    def update_employee_schedule(employee_id: int, month: int, year: int, 
                                reserved_hours: float) -> Dict[str, Any]:
        """Update employee's schedule for a specific month"""
        employee = Employee.get_by_id(employee_id)
        if not employee:
            return {'error': 'Employee not found'}
        
        schedule = EmployeeSchedule.get_employee_schedule(employee_id, month, year)
        if not schedule:
            # Initialize schedule if it doesn't exist
            employee.initialize_schedule(year)
            schedule = EmployeeSchedule.get_employee_schedule(employee_id, month, year)
        
        try:
            updated_schedule = schedule.update_reserved_hours(reserved_hours)
            return {
                'success': True,
                'schedule': updated_schedule.to_dict()
            }
        except ValueError as e:
            return {'error': str(e)}
    
    @staticmethod
    def get_employee_schedule_details(employee_id: int, year: int = None) -> Dict[str, Any]:
        """Get detailed schedule for an employee"""
        employee = Employee.get_by_id(employee_id)
        if not employee:
            return {'error': 'Employee not found'}
        
        if year is None:
            from datetime import datetime
            year = datetime.now().year
        
        schedule = EmployeeSchedule.get_employee_yearly_schedule(employee_id, year)
        
        # Get effective settings for this employee (per-employee overrides or global)
        settings = SettingsController.get_settings_for_employee(employee_id)
        work_hours_per_day = settings['work_hours_per_day']
        work_days_per_month = settings['work_days_per_month']
        
        # Calculate totals - recalculate available hours dynamically
        total_reserved = sum(s['reserved_hours_per_day'] * work_days_per_month for s in schedule)
        total_available = sum(
            (work_hours_per_day - (s['reserved_hours_per_day'] or 0)) * work_days_per_month 
            for s in schedule
        )
        
        return {
            'employee': employee.to_dict(),
            'schedule': schedule,
            'totals': {
                'total_reserved_hours': total_reserved,
                'total_available_hours': total_available,
                'work_days_per_month': work_days_per_month,
                'work_hours_per_day': work_hours_per_day
            }
        }
    
    @staticmethod
    def update_employee(employee_id: int, employee_data: Dict[str, Any]) -> Dict[str, Any]:
        """Update employee details"""
        employee = Employee.get_by_id(employee_id)
        if not employee:
            return {'error': 'Employee not found'}
        
        try:
            # Only allow updating specific fields
            allowed_fields = ['full_name', 'department', 'position']
            update_data = {k: v for k, v in employee_data.items() if k in allowed_fields}
            
            if not update_data:
                return {'error': 'No valid fields to update'}
            
            updated_employee = employee.update(**update_data)
            return {'success': True, 'employee': updated_employee.to_dict()}
        except Exception as e:
            return {'error': f'Failed to update employee: {str(e)}'}
    
    @staticmethod
    def delete_employee(employee_id: int) -> Dict[str, Any]:
        """Delete an employee"""
        employee = Employee.get_by_id(employee_id)
        if not employee:
            return {'error': 'Employee not found'}
        
        try:
            employee.delete()
            return {'success': True, 'message': 'Employee deleted successfully'}
        except Exception as e:
            return {'error': f'Failed to delete employee: {str(e)}'}