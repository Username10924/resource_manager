from typing import Dict, Any, Optional
import re
from pathlib import Path
import importlib
from database import db

class SettingsController:
    @staticmethod
    def get_settings() -> Dict[str, Any]:
        """Get current business rules settings from config.py"""
        config_path = Path(__file__).parent.parent / "config.py"
        
        settings = {
            'work_hours_per_day': 7,
            'work_days_per_month': 18.333333333,
            'months_in_year': 12
        }
        
        try:
            with open(config_path, 'r') as f:
                content = f.read()
                
            # Extract values using regex
            work_hours_match = re.search(r'WORK_HOURS_PER_DAY\s*=\s*(\d+)', content)
            work_days_match = re.search(r'WORK_DAYS_PER_MONTH\s*=\s*(\d+\.?\d*)', content)
            months_match = re.search(r'MONTHS_IN_YEAR\s*=\s*(\d+)', content)
            
            if work_hours_match:
                settings['work_hours_per_day'] = int(work_hours_match.group(1))
            if work_days_match:
                settings['work_days_per_month'] = float(work_days_match.group(1))
            if months_match:
                settings['months_in_year'] = int(months_match.group(1))
                
        except Exception as e:
            print(f"Error reading config: {e}")
            
        return settings
    
    @staticmethod
    def get_work_hours_per_day() -> int:
        """Get work hours per day dynamically"""
        return SettingsController.get_settings()['work_hours_per_day']
    
    @staticmethod
    def get_work_days_per_month() -> float:
        """Get work days per month dynamically"""
        return SettingsController.get_settings()['work_days_per_month']
    
    @staticmethod
    def get_monthly_capacity() -> float:
        """Get monthly capacity (hours_per_day * days_per_month)"""
        settings = SettingsController.get_settings()
        return settings['work_hours_per_day'] * settings['work_days_per_month']
    
    @staticmethod
    def reload_config():
        """Reload the config module to pick up new values"""
        import config
        importlib.reload(config)
    
    @staticmethod
    def update_settings(settings: Dict[str, Any]) -> Dict[str, Any]:
        """Update business rules settings in config.py"""
        config_path = Path(__file__).parent.parent / "config.py"
        
        try:
            with open(config_path, 'r') as f:
                content = f.read()
            
            # Update values using regex
            if 'work_hours_per_day' in settings:
                content = re.sub(
                    r'WORK_HOURS_PER_DAY\s*=\s*\d+',
                    f'WORK_HOURS_PER_DAY = {settings["work_hours_per_day"]}',
                    content
                )
            
            if 'work_days_per_month' in settings:
                content = re.sub(
                    r'WORK_DAYS_PER_MONTH\s*=\s*\d+\.?\d*',
                    f'WORK_DAYS_PER_MONTH = {settings["work_days_per_month"]}',
                    content
                )
            
            if 'months_in_year' in settings:
                content = re.sub(
                    r'MONTHS_IN_YEAR\s*=\s*\d+',
                    f'MONTHS_IN_YEAR = {settings["months_in_year"]}',
                    content
                )
            
            # Write back to file
            with open(config_path, 'w') as f:
                f.write(content)
            
            # Reload config module to pick up new values
            SettingsController.reload_config()
            
            # Return updated settings
            return SettingsController.get_settings()
            
        except Exception as e:
            raise Exception(f"Error updating config: {str(e)}")

    @staticmethod
    def get_site_password() -> str:
        """Get the current site access password from config.py"""
        config_path = Path(__file__).parent.parent / "config.py"
        default_password = "Welcome@123"
        
        try:
            with open(config_path, 'r') as f:
                content = f.read()
            
            match = re.search(r'SITE_PASSWORD\s*=\s*["\'](.+?)["\']', content)
            if match:
                return match.group(1)
        except Exception as e:
            print(f"Error reading site password: {e}")
        
        return default_password

    @staticmethod
    def verify_site_password(password: str) -> bool:
        """Verify the provided password against the site password"""
        return password == SettingsController.get_site_password()

    # --- Per-employee business rule overrides ---

    @staticmethod
    def get_settings_for_employee(employee_id: int) -> Dict[str, Any]:
        """Get effective settings for an employee, applying per-employee overrides over global settings."""
        global_settings = SettingsController.get_settings()
        row = db.fetch_one('SELECT * FROM employee_business_rules WHERE employee_id = ?', (employee_id,))
        if not row:
            return global_settings
        return {
            'work_hours_per_day': int(row['work_hours_per_day']) if row['work_hours_per_day'] is not None else global_settings['work_hours_per_day'],
            'work_days_per_month': float(row['work_days_per_month']) if row['work_days_per_month'] is not None else global_settings['work_days_per_month'],
            'months_in_year': int(row['months_in_year']) if row['months_in_year'] is not None else global_settings['months_in_year'],
        }

    @staticmethod
    def get_employee_business_rules(employee_id: int) -> Optional[Dict[str, Any]]:
        """Return stored custom rules for an employee, or None if none are set."""
        row = db.fetch_one('SELECT * FROM employee_business_rules WHERE employee_id = ?', (employee_id,))
        return dict(row) if row else None

    @staticmethod
    def set_employee_business_rules(employee_id: int, rules: Dict[str, Any]) -> Dict[str, Any]:
        """Create or update custom business rules for an employee."""
        existing = db.fetch_one('SELECT id FROM employee_business_rules WHERE employee_id = ?', (employee_id,))
        if existing:
            updates = []
            params = []
            if 'work_hours_per_day' in rules:
                updates.append('work_hours_per_day = ?')
                params.append(rules['work_hours_per_day'])
            if 'work_days_per_month' in rules:
                updates.append('work_days_per_month = ?')
                params.append(rules['work_days_per_month'])
            if 'months_in_year' in rules:
                updates.append('months_in_year = ?')
                params.append(rules['months_in_year'])
            if updates:
                updates.append('updated_at = CURRENT_TIMESTAMP')
                params.append(employee_id)
                db.execute(f'UPDATE employee_business_rules SET {", ".join(updates)} WHERE employee_id = ?', tuple(params))
                db.commit()
        else:
            db.execute(
                'INSERT INTO employee_business_rules (employee_id, work_hours_per_day, work_days_per_month, months_in_year) VALUES (?, ?, ?, ?)',
                (employee_id, rules.get('work_hours_per_day'), rules.get('work_days_per_month'), rules.get('months_in_year'))
            )
            db.commit()
        return SettingsController.get_employee_business_rules(employee_id)

    @staticmethod
    def delete_employee_business_rules(employee_id: int) -> bool:
        """Remove custom business rules for an employee (reverts to global settings)."""
        db.execute('DELETE FROM employee_business_rules WHERE employee_id = ?', (employee_id,))
        db.commit()
        return True

    @staticmethod
    def update_site_password(new_password: str) -> bool:
        """Update the site access password in config.py"""
        config_path = Path(__file__).parent.parent / "config.py"
        
        try:
            with open(config_path, 'r') as f:
                content = f.read()
            
            if re.search(r'SITE_PASSWORD\s*=', content):
                content = re.sub(
                    r'SITE_PASSWORD\s*=\s*["\'].+?["\']',
                    f'SITE_PASSWORD = "{new_password}"',
                    content
                )
            else:
                content += f'\nSITE_PASSWORD = "{new_password}"\n'
            
            with open(config_path, 'w') as f:
                f.write(content)
            
            SettingsController.reload_config()
            return True
        except Exception as e:
            raise Exception(f"Error updating site password: {str(e)}")
