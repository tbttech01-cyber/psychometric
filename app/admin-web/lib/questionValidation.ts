import type { AnswerOption, QuestionTypeKind } from "./types";

export function validateQuestion(
  typeId: string,
  dimension: string,
  marks: number | "",
  questionType: QuestionTypeKind | "",
  options: AnswerOption[]
): string[] {
  const errors: string[] = [];
  if (!typeId) errors.push("Category is required.");
  if (!dimension) errors.push("Dimension is required.");
  if (!questionType) errors.push("Question type is required.");
  if (!marks || marks <= 0) errors.push("Marks must be a positive number.");
  if (options.some((o) => !o.optionText.trim())) errors.push("All options need text.");

  if (questionType === "LIKERT_SCALE" && options.length < 5)
    errors.push("Likert-scale questions need at least 5 scored options.");

  if (questionType === "NUMERICAL_ABILITY") {
    if (options.length < 2) errors.push("Add at least two answer options.");
    if (options.filter((o) => o.isCorrect).length !== 1) errors.push("Select exactly one correct answer.");
  }

  return errors;
}
