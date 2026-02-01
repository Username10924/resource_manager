from fastapi import APIRouter, Query, Depends
from typing import Dict, Any, Optional

from controllers.dashboard_controller import DashboardController
from models.user import User
from dependencies import get_current_user

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])

@router.get("/resources", response_model=Dict[str, Any])
async def get_resources_dashboard(
    current_user: User = Depends(get_current_user),
    manager_id: Optional[int] = Query(None, description="Filter by line manager")
):
    """Get resources dashboard data"""
    # Line managers can only see their own employees
    if current_user.role == 'line_manager':
        manager_id = current_user.id
    
    return DashboardController.get_resources_dashboard(manager_id)

@router.get("/projects", response_model=Dict[str, Any])
async def get_projects_dashboard(
    current_user: User = Depends(get_current_user),
    architect_id: Optional[int] = Query(None, description="Filter by solution architect")
):
    """Get projects dashboard data"""
    # Solution architects can see their own projects by default
    if current_user.role == 'solution_architect':
        architect_id = current_user.id
    
    return DashboardController.get_projects_dashboard(architect_id)

@router.get("/bookings/overview", response_model=Dict[str, Any])
async def get_bookings_overview(
    current_user: User = Depends(get_current_user),
    year: Optional[int] = Query(None, description="Year for overview")
):
    """Get booking overview"""
    return DashboardController.get_booking_overview(year)