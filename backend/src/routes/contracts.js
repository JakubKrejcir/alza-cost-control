const express = require('express');
const { PrismaClient } = require('@prisma/client');
const multer = require('multer');
const pdf = require('pdf-parse');
const fs = require('fs');

const router = express.Router();
const prisma = new PrismaClient();
const upload = multer({ dest: 'uploads/' });

// Helper: Extract carrier info from PDF text
function extractCarrierInfo(text) {
  const carrier = {
    name: null,
    ico: null,
    dic: null,
    address: null,
    bankAccount: null
  };

  // Extract IČO (8 digits) - find the one that's NOT Alza (27082440)
  const icoMatches = [...text.matchAll(/IČO[:\s]*(\d{8})/gi)];
  for (const match of icoMatches) {
    if (match[1] !== '27082440') {
      carrier.ico = match[1];
      break;
    }
  }

  // Extract DIČ
  const dicMatches = [...text.matchAll(/DIČ[:\s]*(CZ\d{8,10})/gi)];
  for (const match of dicMatches) {
    if (match[1].toUpperCase() !== 'CZ27082440') {
      carrier.dic = match[1].toUpperCase();
      break;
    }
  }

  // Find carrier name - look for "s.r.o." pattern near the IČO we found
  if (carrier.ico) {
    const namePattern = new RegExp(`([A-Za-zÀ-ž][A-Za-zÀ-ž\\s]+(?:s\\.r\\.o\\.|a\\.s\\.))\\s*(?:se sídlem|IČO[:\\s]*${carrier.ico})`, 'i');
    const nameMatch = text.match(namePattern);
    if (nameMatch) {
      carrier.name = nameMatch[1].trim();
    }
  }

  // Alternative name extraction
  if (!carrier.name) {
    const altMatch = text.match(/(?:Za\s+)?([A-Za-zÀ-ž][A-Za-zÀ-ž\s]+(?:s\.r\.o\.|a\.s\.))\s*\n.*jednatel/i);
    if (altMatch && !altMatch[1].toLowerCase().includes('alza')) {
      carrier.name = altMatch[1].trim();
    }
  }

  // Extract address
  const addressMatches = [...text.matchAll(/se sídlem[:\s]*([^\n]+)/gi)];
  for (const match of addressMatches) {
    const addr = match[1].trim();
    if (!addr.toLowerCase().includes('jankovcova')) { // Not Alza
      carrier.address = addr;
      break;
    }
  }

  // Extract bank account
  const bankMatch = text.match(/č\.\s*bankovního\s*účtu[:\s]*(\d+\/\d+)/i);
  if (bankMatch) {
    carrier.bankAccount = bankMatch[1];
  }

  return carrier;
}

// Helper: Extract contract info from PDF text
function extractContractInfo(text) {
  const contract = {
    number: null,
    type: null,
    validFrom: null,
    serviceType: null
  };

  // Extract "Dodatek č. X"
  const dodatekMatch = text.match(/Dodatek\s*č\.\s*(\d+)/i);
  if (dodatekMatch) {
    contract.number = `Dodatek č. ${dodatekMatch[1]}`;
  }

  // Extract effective date
  const dateMatch = text.match(/(?:účinnosti\s*dnem|platn[ýé]\s*od)[:\s]*(\d{1,2})\.(\d{1,2})\.(\d{4})/i);
  if (dateMatch) {
    const day = parseInt(dateMatch[1]);
    const month = parseInt(dateMatch[2]) - 1;
    const year = parseInt(dateMatch[3]);
    contract.validFrom = new Date(year, month, day);
  }

  // Extract service type
  if (text.includes('DROP 2.0')) {
    contract.serviceType = 'DROP 2.0';
    contract.type = 'DROP';
  } else if (text.includes('AlzaBox')) {
    contract.serviceType = 'AlzaBox';
    contract.type = 'AlzaBox';
  } else if (text.includes('Třídírna') || text.includes('Tridirna')) {
    contract.serviceType = 'Třídírna';
    contract.type = 'Třídírna';
  } else if (text.includes('Nový Bydžov')) {
    contract.serviceType = 'Nový Bydžov';
    contract.type = 'Depo';
  }

  return contract;
}

// Helper: Extract price rates from PDF text
function extractPriceRates(text) {
  const rates = {
    fixRates: [],
    kmRates: [],
    linehaulRates: [],
    depoRates: [],
    bonusRates: []
  };

  // Extract DROP 2.0 route rates
  const routePatterns = [
    { pattern: /^A\s+(\d[\d\s]*)[,-]/m, routeType: 'DROP_A' },
    { pattern: /^B\s+(\d[\d\s]*)[,-]/m, routeType: 'DROP_B' },
    { pattern: /^C\s+(\d[\d\s]*)[,-]/m, routeType: 'DROP_C' },
    { pattern: /^D\s+(\d[\d\s]*)[,-]/m, routeType: 'DROP_D' },
    { pattern: /^E\s+(\d[\d\s]*)[,-]/m, routeType: 'DROP_E' },
    { pattern: /^F\s+(\d[\d\s]*)[,-]/m, routeType: 'DROP_F' },
    { pattern: /^G\s+(\d[\d\s]*)[,-]/m, routeType: 'DROP_G' },
    { pattern: /^H\s+(\d[\d\s]*)[,-]/m, routeType: 'DROP_H' },
    { pattern: /^I\s+(\d[\d\s]*)[,-]/m, routeType: 'DROP_I' },
    { pattern: /Dopoledne\s+(\d[\d\s]*)[,-]/i, routeType: 'DROP_Dopoledne' },
    { pattern: /Posila[^\d]*(\d[\d\s]*)[,-]/i, routeType: 'DROP_Posila' },
    { pattern: /Sobotn[íi]\s+trasa\s+(\d[\d\s]*)[,-]/i, routeType: 'DROP_Sobota' }
  ];

  for (const { pattern, routeType } of routePatterns) {
    const match = text.match(pattern);
    if (match) {
      const rateStr = match[1].replace(/\s/g, '');
      const rate = parseInt(rateStr);
      if (rate > 0) {
        rates.fixRates.push({ routeType, rate });
      }
    }
  }

  // Extract FIX rates (DIRECT Praha, DIRECT Vratimov)
  const directPrahaMatch = text.match(/DIRECT\s*Praha[^\d]*(\d[\d\s]*)/i);
  if (directPrahaMatch) {
    rates.fixRates.push({ 
      routeType: 'FIX_DIRECT_Praha', 
      rate: parseInt(directPrahaMatch[1].replace(/\s/g, '')) 
    });
  }

  const directVratimovMatch = text.match(/DIRECT\s*Vratimov[^\d]*(\d[\d\s]*)/i);
  if (directVratimovMatch) {
    rates.fixRates.push({ 
      routeType: 'FIX_DIRECT_Vratimov', 
      rate: parseInt(directVratimovMatch[1].replace(/\s/g, '')) 
    });
  }

  // Extract Kč/km rate
  const kmMatch = text.match(/(\d+[,.]?\d*)\s*Kč\s*\/\s*km/i);
  if (kmMatch) {
    rates.kmRates.push({ 
      routeType: 'standard', 
      rate: parseFloat(kmMatch[1].replace(',', '.')) 
    });
  }

  // Extract DEPO hourly rate
  const depoHourlyMatch = text.match(/(?:hodinová\s*sazba|sazba\s*DEPO)[^\d]*(\d[\d\s]*)\s*Kč/i);
  if (depoHourlyMatch) {
    rates.depoRates.push({
      depoName: 'standard',
      rateType: 'hourly',
      rate: parseInt(depoHourlyMatch[1].replace(/\s/g, ''))
    });
  }

  return rates;
}

// POST /api/contracts/upload-pdf - Upload and parse contract PDF
router.post('/upload-pdf', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nebyl nahrán žádný soubor' });
    }

    // Read PDF
    const dataBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdf(dataBuffer);
    const text = pdfData.text;

    // Extract data
    const carrierInfo = extractCarrierInfo(text);
    const contractInfo = extractContractInfo(text);
    const priceRates = extractPriceRates(text);

    // Validate extracted data
    if (!carrierInfo.ico) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ 
        error: 'Nepodařilo se extrahovat IČO dopravce z dokumentu',
        extractedText: text.substring(0, 1000)
      });
    }

    // Find or create carrier
    let carrier = await prisma.carrier.findFirst({
      where: { ico: carrierInfo.ico }
    });

    const isNewCarrier = !carrier;

    if (!carrier) {
      carrier = await prisma.carrier.create({
        data: {
          name: carrierInfo.name || `Dopravce ${carrierInfo.ico}`,
          ico: carrierInfo.ico,
          dic: carrierInfo.dic,
          address: carrierInfo.address,
          contact: carrierInfo.bankAccount
        }
      });
    }

    // Create contract
    const contract = await prisma.contract.create({
      data: {
        carrierId: carrier.id,
        number: contractInfo.number || 'Neznámý dodatek',
        type: contractInfo.serviceType,
        validFrom: contractInfo.validFrom || new Date(),
        documentUrl: req.file.filename,
        notes: `Automaticky extrahováno z PDF. Typ služby: ${contractInfo.serviceType || 'neznámý'}`
      }
    });

    // Create price config if we have rates
    let priceConfig = null;
    const hasRates = priceRates.fixRates.length > 0 || 
                     priceRates.kmRates.length > 0 || 
                     priceRates.depoRates.length > 0;

    if (hasRates) {
      priceConfig = await prisma.priceConfig.create({
        data: {
          carrierId: carrier.id,
          contractId: contract.id,
          type: contractInfo.serviceType || 'general',
          validFrom: contractInfo.validFrom || new Date(),
          isActive: true,
          fixRates: {
            create: priceRates.fixRates.map(r => ({
              routeType: r.routeType,
              rate: r.rate
            }))
          },
          kmRates: {
            create: priceRates.kmRates.map(r => ({
              routeType: r.routeType,
              rate: r.rate
            }))
          },
          depoRates: {
            create: priceRates.depoRates.map(r => ({
              depoName: r.depoName,
              rateType: r.rateType,
              rate: r.rate
            }))
          }
        },
        include: {
          fixRates: true,
          kmRates: true,
          depoRates: true
        }
      });
    }

    res.json({
      success: true,
      message: 'Smlouva úspěšně zpracována',
      data: {
        carrier: {
          id: carrier.id,
          name: carrier.name,
          ico: carrier.ico,
          isNew: isNewCarrier
        },
        contract: {
          id: contract.id,
          number: contract.number,
          type: contract.type,
          validFrom: contract.validFrom
        },
        priceConfig: priceConfig ? {
          id: priceConfig.id,
          type: priceConfig.type,
          fixRatesCount: priceConfig.fixRates.length,
          kmRatesCount: priceConfig.kmRates.length,
          depoRatesCount: priceConfig.depoRates.length
        } : null,
        extractedRates: priceRates
      }
    });

  } catch (error) {
    console.error('Error processing contract PDF:', error);
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    res.status(500).json({ error: 'Chyba při zpracování PDF', details: error.message });
  }
});

// POST /api/contracts/parse-preview - Preview extraction without saving
router.post('/parse-preview', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nebyl nahrán žádný soubor' });
    }

    const dataBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdf(dataBuffer);
    const text = pdfData.text;

    const carrierInfo = extractCarrierInfo(text);
    const contractInfo = extractContractInfo(text);
    const priceRates = extractPriceRates(text);

    // Check if carrier already exists
    let existingCarrier = null;
    if (carrierInfo.ico) {
      existingCarrier = await prisma.carrier.findFirst({
        where: { ico: carrierInfo.ico },
        include: { contracts: true }
      });
    }

    fs.unlinkSync(req.file.path);

    res.json({
      carrier: {
        ...carrierInfo,
        existsInDb: !!existingCarrier,
        existingData: existingCarrier
      },
      contract: contractInfo,
      rates: priceRates,
      rawTextPreview: text.substring(0, 2000)
    });

  } catch (error) {
    console.error('Error parsing contract PDF:', error);
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    res.status(500).json({ error: 'Chyba při parsování PDF', details: error.message });
  }
});

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
