import test from "node:test";
import assert from "node:assert/strict";
import { gradeAssessmentAnswers } from "@/lib/assessments/grading";
import type { AssessmentQuestion } from "@/types/domain";

const questions: AssessmentQuestion[] = [
  {
    id: "q1",
    type: "multiple_choice",
    prompt: "Select both prime numbers",
    options: [
      { id: "a", label: "2" },
      { id: "b", label: "4" },
      { id: "c", label: "5" },
    ],
    correctOptionIds: ["a", "c"],
    points: 60,
  },
  {
    id: "q2",
    type: "fill_blank",
    prompt: "Two plus two",
    acceptedAnswers: ["4", "four"],
    points: 40,
  },
];

test("objective answers are scored exactly and order-independently", () => {
  const result = gradeAssessmentAnswers(questions, [
    { questionId: "q1", selectedOptionIds: ["c", "a"] },
    { questionId: "q2", text: " Four " },
  ], 100);
  assert.equal(result.score, 100);
  assert.equal(result.needsReview, false);
});

test("incorrect objective answers receive no invented partial credit", () => {
  const result = gradeAssessmentAnswers(questions, [
    { questionId: "q1", selectedOptionIds: ["a"] },
    { questionId: "q2", text: "5" },
  ], 100);
  assert.equal(result.score, 0);
});

test("subjective items enter review state", () => {
  const result = gradeAssessmentAnswers([
    { id: "essay", type: "essay", prompt: "Explain", points: 100 },
  ], [{ questionId: "essay", text: "A reasoned answer" }], 100);
  assert.equal(result.score, null);
  assert.equal(result.needsReview, true);
  assert.equal(result.grades[0].correct, null);
});
