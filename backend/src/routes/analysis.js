const express = require('express');
const { PrismaClient } = require('@prisma/client');

const router = express.Router();
const prisma = new PrismaClient();

// POST analyze proof against price config
router.post('/proof/:proofId', async (req, res) => {
  try {
    const proofId = parseInt(req.params.proofId);
    
    // Get proof with all details
    const proof = await prisma.proof.findUnique({
      where: { id: proofId },
      include: {
        carrier: true,
        routeDetails: true,
        linehaulDetails: true,
        depoDetails: true,
        invoices: { include: { items: true } }
      }
    });
    
    if (!proof) {
      return res.status(404).json({ error: 'Proof not found' });
    }
    
    // Get active price config for this carrier and period
    const priceConfig = await prisma.priceConfig.findFirst({
      where: {
        carrierId: proof.carrierId,
        isActive: true,
        validFrom: { lte: proof.periodDate },
        OR: [
          { validTo: null },
          { validTo: { gte: proof.periodDate } }
        ]
      },
      include: {
        fixRates: true,
        kmRates: true,
        depoRates: true,
        linehaulRates: true
      },
      orderBy: { validFrom: 'desc' }
    });
    
    // Perform analysis
    const analysis = analyzeProof(proof, priceConfig);
    
    // Save analysis
    const savedAnalysis = await prisma.proofAnalysis.create({
      data: {
        proofId,
        status: analysis.status,
        errorsJson: analysis.errors,
        warningsJson: analysis.warnings,
        okJson: analysis.ok,
        fixExpected: analysis.fix.expected,
        fixActual: analysis.fix.actual,
        fixDifference: analysis.fix.difference,
        unexplainedFix: analysis.fix.unexplained,
        kmExpected: analysis.km.expected,
        kmActual: analysis.km.actual,
        kmDifference: analysis.km.difference,
        linehaulExpected: analysis.linehaul.expected,
        linehaulActual: analysis.linehaul.actual,
        linehaulDiff: analysis.linehaul.difference,
        depoExpected: analysis.depo.expected,
        depoActual: analysis.depo.actual,
        depoDifference: analysis.depo.difference,
        missingRatesJson: analysis.missingRates
      }
    });
    
    res.json({
      analysis: savedAnalysis,
      details: analysis
    });
  } catch (error) {
    console.error('Error analyzing proof:', error);
    res.status(500).json({ error: 'Failed to analyze proof' });
  }
});

// GET latest analysis for proof
router.get('/proof/:proofId', async (req, res) => {
  try {
    const analysis = await prisma.proofAnalysis.findFirst({
      where: { proofId: parseInt(req.params.proofId) },
      orderBy: { createdAt: 'desc' }
    });
    
    if (!analysis) {
      return res.status(404).json({ error: 'No analysis found for this proof' });
    }
    
    res.json(analysis);
  } catch (error) {
    console.error('Error fetching analysis:', error);
    res.status(500).json({ error: 'Failed to fetch analysis' });
  }
});

// GET dashboard summary for period
router.get('/dashboard', async (req, res) => {
  try {
    const { carrierId, period } = req.query;
    
    const where = {};
    if (carrierId) where.carrierId = parseInt(carrierId);
    if (period) where.period = period;
    
    // Get proofs with analyses
    const proofs = await prisma.proof.findMany({
      where,
      include: {
        carrier: { select: { name: true } },
        invoices: true,
        analyses: {
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      },
      orderBy: { periodDate: 'desc' }
    });
    
    // Calculate summary
    const summary = proofs.map(proof => {
      const invoicedTotal = proof.invoices.reduce((sum, inv) => 
        sum + parseFloat(inv.totalWithoutVat || 0), 0
      );
      const proofTotal = parseFloat(proof.grandTotal || 0);
      const latestAnalysis = proof.analyses[0];
      
      return {
        id: proof.id,
        carrier: proof.carrier.name,
        period: proof.period,
        proofTotal,
        invoicedTotal,
        invoiceCount: proof.invoices.length,
        remainingToInvoice: proofTotal - invoicedTotal,
        status: latestAnalysis?.status || 'pending',
        errors: latestAnalysis?.errorsJson?.length || 0,
        warnings: latestAnalysis?.warningsJson?.length || 0
      };
    });
    
    res.json(summary);
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

// Helper function to analyze proof
function analyzeProof(proof, priceConfig) {
  const errors = [];
  const warnings = [];
  const ok = [];
  const missingRates = [];
  
  const result = {
    status: 'ok',
    errors,
    warnings,
    ok,
    missingRates,
    fix: { expected: 0, actual: 0, difference: 0, unexplained: 0 },
    km: { expected: 0, actual: 0, difference: 0 },
    linehaul: { expected: 0, actual: 0, difference: 0 },
    depo: { expected: 0, actual: 0, difference: 0 }
  };
  
  if (!priceConfig) {
    warnings.push('Žádný aktivní ceník pro toto období');
    result.status = 'warning';
    return result;
  }
  
  // Analyze FIX
  let expectedFix = 0;
  const fixRatesMap = new Map(priceConfig.fixRates.map(r => [r.routeType, parseFloat(r.rate)]));
  
  for (const route of proof.routeDetails) {
    const configRate = fixRatesMap.get(route.routeType);
    if (configRate) {
      expectedFix += route.count * configRate;
    } else {
      missingRates.push({
        type: 'fix',
        routeType: route.routeType,
        proofRate: parseFloat(route.rate)
      });
      expectedFix += parseFloat(route.amount);
    }
  }
  
  result.fix.expected = expectedFix;
  result.fix.actual = parseFloat(proof.totalFix || 0);
  result.fix.difference = result.fix.actual - result.fix.expected;
  
  if (Math.abs(result.fix.difference) > 100) {
    result.fix.unexplained = result.fix.difference;
    warnings.push(`Nevysvětlený rozdíl u FIX: ${result.fix.difference.toLocaleString('cs-CZ')} Kč`);
  } else {
    ok.push('FIX: Hodnoty sedí');
  }
  
  // Analyze KM
  const kmRate = priceConfig.kmRates[0]?.rate || 10.97;
  result.km.expected = parseFloat(proof.totalKmCount || 0) * parseFloat(kmRate);
  result.km.actual = parseFloat(proof.totalKm || 0);
  result.km.difference = result.km.actual - result.km.expected;
  
  if (Math.abs(result.km.difference) > 100) {
    errors.push(`KM: Rozdíl ${result.km.difference.toLocaleString('cs-CZ')} Kč`);
  } else {
    ok.push('KM: Hodnoty sedí');
  }
  
  // Analyze Linehaul
  result.linehaul.actual = parseFloat(proof.totalLinehaul || 0);
  // Detailed linehaul analysis would go here
  
  // Analyze Depo
  result.depo.actual = parseFloat(proof.totalDepo || 0);
  // Detailed depo analysis would go here
  
  // Check invoices
  const invoicedTypes = new Set();
  proof.invoices.forEach(inv => {
    inv.items.forEach(item => invoicedTypes.add(item.itemType));
  });
  
  const requiredTypes = ['fix', 'km', 'linehaul', 'depo'];
  requiredTypes.forEach(type => {
    if (!invoicedTypes.has(type) && parseFloat(proof[`total${type.charAt(0).toUpperCase() + type.slice(1)}`] || 0) > 0) {
      warnings.push(`Chybí faktura: ${type.toUpperCase()}`);
    }
  });
  
  // Set overall status
  if (errors.length > 0) {
    result.status = 'error';
  } else if (warnings.length > 0) {
    result.status = 'warning';
  }
  
  return result;
}

module.exports = router;
