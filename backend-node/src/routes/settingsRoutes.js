const express = require('express');
const router = express.Router();
const SettingsController = require('../controllers/settingsController');
const User = require('../models/user');
const { authenticate } = require('../middleware/auth');
const db = require('../database');

// Get settings - requires authentication
router.get('/', authenticate, (req, res) => {
  try {
    res.json(SettingsController.getSettings());
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// Update settings - requires authentication
router.put('/', authenticate, (req, res) => {
  try {
    const { work_hours_per_day, work_days_per_month, months_in_year } = req.body;

    // Validate
    if (work_hours_per_day !== undefined && (work_hours_per_day < 1 || work_hours_per_day > 24)) {
      return res.status(400).json({ detail: 'Work hours per day must be between 1 and 24' });
    }
    if (work_days_per_month !== undefined && (work_days_per_month < 1 || work_days_per_month > 31)) {
      return res.status(400).json({ detail: 'Work days per month must be between 1 and 31' });
    }
    if (months_in_year !== undefined && (months_in_year < 1 || months_in_year > 12)) {
      return res.status(400).json({ detail: 'Months in year must be between 1 and 12' });
    }

    const result = SettingsController.updateSettings(req.body);
    res.json(result);
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// Verify site password - public endpoint
router.post('/verify-password', (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ detail: 'Password is required' });
    }

    if (SettingsController.verifySitePassword(password)) {
      res.json({ success: true, message: 'Access granted' });
    } else {
      res.status(401).json({ detail: 'Invalid password' });
    }
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// Update site password - requires authentication
router.put('/site-password', authenticate, (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ detail: 'Current password and new password are required' });
    }

    if (!SettingsController.verifySitePassword(current_password)) {
      return res.status(400).json({ detail: 'Current password is incorrect' });
    }

    SettingsController.updateSitePassword(new_password);
    res.json({ success: true, message: 'Site password updated successfully' });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// Change user password - requires authentication
router.put('/change-password', authenticate, (req, res) => {
  try {
    const { current_password, new_password } = req.body;

    if (!current_password || !new_password) {
      return res.status(400).json({ detail: 'Current password and new password are required' });
    }

    if (new_password.length < 4) {
      return res.status(400).json({ detail: 'New password must be at least 4 characters' });
    }

    // Verify current password
    if (!req.currentUser.verifyPassword(current_password)) {
      return res.status(400).json({ detail: 'Current password is incorrect' });
    }

    // Update password
    const newHash = User.hashPassword(new_password);
    db.execute(
      'UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [newHash, req.currentUser.id]
    );

    res.json({ success: true, message: 'Password updated successfully' });
  } catch (e) {
    res.status(500).json({ detail: `Failed to update password: ${e.message}` });
  }
});

module.exports = router;
