const express = require('express');
const router = express.Router();
const PromoteEvent = require('../models/PromoteEvent');

// POST /api/promoteevents — create new event
router.post('/', async (req, res) => {
  try {
    const data = req.body;

    data.vipTicketQuantity = Number(data.vipTicketQuantity) || 0;
    data.ticketQuantity = Number(data.ticketQuantity) || 0;

    const event = new PromoteEvent(data);
    await event.save();

    res.status(201).json({ message: 'Event created successfully', event });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error while creating event' });
  }
});

// GET /api/promoteevents — get all events
router.get('/', async (req, res) => {
  try {
    const events = await PromoteEvent.find().sort({ createdAt: -1 });
    res.json(events);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error while fetching events' });
  }
});

module.exports = router;
