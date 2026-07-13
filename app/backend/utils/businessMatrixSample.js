// Shared sample data for the Business Matrix — a full 8x8 grid over the eight
// personality traits (QuestionType categories order 1-8), each cell a
// business/career recommendation matched to its row-trait x column-trait pair.
// Used by both scripts/seedBusinessMatrixDummy.js and the admin
// POST /business-matrix/seed-sample endpoint.
const QuestionType = require('../models/QuestionType');
const BusinessMatrixCell = require('../models/BusinessMatrixCell');

const TRAITS = [
  'Communication', 'Creativity', 'Problem Solving', 'Leadership',
  'Risk Taking', 'Financial Awareness', 'Business Mindset', 'Teamwork',
];

// GRID[row][col] = [businessName, rating 1-5]. maxlength(businessName) is 80.
const GRID = [
  [['Public Relations Agency', 5], ['Advertising & Branding Studio', 4], ['Management Consulting', 4], ['Corporate Training & Coaching', 4], ['Media & PR Startup', 3], ['Investor Relations Firm', 3], ['Sales & Marketing Agency', 5], ['Community Engagement Platform', 4]],
  [['Content & Storytelling Studio', 4], ['Design Studio', 5], ['Product Design Lab', 4], ['Creative Direction Agency', 4], ['Experimental Media Startup', 3], ['Creative Monetization Consultancy', 3], ['Innovation & R&D Venture', 4], ['Collaborative Arts Collective', 3]],
  [['Technical Advisory Services', 4], ['R&D Innovation Lab', 4], ['Analytics & Research Firm', 5], ['Operations Strategy Consulting', 4], ['Deep-Tech Startup', 4], ['Quantitative Analysis Firm', 4], ['Process Optimization Consultancy', 4], ['Engineering Services Company', 4]],
  [['Executive Coaching Practice', 4], ['Creative Agency Leadership', 3], ['Turnaround Management Firm', 4], ['Corporate Strategy Consulting', 5], ['Startup Founder / Venture', 5], ['Private Equity Management', 4], ['Franchise / Business Ownership', 4], ['Team Leadership & HR Consulting', 4]],
  [['Sales-Driven Startup', 3], ['Disruptive Tech Startup', 4], ['FinTech Venture', 4], ['Entrepreneur / Founder', 5], ['Angel Investing & Trading', 5], ['Investment & Trading Firm', 4], ['Startup Incubator', 4], ['Co-Founder Venture Team', 4]],
  [['Financial Advisory Firm', 4], ['FinTech Product Studio', 3], ['Investment Analysis Firm', 5], ['Wealth Management Practice', 4], ['Trading & Investment Desk', 4], ['Accounting & Audit Firm', 5], ['Financial Consulting Business', 4], ['Cooperative Finance / Fund', 3]],
  [['Marketing & Growth Agency', 4], ['Product Startup', 4], ['Business Consulting Firm', 5], ['Enterprise Founder / CEO', 5], ['High-Growth Startup', 5], ['Business Investment Firm', 4], ['Serial Entrepreneurship', 5], ['Franchise Network Business', 4]],
  [['HR & People Operations', 4], ['Creative Studio Collective', 3], ['Agile Engineering Team', 4], ['Team Management Consultancy', 4], ['Startup Co-Founding Team', 3], ['Cooperative Business / Fund', 3], ['Partnership Enterprise', 4], ['Collaborative Services Firm', 5]],
];

// Populates the matrix with the sample grid. Assumes an active mongoose
// connection. Clears existing cells first (idempotent — always converges on
// this exact dataset). Throws with code 'MISSING_TYPES' if the 8 trait
// QuestionTypes don't exist yet.
async function seedSampleMatrix() {
  const types = await QuestionType.find({ isActive: true });
  const byName = new Map(types.map((t) => [t.name, t]));
  const missing = TRAITS.filter((name) => !byName.has(name));
  if (missing.length) {
    const err = new Error(`Missing question type(s): ${missing.join(', ')}. Seed the main question types first.`);
    err.code = 'MISSING_TYPES';
    throw err;
  }
  const { deletedCount } = await BusinessMatrixCell.deleteMany({});
  const docs = [];
  for (let ri = 0; ri < TRAITS.length; ri++) {
    for (let ci = 0; ci < TRAITS.length; ci++) {
      const [businessName, rating] = GRID[ri][ci];
      docs.push({ rowTypeId: byName.get(TRAITS[ri])._id, colTypeId: byName.get(TRAITS[ci])._id, businessName, rating, isActive: true });
    }
  }
  await BusinessMatrixCell.insertMany(docs);
  return { created: docs.length, cleared: deletedCount };
}

module.exports = { TRAITS, GRID, seedSampleMatrix };
