from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from typing import Optional
import uvicorn
import os
from datetime import datetime

from config import APP_CONFIG, ALLOWED_ORIGINS
from views import employee_routes, project_routes, dashboard_routes, user_routes, reservation_routes, settings_routes
from models.user import User
from dependencies import get_current_user, create_access_token

app = FastAPI(**APP_CONFIG)

# Create uploads directory if it doesn't exist
upload_dir = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(upload_dir, exist_ok=True)

# Mount static files for uploads
app.mount("/uploads", StaticFiles(directory=upload_dir), name="uploads")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Include routers with authentication dependency
app.include_router(employee_routes.router, dependencies=[Depends(get_current_user)])
app.include_router(project_routes.router, dependencies=[Depends(get_current_user)])
app.include_router(reservation_routes.router, dependencies=[Depends(get_current_user)])
app.include_router(settings_routes.router, dependencies=[Depends(get_current_user)])
app.include_router(settings_routes.public_router)  # Public password verification

# Public routes - no authentication required
app.include_router(dashboard_routes.router)  # Dashboard is public
app.include_router(user_routes.router)  # User routes for login

@app.get("/")
async def root():
    """Root endpoint with API information"""
    return {
        "message": "Employee Scheduling & Project Management System",
        "version": APP_CONFIG["version"],
        "authentication": "Use Bearer token in Authorization header",
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
    """Login endpoint - validates username and password, returns JWT token"""
    data = await request.json()
    username = data.get('username')
    password = data.get('password')
    
    if not username:
        raise HTTPException(status_code=400, detail="Username is required")
    
    if not password:
        raise HTTPException(status_code=400, detail="Password is required")
    
    user = User.get_by_username(username)
    if not user:
        raise HTTPException(
            status_code=401, 
            detail="Invalid username or password"
        )
    
    # Verify password
    if not user.verify_password(password):
        raise HTTPException(
            status_code=401,
            detail="Invalid username or password"
        )
    
    # Create access token
    access_token = create_access_token(data={"sub": user.username})
    
    return {
        "success": True,
        "access_token": access_token,
        "token_type": "bearer",
        "user": user.to_dict(),
        "message": "Login successful"
    }

@app.on_event("startup")
async def startup_event():
    """Initialize database and create admin user"""
    from database import db
    
    # Create admin user if it doesn't exist
    admin_user = User.get_by_username("admin")
    if not admin_user:
        User.create(
            username="admin",
            password="admin123",
            role="admin",
            full_name="System Administrator",
            department="IT"
        )
        print("Created admin user: admin (admin)")
    

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)