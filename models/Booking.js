// models/Booking.js
const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
  userId: { type: String, required: true }, // Firebase UID
  name: String,
  email: String,
  phoneNumber: String,

  ticketType: { type: String, enum: ["vip", "regular"], required: true },
  quantity: { type: Number, default: 1, min: 1 },

  unitPrice: { type: Number, required: true },
  amount: { type: Number, required: true },

  createdAt: { type: Date, default: Date.now },
});

// 🚫 One booking per event per user
bookingSchema.index({ eventId: 1, userId: 1 }, { unique: true });
// If you prefer per ticket type instead, use:
// bookingSchema.index({ eventId: 1, userId: 1, ticketType: 1 }, { unique: true });

module.exports = mongoose.model("Booking", bookingSchema);
