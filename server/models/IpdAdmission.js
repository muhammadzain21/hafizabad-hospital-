const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

const vitalsSchema = new mongoose.Schema({
  dateTime: { type: Date, required: true },
  bp: { type: String, required: true },
  heartRate: { type: String, required: true },
  temperature: { type: String, required: true },
  respRate: { type: String, required: true },
  notes: String,
});

// Medicines prescribed at discharge
const dischargeMedicineSchema = new mongoose.Schema({
  sr: Number,
  medicine: String,
  strengthDose: String,
  route: String,
  frequency: String,
  timing: String,
  duration: String,
});

// Discharge Summary block to preserve details filled at discharge
const dischargeSummarySchema = new mongoose.Schema({
  // Key investigation results (stored as loose fields for flexibility)
  investigations: {
    HB: String,
    UREA: String,
    HCV: String,
    NA: String,
    PLATELETS: String,
    CREATININE: String,
    HBSAG: String,
    K: String,
    TLC: String,
    ALT: String,
    HIV: String,
    CA: String,
    other: String,
  },
  medicinesOnDischarge: [dischargeMedicineSchema],
  conditionAtDischarge: { type: String, enum: ['satisfactory', 'fair', 'poor', 'good', 'excellent', 'average'], default: 'satisfactory' },
  responseOfTreatment: { type: String, enum: ['excellent', 'good', 'average', 'poor'], default: 'good' },
  followUpInstructions: String,
  doctorName: String,
  doctorSignText: String,
  signDate: Date,
  amount: { type: Number, default: 0 },
  discount: { type: Number, default: 0 },
  remarks: String,
}, { _id: false });

const medicationSchema = new mongoose.Schema({
  medicationName: { type: String, required: true },
  dosage: { type: String, required: true },
  frequency: { type: String, required: true },
  startDate: { type: Date, required: true },
  endDate: Date,
  notes: String,
});

const labTestSchema = new mongoose.Schema({
  testName: { type: String, required: true },
  testType: { type: String, required: true },
  orderedDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['Ordered', 'Completed', 'Cancelled'], default: 'Ordered' },
  result: String,
  notes: String,
});

const doctorVisitSchema = new mongoose.Schema({
  dateTime: { type: Date, required: true },
  doctorId: { type: String, ref: 'Doctor', required: true },
  doctorName: { type: String, required: true }, // Denormalized for convenience
  diagnosis: String,
  treatment: String,
  notes: String,
});

const billingItemSchema = new mongoose.Schema({
  date: { type: Date, required: true },
  description: { type: String, required: true },
  category: { type: String, required: true },
  amount: { type: Number, required: true },
  status: { type: String, enum: ['Pending', 'Paid', 'Cancelled'], default: 'Pending' },
});

const ipdAdmissionSchema = new mongoose.Schema(
  {
    _id: { type: String, default: uuidv4 },
    ipdNumber: { type: String, required: true, unique: true },
    patientId: { type: String, ref: 'Patient', required: true },
    billingType: { type: String, enum: ['cash', 'credit'], default: 'cash' },
    panelId: { type: String, ref: 'CorporatePanel' },
    admitSource: { type: String, enum: ['OPD', 'ER', 'Direct'], default: 'Direct' },
    wardId: { type: String, ref: 'Ward', required: true },
    bedId: { type: String, ref: 'Bed', required: true },
    doctorId: { type: String, ref: 'Doctor' },
    admittingDiagnosis: { type: String },
    admitDateTime: { type: Date, default: Date.now },
    dischargeDateTime: { type: Date },
    status: {
      type: String,
      enum: ['Admitted', 'Discharged', 'Transferred', 'Expired'],
      default: 'Admitted',
    },
    // Embedded sub-documents for patient profile tabs
    vitals: [vitalsSchema],
    medications: [medicationSchema],
    labTests: [labTestSchema],
    doctorVisits: [doctorVisitSchema],
    billing: [billingItemSchema],
    dischargeSummary: dischargeSummarySchema,
  },
  { timestamps: true }
);

// Performance indexes for common query patterns
ipdAdmissionSchema.index({ status: 1, admitDateTime: -1 });
ipdAdmissionSchema.index({ patientId: 1 });
ipdAdmissionSchema.index({ doctorId: 1 });

module.exports = mongoose.model('IpdAdmission', ipdAdmissionSchema);
