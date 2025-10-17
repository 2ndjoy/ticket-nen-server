// models/PromoteEvent.js
const mongoose = require('mongoose');

const promoteEventSchema = new mongoose.Schema(
  {
    // Core info
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, trim: true },

    // Schedule
    date: { type: Date, required: true },   // Date for queries/sorting
    time: { type: String, required: true }, // e.g. "10:00 AM" or "05:30"

    // Classification & state
    category: { type: String, required: true, trim: true },
    status: {
      type: String,
      required: true,
      enum: ['Draft', 'Published', 'Cancelled', 'upcoming', 'past'],
      default: 'Draft',
    },

    // Location & description
    location: { type: String, required: true, trim: true },
    description: { type: String, required: true },

    // Media
    image: { type: String, required: true, trim: true },   // main image URL
    imageUrl: { type: String, trim: true },                // optional secondary
    videoUrl: { type: String, trim: true },

    // Contact
    contactEmail: { type: String, trim: true }, // kept for compatibility
    email: { type: String, trim: true },        // frontend "email"
    phone: { type: String, trim: true },

    // Logged-in email (Firebase Auth)
    loggedinemail: { type: String, trim: true },

    // Tickets (quantities)
    vipTicketQuantity: {
      type: Number,
      default: 0,
      min: 0,
      alias: 'vipTickets',
    },
    ticketQuantity: {
      type: Number,
      default: 0,
      min: 0,
      alias: 'regularTickets',
    },

    // Ticket pricing
    vipTicketPrice: {
      type: Number,
      min: 0,
      required: true,
      alias: 'vipPrice',
    },
    regularTicketPrice: {
      type: Number,
      min: 0,
      required: true,
      alias: 'regularPrice',
    },

    // Optional legacy/combined price (string/number)
    price: { type: mongoose.Schema.Types.Mixed },

    // Store payment meta too (optional but included here so they're saved)
    platformFee: { type: Number },
    bkashNumber: { type: String, trim: true },
  },
  {
    timestamps: true,
    collection: 'events',
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

module.exports = mongoose.model('PromoteEvent', promoteEventSchema);
