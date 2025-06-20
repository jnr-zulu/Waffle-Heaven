// reservations.js - Reservation route handler
const express = require('express');
const router = express.Router();
const { body, query, param, validationResult } = require('express-validator');
const db = require('../config/database');
const auth = require('../middleware/auth');
const { checkAvailability, checkTableCapacity } = require('../utils/reservationHelpers');

// @route   POST api/reservations
// @desc    Create a new reservation
// @access  Public (could be restricted to authenticated users)
router.post('/', [
  // Validation for reservation fields
  body('date').isDate().withMessage('Valid reservation date is required'),
  body('time').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).withMessage('Valid time in format HH:MM is required'),
  body('partySize').isInt({ min: 1, max: 20 }).withMessage('Party size must be between 1 and 20'),
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required'),
  body('phone').notEmpty().withMessage('Phone number is required'),
  body('specialRequests').optional()
], async (req, res) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { date, time, partySize, name, email, phone, specialRequests } = req.body;

  try {
    // Check if tables are available for the requested time and party size
    const isAvailable = await checkAvailability(date, time, partySize);
    if (!isAvailable) {
      return res.status(400).json({ 
        message: 'No tables available for the selected time and party size' 
      });
    }

    // Insert reservation into database
    const [result] = await db.query(
      `INSERT INTO reservations 
       (reservation_date, reservation_time, party_size, customer_name, email, phone, special_requests, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, 'confirmed')`,
      [date, time, partySize, name, email, phone, specialRequests || null]
    );

    // Generate confirmation number (e.g., REZ-1234)
    const confirmationNumber = `REZ-${result.insertId.toString().padStart(4, '0')}`;
    
    // Update the reservation with the confirmation number
    await db.query(
      'UPDATE reservations SET confirmation_number = ? WHERE id = ?',
      [confirmationNumber, result.insertId]
    );

    // Send confirmation email (implementation would be in a separate module)
    // sendConfirmationEmail(email, { name, date, time, partySize, confirmationNumber });

    res.status(201).json({
      message: 'Reservation created successfully',
      confirmationNumber,
      reservationId: result.insertId
    });
  } catch (err) {
    console.error('Reservation creation error:', err.message);
    res.status(500).json({ message: 'Server error while creating reservation' });
  }
});

// @route   GET api/reservations
// @desc    Get all reservations (with optional date filtering)
// @access  Private (admin only)
router.get('/', [
  auth, 
  // Optional query parameters for filtering
  query('date').optional().isDate(),
  query('status').optional().isIn(['confirmed', 'cancelled', 'completed', 'no-show'])
], async (req, res) => {
  // Only allow admins to view all reservations
  if (!req.user.isAdmin) {
    return res.status(403).json({ message: 'Access denied' });
  }

  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    let query = 'SELECT * FROM reservations';
    const queryParams = [];

    // Add filters if provided
    if (req.query.date) {
      query += ' WHERE reservation_date = ?';
      queryParams.push(req.query.date);
      
      if (req.query.status) {
        query += ' AND status = ?';
        queryParams.push(req.query.status);
      }
    } else if (req.query.status) {
      query += ' WHERE status = ?';
      queryParams.push(req.query.status);
    }

    query += ' ORDER BY reservation_date ASC, reservation_time ASC';
    
    const [reservations] = await db.query(query, queryParams);
    res.json(reservations);
  } catch (err) {
    console.error('Error fetching reservations:', err.message);
    res.status(500).json({ message: 'Server error while fetching reservations' });
  }
});

// @route   GET api/reservations/:id
// @desc    Get reservation by ID or confirmation number
// @access  Mixed (public for own reservation, private for others)
router.get('/:identifier', [
  param('identifier').notEmpty()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { identifier } = req.params;
  
  try {
    // Check if identifier is a confirmation number or ID
    const isConfirmationNumber = identifier.startsWith('REZ-');
    
    let query;
    if (isConfirmationNumber) {
      query = 'SELECT * FROM reservations WHERE confirmation_number = ?';
    } else {
      query = 'SELECT * FROM reservations WHERE id = ?';
    }
    
    const [reservations] = await db.query(query, [identifier]);
    
    if (reservations.length === 0) {
      return res.status(404).json({ message: 'Reservation not found' });
    }
    
    // If user is authenticated and is admin, or if this is their reservation, allow access
    // Otherwise, only return minimal public information
    const reservation = reservations[0];
    
    // Check if authenticated user matches the reservation email
    // or if user is admin (this would need auth middleware)
    const isAuthorized = req.user && (req.user.isAdmin || req.user.email === reservation.email);
    
    if (!isAuthorized) {
      // Return limited info for public access with confirmation number
      return res.json({
        confirmationNumber: reservation.confirmation_number,
        date: reservation.reservation_date,
        time: reservation.reservation_time,
        status: reservation.status
      });
    }
    
    // Return full details for authorized users
    res.json(reservation);
  } catch (err) {
    console.error('Error fetching reservation:', err.message);
    res.status(500).json({ message: 'Server error while fetching reservation' });
  }
});

// @route   PUT api/reservations/:id
// @desc    Update a reservation
// @access  Mixed (public with confirmation, private otherwise)
router.put('/:id', [
  param('id').isNumeric(),
  body('date').optional().isDate(),
  body('time').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('partySize').optional().isInt({ min: 1, max: 20 }),
  body('name').optional().notEmpty(),
  body('phone').optional().notEmpty(),
  body('specialRequests').optional(),
  body('confirmationNumber').optional()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // First verify this reservation exists
    const [existingReservations] = await db.query(
      'SELECT * FROM reservations WHERE id = ?',
      [req.params.id]
    );
    
    if (existingReservations.length === 0) {
      return res.status(404).json({ message: 'Reservation not found' });
    }
    
    const existingReservation = existingReservations[0];
    
    // Check authorization - either admin user or must provide correct confirmation number
    const isAdmin = req.user && req.user.isAdmin;
    const hasConfirmation = req.body.confirmationNumber === existingReservation.confirmation_number;
    
    if (!isAdmin && !hasConfirmation) {
      return res.status(403).json({ 
        message: 'Authorization required. Please provide confirmation number.' 
      });
    }
    
    // Build update query dynamically based on provided fields
    const updateFields = [];
    const updateValues = [];
    
    if (req.body.date) {
      updateFields.push('reservation_date = ?');
      updateValues.push(req.body.date);
    }
    
    if (req.body.time) {
      updateFields.push('reservation_time = ?');
      updateValues.push(req.body.time);
    }
    
    if (req.body.partySize) {
      updateFields.push('party_size = ?');
      updateValues.push(req.body.partySize);
    }
    
    if (req.body.name) {
      updateFields.push('customer_name = ?');
      updateValues.push(req.body.name);
    }
    
    if (req.body.phone) {
      updateFields.push('phone = ?');
      updateValues.push(req.body.phone);
    }
    
    if ('specialRequests' in req.body) {
      updateFields.push('special_requests = ?');
      updateValues.push(req.body.specialRequests);
    }
    
    if (updateFields.length === 0) {
      return res.status(400).json({ message: 'No valid fields to update' });
    }
    
    // Check availability if date/time/party size is changing
    if (req.body.date || req.body.time || req.body.partySize) {
      const newDate = req.body.date || existingReservation.reservation_date;
      const newTime = req.body.time || existingReservation.reservation_time;
      const newPartySize = req.body.partySize || existingReservation.party_size;
      
      // Skip availability check if reducing party size or keeping same date/time
      const needsAvailabilityCheck = 
        (newPartySize > existingReservation.party_size) ||
        (newDate !== existingReservation.reservation_date) ||
        (newTime !== existingReservation.reservation_time);
      
      if (needsAvailabilityCheck) {
        const isAvailable = await checkAvailability(newDate, newTime, newPartySize, req.params.id);
        if (!isAvailable) {
          return res.status(400).json({ 
            message: 'No tables available for the updated time and party size' 
          });
        }
      }
    }
    
    // Perform the update
    updateValues.push(req.params.id); // Add ID for WHERE clause
    
    const query = `UPDATE reservations SET ${updateFields.join(', ')} WHERE id = ?`;
    await db.query(query, updateValues);
    
    res.json({ 
      message: 'Reservation updated successfully',
      id: req.params.id
    });
  } catch (err) {
    console.error('Error updating reservation:', err.message);
    res.status(500).json({ message: 'Server error while updating reservation' });
  }
});

// @route   DELETE api/reservations/:id
// @desc    Cancel a reservation
// @access  Mixed (public with confirmation, private otherwise)
router.delete('/:id', [
  param('id').isNumeric(),
  body('confirmationNumber').optional()
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  try {
    // First verify this reservation exists
    const [existingReservations] = await db.query(
      'SELECT * FROM reservations WHERE id = ?',
      [req.params.id]
    );
    
    if (existingReservations.length === 0) {
      return res.status(404).json({ message: 'Reservation not found' });
    }
    
    const existingReservation = existingReservations[0];
    
    // Check authorization - either admin user or must provide correct confirmation number
    const isAdmin = req.user && req.user.isAdmin;
    const hasConfirmation = req.body.confirmationNumber === existingReservation.confirmation_number;
    
    if (!isAdmin && !hasConfirmation) {
      return res.status(403).json({ 
        message: 'Authorization required. Please provide confirmation number.' 
      });
    }
    
    // Instead of actually deleting, mark as cancelled
    await db.query(
      'UPDATE reservations SET status = "cancelled", cancelled_at = NOW() WHERE id = ?',
      [req.params.id]
    );
    
    res.json({ 
      message: 'Reservation cancelled successfully',
      id: req.params.id
    });
    
    // Could also send cancellation confirmation email here
    
  } catch (err) {
    console.error('Error cancelling reservation:', err.message);
    res.status(500).json({ message: 'Server error while cancelling reservation' });
  }
});

// @route   GET api/reservations/availability/check
// @desc    Check table availability for a given date/time/party size
// @access  Public
router.get('/availability/check', [
  query('date').isDate(),
  query('time').matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  query('partySize').isInt({ min: 1, max: 20 })
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const { date, time, partySize } = req.query;

  try {
    const isAvailable = await checkAvailability(date, time, parseInt(partySize));
    
    if (isAvailable) {
      res.json({ available: true, message: 'Tables are available for your party' });
    } else {
      // Suggest alternative times
      const alternativeTimes = await findAlternativeTimes(date, time, parseInt(partySize));
      
      res.json({ 
        available: false, 
        message: 'No tables available for the selected time and party size',
        alternativeTimes
      });
    }
  } catch (err) {
    console.error('Error checking availability:', err.message);
    res.status(500).json({ message: 'Server error while checking availability' });
  }
});

// Helper function to find alternative available time slots
async function findAlternativeTimes(date, requestedTime, partySize) {
  // Check times 1 hour before and 2 hours after the requested time
  const requestedHour = parseInt(requestedTime.split(':')[0]);
  const requestedMinutes = parseInt(requestedTime.split(':')[1]);
  
  const alternativeTimes = [];
  
  // Check hourly slots from 1 hour before to 2 hours after
  for (let hourOffset = -1; hourOffset <= 2; hourOffset++) {
    if (hourOffset === 0) continue; // Skip the requested time
    
    let newHour = requestedHour + hourOffset;
    if (newHour < 11) continue; // Restaurant opens at 11 AM
    if (newHour > 21) continue; // Last seating at 9 PM
    
    const alternativeTime = `${newHour.toString().padStart(2, '0')}:${requestedMinutes.toString().padStart(2, '0')}`;
    
    const isAvailable = await checkAvailability(date, alternativeTime, partySize);
    if (isAvailable) {
      alternativeTimes.push(alternativeTime);
    }
  }
  
  return alternativeTimes;
}

module.exports = router;