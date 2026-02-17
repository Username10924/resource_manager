from fastapi import APIRouter, Query
from typing import Dict, Any, List, Optional

from controllers.dashboard_controller import DashboardController

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

@router.get("/resources", response_model=Dict[str, Any])
async def get_resources_dashboard(
    manager_id: Optional[int] = Query(None, description="Filter by line manager")
):
    """Get resources dashboard data - public endpoint"""
    return DashboardController.get_resources_dashboard(manager_id)

@router.get("/projects", response_model=Dict[str, Any])
async def get_projects_dashboard(
    architect_id: Optional[int] = Query(None, description="Filter by solution architect")
):
    """Get projects dashboard data - public endpoint"""
    return DashboardController.get_projects_dashboard(architect_id)

@router.get("/all-reservations", response_model=List[Dict[str, Any]])
async def get_all_reservations():
    """Get all active reservations with employee department info"""
    from database import db

    query = '''
        SELECT
            er.id,
            er.employee_id,
            er.start_date,
            er.end_date,
            er.reserved_hours_per_day,
            er.reason,
            er.status,
            e.full_name,
            e.department
        FROM employee_reservations er
        JOIN employees e ON er.employee_id = e.id
        WHERE er.status = 'active'
        ORDER BY er.start_date DESC
    '''
    rows = db.fetch_all(query)
    return [dict(r) for r in rows]

@router.get("/bookings/overview", response_model=Dict[str, Any])
async def get_bookings_overview(
    year: Optional[int] = Query(None, description="Year for overview")
):
    """Get booking overview - public endpoint"""
    return DashboardController.get_booking_overview(year)