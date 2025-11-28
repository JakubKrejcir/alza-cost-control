const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// GET all contracts
router.get('/', async (req, res) => {
  try {
    const { carrierId } = req.query;
    
    const contracts = await prisma.contract.findMany({
      where: carrierId ? { carrierId: parseInt(carrierId) } : undefined,
      include: {
        carrier: {
          select: { id: true, name: true }
        },
        _count: {
          select: { priceConfigs: true }
        }
      },
      orderBy: { validFrom: 'desc' }
    });
    
    res.json(contracts);
  } catch (error) {
    console.error('Error fetching contracts:', error);
    res.status(500).json({ error: 'Failed to fetch contracts' });
  }
});

// GET single contract with price configs
router.get('/:id', async (req, res) => {
  try {
    const contract = await prisma.contract.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        carrier: true,
        priceConfigs: {
          include: {
            fixRates: true,
            kmRates: true,
            depoRates: true,
            linehaulRates: true,
            bonusRates: true
          }
        }
      }
    });
    
    if (!contract) {
      return res.status(404).json({ error: 'Contract not found' });
    }
    
    res.json(contract);
  } catch (error) {
    console.error('Error fetching contract:', error);
    res.status(500).json({ error: 'Failed to fetch contract' });
  }
});

// POST create contract
router.post('/', async (req, res) => {
  try {
    const { carrierId, number, type, validFrom, validTo, documentUrl, notes } = req.body;
    
    const contract = await prisma.contract.create({
      data: {
        carrierId,
        number,
        type,
        validFrom: new Date(validFrom),
        validTo: validTo ? new Date(validTo) : null,
        documentUrl,
        notes
      }
    });
    
    res.status(201).json(contract);
  } catch (error) {
    console.error('Error creating contract:', error);
    res.status(500).json({ error: 'Failed to create contract' });
  }
});

// PUT update contract
router.put('/:id', async (req, res) => {
  try {
    const { number, type, validFrom, validTo, documentUrl, notes } = req.body;
    
    const contract = await prisma.contract.update({
      where: { id: parseInt(req.params.id) },
      data: {
        number,
        type,
        validFrom: new Date(validFrom),
        validTo: validTo ? new Date(validTo) : null,
        documentUrl,
        notes
      }
    });
    
    res.json(contract);
  } catch (error) {
    console.error('Error updating contract:', error);
    res.status(500).json({ error: 'Failed to update contract' });
  }
});

// DELETE contract
router.delete('/:id', async (req, res) => {
  try {
    await prisma.contract.delete({
      where: { id: parseInt(req.params.id) }
    });
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting contract:', error);
    res.status(500).json({ error: 'Failed to delete contract' });
  }
});

module.exports = router;
