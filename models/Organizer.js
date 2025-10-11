// models/Organizer.js
const mongoose = require("mongoose");

const OrganizerSchema = new mongoose.Schema(
  {
    // Primary identity
    email: { type: String, required: true, unique: true, index: true },
    firebaseUid: { type: String },

    // Profile fields
    fullName: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    nidNumber: { type: String, required: true },
    organizationName: { type: String, required: true },
    organizationType: { type: String, required: true },
    division: { type: String, required: true },
    district: { type: String, required: true },
    area: { type: String, required: true },

    // Role / status
    role: { type: String, default: "organizer" },
    status: { type: String, default: "active" }, // active | suspended | pending, etc.
    createdFrom: { type: String, default: "self-service" },
  },
  {
    timestamps: true,
    collection: "organizerlist", // <- required: test.organizerlist (your DB is "test", collection "organizerlist")
  }
);

module.exports = mongoose.model("Organizer", OrganizerSchema);
