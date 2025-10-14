// models/Organizer.js
const mongoose = require("mongoose");

const OrganizerSchema = new mongoose.Schema(
  {
    // Primary identity
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      lowercase: true,
      trim: true,
    },
    firebaseUid: { type: String },

    // Profile fields
    fullName: { type: String, required: true, trim: true },
    phoneNumber: { type: String, required: true, trim: true },
    nidNumber: { type: String, required: true, trim: true },
    organizationName: { type: String, required: true, trim: true },
    organizationType: { type: String, required: true, trim: true },
    division: { type: String, required: true, trim: true },
    district: { type: String, required: true, trim: true },
    area: { type: String, required: true, trim: true },

    // Optional public/profile extras (used by Edit Profile page)
    website: { type: String, trim: true },
    description: { type: String, trim: true },
    logoUrl: { type: String, trim: true },
    facebook: { type: String, trim: true },
    instagram: { type: String, trim: true },
    twitter: { type: String, trim: true },

    // Role / status
    role: { type: String, default: "organizer", index: true },
    status: { type: String, default: "active", index: true }, // active | suspended | pending, etc.
    createdFrom: { type: String, default: "self-service" },
  },
  {
    timestamps: true,
    collection: "organizerlist", // your DB is "test", collection "organizerlist"
  }
);

// Ensure email stays lowercase
OrganizerSchema.pre("save", function (next) {
  if (this.email) this.email = this.email.toLowerCase().trim();
  next();
});

module.exports = mongoose.model("Organizer", OrganizerSchema);
