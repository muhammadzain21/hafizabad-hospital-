const mongoose = require('mongoose');

const VitalsSchema = new mongoose.Schema({
  bp: String,
  hr: String,
  spo2: String,
  temp: String,
  fhr: String,
}, { _id: false });

const TestsSchema = new mongoose.Schema({
  hb: String,
  bilirubinDInd: String,
  bsr: String,
  urea: String,
  sCreat: String,
}, { _id: false });

const TreatmentsSchema = new mongoose.Schema({
  inHospital: String, // Treatment Given at Hospital
  atDischarge: String, // Treatment at Discharge
}, { _id: false });

const DischargeBlockSchema = new mongoose.Schema({
  conditionAtDischarge: String, // Satisfactory | Fair | Poor (free text allowed)
  responseOfTreatment: String,  // Excellent | Good | Average | Poor (free text allowed)
}, { _id: false });

const ReferralSchema = new mongoose.Schema({
  referredToCenter: String,
  contactNo: String,
  reason: String,
}, { _id: false });

const FollowUpSchema = new mongoose.Schema({
  instructions: String,
  urduExaminationDate: Date,
  urduDietInstructions: String,
}, { _id: false });

const SignatureBlockSchema = new mongoose.Schema({
  doctorName: String,
  stamp: String,
  sign: String,
  signDate: Date,
  signTime: String,
}, { _id: false });

const ShortStaySchema = new mongoose.Schema({
  patientId: { type: String, ref: 'Patient', required: true, index: true },
  panelId: { type: mongoose.Schema.Types.ObjectId, ref: 'Panel', required: true },

  // Header
  opdReceiptNo: String,
  pageNo: String,

  // Top patient block
  patientName: String,
  mrn: String,
  age: String,
  sex: String,
  address: String,
  dateTimeIn: Date,
  dateTimeOut: Date,
  isOpd: Boolean,
  isShortStay: Boolean,
  isReferred: Boolean,
  admissionTo: String,

  // Clinical information
  presentingComplaints: String,
  briefHistory: String,
  anyProcedure: String,
  finalDiagnosis: String,
  consultant: String,

  // Vitals and tests
  vitals: VitalsSchema,
  tests: TestsSchema,

  // Treatments
  treatments: TreatmentsSchema,

  // Referral block
  referral: ReferralSchema,

  // Discharge condition/response
  discharge: DischargeBlockSchema,

  // Follow up and footer
  followUp: FollowUpSchema,
  signature: SignatureBlockSchema,
}, { timestamps: true });

module.exports.ShortStay = mongoose.model('ShortStay', ShortStaySchema);
