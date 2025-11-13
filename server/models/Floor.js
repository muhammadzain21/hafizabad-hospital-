const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Floor represents a hospital floor (e.g., Ground, 1st, 2nd)
const floorSchema = new mongoose.Schema(
  {
    _id: { type: String, default: uuidv4 },
    name: { type: String, required: true }, // Display name
    number: { type: Number }, // Optional numeric ordering
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Floor', floorSchema);
