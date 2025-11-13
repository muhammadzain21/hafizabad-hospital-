const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// Bed model tracks individual bed status within a ward
// status: Available, Occupied, Cleaning, Maintenance
const bedSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      default: uuidv4,
    },
    wardId: { type: String, ref: 'Ward' },
    roomId: { type: String, ref: 'Room' },
    bedNumber: { type: String, required: true },
    category: {
      type: String,
      enum: ['General', 'Private', 'ICU', 'Semi-Private'],
      default: 'General',
    },
    rentType: {
      type: String,
      enum: ['daily', 'hourly'],
      default: 'daily',
    },
    rentAmount: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['Available', 'Occupied', 'Cleaning', 'Maintenance'],
      default: 'Available',
    },
    currentAdmissionId: { type: String, ref: 'IpdAdmission' },
  },
  { timestamps: true }
);

// ensure unique bed number within a ward or room
bedSchema.index(
  { wardId: 1, bedNumber: 1 },
  { unique: true, partialFilterExpression: { wardId: { $type: 'string' } } }
);
bedSchema.index(
  { roomId: 1, bedNumber: 1 },
  { unique: true, partialFilterExpression: { roomId: { $type: 'string' } } }
);
// speed up common queries and dashboard summaries
bedSchema.index({ status: 1 });
bedSchema.index({ wardId: 1 });
bedSchema.index({ wardId: 1, status: 1 });

module.exports = mongoose.model('Bed', bedSchema);
