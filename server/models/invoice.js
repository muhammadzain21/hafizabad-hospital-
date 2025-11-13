const mongoose = require('mongoose');

const LineItemSchema = new mongoose.Schema({
  sr: { type: Number, default: 0 },
  description: { type: String, default: '' },
  rate: { type: Number, default: 0 },
  qty: { type: Number, default: 0 },
  amount: { type: Number, default: 0 },
}, { _id: false });

const InvoiceSchema = new mongoose.Schema({
  // Align with Patient model where _id is a string UUID
  patientId: { type: String, ref: 'Patient', index: true, required: true, unique: true },
  panelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Panel', index: true },

  refNo: { type: String },

  // Header / identity fields
  mrn: { type: String },
  patientName: { type: String },
  employeeName: { type: String },
  relationWithPatient: { type: String },
  bps: { type: String },
  designation: { type: String },
  employeeNo: { type: String },
  procedure: { type: String },

  dateOfAdmission: { type: Date },
  dateOfDischarge: { type: Date },
  daysOccupied: { type: Number },

  // Items and totals
  lineItems: { type: [LineItemSchema], default: [] },
  totalAmount: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  totalPayable: { type: Number, default: 0 },
  currency: { type: String, default: 'PKR' },
}, { timestamps: true });

const Invoice = mongoose.model('Invoice', InvoiceSchema);
module.exports = { Invoice };

