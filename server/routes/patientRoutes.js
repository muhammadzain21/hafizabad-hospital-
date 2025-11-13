const express = require('express');
const router = express.Router();
const Patient = require('../models/Patient');
const Token = require('../models/Token');
const Prescription = require('../models/prescription');

// Create patient
router.post('/', async (req, res) => {
  try {
    const patient = await Patient.create(req.body);
    
    // If doctorId is provided, create a token
    if (req.body.doctorId) {
      await Token.create({
        doctorId: req.body.doctorId,
        patientId: patient._id,
        dateTime: new Date(),
        tokenNumber: await Token.countDocuments({ doctorId: req.body.doctorId }) + 1
      });
    }
    
    res.status(201).json(patient);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Public history by MR number: return patient + OPD visits derived from Tokens and Prescriptions
// GET /api/patients/history/mr/:mrNumber
router.get('/history/mr/:mrNumber', async (req, res) => {
  try {
    const { mrNumber } = req.params;
    const patient = await Patient.findOne({ mrNumber }).lean();
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    const [tokens, prescriptions] = await Promise.all([
      Token.find({ patientId: patient._id }).sort({ dateTime: -1 }).lean(),
      Prescription.find({ patientId: patient._id }).sort({ createdAt: -1 }).lean(),
    ]);

    const tokenVisits = tokens.map(t => ({
      dateTime: t.dateTime,
      department: t.department || 'OPD',
      doctor: t.doctor || '',
      fee: (typeof t.finalFee === 'number' ? t.finalFee : (typeof t.fee === 'number' ? t.fee : 0)) || 0,
      symptoms: t.symptoms || '',
      diagnosis: t.diagnosis || '',
      prescription: null,
      _source: 'token',
    }));

    const syntheticFromPres = prescriptions.map(p => ({
      dateTime: p.createdAt,
      department: 'OPD',
      doctor: '',
      fee: 0,
      symptoms: '',
      diagnosis: '',
      prescription: null,
      _source: 'prescription',
    }));

    const byDay = new Map();
    for (const v of [...syntheticFromPres, ...tokenVisits]) {
      const d = new Date(v.dateTime);
      const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      const existing = byDay.get(key);
      if (!existing || existing._source === 'prescription') {
        byDay.set(key, v);
      }
    }
    const visits = Array.from(byDay.values()).sort((a,b) => new Date(b.dateTime) - new Date(a.dateTime));

    return res.json({ ...patient, visits });
  } catch (err) {
    console.error('[patients] GET /history/mr/:mrNumber error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Public prescriptions listing by patientId
// GET /api/patients/prescriptions?patientId=...
router.get('/prescriptions', async (req, res) => {
  try {
    const { patientId } = req.query;
    if (!patientId) return res.json([]);
    const list = await Prescription.find({ patientId })
      .populate('patientId', 'name mrNumber phone')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    return res.json(list.map(p => ({
      id: p._id,
      patient: p.patientId,
      items: p.items,
      tests: p.tests || [],
      notesEnglish: p.notesEnglish || '',
      referredToPharmacy: !!p.referredToPharmacy,
      referredToLab: !!p.referredToLab,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    })));
  } catch (err) {
    console.error('[patients] GET /prescriptions error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get all patients or search by phone/mrNumber: ?phone=xyz or ?mrNumber=MR123
router.get('/', async (req, res) => {
  try {
    const { phone, mrNumber } = req.query;
    let filter = {};
    if (phone) filter.phone = phone;
    if (mrNumber) filter.mrNumber = mrNumber;
    const patients = await Patient.find(filter).sort({ createdAt: -1 });
    res.json(patients);
  } catch (err) {
    console.error('[patients] GET / error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get patient by phone via path param
router.get('/phone/:phone', async (req, res) => {
  try {
    const patient = await Patient.findOne({ phone: req.params.phone });
    if (!patient) return res.status(404).json({ message: 'Patient not found' });
    res.json(patient);
  } catch (err) {
    console.error('[patients] GET /phone/:phone error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get patient by MR number via path param
router.get('/mr/:mrNumber', async (req, res) => {
  try {
    const patient = await Patient.findOne({ mrNumber: req.params.mrNumber });
    if (!patient) return res.status(404).json({ message: 'Patient not found' });
    res.json(patient);
  } catch (err) {
    console.error('[patients] GET /mr/:mrNumber error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Get single patient
router.get('/:id', async (req, res) => {
  try {
    const patient = await Patient.findById(req.params.id);
    if (!patient) return res.status(404).json({ message: 'Patient not found' });
    res.json(patient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update patient
router.put('/:id', async (req, res) => {
  try {
    const patient = await Patient.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!patient) return res.status(404).json({ message: 'Patient not found' });
    res.json(patient);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete patient
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Patient.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'Patient not found' });
    res.json({ message: 'Patient deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
