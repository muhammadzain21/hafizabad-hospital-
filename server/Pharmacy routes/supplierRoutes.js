const express = require('express');
const router = express.Router();
const Supplier = require('../Pharmacy  models/Supplier');

// POST /api/suppliers - Add a new supplier
router.post('/', async (req, res) => {
  try {
    const {
    name,
    contactPerson,
    phone,
    email,
    address,
    taxId,
    totalPurchases,
    pendingPayments,
    lastOrder,
    status,
    supplies = [],
    purchases = [],
  } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Supplier name is required' });
    }
    const supplier = new Supplier({
      name,
      contactPerson,
      phone,
      email,
      address,
      taxId,
      totalPurchases,
      pendingPayments,
      lastOrder,
      status,
      supplies,
      purchases,
    });
    await supplier.save();
    res.status(201).json(supplier);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add supplier', details: error.message });
  }
});

// PUT /api/suppliers/:id - Update supplier
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const update = req.body;
    const supplier = await Supplier.findByIdAndUpdate(id, update, { new: true });
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    res.json(supplier);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update supplier', details: err.message });
  }
});

// GET /api/suppliers - List all suppliers
router.get('/', async (req, res) => {
  try {
    const suppliers = await Supplier.find();
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch suppliers', details: error.message });
  }
});

// DELETE /api/suppliers/:id - Remove supplier
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const supplier = await Supplier.findByIdAndDelete(id);
    if (!supplier) {
      return res.status(404).json({ error: 'Supplier not found' });
    }
    res.json({ message: 'Supplier deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete supplier', details: err.message });
  }
});

// --- Payments ---
// POST /api/suppliers/:id/payments - Add a supplier payment
router.post('/:id/payments', async (req, res) => {
  try {
    const { amount, method, note, date } = req.body;
    const amt = Number(amount) || 0;
    if (!amt || amt <= 0) return res.status(400).json({ error: 'amount must be > 0' });
    const s = await Supplier.findById(req.params.id);
    if (!s) return res.status(404).json({ error: 'Supplier not found' });
    s.payments = s.payments || [];
    s.payments.push({ amount: amt, method, note, date: date ? new Date(date) : new Date() });
    s.totalPaid = (s.totalPaid || 0) + amt;
    const pending = Math.max(0, (s.totalPurchases || 0) - (s.totalPaid || 0));
    s.pendingPayments = pending;
    await s.save();
    res.json({ totalPaid: s.totalPaid, pendingPayments: s.pendingPayments, payments: s.payments });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/suppliers/:id/payments - Get supplier payments history
router.get('/:id/payments', async (req, res) => {
  try {
    const s = await Supplier.findById(req.params.id).select('payments totalPaid pendingPayments');
    if (!s) return res.status(404).json({ error: 'Supplier not found' });
    res.json({ payments: s.payments || [], totalPaid: s.totalPaid || 0, pendingPayments: s.pendingPayments || 0 });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
