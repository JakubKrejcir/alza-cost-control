const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// GET all carriers
router.get('/', async (req, res) => {
  try {
    const carriers = await prisma.carrier.findMany({
      include: {
        depots: true,
        _count: {
          select: {
            proofs: true,
            invoices: true,
            contracts: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });
    res.json(carriers);
  } catch (error) {
    console.error('Error fetching carriers:', error);
    res.status(500).json({ error: 'Failed to fetch carriers' });
  }
});

// GET single carrier
router.get('/:id', async (req, res) => {
  try {
    const carrier = await prisma.carrier.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        depots: true,
        contracts: {
          orderBy: { validFrom: 'desc' }
        },
        priceConfigs: {
          where: { isActive: true },
          orderBy: { validFrom: 'desc' }
        }
      }
    });
    
    if (!carrier) {
      return res.status(404).json({ error: 'Carrier not found' });
    }
    
    res.json(carrier);
  } catch (error) {
    console.error('Error fetching carrier:', error);
    res.status(500).json({ error: 'Failed to fetch carrier' });
  }
});

// POST create carrier
router.post('/', async (req, res) => {
  try {
    const { name, ico, dic, address, contact } = req.body;
    
    const carrier = await prisma.carrier.create({
      data: { name, ico, dic, address, contact }
    });
    
    res.status(201).json(carrier);
  } catch (error) {
    console.error('Error creating carrier:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Carrier with this name or ICO already exists' });
    }
    res.status(500).json({ error: 'Failed to create carrier' });
  }
});

// PUT update carrier
router.put('/:id', async (req, res) => {
  try {
    const { name, ico, dic, address, contact } = req.body;
    
    const carrier = await prisma.carrier.update({
      where: { id: parseInt(req.params.id) },
      data: { name, ico, dic, address, contact }
    });
    
    res.json(carrier);
  } catch (error) {
    console.error('Error updating carrier:', error);
    res.status(500).json({ error: 'Failed to update carrier' });
  }
});

// DELETE carrier
router.delete('/:id', async (req, res) => {
  try {
    await prisma.carrier.delete({
      where: { id: parseInt(req.params.id) }
    });
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting carrier:', error);
    res.status(500).json({ error: 'Failed to delete carrier' });
  }
});

module.exports = router;
