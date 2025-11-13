const express = require('express');
const router = express.Router();
const CorporatePanel = require('../models/CorporatePanel');

// List panels
router.get('/', async (req, res) => {
  try {
    const panels = await CorporatePanel.find({}).sort({ name: 1 });
    res.json(panels);
  } catch (e) {
    res.status(500).json({ error: e.message || 'Failed to fetch panels' });
  }
});

// Create panel
router.post('/', async (req, res) => {
  try {
    const panel = await CorporatePanel.create(req.body || {});
    res.status(201).json(panel);
  } catch (e) {
    res.status(400).json({ error: e.message || 'Failed to create panel' });
  }
});

// Update panel
router.put('/:id', async (req, res) => {
  try {
    const panel = await CorporatePanel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!panel) return res.status(404).json({ message: 'Panel not found' });
    res.json(panel);
  } catch (e) {
    res.status(400).json({ error: e.message || 'Failed to update panel' });
  }
});

// Delete panel
router.delete('/:id', async (req, res) => {
  try {
    await CorporatePanel.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message || 'Failed to delete panel' });
  }
});

module.exports = router;
