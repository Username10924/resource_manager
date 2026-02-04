from typing import Dict, Any, List, Tuple, Optional
from datetime import datetime, date, timedelta
from calendar import monthrange
from models.employee import Employee
from models.project import Project
from models.user import User
from database import db

class DashboardController:
    @staticmethod
    def _to_date(value: Any) -> Optional[date]:
        if isinstance(value, date):
            return value
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, str):
            try:
                return datetime.fromisoformat(value).date()
            except ValueError:
                try:
                    return datetime.strptime(value, "%Y-%m-%d").date()
                except ValueError:
                    return None
        return None

    @staticmethod
    def _count_weekdays(start: date, end: date) -> int:
        count = 0
        current = start
        while current <= end:
            if current.weekday() < 5:
                count += 1
            current += timedelta(days=1)
        return count

    @staticmethod
    def _calculate_monthly_reservation_hours(reservations: List[Dict[str, Any]], year: int, month: int) -> float:
        if not reservations:
            return 0
        month_start = date(year, month, 1)
        month_end = date(year, month, monthrange(year, month)[1])
        total = 0.0
        for res in reservations:
            start = DashboardController._to_date(res.get('start_date'))
            end = DashboardController._to_date(res.get('end_date'))
            if not start or not end:
                continue
            if start > month_end or end < month_start:
                continue
            overlap_start = max(start, month_start)
            overlap_end = min(end, month_end)
            workdays = DashboardController._count_weekdays(overlap_start, overlap_end)
            total += workdays * (res.get('reserved_hours_per_day') or 0)
        return total

    @staticmethod
    def get_resources_dashboard(manager_id: Optional[int] = None) -> Dict[str, Any]:
        """Get resources dashboard data"""
        
        if manager_id:
            # Get manager's team
            employees = Employee.get_by_line_manager(manager_id)
            manager = User.get_by_id(manager_id)
            manager_name = manager.full_name if manager else "Unknown"
        else:
            # Get all employees
            employees = Employee.get_all_active()
            manager_name = "All Departments"
        
        # Get current year
        current_year = datetime.now().year
        current_month = datetime.now().month
        
        # Prepare dashboard data
        dashboard_data = {
            'manager': manager_name,
            'total_employees': len(employees),
            'departments': {},
            'monthly_summary': {}
        }
        
        # Initialize monthly summary
        for month in range(1, 13):
            dashboard_data['monthly_summary'][month] = {
                'total_available': 0,
                'total_booked': 0,
                'total_capacity': 0,
                'employee_count': 0,
                'utilization_rate': 0
            }
        
        # Process each employee
        for emp in employees:
            # Department grouping
            dept = emp.department
            if dept not in dashboard_data['departments']:
                dashboard_data['departments'][dept] = {
                    'count': 0,
                    'total_available_hours': 0,
                    'employees': []
                }
            
            dashboard_data['departments'][dept]['count'] += 1
            
            # Get employee schedule
            query = '''
                SELECT es.*, 
                       COALESCE(
                           (SELECT SUM(pb.booked_hours) 
                            FROM project_bookings pb
                            WHERE pb.employee_id = es.employee_id
                              AND pb.status != 'cancelled'
                              AND strftime('%Y', pb.start_date) = CAST(es.year AS TEXT)
                              AND CAST(strftime('%m', pb.start_date) AS INTEGER) <= es.month
                              AND CAST(strftime('%m', pb.end_date) AS INTEGER) >= es.month
                           ), 0
                       ) + (es.reserved_hours_per_day * 20) as booked_hours
                FROM employee_schedules es
                WHERE es.employee_id = ? AND es.year = ?
                ORDER BY es.month
            '''
                        schedule_data = db.fetch_all(query, (emp.id, current_year))

                        reservations_query = '''
                                SELECT start_date, end_date, reserved_hours_per_day
                                FROM employee_reservations
                                WHERE employee_id = ?
                                    AND status = 'active'
                                    AND strftime('%Y', start_date) <= CAST(? AS TEXT)
                                    AND strftime('%Y', end_date) >= CAST(? AS TEXT)
                        '''
                        reservations = db.fetch_all(reservations_query, (emp.id, current_year, current_year))
            
            emp_data = emp.to_dict()
            emp_data['schedule'] = schedule_data
            
            # Add to department
            dashboard_data['departments'][dept]['employees'].append(emp_data)
            
            # Update monthly summary and department totals
            for sched in schedule_data:
                month = sched['month']
                # available_hours_per_month already accounts for scheduled reserved hours
                # We need to subtract project bookings AND reservation hours to get actual available hours
                base_available = sched['available_hours_per_month']
                booked = sched['booked_hours'] or 0
                
                # Calculate actual available hours (base available - booked hours)
                # Note: booked includes both project bookings AND scheduled reserved hours
                # So we need to get just the project bookings
                reserved_hours = (sched['reserved_hours_per_day'] or 0) * 20
                project_booked_hours = booked - reserved_hours
                reservation_hours = DashboardController._calculate_monthly_reservation_hours(
                    reservations, current_year, month
                )
                total_utilized = project_booked_hours + reserved_hours + reservation_hours
                actual_available = base_available - project_booked_hours - reservation_hours
                
                dashboard_data['monthly_summary'][month]['total_available'] += actual_available
                dashboard_data['monthly_summary'][month]['total_booked'] += total_utilized
                dashboard_data['monthly_summary'][month]['total_capacity'] += 120  # 6 hrs/day * 20 days
                dashboard_data['monthly_summary'][month]['employee_count'] += 1
                
                # Add to department's total available hours (only for current month)
                if month == current_month:
                    dashboard_data['departments'][dept]['total_available_hours'] += actual_available
        
        # Calculate utilization rates based on total capacity
        for month in range(1, 13):
            summary = dashboard_data['monthly_summary'][month]
            if summary['total_capacity'] > 0:
                summary['utilization_rate'] = (summary['total_booked'] / summary['total_capacity']) * 100
        
        # Calculate total available hours across all departments
        total_available_hours = sum(
            dept_data['total_available_hours'] 
            for dept_data in dashboard_data['departments'].values()
        )
        dashboard_data['total_available_hours'] = total_available_hours
        
        # Count unique managers
        managers_set = set()
        for emp in employees:
            if emp.line_manager_id:
                managers_set.add(emp.line_manager_id)
        dashboard_data['managers'] = len(managers_set)
        
        return dashboard_data
    
    @staticmethod
    def get_projects_dashboard(architect_id: Optional[int] = None) -> Dict[str, Any]:
        """Get projects dashboard data"""
        
        if architect_id:
            projects_data = Project.get_by_architect(architect_id)
            architect = User.get_by_id(architect_id)
            architect_name = architect.full_name if architect else "Unknown"
        else:
            projects_data = Project.get_all()
            architect_name = "All Architects"
        
        # Process projects
        projects = []
        status_counts = {
            'planned': 0,
            'active': 0,
            'on_hold': 0,
            'completed': 0,
            'cancelled': 0
        }
        
        total_progress = 0
        active_projects = 0
        total_bookings = 0
        
        for proj in projects_data:
            # Handle both Project objects and dict rows
            if isinstance(proj, dict):
                project_dict = dict(proj)
            else:
                project_dict = proj.to_dict()
            
            # Get booking statistics
            bookings_query = '''
                SELECT COUNT(*) as total_bookings, 
                       SUM(booked_hours) as total_hours,
                       COUNT(DISTINCT employee_id) as unique_employees
                FROM project_bookings 
                WHERE project_id = ? AND status != 'cancelled'
            '''
            stats = db.fetch_one(bookings_query, (project_dict['id'],))
            
            project_dict['booking_stats'] = {
                'total_bookings': stats['total_bookings'] or 0,
                'total_hours': stats['total_hours'] or 0,
                'unique_employees': stats['unique_employees'] or 0
            }
            
            # Add to total bookings count
            total_bookings += stats['total_bookings'] or 0
            
            projects.append(project_dict)
            
            # Update status counts
            status = project_dict['status']
            if status in status_counts:
                status_counts[status] += 1
            
            # Update progress stats
            if status == 'active':
                total_progress += project_dict['progress']
                active_projects += 1
        
        # Calculate average progress
        avg_progress = total_progress / active_projects if active_projects > 0 else 0
        
        return {
            'architect': architect_name,
            'total_projects': len(projects),
            'active_projects': status_counts['active'],
            'total_bookings': total_bookings,
            'status_distribution': status_counts,
            'avg_progress': round(avg_progress, 1),
            'average_progress': avg_progress,
            'projects': projects
        }
    
    @staticmethod
    def get_booking_overview(year: Optional[int] = None) -> Dict[str, Any]:
        """Get booking overview for all projects"""
        if year is None:
            year = datetime.now().year
        
        query = '''
            SELECT 
                p.name as project_name,
                p.status as project_status,
                CAST(strftime('%m', pb.start_date) AS INTEGER) as month,
                SUM(pb.booked_hours) as monthly_hours,
                COUNT(DISTINCT pb.employee_id) as employees_count
            FROM project_bookings pb
            JOIN projects p ON pb.project_id = p.id
            WHERE strftime('%Y', pb.start_date) = CAST(? AS TEXT)
                AND pb.status != 'cancelled'
            GROUP BY p.id, CAST(strftime('%m', pb.start_date) AS INTEGER)
            ORDER BY p.name, month
        '''
        
        results = db.fetch_all(query, (year,))
        
        # Organize by project
        overview = {}
        for row in results:
            project = row['project_name']
            if project not in overview:
                overview[project] = {
                    'status': row['project_status'],
                    'monthly_bookings': {}
                }
            
            overview[project]['monthly_bookings'][row['month']] = {
                'hours': row['monthly_hours'],
                'employees': row['employees_count']
            }
        
        return overview