/**
 * Rule-based business-suitability recommendations, driven entirely by
 * dimension percentages (0-100). Rules are checked in priority order; every
 * rule that matches contributes its businesses (deduped by name, first
 * explanation wins), capped at 5 total. This replaces the old static
 * category-name-keyed BUSINESS_MAP.
 */

// A risk-taking score below this is treated as "low" for the safer-options
// rule — chosen to match getLevel()'s "Needs Improvement" cutoff (<40) in
// scoreCalculator.js, so the two low-score-signals stay consistent with
// each other across the app.
const LOW_RISK_TAKING_THRESHOLD = 40;

function pct(dimensionPercentages, dimension) {
  return dimensionPercentages[dimension] || 0;
}

const RULES = [
  {
    matches: (d) => pct(d, 'Communication') >= 75 && pct(d, 'Leadership') >= 70 && pct(d, 'Risk Taking') >= 70,
    businesses: ['Sales Agency', 'Marketing Agency', 'Training Institute', 'Franchise Business'],
    explain: (d) => `Strong Communication (${pct(d, 'Communication')}%), Leadership (${pct(d, 'Leadership')}%) and Risk Taking (${pct(d, 'Risk Taking')}%) point toward customer-facing, growth-driven ventures.`,
  },
  {
    matches: (d) => pct(d, 'Creativity') >= 75 && pct(d, 'Communication') >= 65,
    businesses: ['Branding Agency', 'Content Creation Business', 'Digital Marketing Agency', 'Fashion/Design Business'],
    explain: (d) => `High Creativity (${pct(d, 'Creativity')}%) paired with solid Communication (${pct(d, 'Communication')}%) suits brand- and content-driven businesses.`,
  },
  {
    matches: (d) => pct(d, 'Financial Awareness') >= 75 && pct(d, 'Business Mindset') >= 70,
    businesses: ['Trading Business', 'Distribution Business', 'Finance Consulting', 'Retail Business'],
    explain: (d) => `Strong Financial Awareness (${pct(d, 'Financial Awareness')}%) and Business Mindset (${pct(d, 'Business Mindset')}%) suit margin-driven, numbers-focused businesses.`,
  },
  {
    matches: (d) => pct(d, 'Problem Solving') >= 75 && pct(d, 'Logical Ability') >= 70,
    businesses: ['IT Services', 'Software Startup', 'Tech Support Business', 'Automation Services'],
    explain: (d) => `Strong Problem Solving (${pct(d, 'Problem Solving')}%) and Logical Ability (${pct(d, 'Logical Ability')}%) suit technical, systems-oriented businesses.`,
  },
  {
    matches: (d) => pct(d, 'Teamwork') >= 75 && pct(d, 'Leadership') >= 70,
    businesses: ['Event Management', 'Service Agency', 'HR/Recruitment Agency'],
    explain: (d) => `Strong Teamwork (${pct(d, 'Teamwork')}%) and Leadership (${pct(d, 'Leadership')}%) suit people-management and coordination-heavy businesses.`,
  },
  {
    matches: (d) => pct(d, 'Risk Taking') < LOW_RISK_TAKING_THRESHOLD,
    businesses: ['Franchise', 'Reselling', 'Home-based Business', 'Service-based Small Business'],
    explain: (d) => `Lower Risk Taking (${pct(d, 'Risk Taking')}%) suggests starting with lower-risk, established business models before scaling up.`,
  },
];

// Shown only if nothing above matched, so the report never comes back empty.
const FALLBACK = {
  businesses: ['Freelance Services', 'Small Retail Business', 'Local Service Business'],
  explanation: 'No single dimension stands out strongly yet — starting with a low-commitment, low-risk business while building your strengths is a solid first step.',
};

function getRecommendations(dimensionPercentages) {
  const recommendations = [];
  const seen = new Set();

  for (const rule of RULES) {
    if (!rule.matches(dimensionPercentages)) continue;
    const explanation = rule.explain(dimensionPercentages);
    for (const business of rule.businesses) {
      if (seen.has(business)) continue;
      seen.add(business);
      recommendations.push({ business, explanation });
      if (recommendations.length >= 5) return recommendations;
    }
  }

  if (!recommendations.length) {
    for (const business of FALLBACK.businesses) {
      recommendations.push({ business, explanation: FALLBACK.explanation });
    }
  }

  return recommendations.slice(0, 5);
}

module.exports = { getRecommendations, LOW_RISK_TAKING_THRESHOLD };
