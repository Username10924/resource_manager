from fastapi import APIRouter, Depends, HTTPException, Request
from typing import Dict, Any
from pydantic import BaseModel, Field

from controllers.settings_controller import SettingsController
from models.user import User
from dependencies import get_current_user

router = APIRouter(prefix="/api/settings", tags=["settings"])
public_router = APIRouter(prefix="/api/settings", tags=["settings"])

class SettingsUpdate(BaseModel):
    work_hours_per_day: int = Field(ge=1, le=24, description="Work hours per day (1-24)")
    work_days_per_month: int = Field(ge=1, le=31, description="Work days per month (1-31)")
    months_in_year: int = Field(ge=1, le=12, description="Months in year (1-12)")

class PasswordVerify(BaseModel):
    password: str = Field(min_length=1, description="Site access password")

class PasswordUpdate(BaseModel):
    current_password: str = Field(min_length=1, description="Current site password")
    new_password: str = Field(min_length=1, description="New site password")

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

@public_router.post("/verify-password")
async def verify_site_password(data: PasswordVerify):
    """Verify site access password - public endpoint, returns signed token"""
    if SettingsController.verify_site_password(data.password):
        token = SettingsController.generate_site_token()
        return {"success": True, "message": "Access granted", "token": token}
    raise HTTPException(status_code=401, detail="Invalid password")

@public_router.post("/verify-token")
async def verify_site_token(request: Request):
    """Verify a site access token is still valid"""
    from fastapi import Request as _R
    token = request.headers.get("X-Site-Token", "")
    if token and SettingsController.verify_site_token(token):
        return {"valid": True}
    raise HTTPException(status_code=401, detail="Invalid or expired token")

@router.put("/site-password")
async def update_site_password(
    data: PasswordUpdate,
    current_user: User = Depends(get_current_user)
):
    """Update site access password - requires authentication"""
    if not SettingsController.verify_site_password(data.current_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    try:
        SettingsController.update_site_password(data.new_password)
        return {"success": True, "message": "Site password updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
