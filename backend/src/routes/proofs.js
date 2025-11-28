const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() });

// GET all proofs
router.get('/', async (req, res) => {
  try {
    const { carrierId, period, status } = req.query;
    
    const where = {};
    if (carrierId) where.carrierId = parseInt(carrierId);
    if (period) where.period = period;
    if (status) where.status = status;
    
    const proofs = await prisma.proof.findMany({
      where,
      include: {
        carrier: { select: { id: true, name: true } },
        depot: { select: { id: true, name: true } },
        _count: {
          select: { invoices: true, analyses: true }
        }
      },
      orderBy: { periodDate: 'desc' }
    });
    
    res.json(proofs);
  } catch (error) {
    console.error('Error fetching proofs:', error);
    res.status(500).json({ error: 'Failed to fetch proofs' });
  }
});

// GET single proof with all details
router.get('/:id', async (req, res) => {
  try {
    const proof = await prisma.proof.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        carrier: true,
        depot: true,
        routeDetails: true,
        linehaulDetails: true,
        depoDetails: true,
        invoices: {
          include: { items: true }
        },
        analyses: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });
    
    if (!proof) {
      return res.status(404).json({ error: 'Proof not found' });
    }
    
    res.json(proof);
  } catch (error) {
    console.error('Error fetching proof:', error);
    res.status(500).json({ error: 'Failed to fetch proof' });
  }
});

// POST upload and parse proof XLSX
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const { carrierId, period } = req.body;
    
    if (!carrierId || !period) {
      return res.status(400).json({ error: 'carrierId and period are required' });
    }
    
    // Parse XLSX
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sumarSheet = workbook.Sheets['Sumar'];
    
    if (!sumarSheet) {
      return res.status(400).json({ error: 'Sheet "Sumar" not found in XLSX' });
    }
    
    const sumarData = XLSX.utils.sheet_to_json(sumarSheet, { header: 1 });
    
    // Parse proof data from Sumar sheet
    const proofData = parseProofFromSumar(sumarData);
    
    // Parse period date
    const [month, year] = period.split('/');
    const periodDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    
// Check for existing proof
const existing = await prisma.proof.findFirst({
  where: { carrierId: parseInt(carrierId), period }
});
    
    if (existing) {
      // Update existing
      const proof = await prisma.proof.update({
        where: { id: existing.id },
        data: {
          fileName: req.file.originalname,
          ...proofData.totals,
          routeDetails: {
            deleteMany: {},
            create: proofData.routeDetails
          },
          linehaulDetails: {
            deleteMany: {},
            create: proofData.linehaulDetails
          },
          depoDetails: {
            deleteMany: {},
            create: proofData.depoDetails
          }
        },
        include: {
          routeDetails: true,
          linehaulDetails: true,
          depoDetails: true
        }
      });
      
      return res.json(proof);
    }
    
    // Create new proof
    const proof = await prisma.proof.create({
      data: {
        carrierId: parseInt(carrierId),
        period,
        periodDate,
        fileName: req.file.originalname,
        ...proofData.totals,
        routeDetails: { create: proofData.routeDetails },
        linehaulDetails: { create: proofData.linehaulDetails },
        depoDetails: { create: proofData.depoDetails }
      },
      include: {
        routeDetails: true,
        linehaulDetails: true,
        depoDetails: true
      }
    });
    
    res.status(201).json(proof);
  } catch (error) {
    console.error('Error uploading proof:', error);
    res.status(500).json({ error: 'Failed to upload proof', details: error.message });
  }
});

// Helper function to parse proof data from Sumar sheet
function parseProofFromSumar(data) {
  const result = {
    totals: {},
    routeDetails: [],
    linehaulDetails: [],
    depoDetails: []
  };
  
  // Find values by label in column B (index 1)
  const findValue = (label) => {
    const row = data.find(r => r[1] && String(r[1]).includes(label));
    return row ? row[3] : null;
  };
  
  // Totals
  result.totals = {
    totalFix: findValue('Cena FIX'),
    totalKm: findValue('Cena KM'),
    totalLinehaul: findValue('Linehaul'),
    totalDepo: findValue('DEPO'),
    totalPenalty: findValue('Pokuty'),
    grandTotal: findValue('Celková částka'),
    totalDepo: findValue('Odježděných dní'),
  };
  
  // Route details
  const routeTypes = [
    { label: 'Počet tras LastMile při DR', type: 'DR', rate: 3200 },
    { label: 'Počet tras LastMile při DPO LH', type: 'LH_DPO', rate: 2500 },
    { label: 'Počet tras SD LH', type: 'LH_SD', rate: 1800 },
    { label: 'Počet tras SD LH spojene', type: 'LH_SD_SPOJENE', rate: 2500 }
  ];
  
  routeTypes.forEach(rt => {
    const count = findValue(rt.label);
    if (count) {
      // Get rate from proof if available
      const rateLabel = rt.type === 'DR' ? 'Cena DR' : 
                        rt.type === 'LH_DPO' ? 'Cena LastMile při LH DPO' :
                        rt.type === 'LH_SD' ? 'Cena LastMile při LH SD' :
                        'Cena LastMile při LH SD spojené';
      const rate = findValue(rateLabel) || rt.rate;
      
      result.routeDetails.push({
        routeType: rt.type,
        count: parseInt(count),
        rate: parseFloat(rate),
        amount: parseInt(count) * parseFloat(rate)
      });
    }
  });
  
  // Calculate total routes
  result.totals.totalRoutes = result.routeDetails.reduce((sum, r) => sum + r.count, 0);
  
  return result;
}

// PUT update proof status
router.put('/:id', async (req, res) => {
  try {
    const { status } = req.body;
    
    const proof = await prisma.proof.update({
      where: { id: parseInt(req.params.id) },
      data: { status }
    });
    
    res.json(proof);
  } catch (error) {
    console.error('Error updating proof:', error);
    res.status(500).json({ error: 'Failed to update proof' });
  }
});

// DELETE proof
router.delete('/:id', async (req, res) => {
  try {
    await prisma.proof.delete({
      where: { id: parseInt(req.params.id) }
    });
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting proof:', error);
    res.status(500).json({ error: 'Failed to delete proof' });
  }
});

module.exports = router;
