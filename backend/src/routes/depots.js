const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// GET all depots
router.get('/', async (req, res) => {
  try {
    const { carrierId } = req.query;
    
    const depots = await prisma.depot.findMany({
      where: carrierId ? { carrierId: parseInt(carrierId) } : undefined,
      include: {
        carrier: {
          select: { id: true, name: true }
        }
      },
      orderBy: [{ carrierId: 'asc' }, { name: 'asc' }]
    });
    
    res.json(depots);
  } catch (error) {
    console.error('Error fetching depots:', error);
    res.status(500).json({ error: 'Failed to fetch depots' });
  }
});

// GET single depot
router.get('/:id', async (req, res) => {
  try {
    const depot = await prisma.depot.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        carrier: true,
        linehaulFrom: true,
        linehaulTo: true
      }
    });
    
    if (!depot) {
      return res.status(404).json({ error: 'Depot not found' });
    }
    
    res.json(depot);
  } catch (error) {
    console.error('Error fetching depot:', error);
    res.status(500).json({ error: 'Failed to fetch depot' });
  }
});

// POST create depot
router.post('/', async (req, res) => {
  try {
    const { carrierId, name, code, type, address } = req.body;
    
    const depot = await prisma.depot.create({
      data: { carrierId, name, code, type, address }
    });
    
    res.status(201).json(depot);
  } catch (error) {
    console.error('Error creating depot:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'Depot with this name already exists for this carrier' });
    }
    res.status(500).json({ error: 'Failed to create depot' });
  }
});

// PUT update depot
router.put('/:id', async (req, res) => {
  try {
    const { name, code, type, address } = req.body;
    
    const depot = await prisma.depot.update({
      where: { id: parseInt(req.params.id) },
      data: { name, code, type, address }
    });
    
    res.json(depot);
  } catch (error) {
    console.error('Error updating depot:', error);
    res.status(500).json({ error: 'Failed to update depot' });
  }
});

// DELETE depot
router.delete('/:id', async (req, res) => {
  try {
    await prisma.depot.delete({
      where: { id: parseInt(req.params.id) }
    });
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting depot:', error);
    res.status(500).json({ error: 'Failed to delete depot' });
  }
});

module.exports = router;
