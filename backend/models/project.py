import json
from typing import Optional, Dict, Any, List
from datetime import datetime, date
from database import db

class Project:
    def __init__(self, **kwargs):
        self.id = kwargs.get('id')
        self.project_code = kwargs.get('project_code')
        self.name = kwargs.get('name')
        self.business_unit = kwargs.get('business_unit')
        self.description = kwargs.get('description')
        self.status = kwargs.get('status', 'planned')
        self.progress = kwargs.get('progress', 0)
        self.solution_architect_id = kwargs.get('solution_architect_id')
        self.business_analyst_id = kwargs.get('business_analyst_id')
        self.ba_name = kwargs.get('ba_name')
        self.start_date = kwargs.get('start_date')
        self.end_date = kwargs.get('end_date')
        self.priority = kwargs.get('priority', 1)
        self.attachments = json.loads(kwargs['attachments']) if kwargs.get('attachments') else []
        self.is_baselined = bool(kwargs.get('is_baselined', False))
        self.baseline_start_date = kwargs.get('baseline_start_date')
        self.baseline_end_date = kwargs.get('baseline_end_date')
        self.created_at = kwargs.get('created_at')
        self.updated_at = kwargs.get('updated_at')

    @staticmethod
    def create(project_code: str, name: str, description: str,
               solution_architect_id: int, business_unit: str = None, start_date: date = None,
               end_date: date = None, attachments: List[str] = None, priority: int = 1,
               business_analyst_id: int = None) -> 'Project':
        attachments_json = json.dumps(attachments or [])
        query = '''
            INSERT INTO projects (project_code, name, business_unit, description, solution_architect_id,
                                 start_date, end_date, priority, attachments, business_analyst_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        '''
        cursor = db.execute(query, (project_code, name, business_unit, description, solution_architect_id,
                                   start_date, end_date, priority, attachments_json, business_analyst_id))
        db.commit()
        return Project.get_by_id(cursor.lastrowid)

    @staticmethod
    def get_by_id(project_id: int) -> Optional['Project']:
        query = '''
            SELECT p.*, e.full_name as ba_name
            FROM projects p
            LEFT JOIN employees e ON p.business_analyst_id = e.id
            WHERE p.id = ?
        '''
        row = db.fetch_one(query, (project_id,))
        return Project(**row) if row else None

    @staticmethod
    def get_by_code(project_code: str) -> Optional['Project']:
        query = 'SELECT * FROM projects WHERE project_code = ?'
        row = db.fetch_one(query, (project_code,))
        return Project(**row) if row else None

    @staticmethod
    def get_by_architect(architect_id: int) -> List['Project']:
        query = 'SELECT * FROM projects WHERE solution_architect_id = ? ORDER BY created_at DESC'
        rows = db.fetch_all(query, (architect_id,))
        projects = [Project(**row) for row in rows]
        return [p.to_dict() for p in projects]

    @staticmethod
    def get_all() -> List[Dict]:
        query = '''
            SELECT p.*, u.full_name as architect_name, e.full_name as ba_name
            FROM projects p
            LEFT JOIN employees u ON p.solution_architect_id = u.id
            LEFT JOIN employees e ON p.business_analyst_id = e.id
            ORDER BY p.created_at DESC
        '''
        rows = db.fetch_all(query)

        # Fetch all milestones once and group by project_id
        all_milestones = db.fetch_all('SELECT * FROM project_milestones ORDER BY date ASC')
        milestones_by_project: Dict[int, List] = {}
        for m in all_milestones:
            pid = m['project_id']
            if pid not in milestones_by_project:
                milestones_by_project[pid] = []
            milestones_by_project[pid].append({
                'id': m['id'],
                'project_id': m['project_id'],
                'name': m['name'],
                'date': m['date'],
                'description': m.get('description'),
                'resources': json.loads(m['resources']) if m.get('resources') else [],
            })

        for row in rows:
            if row.get('attachments'):
                try:
                    row['attachments'] = json.loads(row['attachments'])
                except (json.JSONDecodeError, TypeError):
                    row['attachments'] = []
            else:
                row['attachments'] = []
            row['is_baselined'] = bool(row.get('is_baselined', False))
            row['milestones'] = milestones_by_project.get(row['id'], [])
        return rows

    def update(self, **kwargs) -> 'Project':
        updates = []
        params = []

        if 'name' in kwargs:
            updates.append('name = ?')
            params.append(kwargs['name'])
        if 'description' in kwargs:
            updates.append('description = ?')
            params.append(kwargs['description'])
        if 'business_unit' in kwargs:
            updates.append('business_unit = ?')
            params.append(kwargs['business_unit'])
        if 'status' in kwargs:
            updates.append('status = ?')
            params.append(kwargs['status'])
        if 'progress' in kwargs:
            updates.append('progress = ?')
            params.append(kwargs['progress'])
        if 'start_date' in kwargs:
            updates.append('start_date = ?')
            params.append(kwargs['start_date'])
        if 'end_date' in kwargs:
            updates.append('end_date = ?')
            params.append(kwargs['end_date'])
        if 'solution_architect_id' in kwargs:
            updates.append('solution_architect_id = ?')
            params.append(kwargs['solution_architect_id'])
        if 'priority' in kwargs:
            updates.append('priority = ?')
            params.append(kwargs['priority'])
        if 'business_analyst_id' in kwargs:
            updates.append('business_analyst_id = ?')
            params.append(kwargs['business_analyst_id'])
        if 'attachments' in kwargs:
            updates.append('attachments = ?')
            params.append(json.dumps(kwargs['attachments']))
        if 'is_baselined' in kwargs:
            new_val = bool(kwargs['is_baselined'])
            updates.append('is_baselined = ?')
            params.append(int(new_val))
            # Auto-snapshot dates when first baselining
            if new_val and not self.baseline_start_date:
                updates.append('baseline_start_date = ?')
                params.append(self.start_date)
                updates.append('baseline_end_date = ?')
                params.append(self.end_date)

        if updates:
            updates.append('updated_at = CURRENT_TIMESTAMP')
            params.append(self.id)
            query = f'UPDATE projects SET {", ".join(updates)} WHERE id = ?'
            db.execute(query, tuple(params))
            db.commit()

        return Project.get_by_id(self.id)

    def delete(self) -> bool:
        try:
            db.execute('DELETE FROM project_milestones WHERE project_id = ?', (self.id,))
            db.execute('DELETE FROM project_bookings WHERE project_id = ?', (self.id,))
            db.execute('DELETE FROM projects WHERE id = ?', (self.id,))
            db.commit()
            return True
        except Exception as e:
            raise Exception(f'Failed to delete project: {str(e)}')

    def get_milestones(self) -> List[Dict]:
        rows = db.fetch_all(
            'SELECT * FROM project_milestones WHERE project_id = ? ORDER BY date ASC',
            (self.id,)
        )
        return [{
            'id': r['id'],
            'project_id': r['project_id'],
            'name': r['name'],
            'date': r['date'],
            'description': r.get('description'),
            'resources': json.loads(r['resources']) if r.get('resources') else [],
        } for r in rows]

    def add_milestone(self, name: str, date_val: str, description: str = None,
                      resources: List[Dict] = None) -> Dict:
        resources_json = json.dumps(resources or [])
        cursor = db.execute(
            '''INSERT INTO project_milestones (project_id, name, date, description, resources)
               VALUES (?, ?, ?, ?, ?)''',
            (self.id, name, date_val, description, resources_json)
        )
        db.commit()
        row = db.fetch_one('SELECT * FROM project_milestones WHERE id = ?', (cursor.lastrowid,))
        return {
            'id': row['id'],
            'project_id': row['project_id'],
            'name': row['name'],
            'date': row['date'],
            'description': row.get('description'),
            'resources': json.loads(row['resources']) if row.get('resources') else [],
        }

    @staticmethod
    def update_milestone(milestone_id: int, name: str = None, date_val: str = None,
                         description: str = None, resources: List[Dict] = None) -> Optional[Dict]:
        updates, params = [], []
        if name is not None:
            updates.append('name = ?'); params.append(name)
        if date_val is not None:
            updates.append('date = ?'); params.append(date_val)
        if description is not None:
            updates.append('description = ?'); params.append(description)
        if resources is not None:
            updates.append('resources = ?'); params.append(json.dumps(resources))
        if updates:
            updates.append('updated_at = CURRENT_TIMESTAMP')
            params.append(milestone_id)
            db.execute(f'UPDATE project_milestones SET {", ".join(updates)} WHERE id = ?', tuple(params))
            db.commit()
        row = db.fetch_one('SELECT * FROM project_milestones WHERE id = ?', (milestone_id,))
        if not row:
            return None
        return {
            'id': row['id'],
            'project_id': row['project_id'],
            'name': row['name'],
            'date': row['date'],
            'description': row.get('description'),
            'resources': json.loads(row['resources']) if row.get('resources') else [],
        }

    @staticmethod
    def delete_milestone(milestone_id: int) -> bool:
        db.execute('DELETE FROM project_milestones WHERE id = ?', (milestone_id,))
        db.commit()
        return True

    def add_booking(self, employee_id: int, start_date: date, end_date: date,
                   booked_hours: float, role: str = None) -> Dict[str, Any]:
        if end_date < start_date:
            raise ValueError("End date must be after start date")
        from models.employee import Employee
        employee = Employee.get_by_id(employee_id)
        if not employee:
            raise ValueError("Employee not found")
        check_query = '''
            SELECT id, booked_hours, start_date, end_date FROM project_bookings
            WHERE project_id = ? AND employee_id = ?
                AND status != 'cancelled'
                AND (
                    (start_date <= ? AND end_date >= ?)
                    OR (start_date <= ? AND end_date >= ?)
                    OR (start_date >= ? AND end_date <= ?)
                )
        '''
        existing_booking = db.fetch_one(check_query, (
            self.id, employee_id,
            start_date, start_date,
            end_date, end_date,
            start_date, end_date
        ))
        if existing_booking:
            raise ValueError(
                f"Overlapping booking exists from {existing_booking['start_date']} "
                f"to {existing_booking['end_date']}. Please adjust the dates or cancel the existing booking."
            )
        query = '''
            INSERT INTO project_bookings (project_id, employee_id, start_date, end_date,
                                        booked_hours, role)
            VALUES (?, ?, ?, ?, ?, ?)
        '''
        cursor = db.execute(query, (self.id, employee_id, start_date, end_date, booked_hours, role))
        db.commit()
        return {'booking_id': cursor.lastrowid, 'message': 'Booking successful'}

    def get_bookings(self) -> List[Dict[str, Any]]:
        query = '''
            SELECT pb.*, e.full_name, e.department
            FROM project_bookings pb
            JOIN employees e ON pb.employee_id = e.id
            WHERE pb.project_id = ?
            ORDER BY pb.start_date DESC
        '''
        return db.fetch_all(query, (self.id,))

    def get_date_range_bookings(self, start_date: date, end_date: date) -> List[Dict[str, Any]]:
        query = '''
            SELECT pb.*, e.full_name, e.department
            FROM project_bookings pb
            JOIN employees e ON pb.employee_id = e.id
            WHERE pb.project_id = ?
                AND pb.status != 'cancelled'
                AND (
                    (pb.start_date <= ? AND pb.end_date >= ?)
                    OR (pb.start_date <= ? AND pb.end_date >= ?)
                    OR (pb.start_date >= ? AND pb.end_date <= ?)
                )
            ORDER BY pb.start_date, e.full_name
        '''
        return db.fetch_all(query, (
            self.id,
            start_date, start_date,
            end_date, end_date,
            start_date, end_date
        ))

    def to_dict(self) -> Dict[str, Any]:
        def format_date(d):
            if d is None:
                return None
            if isinstance(d, str):
                return d
            return d.isoformat()

        return {
            'id': self.id,
            'project_code': self.project_code,
            'name': self.name,
            'business_unit': self.business_unit,
            'description': self.description,
            'status': self.status,
            'progress': self.progress,
            'solution_architect_id': self.solution_architect_id,
            'business_analyst_id': self.business_analyst_id,
            'ba_name': self.ba_name,
            'start_date': format_date(self.start_date),
            'end_date': format_date(self.end_date),
            'priority': self.priority,
            'attachments': self.attachments,
            'is_baselined': self.is_baselined,
            'baseline_start_date': format_date(self.baseline_start_date),
            'baseline_end_date': format_date(self.baseline_end_date),
            'milestones': self.get_milestones(),
            'created_at': self.created_at,
            'updated_at': self.updated_at,
        }
