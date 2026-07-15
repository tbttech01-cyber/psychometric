const { calculateResult } = require('../backend/utils/scoreCalculator');

// Pure unit tests (no DB) for the aggregation/top-category rules. Each answer
// row mirrors what submitAssessment builds: { questionId, score, isCorrect,
// dimensionScores, status }. questionTypeMap maps questionId -> category name.
describe('scoreCalculator.calculateResult — top category', () => {
  const categoryMax = { Verbal: 10, Numerical: 10 };
  const dimensionMax = { 'Verbal Ability': 10, 'Numerical Ability': 10 };

  it('returns NO dominant category for a zero-score submission (not every category)', () => {
    const answers = [
      { questionId: 'q1', score: 0, dimensionScores: {}, status: 'skipped' },
      { questionId: 'q2', score: 0, dimensionScores: {}, status: 'skipped' },
    ];
    const typeMap = { q1: 'Verbal', q2: 'Numerical' };
    const r = calculateResult(answers, typeMap, categoryMax, dimensionMax, 2);
    expect(r.totalMarks).toBe(0);
    expect(r.percentage).toBe(0);
    expect(r.level).toBe('Needs Improvement');
    // The regression this guards: a 0/0 tie must NOT list all categories.
    expect(r.highestCategory).toEqual([]);
  });

  it('picks the single highest-scoring category when there is a clear winner', () => {
    const answers = [
      { questionId: 'q1', score: 8, dimensionScores: { 'Verbal Ability': 8 }, status: 'answered' },
      { questionId: 'q2', score: 3, dimensionScores: { 'Numerical Ability': 3 }, status: 'answered' },
    ];
    const typeMap = { q1: 'Verbal', q2: 'Numerical' };
    const r = calculateResult(answers, typeMap, categoryMax, dimensionMax, 2);
    expect(r.highestCategory).toEqual(['Verbal']);
    expect(r.totalMarks).toBe(11);
  });

  it('lists every tied category when the top score (> 0) is a genuine tie', () => {
    const answers = [
      { questionId: 'q1', score: 5, dimensionScores: { 'Verbal Ability': 5 }, status: 'answered' },
      { questionId: 'q2', score: 5, dimensionScores: { 'Numerical Ability': 5 }, status: 'answered' },
    ];
    const typeMap = { q1: 'Verbal', q2: 'Numerical' };
    const r = calculateResult(answers, typeMap, categoryMax, dimensionMax, 2);
    expect(r.highestCategory.sort()).toEqual(['Numerical', 'Verbal']);
  });
});
