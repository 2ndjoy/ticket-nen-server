// models/PromoteEvent.js
const mongoose = require('mongoose');

const promoteEventSchema = new mongoose.Schema(
  {
    // Core info
    title: { type: String, required: true, trim: true },
    subtitle: { type: String, trim: true },

    // Schedule
    date: { type: Date, required: true },   // store as Date for querying/sorting
    time: { type: String, required: true }, // display string like "10:00 AM"

    // Classification & state
    category: { type: String, required: true, trim: true },
    status: {
      type: String,
      required: true,
      enum: ['Draft', 'Published', 'Cancelled', 'upcoming', 'past'], // allows your current "upcoming"
      default: 'Draft',
    },

    // Location & description
    location: { type: String, required: true, trim: true },
    description: { type: String, required: true },

    // Media
    image: { type: String, required: true, trim: true },   // main image URL (matches frontend `image`)
    imageUrl: { type: String, trim: true },                // additional image (optional)
    videoUrl: { type: String, trim: true },

    // Contact
    contactEmail: { type: String, required: true, trim: true }, // kept for backward compatibility
    email: { type: String, trim: true },                        // new field used by frontend
    phone: { type: String, required: true, trim: true },

    // Tickets (quantities)
    // Keep old fields and add aliases so older code continues to work.
    vipTicketQuantity: {
      type: Number,
      default: 0,
      min: 0,
      alias: 'vipTickets', // you can read/write as doc.vipTickets in app code
    },
    ticketQuantity: {
      type: Number,
      default: 0,
      min: 0,
      alias: 'regularTickets',
    },

    // Ticket pricing
    // Split explicit VIP/Regular prices; also keep a legacy `price` if needed.
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
    // Optional legacy base price (string or number). If you store currency symbols like "৳2000",
    // use String; if purely numeric, switch to Number.
    price: { type: mongoose.Schema.Types.Mixed },

    // (Optional) If you decide to keep engagement in DB even though it's removed from UI:
    // attendees: { type: Number, default: 0, min: 0 },
    // rating: { type: Number, default: 0, min: 0, max: 5 },
  },
  {
    timestamps: true,
    collection: 'events',
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

module.exports = mongoose.model('PromoteEvent', promoteEventSchema);
