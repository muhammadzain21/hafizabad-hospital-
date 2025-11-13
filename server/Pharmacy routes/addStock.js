const express = require('express');
const router = express.Router();
const AddStock = require('../Pharmacy  models/AddStock');
const Medicine = require('../Pharmacy  models/Medicine');
const Supplier = require('../Pharmacy  models/Supplier');
const Inventory = require('../Pharmacy  models/Inventory');
const Purchase = require('../Pharmacy  models/Purchase');

// POST /api/add-stock - Add stock record
router.post('/', async (req, res) => {
  try {
    console.log('AddStock POST req.body:', req.body);
    const { medicine, medicineName, quantity, packQuantity, buyPricePerPack, salePricePerPack, supplier, expiryDate, minStock, invoiceNumber, category, status, purchaseDate } = req.body;
    if ((!medicine && !medicineName) || quantity == null || packQuantity == null || buyPricePerPack == null) {
      return res.status(400).json({ error: 'medicine (or medicineName), quantity, packQuantity, buyPricePerPack are required' });
    }
    const qtyNum = Number(quantity);
    const packQtyNum = Number(packQuantity);
    const buyPerPackNum = Number(buyPricePerPack);
    const salePerPackNum = salePricePerPack != null && salePricePerPack !== '' ? Number(salePricePerPack) : undefined;
    if (!Number.isFinite(qtyNum) || !Number.isFinite(packQtyNum) || !Number.isFinite(buyPerPackNum) || packQtyNum <= 0 || qtyNum <= 0) {
      return res.status(400).json({ error: 'quantity and packQuantity must be positive numbers, buyPricePerPack must be a number' });
    }
    // Calculate derived unit prices & profit
    const unitBuyPrice = buyPerPackNum / packQtyNum;
    const totalItems = qtyNum * packQtyNum;
    const unitSalePrice = (salePerPackNum != null) ? (salePerPackNum / packQtyNum) : undefined;
    const profitPerUnit = (unitSalePrice !== undefined) ? (unitSalePrice - unitBuyPrice) : undefined;
    // Resolve medicine: accept id or name (create if missing)
    let medId = medicine;
    if (!medId && medicineName) {
      let existing = await Medicine.findOne({ name: medicineName });
      if (!existing) {
        existing = await Medicine.create({ name: medicineName, category: category || '' });
      }
      medId = existing._id;
    }
    const med = await Medicine.findById(medId);
    if (!med) return res.status(404).json({ error: 'Medicine not found' });
    // Resolve supplier: allow missing by using/creating 'Unknown Supplier'
    let supplierId = supplier;
    let sup = null;
    if (!supplierId) {
      sup = await Supplier.findOne({ name: 'Unknown Supplier' });
      if (!sup) {
        sup = await Supplier.create({ name: 'Unknown Supplier', contact: '', phone: '' });
      }
      supplierId = sup._id;
    } else {
      sup = await Supplier.findById(supplierId);
      if (!sup) return res.status(404).json({ error: 'Supplier not found' });
    }

    const invNo = invoiceNumber || '';

    // upsert behavior: if there is already a PENDING record for this medicine + invoiceNumber, update it in place.
    // If the existing record is APPROVED, DO NOT modify it; create a new pending record instead (preserve audit trail).
    if (invNo) {
      const existingDoc = await AddStock.findOne({ medicine: med._id, invoiceNumber: invNo, status: 'pending' });
      if (existingDoc) {
        const prevTotal = existingDoc.totalItems != null
          ? Number(existingDoc.totalItems)
          : Number(existingDoc.quantity || 0) * Number(existingDoc.packQuantity || 1);

        existingDoc.packQuantity = packQtyNum;
        existingDoc.buyPricePerPack = buyPerPackNum;
        existingDoc.salePricePerPack = salePerPackNum;
        existingDoc.unitBuyPrice = unitBuyPrice;
        existingDoc.unitSalePrice = unitSalePrice;
        existingDoc.profitPerUnit = profitPerUnit;
        existingDoc.totalItems = totalItems;
        existingDoc.unitPrice = unitBuyPrice; // legacy
        if (supplierId) {
          const sup = await Supplier.findById(supplierId);
          if (sup) existingDoc.supplier = sup._id;
        }
        if (minStock !== undefined) existingDoc.minStock = minStock;
        if (category !== undefined) existingDoc.category = category;
        // Preserve status if not explicitly changing (avoid flipping approved -> pending unintentionally)
        if (status) existingDoc.status = status;
        await existingDoc.save();

        // If approved, adjust Inventory by the delta
        try {
          if (existingDoc.status === 'approved' && med.name) {
            const deltaUnits = totalItems - prevTotal;
            if (Number.isFinite(deltaUnits) && deltaUnits !== 0) {
              await Inventory.findOneAndUpdate(
                { name: med.name },
                {
                  $inc: { stock: deltaUnits },
                  $set: {
                    price: existingDoc.unitSalePrice ?? 0,
                    expiryDate: existingDoc.expiryDate,
                    supplierId,
                    invoiceNumber: invNo
                  }
                },
                { upsert: true, new: true }
              );
            }
          }
        } catch (err) {
          console.error('Inventory adjustment failed on upsert POST:', err?.message || err);
        }

          return res.status(200).json(existingDoc);
        }
      }

    // No existing doc -> create a new one (original behavior)
    const totalPrice = buyPerPackNum * qtyNum;
    const addStock = new AddStock({
      medicine: med._id,
      quantity: qtyNum, // number of packs
      packQuantity: packQtyNum,
      buyPricePerPack: buyPerPackNum,
      salePricePerPack: salePerPackNum,
      unitBuyPrice,
      unitSalePrice,
      profitPerUnit,
      totalItems,
      unitPrice: unitBuyPrice, // legacy field
      invoiceNumber: invNo,
      supplier: supplierId,
      expiryDate,
      minStock,
      category,
      totalPrice,
      status: status || 'pending'
    });
    await addStock.save();
    console.log('Saved AddStock doc:', addStock);

    // Update supplier order history and aggregates ONLY if already approved
    if ((status || 'pending') === 'approved') {
      try {
        await Supplier.findByIdAndUpdate(supplierId, {
          $inc: {
            totalPurchases: totalPrice
          },
          $push: {
            purchases: {
              date: purchaseDate ? new Date(purchaseDate) : new Date(),
              amount: totalPrice,
              items: totalItems,
              invoice: invoiceNumber || ''
            }
          },
          lastOrder: new Date()
        });
      } catch (err) {
        console.error('Failed to update supplier order history:', err.message);
      }
    }

    // Also create a Purchase record for reporting consistency
    try {
      const purchase = new Purchase({
        addStockId: addStock._id,
        medicine: med._id,
        medicineName: med.name,
        supplier: supplierId,
        supplierName: sup?.name || '',
        quantity: qtyNum,
        packQuantity: packQtyNum,
        totalItems,
        buyPricePerPack: buyPerPackNum,
        buyPricePerUnit: unitBuyPrice,
        totalPurchaseAmount: totalPrice,
        salePricePerPack: salePerPackNum,
        salePricePerUnit: unitSalePrice,
        invoiceNumber,
        expiryDate,
        minStock,
        purchaseDate: purchaseDate ? new Date(purchaseDate) : undefined,
        status: status || 'pending'
      });
      await purchase.save();
    } catch (err) {
      console.error('Failed to create Purchase from AddStock:', err.message);
    }

    res.status(201).json(addStock);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add stock', details: error.message });
  }
});

// POST /api/add-stock/loose - Add loose units to an existing medicine and update inventory + purchases
router.post('/loose', async (req, res) => {
  try {
    const { medicine, medicineName, units, buyPricePerUnit, salePricePerUnit, supplier, invoiceNumber, category } = req.body || {};
    const unitCount = Number(units);
    const unitBuy = Number(buyPricePerUnit);
    const unitSale = salePricePerUnit != null && salePricePerUnit !== '' ? Number(salePricePerUnit) : undefined;
    if ((!medicine && !medicineName) || !Number.isFinite(unitCount) || unitCount <= 0 || !Number.isFinite(unitBuy) || unitBuy < 0) {
      return res.status(400).json({ error: 'medicine (or medicineName), positive units and buyPricePerUnit are required' });
    }

    // Resolve medicine
    let medId = medicine;
    if (!medId && medicineName) {
      let existingMed = await Medicine.findOne({ name: medicineName });
      if (!existingMed) {
        existingMed = await Medicine.create({ name: medicineName, category: category || '' });
      }
      medId = existingMed._id;
    }
    const med = await Medicine.findById(medId);
    if (!med) return res.status(404).json({ error: 'Medicine not found' });

    // Resolve supplier (default Unknown Supplier)
    let supplierId = supplier;
    let supDoc = null;
    if (!supplierId) {
      supDoc = await Supplier.findOne({ name: 'Unknown Supplier' });
      if (!supDoc) supDoc = await Supplier.create({ name: 'Unknown Supplier', contact: '', phone: '' });
      supplierId = supDoc._id;
    } else {
      supDoc = await Supplier.findById(supplierId);
      if (!supDoc) return res.status(404).json({ error: 'Supplier not found' });
    }

    // Create or update a PENDING AddStock record for loose units
    let pending = null;
    if (invoiceNumber) {
      pending = await AddStock.findOne({ medicine: med._id, invoiceNumber, status: 'pending' });
    }
    if (!pending) {
      pending = new AddStock({
        medicine: med._id,
        quantity: unitCount, // treat each unit as a pack when packQuantity=1
        packQuantity: 1,
        buyPricePerPack: unitBuy,
        salePricePerPack: unitSale,
        unitBuyPrice: unitBuy,
        unitSalePrice: unitSale,
        profitPerUnit: unitSale != null ? (unitSale - unitBuy) : undefined,
        totalItems: unitCount,
        unitPrice: unitBuy, // legacy
        invoiceNumber,
        supplier: supplierId,
        category: category || med.category || '',
        status: 'pending'
      });
      await pending.save();
    } else {
      // Update existing pending with more units and latest pricing
      const currentTotal = pending.totalItems != null ? Number(pending.totalItems) : (Number(pending.quantity || 0) * Number(pending.packQuantity || 1));
      const newTotal = currentTotal + unitCount;
      pending.totalItems = newTotal;
      pending.packQuantity = 1;
      pending.quantity = newTotal; // quantity = units when packQuantity=1
      pending.unitBuyPrice = unitBuy;
      if (unitSale != null) pending.unitSalePrice = unitSale;
      pending.buyPricePerPack = unitBuy;
      pending.salePricePerPack = unitSale;
      pending.profitPerUnit = (pending.unitSalePrice != null) ? (pending.unitSalePrice - unitBuy) : pending.profitPerUnit;
      await pending.save();
    }

    // Create a pending Purchase record (no supplier totals yet)
    try {
      const totalPurchaseAmount = unitBuy * unitCount;
      const purchase = new Purchase({
        addStockId: pending._id,
        medicine: med._id,
        medicineName: med.name,
        supplier: supplierId,
        supplierName: supDoc?.name || '',
        quantity: unitCount,
        packQuantity: 1,
        totalItems: unitCount,
        buyPricePerPack: unitBuy,
        buyPricePerUnit: unitBuy,
        totalPurchaseAmount,
        salePricePerPack: unitSale,
        salePricePerUnit: unitSale,
        invoiceNumber,
        status: 'pending'
      });
      await purchase.save();
    } catch (err) {
      console.error('Purchase create failed (loose pending):', err?.message || err);
    }

    // Do NOT update Inventory here; it will be updated on approval
    const out = await AddStock.findById(pending._id).populate('medicine supplier');
    res.json(out);
  } catch (error) {
    res.status(500).json({ error: 'Failed to add loose items', details: error.message });
  }
});

// GET /api/add-stock - List APPROVED stock additions (default inventory)
// Supports pagination via ?page=1&limit=20 and optional search via ?q=panadol
router.get('/', async (req, res) => {
  try {
    const rawPage = parseInt(req.query.page || '0', 10);
    const rawLimit = parseInt(req.query.limit || '0', 10);
    const page = Number.isFinite(rawPage) ? Math.max(rawPage, 0) : 0;
    const limit = Number.isFinite(rawLimit) ? Math.max(rawLimit, 0) : 0;
    const q = (req.query.q || '').toString().trim();

    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // base filter: approved
    const filter = { status: 'approved' };
    if (q) {
      // match medicine name or barcode; fallback to AddStock.name/barcode if present
      const safe = escapeRegex(q);
      const nameRegex = new RegExp(safe, 'i');
      filter.$or = [
        { 'medicine.name': nameRegex },
        { 'medicine.barcode': nameRegex },
        { name: nameRegex },
        { barcode: nameRegex },
      ];
    }

    if (page > 0 && limit > 0) {
      // For $or on populated fields, we need aggregation to match populated paths; simpler approach:
      // first query IDs of medicines that match, then filter by medicine in $in along with AddStock fallback fields
      let medicineFilter = {};
      if (q) {
        try {
          const safe = escapeRegex(q);
          const meds = await Medicine.find({
            $or: [ { name: new RegExp(safe, 'i') }, { barcode: new RegExp(safe, 'i') } ]
          }).select('_id');
          const medIds = meds.map(m => m._id);
          medicineFilter = { $or: [ { medicine: { $in: medIds } }, { name: new RegExp(safe, 'i') }, { barcode: new RegExp(safe, 'i') } ] };
        } catch (e) {
          // On any regex/db failure, fall back to no results on medId and only try AddStock fields
          const safe = escapeRegex(q);
          medicineFilter = { $or: [ { name: new RegExp(safe, 'i') }, { barcode: new RegExp(safe, 'i') } ] };
        }
      }

      const finalFilter = q ? { status: 'approved', ...medicineFilter } : { status: 'approved' };
      const total = await AddStock.countDocuments(finalFilter);
      const items = await AddStock.find(finalFilter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('medicine supplier');
      return res.json({ items, total, page, limit });
    }

    // Legacy non-paginated payload
    const records = await AddStock.find({ status: 'approved' }).populate('medicine supplier');
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch stock records', details: error.message });
  }
});

// GET /api/add-stock/pending - List PENDING stock additions for review
router.get('/pending', async (_req, res) => {
  try {
    const pending = await AddStock.find({ status: 'pending' }).populate('medicine supplier');
    res.json(pending);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pending records', details: error.message });
  }
});

// PATCH /api/add-stock/:id/approve - mark pending record as approved
// Approve a pending add-stock record and update Inventory stock by totalItems
router.patch('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const pending = await AddStock.findById(id).populate('medicine supplier');
    if (!pending) return res.status(404).json({ error: 'Record not found' });

    // Calculate units to add
    const pendingTotalItems = pending.totalItems != null
      ? Number(pending.totalItems)
      : Number(pending.quantity || 0) * Number(pending.packQuantity || 1);

    // Try merge: find existing approved record for same medicine + invoice
    let mergedDoc = null;
    try {
      if (pending.medicine && pending.invoiceNumber) {
        const approvedExisting = await AddStock.findOne({
          medicine: pending.medicine._id || pending.medicine,
          invoiceNumber: pending.invoiceNumber,
          status: 'approved'
        }).populate('medicine supplier');

        if (approvedExisting) {
          // Merge units and recompute quantity from packQuantity
          const currentApprovedUnits = approvedExisting.totalItems != null
            ? Number(approvedExisting.totalItems)
            : Number(approvedExisting.quantity || 0) * Number(approvedExisting.packQuantity || 1);
          const newApprovedUnits = currentApprovedUnits + pendingTotalItems;

          approvedExisting.totalItems = newApprovedUnits;
          // Prefer most recent pricing/expiry/supplier if provided on pending
          if (Number.isFinite(pending.packQuantity)) approvedExisting.packQuantity = pending.packQuantity;
          if (Number.isFinite(pending.buyPricePerPack)) approvedExisting.buyPricePerPack = pending.buyPricePerPack;
          if (pending.salePricePerPack != null) approvedExisting.salePricePerPack = pending.salePricePerPack;
          if (pending.unitBuyPrice != null) approvedExisting.unitBuyPrice = pending.unitBuyPrice;
          if (pending.unitSalePrice != null) approvedExisting.unitSalePrice = pending.unitSalePrice;
          if (pending.profitPerUnit != null) approvedExisting.profitPerUnit = pending.profitPerUnit;
          if (pending.expiryDate) approvedExisting.expiryDate = pending.expiryDate;
          if (pending.minStock != null) approvedExisting.minStock = pending.minStock;
          if (pending.category != null) approvedExisting.category = pending.category;
          if (pending.supplier) approvedExisting.supplier = pending.supplier._id || pending.supplier;
          approvedExisting.unitPrice = approvedExisting.unitBuyPrice; // legacy

          const pq = Number(approvedExisting.packQuantity || 0);
          approvedExisting.quantity = pq > 0 ? Math.floor(newApprovedUnits / pq) : newApprovedUnits;
          await approvedExisting.save();

          // Increment Inventory by pending units only
          try {
            await Inventory.findOneAndUpdate(
              { name: approvedExisting.medicine.name },
              {
                $inc: { stock: pendingTotalItems },
                $set: {
                  price: approvedExisting.unitSalePrice ?? 0,
                  expiryDate: approvedExisting.expiryDate,
                  supplierId: approvedExisting.supplier?._id || approvedExisting.supplier,
                  invoiceNumber: approvedExisting.invoiceNumber
                },
                $setOnInsert: {
                  category: approvedExisting.category || approvedExisting.medicine.category || ''
                }
              },
              { upsert: true, new: true }
            );
          } catch (err) {
            console.error('Inventory update failed on merge approve:', err?.message || err);
          }

          // Mark purchases linked to pending as approved and roll into supplier totals
          try {
            const related = await Purchase.find({ addStockId: id });
            const toApproveIds = related.filter(r => r.status !== 'approved').map(r => r._id);
            const approveAmount = related.filter(r => r.status !== 'approved').reduce((s, r) => s + (Number(r.totalPurchaseAmount) || 0), 0);
            if (toApproveIds.length > 0) {
              await Purchase.updateMany({ _id: { $in: toApproveIds } }, { status: 'approved', purchaseDate: pending.date || new Date() });
              if (approvedExisting.supplier) {
                await Supplier.findByIdAndUpdate(approvedExisting.supplier._id || approvedExisting.supplier, {
                  $inc: { totalPurchases: approveAmount },
                  $push: {
                    purchases: {
                      date: pending.date || new Date(),
                      amount: approveAmount,
                      items: pendingTotalItems,
                      invoice: approvedExisting.invoiceNumber || ''
                    }
                  },
                  lastOrder: new Date()
                });
              }
            }
          } catch (err) {
            console.error('Failed to approve purchases on merge:', err?.message || err);
          }

          // Remove the pending record after merge
          await AddStock.findByIdAndDelete(id);
          mergedDoc = await AddStock.findById(approvedExisting._id).populate('medicine supplier');
          return res.json(mergedDoc);
        }
      }
    } catch (err) {
      // If merge fails, fall back to approve in place below
    }

    // Fallback: approve in place (no existing approved record to merge)
    pending.status = 'approved';
    await pending.save();

    try {
      const { medicine, unitSalePrice, expiryDate, supplier, category, invoiceNumber } = pending;
      if (medicine) {
        await Inventory.findOneAndUpdate(
          { name: medicine.name },
          {
            $inc: { stock: pendingTotalItems },
            $set: {
              price: pending.unitSalePrice ?? unitSalePrice ?? 0,
              expiryDate,
              supplierId: supplier ? (supplier._id || supplier) : undefined,
              invoiceNumber
            },
            $setOnInsert: { category: category || medicine.category || '' }
          },
          { upsert: true, new: true }
        );
      }
    } catch (err) {
      console.error('Failed to update Inventory stock on approval:', err.message);
    }

    try {
      const related = await Purchase.find({ addStockId: id });
      if (related && related.length > 0) {
        const toApproveIds = related.filter(r => r.status !== 'approved').map(r => r._id);
        const totalApproveAmount = related
          .filter(r => r.status !== 'approved')
          .reduce((s, r) => s + (Number(r.totalPurchaseAmount) || 0), 0);
        if (toApproveIds.length > 0) {
          await Purchase.updateMany({ _id: { $in: toApproveIds } }, { status: 'approved', purchaseDate: pending.date || new Date() });
          if (pending.supplier) {
            await Supplier.findByIdAndUpdate(pending.supplier._id || pending.supplier, {
              $inc: { totalPurchases: totalApproveAmount },
              $push: {
                purchases: {
                  date: pending.date || new Date(),
                  amount: totalApproveAmount,
                  items: pendingTotalItems,
                  invoice: pending.invoiceNumber || ''
                }
              },
              lastOrder: new Date()
            });
          }
        }
      }
    } catch (err) {
      console.error('Failed to approve related purchases or update supplier:', err.message);
    }

    const resultDoc = await AddStock.findById(id).populate('medicine supplier');
    res.json(resultDoc);
  } catch (error) {
    res.status(500).json({ error: 'Failed to approve record', details: error.message });
  }
});

// PATCH /api/add-stock/:id/reject - mark pending record as rejected and related purchases as rejected
router.patch('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const pending = await AddStock.findById(id).populate('medicine supplier');
    if (!pending) return res.status(404).json({ error: 'Record not found' });
    if (pending.status === 'approved') {
      return res.status(400).json({ error: 'Cannot reject an already approved record' });
    }
    pending.status = 'rejected';
    await pending.save();
    try {
      await Purchase.updateMany({ addStockId: id }, { status: 'rejected' });
    } catch (err) {
      console.error('Failed to reject related purchases:', err.message);
    }
    const resultDoc = await AddStock.findById(id).populate('medicine supplier');
    res.json(resultDoc);
  } catch (error) {
    res.status(500).json({ error: 'Failed to reject record', details: error.message });
  }
});

// PATCH /api/add-stock/:id/items - Adjust totalItems (units) without changing packs
router.patch('/:id/items', async (req, res) => {
  try {
    const { id } = req.params;
    const { change } = req.body;
    if (typeof change !== 'number') {
      return res.status(400).json({ error: 'change must be a number' });
    }
    const record = await AddStock.findById(id);
    if (!record) return res.status(404).json({ error: 'Record not found' });

    const newTotal = (record.totalItems || (record.quantity * record.packQuantity)) + change;
    if (newTotal < 0) {
      return res.status(400).json({ error: 'Resulting totalItems cannot be negative' });
    }

    record.totalItems = newTotal;
    await record.save();

    res.json(record);
  } catch (error) {
    res.status(500).json({ error: 'Failed to adjust items', details: error.message });
  }
});

// PUT /api/add-stock/:id - Update a stock record
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const existing = await AddStock.findById(id).populate('medicine');
    if (!existing) return res.status(404).json({ error: 'Stock record not found' });

    // Compute previous units for delta
    const prevTotal = existing.totalItems != null
      ? Number(existing.totalItems)
      : Number(existing.quantity || 0) * Number(existing.packQuantity || 1);

    // Resolve incoming values with fallbacks to existing
    const quantity = body.quantity != null ? Number(body.quantity) : Number(existing.quantity || 0);
    const packQuantity = body.packQuantity != null ? Number(body.packQuantity) : Number(existing.packQuantity || 1);
    const buyPricePerPack = body.buyPricePerPack != null ? Number(body.buyPricePerPack) : Number(existing.buyPricePerPack || 0);
    const salePricePerPack = body.salePricePerPack != null ? Number(body.salePricePerPack) : (existing.salePricePerPack != null ? Number(existing.salePricePerPack) : undefined);

    const totalItems = body.totalItems != null ? Number(body.totalItems) : (quantity * packQuantity);
    const unitBuyPrice = (packQuantity > 0 && Number.isFinite(buyPricePerPack)) ? (buyPricePerPack / packQuantity) : (existing.unitBuyPrice || undefined);
    const unitSalePrice = (packQuantity > 0 && salePricePerPack != null && Number.isFinite(salePricePerPack))
      ? (salePricePerPack / packQuantity)
      : (body.unitSalePrice != null ? Number(body.unitSalePrice) : existing.unitSalePrice);
    const profitPerUnit = (unitSalePrice != null && unitBuyPrice != null) ? (unitSalePrice - unitBuyPrice) : existing.profitPerUnit;

    const update = {
      ...body,
      quantity,
      packQuantity,
      buyPricePerPack,
      salePricePerPack,
      totalItems,
      unitBuyPrice,
      unitSalePrice,
      profitPerUnit,
      unitPrice: unitBuyPrice // legacy
    };

    const updated = await AddStock.findByIdAndUpdate(id, update, { new: true }).populate('medicine supplier');

    // Adjust Inventory by delta if approved
    try {
      if (updated && updated.status === 'approved' && updated.medicine?.name) {
        const deltaUnits = totalItems - prevTotal;
        if (Number.isFinite(deltaUnits) && deltaUnits !== 0) {
          await Inventory.findOneAndUpdate(
            { name: updated.medicine.name },
            {
              $inc: { stock: deltaUnits },
              $set: {
                price: updated.unitSalePrice ?? 0,
                expiryDate: updated.expiryDate,
                supplierId: updated.supplier?._id || updated.supplier,
                invoiceNumber: updated.invoiceNumber
              }
            },
            { upsert: true, new: true }
          );
        }
      }
    } catch (err) {
      console.error('Inventory adjustment failed on PUT:', err?.message || err);
    }

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update stock record', details: error.message });
  }
});

// DELETE /api/add-stock/:id - Delete a stock record
// Business rule: Do NOT alter Purchase history; only adjust Inventory if this record was approved.
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    // Load full record to compute impact and find medicine name
    const doc = await AddStock.findById(id).populate('medicine');
    if (!doc) return res.status(404).json({ error: 'Stock record not found' });

    let inventoryAdjusted = false;
    let unitsRemoved = 0;
    try {
      if (doc.status === 'approved' && doc.medicine && doc.medicine.name) {
        // Compute units contributed by this record
        unitsRemoved = doc.totalItems != null
          ? Number(doc.totalItems)
          : (Number(doc.quantity || 0) * Number(doc.packQuantity || 1));
        if (Number.isFinite(unitsRemoved) && unitsRemoved > 0) {
          await Inventory.findOneAndUpdate(
            { name: doc.medicine.name },
            { $inc: { stock: -unitsRemoved } },
            { new: true }
          );
          inventoryAdjusted = true;
        }
      }
    } catch (err) {
      // Log but continue with delete; UI can reconcile later
      console.error('Failed to adjust Inventory on delete:', err?.message || err);
    }

    await AddStock.findByIdAndDelete(id);

    res.json({
      message: 'Stock record deleted',
      inventoryAdjusted,
      unitsRemoved
      // Purchase history intentionally untouched
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete stock record', details: error.message });
  }
});

// BULK IMPORT CSV/Excel converted JSON
router.post('/bulk', async (req, res) => {
  try {
    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items array required' });
    }

    const inserted = [];

    let skipped = 0;
  for (const row of items) {
      // Support various header casings from CSV (e.g. exported file)
      const medicineName = row.medicine || row.Medicine || row['Medicine Name'] || row['medicine name'] || row.name || row.Name;
      const quantityVal = row.quantity || row.Quantity || row.stock || row.Stock;
      const unitPriceVal = row.unitPrice || row.UnitPrice || row['Unit Price'];
      let supplierName = row.supplier || row.Supplier || row['Supplier Name'];
      if (!supplierName || supplierName.trim() === '') {
        supplierName = 'Unknown Supplier';
      }
      const expiryDate = row.expiryDate || row.ExpiryDate || row['Expiry Date'] || row.expiry;
      const minStock = row.minStock || row.MinStock || row['Min Stock'] || row.min;

      // Ensure required
      if (!medicineName || !quantityVal || !unitPriceVal || !supplierName) {
        skipped++;
        continue; // skip invalid rows
      }

      // Find or create medicine
      let med = await Medicine.findOne({ name: medicineName.trim() });
      if (!med) {
        med = new Medicine({ name: medicineName.trim() });
        await med.save();
      }

      // Find or create supplier
      let sup = await Supplier.findOne({ name: supplierName.trim() });
      if (!sup) {
        sup = new Supplier({ name: supplierName.trim() });
        await sup.save();
      }

      const addStock = new AddStock({
        medicine: med._id,
        quantity: parseInt(quantityVal, 10) || 0,
        unitPrice: parseFloat(unitPriceVal) || 0,
        supplier: sup._id,
        expiryDate: expiryDate ? new Date(expiryDate) : undefined,
        minStock: minStock ? parseInt(minStock, 10) : undefined,
      });
      await addStock.save();
      inserted.push(addStock);
    }

    res.json({ inserted: inserted.length, skipped });
  } catch (error) {
    res.status(500).json({ error: 'Bulk import failed', details: error.message });
  }
});

// EXPORT to CSV
router.get('/export', async (_req, res) => {
  try {
    const records = await AddStock.find().populate('medicine supplier');

    let csv = 'Medicine,Quantity,UnitPrice,Supplier,ExpiryDate,MinStock\n';
    records.forEach(r => {
      csv += `${r.medicine.name},${r.quantity},${r.unitPrice},${r.supplier.name},${r.expiryDate ? new Date(r.expiryDate).toISOString().split('T')[0] : ''},${r.minStock || ''}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="addstock_export.csv"');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: 'Export failed', details: error.message });
  }
});

// POST /api/add-stock/consolidate - Admin utility to merge approved duplicates per medicine
// Idempotent: combines multiple approved AddStock records for the same medicine into one by summing totalItems.
// Does NOT modify Inventory as approvals would have already adjusted stock.
router.post('/consolidate', async (_req, res) => {
  try {
    const approved = await AddStock.find({ status: 'approved' }).populate('medicine');
    // Group by medicine id
    const byMed = new Map();
    for (const rec of approved) {
      const key = String(rec.medicine?._id || rec.medicine);
      if (!byMed.has(key)) byMed.set(key, []);
      byMed.get(key).push(rec);
    }

    const result = [];
    for (const [medId, list] of byMed.entries()) {
      if (list.length <= 1) continue; // nothing to consolidate
      // Choose the first as the survivor (could pick the most recent)
      const survivor = list[0];
      const duplicates = list.slice(1);
      const sumApprovedTotals = list.reduce((sum, doc) => {
        const t = doc.totalItems != null
          ? Number(doc.totalItems)
          : Number(doc.quantity || 0) * Number(doc.packQuantity || 1);
        return sum + (isNaN(t) ? 0 : t);
      }, 0);
      // Update survivor
      survivor.totalItems = sumApprovedTotals;
      const pq = Number(survivor.packQuantity || 0);
      survivor.quantity = pq > 0 ? Math.floor(sumApprovedTotals / pq) : sumApprovedTotals;
      survivor.status = 'approved';
      await survivor.save();
      // Delete duplicates
      await AddStock.deleteMany({ _id: { $in: duplicates.map(d => d._id) } });
      result.push({ medicine: medId, kept: survivor._id, removed: duplicates.map(d => d._id), totalItems: survivor.totalItems });
    }

    res.json({ consolidated: result.length, details: result });
  } catch (error) {
    res.status(500).json({ error: 'Consolidation failed', details: error.message });
  }
});

module.exports = router;
