// models/User.js
const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  uid:         { type: String, required: true, unique: true },
  fullName:    { type: String, required: true },
  email:       { type: String, required: true, unique: true },
  phoneNumber: { type: String },
  imageUrl:    { type: String },
  createdAt:   { type: Date, default: Date.now },
});

module.exports = mongoose.model("User", userSchema);
