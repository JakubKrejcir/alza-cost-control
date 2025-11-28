const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// GET all price configs
router.get('/', async (req, res) => {
  try {
    const { carrierId, type, active } = req.query;
    
    const where = {};
    if (carrierId) where.carrierId = parseInt(carrierId);
    if (type) where.type = type;
    if (active === 'true') where.isActive = true;
    
    const priceConfigs = await prisma.priceConfig.findMany({
      where,
      include: {
        carrier: { select: { id: true, name: true } },
        contract: { select: { id: true, number: true } },
        fixRates: true,
        kmRates: true,
        depoRates: true,
        linehaulRates: true,
        bonusRates: { orderBy: { qualityMin: 'desc' } }
      },
      orderBy: { validFrom: 'desc' }
    });
    
    res.json(priceConfigs);
  } catch (error) {
    console.error('Error fetching price configs:', error);
    res.status(500).json({ error: 'Failed to fetch price configs' });
  }
});

// GET active price config for carrier and type at given date
router.get('/active', async (req, res) => {
  try {
    const { carrierId, type, date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    
    const priceConfig = await prisma.priceConfig.findFirst({
      where: {
        carrierId: parseInt(carrierId),
        type,
        isActive: true,
        validFrom: { lte: targetDate },
        OR: [
          { validTo: null },
          { validTo: { gte: targetDate } }
        ]
      },
      include: {
        fixRates: true,
        kmRates: true,
        depoRates: true,
        linehaulRates: true,
        bonusRates: { orderBy: { qualityMin: 'desc' } }
      },
      orderBy: { validFrom: 'desc' }
    });
    
    if (!priceConfig) {
      return res.status(404).json({ error: 'No active price config found' });
    }
    
    res.json(priceConfig);
  } catch (error) {
    console.error('Error fetching active price config:', error);
    res.status(500).json({ error: 'Failed to fetch active price config' });
  }
});

// GET single price config
router.get('/:id', async (req, res) => {
  try {
    const priceConfig = await prisma.priceConfig.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        carrier: true,
        contract: true,
        fixRates: true,
        kmRates: true,
        depoRates: true,
        linehaulRates: true,
        bonusRates: { orderBy: { qualityMin: 'desc' } }
      }
    });
    
    if (!priceConfig) {
      return res.status(404).json({ error: 'Price config not found' });
    }
    
    res.json(priceConfig);
  } catch (error) {
    console.error('Error fetching price config:', error);
    res.status(500).json({ error: 'Failed to fetch price config' });
  }
});

// POST create price config with all rates
router.post('/', async (req, res) => {
  try {
    const {
      carrierId,
      contractId,
      type,
      validFrom,
      validTo,
      fixRates,
      kmRates,
      depoRates,
      linehaulRates,
      bonusRates
    } = req.body;
    
    const priceConfig = await prisma.priceConfig.create({
      data: {
        carrierId,
        contractId,
        type,
        validFrom: new Date(validFrom),
        validTo: validTo ? new Date(validTo) : null,
        fixRates: fixRates ? { create: fixRates } : undefined,
        kmRates: kmRates ? { create: kmRates } : undefined,
        depoRates: depoRates ? { create: depoRates } : undefined,
        linehaulRates: linehaulRates ? { create: linehaulRates } : undefined,
        bonusRates: bonusRates ? { create: bonusRates } : undefined
      },
      include: {
        fixRates: true,
        kmRates: true,
        depoRates: true,
        linehaulRates: true,
        bonusRates: true
      }
    });
    
    res.status(201).json(priceConfig);
  } catch (error) {
    console.error('Error creating price config:', error);
    res.status(500).json({ error: 'Failed to create price config' });
  }
});

// PUT update price config
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const {
      type,
      validFrom,
      validTo,
      isActive,
      fixRates,
      kmRates,
      depoRates,
      linehaulRates,
      bonusRates
    } = req.body;
    
    // Update main config
    const priceConfig = await prisma.priceConfig.update({
      where: { id },
      data: {
        type,
        validFrom: validFrom ? new Date(validFrom) : undefined,
        validTo: validTo ? new Date(validTo) : undefined,
        isActive
      }
    });
    
    // Update rates if provided (delete and recreate)
    if (fixRates) {
      await prisma.fixRate.deleteMany({ where: { priceConfigId: id } });
      await prisma.fixRate.createMany({ data: fixRates.map(r => ({ ...r, priceConfigId: id })) });
    }
    
    if (kmRates) {
      await prisma.kmRate.deleteMany({ where: { priceConfigId: id } });
      await prisma.kmRate.createMany({ data: kmRates.map(r => ({ ...r, priceConfigId: id })) });
    }
    
    if (depoRates) {
      await prisma.depoRate.deleteMany({ where: { priceConfigId: id } });
      await prisma.depoRate.createMany({ data: depoRates.map(r => ({ ...r, priceConfigId: id })) });
    }
    
    if (linehaulRates) {
      await prisma.linehaulRate.deleteMany({ where: { priceConfigId: id } });
      await prisma.linehaulRate.createMany({ data: linehaulRates.map(r => ({ ...r, priceConfigId: id })) });
    }
    
    if (bonusRates) {
      await prisma.bonusRate.deleteMany({ where: { priceConfigId: id } });
      await prisma.bonusRate.createMany({ data: bonusRates.map(r => ({ ...r, priceConfigId: id })) });
    }
    
    // Fetch updated config with all relations
    const updated = await prisma.priceConfig.findUnique({
      where: { id },
      include: {
        fixRates: true,
        kmRates: true,
        depoRates: true,
        linehaulRates: true,
        bonusRates: true
      }
    });
    
    res.json(updated);
  } catch (error) {
    console.error('Error updating price config:', error);
    res.status(500).json({ error: 'Failed to update price config' });
  }
});

// DELETE price config
router.delete('/:id', async (req, res) => {
  try {
    await prisma.priceConfig.delete({
      where: { id: parseInt(req.params.id) }
    });
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting price config:', error);
    res.status(500).json({ error: 'Failed to delete price config' });
  }
});

module.exports = router;
