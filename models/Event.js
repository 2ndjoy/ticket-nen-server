// models/Event.js
const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  subtitle: String,
  date: String,
  time: String,

  // Optional "from price"
  price: String,

  // ✅ Numeric tickets & prices
  vipTickets: { type: Number, default: 0 },
  vipPrice: { type: Number, default: 0 },

  regularTickets: { type: Number, default: 0 },
  regularPrice: { type: Number, default: 0 },

  category: String,
  location: String,
  status: { type: String, default: "Draft" },
  image: String,

  description: String,

  attendees: { type: Number, default: 0 },
  rating: Number,
}, { timestamps: true });

module.exports = mongoose.model("Event", eventSchema);
