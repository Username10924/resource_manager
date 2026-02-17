from typing import Dict, Any, List, Tuple, Optional
from datetime import datetime, date, timedelta
from models.employee import Employee
from models.project import Project
from models.user import User
from database import db
from controllers.settings_controller import SettingsController

class DashboardController:
    @staticmethod
    def get_resources_dashboard(manager_id: Optional[int] = None) -> Dict[str, Any]:
        """Get resources dashboard data"""
        
        # Get dynamic settings
        settings = SettingsController.get_settings()
        work_hours_per_day = settings['work_hours_per_day']
        work_days_per_month = settings['work_days_per_month']
        monthly_capacity = work_hours_per_day * work_days_per_month
        
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
        
        # Helper: count working days in a date range (weekend = Fri + Sat)
        def count_working_days(start_d, end_d):
            working = 0
            current = start_d
            while current <= end_d:
                if current.weekday() not in (4, 5):  # Friday=4, Saturday=5
                    working += 1
                current += timedelta(days=1)
            return working

        # Helper: pro-rate booking hours into a specific month
        def prorate_booking_hours_for_month(b_start, b_end, booked_hours, month, year):
            month_start = date(year, month, 1)
            if month == 12:
                month_end = date(year, 12, 31)
            else:
                month_end = date(year, month + 1, 1) - timedelta(days=1)

            overlap_start = max(b_start, month_start)
            overlap_end = min(b_end, month_end)

            if overlap_start > overlap_end:
                return 0.0

            booking_total_wd = count_working_days(b_start, b_end)
            if booking_total_wd == 0:
                return 0.0

            overlap_wd = count_working_days(overlap_start, overlap_end)
            return (booked_hours / booking_total_wd) * overlap_wd

        # Helper: pro-rate reservation hours into a specific month
        def prorate_reservation_hours_for_month(r_start, r_end, hours_per_day, month, year):
            month_start = date(year, month, 1)
            if month == 12:
                month_end = date(year, 12, 31)
            else:
                month_end = date(year, month + 1, 1) - timedelta(days=1)

            overlap_start = max(r_start, month_start)
            overlap_end = min(r_end, month_end)

            if overlap_start > overlap_end:
                return 0.0

            overlap_wd = count_working_days(overlap_start, overlap_end)
            return hours_per_day * overlap_wd

        def parse_date(d):
            if isinstance(d, date):
                return d
            return datetime.strptime(str(d), '%Y-%m-%d').date()

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

            # Get base schedule data (no booking/reservation subqueries)
            schedule_query = '''
                SELECT es.*
                FROM employee_schedules es
                WHERE es.employee_id = ? AND es.year = ?
                ORDER BY es.month
            '''
            schedule_data = db.fetch_all(schedule_query, (emp.id, current_year))

            # Dynamically compute available_hours_per_month using live settings
            for sched in schedule_data:
                reserved = sched.get('reserved_hours_per_day') or 0
                sched['available_hours_per_month'] = max(0, (work_hours_per_day - reserved) * work_days_per_month)

            # Fetch bookings that overlap with this year (handles cross-year)
            year_start = f'{current_year}-01-01'
            year_end = f'{current_year}-12-31'
            bookings_query = '''
                SELECT pb.start_date, pb.end_date, pb.booked_hours
                FROM project_bookings pb
                WHERE pb.employee_id = ?
                  AND pb.status != 'cancelled'
                  AND pb.start_date <= ?
                  AND pb.end_date >= ?
            '''
            emp_bookings = db.fetch_all(bookings_query, (emp.id, year_end, year_start))

            # Fetch reservations that overlap with this year (handles cross-year)
            reservations_query = '''
                SELECT er.start_date, er.end_date, er.reserved_hours_per_day
                FROM employee_reservations er
                WHERE er.employee_id = ?
                  AND er.status = 'active'
                  AND er.start_date <= ?
                  AND er.end_date >= ?
            '''
            emp_reservations = db.fetch_all(reservations_query, (emp.id, year_end, year_start))

            # Enrich each month's schedule with pro-rated booking & reservation hours
            for sched in schedule_data:
                m = sched['month']

                pro_rated_booked = 0.0
                for b in emp_bookings:
                    pro_rated_booked += prorate_booking_hours_for_month(
                        parse_date(b['start_date']), parse_date(b['end_date']),
                        b['booked_hours'], m, current_year
                    )

                pro_rated_reserved = 0.0
                for r in emp_reservations:
                    pro_rated_reserved += prorate_reservation_hours_for_month(
                        parse_date(r['start_date']), parse_date(r['end_date']),
                        r['reserved_hours_per_day'], m, current_year
                    )

                sched['project_booked_hours'] = round(pro_rated_booked, 1)
                sched['reserved_hours'] = round(pro_rated_reserved, 1)
                sched['booked_hours'] = round(pro_rated_booked + pro_rated_reserved, 1)

            emp_data = emp.to_dict()
            emp_data['schedule'] = schedule_data

            # Add to department
            dashboard_data['departments'][dept]['employees'].append(emp_data)

            # Update monthly summary and department totals
            for sched in schedule_data:
                month = sched['month']
                # Recalculate base_available dynamically using current settings
                reserved_hours_per_day = sched['reserved_hours_per_day'] or 0
                base_available = (work_hours_per_day - reserved_hours_per_day) * work_days_per_month
                project_booked = sched['project_booked_hours'] or 0
                reserved = sched['reserved_hours'] or 0

                # Total utilized = project bookings + reservations
                total_utilized = project_booked + reserved

                # Actual available = base available - all utilized hours
                actual_available = base_available - total_utilized

                dashboard_data['monthly_summary'][month]['total_available'] += actual_available
                dashboard_data['monthly_summary'][month]['total_booked'] += total_utilized
                dashboard_data['monthly_summary'][month]['total_capacity'] += monthly_capacity
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