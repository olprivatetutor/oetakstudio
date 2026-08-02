import type { AssessmentAnswer, AssessmentQuestion } from "@/types/domain";

export type QuestionGrade = {
  questionId: string;
  pointsAwarded: number;
  pointsPossible: number;
  correct: boolean | null;
  feedback?: string;
};

function normalized(values: string[]) {
  return [...values].map((value) => value.trim().toLowerCase()).sort();
}

function sameValues(left: string[], right: string[]) {
  const normalizedLeft = normalized(left);
  const normalizedRight = normalized(right);
  return normalizedLeft.length === normalizedRight.length
    && normalizedLeft.every((value, index) => value === normalizedRight[index]);
}

export function gradeAssessmentAnswers(
  questions: AssessmentQuestion[],
  answers: AssessmentAnswer[],
  maxScore: number,
) {
  const answerMap = new Map(answers.map((answer) => [answer.questionId, answer]));
  const grades: QuestionGrade[] = [];
  let autoPoints = 0;
  let autoPointsPossible = 0;
  let needsReview = false;

  for (const question of questions) {
    const answer = answerMap.get(question.id);
    const base = {
      questionId: question.id,
      pointsPossible: question.points,
      feedback: question.feedback,
    };

    if (["multiple_choice", "true_false"].includes(question.type)) {
      const correct = sameValues(
        answer?.selectedOptionIds ?? [],
        question.correctOptionIds ?? [],
      );
      const pointsAwarded = correct ? question.points : 0;
      autoPoints += pointsAwarded;
      autoPointsPossible += question.points;
      grades.push({ ...base, pointsAwarded, correct });
      continue;
    }

    if (question.type === "fill_blank") {
      const correct = normalized(question.acceptedAnswers ?? []).includes(
        answer?.text?.trim().toLowerCase() ?? "",
      );
      const pointsAwarded = correct ? question.points : 0;
      autoPoints += pointsAwarded;
      autoPointsPossible += question.points;
      grades.push({ ...base, pointsAwarded, correct });
      continue;
    }

    needsReview = true;
    grades.push({ ...base, pointsAwarded: 0, correct: null });
  }

  const score = autoPointsPossible > 0
    ? Math.round((autoPoints / autoPointsPossible) * maxScore)
    : null;

  return { score, needsReview, grades };
}
