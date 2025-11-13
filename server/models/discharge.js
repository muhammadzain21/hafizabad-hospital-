const mongoose = require('mongoose');

const MedicineSchema = new mongoose.Schema({
  name: String,
  strengthDose: String,
  route: String,
  frequency: String,
  timing: String,
  duration: String,
}, { _id: false });

const InvestigationsSchema = new mongoose.Schema({
  hb: String,
  urea: String,
  hcv: String,
  na: String,
  platelets: String,
  creatinine: String,
  hbsag: String,
  k: String,
  tlc: String,
  alt: String,
  hiv: String,
  ca: String,
}, { _id: false });

const DischargeSchema = new mongoose.Schema({
  // Align with Patient model where _id is a string UUID
  patientId: { type: String, ref: 'Patient', required: true, index: true },
  panelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Panel', required: true },

  // Header
  dor: { type: Date },
  lama: { type: Boolean, default: false },
  dischargedAdvisedByDoctor: { type: Boolean, default: false },
  ddrConsent: { type: Boolean, default: false },
  presentingComplaints: { type: String },

  // Narrative sections
  admissionReason: { type: String },
  finalDiagnosis: { type: String },
  proceduresAndOutcome: { type: String },
  treatmentInHospital: { type: String },

  investigations: InvestigationsSchema,

  medicines: [MedicineSchema],

  conditionAtDischarge: { type: String, enum: ['satisfactory','fair','poor',''], default: '' },
  responseOfTreatment: { type: String, enum: ['excellent','good','average','poor',''], default: '' },
  followUpInstructions: { type: String },

  doctorName: { type: String },
  doctorSign: { type: String },
  signDate: { type: Date },
}, { timestamps: true });

module.exports.Discharge = mongoose.model('Discharge', DischargeSchema);

