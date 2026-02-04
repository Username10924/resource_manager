from fastapi import APIRouter, HTTPException, Query, UploadFile, File
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, validator
from datetime import date, datetime
import shutil
import os

from controllers.project_controller import ProjectController
from models.project import Project

router = APIRouter(prefix="/api/projects", tags=["projects"])

# Pydantic models
class ProjectCreate(BaseModel):
    project_code: str
    name: str
    description: str
    solution_architect_id: int
    start_date: Optional[date] = None
    end_date: Optional[date] = None

class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    progress: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None

class BookingRequest(BaseModel):
    employee_id: int
    start_date: date
    end_date: date
    booked_hours: float
    
    @validator('end_date')
    def validate_dates(cls, v, values):
        if 'start_date' in values and v < values['start_date']:
            raise ValueError('End date must be after or equal to start date')
        return v
    
    @validator('booked_hours')
    def validate_hours(cls, v):
        if v <= 0:
            raise ValueError('Booked hours must be greater than 0')
        return v

@router.post("/", response_model=Dict[str, Any])
async def create_project(project: ProjectCreate):
    """Create a new project"""
    result = ProjectController.create_project(project.dict())
    if 'error' in result:
        raise HTTPException(status_code=400, detail=result['error'])
    return result

@router.get("/", response_model=List[Dict[str, Any]])
async def get_projects(
    architect_id: Optional[int] = Query(None, description="Filter by solution architect"),
    status: Optional[str] = Query(None, description="Filter by status")
):
    """Get list of projects"""
    if architect_id:
        projects = Project.get_by_architect(architect_id)
    else:
        projects = Project.get_all()
    
    if status:
        projects = [p for p in projects if p['status'] == status]
    
    return projects

@router.get("/{project_id}", response_model=Dict[str, Any])
async def get_project(project_id: int):
    """Get project details"""
    project = Project.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    result = project.to_dict()
    result['bookings'] = project.get_bookings()
    return result

@router.put("/{project_id}", response_model=Dict[str, Any])
async def update_project(project_id: int, update: ProjectUpdate):
    """Update project details"""
    # Filter out None values
    update_data = {k: v for k, v in update.dict().items() if v is not None}
    
    result = ProjectController.update_project(project_id, update_data)
    if 'error' in result:
        raise HTTPException(status_code=400, detail=result['error'])
    return result

@router.delete("/{project_id}", response_model=Dict[str, Any])
async def delete_project(project_id: int):
    """Delete a project"""
    result = ProjectController.delete_project(project_id)
    if 'error' in result:
        raise HTTPException(status_code=404, detail=result['error'])
    return result

@router.post("/{project_id}/bookings", response_model=Dict[str, Any])
async def book_employee(project_id: int, booking: BookingRequest):
    """Book an employee for a project"""
    result = ProjectController.book_employee_for_project(project_id, booking.dict())
    if 'error' in result:
        raise HTTPException(status_code=400, detail=result['error'])
    return result

@router.get("/all-bookings")
async def get_all_bookings():
    """Get all bookings across all projects"""
    from database import db
    
    query = '''
        SELECT 
            pb.id,
            pb.project_id,
            pb.employee_id,
            pb.start_date,
            pb.end_date,
            pb.booked_hours,
            pb.status,
            pb.created_at,
            pb.updated_at,
            p.name as project_name,
            p.project_code,
            e.full_name,
            e.department,
            e.position
        FROM project_bookings pb
        JOIN projects p ON pb.project_id = p.id
        JOIN employees e ON pb.employee_id = e.id
        ORDER BY pb.start_date DESC
    '''
    bookings = db.fetch_all(query)
    
    # Explicitly map fields to ensure proper types
    result = []
    for booking in bookings:
        result.append({
            'id': int(booking['id']),
            'project_id': int(booking['project_id']),
            'employee_id': int(booking['employee_id']),
            'start_date': str(booking['start_date']),
            'end_date': str(booking['end_date']),
            'booked_hours': float(booking['booked_hours']),
            'status': str(booking['status']) if booking['status'] else 'booked',
            'created_at': str(booking['created_at']) if booking['created_at'] else None,
            'updated_at': str(booking['updated_at']) if booking['updated_at'] else None,
            'project_name': str(booking['project_name']),
            'project_code': str(booking['project_code']),
            'full_name': str(booking['full_name']),
            'department': str(booking['department']),
            'position': str(booking['position'])
        })
    
    return result

@router.delete("/bookings/{booking_id}", response_model=Dict[str, Any])
async def delete_booking(booking_id: int):
    """Delete a booking"""
    from database import db
    
    # Check if booking exists
    query = 'SELECT * FROM project_bookings WHERE id = ?'
    booking = db.fetch_one(query, (booking_id,))
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Delete the booking
    delete_query = 'DELETE FROM project_bookings WHERE id = ?'
    db.execute(delete_query, (booking_id,))
    db.commit()
    
    return {'success': True, 'message': 'Booking deleted successfully'}

@router.get("/{project_id}/bookings", response_model=List[Dict[str, Any]])
async def get_project_bookings(project_id: int):
    """Get all bookings for a project"""
    project = Project.get_by_id(project_id)
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    return project.get_bookings()

@router.get("/available/employees", response_model=List[Dict[str, Any]])
async def delete_booking(booking_id: int):
    """Delete a booking"""
    from database import db
    
    # Check if booking exists
    query = 'SELECT * FROM project_bookings WHERE id = ?'
    booking = db.fetch_one(query, (booking_id,))
    
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Delete the booking
    delete_query = 'DELETE FROM project_bookings WHERE id = ?'
    db.execute(delete_query, (booking_id,))
    db.commit()
    
    return {'success': True, 'message': 'Booking deleted successfully'}

@router.get("/available/employees", response_model=List[Dict[str, Any]])
async def get_available_employees(
    start_date: date = Query(..., description="Start date for availability check"),
    end_date: date = Query(..., description="End date for availability check"),
    department: Optional[str] = Query(None, description="Filter by department")
):
    """Get employees with available hours for booking in a date range"""
    return ProjectController.get_available_employees(start_date, end_date, department)

@router.post("/{project_id}/attachments")
async def upload_attachment(
    project_id: int,
    file: UploadFile = File(...)
):
    """Upload attachment for a project"""
    print(f"[UPLOAD] Starting upload for project_id: {project_id}")
    print(f"[UPLOAD] File name: {file.filename}")
    
    project = Project.get_by_id(project_id)
    if not project:
        print(f"[UPLOAD] Project not found: {project_id}")
        raise HTTPException(status_code=404, detail="Project not found")
    
    print(f"[UPLOAD] Project found: {project.name}, code: {project.project_code}")
    
    # Create uploads directory if it doesn't exist
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    upload_dir = os.path.join(base_dir, "uploads", "projects")
    print(f"[UPLOAD] Upload directory: {upload_dir}")
    os.makedirs(upload_dir, exist_ok=True)
    print(f"[UPLOAD] Directory created/verified")
    
    # Generate unique filename
    file_extension = os.path.splitext(file.filename)[1]
    unique_filename = f"{project.project_code}_{int(datetime.now().timestamp())}{file_extension}"
    file_path = os.path.join(upload_dir, unique_filename)
    print(f"[UPLOAD] Saving to: {file_path}")
    
    # Save file
    try:
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        print(f"[UPLOAD] File saved successfully")
    except Exception as e:
        print(f"[UPLOAD] Error saving file: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save file: {str(e)}")
    
    # Store relative path for serving via static files
    relative_path = f"uploads/projects/{unique_filename}"
    
    # Update project attachments - handle if attachments is None or not a list
    attachments = project.attachments if isinstance(project.attachments, list) else []
    print(f"[UPLOAD] Current attachments: {attachments}")
    attachments.append({
        'filename': file.filename,
        'path': relative_path,
        'uploaded_at': datetime.now().isoformat()
    })
    print(f"[UPLOAD] New attachments: {attachments}")
    
    project.update(attachments=attachments)
    print(f"[UPLOAD] Database updated")
    
    return {"filename": file.filename, "path": relative_path}