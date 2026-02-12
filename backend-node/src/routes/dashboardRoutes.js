const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/dashboardController');

// Get resources dashboard - public endpoint
router.get('/resources', (req, res) => {
  try {
    const managerId = req.query.manager_id ? parseInt(req.query.manager_id) : null;
    const result = DashboardController.getResourcesDashboard(managerId);
    res.json(result);
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// Get projects dashboard - public endpoint
router.get('/projects', (req, res) => {
  try {
    const architectId = req.query.architect_id ? parseInt(req.query.architect_id) : null;
    const result = DashboardController.getProjectsDashboard(architectId);
    res.json(result);
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// Get bookings overview - public endpoint
router.get('/bookings/overview', (req, res) => {
  try {
    const year = req.query.year ? parseInt(req.query.year) : null;
    const result = DashboardController.getBookingOverview(year);
    res.json(result);
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

module.exports = router;
