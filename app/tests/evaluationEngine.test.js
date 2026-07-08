const { evaluateAnswer, EVALUATORS } = require('../backend/utils/evaluationEngine');

describe('evaluationEngine — dispatch', () => {
  it('registers an evaluator for every questionType', () => {
    const QUESTION_TYPES = [
      'LIKERT_SCALE', 'SITUATIONAL', 'NUMERICAL_ABILITY', 'PERCENTAGE_TYPE',
      'PUZZLE_TYPE', 'LOGICAL_ABILITY', 'VERBAL_ABILITY', 'IMAGE_BASED',
      'MULTI_SELECT', 'RANKING',
    ];
    expect(Object.keys(EVALUATORS).sort()).toEqual(QUESTION_TYPES.sort());
  });

  it('throws for an unknown questionType', () => {
    expect(() => evaluateAnswer({ questionType: 'NOT_REAL' }, [], null)).toThrow(/No evaluator registered/);
  });
});

describe('evaluateAnswer — LIKERT_SCALE', () => {
  const options = [
    { _id: 'o1', score: 1 }, { _id: 'o2', score: 2 }, { _id: 'o3', score: 3 },
    { _id: 'o4', score: 4 }, { _id: 'o5', score: 5 },
  ];
  const question = { questionType: 'LIKERT_SCALE', marks: 5, dimension: 'Communication' };

  it('scores a positively-worded item by the chosen option\'s score', () => {
    const result = evaluateAnswer(question, options, 'o5');
    expect(result.score).toBe(5);
    expect(result.maxScore).toBe(5);
    expect(result.isCorrect).toBeNull();
    expect(result.dimensionScores).toEqual({ Communication: 5 });
  });

  it('scores a reverse-worded item correctly because direction is baked into option authoring, not flipped at runtime', () => {
    // A reverse-scored item stores "Completely true" as score 1 (not 5) at
    // authoring time — the evaluator itself never inspects isReverseScored.
    const reverseOptions = [
      { _id: 'o1', score: 5 }, { _id: 'o2', score: 4 }, { _id: 'o3', score: 3 },
      { _id: 'o4', score: 2 }, { _id: 'o5', score: 1 },
    ];
    const result = evaluateAnswer(question, reverseOptions, 'o5'); // "Completely true" for this item
    expect(result.score).toBe(1);
  });

  it('throws for an option id that does not belong to the question', () => {
    expect(() => evaluateAnswer(question, options, 'bogus')).toThrow(/Invalid answer option/);
  });
});

describe('evaluateAnswer — single-correct aptitude family', () => {
  const options = [
    { _id: 'a', score: 0 }, { _id: 'b', score: 0 }, { _id: 'c', score: 0 }, { _id: 'd', score: 0 },
  ];
  const question = { questionType: 'NUMERICAL_ABILITY', marks: 5, dimension: 'Numerical Ability', correctOptionId: 'b' };

  it('awards full marks for the correct option', () => {
    const result = evaluateAnswer(question, options, 'b');
    expect(result.score).toBe(5);
    expect(result.maxScore).toBe(5);
    expect(result.isCorrect).toBe(true);
    expect(result.dimensionScores).toEqual({ 'Numerical Ability': 5 });
  });

  it('awards zero for a wrong option', () => {
    const result = evaluateAnswer(question, options, 'a');
    expect(result.score).toBe(0);
    expect(result.isCorrect).toBe(false);
  });
});

describe('evaluateAnswer — SITUATIONAL', () => {
  const options = [
    { _id: 'best', dimensionScores: { Communication: 5, 'Emotional Intelligence': 5, 'Problem Solving': 4 } },
    { _id: 'meh', dimensionScores: { Communication: 1, Leadership: 1 } },
    { _id: 'worst', dimensionScores: { Communication: 0 } },
  ];
  const question = { questionType: 'SITUATIONAL', dimension: 'Communication' };

  it('sums the chosen option\'s dimension scores and spans multiple dimensions at once', () => {
    const result = evaluateAnswer(question, options, 'best');
    expect(result.score).toBe(14);
    expect(result.isCorrect).toBeNull();
    expect(result.dimensionScores).toEqual({ Communication: 5, 'Emotional Intelligence': 5, 'Problem Solving': 4 });
  });

  it('derives maxScore live as the best-scoring option\'s total, not a stored value', () => {
    const result = evaluateAnswer(question, options, 'meh');
    expect(result.score).toBe(2);
    expect(result.maxScore).toBe(14); // best possible across all options, regardless of what was chosen
  });
});

describe('evaluateAnswer — MULTI_SELECT', () => {
  const options = [{ _id: '1' }, { _id: '2' }, { _id: '3' }, { _id: '4' }];
  const baseQuestion = { questionType: 'MULTI_SELECT', marks: 10, dimension: 'Business Mindset', correctOptionIds: ['1', '3'] };

  it('exact mode: full marks only for the exact correct set', () => {
    const result = evaluateAnswer({ ...baseQuestion, scoringMode: 'exact' }, options, ['1', '3']);
    expect(result.score).toBe(10);
    expect(result.isCorrect).toBe(true);
  });

  it('exact mode: zero for a partially-correct selection', () => {
    const result = evaluateAnswer({ ...baseQuestion, scoringMode: 'exact' }, options, ['1', '2']);
    expect(result.score).toBe(0);
    expect(result.isCorrect).toBe(false);
  });

  it('partial mode: rewards correct picks and penalizes incorrect ones, floored at 0', () => {
    // 1 correct (of 2), 1 incorrect selected: max(0, 1-1)/2 = 0
    const zeroed = evaluateAnswer({ ...baseQuestion, scoringMode: 'partial' }, options, ['1', '2']);
    expect(zeroed.score).toBe(0);

    // 1 correct (of 2), 0 incorrect: max(0, 1-0)/2 = 0.5 -> 5 marks
    const half = evaluateAnswer({ ...baseQuestion, scoringMode: 'partial' }, options, ['1']);
    expect(half.score).toBe(5);

    // Both correct, none incorrect: full marks
    const full = evaluateAnswer({ ...baseQuestion, scoringMode: 'partial' }, options, ['1', '3']);
    expect(full.score).toBe(10);
    expect(full.isCorrect).toBe(true);
  });

  it('throws when no option is selected', () => {
    expect(() => evaluateAnswer({ ...baseQuestion, scoringMode: 'partial' }, options, [])).toThrow(/At least one option/);
  });
});

describe('evaluateAnswer — RANKING', () => {
  const options = [{ _id: '1' }, { _id: '2' }, { _id: '3' }, { _id: '4' }];
  const question = { questionType: 'RANKING', marks: 8, dimension: 'Business Mindset', idealOrder: ['1', '2', '3', '4'] };

  it('awards full marks for a perfectly matching order', () => {
    const result = evaluateAnswer(question, options, ['1', '2', '3', '4']);
    expect(result.score).toBe(8);
    expect(result.isCorrect).toBe(true);
  });

  it('awards partial credit proportional to positions that match', () => {
    // Positions 1 and 4 match (values '1' and '4'), 2 of 4 -> half marks
    const result = evaluateAnswer(question, options, ['1', '3', '2', '4']);
    expect(result.score).toBe(4);
    expect(result.isCorrect).toBe(false);
  });

  it('throws when the ranking length does not match the ideal order', () => {
    expect(() => evaluateAnswer(question, options, ['1', '2'])).toThrow(/Invalid ranking/);
  });
});
