const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const config = require('./config');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 8000;

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

// CORS middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://localhost:3000',
    'http://dplanner.westeurope.cloudapp.azure.com',
    'https://dplanner.westeurope.cloudapp.azure.com',
    'https://resourcemanager-hazel.vercel.app'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['*']
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files for uploads
app.use('/uploads', express.static(uploadDir));

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Employee Scheduling & Project Management System',
    version: config.APP_CONFIG.version,
    authentication: 'Use Bearer token in Authorization header',
    endpoints: {
      employees: '/api/employees',
      projects: '/api/projects',
      dashboard: '/api/dashboard'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Initialize database and start server
async function startServer() {
  try {
    // Initialize database
    await db.init();
    console.log('Database initialized');

    // Now load routes (they depend on db being initialized)
    const User = require('./models/user');
    const { createAccessToken } = require('./middleware/auth');

    const employeeRoutes = require('./routes/employeeRoutes');
    const projectRoutes = require('./routes/projectRoutes');
    const reservationRoutes = require('./routes/reservationRoutes');
    const userRoutes = require('./routes/userRoutes');
    const dashboardRoutes = require('./routes/dashboardRoutes');
    const settingsRoutes = require('./routes/settingsRoutes');

    // Login endpoint
    app.post('/login', (req, res) => {
      try {
        const { username, password } = req.body;

        if (!username) {
          return res.status(400).json({ detail: 'Username is required' });
        }

        if (!password) {
          return res.status(400).json({ detail: 'Password is required' });
        }

        const user = User.getByUsername(username);
        if (!user) {
          return res.status(401).json({ detail: 'Invalid username or password' });
        }

        // Verify password
        if (!user.verifyPassword(password)) {
          return res.status(401).json({ detail: 'Invalid username or password' });
        }

        // Create access token
        const accessToken = createAccessToken({ sub: user.username });

        res.json({
          success: true,
          access_token: accessToken,
          token_type: 'bearer',
          user: user.toDict(),
          message: 'Login successful'
        });
      } catch (e) {
        console.error('Login error:', e);
        res.status(500).json({ detail: e.message });
      }
    });

    // Mount routers
    app.use('/api/employees', employeeRoutes);
    app.use('/api/employees/:employeeId/reservations', reservationRoutes);
    app.use('/api/projects', projectRoutes);
    app.use('/api/users', userRoutes);
    app.use('/api/dashboard', dashboardRoutes);
    app.use('/api/settings', settingsRoutes);

    // Initialize admin user
    const adminUser = User.getByUsername('admin');
    if (!adminUser) {
      User.create('admin', 'admin123', 'admin', 'System Administrator', 'IT');
      console.log('Created admin user: admin/admin123');
    }

    // Start server
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`${config.APP_CONFIG.title} - ${config.APP_CONFIG.version}`);
      console.log(`Server running on http://0.0.0.0:${PORT}`);
    });
  } catch (e) {
    console.error('Failed to start server:', e);
    process.exit(1);
  }
}

startServer();

module.exports = app;
