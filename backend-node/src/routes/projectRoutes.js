const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const ProjectController = require('../controllers/projectController');
const Project = require('../models/project');
const db = require('../database');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads/projects');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const project = Project.getById(parseInt(req.params.projectId));
    const ext = path.extname(file.originalname);
    const uniqueFilename = `${project ? project.project_code : 'unknown'}_${Date.now()}${ext}`;
    cb(null, uniqueFilename);
  }
});
const upload = multer({ storage });

// Get all bookings across all projects - Must come BEFORE /:projectId
router.get('/all-bookings', (req, res) => {
  try {
    const bookings = db.fetchAll(`
      SELECT
        pb.id,
        pb.project_id,
        pb.employee_id,
        pb.start_date,
        pb.end_date,
        pb.booked_hours,
        pb.status,
        p.name as project_name,
        p.project_code,
        e.full_name,
        e.department,
        e.position
      FROM project_bookings pb
      JOIN projects p ON pb.project_id = p.id
      JOIN employees e ON pb.employee_id = e.id
      ORDER BY pb.start_date DESC
    `);

    const result = bookings.map(row => ({
      id: row.id,
      project_id: row.project_id,
      employee_id: row.employee_id,
      start_date: String(row.start_date),
      end_date: String(row.end_date),
      booked_hours: parseFloat(row.booked_hours),
      status: String(row.status || 'booked'),
      project_name: String(row.project_name),
      project_code: String(row.project_code),
      full_name: String(row.full_name),
      department: String(row.department),
      position: String(row.position)
    }));

    res.json(result);
  } catch (e) {
    console.error('Error in get_all_bookings:', e);
    res.status(500).json({ detail: e.message });
  }
});

// Get available employees - Must come BEFORE /:projectId
router.get('/available/employees', (req, res) => {
  try {
    const { start_date, end_date, department } = req.query;

    if (!start_date || !end_date) {
      return res.status(400).json({ detail: 'start_date and end_date are required' });
    }

    const result = ProjectController.getAvailableEmployees(start_date, end_date, department);
    res.json(result);
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// Delete booking - Must come BEFORE /:projectId to avoid conflict
router.delete('/bookings/:bookingId', (req, res) => {
  try {
    const bookingId = parseInt(req.params.bookingId);

    // Check if booking exists
    const booking = db.fetchOne('SELECT * FROM project_bookings WHERE id = ?', [bookingId]);
    if (!booking) {
      return res.status(404).json({ detail: 'Booking not found' });
    }

    // Delete the booking
    db.execute('DELETE FROM project_bookings WHERE id = ?', [bookingId]);

    res.json({ success: true, message: 'Booking deleted successfully' });
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// Create project
router.post('/', (req, res) => {
  try {
    const result = ProjectController.createProject(req.body);
    if (result.error) {
      return res.status(400).json({ detail: result.error });
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// Get all projects
router.get('/', (req, res) => {
  try {
    const architectId = req.query.architect_id ? parseInt(req.query.architect_id) : null;
    const status = req.query.status;

    let projects;
    if (architectId) {
      projects = Project.getByArchitect(architectId);
    } else {
      projects = Project.getAll();
    }

    if (status) {
      projects = projects.filter(p => p.status === status);
    }

    res.json(projects);
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// Get project by ID
router.get('/:projectId', (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const project = Project.getById(projectId);

    if (!project) {
      return res.status(404).json({ detail: 'Project not found' });
    }

    const result = project.toDict();
    result.bookings = project.getBookings();
    res.json(result);
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// Update project
router.put('/:projectId', (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const result = ProjectController.updateProject(projectId, req.body);

    if (result.error) {
      return res.status(400).json({ detail: result.error });
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// Delete project
router.delete('/:projectId', (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const result = ProjectController.deleteProject(projectId);

    if (result.error) {
      return res.status(404).json({ detail: result.error });
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// Book employee for project
router.post('/:projectId/bookings', (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const result = ProjectController.bookEmployeeForProject(projectId, req.body);

    if (result.error) {
      return res.status(400).json({ detail: result.error });
    }
    res.json(result);
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// Get project bookings
router.get('/:projectId/bookings', (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    const project = Project.getById(projectId);

    if (!project) {
      return res.status(404).json({ detail: 'Project not found' });
    }

    res.json(project.getBookings());
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// Upload attachment
router.post('/:projectId/attachments', upload.single('file'), (req, res) => {
  try {
    const projectId = parseInt(req.params.projectId);
    console.log('[UPLOAD] Starting upload for project_id:', projectId);

    const project = Project.getById(projectId);
    if (!project) {
      console.log('[UPLOAD] Project not found:', projectId);
      return res.status(404).json({ detail: 'Project not found' });
    }

    console.log('[UPLOAD] Project found:', project.name, 'code:', project.project_code);

    if (!req.file) {
      return res.status(400).json({ detail: 'No file uploaded' });
    }

    console.log('[UPLOAD] File name:', req.file.originalname);
    console.log('[UPLOAD] Saved to:', req.file.path);

    // Store relative path for serving via static files
    const relativePath = `uploads/projects/${req.file.filename}`;

    // Update project attachments
    const attachments = Array.isArray(project.attachments) ? [...project.attachments] : [];
    console.log('[UPLOAD] Current attachments:', attachments);

    attachments.push({
      filename: req.file.originalname,
      path: relativePath,
      uploaded_at: new Date().toISOString()
    });

    console.log('[UPLOAD] New attachments:', attachments);

    project.update({ attachments });
    console.log('[UPLOAD] Database updated');

    res.json({ filename: req.file.originalname, path: relativePath });
  } catch (e) {
    console.error('[UPLOAD] Error:', e);
    res.status(500).json({ detail: e.message });
  }
});

module.exports = router;
