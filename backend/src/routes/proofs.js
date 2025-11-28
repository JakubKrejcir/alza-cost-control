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
    
    // Parse proof data from Sumar sheet
    const proofData = parseProofFromSumar(sumarSheet);
    
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
function parseProofFromSumar(sheet) {
  const result = {
    totals: {
      totalFix: null,
      totalKm: null,
      totalLinehaul: null,
      totalDepo: null,
      totalPenalty: null,
      grandTotal: null
    },
    routeDetails: [],
    linehaulDetails: [],
    depoDetails: []
  };
  
  // Helper to get cell value (handles formulas by getting calculated value)
  const getCellValue = (cellRef) => {
    const cell = sheet[cellRef];
    if (!cell) return null;
    // Return the value (v) or the calculated result (w for formatted, v for raw)
    return cell.v !== undefined ? cell.v : null;
  };
  
  // Helper to find row by label in column B
  const findRowByLabel = (label) => {
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:Z100');
    for (let row = range.s.r; row <= range.e.r; row++) {
      const cellB = sheet[XLSX.utils.encode_cell({ r: row, c: 1 })]; // Column B
      if (cellB && cellB.v && String(cellB.v).includes(label)) {
        return row;
      }
    }
    return null;
  };
  
  // Helper to get value from column D of a found row
  const getValueByLabel = (label) => {
    const row = findRowByLabel(label);
    if (row === null) return null;
    const cell = sheet[XLSX.utils.encode_cell({ r: row, c: 3 })]; // Column D
    return cell ? cell.v : null;
  };
  
  // Parse totals
  result.totals.totalFix = getValueByLabel('Cena FIX');
  result.totals.totalKm = getValueByLabel('Cena KM');
  result.totals.totalLinehaul = getValueByLabel('Linehaul');
  result.totals.totalDepo = getValueByLabel('DEPO');
  result.totals.totalPenalty = getValueByLabel('Pokuty');
  result.totals.grandTotal = getValueByLabel('Celková částka');
  
  // Parse route details
  const routeTypes = [
    { label: 'Počet tras LastMile při DR', type: 'DR', rateLabel: 'Cena DR' },
    { label: 'Počet tras LastMile při DPO LH', type: 'LH_DPO', rateLabel: 'Cena LastMile při LH DPO' },
    { label: 'Počet tras SD LH', type: 'LH_SD', rateLabel: 'Cena LastMile při LH SD' },
    { label: 'Počet tras SD LH spojene', type: 'LH_SD_SPOJENE', rateLabel: 'Cena LastMile při LH SD spojené' }
  ];
  
  routeTypes.forEach(rt => {
    const count = getValueByLabel(rt.label);
    const rate = getValueByLabel(rt.rateLabel);
    
    if (count && count > 0) {
      const rateVal = rate || 0;
      result.routeDetails.push({
        routeType: rt.type,
        count: parseInt(count),
        rate: parseFloat(rateVal),
        amount: parseInt(count) * parseFloat(rateVal)
      });
    }
  });
  
  // Parse linehaul details from rows 27-45 (column H=description, I=count)
  const linehaulRows = [
    { row: 27, fromCode: 'CZLC4', desc: '2x Kamion dpo', toCode: 'Vratimov' },
    { row: 28, fromCode: 'CZLC4', desc: '1x Kamion dpo', toCode: 'Vratimov' },
    { row: 29, fromCode: 'CZLC4', desc: '1x Dodavka 6 300', toCode: 'Vratimov' },
    { row: 30, fromCode: 'CZLC4', desc: '2x Dodavka SD', toCode: 'Vratimov' },
    { row: 31, fromCode: 'CZLC4', desc: '1x Kamion SD', toCode: 'Vratimov' },
    { row: 32, fromCode: 'CZLC4', desc: '3x Dodavka SD', toCode: 'Vratimov' },
    { row: 33, fromCode: 'CZLC4', desc: '1x Kamion SD', toCode: 'Vratimov' },
    { row: 34, fromCode: 'CZTC1', desc: '1x Solo bez vik', toCode: 'Vratimov' },
    { row: 35, fromCode: 'CZTC1', desc: '5x Dodavka 6 300', toCode: 'Vratimov' },
    { row: 36, fromCode: '', desc: 'Vratky', toCode: 'Vratimov' },
    { row: 37, fromCode: 'CZLC4', desc: '3x kamion DPO', toCode: 'Nový Bydžov' },
    { row: 38, fromCode: 'CZLC4', desc: '1x kamion DPO', toCode: 'Nový Bydžov' },
    { row: 39, fromCode: 'CZLC4', desc: '1x kamion DPO', toCode: 'Nový Bydžov' },
    { row: 40, fromCode: 'CZLC4', desc: '1x kamion SD', toCode: 'Nový Bydžov' },
    { row: 41, fromCode: 'CZTC1', desc: '1x Kamion', toCode: 'Nový Bydžov' }
  ];
  
  linehaulRows.forEach(lh => {
    const daysCell = sheet[XLSX.utils.encode_cell({ r: lh.row - 1, c: 8 })]; // Column I (index 8)
    const days = daysCell ? daysCell.v : null;
    
    if (days && days > 0) {
      // Get rate from linehaul price table
      let rate = 0;
      const descLower = lh.desc.toLowerCase();
      if (descLower.includes('kamion')) {
        if (lh.toCode === 'Vratimov') {
          rate = lh.fromCode === 'CZLC4' ? 24180 : 22000;
        } else {
          rate = lh.fromCode === 'CZLC4' ? 9950 : 9500;
        }
      } else if (descLower.includes('solo')) {
        if (lh.toCode === 'Vratimov') {
          rate = lh.fromCode === 'CZLC4' ? 16500 : 14800;
        } else {
          rate = lh.fromCode === 'CZLC4' ? 7750 : 7500;
        }
      } else if (descLower.includes('dodavka 6')) {
        rate = lh.toCode === 'Vratimov' ? 6300 : 6300;
      } else if (descLower.includes('dodavka')) {
        if (lh.toCode === 'Vratimov') {
          rate = lh.fromCode === 'CZLC4' ? 10100 : 9100;
        } else {
          rate = lh.fromCode === 'CZLC4' ? 5250 : 5000;
        }
      } else if (descLower.includes('vratky')) {
        rate = 3700;
      }
      
      result.linehaulDetails.push({
        description: `${lh.fromCode} ${lh.desc}`.trim(),
        fromCode: lh.fromCode || null,
        toCode: lh.toCode,
        vehicleType: descLower.includes('kamion') ? 'kamion' : 
                     descLower.includes('solo') ? 'solo' : 
                     descLower.includes('dodavka') ? 'dodavka' : 'other',
        days: parseInt(days),
        rate: rate,
        total: parseInt(days) * rate
      });
    }
  });
  
  // Parse DEPO details
  const depoVratimov = getValueByLabel('DEPO Vratimov / Den');
  const depoNBMesiac = getValueByLabel('DEPO Nový Bydžov / Mesiac');
  const skladniciNB = getValueByLabel('3 Skladníci Nový Bydžov / Mesiac');
  const daysWorked = getValueByLabel('Odježděných dní');
  
  if (depoVratimov && daysWorked) {
    result.depoDetails.push({
      depoName: 'Vratimov',
      rateType: 'daily',
      days: parseInt(daysWorked),
      rate: parseFloat(depoVratimov),
      amount: parseInt(daysWorked) * parseFloat(depoVratimov)
    });
  }
  
  if (depoNBMesiac) {
    result.depoDetails.push({
      depoName: 'Nový Bydžov',
      rateType: 'monthly',
      days: 1,
      rate: parseFloat(depoNBMesiac),
      amount: parseFloat(depoNBMesiac)
    });
  }
  
  if (skladniciNB) {
    result.depoDetails.push({
      depoName: 'Nový Bydžov - Skladníci',
      rateType: 'monthly',
      days: 1,
      rate: parseFloat(skladniciNB),
      amount: parseFloat(skladniciNB)
    });
  }
  
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
