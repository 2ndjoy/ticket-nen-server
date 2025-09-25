const mongoose = require('mongoose');

const promoteEventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  date: { type: Date, required: true },
  location: { type: String, required: true },
  description: { type: String, required: true },
  imageUrl: { type: String, required: true },
  videoUrl: { type: String },
  contactEmail: { type: String, required: true },
  vipTicketQuantity: { type: Number, default: 0 },
  ticketQuantity: { type: Number, default: 0 },

  // ✅ New fields
  category: { 
    type: String, 
    required: true, 
    enum: [ "Conferences", "Competitions", "Festivals", "Concerts", "Workshops", "Sports", "Theater", "Other"] 
  },
  price: { type: String, required: true } // can be "Free" or a number string
}, 
{ timestamps: true, collection: 'events' });

module.exports = mongoose.model('PromoteEvent', promoteEventSchema);
