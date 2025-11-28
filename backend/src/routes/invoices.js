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

// Helper to parse Czech number format (3 688 000,00 -> 3688000.00)
function parseAmount(str) {
  if (!str) return null;
  // Remove all whitespace (including non-breaking spaces), replace comma with dot
  const cleaned = str.replace(/[\s\u00A0]/g, '').replace(',', '.');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// Helper to parse Czech date format (31.10.2025 -> Date)
function parseCzechDate(dateStr) {
  if (!dateStr) return null;
  const match = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!match) return null;
  const [, day, month, year] = match;
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
}

// Helper function to parse invoice PDF - UPDATED for Drive cool s.r.o. invoices
async function parseInvoicePdf(buffer) {
  const result = {
    invoiceNumber: null,
    variableSymbol: null,
    issueDate: null,
    dueDate: null,
    taxDate: null,
    totalWithoutVat: null,
    vatAmount: null,
    totalWithVat: null,
    itemType: null,
    period: null,
    supplierIco: null,
    supplierDic: null,
    customerIco: null,
    customerDic: null,
    rawText: null
  };
  
  try {
    const data = await pdf(buffer);
    const text = data.text;
    result.rawText = text; // Store for debugging
    
    console.log('--- PDF RAW TEXT (first 500 chars) ---');
    console.log(text.substring(0, 500));
    console.log('--- END RAW TEXT ---');
    
    // ===========================================
    // INVOICE NUMBER - try multiple patterns
    // ===========================================
    // Pattern 1: "č. 25013229" or "č.25013229"
    let invoiceMatch = text.match(/č\.\s*(\d{8})/i);
    // Pattern 2: "FAKTURA - DAŇOVÝ DOKLAD č. 25013229"
    if (!invoiceMatch) {
      invoiceMatch = text.match(/FAKTURA[^č]*č\.\s*(\d{8})/i);
    }
    // Pattern 3: Variabilní symbol (usually same as invoice number)
    if (!invoiceMatch) {
      invoiceMatch = text.match(/Variabilní symbol:\s*(\d{8})/i);
    }
    if (invoiceMatch) {
      result.invoiceNumber = invoiceMatch[1];
    }
    
    // Variable symbol (backup)
    const vsMatch = text.match(/Variabilní symbol:\s*(\d+)/i);
    if (vsMatch) {
      result.variableSymbol = vsMatch[1];
      if (!result.invoiceNumber) {
        result.invoiceNumber = vsMatch[1];
      }
    }
    
    // ===========================================
    // DATES
    // ===========================================
    const issueDateMatch = text.match(/Datum vystavení:\s*(\d{1,2}\.\d{1,2}\.\d{4})/i);
    if (issueDateMatch) {
      result.issueDate = parseCzechDate(issueDateMatch[1]);
    }
    
    const dueDateMatch = text.match(/Datum splatnosti:\s*(\d{1,2}\.\d{1,2}\.\d{4})/i);
    if (dueDateMatch) {
      result.dueDate = parseCzechDate(dueDateMatch[1]);
    }
    
    const taxDateMatch = text.match(/Datum uskutečnění plnění:\s*(\d{1,2}\.\d{1,2}\.\d{4})/i);
    if (taxDateMatch) {
      result.taxDate = parseCzechDate(taxDateMatch[1]);
    }
    
    // ===========================================
    // ITEM TYPE AND PERIOD
    // ===========================================
    // Pattern: "ALZABOXY FIX - 10/2025" or "ALZABOXY KM - 10/2025" etc.
    const itemMatch = text.match(/ALZABOXY\s+(FIX|KM|LINEHAUL|DEPO)\s*-\s*(\d{1,2})\/(\d{4})/i);
    if (itemMatch) {
      result.itemType = `ALZABOXY ${itemMatch[1].toUpperCase()}`;
      result.period = `${itemMatch[2]}/${itemMatch[3]}`;
    } else {
      // Fallback: just look for any MM/YYYY pattern
      const periodMatch = text.match(/(\d{1,2})\/(\d{4})/);
      if (periodMatch) {
        result.period = `${periodMatch[1]}/${periodMatch[2]}`;
      }
    }
    
    // ===========================================
    // AMOUNTS - Multiple extraction strategies
    // ===========================================
    
    // Strategy 1: Extract from line item row
    // Pattern: "ALZABOXY XXX - MM/YYYY 1 3 688 000,00 3 688 000,00 21% 774 480,00 4 462 480,00"
    // Note: The regex needs to handle numbers with spaces as thousand separators
    const lineItemRegex = /ALZABOXY\s+(?:FIX|KM|LINEHAUL|DEPO)\s*-\s*\d+\/\d+\s+1\s+([\d\s]+,\d{2})\s+([\d\s]+,\d{2})\s+21%\s+([\d\s]+,\d{2})\s+([\d\s]+,\d{2})/i;
    const lineMatch = text.match(lineItemRegex);
    
    if (lineMatch) {
      // lineMatch[1] = unit price (J.cena)
      // lineMatch[2] = base amount (Cena bez DPH)
      // lineMatch[3] = VAT amount (DPH Kč)
      // lineMatch[4] = total (Celkem s DPH)
      result.totalWithoutVat = parseAmount(lineMatch[2]);
      result.vatAmount = parseAmount(lineMatch[3]);
      result.totalWithVat = parseAmount(lineMatch[4]);
      console.log('Amounts extracted from line item');
    }
    
    // Strategy 2: Extract from "Součet položek" row
    if (!result.totalWithoutVat) {
      const sumRegex = /Součet položek\s+([\d\s]+,\d{2})\s+([\d\s]+,\d{2})\s+([\d\s]+,\d{2})/i;
      const sumMatch = text.match(sumRegex);
      if (sumMatch) {
        result.totalWithoutVat = parseAmount(sumMatch[1]);
        result.vatAmount = parseAmount(sumMatch[2]);
        result.totalWithVat = parseAmount(sumMatch[3]);
        console.log('Amounts extracted from Součet položek');
      }
    }
    
    // Strategy 3: Extract from DPH rekapitulace (21% line)
    if (!result.totalWithoutVat) {
      // Pattern in rekapitulace: "3 688 000,00 21% 774 480,00 4 462 480,00"
      const rekapRegex = /([\d\s]+,\d{2})\s+21%\s+([\d\s]+,\d{2})\s+([\d\s]+,\d{2})/;
      const rekapMatch = text.match(rekapRegex);
      if (rekapMatch) {
        result.totalWithoutVat = parseAmount(rekapMatch[1]);
        result.vatAmount = parseAmount(rekapMatch[2]);
        result.totalWithVat = parseAmount(rekapMatch[3]);
        console.log('Amounts extracted from DPH rekapitulace');
      }
    }
    
    // Strategy 4: Extract "CELKEM K ÚHRADĚ" as fallback for total
    if (!result.totalWithVat) {
      const celkemMatch = text.match(/CELKEM K ÚHRADĚ\s+([\d\s]+,\d{2})/i);
      if (celkemMatch) {
        result.totalWithVat = parseAmount(celkemMatch[1]);
        // If we have total but not base, calculate (21% VAT)
        if (result.totalWithVat && !result.totalWithoutVat) {
          result.totalWithoutVat = Math.round(result.totalWithVat / 1.21 * 100) / 100;
          result.vatAmount = Math.round((result.totalWithVat - result.totalWithoutVat) * 100) / 100;
        }
        console.log('Amounts calculated from CELKEM K ÚHRADĚ');
      }
    }
    
    // ===========================================
    // IČO and DIČ extraction (optional)
    // ===========================================
    // Supplier (dodavatel) - Drive cool s.r.o.
    const supplierIcoMatch = text.match(/IČ:\s*(\d{8})/);
    if (supplierIcoMatch) {
      result.supplierIco = supplierIcoMatch[1];
    }
    
    const supplierDicMatch = text.match(/DIČ:\s*(CZ\d{8,10})/);
    if (supplierDicMatch) {
      result.supplierDic = supplierDicMatch[1];
    }
    
    // Customer (odběratel) - look for second occurrence or after "Odběratel"
    const customerSection = text.match(/Odběratel:[\s\S]*?IČ:\s*(\d{8})[\s\S]*?DIČ:\s*(CZ\d{8,10})/i);
    if (customerSection) {
      result.customerIco = customerSection[1];
      result.customerDic = customerSection[2];
    }
    
    console.log('Parsed invoice data:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Error parsing PDF:', error);
  }
  
  return result;
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
                         parsedData.variableSymbol ||
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
          totalWithoutVat: parsedData.totalWithoutVat ?? existing.totalWithoutVat,
          vatAmount: parsedData.vatAmount ?? existing.vatAmount,
          totalWithVat: parsedData.totalWithVat ?? existing.totalWithVat,
          issueDate: parsedData.issueDate ?? existing.issueDate,
          dueDate: parsedData.dueDate ?? existing.dueDate,
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
      where: { carrierId: parseInt(carrierId), period: parsedData.period || period }
    });
    
    // Determine item type for categorization
    let itemType = 'OTHER';
    if (parsedData.itemType) {
      if (parsedData.itemType.includes('FIX')) {
        itemType = 'FIX';
      } else if (parsedData.itemType.includes('KM')) {
        itemType = 'KM';
      } else if (parsedData.itemType.includes('LINEHAUL')) {
        itemType = 'LINEHAUL';
      } else if (parsedData.itemType.includes('DEPO')) {
        itemType = 'DEPO';
      }
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

// POST upload multiple invoices at once
router.post('/upload-batch', upload.array('files', 20), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files uploaded' });
    }
    
    const { carrierId } = req.body;
    
    if (!carrierId) {
      return res.status(400).json({ error: 'carrierId is required' });
    }
    
    const results = [];
    
    for (const file of req.files) {
      try {
        const parsedData = await parseInvoicePdf(file.buffer);
        
        const invoiceNumber = parsedData.invoiceNumber || 
                             (file.originalname.match(/(\d{8})/) || [])[1] || 
                             `SCAN-${Date.now()}`;
        
        // Check for duplicate
        const existing = await prisma.invoice.findFirst({
          where: { carrierId: parseInt(carrierId), invoiceNumber: invoiceNumber }
        });
        
        if (existing) {
          results.push({
            filename: file.originalname,
            status: 'skipped',
            message: 'Duplicate invoice',
            invoiceNumber
          });
          continue;
        }
        
        // Determine item type
        let itemType = 'OTHER';
        if (parsedData.itemType) {
          if (parsedData.itemType.includes('FIX')) itemType = 'FIX';
          else if (parsedData.itemType.includes('KM')) itemType = 'KM';
          else if (parsedData.itemType.includes('LINEHAUL')) itemType = 'LINEHAUL';
          else if (parsedData.itemType.includes('DEPO')) itemType = 'DEPO';
        }
        
        // Find matching proof
        const proof = parsedData.period ? await prisma.proof.findFirst({
          where: { carrierId: parseInt(carrierId), period: parsedData.period }
        }) : null;
        
        const invoice = await prisma.invoice.create({
          data: {
            carrierId: parseInt(carrierId),
            proofId: proof?.id,
            invoiceNumber,
            period: parsedData.period || 'unknown',
            fileUrl: file.originalname,
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
        
        results.push({
          filename: file.originalname,
          status: 'success',
          invoice: invoice,
          parsed: parsedData
        });
        
      } catch (fileError) {
        results.push({
          filename: file.originalname,
          status: 'error',
          message: fileError.message
        });
      }
    }
    
    res.status(201).json({
      message: `Processed ${req.files.length} files`,
      results
    });
    
  } catch (error) {
    console.error('Error in batch upload:', error);
    res.status(500).json({ error: 'Failed to process batch upload', details: error.message });
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

// GET parse preview - for testing without saving
router.post('/parse-preview', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const parsedData = await parseInvoicePdf(req.file.buffer);
    
    res.json({
      filename: req.file.originalname,
      parsed: parsedData
    });
  } catch (error) {
    console.error('Error parsing preview:', error);
    res.status(500).json({ error: 'Failed to parse PDF', details: error.message });
  }
});

module.exports = router;


