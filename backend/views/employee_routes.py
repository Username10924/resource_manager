from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, validator
from datetime import datetime

from controllers.employee_controller import EmployeeController
from controllers.settings_controller import SettingsController
from models.user import User
from dependencies import get_current_user

router = APIRouter(prefix="/api/employees", tags=["employees"])

# Pydantic models for request/response
class EmployeeCreate(BaseModel):
    full_name: str
    department: str
    position: str
    line_manager_id: int

class EmployeeUpdate(BaseModel):
    full_name: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None

class EmployeeResponse(BaseModel):
    id: int
    full_name: str
    department: str
    position: str
    line_manager_id: int
    status: str

class ScheduleUpdate(BaseModel):
    month: int
    year: int
    reserved_hours_per_day: float

    @validator('month')
    def validate_month(cls, v):
        if v < 1 or v > 12:
            raise ValueError('Month must be between 1 and 12')
        return v

    @validator('reserved_hours_per_day')
    def validate_hours(cls, v):
        # Basic range check - more specific validation done in route handler
        if v < 0 or v > 24:
            raise ValueError('Reserved hours must be between 0 and 24')
        return v

class EmployeeBusinessRulesUpdate(BaseModel):
    work_hours_per_day: Optional[float] = None
    work_days_per_month: Optional[float] = None
    months_in_year: Optional[int] = None

@router.post("", response_model=Dict[str, Any])
async def create_employee(employee: EmployeeCreate, current_user: User = Depends(get_current_user)):
    """Create a new employee"""
    employee_data = employee.dict()
    
    # Line managers can only create employees under themselves
    if current_user.role == 'line_manager':
        employee_data['line_manager_id'] = current_user.id
    
    result = EmployeeController.create_employee(employee_data)
    if 'error' in result:
        raise HTTPException(status_code=400, detail=result['error'])
    return result

@router.get("", response_model=List[EmployeeResponse])
async def get_employees(
    current_user: User = Depends(get_current_user),
    manager_id: Optional[int] = Query(None, description="Filter by line manager"),
    department: Optional[str] = Query(None, description="Filter by department")
):
    """Get list of employees"""
    from models.employee import Employee
    from models.user import User
    
    # Line managers can only see their own employees
    if current_user.role == 'line_manager':
        manager_id = current_user.id
    
    if manager_id:
        employees = Employee.get_by_line_manager(manager_id)
    else:
        employees = Employee.get_all_active()
    
    if department:
        employees = [e for e in employees if e.department == department]
    
    return [e.to_dict() for e in employees]

@router.get("/{employee_id}", response_model=Dict[str, Any])
async def get_employee(employee_id: int, current_user: User = Depends(get_current_user)):
    """Get employee details"""
    from models.employee import Employee
    
    # Get employee first to check line manager
    employee = Employee.get_by_id(employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Line managers can only see their own employees
    if current_user.role == 'line_manager' and employee.line_manager_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied: You can only view your own employees")
    
    result = EmployeeController.get_employee_by_id(employee_id)
    return result

@router.put("/{employee_id}", response_model=Dict[str, Any])
async def update_employee(employee_id: int, employee_data: EmployeeUpdate, current_user: User = Depends(get_current_user)):
    """Update employee details"""
    from models.employee import Employee
    
    # Get employee first to check line manager
    employee = Employee.get_by_id(employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Line managers can only update their own employees
    if current_user.role == 'line_manager' and employee.line_manager_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied: You can only update your own employees")
    
    # Convert to dict and remove None values
    update_data = {k: v for k, v in employee_data.dict().items() if v is not None}
    
    result = EmployeeController.update_employee(employee_id, update_data)
    if 'error' in result:
        raise HTTPException(status_code=400, detail=result['error'])
    return result

@router.post("/{employee_id}/update", response_model=Dict[str, Any])
async def update_employee_post(employee_id: int, employee_data: EmployeeUpdate, current_user: User = Depends(get_current_user)):
    """Update employee details (POST workaround for PUT blocking)"""
    from models.employee import Employee
    
    # Get employee first to check line manager
    employee = Employee.get_by_id(employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Line managers can only update their own employees
    if current_user.role == 'line_manager' and employee.line_manager_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied: You can only update your own employees")
    
    # Convert to dict and remove None values
    update_data = {k: v for k, v in employee_data.dict().items() if v is not None}
    
    result = EmployeeController.update_employee(employee_id, update_data)
    if 'error' in result:
        raise HTTPException(status_code=400, detail=result['error'])
    return result

@router.put("/{employee_id}/schedule", response_model=Dict[str, Any])
async def update_employee_schedule(employee_id: int, schedule: ScheduleUpdate, current_user: User = Depends(get_current_user)):
    """Update employee schedule"""
    from models.employee import Employee
    
    # Get employee first to check line manager
    employee = Employee.get_by_id(employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Line managers can only update their own employees
    if current_user.role == 'line_manager' and employee.line_manager_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied: You can only update your own employees")
    
    result = EmployeeController.update_employee_schedule(
        employee_id, 
        schedule.month, 
        schedule.year, 
        schedule.reserved_hours_per_day
    )
    if 'error' in result:
        raise HTTPException(status_code=400, detail=result['error'])
    return result

@router.get("/{employee_id}/schedule", response_model=Dict[str, Any])
async def get_employee_schedule(
    employee_id: int,
    current_user: User = Depends(get_current_user),
    year: Optional[int] = Query(None, description="Year for schedule")
):
    """Get employee schedule details"""
    from models.employee import Employee
    
    # Get employee first to check line manager
    employee = Employee.get_by_id(employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Line managers can only see their own employees' schedules
    if current_user.role == 'line_manager' and employee.line_manager_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied: You can only view your own employees' schedules")
    
    result = EmployeeController.get_employee_schedule_details(employee_id, year)
    if 'error' in result:
        raise HTTPException(status_code=404, detail=result['error'])
    return result

@router.get("/{employee_id}/availability/{month}/{year}", response_model=Dict[str, Any])
async def get_employee_availability(employee_id: int, month: int, year: int):
    """Check employee availability for a specific month"""
    from models.schedule import EmployeeSchedule
    from models.employee import Employee
    
    employee = Employee.get_by_id(employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    schedule = EmployeeSchedule.get_employee_schedule(employee_id, month, year)
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found for this period")
    
    # Get already booked hours - sum bookings that overlap with this month
    from database import db
    query = '''
        SELECT SUM(booked_hours) as booked_hours
        FROM project_bookings
        WHERE employee_id = ? 
          AND status != 'cancelled'
          AND strftime('%Y', start_date) <= CAST(? AS TEXT)
          AND strftime('%Y', end_date) >= CAST(? AS TEXT)
          AND CAST(strftime('%m', start_date) AS INTEGER) <= ?
          AND CAST(strftime('%m', end_date) AS INTEGER) >= ?
    '''
    result = db.fetch_one(query, (employee_id, year, year, month, month))
    booked_hours = result['booked_hours'] or 0
    
    # Include reserved hours as part of the booked hours for utilization
    work_days_per_month = SettingsController.get_settings_for_employee(employee_id)['work_days_per_month']
    reserved_hours_monthly = schedule.reserved_hours_per_day * work_days_per_month
    total_utilized_hours = booked_hours + reserved_hours_monthly
    
    available_hours = schedule.get_available_hours() - booked_hours
    
    return {
        'employee': employee.to_dict(),
        'schedule': schedule.to_dict(),
        'availability': {
            'total_available': schedule.get_available_hours(),
            'already_booked': booked_hours,
            'reserved_hours': reserved_hours_monthly,
            'total_utilized': total_utilized_hours,
            'currently_available': max(0, available_hours)
        }
    }

@router.get("/{employee_id}/projects/{month}/{year}", response_model=List[Dict[str, Any]])
async def get_employee_projects(employee_id: int, month: int, year: int):
    """Get employee's project bookings for a specific month"""
    from models.employee import Employee
    
    employee = Employee.get_by_id(employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Get project bookings for the employee that overlap with this month
    from database import db
    query = '''
        SELECT pb.*, p.name as project_name, p.project_code, p.status as project_status,
               p.attachments
        FROM project_bookings pb
        JOIN projects p ON pb.project_id = p.id
        WHERE pb.employee_id = ? 
          AND strftime('%Y', pb.start_date) <= CAST(? AS TEXT)
          AND strftime('%Y', pb.end_date) >= CAST(? AS TEXT)
          AND CAST(strftime('%m', pb.start_date) AS INTEGER) <= ?
          AND CAST(strftime('%m', pb.end_date) AS INTEGER) >= ?
        ORDER BY pb.start_date DESC
    '''
    bookings = db.fetch_all(query, (employee_id, year, year, month, month))
    
    # Parse attachments JSON for each booking
    import json
    for booking in bookings:
        if booking.get('attachments'):
            try:
                booking['attachments'] = json.loads(booking['attachments'])
            except:
                booking['attachments'] = []
        else:
            booking['attachments'] = []
    
    return bookings

@router.get("/{employee_id}/availability-range", response_model=Dict[str, Any])
async def get_employee_availability_for_date_range(
    employee_id: int,
    start_date: str = Query(..., description="Start date in YYYY-MM-DD format"),
    end_date: str = Query(..., description="End date in YYYY-MM-DD format")
):
    """Get employee's bookings, reservations, and available hours for a specific date range"""
    from models.employee import Employee
    from models.reservation import EmployeeReservation
    from database import db
    from datetime import datetime, timedelta
    
    employee = Employee.get_by_id(employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    # Validate dates
    try:
        start = datetime.strptime(start_date, '%Y-%m-%d').date()
        end = datetime.strptime(end_date, '%Y-%m-%d').date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")
    
    if end < start:
        raise HTTPException(status_code=400, detail="End date must be after start date")
    
    # Get existing bookings that overlap with this date range
    bookings_query = '''
        SELECT pb.*, p.name as project_name, p.project_code
        FROM project_bookings pb
        JOIN projects p ON pb.project_id = p.id
        WHERE pb.employee_id = ? 
          AND pb.status != 'cancelled'
          AND (
              (pb.start_date <= ? AND pb.end_date >= ?)
              OR (pb.start_date <= ? AND pb.end_date >= ?)
              OR (pb.start_date >= ? AND pb.end_date <= ?)
          )
        ORDER BY pb.start_date
    '''
    bookings = db.fetch_all(bookings_query, (
        employee_id,
        start, start,
        end, end,
        start, end
    ))
    
    # Get reservations that overlap with this date range
    reservations = EmployeeReservation.get_active_reservations_for_date_range(
        employee_id, start, end
    )
    
    # Calculate working days in the requested range
    def count_working_days(start_date, end_date):
        working_days = 0
        current = start_date
        while current <= end_date:
            # Weekend = Friday(4) + Saturday(5)
            if current.weekday() not in (4, 5):
                working_days += 1
            current += timedelta(days=1)
        return working_days
    
    # Calculate available hours considering overlapping bookings and reservations
    # We need to track utilization per day
    total_working_days = count_working_days(start, end)
    max_hours_per_day = SettingsController.get_settings_for_employee(employee_id)['work_hours_per_day']
    total_max_hours = total_working_days * max_hours_per_day
    
    # Calculate total booked hours for overlapping bookings
    # For bookings, we need to calculate how many hours fall within our date range
    total_booked_hours = 0
    for booking in bookings:
        b_start = booking['start_date'] if isinstance(booking['start_date'], type(start)) else datetime.strptime(str(booking['start_date']), '%Y-%m-%d').date()
        b_end = booking['end_date'] if isinstance(booking['end_date'], type(end)) else datetime.strptime(str(booking['end_date']), '%Y-%m-%d').date()
        
        # Find overlap between booking and requested range
        overlap_start = max(start, b_start)
        overlap_end = min(end, b_end)
        
        if overlap_start <= overlap_end:
            # Calculate working days in the overlap
            overlap_working_days = count_working_days(overlap_start, overlap_end)
            booking_total_working_days = count_working_days(b_start, b_end)
            
            # Pro-rate the booked hours based on the overlap
            if booking_total_working_days > 0:
                hours_per_day = booking['booked_hours'] / booking_total_working_days
                overlap_hours = hours_per_day * overlap_working_days
                total_booked_hours += overlap_hours
    
    # Calculate reserved hours
    # For reservations, hours are per day, so we count days in overlap and multiply
    total_reserved_hours = 0
    for reservation in reservations:
        r_start = reservation.start_date if isinstance(reservation.start_date, type(start)) else datetime.strptime(str(reservation.start_date), '%Y-%m-%d').date()
        r_end = reservation.end_date if isinstance(reservation.end_date, type(end)) else datetime.strptime(str(reservation.end_date), '%Y-%m-%d').date()
        
        # Find overlap between reservation and requested range
        overlap_start = max(start, r_start)
        overlap_end = min(end, r_end)
        
        if overlap_start <= overlap_end:
            overlap_working_days = count_working_days(overlap_start, overlap_end)
            total_reserved_hours += reservation.reserved_hours_per_day * overlap_working_days
    
    total_utilized_hours = total_booked_hours + total_reserved_hours
    available_hours = max(0, total_max_hours - total_utilized_hours)
    
    # Calculate max bookable hours per day on average
    if total_working_days > 0:
        avg_utilized_per_day = total_utilized_hours / total_working_days
        avg_available_per_day = max(0, max_hours_per_day - avg_utilized_per_day)
    else:
        avg_utilized_per_day = 0
        avg_available_per_day = max_hours_per_day
    
    return {
        'employee': employee.to_dict(),
        'date_range': {
            'start_date': start_date,
            'end_date': end_date
        },
        'bookings': [dict(b) for b in bookings],
        'reservations': [r.to_dict() for r in reservations],
        'availability': {
            'working_days': total_working_days,
            'max_hours_total': total_max_hours,
            'total_booked_hours': round(total_booked_hours, 1),
            'total_reserved_hours': round(total_reserved_hours, 1),
            'total_utilized_hours': round(total_utilized_hours, 1),
            'available_hours': round(available_hours, 1),
            'avg_utilized_per_day': round(avg_utilized_per_day, 2),
            'avg_available_per_day': round(avg_available_per_day, 2)
        }
    }

@router.get("/{employee_id}/business-rules", response_model=Dict[str, Any])
async def get_employee_business_rules(employee_id: int, current_user: User = Depends(get_current_user)):
    """Get custom business rules for an employee. Returns null fields if using global defaults."""
    from models.employee import Employee
    employee = Employee.get_by_id(employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    rules = SettingsController.get_employee_business_rules(employee_id)
    effective = SettingsController.get_settings_for_employee(employee_id)
    return {
        'employee_id': employee_id,
        'custom_rules': rules,
        'effective_settings': effective
    }

@router.put("/{employee_id}/business-rules", response_model=Dict[str, Any])
async def set_employee_business_rules(
    employee_id: int,
    rules: EmployeeBusinessRulesUpdate,
    current_user: User = Depends(get_current_user)
):
    """Set or update custom business rules for an employee."""
    from models.employee import Employee
    employee = Employee.get_by_id(employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    update_data = {k: v for k, v in rules.dict().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields provided to update")
    saved = SettingsController.set_employee_business_rules(employee_id, update_data)
    effective = SettingsController.get_settings_for_employee(employee_id)
    return {
        'employee_id': employee_id,
        'custom_rules': saved,
        'effective_settings': effective
    }

@router.delete("/{employee_id}/business-rules", response_model=Dict[str, Any])
async def delete_employee_business_rules(employee_id: int, current_user: User = Depends(get_current_user)):
    """Remove custom business rules for an employee, reverting to global settings."""
    from models.employee import Employee
    employee = Employee.get_by_id(employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    SettingsController.delete_employee_business_rules(employee_id)
    return {
        'employee_id': employee_id,
        'message': 'Custom business rules removed. Employee will now use global settings.',
        'effective_settings': SettingsController.get_settings()
    }

@router.delete("/{employee_id}", response_model=Dict[str, Any])
async def delete_employee(employee_id: int):
    """Delete an employee"""
    result = EmployeeController.delete_employee(employee_id)
    if 'error' in result:
        status_code = 404 if result['error'] == 'Employee not found' else 400
        raise HTTPException(status_code=status_code, detail=result['error'])
    return result