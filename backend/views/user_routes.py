from fastapi import APIRouter, Depends, HTTPException, status, Request
from typing import List, Dict, Any
from models.user import User
from dependencies import get_current_user

router = APIRouter(prefix="/api/users", tags=["users"])

@router.get("/by-role/{role}", response_model=List[Dict[str, Any]])
async def get_users_by_role(role: str):
    """Get users by specific role - public endpoint for login"""
    users = User.get_by_role(role)
    return [user.to_dict() for user in users]

@router.get("/architects", response_model=List[Dict[str, Any]])
async def get_solution_architects(current_user: User = Depends(get_current_user)):
    """Get all solution architects - requires authentication"""
    architects = User.get_by_role('solution_architect')
    return [architect.to_dict() for architect in architects]

@router.get("", response_model=List[Dict[str, Any]])
async def get_all_users(current_user: User = Depends(get_current_user)):
    """Get all users - requires authentication"""
    # Get all roles
    roles = ['solution_architect', 'line_manager', 'dashboard_viewer', 'admin', 'dtmo']
    all_users = []
    for role in roles:
        users = User.get_by_role(role)
        all_users.extend([user.to_dict() for user in users])
    return all_users

@router.post("", response_model=Dict[str, Any])
async def create_user(request: Request, current_user: User = Depends(get_current_user)):
    """Create a new user - admin only"""
    # Check if current user is admin
    if current_user.role != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can create users"
        )
    
    data = await request.json()
    username = data.get('username')
    password = data.get('password')
    role = data.get('role')
    full_name = data.get('full_name')
    department = data.get('department')
    
    # Validate required fields
    if not username or not password or not role or not full_name:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username, password, role, and full_name are required"
        )
    
    # Check if username already exists
    existing_user = User.get_by_username(username)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already exists"
        )
    
    # Validate role
    valid_roles = ['admin', 'line_manager', 'solution_architect', 'dashboard_viewer', 'dtmo']
    if role not in valid_roles:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {', '.join(valid_roles)}"
        )
    
    # Create the user
    try:
        new_user = User.create(
            username=username,
            password=password,
            role=role,
            full_name=full_name,
            department=department
        )
        return {
            "success": True,
            "message": "User created successfully",
            "user": new_user.to_dict()
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create user: {str(e)}"
        )

@router.delete("/{user_id}")
async def delete_user(user_id: int, current_user: User = Depends(get_current_user)):
    """Delete a user - admin only"""
    # Check if current user is admin
    if current_user.role != 'admin':
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only administrators can delete users"
        )
    
    # Check if user exists
    user = User.get_by_id(user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    # Prevent deleting own account
    if user.id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account"
        )
    
    # Delete the user
    try:
        from database import db
        db.execute('DELETE FROM users WHERE id = ?', (user_id,))
        db.commit()
        return {
            "success": True,
            "message": "User deleted successfully"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete user: {str(e)}"
        )
