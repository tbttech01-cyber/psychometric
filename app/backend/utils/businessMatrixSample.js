// Shared sample data for the Business Matrix. Fills the WHOLE matrix over every
// active QuestionType (the 8 personality traits + the aptitude types Numerical /
// Logical / Verbal), so no row or column is left blank. Each cell is a
// business/career recommendation matched to its row x column pair. Used by both
// scripts/seedBusinessMatrixDummy.js and POST /admin/business-matrix/seed-sample.
const QuestionType = require('../models/QuestionType');
const BusinessMatrixCell = require('../models/BusinessMatrixCell');

// Canonical order (matches QuestionType.order 1-11).
const TRAITS = [
  'Communication', 'Creativity', 'Problem Solving', 'Leadership',        // 0-3
  'Risk Taking', 'Financial Awareness', 'Business Mindset', 'Teamwork',  // 4-7
  'Numerical Ability', 'Logical Ability', 'Verbal Ability',             // 8-10 (aptitude)
];

// Hand-crafted 8x8 grid for the personality corner. [businessName, rating].
const GRID8 = [
  [['Public Relations Agency', 5], ['Advertising & Branding Studio', 4], ['Management Consulting', 4], ['Corporate Training & Coaching', 4], ['Media & PR Startup', 3], ['Investor Relations Firm', 3], ['Sales & Marketing Agency', 5], ['Community Engagement Platform', 4]],
  [['Content & Storytelling Studio', 4], ['Design Studio', 5], ['Product Design Lab', 4], ['Creative Direction Agency', 4], ['Experimental Media Startup', 3], ['Creative Monetization Consultancy', 3], ['Innovation & R&D Venture', 4], ['Collaborative Arts Collective', 3]],
  [['Technical Advisory Services', 4], ['R&D Innovation Lab', 4], ['Analytics & Research Firm', 5], ['Operations Strategy Consulting', 4], ['Deep-Tech Startup', 4], ['Quantitative Analysis Firm', 4], ['Process Optimization Consultancy', 4], ['Engineering Services Company', 4]],
  [['Executive Coaching Practice', 4], ['Creative Agency Leadership', 3], ['Turnaround Management Firm', 4], ['Corporate Strategy Consulting', 5], ['Startup Founder / Venture', 5], ['Private Equity Management', 4], ['Franchise / Business Ownership', 4], ['Team Leadership & HR Consulting', 4]],
  [['Sales-Driven Startup', 3], ['Disruptive Tech Startup', 4], ['FinTech Venture', 4], ['Entrepreneur / Founder', 5], ['Angel Investing & Trading', 5], ['Investment & Trading Firm', 4], ['Startup Incubator', 4], ['Co-Founder Venture Team', 4]],
  [['Financial Advisory Firm', 4], ['FinTech Product Studio', 3], ['Investment Analysis Firm', 5], ['Wealth Management Practice', 4], ['Trading & Investment Desk', 4], ['Accounting & Audit Firm', 5], ['Financial Consulting Business', 4], ['Cooperative Finance / Fund', 3]],
  [['Marketing & Growth Agency', 4], ['Product Startup', 4], ['Business Consulting Firm', 5], ['Enterprise Founder / CEO', 5], ['High-Growth Startup', 5], ['Business Investment Firm', 4], ['Serial Entrepreneurship', 5], ['Franchise Network Business', 4]],
  [['HR & People Operations', 4], ['Creative Studio Collective', 3], ['Agile Engineering Team', 4], ['Team Management Consultancy', 4], ['Startup Co-Founding Team', 3], ['Cooperative Business / Fund', 3], ['Partnership Enterprise', 4], ['Collaborative Services Firm', 5]],
];

// Aptitude pools (Numerical, Logical, Verbal). Any cell that involves an
// aptitude type draws from the aptitude side's pool (varied by the other trait).
const APTITUDE_POOLS = [
  // Numerical Ability
  [['Data Analytics Firm', 5], ['Financial Modelling Practice', 5], ['Quantitative Trading Desk', 4], ['Actuarial & Risk Services', 4], ['Accounting & Audit Firm', 4], ['Pricing & Revenue Consultancy', 4], ['Statistics & Insights Agency', 4], ['Fintech Analytics Startup', 4], ['Data Science Lab', 5], ['Investment Research Firm', 4], ['Business Intelligence Consultancy', 4]],
  // Logical Ability
  [['Software Engineering Studio', 5], ['Systems Architecture Consultancy', 4], ['Algorithm & Automation Lab', 4], ['Operations Research Firm', 4], ['Cybersecurity Services', 4], ['AI / Machine Learning Lab', 5], ['Process Automation Consultancy', 4], ['Technical Strategy Consulting', 4], ['QA & Testing Services', 3], ['Product Engineering Team', 4], ['IT Solutions Company', 4]],
  // Verbal Ability
  [['Content & Copywriting Studio', 5], ['Legal & Compliance Services', 4], ['Editorial & Publishing House', 4], ['Communications Consultancy', 4], ['Translation & Localization', 4], ['Public Speaking & Training', 4], ['Journalism & Media Agency', 3], ['Technical Writing Services', 4], ['Brand Messaging Agency', 4], ['Language Education Startup', 4], ['Corporate Communications Firm', 4]],
];

// Business recommendation for a (row, col) trait pair.
function sampleCell(rowName, colName) {
  const ri = TRAITS.indexOf(rowName);
  const ci = TRAITS.indexOf(colName);
  if (ri >= 0 && ri < 8 && ci >= 0 && ci < 8) return GRID8[ri][ci];
  // Aptitude-involving: theme by the aptitude side (row wins if both aptitude),
  // varied by the other trait's index.
  const aptIdx = ri >= 8 ? ri : (ci >= 8 ? ci : -1);
  if (aptIdx >= 0) {
    const pool = APTITUDE_POOLS[aptIdx - 8];
    const other = aptIdx === ri ? ci : ri;
    return pool[((other % pool.length) + pool.length) % pool.length];
  }
  // Unknown/custom types on both axes — a safe generic.
  return [`${rowName} Venture`.slice(0, 80), 3];
}

// Populates the matrix with sample cells for EVERY active QuestionType pair.
// Assumes an active mongoose connection; clears existing cells first (idempotent).
async function seedSampleMatrix() {
  const types = await QuestionType.find({ isActive: true }).sort({ order: 1 });
  if (types.length < 2) {
    const err = new Error('Need at least 2 active question types to build the matrix. Seed the question types first.');
    err.code = 'MISSING_TYPES';
    throw err;
  }
  const { deletedCount } = await BusinessMatrixCell.deleteMany({});
  const docs = [];
  for (const row of types) {
    for (const col of types) {
      const [businessName, rating] = sampleCell(row.name, col.name);
      docs.push({ rowTypeId: row._id, colTypeId: col._id, businessName: String(businessName).slice(0, 80), rating, isActive: true });
    }
  }
  await BusinessMatrixCell.insertMany(docs);
  return { created: docs.length, cleared: deletedCount };
}

module.exports = { TRAITS, sampleCell, seedSampleMatrix };
