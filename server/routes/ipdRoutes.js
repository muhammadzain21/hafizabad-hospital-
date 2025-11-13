const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const mongoose = require('mongoose');

const Ward = require('../models/Ward');
const Bed = require('../models/Bed');
const IpdAdmission = require('../models/IpdAdmission');
const Patient = require('../models/Patient');
const FinanceRecord = require('../models/FinanceRecord');
const User = require('../models/User'); 
const { verifyJWT, authorizeRoles } = require('../middleware/auth');
const Floor = require('../models/Floor');
const Room = require('../models/Room');
const Doctor = require('../models/Doctor');
const CorporateTransaction = require('../models/CorporateTransaction');
const CorporatePanel = require('../models/CorporatePanel');
const Token = require('../models/Token');


// Utility to generate a simple IPD number (can be replaced with seq counter later)
function generateIpdNumber() {
  return `IPD-${Date.now()}`;
}

// Simple timing middleware for IPD routes
router.use((req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const end = process.hrtime.bigint();
    const ms = Number(end - start) / 1e6;
    // eslint-disable-next-line no-console
    console.log(`[IPD] ${req.method} ${req.originalUrl} - ${ms.toFixed(1)}ms`);
  });
  next();
});

// Helper to handle validation results
function handleValidation(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: 'Validation failed', details: errors.array() });
  }
  next();
}

/* -------------------- Ward CRUD -------------------- */
router.post('/wards', async (req, res) => {
  try {
    const { name, floor, category, roomId } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'name is required' });
    if (!floor || !String(floor).trim()) return res.status(400).json({ error: 'floor is required' });

    const payload = {
      ...req.body,
      name: String(name).trim(),
      floor: String(floor).trim(),
      category: category || 'General',
      roomId: roomId || undefined,
    };
    console.log('[Wards POST] Body:', JSON.stringify(payload));
    const ward = await Ward.create(payload);
    res.status(201).json(ward);
  } catch (err) {
    if (err && err.code === 11000) {
      const val = (err.keyValue && (err.keyValue.name || 'This name'));
      return res.status(400).json({ error: `Ward "${val}" already exists on this floor.`, code: 'DUPLICATE_WARD' });
    }
    console.error('[Wards POST] Error:', err);
    res.status(400).json({ error: err.message });
  }
});

// Get a single admission with full embedded arrays (details view)
router.get('/admissions/:id', async (req, res) => {
  try {
    const admission = await IpdAdmission.findById(req.params.id)
      .populate('patientId');
    if (!admission) return res.status(404).json({ error: 'Admission not found' });
    res.json(admission);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/wards', async (req, res) => {
  try {
    const filter = {};
    if (req.query.floor) filter.floor = req.query.floor;
    if (req.query.roomId) filter.roomId = req.query.roomId;
    const wards = await Ward.find(filter);
    res.json(wards);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update ward
router.patch('/wards/:id', async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.name) updates.name = String(updates.name).trim();
    if (updates.floor) updates.floor = String(updates.floor).trim();
    const ward = await Ward.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!ward) return res.status(404).json({ error: 'Ward not found' });
    res.json(ward);
  } catch (err) {
    if (err && err.code === 11000) {
      const val = (err.keyValue && (err.keyValue.name || 'This name'));
      return res.status(400).json({ error: `Ward "${val}" already exists on this floor.`, code: 'DUPLICATE_WARD' });
    }
    res.status(400).json({ error: err.message });
  }
});

// Delete ward (only if no beds attached)
router.delete('/wards/:id', async (req, res) => {
  try {
    const bedInWard = await Bed.findOne({ wardId: req.params.id }).lean();
    if (bedInWard) return res.status(400).json({ error: 'Cannot delete ward with existing beds' });
    const ward = await Ward.findByIdAndDelete(req.params.id);
    if (!ward) return res.status(404).json({ error: 'Ward not found' });
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* -------------------- Floor CRUD -------------------- */
router.post('/floors', async (req, res) => {
  try {
    const floor = await Floor.create(req.body);
    res.status(201).json(floor);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/floors', async (_req, res) => {
  try {
    const floors = await Floor.find();
    res.json(floors);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* -------------------- Room CRUD -------------------- */
router.post('/rooms', async (req, res) => {
  try {
    const { name, floorId } = req.body || {};
    // Basic validation for clearer client feedback
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'name is required' });
    }
    if (!floorId || !String(floorId).trim()) {
      return res.status(400).json({ error: 'floorId is required' });
    }

    const payload = { ...req.body, name: String(name).trim(), floorId: String(floorId).trim() };
    // Optional: log to aid debugging in environments
    console.log('[Rooms POST] Body:', JSON.stringify(payload));

    const room = await Room.create(payload);
    res.status(201).json(room);
  } catch (err) {
    // Handle duplicate key error (unique index on floorId+name)
    if (err && err.code === 11000) {
      const val = (err.keyValue && (err.keyValue.name || 'This name'));
      return res.status(400).json({ error: `Room "${val}" already exists on this floor.`, code: 'DUPLICATE_ROOM' });
    }
    console.error('[Rooms POST] Error:', err);
    res.status(400).json({ error: err.message });
  }
});

router.get('/rooms', async (req, res) => {
  try {
    const filter = {};
    if (req.query.floorId) filter.floorId = req.query.floorId;
    const rooms = await Room.find(filter);
    res.json(rooms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update room
router.patch('/rooms/:id', async (req, res) => {
  try {
    const updates = { ...req.body };
    if (updates.name) updates.name = String(updates.name).trim();
    if (updates.floorId) updates.floorId = String(updates.floorId).trim();
    const room = await Room.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.json(room);
  } catch (err) {
    if (err && err.code === 11000) {
      const val = (err.keyValue && (err.keyValue.name || 'This name'));
      return res.status(400).json({ error: `Room "${val}" already exists on this floor.`, code: 'DUPLICATE_ROOM' });
    }
    res.status(400).json({ error: err.message });
  }
});

// Delete room (only if no wards/beds attached)
router.delete('/rooms/:id', async (req, res) => {
  try {
    const hasWard = await Ward.findOne({ roomId: req.params.id }).lean();
    if (hasWard) return res.status(400).json({ error: 'Cannot delete room with wards linked' });
    const hasBed = await Bed.findOne({ roomId: req.params.id }).lean();
    if (hasBed) return res.status(400).json({ error: 'Cannot delete room with existing beds' });
    const room = await Room.findByIdAndDelete(req.params.id);
    if (!room) return res.status(404).json({ error: 'Room not found' });
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* -------------------- Bed CRUD -------------------- */
router.post(
  '/beds',
  [
    body('bedNumber').notEmpty().withMessage('bedNumber is required'),
    body().custom((val) => {
      if (!val.wardId && !val.roomId) {
        throw new Error('Either wardId or roomId is required');
      }
      return true;
    }),
  ],
  handleValidation,
  async (req, res) => {
    try {
      // Debug log to trace payloads during bed creation issues
      console.log('[Beds POST] Body:', JSON.stringify(req.body));
      const bed = await Bed.create(req.body);
      res.status(201).json(bed);
    } catch (err) {
      // Return clearer messages for duplicate key errors
      if (err && err.code === 11000) {
        const key = Object.keys(err.keyPattern || {})[0] || '';
        const val = (err.keyValue && (err.keyValue.bedNumber || err.keyValue[key])) || '';
        let scope = '';
        if (key.includes('wardId')) scope = 'this ward';
        else if (key.includes('roomId')) scope = 'this room';
        const message = `Bed number "${val}" already exists in ${scope || 'the selected location'}.`;
        console.warn('[Beds POST] Duplicate key:', err.keyValue, 'index:', err.index, 'message:', message);
        return res.status(400).json({ error: message, code: 'DUPLICATE_BED' });
      }
      console.error('[Beds POST] Error:', err);
      res.status(400).json({ error: err.message || 'Failed to create bed' });
    }
  }
);

// Finance summary for IPD widgets
router.get('/finance/ipd/summary', async (req, res) => {
  try {
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));
    const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0, 0));

    const [incomeAgg] = await FinanceRecord.aggregate([
      { $match: { department: 'IPD', type: 'Income' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const [expenseAgg] = await FinanceRecord.aggregate([
      { $match: { department: 'IPD', type: 'Expense' } },
      { $group: { _id: null, total: { $sum: '$amount' } } },
    ]);
    const [monthAgg] = await FinanceRecord.aggregate([
      { $match: { department: 'IPD', date: { $gte: startOfMonth, $lt: endOfMonth } } },
      { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]);

    const totalIncome = incomeAgg?.total || 0;
    const totalExpense = expenseAgg?.total || 0;
    let monthlyIncome = 0, monthlyExpense = 0;
    (monthAgg || []).forEach(row => {
      if (row._id === 'Income') monthlyIncome = row.total;
      if (row._id === 'Expense') monthlyExpense = row.total;
    });

    res.json({ totalIncome, totalExpense, netBalance: totalIncome - totalExpense, monthlyNet: monthlyIncome - monthlyExpense });
  } catch (err) {
    console.error('[IPD finance] summary error:', err?.message || err);
    res.status(500).json({ error: 'Failed to compute IPD finance summary' });
  }
});

router.get('/beds', async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;
    if (req.query.wardId) filter.wardId = req.query.wardId;
    if (req.query.roomId) filter.roomId = req.query.roomId;
    const beds = await Bed.find(filter).populate('wardId').populate('roomId');
    res.json(beds);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Bed (PATCH)
router.patch('/beds/:id', async (req, res) => {
  try {
    const bed = await Bed.findById(req.params.id);
    if (!bed) return res.status(404).json({ error: 'Bed not found' });
    // Prevent freeing an occupied bed directly via PATCH
    if (req.body.status === 'Available' && bed.status === 'Occupied') {
      return res.status(400).json({ error: 'Cannot set occupied bed to Available directly' });
    }
    Object.assign(bed, req.body);
    await bed.save();
    res.json(bed);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete Bed (only if not occupied)
router.delete('/beds/:id', async (req, res) => {
  try {
    const bed = await Bed.findById(req.params.id);
    if (!bed) return res.status(404).json({ error: 'Bed not found' });
    if (bed.status === 'Occupied') return res.status(400).json({ error: 'Cannot delete an occupied bed' });
    await Bed.findByIdAndDelete(req.params.id);
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* -------------------- Admission -------------------- */

// List admissions (optionally filter by status)
router.get('/admissions', async (req, res) => {
  try {
    const filter = {};
    if (req.query.status) filter.status = req.query.status;

    // Optional pagination
    const page = parseInt(req.query.page, 10) || null;
    const limit = parseInt(req.query.limit, 10) || null;
    const isLight = String(req.query.light || '').toLowerCase() === '1' || String(req.query.light || '').toLowerCase() === 'true';

    let query = IpdAdmission.find(filter)
      // Newest first
      .sort({ admitDateTime: -1 })
      .lean();

    // Exclude heavy embedded arrays for faster list loading when light mode is requested
    if (isLight) {
      query = query.select('-vitals -medications -labTests -doctorVisits -billing')
        // Only fetch minimal patient fields
        .populate('patientId', 'name mrNumber');
    } else {
      // Full populate for detailed views
      query = query.populate('patientId');
    }

    let admissions;
    if (page && limit) {
      const skip = (page - 1) * limit;
      admissions = await query.skip(skip).limit(limit);
    } else {
      admissions = await query;
    }

    // Filter out admissions where the patient might have been deleted
    admissions = admissions.filter((admission) => admission.patientId);
    res.json(admissions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post(
  '/admissions',
  [
    body('bedId').notEmpty().withMessage('bedId is required'),
    body().custom((val) => {
      if (!val.patientId && !val.patientName) {
        throw new Error('Either patientId or patientName is required');
      }
      return true;
    }),
  ],
  handleValidation,
  async (req, res) => {
    try {
      const { patientId, patientName, wardId, bedId, doctorId, admittingDiagnosis, initialVitals, admitSource } = req.body;

      const runWithTransaction = async () => {
        const session = await mongoose.startSession();
        session.startTransaction();
        try {
          // Validate and claim bed
          const bed = await Bed.findOne({ _id: bedId }).session(session);
          if (!bed) {
            throw new Error('Bed not found');
          }
          if (bed.status !== 'Available') {
            return res.status(400).json({ error: 'Bed is not available' });
          }
          await Bed.updateOne({ _id: bedId }, { $set: { status: 'Occupied' } }, { session });

          // Resolve or create patient
          let patient;
          if (patientId) {
            patient = await Patient.findById(patientId).session(session);
            if (!patient) throw new Error('Patient not found');
          } else {
            patient = await Patient.create([{ name: patientName }], { session });
            patient = patient[0];
          }

          let wardIdResolved = typeof bed.wardId === 'string' ? bed.wardId : bed.wardId?._id;
          if (!wardIdResolved) wardIdResolved = wardId;

          // Create admission
          const created = await IpdAdmission.create([
            {
              ipdNumber: generateIpdNumber(),
              patientId: patient._id,
              billingType: (req.body && req.body.billingType) ? String(req.body.billingType) : 'cash',
              panelId: (req.body && req.body.panelId) || undefined,
              wardId: wardIdResolved,
              bedId,
              doctorId: doctorId || undefined,
              admittingDiagnosis,
              initialVitals,
              admitSource,
            },
          ], { session });
          const ipdAdmission = created[0];

          // Link bed to admission
          await Bed.updateOne({ _id: bedId }, { $set: { currentAdmissionId: ipdAdmission._id } }, { session });

          await session.commitTransaction();
          session.endSession();
          return res.json(ipdAdmission);
        } catch (txErr) {
          try { await session.abortTransaction(); } catch (_) {}
          session.endSession();
          throw txErr;
        }
      };

      const runWithoutTransaction = async () => {
        // Atomically claim the bed if available
        const bed = await Bed.findOneAndUpdate(
          { _id: bedId, status: 'Available' },
          { $set: { status: 'Occupied' } },
          { new: true }
        );
        if (!bed) {
          return res.status(400).json({ error: 'Bed is not available' });
        }
        let undone = false;
        const rollbackBed = async () => {
          if (undone) return; // prevent double rollback
          undone = true;
          await Bed.updateOne({ _id: bedId }, { $set: { status: 'Available' }, $unset: { currentAdmissionId: '' } });
        };

        try {
          // Resolve or create patient
          let patient;
          if (patientId) {
            patient = await Patient.findById(patientId);
            if (!patient) throw new Error('Patient not found');
          } else {
            patient = await Patient.create({ name: patientName });
          }

          let wardIdResolved = typeof bed.wardId === 'string' ? bed.wardId : bed.wardId?._id;
          if (!wardIdResolved) wardIdResolved = wardId;

          const ipdAdmission = await IpdAdmission.create({
            ipdNumber: generateIpdNumber(),
            patientId: patient._id,
            billingType: (req.body && req.body.billingType) ? String(req.body.billingType) : 'cash',
            panelId: (req.body && req.body.panelId) || undefined,
            wardId: wardIdResolved,
            bedId,
            doctorId: doctorId || undefined,
            admittingDiagnosis,
            initialVitals,
            admitSource,
          });

          await Bed.updateOne({ _id: bedId }, { $set: { currentAdmissionId: ipdAdmission._id } });
          return res.json(ipdAdmission);
        } catch (err) {
          await rollbackBed();
          throw err;
        }
      };

      try {
        if (process.env.MONGO_USE_TRANSACTIONS === 'false') {
          return await runWithoutTransaction();
        }
        return await runWithTransaction();
      } catch (err) {
        // Fallback if transactions are not supported (e.g., not a replica set)
        const msg = String(err?.message || '');
        const code = err?.code;
        if (code === 20 || msg.includes('Transaction numbers are only allowed')) {
          return await runWithoutTransaction();
        }
        throw err;
      }
    } catch (err) {
      console.error('[IPD finance] create error:', err?.message || err);
      res.status(400).json({ error: err.message || 'Failed to create finance record' });
    }
  }
);

/* Discharge patient (preserve complete history).
   Accepts optional discharge summary payload to store under admission.dischargeSummary
   Schema for summary was added to IpdAdmission model.
*/
const dischargeHandler = async (req, res) => {
  try {
    const admission = await IpdAdmission.findById(req.params.id);
    if (!admission) return res.status(404).json({ error: 'Admission not found' });

    if (admission.status !== 'Admitted') {
      return res.status(400).json({ error: 'Patient already discharged/transferred' });
    }

    // Persist discharge summary details if provided
    const body = req.body || {};
    if (body.dischargeSummary) {
      // Store as-is; model validates nested shapes
      admission.dischargeSummary = {
        ...body.dischargeSummary,
        // Ensure signDate becomes a Date
        signDate: body.dischargeSummary.signDate ? new Date(body.dischargeSummary.signDate) : admission.dischargeSummary?.signDate,
        amount: typeof body.dischargeSummary.amount === 'number' ? body.dischargeSummary.amount : Number(body.dischargeSummary.amount || 0),
        discount: typeof body.dischargeSummary.discount === 'number' ? body.dischargeSummary.discount : Number(body.dischargeSummary.discount || 0),
      };
    }

    admission.status = 'Discharged';
    admission.dischargeDateTime = new Date();
    await admission.save();

    // Free bed
    const bed = await Bed.findById(admission.bedId);
    if (bed) {
      bed.status = 'Available';
      bed.currentAdmissionId = undefined;
      await bed.save();
    }

    res.json(admission);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// Support both PUT and PATCH for discharge to match various clients
router.put('/admissions/:id/discharge', dischargeHandler);
router.patch('/admissions/:id/discharge', dischargeHandler);

/* Dashboard - bed status summary */
router.get('/dashboard/bed-status', async (_, res) => {
  try {
    const summary = await Bed.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]);
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* -------------------- Finance Records -------------------- */
// Note: Make these routes usable without auth for local/desktop usage. If JWT is present, use it.
router.post(
  '/finance',
  [
    body('amount').toFloat().isNumeric().withMessage('amount must be a number'),
    body('category').trim().notEmpty().withMessage('category is required'),
    body('type').custom(v => ['Income', 'Expense'].includes(String(v || ''))).withMessage('type must be Income or Expense'),
  ],
  handleValidation,
  async (req, res) => {
    try {
      // Prefer authenticated user if available; otherwise fallback to first user
      let recordedBy = (req.user && (req.user.id || req.user.sub)) || (req.userData && (req.userData.id || req.userData.sub));
      if (!recordedBy) {
        let user = await User.findOne();
        if (!user) {
          // Auto-create a default admin if missing so finance can function offline
          user = await User.create({ name: 'Admin', username: 'admin', password: '123', role: 'admin' });
        }
        recordedBy = user && user._id ? user._id : undefined;
        if (!recordedBy) return res.status(400).json({ error: 'Unable to attribute finance record to a user.' });
      }

      // Normalize payload
      const payload = {
        ...req.body,
        date: req.body.date ? new Date(req.body.date) : new Date(),
        amount: Number(req.body.amount || 0),
        category: String(req.body.category || '').trim() || 'IPD Billing',
        description: req.body.description ? String(req.body.description) : '',
        type: req.body.type === 'Expense' ? 'Expense' : 'Income',
        department: 'IPD',
        recordedBy,
      };

      const record = await FinanceRecord.create(payload);
      res.status(201).json(record);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  }
);

router.get('/finance', async (req, res) => {
  try {
    const filter = { department: 'IPD' };
    if (req.query.type) filter.type = req.query.type;
    const records = await FinanceRecord.find(filter)
      .populate('recordedBy', 'name')
      .populate('patientId', 'name')
      .populate('admissionId');
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/finance/:id', async (req, res) => {
  try {
    await FinanceRecord.findByIdAndDelete(req.params.id);
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* -------------------- Patient Profile Tabs -------------------- */

// Add Vitals
router.post('/admissions/:id/vitals', async (req, res) => {
  console.log(`[Vitals POST] Received request for admission: ${req.params.id}`);
  console.log('[Vitals POST] Request Body:', JSON.stringify(req.body, null, 2));
  try {
    const admission = await IpdAdmission.findById(req.params.id);
    if (!admission) return res.status(404).json({ error: 'Admission not found' });

    admission.vitals.push(req.body);
    await admission.save();
    res.status(201).json(admission);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Add Medication
router.post('/admissions/:id/medications', async (req, res) => {
  try {
    const admission = await IpdAdmission.findById(req.params.id);
    if (!admission) return res.status(404).json({ error: 'Admission not found' });

    admission.medications.push(req.body);
    await admission.save();
    res.status(201).json(admission);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete Medication item
router.delete('/admissions/:id/medications/:medId', async (req, res) => {
  try {
    const admission = await IpdAdmission.findById(req.params.id);
    if (!admission) return res.status(404).json({ error: 'Admission not found' });
    const med = admission.medications.id(req.params.medId);
    if (!med) return res.status(404).json({ error: 'Medication not found' });
    med.remove();
    await admission.save();
    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Add Lab Test
router.post('/admissions/:id/lab-tests', async (req, res) => {
  try {
    const admission = await IpdAdmission.findById(req.params.id);
    if (!admission) return res.status(404).json({ error: 'Admission not found' });

    admission.labTests.push(req.body);
    await admission.save();
    res.status(201).json(admission);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update Lab Test
router.patch('/admissions/:id/lab-tests/:testId', async (req, res) => {
  try {
    const admission = await IpdAdmission.findById(req.params.id);
    if (!admission) return res.status(404).json({ error: 'Admission not found' });

    const test = admission.labTests.id(req.params.testId);
    if (!test) return res.status(404).json({ error: 'Lab test not found' });

    Object.assign(test, req.body);
    await admission.save();
    res.json(admission);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Add Doctor Visit
router.post('/admissions/:id/doctor-visits', async (req, res) => {
  try {
    const admission = await IpdAdmission.findById(req.params.id);
    if (!admission) return res.status(404).json({ error: 'Admission not found' });

    // Normalize payload: ensure doctorName from Doctor collection and set default dateTime
    const { doctorId, doctorName, dateTime, notes, diagnosis, treatment } = req.body || {};
    if (!doctorId) return res.status(400).json({ error: 'doctorId is required' });
    const doc = await Doctor.findById(doctorId).lean();
    if (!doc) return res.status(404).json({ error: 'Doctor not found' });

    const visit = {
      doctorId: String(doctorId),
      doctorName: doctorName || doc.name,
      dateTime: dateTime ? new Date(dateTime) : new Date(),
      notes: notes || '',
      diagnosis: diagnosis || '',
      treatment: treatment || '',
    };

    admission.doctorVisits.push(visit);
    await admission.save();

    // Emit socket notification to the assigned doctor
    try {
      const io = req.app.get('io');
      if (io) {
        io.to(`doctor:${visit.doctorId}`).emit('ipd:visit-scheduled', {
          eventId: admission.doctorVisits[admission.doctorVisits.length - 1]._id,
          doctorId: visit.doctorId,
          dateTime: visit.dateTime,
          notes: visit.notes || '',
          patient: { _id: admission.patientId },
        });
      }
    } catch (sockErr) {
      console.warn('[socket] failed to emit ipd:visit-scheduled (doctor-visits):', sockErr?.message || sockErr);
    }

    res.status(201).json(admission);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Add Billing Item
router.post('/admissions/:id/billing', async (req, res) => {
  try {
    const admission = await IpdAdmission.findById(req.params.id);
    if (!admission) return res.status(404).json({ error: 'Admission not found' });

    // If client provides panel/billingType override, persist on admission
    if (req?.body?.panelId) admission.panelId = String(req.body.panelId);
    if (req?.body?.billingType) admission.billingType = String(req.body.billingType);

    admission.billing.push(req.body);
    await admission.save();
    try {
      const amount = Number(req?.body?.amount || 0);
      const date = req?.body?.date ? new Date(req.body.date) : new Date();
      if (amount > 0) {
        // Prefer admission billing settings
        const isAdmissionCredit = String(admission.billingType || '').toLowerCase() === 'credit';
        let panelId = isAdmissionCredit ? (admission.panelId || null) : null;
        // Fallback: derive from latest OPD token
        if (!panelId) {
          const latestToken = await Token.findOne({ patientId: admission.patientId }).sort({ dateTime: -1 }).lean();
          if (latestToken && String(latestToken.billingType || '').toLowerCase() === 'credit' && latestToken.panelId) {
            panelId = latestToken.panelId;
          }
        }
        if (panelId) {
          try {
            const panel = await CorporatePanel.findById(panelId);
            if (panel) {
              panel.balance = Number(panel.balance || 0) - amount;
              await panel.save();
            }
            await CorporateTransaction.create({
              panelId: String(panelId),
              type: 'charge',
              amount,
              date,
              description: req?.body?.description || 'IPD Billing',
              patientId: String(admission.patientId),
              admissionId: String(admission._id),
              department: 'IPD',
            });
          } catch (_) {}
        }
      }
    } catch (_) {}
    res.status(201).json(admission);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update Billing Item
router.patch('/admissions/:id/billing/:itemId', async (req, res) => {
  try {
    const admission = await IpdAdmission.findById(req.params.id);
    if (!admission) return res.status(404).json({ error: 'Admission not found' });

    const item = admission.billing.id(req.params.itemId);
    if (!item) return res.status(404).json({ error: 'Billing item not found' });

    Object.assign(item, req.body);
    await admission.save();
    res.json(admission);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* -------------------- Schedule (Doctor Visits) -------------------- */
// Create a new schedule event (doctor visit)
router.post('/schedule', async (req, res) => {
  try {
    const { patientId, doctorId, dateTime, notes } = req.body;
    if (!patientId || !doctorId || !dateTime) {
      return res.status(400).json({ error: 'patientId, doctorId and dateTime are required' });
    }

    // Find the active admission for the patient
    const admission = await IpdAdmission.findOne({ patientId, status: 'Admitted' });
    if (!admission) {
      return res.status(404).json({ error: 'Active admission not found for the patient' });
    }

    // Resolve doctor name (required by schema)
    const doctor = await Doctor.findById(doctorId).lean();
    if (!doctor) {
      return res.status(404).json({ error: 'Doctor not found' });
    }

    const visit = { doctorId, doctorName: doctor.name, dateTime, notes };
    admission.doctorVisits.push(visit);
    await admission.save();

    const createdVisit = admission.doctorVisits[admission.doctorVisits.length - 1];
    // Notify target doctor via Socket.IO
    try {
      const io = req.app.get('io');
      if (io) {
        io.to(`doctor:${doctorId}`).emit('ipd:visit-scheduled', {
          eventId: createdVisit._id,
          doctorId,
          dateTime: createdVisit.dateTime,
          notes: createdVisit.notes || '',
          patient: { _id: admission.patientId },
        });
      }
    } catch (sockErr) {
      console.warn('[socket] failed to emit ipd:visit-scheduled:', sockErr?.message || sockErr);
    }
    res.status(201).json(createdVisit);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Update an existing schedule event
router.patch('/schedule/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const updates = { ...req.body };

    const admission = await IpdAdmission.findOne({ 'doctorVisits._id': eventId });
    if (!admission) return res.status(404).json({ error: 'Schedule event not found' });

    const visit = admission.doctorVisits.id(eventId);
    if (!visit) return res.status(404).json({ error: 'Schedule event not found' });

    // If doctorId is being changed and doctorName not provided, sync doctorName
    if (updates.doctorId && !updates.doctorName) {
      const doctor = await Doctor.findById(updates.doctorId).lean();
      if (!doctor) return res.status(404).json({ error: 'Doctor not found' });
      updates.doctorName = doctor.name;
    }

    Object.assign(visit, updates);
    await admission.save();
    // Emit update event to the doctor (new doctor if changed)
    try {
      const io = req.app.get('io');
      if (io) {
        const targetDoctorId = updates.doctorId || visit.doctorId;
        io.to(`doctor:${targetDoctorId}`).emit('ipd:visit-updated', {
          eventId: visit._id,
          doctorId: targetDoctorId,
          dateTime: visit.dateTime,
          notes: visit.notes || '',
        });
      }
    } catch (sockErr) {
      console.warn('[socket] failed to emit ipd:visit-updated:', sockErr?.message || sockErr);
    }
    res.json(visit);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete a schedule event
router.delete('/schedule/:eventId', async (req, res) => {
  try {
    const { eventId } = req.params;
    const admission = await IpdAdmission.findOne({ 'doctorVisits._id': eventId });
    if (!admission) return res.status(404).json({ error: 'Schedule event not found' });

    admission.doctorVisits.id(eventId).remove();
    await admission.save();
    // Emit deletion notification best-effort
    try {
      const io = req.app.get('io');
      if (io) {
        const doctorId = req.body?.doctorId; // optional hint
        if (doctorId) io.to(`doctor:${doctorId}`).emit('ipd:visit-deleted', { eventId });
        else io.emit('ipd:visit-deleted', { eventId });
      }
    } catch (sockErr) {
      console.warn('[socket] failed to emit ipd:visit-deleted:', sockErr?.message || sockErr);
    }

    res.status(204).send();
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/* Get Today's Schedule */
router.get('/schedule', async (req, res) => {
  try {
    // Use UTC day boundaries
    const paramDate = req.query.date ? new Date(req.query.date) : new Date();
    const startUtc = new Date(Date.UTC(paramDate.getUTCFullYear(), paramDate.getUTCMonth(), paramDate.getUTCDate(), 0, 0, 0, 0));
    const endUtc = new Date(Date.UTC(paramDate.getUTCFullYear(), paramDate.getUTCMonth(), paramDate.getUTCDate() + 1, 0, 0, 0, 0));
    const filterDoctorId = req.query.doctorId ? String(req.query.doctorId) : null;

    // Find admissions with doctor visits scheduled for the selected day
    const admissions = await IpdAdmission.find({
      status: 'Admitted',
      'doctorVisits.dateTime': {
        $gte: startUtc, // Use Date objects for correct matching on Date fields
        $lt: endUtc,
      },
    }).populate('patientId', 'name mrNumber').lean();

    // Flatten the visits into a single schedule array
    const scheduleEvents = admissions.flatMap(admission =>
      admission.doctorVisits
        .filter(visit => {
          const visitDate = new Date(visit.dateTime);
          const inDay = visitDate >= startUtc && visitDate < endUtc;
          const doctorOk = !filterDoctorId || String(visit.doctorId) === filterDoctorId;
          return inDay && doctorOk;
        })
        .map(visit => ({
          ...visit,
          patientName: admission.patientId.name,
          mrNumber: admission.patientId.mrNumber,
          patientObjId: admission.patientId._id,
          admissionId: admission._id,
        }))
    );

    res.json(scheduleEvents.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime)));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Removed duplicate finance routes block to avoid conflicts.

module.exports = router;
