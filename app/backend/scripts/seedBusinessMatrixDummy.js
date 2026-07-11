/**
 * Populates the Business Matrix with a full 8x8 grid over the eight personality
 * traits (the QuestionType categories order 1-8: Communication..Teamwork). Each
 * cell (rowTrait x colTrait) gets a business/career recommendation that actually
 * reflects the pair of traits it crosses — e.g. Leadership x Risk Taking =>
 * "Startup Founder / Venture" — so the demo data reads as question-related
 * rather than arbitrary. The three aptitude types (Numerical/Logical/Verbal,
 * order 9-11) are intentionally excluded: business fit is driven by the
 * personality/EQ traits, not raw aptitude.
 *
 * Traits are looked up by name (not by list position), so it stays correct even
 * though there are now 11 active QuestionTypes rather than 8.
 *
 * Safe to re-run: clears existing cells first, so it always converges on this
 * exact dataset rather than layering on top of previous seeds.
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');

const QuestionType = require('../models/QuestionType');
const BusinessMatrixCell = require('../models/BusinessMatrixCell');

// Canonical row/column order for the matrix (must match QuestionType names).
const TRAITS = [
  'Communication',      // 0
  'Creativity',         // 1
  'Problem Solving',    // 2
  'Leadership',         // 3
  'Risk Taking',        // 4
  'Financial Awareness',// 5
  'Business Mindset',   // 6
  'Teamwork',           // 7
];

// GRID[row][col] = [businessName, rating 1-5]. Row = dominant trait, column =
// supporting trait. Diagonal cells (a trait paired with itself) name a business
// that leans purely on that single strength. maxlength(businessName) is 80.
const GRID = [
  // 0 Communication x ...
  [
    ['Public Relations Agency', 5], ['Advertising & Branding Studio', 4], ['Management Consulting', 4],
    ['Corporate Training & Coaching', 4], ['Media & PR Startup', 3], ['Investor Relations Firm', 3],
    ['Sales & Marketing Agency', 5], ['Community Engagement Platform', 4],
  ],
  // 1 Creativity x ...
  [
    ['Content & Storytelling Studio', 4], ['Design Studio', 5], ['Product Design Lab', 4],
    ['Creative Direction Agency', 4], ['Experimental Media Startup', 3], ['Creative Monetization Consultancy', 3],
    ['Innovation & R&D Venture', 4], ['Collaborative Arts Collective', 3],
  ],
  // 2 Problem Solving x ...
  [
    ['Technical Advisory Services', 4], ['R&D Innovation Lab', 4], ['Analytics & Research Firm', 5],
    ['Operations Strategy Consulting', 4], ['Deep-Tech Startup', 4], ['Quantitative Analysis Firm', 4],
    ['Process Optimization Consultancy', 4], ['Engineering Services Company', 4],
  ],
  // 3 Leadership x ...
  [
    ['Executive Coaching Practice', 4], ['Creative Agency Leadership', 3], ['Turnaround Management Firm', 4],
    ['Corporate Strategy Consulting', 5], ['Startup Founder / Venture', 5], ['Private Equity Management', 4],
    ['Franchise / Business Ownership', 4], ['Team Leadership & HR Consulting', 4],
  ],
  // 4 Risk Taking x ...
  [
    ['Sales-Driven Startup', 3], ['Disruptive Tech Startup', 4], ['FinTech Venture', 4],
    ['Entrepreneur / Founder', 5], ['Angel Investing & Trading', 5], ['Investment & Trading Firm', 4],
    ['Startup Incubator', 4], ['Co-Founder Venture Team', 4],
  ],
  // 5 Financial Awareness x ...
  [
    ['Financial Advisory Firm', 4], ['FinTech Product Studio', 3], ['Investment Analysis Firm', 5],
    ['Wealth Management Practice', 4], ['Trading & Investment Desk', 4], ['Accounting & Audit Firm', 5],
    ['Financial Consulting Business', 4], ['Cooperative Finance / Fund', 3],
  ],
  // 6 Business Mindset x ...
  [
    ['Marketing & Growth Agency', 4], ['Product Startup', 4], ['Business Consulting Firm', 5],
    ['Enterprise Founder / CEO', 5], ['High-Growth Startup', 5], ['Business Investment Firm', 4],
    ['Serial Entrepreneurship', 5], ['Franchise Network Business', 4],
  ],
  // 7 Teamwork x ...
  [
    ['HR & People Operations', 4], ['Creative Studio Collective', 3], ['Agile Engineering Team', 4],
    ['Team Management Consultancy', 4], ['Startup Co-Founding Team', 3], ['Cooperative Business / Fund', 3],
    ['Partnership Enterprise', 4], ['Collaborative Services Firm', 5],
  ],
];

async function run() {
  await mongoose.connect(process.env.MONGO_URI);

  const types = await QuestionType.find({ isActive: true });
  const byName = new Map(types.map((t) => [t.name, t]));

  const missing = TRAITS.filter((name) => !byName.has(name));
  if (missing.length) {
    console.log(`Missing question type(s): ${missing.join(', ')}. Run the main seed first. Aborting.`);
    await mongoose.disconnect();
    return;
  }

  const { deletedCount } = await BusinessMatrixCell.deleteMany({});
  console.log(`Cleared ${deletedCount} existing cell(s).`);

  let created = 0;
  for (let ri = 0; ri < TRAITS.length; ri++) {
    for (let ci = 0; ci < TRAITS.length; ci++) {
      const [businessName, rating] = GRID[ri][ci];
      await BusinessMatrixCell.create({
        rowTypeId: byName.get(TRAITS[ri])._id,
        colTypeId: byName.get(TRAITS[ci])._id,
        businessName,
        rating,
        isActive: true,
      });
      created++;
    }
  }

  console.log(`Business matrix seed done: ${created} cells created (full 8x8 trait grid, each cell a recommendation matched to its trait pair).`);
  await mongoose.disconnect();
}

run().catch((err) => { console.error(err); process.exit(1); });
