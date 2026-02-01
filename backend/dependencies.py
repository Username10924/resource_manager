from fastapi import Depends, HTTPException, status
from fastapi.security import APIKeyHeader
from models.user import User

# API Key Header for simple username authentication
api_key_header = APIKeyHeader(name="X-Username", auto_error=False)

async def get_current_user(username: str = Depends(api_key_header)) -> User:
    """Simple username-based authentication"""
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Username is required in X-Username header",
        )
    
    user = User.get_by_username(username)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user
