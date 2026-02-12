const express = require('express');
const router = express.Router();
const User = require('../models/user');
const { authenticate } = require('../middleware/auth');
const db = require('../database');

// Get users by role - public endpoint for login
router.get('/by-role/:role', (req, res) => {
  try {
    const users = User.getByRole(req.params.role);
    res.json(users.map(user => user.toDict()));
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// Get solution architects - requires authentication
router.get('/architects', authenticate, (req, res) => {
  try {
    const architects = User.getByRole('solution_architect');
    res.json(architects.map(architect => architect.toDict()));
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// Get all users - requires authentication
router.get('/', authenticate, (req, res) => {
  try {
    const roles = ['solution_architect', 'line_manager', 'dashboard_viewer', 'admin'];
    const allUsers = [];

    for (const role of roles) {
      const users = User.getByRole(role);
      allUsers.push(...users.map(user => user.toDict()));
    }

    res.json(allUsers);
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// Create user - admin only
router.post('/', authenticate, async (req, res) => {
  try {
    // Check if current user is admin
    if (req.currentUser.role !== 'admin') {
      return res.status(403).json({ detail: 'Only administrators can create users' });
    }

    const { username, password, role, full_name, department } = req.body;

    // Validate required fields
    if (!username || !password || !role || !full_name) {
      return res.status(400).json({
        detail: 'Username, password, role, and full_name are required'
      });
    }

    // Check if username already exists
    const existingUser = User.getByUsername(username);
    if (existingUser) {
      return res.status(400).json({ detail: 'Username already exists' });
    }

    // Validate role
    const validRoles = ['admin', 'line_manager', 'solution_architect', 'dashboard_viewer'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        detail: `Invalid role. Must be one of: ${validRoles.join(', ')}`
      });
    }

    // Create the user
    const newUser = User.create(username, password, role, full_name, department);

    res.json({
      success: true,
      message: 'User created successfully',
      user: newUser.toDict()
    });
  } catch (e) {
    res.status(500).json({ detail: `Failed to create user: ${e.message}` });
  }
});

// Delete user - admin only
router.delete('/:userId', authenticate, (req, res) => {
  try {
    // Check if current user is admin
    if (req.currentUser.role !== 'admin') {
      return res.status(403).json({ detail: 'Only administrators can delete users' });
    }

    const userId = parseInt(req.params.userId);

    // Check if user exists
    const user = User.getById(userId);
    if (!user) {
      return res.status(404).json({ detail: 'User not found' });
    }

    // Prevent deleting own account
    if (user.id === req.currentUser.id) {
      return res.status(400).json({ detail: 'Cannot delete your own account' });
    }

    // Delete the user
    db.execute('DELETE FROM users WHERE id = ?', [userId]);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (e) {
    res.status(500).json({ detail: `Failed to delete user: ${e.message}` });
  }
});

module.exports = router;
