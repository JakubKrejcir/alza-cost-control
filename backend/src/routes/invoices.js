const express = require('express');
const multer = require('multer');
const pdf = require('pdf-parse');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();
const upload = multer({ storage: multer.memoryStorage() });

// GET all invoices
router.get('/', async (req, res) => {
  try {
    const { carrierId, period, status, proofId } = req.query;
    
    const where = {};
    if (carrierId) where.carrierId = parseInt(carrierId);
    if (period) where.period = period;
    if (status) where.status = status;
    if (proofId) where.proofId = parseInt(proofId);
    
    const invoices = await prisma.invoice.findMany({
      where,
      include: {
        carrier: { select: { id: true, name: true } },
        proof: { select: { id: true, period: true } },
        items: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    res.json(invoices);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    res.status(500).json({ error: 'Failed to fetch invoices' });
  }
});

// GET single invoice
router.get('/:id', async (req, res) => {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        carrier: true,
        proof: true,
        items: true
      }
    });
    
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    
    res.json(invoice);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    res.status(500).json({ error: 'Failed to fetch invoice' });
  }
});

// POST create invoice manually
router.post('/', async (req, res) => {
  try {
    const {
      carrierId,
      proofId,
      invoiceNumber,
      period,
      issueDate,
      dueDate,
      totalWithoutVat,
      vatAmount,
      totalWithVat,
      items
    } = req.body;
    
    const existing = await prisma.invoice.findFirst({
      where: { carrierId: parseInt(carrierId), invoiceNumber: invoiceNumber }
    });
    
    if (existing) {
      return res.status(400).json({ error: 'Invoice with this number already exists' });
    }
    
    const invoice = await prisma.invoice.create({
      data: {
        carrierId: parseInt(carrierId),
        proofId: proofId ? parseInt(proofId) : null,
        invoiceNumber,
        period,
        issueDate: issueDate ? new Date(issueDate) : null,
        dueDate: dueDate ? new Date(dueDate) : null,
        totalWithoutVat,
        vatAmount,
        totalWithVat,
        items: items ? { create: items } : undefined
      },
      include: { items: true }
    });
    
    res.status(201).json(invoice);
  } catch (error) {
    console.error('Error creating invoice:', error);
    res.status(500).json({ error: 'Failed to create invoice' });
  }
});

// Helper function to parse invoice PDF
async function parseInvoicePdf(buffer) {
  const result = {
    invoiceNumber: null,
    issueDate: null,
    dueDate: null,
    totalWithoutVat: null,
    vatAmount: null,
    totalWithVat: null,
    itemType: null,
    period: null
  };
  
  try {
    const data = await pdf(buffer);
    const text = data.text;
    
    // Extract invoice number (format: 25013229)
    const invoiceNumMatch = text.match(/FAKTURA[^\d]*(\d{8})/i) || 
                           text.match(/č\.\s*(\d{8})/i) ||
                           text.match(/Variabilní symbol:\s*(\d{8})/i);
    if (invoiceNumMatch) {
      result.invoiceNumber = invoiceNumMatch[1];
    }
    
    // Extract dates
    const issueDateMatch = text.match(/Datum vystavení:\s*(\d{1,2}\.\d{1,2}\.\d{4})/i);
    if (issueDateMatch) {
      const [day, month, year] = issueDateMatch[1].split('.');
      result.issueDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    
    const dueDateMatch = text.match(/Datum splatnosti:\s*(\d{1,2}\.\d{1,2}\.\d{4})/i);
    if (dueDateMatch) {
      const [day, month, year] = dueDateMatch[1].split('.');
      result.dueDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    }
    
    // Extract item type and period (e.g., "ALZABOXY FIX - 10/2025" or "KM - 10/2025")
    const itemTypeMatch = text.match(/(ALZABOXY?\s*(?:FIX|KM)?|KM|LINEHAUL|DEPO|Linehaul|Depo)[^\d]*-?\s*(\d{1,2})\/(\d{4})/i);
    if (itemTypeMatch) {
      result.itemType = itemTypeMatch[1].trim().toUpperCase();
      result.period = `${itemTypeMatch[2]}/${itemTypeMatch[3]}`;
    }
    
    // Alternative period extraction
    if (!result.period) {
      const periodMatch = text.match(/(\d{1,2})\/(\d{4})/);
      if (periodMatch) {
        result.period = `${periodMatch[1]}/${periodMatch[2]}`;
      }
    }
    
    // Extract amounts - look for the summary line pattern
    // Pattern: "Součet položek X Y Z" or specific amount patterns
    
    // Try to find "CELKEM K ÚHRADĚ" amount (total with VAT)
    const totalMatch = text.match(/CELKEM K ÚHRADĚ\s*([\d\s]+[,.]?\d*)/i);
    if (totalMatch) {
      result.totalWithVat = parseAmount(totalMatch[1]);
    }
    
    // Try to find VAT rekapitulace section
    // Pattern: "3 688 000,00" followed by "21%" and VAT amount
    const vatMatch = text.match(/(\d[\d\s]*[,.]?\d*)\s*21%\s*([\d\s]+[,.]?\d*)/);
    if (vatMatch) {
      result.totalWithoutVat = parseAmount(vatMatch[1]);
      result.vatAmount = parseAmount(vatMatch[2]);
    }
    
    // Alternative: look for "Součet položek" line
    if (!result.totalWithoutVat) {
      const sumMatch = text.match(/Součet položek\s*([\d\s]+[,.]?\d*)\s*([\d\s]+[,.]?\d*)\s*([\d\s]+[,.]?\d*)/i);
      if (sumMatch) {
        result.totalWithoutVat = parseAmount(sumMatch[1]);
        result.vatAmount = parseAmount(sumMatch[2]);
        result.totalWithVat = parseAmount(sumMatch[3]);
      }
    }
    
    // Alternative: Look for line item amount (single item invoices)
    if (!result.totalWithoutVat) {
      // Pattern like: "1 3 688 000,00 3 688 000,00 21% 774 480,00 4 462 480,00"
      const lineMatch = text.match(/1\s+([\d\s]+[,.]00)\s+([\d\s]+[,.]00)\s+21%\s+([\d\s]+[,.]00)\s+([\d\s]+[,.]00)/);
      if (lineMatch) {
        result.totalWithoutVat = parseAmount(lineMatch[2]);
        result.vatAmount = parseAmount(lineMatch[3]);
        result.totalWithVat = parseAmount(lineMatch[4]);
      }
    }
    
    console.log('Parsed invoice data:', result);
    
  } catch (error) {
    console.error('Error parsing PDF:', error);
  }
  
  return result;
}

// Helper to parse Czech number format (3 688 000,00 -> 3688000.00)
function parseAmount(str) {
  if (!str) return null;
  // Remove spaces, replace comma with dot
  const cleaned = str.replace(/\s/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// POST upload invoice PDF
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const { carrierId, period } = req.body;
    
    if (!carrierId || !period) {
      return res.status(400).json({ error: 'carrierId and period are required' });
    }
    
    // Parse PDF
    const parsedData = await parseInvoicePdf(req.file.buffer);
    
    // Use parsed invoice number or extract from filename
    const invoiceNumber = parsedData.invoiceNumber || 
                         (req.file.originalname.match(/(\d{8})/) || [])[1] || 
                         `SCAN-${Date.now()}`;
    
    // Check for duplicate
    const existing = await prisma.invoice.findFirst({
      where: { carrierId: parseInt(carrierId), invoiceNumber: invoiceNumber }
    });
    
    if (existing) {
      // Update existing invoice with parsed data
      const updated = await prisma.invoice.update({
        where: { id: existing.id },
        data: {
          totalWithoutVat: parsedData.totalWithoutVat || existing.totalWithoutVat,
          vatAmount: parsedData.vatAmount || existing.vatAmount,
          totalWithVat: parsedData.totalWithVat || existing.totalWithVat,
          issueDate: parsedData.issueDate || existing.issueDate,
          dueDate: parsedData.dueDate || existing.dueDate,
          status: parsedData.totalWithoutVat ? 'parsed' : existing.status
        }
      });
      
      return res.json({
        ...updated,
        message: 'Invoice updated with parsed data',
        parsed: parsedData
      });
    }
    
    // Find matching proof
    const proof = await prisma.proof.findFirst({
      where: { carrierId: parseInt(carrierId), period: period }
    });
    
    // Determine item type for categorization
    let itemType = parsedData.itemType || 'OTHER';
    if (itemType.includes('FIX') || itemType.includes('ALZABOX')) {
      itemType = 'FIX';
    } else if (itemType.includes('KM')) {
      itemType = 'KM';
    } else if (itemType.includes('LINEHAUL')) {
      itemType = 'LINEHAUL';
    } else if (itemType.includes('DEPO')) {
      itemType = 'DEPO';
    }
    
    // Create invoice
    const invoice = await prisma.invoice.create({
      data: {
        carrierId: parseInt(carrierId),
        proofId: proof?.id,
        invoiceNumber,
        period: parsedData.period || period,
        fileUrl: req.file.originalname,
        issueDate: parsedData.issueDate,
        dueDate: parsedData.dueDate,
        totalWithoutVat: parsedData.totalWithoutVat || 0,
        vatAmount: parsedData.vatAmount || 0,
        totalWithVat: parsedData.totalWithVat || 0,
        status: parsedData.totalWithoutVat ? 'parsed' : 'pending',
        items: {
          create: [{
            itemType: itemType,
            description: parsedData.itemType || 'Imported from PDF',
            amount: parsedData.totalWithoutVat || 0
          }]
        }
      },
      include: { items: true }
    });
    
    res.status(201).json({
      ...invoice,
      message: parsedData.totalWithoutVat ? 'Invoice parsed successfully' : 'Invoice uploaded, amounts need manual entry',
      parsed: parsedData
    });
  } catch (error) {
    console.error('Error uploading invoice:', error);
    res.status(500).json({ error: 'Failed to upload invoice', details: error.message });
  }
});

// PUT update invoice
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { proofId, status, totalWithoutVat, vatAmount, totalWithVat, items } = req.body;
    
    const invoice = await prisma.invoice.update({
      where: { id },
      data: { proofId, status, totalWithoutVat, vatAmount, totalWithVat }
    });
    
    if (items) {
      await prisma.invoiceItem.deleteMany({ where: { invoiceId: id } });
      await prisma.invoiceItem.createMany({
        data: items.map(item => ({ ...item, invoiceId: id }))
      });
    }
    
    const updated = await prisma.invoice.findUnique({
      where: { id },
      include: { items: true }
    });
    
    res.json(updated);
  } catch (error) {
    console.error('Error updating invoice:', error);
    res.status(500).json({ error: 'Failed to update invoice' });
  }
});

// DELETE invoice
router.delete('/:id', async (req, res) => {
  try {
    await prisma.invoice.delete({ where: { id: parseInt(req.params.id) } });
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting invoice:', error);
    res.status(500).json({ error: 'Failed to delete invoice' });
  }
});

// POST match invoice to proof
router.post('/:id/match', async (req, res) => {
  try {
    const { proofId } = req.body;
    
    const invoice = await prisma.invoice.update({
      where: { id: parseInt(req.params.id) },
      data: { proofId: parseInt(proofId), status: 'matched' },
      include: { proof: true }
    });
    
    res.json(invoice);
  } catch (error) {
    console.error('Error matching invoice:', error);
    res.status(500).json({ error: 'Failed to match invoice' });
  }
});

module.exports = router;
