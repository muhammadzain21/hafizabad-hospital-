const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Room represents a logical room under a floor; wards can be linked to rooms
const roomSchema = new mongoose.Schema(
  {
    _id: { type: String, default: uuidv4 },
    name: { type: String, required: true },
    floorId: { type: String, ref: 'Floor', required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

roomSchema.index({ floorId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Room', roomSchema);
