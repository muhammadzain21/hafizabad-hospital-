const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const corporateTransactionSchema = new mongoose.Schema({
  _id: { type: String, default: uuidv4 },
  panelId: { type: String, ref: 'CorporatePanel', required: true },
  type: { type: String, enum: ['charge', 'payment', 'adjustment'], required: true },
  amount: { type: Number, required: true },
  date: { type: Date, default: Date.now },
  description: String,
  // Links for traceability
  patientId: { type: String, ref: 'Patient' },
  tokenId: { type: String, ref: 'Token' },
  admissionId: { type: String, ref: 'IpdAdmission' },
  department: { type: String, enum: ['IPD', 'OPD', 'Pharmacy', 'Lab'], default: 'OPD' },
}, { timestamps: true });

module.exports = mongoose.model('CorporateTransaction', corporateTransactionSchema);
