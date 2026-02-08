from typing import Optional, Dict, Any
from datetime import datetime
from database import db
import bcrypt

class User:
    def __init__(self, **kwargs):
        self.id = kwargs.get('id')
        self.username = kwargs.get('username')
        self.password_hash = kwargs.get('password_hash')
        self.role = kwargs.get('role')
        self.full_name = kwargs.get('full_name')
        self.department = kwargs.get('department')
        self.created_at = kwargs.get('created_at')
        self.updated_at = kwargs.get('updated_at')
    
    @staticmethod
    def hash_password(password: str) -> str:
        """Hash a password for storing."""
        salt = bcrypt.gensalt()
        password_bytes = password.encode('utf-8')
        hashed = bcrypt.hashpw(password_bytes, salt)
        return hashed.decode('utf-8')
    
    def verify_password(self, password: str) -> bool:
        """Verify a password against the hash."""
        password_bytes = password.encode('utf-8')
        hash_bytes = self.password_hash.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hash_bytes)
    
    @staticmethod
    def create(username: str, password: str, role: str, full_name: str, department: Optional[str] = None) -> 'User':
        """Create a new user with hashed password."""
        password_hash = User.hash_password(password)
        query = '''
            INSERT INTO users (username, password_hash, role, full_name, department)
            VALUES (?, ?, ?, ?, ?)
        '''
        cursor = db.execute(query, (username, password_hash, role, full_name, department))
        db.commit()
        return User.get_by_id(cursor.lastrowid)
    
    @staticmethod
    def get_by_id(user_id: int) -> Optional['User']:
        query = 'SELECT * FROM users WHERE id = ?'
        row = db.fetch_one(query, (user_id,))
        return User(**row) if row else None
    
    @staticmethod
    def get_by_username(username: str) -> Optional['User']:
        query = 'SELECT * FROM users WHERE username = ?'
        row = db.fetch_one(query, (username,))
        return User(**row) if row else None
    
    @staticmethod
    def get_by_role(role: str):
        query = 'SELECT * FROM users WHERE role = ? ORDER BY full_name'
        rows = db.fetch_all(query, (role,))
        return [User(**row) for row in rows]
    
    def update(self, **kwargs) -> 'User':
        updates = []
        params = []
        
        if 'full_name' in kwargs:
            updates.append('full_name = ?')
            params.append(kwargs['full_name'])
        if 'department' in kwargs:
            updates.append('department = ?')
            params.append(kwargs['department'])
        
        if updates:
            updates.append('updated_at = CURRENT_TIMESTAMP')
            params.append(self.id)
            query = f'UPDATE users SET {", ".join(updates)} WHERE id = ?'
            db.execute(query, tuple(params))
            db.commit()
        
        return User.get_by_id(self.id)
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'id': self.id,
            'username': self.username,
            'role': self.role,
            'full_name': self.full_name,
            'department': self.department,
            'created_at': self.created_at,
            'updated_at': self.updated_at
        }