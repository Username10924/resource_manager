from fastapi import APIRouter, HTTPException
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, validator
from datetime import date

from models.reservation import EmployeeReservation
from models.employee import Employee
from controllers.settings_controller import SettingsController

router = APIRouter(prefix="/api/employees/{employee_id}/reservations", tags=["reservations"])

# Pydantic models
class ReservationCreate(BaseModel):
    start_date: date
    end_date: date
    reserved_hours_per_day: float
    reason: Optional[str] = None
    
    @validator('end_date')
    def validate_dates(cls, v, values):
        if 'start_date' in values and v < values['start_date']:
            raise ValueError('End date must be after or equal to start date')
        return v
    
    @validator('reserved_hours_per_day')
    def validate_hours(cls, v):
        # Basic range check - more specific validation done in model/route handler
        if v < 0 or v > 24:
            raise ValueError('Reserved hours per day must be between 0 and 24')
        return v

class ReservationUpdate(BaseModel):
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    reserved_hours_per_day: Optional[float] = None
    reason: Optional[str] = None
    status: Optional[str] = None

@router.post("", response_model=Dict[str, Any])
async def create_reservation(employee_id: int, reservation: ReservationCreate):
    """Create a new reservation for an employee"""
    # Check if employee exists
    employee = Employee.get_by_id(employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    try:
        new_reservation = EmployeeReservation.create(
            employee_id=employee_id,
            start_date=reservation.start_date,
            end_date=reservation.end_date,
            reserved_hours_per_day=reservation.reserved_hours_per_day,
            reason=reservation.reason if reservation.reason else None
        )
        return {'success': True, 'reservation': new_reservation.to_dict()}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to create reservation: {str(e)}")

@router.get("", response_model=List[Dict[str, Any]])
async def get_reservations(employee_id: int, include_cancelled: bool = False):
    """Get all reservations for an employee"""
    employee = Employee.get_by_id(employee_id)
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    
    reservations = EmployeeReservation.get_by_employee(employee_id, include_cancelled)
    return [r.to_dict() for r in reservations]

@router.get("/{reservation_id}", response_model=Dict[str, Any])
async def get_reservation(employee_id: int, reservation_id: int):
    """Get a specific reservation"""
    reservation = EmployeeReservation.get_by_id(reservation_id)
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    
    if reservation.employee_id != employee_id:
        raise HTTPException(status_code=403, detail="Reservation does not belong to this employee")
    
    return reservation.to_dict()

@router.put("/{reservation_id}", response_model=Dict[str, Any])
async def update_reservation(employee_id: int, reservation_id: int, update: ReservationUpdate):
    """Update a reservation"""
    reservation = EmployeeReservation.get_by_id(reservation_id)
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    
    if reservation.employee_id != employee_id:
        raise HTTPException(status_code=403, detail="Reservation does not belong to this employee")
    
    # Filter out None values
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    
    try:
        updated_reservation = reservation.update(**update_data)
        return {'success': True, 'reservation': updated_reservation.to_dict()}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to update reservation: {str(e)}")

@router.delete("/{reservation_id}", response_model=Dict[str, Any])
async def delete_reservation(employee_id: int, reservation_id: int):
    """Delete a reservation"""
    reservation = EmployeeReservation.get_by_id(reservation_id)
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    
    if reservation.employee_id != employee_id:
        raise HTTPException(status_code=403, detail="Reservation does not belong to this employee")
    
    try:
        reservation.delete()
        return {'success': True, 'message': 'Reservation deleted successfully'}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete reservation: {str(e)}")

@router.post("/{reservation_id}/cancel", response_model=Dict[str, Any])
async def cancel_reservation(employee_id: int, reservation_id: int):
    """Cancel a reservation"""
    reservation = EmployeeReservation.get_by_id(reservation_id)
    if not reservation:
        raise HTTPException(status_code=404, detail="Reservation not found")
    
    if reservation.employee_id != employee_id:
        raise HTTPException(status_code=403, detail="Reservation does not belong to this employee")
    
    try:
        cancelled_reservation = reservation.cancel()
        return {'success': True, 'reservation': cancelled_reservation.to_dict()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to cancel reservation: {str(e)}")
