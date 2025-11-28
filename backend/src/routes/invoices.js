const express = require('express');
const multer = require('multer');
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
orderBy: { createdAt: 'desc' }    });
    
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
    
    // Parse period date
    const [month, year] = period.split('/');
    const periodDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    
    // Check for duplicate
   const existing = await prisma.invoice.findFirst({
  where: { carrierId: carrierId, invoiceNumber: invoiceNumber }
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
        periodDate,
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

// POST upload invoice PDF (placeholder for PDF parsing)
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const { carrierId, period } = req.body;
    
    if (!carrierId || !period) {
      return res.status(400).json({ error: 'carrierId and period are required' });
    }
    
    // Extract invoice number from filename
    const invoiceNumMatch = req.file.originalname.match(/(\d{8})/);
    const invoiceNumber = invoiceNumMatch ? invoiceNumMatch[1] : `SCAN-${Date.now()}`;
    
    // Parse period date
    const [month, year] = period.split('/');
    const periodDate = new Date(parseInt(year), parseInt(month) - 1, 1);
    
    // Check for duplicate
const existing = await prisma.invoice.findFirst({
  where: { carrierId: parseInt(carrierId), invoiceNumber: invoiceNumber }
});
    
    if (existing) {
      return res.status(400).json({ error: `Invoice ${invoiceNumber} already exists for this carrier` });
    }
    
    // Find matching proof
const proof = await prisma.proof.findFirst({
  where: { carrierId: parseInt(carrierId), period: period }
});
    
    // Create invoice with placeholder data
    // In production, you would parse the PDF here
    const invoice = await prisma.invoice.create({
      data: {
        carrierId: parseInt(carrierId),
        proofId: proof?.id,
        invoiceNumber,
        period,
        periodDate,
        fileName: req.file.originalname,
        totalWithoutVat: 0,
        vatAmount: 0,
        totalWithVat: 0,
        status: 'pending'
      }
    });
    
    res.status(201).json({
      ...invoice,
      message: 'Invoice uploaded. Please update amounts manually or implement PDF parsing.'
    });
  } catch (error) {
    console.error('Error uploading invoice:', error);
    res.status(500).json({ error: 'Failed to upload invoice' });
  }
});

// PUT update invoice
router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const {
      proofId,
      status,
      totalWithoutVat,
      vatAmount,
      totalWithVat,
      items
    } = req.body;
    
    const invoice = await prisma.invoice.update({
      where: { id },
      data: {
        proofId,
        status,
        totalWithoutVat,
        vatAmount,
        totalWithVat
      }
    });
    
    // Update items if provided
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
    await prisma.invoice.delete({
      where: { id: parseInt(req.params.id) }
    });
    
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
      data: {
        proofId: parseInt(proofId),
        status: 'matched'
      },
      include: { proof: true }
    });
    
    res.json(invoice);
  } catch (error) {
    console.error('Error matching invoice:', error);
    res.status(500).json({ error: 'Failed to match invoice' });
  }
});

module.exports = router;
