from fastapi import APIRouter, Depends
from typing import Dict, Any
from pydantic import BaseModel, Field

from controllers.settings_controller import SettingsController
from models.user import User
from dependencies import get_current_user

router = APIRouter(prefix="/api/settings", tags=["settings"])

class SettingsUpdate(BaseModel):
    work_hours_per_day: int = Field(ge=1, le=24, description="Work hours per day (1-24)")
    work_days_per_month: int = Field(ge=1, le=31, description="Work days per month (1-31)")
    months_in_year: int = Field(ge=1, le=12, description="Months in year (1-12)")

@router.get("", response_model=Dict[str, Any])
async def get_settings(current_user: User = Depends(get_current_user)):
    """Get current business rules settings - accessible to all roles"""
    return SettingsController.get_settings()

@router.put("", response_model=Dict[str, Any])
async def update_settings(
    settings: SettingsUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update business rules settings - accessible to all roles"""
    return SettingsController.update_settings(settings.model_dump())
