import os
from pathlib import Path

BASE_DIR = Path(__file__).parent
DATABASE_PATH = BASE_DIR / "database" / "scheduling.db"

DATABASE_DIR = BASE_DIR / "database"
DATABASE_DIR.mkdir(exist_ok=True)

DATABASE_CONFIG = {
    "database": str(DATABASE_PATH),
    "check_same_thread": False # for SQLite multi-threading
}

APP_CONFIG = {
    "title": "RMS - Resource Management System",
    "description": "demo project for resource management system",
    "version": "1.0.0"
}

# business rules
WORK_HOURS_PER_DAY = 6
WORK_DAYS_PER_MONTH = 20
MONTHS_IN_YEAR = 12

# Site access password
SITE_PASSWORD = "Welcome@123"

# CORS allowed origins
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://localhost:3000",
    "https://localhost:3001",
    "http://188.245.248.171:3000",
    "https://188.245.248.171:3000",
    "http://188.245.248.171",
    "https://188.245.248.171",
    "http://dplanner.westeurope.cloudapp.azure.com/",
    "https://resourcemanager-gi1bs678q-username10924s-projects.vercel.app/"
]