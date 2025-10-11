const mongoose = require("mongoose");

const eventSchema = new mongoose.Schema({
  title: String,
  subtitle: String,
  date: String,
  time: String,
  price: String,
  // NEW: VIP & Regular ticket prices
  vipTickets: String,
  vipPrice: String,
  regularTickets: String,
  regularPrice: String,
  category: String,
  location: String,
  status: String,
  image: String,
  // NEW: Description
  description: String,

});

module.exports = mongoose.model("Event", eventSchema);
