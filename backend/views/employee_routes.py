from fastapi import APIRouter, HTTPException, Depends, Query
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, validator
from datetime import datetime

from controllers.employee_controller import EmployeeController
from models.user import User
from dependencies import get_current_user

router = APIRouter(prefix="/api/employees", tags=["employees"])

# Pydantic models for request/response
class EmployeeCreate(BaseModel):
    full_name: str
    department: str
    position: str
    line_manager_id: int
    available_days_per_year: int = 240

class EmployeeResponse(BaseModel):
    id: int
    full_name: str
    department: str
    position: str
    line_manager_id: int
    available_days_per_year: int
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
        if v < 0 or v > 6:
            raise ValueError('Reserved hours must be between 0 and 6')
        return v

@router.post("/", response_model=Dict[str, Any])
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

@router.get("/", response_model=List[EmployeeResponse])
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
    
    # Get already booked hours
    from database import db
    query = '''
        SELECT SUM(booked_hours) as booked_hours
        FROM project_bookings
        WHERE employee_id = ? AND month = ? AND year = ? AND status != 'cancelled'
    '''
    result = db.fetch_one(query, (employee_id, month, year))
    booked_hours = result['booked_hours'] or 0
    
    # Include reserved hours as part of the booked hours for utilization
    reserved_hours_monthly = schedule.reserved_hours_per_day * 20  # 20 work days per month
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
    
    # Get project bookings for the employee in this month
    from database import db
    query = '''
        SELECT pb.*, p.name as project_name, p.project_code, p.status as project_status,
               p.attachments
        FROM project_bookings pb
        JOIN projects p ON pb.project_id = p.id
        WHERE pb.employee_id = ? AND pb.month = ? AND pb.year = ?
        ORDER BY pb.booked_hours DESC
    '''
    bookings = db.fetch_all(query, (employee_id, month, year))
    
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

@router.delete("/{employee_id}", response_model=Dict[str, Any])
async def delete_employee(employee_id: int):
    """Delete an employee"""
    result = EmployeeController.delete_employee(employee_id)
    if 'error' in result:
        status_code = 404 if result['error'] == 'Employee not found' else 400
        raise HTTPException(status_code=status_code, detail=result['error'])
    return result