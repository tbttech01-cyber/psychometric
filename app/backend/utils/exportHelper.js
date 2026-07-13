// pdfkit (~450ms to load) and json2csv are only needed when an admin actually
// exports — require them lazily so they stay OFF the serverless cold-start path.
const brand = 'Tamil Business Tribe';

function generatePDF(results) {
  const PDFDocument = require('pdfkit');
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40 });

  // Header
  doc.rect(0, 0, doc.page.width, 70).fill('#1B3A6B');
  doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold')
    .text(brand + ' — Psychometric Assessment Results', 40, 20);
  doc.fontSize(11).font('Helvetica')
    .text(`Generated: ${new Date().toLocaleString()}`, 40, 46);
  doc.moveDown(3);

  // Table header
  const cols = { name: 40, email: 150, code: 270, score: 330, pct: 375, level: 415, cws: 505, business: 590, date: 720 };
  doc.fillColor('#1B3A6B').fontSize(9).font('Helvetica-Bold');
  doc.text('Name', cols.name, doc.y);
  doc.text('Email', cols.email, doc.y - 9);
  doc.text('Code', cols.code, doc.y - 9);
  doc.text('Score', cols.score, doc.y - 9);
  doc.text('%', cols.pct, doc.y - 9);
  doc.text('Level', cols.level, doc.y - 9);
  doc.text('C/W/S', cols.cws, doc.y - 9);
  doc.text('Top Recommendation', cols.business, doc.y - 9);
  doc.text('Date', cols.date, doc.y - 9);
  doc.moveDown(0.4);
  doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke('#1B3A6B');
  doc.moveDown(0.3);

  // Rows
  results.forEach((r, i) => {
    if (doc.y > doc.page.height - 80) { doc.addPage(); }
    doc.fillColor('#1e293b').fontSize(8).font('Helvetica');
    const y = doc.y;
    const topRecommendation = r.recommendations?.[0]?.business || r.recommendedBusiness?.[0] || '';
    const cws = (r.correctCount != null) ? `${r.correctCount}/${r.wrongCount}/${r.skippedCount}` : '';
    doc.text(r.userId?.name || '', cols.name, y, { width: 100 });
    doc.text(r.userId?.email || '', cols.email, y, { width: 115 });
    doc.text(r.userId?.sharedCode || '', cols.code, y, { width: 55 });
    doc.text(`${r.totalMarks}/${r.maxScore}`, cols.score, y, { width: 40 });
    doc.text(`${r.percentage}%`, cols.pct, y, { width: 35 });
    doc.text(r.level || '', cols.level, y, { width: 85 });
    doc.text(cws, cols.cws, y, { width: 55 });
    doc.text(topRecommendation, cols.business, y, { width: 125 });
    doc.text(r.createdAt ? new Date(r.createdAt).toLocaleDateString() : '', cols.date, y, { width: 80 });
    doc.moveDown(0.9);
  });

  // Footer on each page
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);
    doc.fillColor('#94a3b8').fontSize(8)
      .text(`Page ${i + 1} of ${range.count}  |  ${brand} — Confidential`,
        40, doc.page.height - 30, { align: 'center' });
  }

  return doc;
}

function generateCSV(results) {
  // Category/dimension names are admin-configurable (not a fixed set), and
  // can change over time, so both column lists are derived from whatever
  // actually appears in this export rather than hardcoded.
  const categoryNames = [...new Set(
    results.flatMap(r => Array.from(r.categoryScores?.keys?.() || []))
  )].sort();
  const dimensionNames = [...new Set(
    results.flatMap(r => Array.from(r.dimensionPercentages?.keys?.() || []))
  )].sort();

  const fields = [
    { label: 'Name',                       value: r => r.userId?.name || '' },
    { label: 'Email',                      value: r => r.userId?.email || '' },
    { label: 'Shared Code',                value: r => r.userId?.sharedCode || '' },
    { label: 'Total Marks',                value: 'totalMarks' },
    { label: 'Max Score',                  value: 'maxScore' },
    { label: 'Percentage',                 value: 'percentage' },
    { label: 'Level',                      value: 'level' },
    ...categoryNames.map(name => ({
      label: `${name} Score`,
      value: r => r.categoryScores?.get?.(name) ?? '',
    })),
    { label: 'Top Category',               value: r => (r.highestCategory || []).join('; ') },
    { label: 'Business Readiness %',       value: r => r.businessReadinessPercent ?? '' },
    { label: 'Aptitude Score',             value: r => r.aptitudeScore ?? '' },
    { label: 'Personality Score',          value: r => r.personalityScore ?? '' },
    { label: 'Business Mindset Score',     value: r => r.businessMindsetScore ?? '' },
    { label: 'Financial Awareness Score',  value: r => r.financialAwarenessScore ?? '' },
    ...dimensionNames.map(name => ({
      label: `${name} %`,
      value: r => r.dimensionPercentages?.get?.(name) ?? '',
    })),
    { label: 'Strong Dimensions',          value: r => (r.strongDimensions || []).join('; ') },
    { label: 'Weak Dimensions',            value: r => (r.weakDimensions || []).join('; ') },
    { label: 'Correct',                    value: r => r.correctCount ?? '' },
    { label: 'Wrong',                      value: r => r.wrongCount ?? '' },
    { label: 'Skipped',                    value: r => r.skippedCount ?? '' },
    { label: 'Recommended Business',       value: r => (r.recommendedBusiness || []).join('; ') },
    {
      label: 'Recommendations (business: explanation)',
      value: r => (r.recommendations || []).map(rec => `${rec.business}: ${rec.explanation}`).join(' | '),
    },
    { label: 'Assessment Date',            value: r => r.createdAt ? new Date(r.createdAt).toISOString() : '' },
  ];

  const { Parser } = require('json2csv');
  const parser = new Parser({ fields });
  return '﻿' + parser.parse(results); // UTF-8 BOM for Excel
}

module.exports = { generatePDF, generateCSV };
