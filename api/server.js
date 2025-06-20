// server.js - Main entry point for Waffle Heaven Restaurant API
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const compression = require('compression');
const dotenv = require('dotenv');
const path = require('path');

// Import route modules
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const menuRoutes = require('./routes/menu');
const categoryRoutes = require('./routes/categories');
const orderRoutes = require('./routes/orders');
const reservationRoutes = require('./routes/reservations');
const reviewRoutes = require('./routes/reviews');
const adminRoutes = require('./routes/admin');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();
const PORT = process.env.PORT || 5000;

// Security and optimization middleware
app.use(helmet()); // Set security-related HTTP headers
app.use(compression()); // Compress responses
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://waffle-heaven.netlify.app'] 
    : ['http://localhost:3000'],
  credentials: true
}));

// Request parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Rate limiting to prevent abuse
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', apiLimiter);

// Serve static files if needed (for admin panel, documentation, etc.)
app.use('/static', express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/menu', menuRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Server is running' });
});

// Root API info endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'Welcome to Waffle Heaven API',
    version: '1.0.0',
    documentation: process.env.NODE_ENV === 'production' 
      ? 'https://waffle-heaven.netlify.app/api-docs' 
      : 'http://localhost:5000/static/api-docs'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    status: 'error',
    statusCode,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// 404 handler - Keep this as the last route
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    statusCode: 404,
    message: 'Resource not found'
  });
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
});

module.exports = app; // For testing purposes