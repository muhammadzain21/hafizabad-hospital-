const mongoose = require('mongoose');

// Common person block for receiver/attendant etc.
const PersonBlock = new mongoose.Schema({
  name: String,
  relation: String,
  cnic: String,
  address: String,
  sign: String,
}, { _id: false });

// Death certificate (in-hospital death)
const DeathCertificateSchema = new mongoose.Schema({
  patientId: { type: String, ref: 'Patient', required: true, index: true },
  panelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Panel', required: true },

  mrn: String,
  date: Date,
  patientName: String,
  guardian: String, // S/O, D/O, W/O
  ageSex: String,
  address: String,
  admissionDateTime: Date,
  deathDateTime: Date,

  presentingComplaints: String,
  diagnosis: String,
  primaryCause: String,
  secondaryCause: String,

  receivedByName: String,
  receivedRelation: String,
  receivedCnic: String,
  receivedDateTime: Date,
  receivedSign: String,

  staffName: String,
  staffSign: String,
  staffDate: Date,
  staffTime: String,

  doctorName: String,
  doctorSign: String,
  doctorDate: Date,
  doctorTime: String,
}, { timestamps: true });

// Received dead certificate (brought dead to ER)
const ReceivedDeathCertificateSchema = new mongoose.Schema({
  patientId: { type: String, ref: 'Patient', required: true, index: true },
  panelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Panel', required: true },

  srNoLeft: String,
  srNoRight: String,
  mrn: String,
  patientCnic: String,
  patientName: String,
  guardian: String,
  ageSex: String,
  reportedDate: Date,
  reportedTime: String,

  receivingParameters: {
    pulse: String,
    bloodPressure: String,
    respiratoryRate: String,
    pupils: String,
    cornealReflex: String,
    ecg: String,
  },
  diagnosis: String,

  attendantName: String,
  attendantGuardian: String,
  attendantRelation: String,
  attendantAddress: String,
  attendantCnic: String,
  declaredByDoctors: String,

  doctorSignatureBlock: String,
  chargeNurseSignature: String,
}, { timestamps: true });

module.exports.DeathCertificate = mongoose.model('DeathCertificate', DeathCertificateSchema);
module.exports.ReceivedDeathCertificate = mongoose.model('ReceivedDeathCertificate', ReceivedDeathCertificateSchema);
