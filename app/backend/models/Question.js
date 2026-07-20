const mongoose = require('mongoose');

const QUESTION_TYPES = [
  'LIKERT_SCALE', 'SITUATIONAL', 'NUMERICAL_ABILITY', 'PERCENTAGE_TYPE',
  'PUZZLE_TYPE', 'LOGICAL_ABILITY', 'VERBAL_ABILITY', 'IMAGE_BASED',
  'MULTI_SELECT', 'RANKING',
];

const DIMENSIONS = [
  'Communication', 'Leadership', 'Problem Solving', 'Risk Taking', 'Teamwork',
  'Creativity', 'Financial Awareness', 'Business Mindset', 'Emotional Intelligence',
  'Numerical Ability', 'Logical Ability', 'Verbal Ability',
];

const questionSchema = new mongoose.Schema({
  typeId:   { type: mongoose.Schema.Types.ObjectId, ref: 'QuestionType', required: true },
  text:     { type: String, required: true, maxlength: 500 },
  order:    { type: Number, required: true, unique: true, min: 1 },
  isActive: { type: Boolean, default: true },

  questionType:     { type: String, enum: QUESTION_TYPES, default: 'LIKERT_SCALE', required: true },
  // The question's language — the single source of truth for how it's spoken
  // (English voice for 'en', Tamil voice for 'ta'). Defaults to English; it is
  // NOT inferred from the text, the explanation field, or the TTS voice config.
  language:         { type: String, enum: ['en', 'ta'], default: 'en' },
  dimension:        { type: String, enum: DIMENSIONS, required: true },
  subDimension:     { type: String, maxlength: 100, default: '' },
  difficulty:       { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium' },
  marks:            { type: Number, default: 5, min: 0.01 },
  timeLimitSeconds: { type: Number, min: 1, default: null },
  hasAudio:         { type: Boolean, default: false },
  audioUrl:         { type: String, default: '' },
  imageUrl:         { type: String, default: '' },
  instructionText:  { type: String, maxlength: 500, default: '' },
  isReverseScored:  { type: Boolean, default: false },
  // Admin-authored spoken explanation of the question. The candidate hears it
  // (browser voice) via a separate "Explain" button during the assessment.
  // Distinct from `explanation` below (which is a reports-only field).
  explanationAudioText: { type: String, maxlength: 1000, default: '' },
  // When true, the spoken explanation is Tamil written in English letters
  // (Tanglish). The candidate app transliterates it to Tamil script and reads
  // it with a Tamil voice, instead of an English voice reading the romanized
  // text. Off by default so plain-English explanations are unaffected.
  explanationIsTanglish: { type: Boolean, default: false },

  // Type-specific fields. Only LIKERT_SCALE/NUMERICAL_ABILITY rules are
  // enforced in Phase 1 — the rest exist now so later phases (SITUATIONAL,
  // MULTI_SELECT, RANKING) don't need another schema migration.
  correctOptionId:  { type: mongoose.Schema.Types.ObjectId, ref: 'AnswerOption', default: null },
  explanation:      { type: String, maxlength: 1000, default: '' },
  idealOrder:       { type: [mongoose.Schema.Types.ObjectId], default: undefined },
  correctOptionIds: { type: [mongoose.Schema.Types.ObjectId], default: undefined },
  scoringMode:      { type: String, enum: ['exact', 'partial'], default: undefined },
}, { timestamps: true });

questionSchema.index({ typeId: 1, isActive: 1 });
questionSchema.index({ order: 1 });
questionSchema.index({ questionType: 1 });
questionSchema.index({ dimension: 1 });

const Question = mongoose.model('Question', questionSchema);
Question.QUESTION_TYPES = QUESTION_TYPES;
Question.DIMENSIONS = DIMENSIONS;

module.exports = Question;
