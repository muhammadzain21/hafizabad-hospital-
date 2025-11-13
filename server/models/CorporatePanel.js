const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const corporatePanelSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  name: { type: String, required: true, unique: true },
  contact: String,
  creditLimit: { type: Number, default: 0 },
  balance: { type: Number, default: 0 }, // available balance from advance deposits
  notes: String,
}, { timestamps: true });

module.exports = mongoose.model('CorporatePanel', corporatePanelSchema);
