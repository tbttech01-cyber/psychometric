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

// `categoryQuestionMax`: { categoryName: totalMarksAcrossActiveQuestionsInThatCategory }
// — each question now carries its own admin-configurable `marks` instead of
// a fixed 5, so both the per-category and overall max score are computed
// from a live sum of `Question.marks` rather than `count * 5`.
function calculateResult(userAnswers, questionTypeMap, categoryQuestionMax) {
  // Group scores by category name
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

  const highestCategoryScore = Math.max(...Object.values(categoryScores));
  const highestCategory = Object.keys(categoryScores).filter(k => categoryScores[k] === highestCategoryScore);

  const recommendedBusiness = [...new Set(
    highestCategory.flatMap(cat => BUSINESS_MAP[cat] || [])
  )];

  const sortedCats = Object.entries(categoryScores).sort((a, b) => a[1] - b[1]);
  const improvementAreas = sortedCats.slice(0, 2).map(([cat, score]) => ({
    category: cat,
    score,
    suggestion: IMPROVEMENT_SUGGESTIONS[cat] || '',
  }));

  const explanation = getLevelExplanation(level, highestCategory);

  return {
    totalMarks, maxScore, percentage, level,
    categoryScores, categoryPercentages,
    highestCategory, recommendedBusiness,
    explanation, improvementAreas,
  };
}

module.exports = { calculateResult, BUSINESS_MAP };
