const bcrypt = require('bcryptjs');

const Admin = require('../models/Admin');
const QuestionType = require('../models/QuestionType');
const Question = require('../models/Question');
const AnswerOption = require('../models/AnswerOption');
const SharedUserID = require('../models/SharedUserID');

// The first 8 category names deliberately match 8 of the 12 Question.DIMENSIONS
// values exactly, so each Likert question's `dimension` is just its category's
// name — see QUESTIONS below.
const QUESTION_TYPES = [
  { name: 'Communication', description: 'Ability to express ideas clearly and listen actively', icon: '💬', color: '#3B82F6', order: 1 },
  { name: 'Creativity', description: 'Ability to generate novel ideas and think outside the box', icon: '💡', color: '#8B5CF6', order: 2 },
  { name: 'Problem Solving', description: 'Ability to analyse situations and devise effective solutions', icon: '🔧', color: '#F59E0B', order: 3 },
  { name: 'Leadership', description: 'Ability to guide, motivate, and inspire others', icon: '🏆', color: '#EF4444', order: 4 },
  { name: 'Risk Taking', description: 'Willingness to take calculated risks for potential gain', icon: '🎯', color: '#EC4899', order: 5 },
  { name: 'Financial Awareness', description: 'Understanding of financial principles and money management', icon: '💰', color: '#10B981', order: 6 },
  { name: 'Business Mindset', description: 'Orientation towards opportunity identification and value creation', icon: '📊', color: '#F97316', order: 7 },
  { name: 'Teamwork', description: 'Ability to collaborate effectively within a group', icon: '🤝', color: '#06B6D4', order: 8 },
  // House the aptitude question types — distinct from the personality/EQ
  // categories above, which stay pure LIKERT_SCALE.
  { name: 'Numerical Ability', description: 'Aptitude in numerical and quantitative reasoning', icon: '🔢', color: '#0EA5E9', order: 9 },
  { name: 'Logical Ability', description: 'Aptitude in logical and pattern-based reasoning', icon: '🧩', color: '#22C55E', order: 10 },
  { name: 'Verbal Ability', description: 'Aptitude in language and verbal reasoning', icon: '📝', color: '#A855F7', order: 11 },
];

const QUESTIONS = [
  // Communication (5)
  { typeIdx: 0, text: 'When presenting an idea to a group, you feel confident and clear in your delivery.', order: 1 },
  { typeIdx: 0, text: 'You actively listen to others and ask clarifying questions before responding.', order: 2 },
  { typeIdx: 0, text: 'You can adapt your communication style to suit different audiences.', order: 3 },
  { typeIdx: 0, text: 'You effectively use written communication to convey complex information.', order: 4 },
  { typeIdx: 0, text: 'You handle disagreements by listening to all perspectives before responding.', order: 5 },

  // Creativity (5)
  { typeIdx: 1, text: 'You regularly come up with new and original solutions to everyday problems.', order: 6 },
  { typeIdx: 1, text: 'You enjoy experimenting with new approaches even if they might not work.', order: 7 },
  { typeIdx: 1, text: 'You draw inspiration from unrelated fields to solve problems in your area.', order: 8 },
  { typeIdx: 1, text: 'You brainstorm multiple options before settling on the best solution.', order: 9 },
  { typeIdx: 1, text: 'You are often described as an innovative or out-of-the-box thinker.', order: 10 },

  // Problem Solving (5)
  { typeIdx: 2, text: 'When facing a complex problem, you break it down into smaller, manageable parts.', order: 11 },
  { typeIdx: 2, text: 'You remain calm and focused when confronted with unexpected challenges.', order: 12 },
  { typeIdx: 2, text: 'You gather relevant data before making important decisions.', order: 13 },
  { typeIdx: 2, text: 'You evaluate the pros and cons of multiple solutions before choosing one.', order: 14 },
  { typeIdx: 2, text: 'You learn from past mistakes and adjust your approach accordingly.', order: 15 },

  // Leadership (5)
  { typeIdx: 3, text: 'You naturally take charge and guide others when working in a group setting.', order: 16 },
  { typeIdx: 3, text: 'You motivate team members to perform at their best even during difficult times.', order: 17 },
  { typeIdx: 3, text: 'You set clear goals and communicate expectations effectively to your team.', order: 18 },
  { typeIdx: 3, text: 'You take responsibility for team outcomes, both successes and failures.', order: 19 },
  { typeIdx: 3, text: 'You identify and nurture the strengths of people around you.', order: 20 },

  // Risk Taking (5)
  { typeIdx: 4, text: 'You are comfortable making decisions with incomplete information.', order: 21 },
  { typeIdx: 4, text: 'You have pursued an opportunity even when the outcome was uncertain.', order: 22 },
  { typeIdx: 4, text: 'You view failure as a learning experience rather than a setback.', order: 23 },
  { typeIdx: 4, text: 'You are willing to invest time and resources into an unproven idea.', order: 24 },
  { typeIdx: 4, text: 'You take calculated risks by weighing potential gains against possible losses.', order: 25 },

  // Financial Awareness (5)
  { typeIdx: 5, text: 'You maintain a budget and track your income and expenses regularly.', order: 26 },
  { typeIdx: 5, text: 'You understand the difference between assets, liabilities, profit, and loss.', order: 27 },
  { typeIdx: 5, text: 'You plan for long-term financial goals rather than focusing only on short-term needs.', order: 28 },
  { typeIdx: 5, text: 'You understand how pricing and margins affect business profitability.', order: 29 },
  { typeIdx: 5, text: 'You are aware of basic tax obligations and financial regulations for businesses.', order: 30 },

  // Business Mindset (5)
  { typeIdx: 6, text: 'You regularly identify gaps in the market and think about ways to fill them.', order: 31 },
  { typeIdx: 6, text: 'You focus on creating value for customers as the core of any business activity.', order: 32 },
  { typeIdx: 6, text: 'You think about scalability and long-term sustainability when planning a venture.', order: 33 },
  { typeIdx: 6, text: 'You stay updated on market trends and competitor activities in your field.', order: 34 },
  { typeIdx: 6, text: 'You naturally think about how to monetise ideas or skills you possess.', order: 35 },

  // Teamwork (5)
  { typeIdx: 7, text: 'You contribute actively and positively when working in a team environment.', order: 36 },
  { typeIdx: 7, text: 'You respect diverse opinions and encourage everyone\'s participation in discussions.', order: 37 },
  { typeIdx: 7, text: 'You support team members who are struggling without being asked.', order: 38 },
  { typeIdx: 7, text: 'You put the team\'s success above personal recognition when necessary.', order: 39 },
  { typeIdx: 7, text: 'You handle conflicts within the team constructively and professionally.', order: 40 },
];

const LIKERT = [
  { optionText: 'Strongly Disagree', score: 1, order: 1 },
  { optionText: 'Disagree', score: 2, order: 2 },
  { optionText: 'Neutral', score: 3, order: 3 },
  { optionText: 'Agree', score: 4, order: 4 },
  { optionText: 'Strongly Agree', score: 5, order: 5 },
];

// One example question per non-Likert questionType, so every type has real,
// meaningful seed content instead of only ever being exercised via LIKERT_SCALE.
// `typeIdx` refers to QUESTION_TYPES above (Business Mindset for the
// decision/ranking-style types, the 3 aptitude categories for the rest).
const EXTRA_QUESTIONS = [
  {
    // marks matches the best option's dimensionScores sum (14), not an
    // arbitrary value — evaluateSituational scores/derives its max straight
    // from the options themselves (see evaluationEngine.js), so `marks` here
    // must agree with that ceiling for categoryQuestionMax to stay correct.
    typeIdx: 6, order: 41, questionType: 'SITUATIONAL', dimension: 'Communication', marks: 14,
    text: 'A customer is angry about a late delivery. What will you do?',
    options: [
      { optionText: 'Listen calmly and solve the issue', score: 14, dimensionScores: { Communication: 5, 'Emotional Intelligence': 5, 'Problem Solving': 4 }, order: 1 },
      { optionText: 'Blame the delivery team', score: 2, dimensionScores: { Communication: 1, Leadership: 1 }, order: 2 },
      { optionText: 'Ignore the customer', score: 0, dimensionScores: { Communication: 0 }, order: 3 },
      { optionText: 'Cancel the order', score: 1, dimensionScores: { 'Risk Taking': 1 }, order: 4 },
    ],
  },
  {
    typeIdx: 8, order: 42, questionType: 'NUMERICAL_ABILITY', dimension: 'Numerical Ability', marks: 5, timeLimitSeconds: 60,
    text: 'Sakshi completes a specified work in 20 days. Tanya is 25% more efficient than Sakshi. The number of days taken by Tanya to complete the work is:',
    explanation: 'Efficiency ratio 5:4 means the time ratio is 4:5, so Tanya takes 20 × 4/5 = 16 days.',
    options: [
      { optionText: '15', score: 0, isCorrect: false, order: 1 },
      { optionText: '16', score: 5, isCorrect: true, order: 2 },
      { optionText: '18', score: 0, isCorrect: false, order: 3 },
      { optionText: '19', score: 0, isCorrect: false, order: 4 },
    ],
  },
  {
    typeIdx: 8, order: 43, questionType: 'PERCENTAGE_TYPE', dimension: 'Numerical Ability', marks: 5, difficulty: 'easy',
    text: 'Cost price ₹1000, profit 20%. What is the selling price?',
    options: [
      { optionText: '₹1000', score: 0, isCorrect: false, order: 1 },
      { optionText: '₹1100', score: 0, isCorrect: false, order: 2 },
      { optionText: '₹1200', score: 5, isCorrect: true, order: 3 },
      { optionText: '₹1400', score: 0, isCorrect: false, order: 4 },
    ],
  },
  {
    typeIdx: 9, order: 44, questionType: 'PUZZLE_TYPE', dimension: 'Logical Ability', marks: 5,
    text: 'Find the missing number in the series: 2, 6, 12, 20, ?, 42',
    explanation: 'Each term is n×(n+1): 1×2, 2×3, 3×4, 4×5, 5×6=30, 6×7=42.',
    options: [
      { optionText: '28', score: 0, isCorrect: false, order: 1 },
      { optionText: '30', score: 5, isCorrect: true, order: 2 },
      { optionText: '32', score: 0, isCorrect: false, order: 3 },
      { optionText: '36', score: 0, isCorrect: false, order: 4 },
    ],
  },
  {
    typeIdx: 9, order: 45, questionType: 'LOGICAL_ABILITY', dimension: 'Logical Ability', marks: 5, timeLimitSeconds: 45,
    text: 'Find the missing term: ELFA, GLHA, ILJA, ____, MLNA',
    explanation: 'First letters skip by 2 (E,G,I,K,M), second letter is always L, third letters skip by 2 (F,H,J,L,N), fourth letter is always A — so the missing term is KLLA.',
    options: [
      { optionText: 'OLPA', score: 0, isCorrect: false, order: 1 },
      { optionText: 'KLMA', score: 0, isCorrect: false, order: 2 },
      { optionText: 'LLMA', score: 0, isCorrect: false, order: 3 },
      { optionText: 'KLLA', score: 5, isCorrect: true, order: 4 },
    ],
  },
  {
    typeIdx: 10, order: 46, questionType: 'VERBAL_ABILITY', dimension: 'Verbal Ability', marks: 5,
    instructionText: 'Replace the underlined words with the right option.',
    text: 'The results of this study are greater than any other study conducted previously.',
    options: [
      { optionText: 'greater than that of any other', score: 0, isCorrect: false, order: 1 },
      { optionText: 'greatest among any other', score: 0, isCorrect: false, order: 2 },
      { optionText: 'greater than all other', score: 0, isCorrect: false, order: 3 },
      { optionText: 'greater than those of any other', score: 5, isCorrect: true, order: 4 },
      { optionText: 'No correction required', score: 0, isCorrect: false, order: 5 },
    ],
  },
  {
    typeIdx: 9, order: 47, questionType: 'IMAGE_BASED', dimension: 'Logical Ability', marks: 5,
    instructionText: 'What do you see in this image?',
    text: 'Identify the number shown in the image below.',
    imageUrl: 'https://placehold.co/400x300?text=74',
    options: [
      { optionText: '21', score: 0, isCorrect: false, order: 1 },
      { optionText: '75', score: 0, isCorrect: false, order: 2 },
      { optionText: '95', score: 0, isCorrect: false, order: 3 },
      { optionText: '94', score: 0, isCorrect: false, order: 4 },
      { optionText: '74', score: 5, isCorrect: true, order: 5 },
    ],
  },
  {
    typeIdx: 6, order: 48, questionType: 'MULTI_SELECT', dimension: 'Business Mindset', marks: 5, scoringMode: 'partial',
    text: 'Which of the following are traits of a strong business mindset? (Select all that apply)',
    options: [
      { optionText: 'Identifying market gaps', score: 0, isCorrect: true, order: 1 },
      { optionText: 'Avoiding all risks entirely', score: 0, isCorrect: false, order: 2 },
      { optionText: 'Focusing on customer value creation', score: 0, isCorrect: true, order: 3 },
      { optionText: 'Ignoring market trends', score: 0, isCorrect: false, order: 4 },
    ],
  },
  {
    typeIdx: 6, order: 49, questionType: 'RANKING', dimension: 'Business Mindset', marks: 5,
    text: 'Rank these startup priorities from most important (1) to least important (4) when starting a new business.',
    // Options are stored in their ideal order — deriveAnswerKeyFields (see
    // adminCRUDController.js) reads idealOrder straight off this sequence.
    options: [
      { optionText: 'Validate the idea with real customers', score: 0, order: 1 },
      { optionText: 'Build a minimum viable product', score: 0, order: 2 },
      { optionText: 'Set up a company logo and branding', score: 0, order: 3 },
      { optionText: 'Print business cards', score: 0, order: 4 },
    ],
  },
];

async function seedDatabase({ adminEmail, adminPassword, log = () => {} } = {}) {
  adminEmail = adminEmail || process.env.ADMIN_EMAIL || 'admin@tamilbusinesstribe.com';
  adminPassword = adminPassword || process.env.ADMIN_PASSWORD || 'Admin@123';

  const existingAdmin = await Admin.findOne({ email: adminEmail });
  if (!existingAdmin) {
    await Admin.create({ email: adminEmail, passwordHash: await bcrypt.hash(adminPassword, 10) });
    log(`Admin created: ${adminEmail} / ${adminPassword}`);
  } else {
    log('Admin already exists, skipping.');
  }

  const typeIds = [];
  for (const qt of QUESTION_TYPES) {
    const existing = await QuestionType.findOne({ order: qt.order });
    if (existing) { typeIds.push(existing._id); continue; }
    const doc = await QuestionType.create(qt);
    typeIds.push(doc._id);
  }
  log(`Question types: ${typeIds.length}`);

  let qCount = 0, oCount = 0;
  for (const q of QUESTIONS) {
    const dimension = QUESTION_TYPES[q.typeIdx].name;
    const existing = await Question.findOne({ order: q.order });
    if (existing) {
      const hasOptions = await AnswerOption.countDocuments({ questionId: existing._id });
      if (!hasOptions) {
        const opts = LIKERT.map(l => ({ questionId: existing._id, ...l }));
        await AnswerOption.insertMany(opts);
        oCount += LIKERT.length;
      }
      continue;
    }
    const doc = await Question.create({ typeId: typeIds[q.typeIdx], text: q.text, order: q.order, dimension });
    const opts = LIKERT.map(l => ({ questionId: doc._id, ...l }));
    await AnswerOption.insertMany(opts);
    qCount++;
    oCount += LIKERT.length;
  }
  log(`Likert questions created: ${qCount} | Answer options created: ${oCount}`);

  // Answer key fields (correctOptionId/correctOptionIds/idealOrder) are
  // derived from the saved options exactly like adminCRUDController's
  // deriveAnswerKeyFields does for admin-authored questions — kept as a
  // small local copy here since importing a controller into a script is
  // more coupling than this seed data needs.
  const SINGLE_CORRECT_TYPES = ['NUMERICAL_ABILITY', 'PERCENTAGE_TYPE', 'PUZZLE_TYPE', 'LOGICAL_ABILITY', 'VERBAL_ABILITY', 'IMAGE_BASED'];
  let extraCount = 0;
  for (const q of EXTRA_QUESTIONS) {
    const existing = await Question.findOne({ order: q.order });
    if (existing) continue;
    const { typeIdx, options, ...fields } = q;
    const doc = await Question.create({ ...fields, typeId: typeIds[typeIdx] });
    const savedOptions = await AnswerOption.insertMany(options.map(o => ({ ...o, questionId: doc._id })));

    if (SINGLE_CORRECT_TYPES.includes(q.questionType)) {
      const correct = savedOptions.find(o => o.isCorrect);
      doc.correctOptionId = correct ? correct._id : null;
    } else if (q.questionType === 'MULTI_SELECT') {
      doc.correctOptionIds = savedOptions.filter(o => o.isCorrect).map(o => o._id);
    } else if (q.questionType === 'RANKING') {
      doc.idealOrder = savedOptions.sort((a, b) => a.order - b.order).map(o => o._id);
    }
    await doc.save();
    extraCount++;
  }
  log(`Example questions created for all other question types: ${extraCount}`);

  const demoCode = await SharedUserID.findOne({ code: 'TBT2024' });
  if (!demoCode) {
    const admin = await Admin.findOne({ email: adminEmail });
    await SharedUserID.create({ code: 'TBT2024', label: 'Tamil Business Tribe 2024 Cohort', createdBy: admin._id });
    log('Demo shared code TBT2024 created.');
  }
}

module.exports = { seedDatabase, QUESTION_TYPES, QUESTIONS, LIKERT, EXTRA_QUESTIONS };
