const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Ward represents a physical ward / room grouping in the hospital
// Each ward can have multiple beds associated via the Bed model
// category: General, Private, ICU, etc.
const wardSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: uuidv4,
    },
    name: { type: String, required: true },
    category: {
      type: String,
      enum: ['General', 'Private', 'ICU', 'Semi-Private'],
      default: 'General',
    },
    floor: { type: String },
    // Optional: associate a ward to a specific room entity
    roomId: { type: String, ref: 'Room' },
    totalBeds: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Ensure ward name is unique within the same floor
wardSchema.index({ floor: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Ward', wardSchema);
