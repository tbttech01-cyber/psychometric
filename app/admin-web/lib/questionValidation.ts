import type { AnswerOption, QuestionTypeKind } from "./types";
import { SINGLE_CORRECT_TYPES } from "./types";

export function validateQuestion(
  typeId: string,
  dimension: string,
  marks: number | "",
  questionType: QuestionTypeKind | "",
  options: AnswerOption[],
  extra?: { scoringMode?: "exact" | "partial" | ""; imageUrl?: string }
): string[] {
  const errors: string[] = [];
  if (!typeId) errors.push("Category is required.");
  if (!dimension) errors.push("Dimension is required.");
  if (!questionType) errors.push("Question type is required.");
  if (!marks || marks <= 0) errors.push("Marks must be a positive number.");
  if (options.some((o) => !o.optionText.trim())) errors.push("All options need text.");

  if (questionType === "LIKERT_SCALE" && options.length < 5)
    errors.push("Likert-scale questions need at least 5 scored options.");

  if (SINGLE_CORRECT_TYPES.includes(questionType as QuestionTypeKind)) {
    if (options.length < 2) errors.push("Add at least two answer options.");
    if (options.filter((o) => o.isCorrect).length !== 1) errors.push("Select exactly one correct answer.");
  }

  if (questionType === "SITUATIONAL" && !options.every((o) => o.dimensionScores && Object.keys(o.dimensionScores).length))
    errors.push("Every situational option needs at least one dimension score.");

  if (questionType === "MULTI_SELECT") {
    if (!extra?.scoringMode) errors.push("Select a scoring mode (exact or partial) for multi-select questions.");
    if (!options.some((o) => o.isCorrect)) errors.push("Select at least one correct answer.");
  }

  if (questionType === "RANKING" && options.length < 2)
    errors.push("Ranking questions need at least 2 items to order.");

  if (questionType === "IMAGE_BASED" && !extra?.imageUrl)
    errors.push("Image-based questions require an image URL.");

  return errors;
}
