require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const Admin = require('../models/Admin');
const QuestionType = require('../models/QuestionType');
const Question = require('../models/Question');
const AnswerOption = require('../models/AnswerOption');
const SharedUserID = require('../models/SharedUserID');

const QUESTION_TYPES = [
  { name: 'Communication', description: 'Ability to express ideas clearly and listen actively', icon: '💬', color: '#3B82F6', order: 1 },
  { name: 'Creativity', description: 'Ability to generate novel ideas and think outside the box', icon: '💡', color: '#8B5CF6', order: 2 },
  { name: 'Problem Solving', description: 'Ability to analyse situations and devise effective solutions', icon: '🔧', color: '#F59E0B', order: 3 },
  { name: 'Leadership', description: 'Ability to guide, motivate, and inspire others', icon: '🏆', color: '#EF4444', order: 4 },
  { name: 'Risk Taking', description: 'Willingness to take calculated risks for potential gain', icon: '🎯', color: '#EC4899', order: 5 },
  { name: 'Financial Awareness', description: 'Understanding of financial principles and money management', icon: '💰', color: '#10B981', order: 6 },
  { name: 'Business Mindset', description: 'Orientation towards opportunity identification and value creation', icon: '📊', color: '#F97316', order: 7 },
  { name: 'Teamwork', description: 'Ability to collaborate effectively within a group', icon: '🤝', color: '#06B6D4', order: 8 },
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
  { label: 'Strongly Disagree', marks: 1, order: 1 },
  { label: 'Disagree', marks: 2, order: 2 },
  { label: 'Neutral', marks: 3, order: 3 },
  { label: 'Agree', marks: 4, order: 4 },
  { label: 'Strongly Agree', marks: 5, order: 5 },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('Connected to MongoDB.');

  // Admin
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@tamilbusinesstribe.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
  const existingAdmin = await Admin.findOne({ email: adminEmail });
  if (!existingAdmin) {
    await Admin.create({ email: adminEmail, passwordHash: await bcrypt.hash(adminPassword, 10) });
    console.log(`Admin created: ${adminEmail} / ${adminPassword}`);
  } else {
    console.log('Admin already exists, skipping.');
  }

  // Question Types
  const typeIds = [];
  for (const qt of QUESTION_TYPES) {
    const existing = await QuestionType.findOne({ order: qt.order });
    if (existing) { typeIds.push(existing._id); continue; }
    const doc = await QuestionType.create(qt);
    typeIds.push(doc._id);
  }
  console.log(`Question types: ${typeIds.length}`);

  // Questions + Answer Options
  let qCount = 0, oCount = 0;
  for (const q of QUESTIONS) {
    const existing = await Question.findOne({ order: q.order });
    if (existing) {
      const hasOptions = await AnswerOption.countDocuments({ questionId: existing._id });
      if (!hasOptions) {
        const opts = LIKERT.map(l => ({ questionId: existing._id, ...l }));
        await AnswerOption.insertMany(opts);
        oCount += 5;
      }
      continue;
    }
    const doc = await Question.create({ typeId: typeIds[q.typeIdx], text: q.text, order: q.order });
    const opts = LIKERT.map(l => ({ questionId: doc._id, ...l }));
    await AnswerOption.insertMany(opts);
    qCount++;
    oCount += 5;
  }
  console.log(`Questions created: ${qCount} | Answer options created: ${oCount}`);

  // Demo Shared User ID
  const demoCode = await SharedUserID.findOne({ code: 'TBT2024' });
  if (!demoCode) {
    const admin = await Admin.findOne({ email: adminEmail });
    await SharedUserID.create({ code: 'TBT2024', label: 'Tamil Business Tribe 2024 Cohort', createdBy: admin._id });
    console.log('Demo shared code TBT2024 created.');
  }

  console.log('\nSeed complete!');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
