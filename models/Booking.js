const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
  eventId: { type: mongoose.Schema.Types.ObjectId, ref: "Event", required: true },
  userId: { type: String, required: true }, // Firebase UID
  name: String,
  email: String,
  phoneNumber: String,
  amount: Number,
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Booking", bookingSchema);
