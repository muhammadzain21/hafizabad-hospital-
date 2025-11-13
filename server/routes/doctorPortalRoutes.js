const express = require('express');
const router = express.Router();
const Visit = require('../models/Visit');
const { verifyJWT, authorizeRoles } = require('../middleware/auth');

const Appointment = require('../models/appointment');
const Token = require('../models/Token');
const Prescription = require('../models/prescription');
const Doctor = require('../models/Doctor');
const Medicine = require('../models/medicine');
const Patient = require('../models/Patient');

// Apply JWT verification and doctor role authorization to all routes
router.use(verifyJWT, authorizeRoles(['doctor']));

function startEndOfToday() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function startEndOfCurrentMonth() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

// GET /api/doctor/dashboard
router.get('/dashboard', async (req, res) => {
  try {
    const doctorId = req.user.doctorId || req.user.id; // Prefer Doctor ID from JWT
    const { start, end } = startEndOfToday();

    // Use Token model only to avoid Appointment's ObjectId casting issues
    const [todayPendingCount, todayTokens, patientsSeen] = await Promise.all([
      Token.countDocuments({ doctorId, dateTime: { $gte: start, $lte: end }, status: { $ne: 'completed' } }),
      Token.countDocuments({ doctorId, dateTime: { $gte: start, $lte: end } }),
      Token.distinct('patientId', { doctorId, dateTime: { $gte: start, $lte: end } })
    ]);

    // Today's revenue (use finalFee, fallback to fee)
    const revenueAgg = await Token.aggregate([
      { $match: { doctorId, dateTime: { $gte: start, $lte: end } } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$finalFee', { $ifNull: ['$fee', 0] }] } } } }
    ]);
    const revenue = revenueAgg[0]?.total || 0;

    // Totals across all time for this doctor
    const [allPatientIds, totalRevenueAgg] = await Promise.all([
      Token.distinct('patientId', { doctorId }),
      Token.aggregate([
        { $match: { doctorId } },
        { $group: { _id: null, total: { $sum: { $ifNull: ['$finalFee', { $ifNull: ['$fee', 0] }] } } } }
      ])
    ]);
    const totalPatients = allPatientIds.length;
    const totalRevenue = totalRevenueAgg[0]?.total || 0;

    // Monthly commission from current month's revenue
    const { start: monthStart, end: monthEnd } = startEndOfCurrentMonth();
    const monthRevenueAgg = await Token.aggregate([
      { $match: { doctorId, dateTime: { $gte: monthStart, $lte: monthEnd } } },
      { $group: { _id: null, total: { $sum: { $ifNull: ['$finalFee', { $ifNull: ['$fee', 0] }] } } } }
    ]);
    const monthRevenue = monthRevenueAgg[0]?.total || 0;

    const doctor = await Doctor.findById(doctorId);
    const commissionRate = doctor?.commissionRate || 0;
    const commission = (monthRevenue * commissionRate) / 100;

    res.json({ 
      todayAppointments: todayPendingCount, 
      todayTokens, 
      patientsSeen: patientsSeen.length,
      revenue, 
      totalPatients,
      totalRevenue,
      commission,
      commissionRate
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/doctor/prescriptions?patientId=optional
router.get('/prescriptions', async (req, res) => {
  try {
    const doctorId = req.user.doctorId || req.user.id;
    const { patientId } = req.query;
    // Some historical prescriptions may have been saved using the user's id
    // while newer ones use the Doctor profile id. Include both to avoid missing
    // records in history.
    const doctorIds = [req.user.doctorId, req.user.id].filter(Boolean);
    const filter = { doctorId: { $in: doctorIds } };
    if (patientId) filter.patientId = patientId;

    const list = await Prescription.find(filter)
      .populate('patientId', 'name mrNumber phone age gender address guardianName guardianRelation cnic')
      .sort({ createdAt: -1 })
      .limit(200);

    res.json(list.map(p => ({
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
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/doctor/prescriptions/:id
router.put('/prescriptions/:id', async (req, res) => {
  try {
    const doctorId = req.user.doctorId || req.user.id;
    const { id } = req.params;
    const update = req.body || {};

    const pres = await Prescription.findOneAndUpdate(
      { _id: id, doctorId },
      update,
      { new: true }
    );
    if (!pres) return res.status(404).json({ error: 'Prescription not found' });
    res.json(pres);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/doctor/prescriptions/:id
router.delete('/prescriptions/:id', async (req, res) => {
  try {
    const doctorId = req.user.doctorId || req.user.id;
    const { id } = req.params;
    const deleted = await Prescription.findOneAndDelete({ _id: id, doctorId });
    if (!deleted) return res.status(404).json({ error: 'Prescription not found' });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/doctor/queue — all pending tokens (not completed), regardless of date
router.get('/queue', async (req, res) => {
  try {
    const doctorId = req.user.doctorId || req.user.id;
    const tokens = await Token.find({
      doctorId,
      status: { $ne: 'completed' },
    })
      .populate('patientId', 'name age gender mrNumber phone')
      .sort({ dateTime: 1 });

    res.json(tokens.map(t => ({
      id: t._id,
      tokenNumber: t.tokenNumber,
      status: t.status || 'waiting',
      dateTime: t.dateTime,
      patient: t.patientId,
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/doctor/appointments/today
router.get('/appointments/today', async (req, res) => {
  try {
    const doctorId = req.user.doctorId || req.user.id;
    const { start, end } = startEndOfToday();
    
    const appointments = await Appointment.find({ 
      doctorId, 
      datetime: { $gte: start, $lte: end } 
    })
      .populate('patientId', 'name age gender phone')
      .sort({ datetime: 1 });
      
    res.json(appointments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/doctor/tokens/today
router.get('/tokens/today', async (req, res) => {
  try {
    const doctorId = req.user.doctorId || req.user.id;
    const { start, end } = startEndOfToday();
    
    const tokens = await Token.find({ 
      doctorId, 
      dateTime: { $gte: start, $lte: end } 
    })
      .populate('patientId', 'name age gender')
      .sort({ tokenNumber: 1 });
      
    res.json(tokens);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/doctor/patients
// Optional query param ?q=searchText to filter by name or MR#
router.get('/patients', async (req, res) => {
  try {
    const doctorId = req.user.doctorId || req.user.id;
    
        // Get distinct patients seen by this doctor
    const patientIds = await Token.distinct('patientId', { doctorId });

    const { q } = req.query;
    const searchFilter = q
      ? {
          $or: [
            { name: { $regex: q, $options: 'i' } },
            { mrNumber: { $regex: q, $options: 'i' } },
            { phone: { $regex: q, $options: 'i' } },
          ],
        }
      : {};

    // Always restrict to this doctor's patients
    const baseFilter = { _id: { $in: patientIds } };
    const patients = await Patient.find({
      ...baseFilter,
      ...searchFilter,
    }).select('name mrNumber age gender phone');
    
    res.json(patients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/doctor/patients/:mrNumber
router.get('/patients/:mrNumber', async (req, res) => {
  try {
    const { mrNumber } = req.params;
    // Find patient by MR or _id
    const patient = await Patient.findOne({ mrNumber });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    // Gather visits from Tokens (source of truth for consultations) and also
    // derive synthetic visits from Prescriptions in case a token was not created.
    const [tokens, prescriptions] = await Promise.all([
      Token.find({ patientId: patient._id }).sort({ dateTime: -1 }),
      Prescription.find({ patientId: patient._id }).sort({ createdAt: -1 }),
    ]);

    // Base visits from tokens
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

    // Add synthetic visits from prescriptions that don't have a nearby token
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

    // Merge and de-duplicate by day (YYYY-MM-DD). If a token exists that day, prefer it.
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

    res.json({
      ...patient.toObject(),
      visits,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load patient' });
  }
});

// Existing history route
// GET /api/doctor/history/:patientId
router.get('/history/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;
    const doctorId = req.user.doctorId || req.user.id;
    const doctorIds = [req.user.doctorId, req.user.id].filter(Boolean);
    
    const [prescriptions, tokens] = await Promise.all([
      Prescription.find({ patientId, doctorId: { $in: doctorIds } }).sort({ createdAt: -1 }),
      Token.find({ patientId, doctorId }).sort({ dateTime: -1 }).select('dateTime status diagnosis tokenNumber finalFee')
    ]);

    const appointments = tokens.map(t => ({
      datetime: t.dateTime,
      status: t.status,
      diagnosis: t.diagnosis,
      tokenNumber: t.tokenNumber,
      fee: t.finalFee,
    }));

    res.json({ prescriptions, appointments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/doctor/consultations/history
router.get('/consultations/history', async (req, res) => {
  try {
    const doctorId = req.user.doctorId || req.user.id;
    
    const consultations = await Token.find({ 
      doctorId,
      status: 'completed'
    })
    .populate('patientId', 'name mrNumber')
    .sort({ dateTime: -1 });
    
    res.json(consultations.map(c => ({
      id: c._id,
      patient: c.patientId,
      dateTime: c.dateTime,
      fee: c.finalFee,
      tokenNumber: c.tokenNumber
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/doctor/commission?start=YYYY-MM-DD&end=YYYY-MM-DD
router.get('/commission', async (req, res) => {
  try {
    const doctorId = req.user.doctorId || req.user.id;
    const { start, end } = req.query;

    // Parse date range; include full end-day 23:59:59.999
    let dateFilter = {};
    if (start && end) {
      const startDate = new Date(start);
      const endDate = new Date(end);
      endDate.setHours(23, 59, 59, 999);
      dateFilter = { dateTime: { $gte: startDate, $lte: endDate } };
    }

    // Commission is derived from Tokens' billed amount and doctor's commissionRate
    const doctor = await Doctor.findById(doctorId);
    const commissionRate = doctor?.commissionRate || 0;

    const tokens = await Token.find({ doctorId, ...dateFilter })
      .populate('patientId', 'name')
      .sort({ dateTime: -1 })
      .select('dateTime finalFee fee procedures patientId');

    const details = tokens.map((t) => {
      const bill = (typeof t.finalFee === 'number' ? t.finalFee : (typeof t.fee === 'number' ? t.fee : 0)) || 0;
      const service = Array.isArray(t.procedures) && t.procedures.length
        ? t.procedures.map((p) => p.name).filter(Boolean).join(', ')
        : 'Consultation';
      const commissionEarned = (bill * commissionRate) / 100;
      return {
        _id: t._id,
        date: t.dateTime,
        patientName: t.patientId?.name || '—',
        service,
        bill,
        commissionRate,
        commissionEarned,
      };
    });

    const totalCommission = details.reduce((sum, d) => sum + (d.commissionEarned || 0), 0);
    const totalProcedures = details.length;
    const avgCommission = totalProcedures ? totalCommission / totalProcedures : 0;
    const highestCommission = details.reduce((max, d) => Math.max(max, d.commissionEarned || 0), 0);

    res.json({
      summary: {
        totalCommission,
        totalProcedures,
        avgCommission,
        highestCommission,
      },
      details,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to load commission' });
  }
});

// GET /api/doctor/medicines
router.get('/medicines', async (_, res) => {
  try {
    const meds = await Medicine.find({ available: true }).sort({ name: 1 });
    res.json(meds);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/prescriptions', async (req, res) => {
  try {
    const doctorId = req.user.doctorId || req.user.id;
    const { patientId, items, tests = [], notesEnglish, referredToPharmacy, referredToLab, tokenId } = req.body;
    
    if (!patientId || !items?.length) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Ensure quantity exists per item. If missing, infer from dosage "m-a-e for D days".
    const processedItems = (items || []).map((it) => {
      let qty = typeof it.quantity === 'number' ? it.quantity : Number(it.quantity);
      if (!qty || qty <= 0) {
        const dosage = String(it.dosage || '');
        // matches 1-0-1 for 5 days (days optional)
        const m = dosage.match(/^(\d+)\s*-\s*(\d+)\s*-\s*(\d+)(?:.*?for\s*(\d+)\s*day)?/i);
        if (m) {
          const mm = parseInt(m[1] || '0', 10);
          const aa = parseInt(m[2] || '0', 10);
          const ee = parseInt(m[3] || '0', 10);
          const dd = parseInt(m[4] || '0', 10) || 0;
          const suggested = (mm + aa + ee) * (dd || 1);
          if (suggested > 0) qty = suggested;
        }
        if (!qty || qty <= 0) qty = 1; // final fallback
      }
      return { ...it, quantity: qty };
    });

    const saved = await Prescription.create({
      doctorId,
      patientId,
      items: processedItems,
      tests,
      notesEnglish,
      referredToPharmacy: !!referredToPharmacy,
      referredToLab: !!referredToLab,
    });

    // Mark the linked token as completed (prefer provided tokenId, else latest pending one)
    const tokenFilter = tokenId 
      ? { _id: tokenId, doctorId }
      : { doctorId, patientId, status: { $ne: 'completed' } };
    const tokenToUpdate = await Token.findOne(tokenFilter).sort({ dateTime: -1 });
    if (tokenToUpdate) {
      tokenToUpdate.status = 'completed';
      tokenToUpdate.consultedAt = new Date();
      await tokenToUpdate.save();
    }

    // Reload with populated patient for rich client printing
    const populated = await Prescription.findById(saved._id)
      .populate('patientId', 'name mrNumber phone age gender address guardianName guardianRelation cnic')
      .lean();

    res.status(201).json({
      id: populated._id,
      patient: populated.patientId,
      items: populated.items,
      tests: populated.tests || [],
      notesEnglish: populated.notesEnglish || '',
      referredToPharmacy: !!populated.referredToPharmacy,
      referredToLab: !!populated.referredToLab,
      createdAt: populated.createdAt,
      updatedAt: populated.updatedAt,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/doctor/tokens
router.post('/tokens', async (req, res) => {
  try {
    const doctorId = req.user.doctorId || req.user.id;
    const { patientId } = req.body;
    
    if (!patientId) {
      return res.status(400).json({ error: 'Patient ID is required' });
    }
    
    const token = await Token.create({
      doctorId,
      patientId,
      dateTime: new Date(),
      tokenNumber: await Token.countDocuments({ doctorId }) + 1
    });
    
    res.status(201).json(token);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
