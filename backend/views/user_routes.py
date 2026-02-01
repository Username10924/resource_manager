from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any
from models.user import User
from dependencies import get_current_user

router = APIRouter(prefix="/api/users", tags=["users"])

@router.get("/by-role/{role}", response_model=List[Dict[str, Any]])
async def get_users_by_role(role: str):
    """Get users by specific role - public endpoint for login"""
    users = User.get_by_role(role)
    return [user.to_dict() for user in users]

@router.get("/architects/", response_model=List[Dict[str, Any]])
async def get_solution_architects(current_user: User = Depends(get_current_user)):
    """Get all solution architects - requires authentication"""
    architects = User.get_by_role('solution_architect')
    return [architect.to_dict() for architect in architects]

@router.get("/", response_model=List[Dict[str, Any]])
async def get_all_users(current_user: User = Depends(get_current_user)):
    """Get all users - requires authentication"""
    # Get all roles
    roles = ['solution_architect', 'line_manager', 'dashboard_viewer', 'admin']
    all_users = []
    for role in roles:
        users = User.get_by_role(role)
        all_users.extend([user.to_dict() for user in users])
    return all_users
