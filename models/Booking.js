// models/Booking.js
const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
    userId: { type: String, required: true }, // Firebase UID

    name: { type: String, trim: true },
    email: { type: String, trim: true },
    phoneNumber: { type: String, trim: true },

    ticketType: { type: String, enum: ["vip", "regular"], required: true },
    quantity: { type: Number, default: 1, min: 1 },

    unitPrice: { type: Number, required: true, min: 0 },
    amount: { type: Number, required: true, min: 0 },
  },
  {
    timestamps: true,
    collection: "bookings",
    toJSON: { versionKey: false },
    toObject: { versionKey: false },
  }
);

// 🚫 One booking per event per user (change to include ticketType if you want per-type)
bookingSchema.index({ eventId: 1, userId: 1 }, { unique: true });
// models/Booking.js
// ...
bookingSchema.index({ eventId: 1 });
bookingSchema.index({ userId: 1 });
bookingSchema.index({ createdAt: -1 });

module.exports = mongoose.model("Booking", bookingSchema);
