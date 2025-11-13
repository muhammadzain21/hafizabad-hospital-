const mongoose = require('mongoose');

const itemSchema = new mongoose.Schema({
  // Optional: we may not always have a linked Medicine record
  medicineId: { type: mongoose.Schema.Types.ObjectId, ref: 'Medicine', required: false },
  medicineName: { type: String, required: true }, // denormalised for quick view
  dosage: { type: String, required: true },
  quantity: { type: Number, required: true },
});

const prescriptionSchema = new mongoose.Schema(
  {
    patientId: { type: String, ref: 'Patient', required: true },
    doctorId: { type: String, ref: 'User', required: true },
    items: [itemSchema],
    tests: [{ type: String }],
    notesEnglish: String,
    referredToPharmacy: { type: Boolean, default: false },
    referredToLab: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Indexes for fast pharmacy referrals listing/searching
if (!prescriptionSchema.indexes().some(([fields]) => fields.referredToPharmacy && fields.createdAt)) {
  prescriptionSchema.index({ referredToPharmacy: 1, createdAt: -1 });
}
if (!prescriptionSchema.indexes().some(([fields]) => fields.patientId)) {
  prescriptionSchema.index({ patientId: 1 });
}
if (!prescriptionSchema.indexes().some(([fields]) => fields.doctorId)) {
  prescriptionSchema.index({ doctorId: 1 });
}

module.exports = mongoose.models.Prescription || mongoose.model('Prescription', prescriptionSchema);
