const express = require('express');
const router = express.Router();

// List prescriptions referred to pharmacy (server-side pagination, search, sorting)
router.get('/', async (req, res) => {
  try {
    const Prescription = require('../models/prescription');
    const Patient = require('../models/Patient');
    const Doctor = require('../models/Doctor');

    const {
      patientId,
      doctorId,
      page = 1,
      pageSize = 10,
      search = '',
      sortBy = 'createdAt',
      sortDir = 'desc'
    } = req.query || {};

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const sizeNum = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 10));
    const skip = (pageNum - 1) * sizeNum;

    // Base match
    const match = { referredToPharmacy: true };
    if (patientId) match.patientId = patientId;
    if (doctorId) match.doctorId = doctorId;

    // Build sort stage
    let sortStage = { createdAt: sortDir === 'asc' ? 1 : -1 };
    if (sortBy === 'patient') sortStage = { 'patient.name': sortDir === 'asc' ? 1 : -1, createdAt: -1 };
    if (sortBy === 'doctor') sortStage = { 'doctor.name': sortDir === 'asc' ? 1 : -1, createdAt: -1 };
    if (sortBy === 'createdAt') sortStage = { createdAt: sortDir === 'asc' ? 1 : -1 };

    const patientColl = Patient.collection.name;
    const doctorColl = Doctor.collection.name;

    const pipeline = [
      { $match: match },
      // Look up patient and doctor
      { $lookup: { from: patientColl, localField: 'patientId', foreignField: '_id', as: 'patient' } },
      { $lookup: { from: doctorColl, localField: 'doctorId', foreignField: '_id', as: 'doctor' } },
      { $addFields: { patient: { $arrayElemAt: ['$patient', 0] }, doctor: { $arrayElemAt: ['$doctor', 0] } } },
      // Optional search on patient/doctor name
      ...(search
        ? [
            { $match: { $or: [
              { 'patient.name': { $regex: search, $options: 'i' } },
              { 'doctor.name': { $regex: search, $options: 'i' } }
            ] } }
          ]
        : []),
      { $sort: sortStage },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: sizeNum },
            {
              $project: {
                _id: 1,
                createdAt: 1,
                patientId: 1,
                doctorId: 1,
                items: 1,
                notesEnglish: 1,
                'patient.name': 1,
                'patient.mrNumber': 1,
                'patient.phone': 1,
                'patient.fatherPhone': 1,
                'patient.fatherNumber': 1,
                'doctor.name': 1
              }
            }
          ],
          meta: [ { $count: 'total' } ]
        }
      },
      {
        $project: {
          referrals: '$data',
          total: { $ifNull: [ { $arrayElemAt: ['$meta.total', 0] }, 0 ] }
        }
      }
    ];

    const result = await Prescription.aggregate(pipeline).allowDiskUse(true);
    const out = result && result[0] ? result[0] : { referrals: [], total: 0 };

    // Normalize shape for frontend
    const referrals = (out.referrals || []).map(p => ({
      _id: p._id,
      createdAt: p.createdAt,
      patientId: p.patientId,
      doctorId: p.doctorId,
      items: p.items || [],
      notesEnglish: p.notesEnglish || '',
      patient: {
        name: p.patient?.name || '-',
        mrNumber: p.patient?.mrNumber || '-',
        phone: p.patient?.phone || '',
        fatherPhone: p.patient?.fatherPhone || p.patient?.fatherNumber || ''
      },
      doctor: { name: p.doctor?.name || '-' }
    }));

    res.json({ referrals, total: out.total, page: pageNum, pageSize: sizeNum });
  } catch (err) {
    res.status(500).json({ message: err?.message || 'Failed to load pharmacy referrals' });
  }
});

// Get a specific referred prescription with denormalized patient/doctor info
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const Prescription = require('../models/prescription');
    const Patient = require('../models/Patient');
    const Doctor = require('../models/Doctor');

    const p = await Prescription.findById(id).lean();
    if (!p) return res.status(404).json({ message: 'Prescription not found' });
    if (!p.referredToPharmacy) {
      // Optional: still return but mark not-referred
      // return res.status(400).json({ message: 'Prescription not referred to pharmacy' });
    }

    const [patient, doctor] = await Promise.all([
      p.patientId ? Patient.findById(p.patientId).select('name mrNumber phone age gender').lean() : null,
      p.doctorId ? Doctor.findById(p.doctorId).select('name').lean() : null,
    ]);

    return res.json({
      _id: p._id,
      createdAt: p.createdAt,
      patientId: p.patientId,
      doctorId: p.doctorId,
      items: p.items || [],
      tests: p.tests || [],
      notesUrdu: p.notesUrdu || '',
      notesEnglish: p.notesEnglish || '',
      referredToPharmacy: !!p.referredToPharmacy,
      referredToLab: !!p.referredToLab,
      patient,
      doctor,
    });
  } catch (err) {
    res.status(500).json({ message: err?.message || 'Failed to load prescription' });
  }
});

module.exports = router;
