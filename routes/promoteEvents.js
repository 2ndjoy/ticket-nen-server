// routes/promoteEvents.js
const express = require('express');
const router = express.Router();
const PromoteEvent = require('../models/PromoteEvent');

// POST /api/promoteevents — create new event
router.post('/', async (req, res) => {
  try {
    const data = req.body;

    if (data.vipTickets != null && data.vipTicketQuantity == null) {
      data.vipTicketQuantity = Number(data.vipTickets) || 0;
    } else {
      data.vipTicketQuantity = Number(data.vipTicketQuantity) || 0;
    }

    if (data.regularTickets != null && data.ticketQuantity == null) {
      data.ticketQuantity = Number(data.regularTickets) || 0;
    } else {
      data.ticketQuantity = Number(data.ticketQuantity) || 0;
    }

    if (data.vipPrice != null && data.vipTicketPrice == null) {
      data.vipTicketPrice = Number(data.vipPrice) || 0;
    } else if (data.vipTicketPrice != null) {
      data.vipTicketPrice = Number(data.vipTicketPrice) || 0;
    }

    if (data.regularPrice != null && data.regularTicketPrice == null) {
      data.regularTicketPrice = Number(data.regularPrice) || 0;
    } else if (data.regularTicketPrice != null) {
      data.regularTicketPrice = Number(data.regularTicketPrice) || 0;
    }

    if (typeof data.date === 'string') {
      const d = new Date(data.date);
      if (!isNaN(d)) data.date = d;
    }

    const event = new PromoteEvent(data);
    await event.save();

    res.status(201).json({ message: 'Event created successfully', event });
  } catch (err) {
    console.error("Create event error:", err);
    // Send validation details to the client
    res.status(400).json({
      message: 'Validation/Save error',
      error: err.message,
      details: err?.errors,
    });
  }
});

module.exports = router;
