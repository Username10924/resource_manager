const path = require('path');
const fs = require('fs');

const BASE_DIR = path.dirname(__dirname);
const DATABASE_PATH = path.join(BASE_DIR, 'database', 'scheduling.db');

// Ensure database directory exists
const DATABASE_DIR = path.join(BASE_DIR, 'database');
if (!fs.existsSync(DATABASE_DIR)) {
  fs.mkdirSync(DATABASE_DIR, { recursive: true });
}

const DATABASE_CONFIG = {
  database: DATABASE_PATH
};

const APP_CONFIG = {
  title: "RMS - Resource Management System",
  description: "demo project for resource management system",
  version: "1.0.0"
};

// Business rules - mutable config
let WORK_HOURS_PER_DAY = 6;
let WORK_DAYS_PER_MONTH = 20;
let MONTHS_IN_YEAR = 12;

// Site access password
let SITE_PASSWORD = "Welcome@123";

// Config file path for persistence
const CONFIG_FILE_PATH = path.join(BASE_DIR, 'config.json');

// Load config from file if exists
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE_PATH)) {
      const data = JSON.parse(fs.readFileSync(CONFIG_FILE_PATH, 'utf8'));
      if (data.WORK_HOURS_PER_DAY) WORK_HOURS_PER_DAY = data.WORK_HOURS_PER_DAY;
      if (data.WORK_DAYS_PER_MONTH) WORK_DAYS_PER_MONTH = data.WORK_DAYS_PER_MONTH;
      if (data.MONTHS_IN_YEAR) MONTHS_IN_YEAR = data.MONTHS_IN_YEAR;
      if (data.SITE_PASSWORD) SITE_PASSWORD = data.SITE_PASSWORD;
    }
  } catch (e) {
    console.error('Error loading config:', e);
  }
}

// Save config to file
function saveConfig() {
  try {
    fs.writeFileSync(CONFIG_FILE_PATH, JSON.stringify({
      WORK_HOURS_PER_DAY,
      WORK_DAYS_PER_MONTH,
      MONTHS_IN_YEAR,
      SITE_PASSWORD
    }, null, 2));
  } catch (e) {
    console.error('Error saving config:', e);
  }
}

// Load config on module load
loadConfig();

module.exports = {
  BASE_DIR,
  DATABASE_PATH,
  DATABASE_CONFIG,
  APP_CONFIG,
  get WORK_HOURS_PER_DAY() { return WORK_HOURS_PER_DAY; },
  set WORK_HOURS_PER_DAY(val) { WORK_HOURS_PER_DAY = val; saveConfig(); },
  get WORK_DAYS_PER_MONTH() { return WORK_DAYS_PER_MONTH; },
  set WORK_DAYS_PER_MONTH(val) { WORK_DAYS_PER_MONTH = val; saveConfig(); },
  get MONTHS_IN_YEAR() { return MONTHS_IN_YEAR; },
  set MONTHS_IN_YEAR(val) { MONTHS_IN_YEAR = val; saveConfig(); },
  get SITE_PASSWORD() { return SITE_PASSWORD; },
  set SITE_PASSWORD(val) { SITE_PASSWORD = val; saveConfig(); },
  loadConfig,
  saveConfig
};
