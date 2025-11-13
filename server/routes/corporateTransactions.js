const express = require('express');
const router = express.Router();
const CorporateTransaction = require('../models/CorporateTransaction');
const CorporatePanel = require('../models/CorporatePanel');

// List transactions (optionally filter by panelId) with optional pagination
router.get('/', async (req, res) => {
  try {
    const { panelId, dateFrom, dateTo } = req.query;
    const filter = {};
    if (panelId) {
      const ids = String(panelId).split(',').map(s => s.trim()).filter(Boolean);
      filter.panelId = ids.length > 1 ? { $in: ids } : ids[0];
    }
    if (dateFrom || dateTo) {
      const start = dateFrom ? new Date(`${dateFrom}T00:00:00`) : new Date('1970-01-01T00:00:00');
      const end = dateTo ? new Date(`${dateTo}T23:59:59.999`) : new Date('2999-12-31T23:59:59.999');
      filter.$or = [
        { date: { $gte: start, $lte: end } },
        { createdAt: { $gte: start, $lte: end } },
      ];
    }

    const page = Math.max(1, parseInt(req.query.page) || 0);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 0));
    const usePagination = page > 0 && limit > 0;

    let txns, total;
    if (usePagination) {
      total = await CorporateTransaction.countDocuments(filter);
      txns = await CorporateTransaction.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean();
    } else {
      txns = await CorporateTransaction.find(filter).sort({ createdAt: -1 }).lean();
    }

    const panelIds = Array.from(new Set(txns.map(t => t.panelId).filter(Boolean)));
    const panels = await CorporatePanel.find({ _id: { $in: panelIds } }).lean();
    const nameById = new Map(panels.map(p => [String(p._id), p.name]));

    // Enrichment: patient and token details
    const patientIds = Array.from(new Set(txns.map(t => t.patientId).filter(Boolean)));
    const tokenIds = Array.from(new Set(txns.map(t => t.tokenId).filter(Boolean)));
    const [Patients, Tokens] = [require('../models/Patient'), require('../models/Token')];
    let patients = [];
    let tokens = [];
    if (patientIds.length) {
      patients = await Patients.find({ _id: { $in: patientIds } }).lean();
    }
    if (tokenIds.length) {
      tokens = await Tokens.find({ _id: { $in: tokenIds } }).lean();
    }
    const patientMap = new Map(patients.map(p => [String(p._id), p]));
    const tokenMap = new Map(tokens.map(tk => [String(tk._id), tk]));

    const withNames = txns.map(t => {
      const p = t.patientId ? patientMap.get(String(t.patientId)) : null;
      const tk = t.tokenId ? tokenMap.get(String(t.tokenId)) : null;
      const patientName = t.patientName || p?.patientName || p?.name;
      const guardianName = t.guardianName || p?.guardianName || p?.fatherName;
      const cnic = t.cnic || p?.cnic;
      const mrNumber = t.mrNumber || p?.mrNumber || p?.mr || tk?.mrNumber;
      const tokenNumber = t.tokenNumber || tk?.tokenNumber || tk?.number;
      return {
        ...t,
        panelName: nameById.get(String(t.panelId)) || t.panelId,
        patientName,
        guardianName,
        cnic,
        mrNumber,
        tokenNumber,
      };
    });

    if (usePagination) return res.json({ items: withNames, total, page, limit });
    res.json(withNames);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to fetch transactions' });
  }
});

// Create a transaction (charge, payment, adjustment)
router.post('/', async (req, res) => {
  try {
    const body = req.body || {};
    if (!body.panelId) return res.status(400).json({ error: 'panelId is required' });
    if (!body.type) return res.status(400).json({ error: 'type is required' });
    const amount = Number(body.amount || 0);
    if (!(amount > 0)) return res.status(400).json({ error: 'amount must be > 0' });

    // Adjust panel balance: payment increases balance; charge decreases
    const panel = await CorporatePanel.findById(body.panelId);
    if (!panel) return res.status(404).json({ error: 'Panel not found' });
    if (body.type === 'payment') panel.balance = Number(panel.balance || 0) + amount;
    if (body.type === 'charge') panel.balance = Number(panel.balance || 0) - amount;
    await panel.save();

    const txn = await CorporateTransaction.create(body);
    const result = { ...(txn.toObject ? txn.toObject() : txn), panelName: panel.name };
    res.status(201).json(result);
  } catch (e) {
    res.status(400).json({ error: e.message || 'Failed to create transaction' });
  }
});

module.exports = router;
