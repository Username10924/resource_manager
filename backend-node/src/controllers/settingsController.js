const config = require('../config');

class SettingsController {
  static getSettings() {
    return {
      work_hours_per_day: config.WORK_HOURS_PER_DAY,
      work_days_per_month: config.WORK_DAYS_PER_MONTH,
      months_in_year: config.MONTHS_IN_YEAR
    };
  }

  static getWorkHoursPerDay() {
    return config.WORK_HOURS_PER_DAY;
  }

  static getWorkDaysPerMonth() {
    return config.WORK_DAYS_PER_MONTH;
  }

  static getMonthlyCapacity() {
    return config.WORK_HOURS_PER_DAY * config.WORK_DAYS_PER_MONTH;
  }

  static updateSettings(settings) {
    if (settings.work_hours_per_day !== undefined) {
      config.WORK_HOURS_PER_DAY = settings.work_hours_per_day;
    }
    if (settings.work_days_per_month !== undefined) {
      config.WORK_DAYS_PER_MONTH = settings.work_days_per_month;
    }
    if (settings.months_in_year !== undefined) {
      config.MONTHS_IN_YEAR = settings.months_in_year;
    }
    return SettingsController.getSettings();
  }

  static getSitePassword() {
    return config.SITE_PASSWORD;
  }

  static verifySitePassword(password) {
    return password === config.SITE_PASSWORD;
  }

  static updateSitePassword(newPassword) {
    config.SITE_PASSWORD = newPassword;
    return true;
  }
}

module.exports = SettingsController;
