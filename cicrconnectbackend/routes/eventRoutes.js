const express = require('express');
const router = express.Router();
const {
  createEvent,
  getEvents,
  getEventById,
  addEventParticipants,
  updateEvent,
  deleteEvent,
} = require('../controllers/eventController');
const { protect, authorizePolicy } = require('../middleware/authMiddleware');

router.get('/', getEvents);
router.get('/:id', protect, getEventById);
router.post('/', protect, authorizePolicy('MANAGE_EVENTS'), createEvent);
router.post('/:id/participants', protect, authorizePolicy('MANAGE_EVENTS'), addEventParticipants);
router.put('/:id', protect, authorizePolicy('MANAGE_EVENTS'), updateEvent);
router.delete('/:id', protect, authorizePolicy('MANAGE_EVENTS'), deleteEvent);

module.exports = router;
