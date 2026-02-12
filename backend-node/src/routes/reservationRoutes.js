const express = require('express');
const router = express.Router({ mergeParams: true }); // Important for accessing parent params
const EmployeeReservation = require('../models/reservation');
const Employee = require('../models/employee');

// Create reservation
router.post('/', (req, res) => {
  try {
    const employeeId = parseInt(req.params.employeeId);

    // Check if employee exists
    const employee = Employee.getById(employeeId);
    if (!employee) {
      return res.status(404).json({ detail: 'Employee not found' });
    }

    const { start_date, end_date, reserved_hours_per_day, reason } = req.body;

    // Validate dates
    if (end_date < start_date) {
      return res.status(400).json({ detail: 'End date must be after or equal to start date' });
    }

    // Validate hours
    if (reserved_hours_per_day < 0 || reserved_hours_per_day > 24) {
      return res.status(400).json({ detail: 'Reserved hours per day must be between 0 and 24' });
    }

    const newReservation = EmployeeReservation.create(
      employeeId,
      start_date,
      end_date,
      reserved_hours_per_day,
      reason || null
    );

    res.json({ success: true, reservation: newReservation.toDict() });
  } catch (e) {
    if (e.message.includes('Reserved hours')) {
      return res.status(400).json({ detail: e.message });
    }
    res.status(500).json({ detail: `Failed to create reservation: ${e.message}` });
  }
});

// Get all reservations for an employee
router.get('/', (req, res) => {
  try {
    const employeeId = parseInt(req.params.employeeId);
    const includeCancelled = req.query.include_cancelled === 'true';

    const employee = Employee.getById(employeeId);
    if (!employee) {
      return res.status(404).json({ detail: 'Employee not found' });
    }

    const reservations = EmployeeReservation.getByEmployee(employeeId, includeCancelled);
    res.json(reservations.map(r => r.toDict()));
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// Get specific reservation
router.get('/:reservationId', (req, res) => {
  try {
    const employeeId = parseInt(req.params.employeeId);
    const reservationId = parseInt(req.params.reservationId);

    const reservation = EmployeeReservation.getById(reservationId);
    if (!reservation) {
      return res.status(404).json({ detail: 'Reservation not found' });
    }

    if (reservation.employee_id !== employeeId) {
      return res.status(403).json({ detail: 'Reservation does not belong to this employee' });
    }

    res.json(reservation.toDict());
  } catch (e) {
    res.status(500).json({ detail: e.message });
  }
});

// Update reservation
router.put('/:reservationId', (req, res) => {
  try {
    const employeeId = parseInt(req.params.employeeId);
    const reservationId = parseInt(req.params.reservationId);

    const reservation = EmployeeReservation.getById(reservationId);
    if (!reservation) {
      return res.status(404).json({ detail: 'Reservation not found' });
    }

    if (reservation.employee_id !== employeeId) {
      return res.status(403).json({ detail: 'Reservation does not belong to this employee' });
    }

    const updatedReservation = reservation.update(req.body);
    res.json({ success: true, reservation: updatedReservation.toDict() });
  } catch (e) {
    if (e.message.includes('Reserved hours')) {
      return res.status(400).json({ detail: e.message });
    }
    res.status(500).json({ detail: `Failed to update reservation: ${e.message}` });
  }
});

// Delete reservation
router.delete('/:reservationId', (req, res) => {
  try {
    const employeeId = parseInt(req.params.employeeId);
    const reservationId = parseInt(req.params.reservationId);

    const reservation = EmployeeReservation.getById(reservationId);
    if (!reservation) {
      return res.status(404).json({ detail: 'Reservation not found' });
    }

    if (reservation.employee_id !== employeeId) {
      return res.status(403).json({ detail: 'Reservation does not belong to this employee' });
    }

    reservation.delete();
    res.json({ success: true, message: 'Reservation deleted successfully' });
  } catch (e) {
    res.status(500).json({ detail: `Failed to delete reservation: ${e.message}` });
  }
});

// Cancel reservation
router.post('/:reservationId/cancel', (req, res) => {
  try {
    const employeeId = parseInt(req.params.employeeId);
    const reservationId = parseInt(req.params.reservationId);

    const reservation = EmployeeReservation.getById(reservationId);
    if (!reservation) {
      return res.status(404).json({ detail: 'Reservation not found' });
    }

    if (reservation.employee_id !== employeeId) {
      return res.status(403).json({ detail: 'Reservation does not belong to this employee' });
    }

    const cancelledReservation = reservation.cancel();
    res.json({ success: true, reservation: cancelledReservation.toDict() });
  } catch (e) {
    res.status(500).json({ detail: `Failed to cancel reservation: ${e.message}` });
  }
});

module.exports = router;
