from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import Optional
import uvicorn
import os
from datetime import datetime

from config import APP_CONFIG
from views import employee_routes, project_routes, dashboard_routes, user_routes, reservation_routes
from models.user import User
from dependencies import get_current_user

app = FastAPI(**APP_CONFIG)

# Create uploads directory if it doesn't exist
upload_dir = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(upload_dir, exist_ok=True)

# Mount static files for uploads
app.mount("/uploads", StaticFiles(directory=upload_dir), name="uploads")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers with authentication dependency
app.include_router(employee_routes.router, dependencies=[Depends(get_current_user)])
app.include_router(project_routes.router, dependencies=[Depends(get_current_user)])
app.include_router(dashboard_routes.router, dependencies=[Depends(get_current_user)])
app.include_router(reservation_routes.router, dependencies=[Depends(get_current_user)])

# User routes - some endpoints need to be public for login
app.include_router(user_routes.router)

@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Employee Scheduling & Project Management System",
        "version": APP_CONFIG["version"],
        "authentication": "Use X-Username header with username",
        "endpoints": {
            "employees": "/api/employees",
            "projects": "/api/projects",
            "dashboard": "/api/dashboard"
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.post("/login")
async def login(request: Request):
    """Login endpoint - validates username and role match"""
    data = await request.json()
    username = data.get('username')
    role = data.get('role')
    
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    
    if not role:
        raise HTTPException(status_code=400, detail="Role is required")
    
    # Validate role is one of the allowed roles
    allowed_roles = ['line_manager', 'solution_architect', 'dashboard_viewer', 'admin']
    if role not in allowed_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(allowed_roles)}")
    
    user = User.get_by_username(username)
    if not user:
        raise HTTPException(
            status_code=401, 
            detail="Invalid username or role. Please check your credentials or register first."
        )
    
    # Validate that the role matches
    if user.role != role:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid role for user {username}. Expected role: {user.role}"
        )
    
    return {
        "success": True,
        "user": user.to_dict(),
        "message": "Login successful"
    }

@app.post("/register")
async def register(request: Request):
    """Register endpoint - creates new user with specified role"""
    data = await request.json()
    username = data.get('username')
    role = data.get('role')
    full_name = data.get('full_name')
    department = data.get('department')
    
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    
    if not role:
        raise HTTPException(status_code=400, detail="Role is required")
    
    if not full_name:
        raise HTTPException(status_code=400, detail="Full name is required")
    
    # Validate role is one of the allowed roles
    allowed_roles = ['line_manager', 'solution_architect', 'dashboard_viewer', 'admin']
    if role not in allowed_roles:
        raise HTTPException(status_code=400, detail=f"Invalid role. Must be one of: {', '.join(allowed_roles)}")
    
    # Check if user already exists
    existing_user = User.get_by_username(username)
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail=f"Username '{username}' is already taken. Please choose a different username or login instead."
        )
    
    # Create new user
    user = User.create(
        username=username,
        role=role,
        full_name=full_name,
        department=department
    )
    
    return {
        "success": True,
        "user": user.to_dict(),
        "message": "Registration successful"
    }

@app.on_event("startup")
async def startup_event():
    """Initialize database """
    from database import db
    from datetime import datetime
    

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)