from fastapi import APIRouter, Query
from typing import Dict, Any, Optional

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

@router.get("/bookings/overview", response_model=Dict[str, Any])
async def get_bookings_overview(
    year: Optional[int] = Query(None, description="Year for overview")
):
    """Get booking overview - public endpoint"""
    return DashboardController.get_booking_overview(year)