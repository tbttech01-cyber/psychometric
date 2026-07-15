const { getRecommendations } = require('./businessRecommendationEngine');

const BUSINESS_MAP = {
  'Communication':       ['Consulting', 'Coaching', 'Sales Business', 'Public Speaking Business'],
  'Creativity':          ['Digital Marketing', 'Event Management', 'Content Creation', 'Design Agency'],
  'Problem Solving':     ['IT Services', 'Tech Consulting', 'Legal Services', 'Research Firm'],
  'Leadership':          ['Service Business', 'Team-based Business', 'Management Consulting', 'HR Services'],
  'Risk Taking':         ['Startup', 'E-commerce', 'Trading', 'Venture Investment', 'Franchise'],
  'Financial Awareness': ['Retail', 'Franchise', 'Manufacturing', 'Accounting Services', 'Fintech'],
  'Business Mindset':    ['E-commerce', 'Scalable Business', 'Import/Export', 'B2B Services'],
  'Teamwork':            ['Event Management', 'Agency Business', 'Co-operative Business', 'Sports Management'],
};

const IMPROVEMENT_SUGGESTIONS = {
  'Communication':       'Practice public speaking, join groups like Toastmasters, and work on active listening and written communication skills.',
  'Creativity':          'Engage with design thinking exercises, explore creative hobbies, and practice brainstorming techniques daily.',
  'Problem Solving':     'Take up logic puzzles, study case studies, and practice structured problem-solving frameworks like 5 Whys and SWOT.',
  'Leadership':          'Seek leadership roles in groups, study influential leaders, and work on emotional intelligence and conflict resolution.',
  'Risk Taking':         'Start with small calculated risks, study risk management frameworks, and build your risk tolerance incrementally.',
  'Financial Awareness': 'Study personal finance, take basic accounting courses, and practice reading financial statements regularly.',
  'Business Mindset':    'Follow entrepreneurship content, study market trends, and develop a customer-centric thinking approach.',
  'Teamwork':            'Participate in team projects, volunteer for collaborative initiatives, and study team dynamics and group psychology.',
};

// Percentage-based (not absolute points) so these stay correct no matter how
// many categories/questions exist — 80/60/40% matches the original 160/120/80
// thresholds exactly for the default 8-category, 200-point setup.
function getLevel(percentage) {
  if (percentage >= 80) return 'Excellent';
  if (percentage >= 60) return 'Good';
  if (percentage >= 40) return 'Average';
  return 'Needs Improvement';
}

function getLevelExplanation(level, highestCategory) {
  const cat = highestCategory[0] || 'multiple areas';
  const map = {
    'Excellent':          `Outstanding entrepreneurial potential! You demonstrate strong traits across most dimensions, with particular strength in ${cat}. You are well-positioned to launch and grow a successful business venture.`,
    'Good':               `Strong entrepreneurial traits with some areas to develop. Your strength in ${cat} is a solid foundation. With focused development in your lower-scoring areas, you can reach your full entrepreneurial potential.`,
    'Average':            `Moderate entrepreneurial potential identified. You show promising traits in ${cat}, but specific areas need focused attention before pursuing entrepreneurial ventures.`,
    'Needs Improvement':  `Foundational development is recommended before pursuing entrepreneurship. Focus on the improvement areas below to build the traits needed for business success.`,
  };
  return map[level];
}

// Dimension groupings for the composite scores shown on the final report.
// These groupings aren't specified anywhere else — they're a deliberate,
// documented choice: aptitude = the 3 timed/aptitude dimensions, personality
// = the "soft skill" EQ-style dimensions, business mindset = the two most
// directly business-risk-related dimensions, financial awareness stands
// alone since nothing else measures it.
const APTITUDE_DIMENSIONS = ['Numerical Ability', 'Logical Ability', 'Verbal Ability'];
const PERSONALITY_DIMENSIONS = ['Communication', 'Leadership', 'Teamwork', 'Creativity', 'Emotional Intelligence'];
const BUSINESS_MINDSET_DIMENSIONS = ['Business Mindset', 'Risk Taking'];
const FINANCIAL_AWARENESS_DIMENSIONS = ['Financial Awareness'];

// Shared by assessmentController.submitAssessment (the real submit path) and
// seedDummyData.js (so dummy fixtures are scored with the exact same logic
// instead of a hand-rolled duplicate). `situationalOptsByQ` maps a
// SITUATIONAL question's id to its full AnswerOption list — every other
// type's max is just its own `marks` added to its single `dimension`.
function computeQuestionMaxes(allActiveQuestions, typeMap, situationalOptsByQ = {}) {
  const categoryQuestionMax = {};
  for (const q of allActiveQuestions) {
    const name = typeMap[q.typeId.toString()];
    if (!name) continue;
    categoryQuestionMax[name] = (categoryQuestionMax[name] || 0) + q.marks;
  }

  const dimensionQuestionMax = {};
  for (const q of allActiveQuestions) {
    if (q.questionType === 'SITUATIONAL') {
      const opts = situationalOptsByQ[q._id.toString()] || [];
      const dims = new Set();
      opts.forEach((o) => Object.keys(o.dimensionScores || {}).forEach((d) => dims.add(d)));
      for (const dim of dims) {
        const maxForDim = Math.max(0, ...opts.map((o) => (o.dimensionScores && o.dimensionScores[dim]) || 0));
        dimensionQuestionMax[dim] = (dimensionQuestionMax[dim] || 0) + maxForDim;
      }
    } else if (q.dimension) {
      dimensionQuestionMax[q.dimension] = (dimensionQuestionMax[q.dimension] || 0) + q.marks;
    }
  }

  return { categoryQuestionMax, dimensionQuestionMax };
}

function avgOf(dimensionPercentages, dims) {
  if (!dims.length) return 0;
  const sum = dims.reduce((a, d) => a + (dimensionPercentages[d] || 0), 0);
  return parseFloat((sum / dims.length).toFixed(1));
}

// `categoryQuestionMax`: { categoryName: totalMarksAcrossActiveQuestionsInThatCategory }
// `dimensionQuestionMax`: { dimensionName: totalMaxContributionAcrossActiveQuestionsTouchingThatDimension }
// — both computed live from `Question.marks` (or, for SITUATIONAL, the best
// option's per-dimension values) rather than a fixed per-question amount,
// since marks/dimension mappings are now admin-configurable per question.
// `totalActiveQuestions` is needed to derive skippedCount (auto-submits can
// leave some questions unanswered).
function calculateResult(userAnswers, questionTypeMap, categoryQuestionMax, dimensionQuestionMax, totalActiveQuestions) {
  // Group scores by category name (unchanged from Phase 1)
  const categoryMarks = {};
  for (const answer of userAnswers) {
    const typeName = questionTypeMap[answer.questionId.toString()];
    if (!typeName) continue;
    if (!categoryMarks[typeName]) categoryMarks[typeName] = 0;
    categoryMarks[typeName] += answer.score;
  }

  const categoryScores = {};
  const categoryPercentages = {};
  for (const [name, score] of Object.entries(categoryMarks)) {
    categoryScores[name] = score;
    const categoryMax = categoryQuestionMax[name] || 0;
    categoryPercentages[name] = categoryMax ? parseFloat(((score / categoryMax) * 100).toFixed(1)) : 0;
  }

  const totalMarks = Object.values(categoryScores).reduce((a, b) => a + b, 0);
  const maxScore = Object.values(categoryQuestionMax).reduce((a, b) => a + b, 0);
  const percentage = maxScore ? parseFloat(((totalMarks / maxScore) * 100).toFixed(1)) : 0;
  const level = getLevel(percentage);

  // A "top category" only means something if the candidate actually scored in
  // it. On a zero-score submission every category ties at 0, so the old
  // `=== highestScore` filter returned ALL categories — which then rendered as
  // a huge comma list (and made admin table rows wrap enormously). Guard it:
  // no positive top score → no dominant category (empty list; the UI shows a
  // "No dominant category" fallback). A genuine multi-way tie above 0 still
  // lists the tied winners.
  const scoreValues = Object.values(categoryScores);
  const highestCategoryScore = scoreValues.length ? Math.max(...scoreValues) : 0;
  const highestCategory = highestCategoryScore > 0
    ? Object.keys(categoryScores).filter(k => categoryScores[k] === highestCategoryScore)
    : [];

  const sortedCats = Object.entries(categoryScores).sort((a, b) => a[1] - b[1]);
  const improvementAreas = sortedCats.slice(0, 2).map(([cat, score]) => ({
    category: cat,
    score,
    suggestion: IMPROVEMENT_SUGGESTIONS[cat] || '',
  }));

  const explanation = getLevelExplanation(level, highestCategory);

  // Dimension aggregation — most answers contribute to a single dimension
  // ({[question.dimension]: score}), but SITUATIONAL answers contribute to
  // several at once, so this just sums whatever keys each answer's
  // dimensionScores object actually has.
  const dimensionMarks = {};
  for (const answer of userAnswers) {
    for (const [dim, val] of Object.entries(answer.dimensionScores || {})) {
      dimensionMarks[dim] = (dimensionMarks[dim] || 0) + val;
    }
  }
  const dimensionScores = {};
  const dimensionPercentages = {};
  for (const dim of Object.keys(dimensionQuestionMax)) {
    const score = dimensionMarks[dim] || 0;
    const max = dimensionQuestionMax[dim] || 0;
    dimensionScores[dim] = score;
    dimensionPercentages[dim] = max ? parseFloat(((score / max) * 100).toFixed(1)) : 0;
  }

  // Only rank dimensions that were actually tested (max > 0) — otherwise an
  // untouched dimension would misleadingly show up as "weak" at 0%.
  const testedDimensions = Object.entries(dimensionPercentages).filter(([dim]) => dimensionQuestionMax[dim] > 0);
  const sortedDims = [...testedDimensions].sort((a, b) => b[1] - a[1]);
  const strongDimensions = sortedDims.slice(0, 3).map(([dim]) => dim);
  const weakDimensions = sortedDims.slice(-3).reverse().map(([dim]) => dim);

  const correctCount = userAnswers.filter((a) => a.isCorrect === true).length;
  const wrongCount = userAnswers.filter((a) => a.isCorrect === false).length;
  // Every active question now gets an explicit UserAnswer row (real answer,
  // or a synthesized 'skipped'/'timeout' one) — so skippedCount comes from
  // status, not a length difference. The totalActiveQuestions-based fallback
  // stays for any caller not yet passing status-tagged rows.
  const skippedCount = userAnswers.some((a) => a.status)
    ? userAnswers.filter((a) => a.status === 'skipped' || a.status === 'timeout').length
    : Math.max(0, totalActiveQuestions - userAnswers.length);

  const aptitudeScore = avgOf(dimensionPercentages, APTITUDE_DIMENSIONS);
  const personalityScore = avgOf(dimensionPercentages, PERSONALITY_DIMENSIONS);
  const businessMindsetScore = avgOf(dimensionPercentages, BUSINESS_MINDSET_DIMENSIONS);
  const financialAwarenessScore = avgOf(dimensionPercentages, FINANCIAL_AWARENESS_DIMENSIONS);

  const recommendations = getRecommendations(dimensionPercentages);
  const recommendedBusiness = recommendations.map((r) => r.business);

  return {
    totalMarks, maxScore, percentage, level,
    categoryScores, categoryPercentages,
    highestCategory, recommendedBusiness,
    explanation, improvementAreas,
    dimensionScores, dimensionPercentages,
    correctCount, wrongCount, skippedCount,
    businessReadinessPercent: percentage,
    recommendations,
    strongDimensions, weakDimensions,
    aptitudeScore, personalityScore, businessMindsetScore, financialAwarenessScore,
  };
}

module.exports = { calculateResult, computeQuestionMaxes, BUSINESS_MAP };
