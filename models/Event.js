const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  title: String,
  subtitle: String,
  date: String,
  time: String,
  price: String,
  category: String,
  location: String,
  status: String,
  image: String,
  attendees: { type: Number, default: 0 },
});

module.exports = mongoose.model("Event", eventSchema);
