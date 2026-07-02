const PDFDocument = require('pdfkit');
const { Parser } = require('json2csv');

const brand = 'Tamil Business Tribe';

function generatePDF(results) {
  const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40 });

  // Header
  doc.rect(0, 0, doc.page.width, 70).fill('#1B3A6B');
  doc.fillColor('#ffffff').fontSize(18).font('Helvetica-Bold')
    .text(brand + ' — Psychometric Assessment Results', 40, 20);
  doc.fontSize(11).font('Helvetica')
    .text(`Generated: ${new Date().toLocaleString()}`, 40, 46);
  doc.moveDown(3);

  // Table header
  const cols = { name: 40, email: 160, code: 310, score: 390, pct: 440, level: 490, date: 590 };
  doc.fillColor('#1B3A6B').fontSize(9).font('Helvetica-Bold');
  doc.text('Name', cols.name, doc.y);
  doc.text('Email', cols.email, doc.y - 9);
  doc.text('Code', cols.code, doc.y - 9);
  doc.text('Score', cols.score, doc.y - 9);
  doc.text('%', cols.pct, doc.y - 9);
  doc.text('Level', cols.level, doc.y - 9);
  doc.text('Date', cols.date, doc.y - 9);
  doc.moveDown(0.4);
  doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke('#1B3A6B');
  doc.moveDown(0.3);

  // Rows
  results.forEach((r, i) => {
    if (doc.y > doc.page.height - 80) { doc.addPage(); }
    const fill = i % 2 === 0 ? '#F8FAFC' : '#FFFFFF';
    doc.fillColor('#1e293b').fontSize(8).font('Helvetica');
    const y = doc.y;
    doc.text(r.user?.name || '', cols.name, y, { width: 110 });
    doc.text(r.user?.email || '', cols.email, y, { width: 140 });
    doc.text(r.user?.sharedCode || '', cols.code, y, { width: 70 });
    doc.text(`${r.totalMarks}/200`, cols.score, y, { width: 45 });
    doc.text(`${r.percentage}%`, cols.pct, y, { width: 45 });
    doc.text(r.level || '', cols.level, y, { width: 95 });
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
  const fields = [
    { label: 'Name',                       value: r => r.user?.name || '' },
    { label: 'Email',                      value: r => r.user?.email || '' },
    { label: 'Shared Code',                value: r => r.user?.sharedCode || '' },
    { label: 'Total Marks',                value: 'totalMarks' },
    { label: 'Percentage',                 value: 'percentage' },
    { label: 'Level',                      value: 'level' },
    { label: 'Communication Score',        value: r => r.categoryScores?.get?.('Communication') ?? '' },
    { label: 'Creativity Score',           value: r => r.categoryScores?.get?.('Creativity') ?? '' },
    { label: 'Problem Solving Score',      value: r => r.categoryScores?.get?.('Problem Solving') ?? '' },
    { label: 'Leadership Score',           value: r => r.categoryScores?.get?.('Leadership') ?? '' },
    { label: 'Risk Taking Score',          value: r => r.categoryScores?.get?.('Risk Taking') ?? '' },
    { label: 'Financial Awareness Score',  value: r => r.categoryScores?.get?.('Financial Awareness') ?? '' },
    { label: 'Business Mindset Score',     value: r => r.categoryScores?.get?.('Business Mindset') ?? '' },
    { label: 'Teamwork Score',             value: r => r.categoryScores?.get?.('Teamwork') ?? '' },
    { label: 'Top Category',               value: r => (r.highestCategory || []).join('; ') },
    { label: 'Recommended Business',       value: r => (r.recommendedBusiness || []).join('; ') },
    { label: 'Assessment Date',            value: r => r.createdAt ? new Date(r.createdAt).toISOString() : '' },
  ];

  const parser = new Parser({ fields });
  return '﻿' + parser.parse(results); // UTF-8 BOM for Excel
}

module.exports = { generatePDF, generateCSV };
