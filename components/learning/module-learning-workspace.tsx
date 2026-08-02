"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Layers3,
  Loader2,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type ModuleStatus = "not_started" | "in_progress" | "completed";

type LessonModule = {
  id: string;
  courseId: string;
  title: string;
  summary: string;
  position: number;
  type: "video" | "reading" | "interactive" | "quiz" | "assignment";
  content: string;
  estimatedMinutes: number;
};

type LessonCourse = {
  id: string;
  title: string;
  curriculumCode: string | null;
  gradeLabel: string | null;
  subjectCode: string | null;
};

type LessonAsset = {
  id: string;
  title: string;
  description: string;
  kind: string;
  tags: string[];
};

type QuizQuestion = {
  prompt: string;
  options: string[];
  answerIndex: number;
  feedback: string;
};

type PracticePack = {
  title: string;
  instructions: string;
  prompts: string[];
  quiz: QuizQuestion[];
  checklist: string[];
};

type ApiResponse<T> =
  | { success: true; data: T; message: string }
  | { success: false; error: { message: string } };

const practiceByPosition: Record<number, PracticePack> = {
  1: {
    title: "Classroom confidence diagnostic",
    instructions: "Practice a short classroom exchange, then check whether you can ask for help, respond politely, and repair communication when you do not understand.",
    prompts: [
      "Your teacher says: Work in pairs. Ask a friend to be your partner politely.",
      "You do not understand an instruction. Ask the teacher to repeat it in English.",
      "Introduce your friend to the class using name, class, and one interest.",
      "Point to one classroom object and ask a partner a simple question about it.",
    ],
    checklist: [
      "I used a greeting or polite opening.",
      "I asked for help or repetition clearly.",
      "I answered with a complete short sentence.",
      "I chose one phrase to improve next time.",
    ],
    quiz: [
      {
        prompt: "Which phrase is the most polite way to ask someone to repeat an instruction?",
        options: ["Repeat!", "Can you repeat that, please?", "I do not care."],
        answerIndex: 1,
        feedback: "A polite request uses can you and please.",
      },
      {
        prompt: "Your teacher says, Open your book. Which response fits best?",
        options: ["Okay, I will open my book.", "My name is Nadia.", "I like basketball."],
        answerIndex: 0,
        feedback: "The response should match the classroom instruction.",
      },
      {
        prompt: "What evidence should you keep after this diagnostic?",
        options: ["A self-rating and one improvement target", "Only the final score", "A copied paragraph from a book"],
        answerIndex: 0,
        feedback: "The diagnostic focuses on confidence evidence and the next improvement target.",
      },
    ],
  },
  2: {
    title: "Listen and match routine check",
    instructions: "Match classroom instructions with actions, then write a short routine for preparing English class.",
    prompts: ["Listen and repeat.", "Discuss with your group.", "Write three new words.", "Close your book and look at the board."],
    checklist: ["I matched instructions to actions.", "I wrote a routine with sequence words.", "I used at least three classroom phrases."],
    quiz: [
      { prompt: "Which word usually starts an instruction?", options: ["Beautiful", "Open", "Because"], answerIndex: 1, feedback: "Imperative verbs often start classroom instructions." },
      { prompt: "Which phrase shows a learning routine?", options: ["I prepare my notebook before class.", "The red bag is big.", "Can I borrow it?"], answerIndex: 0, feedback: "A routine describes what someone regularly does." },
      { prompt: "Which connector fits a routine sequence?", options: ["First", "Blue", "Friendly"], answerIndex: 0, feedback: "First helps order steps." },
    ],
  },
  3: {
    title: "Profile builder check",
    instructions: "Draft a short profile, interview a partner, and revise the profile with correct personal information.",
    prompts: ["Name and class", "Origin or address", "Favorite subject", "Hobby", "One learning goal"],
    checklist: ["I used capital letters for names.", "I used am/is/are correctly.", "I asked at least two polite questions.", "I introduced a classmate accurately."],
    quiz: [
      { prompt: "Which sentence is correct?", options: ["She are Hana.", "She is Hana.", "She am Hana."], answerIndex: 1, feedback: "She uses is." },
      { prompt: "Which question asks about a hobby?", options: ["What is your hobby?", "Where is the library?", "Open the door, please."], answerIndex: 0, feedback: "The question directly asks for a hobby." },
      { prompt: "What should you do after peer feedback?", options: ["Revise the profile", "Delete all details", "Ignore the partner"], answerIndex: 0, feedback: "Feedback should lead to revision." },
    ],
  },
  4: {
    title: "Descriptive detail check",
    instructions: "Identify topic and supporting details, then write a short description of a familiar person, place, or object.",
    prompts: ["Topic", "Appearance", "Location", "Function", "Personal detail"],
    checklist: ["I included one clear topic.", "I used useful adjectives.", "I added supporting details.", "I checked there is or there are."],
    quiz: [
      { prompt: "Which word is an adjective?", options: ["Library", "Helpful", "Study"], answerIndex: 1, feedback: "Helpful describes a noun." },
      { prompt: "Which sentence describes a place?", options: ["Our library is quiet and bright.", "Please sit down.", "I wake up at five."], answerIndex: 0, feedback: "It gives details about the library." },
      { prompt: "What does a descriptive text need?", options: ["A topic and details", "Only commands", "Only numbers"], answerIndex: 0, feedback: "Description explains a topic through details." },
    ],
  },
  5: {
    title: "Routine and preference exchange",
    instructions: "Ask about routines, compare answers, and write a short reflection about learning habits.",
    prompts: ["What do you do before English class?", "What subject do you like?", "How often do you read in English?", "What habit helps you learn?"],
    checklist: ["I used simple present verbs.", "I included a frequency word.", "I asked and answered two questions.", "I wrote one reflection sentence."],
    quiz: [
      { prompt: "Which sentence uses simple present correctly?", options: ["She likes English.", "She like English.", "She liking English."], answerIndex: 0, feedback: "He/she usually adds s to the verb." },
      { prompt: "Which word shows frequency?", options: ["Always", "Green", "Desk"], answerIndex: 0, feedback: "Always tells how often something happens." },
      { prompt: "Which question asks about preference?", options: ["What subject do you like?", "Where is the bag?", "Close your book."], answerIndex: 0, feedback: "Like asks about preference." },
    ],
  },
  6: {
    title: "Procedure and presentation rehearsal",
    instructions: "Sequence a short procedure, read a short message, and prepare a simple multimodal presentation.",
    prompts: ["Choose a familiar routine.", "Write four ordered steps.", "Add one visual support.", "Practice a one-minute explanation."],
    checklist: ["I used imperative verbs.", "I used sequence connectors.", "I identified key information in a message.", "I responded to peer feedback."],
    quiz: [
      { prompt: "Which sentence is an instruction?", options: ["Cut the paper carefully.", "The paper is blue.", "I like paper."], answerIndex: 0, feedback: "An instruction tells someone what to do." },
      { prompt: "Which connector shows the final step?", options: ["Finally", "Friendly", "Fast"], answerIndex: 0, feedback: "Finally marks the last step." },
      { prompt: "What should a presentation include?", options: ["Clear message and visual support", "Only silent reading", "No audience awareness"], answerIndex: 0, feedback: "A clear presentation helps the audience understand." },
    ],
  },
};

const defaultPractice: PracticePack = {
  title: "Learning check",
  instructions: "Read the module material, complete the reflection, then check your understanding.",
  prompts: ["What is the main idea?", "What example can you give?", "What will you practice next?"],
  checklist: ["I read the lesson material.", "I completed one practice task.", "I wrote one reflection."],
  quiz: [
    { prompt: "What should you do before marking a module complete?", options: ["Read and practice", "Skip everything", "Only open the page"], answerIndex: 0, feedback: "Completion should follow learning evidence." },
  ],
};

function formatContent(content: string) {
  return content
    .split(/\n{2,}/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function scoreQuiz(answers: number[], quiz: QuizQuestion[]) {
  return quiz.reduce((score, question, index) => score + (answers[index] === question.answerIndex ? 1 : 0), 0);
}

export function ModuleLearningWorkspace({
  course,
  module,
  modules,
  assets,
  enrollmentId,
  initialStatus,
  nextModuleId,
  previousModuleId,
}: {
  course: LessonCourse;
  module: LessonModule;
  modules: LessonModule[];
  assets: LessonAsset[];
  enrollmentId?: string;
  initialStatus: ModuleStatus;
  nextModuleId?: string;
  previousModuleId?: string;
}) {
  const router = useRouter();
  const practice = practiceByPosition[module.position] ?? defaultPractice;
  const lessonBlocks = useMemo(() => formatContent(module.content), [module.content]);
  const [answers, setAnswers] = useState<number[]>(Array(practice.quiz.length).fill(-1));
  const [checkedItems, setCheckedItems] = useState<string[]>([]);
  const [showScore, setShowScore] = useState(false);
  const [status, setStatus] = useState<ModuleStatus>(initialStatus);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const quizScore = scoreQuiz(answers, practice.quiz);
  const quizPercent = Math.round((quizScore / practice.quiz.length) * 100);
  const checkedPercent = Math.round((checkedItems.length / practice.checklist.length) * 100);
  const canComplete = enrollmentId && answers.every((answer) => answer >= 0) && checkedItems.length === practice.checklist.length;

  function toggleChecklist(item: string) {
    setCheckedItems((current) => current.includes(item) ? current.filter((value) => value !== item) : [...current, item]);
  }

  async function updateProgress(nextStatus: "in_progress" | "completed") {
    if (!enrollmentId) return;

    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch(`/api/modules/${module.id}/progress`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollmentId,
          status: nextStatus,
          score: nextStatus === "completed" ? quizPercent : undefined,
          timeSpentMinutes: nextStatus === "completed" ? module.estimatedMinutes : 5,
        }),
      });
      const result = (await response.json()) as ApiResponse<unknown>;

      if (!result.success) {
        setError(result.error.message);
        return;
      }

      setStatus(nextStatus);
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      {!enrollmentId ? (
        <Alert>
          <AlertDescription>Enroll in this course before saving module progress.</AlertDescription>
        </Alert>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap gap-2">
              <Badge>{course.curriculumCode ?? "Course"}</Badge>
              <Badge variant="secondary">{course.gradeLabel ?? "All grades"}</Badge>
              <Badge variant="outline">Module {module.position}</Badge>
            </div>
            <CardTitle className="max-w-4xl text-3xl">{module.title}</CardTitle>
            <CardDescription className="text-base leading-7">{module.summary}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div className="surface-card p-4">
              <FileText className="mb-2 h-4 w-4 text-primary" />
              <div className="font-semibold">{module.estimatedMinutes} minutes</div>
              <div className="text-xs text-muted-foreground">Estimated time</div>
            </div>
            <div className="surface-card p-4">
              <Layers3 className="mb-2 h-4 w-4 text-primary" />
              <div className="font-semibold">{module.type}</div>
              <div className="text-xs text-muted-foreground">Module type</div>
            </div>
            <div className="surface-card p-4">
              <CheckCircle2 className="mb-2 h-4 w-4 text-primary" />
              <div className="font-semibold capitalize">{status.replace("_", " ")}</div>
              <div className="text-xs text-muted-foreground">Progress state</div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Path position</CardTitle>
            <CardDescription>{course.title}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {modules.map((item) => (
              <Link
                key={item.id}
                href={`/dashboard/courses/${course.id}/modules/${item.id}`}
                className={`block rounded-2xl px-4 py-3 text-sm transition hover:bg-accent ${item.id === module.id ? "bg-primary text-primary-foreground shadow-[var(--shadow-sm)]" : "bg-muted/55"}`}
              >
                <span className="font-semibold">{item.position}. {item.title}</span>
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl"><BookOpenCheck className="h-5 w-5 text-primary" />Lesson material</CardTitle>
            <CardDescription>Read the module flow before completing the practice tasks.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {lessonBlocks.map((block, index) => {
              const [label, ...rest] = block.split(": ");
              const hasLabel = rest.length > 0 && label.length < 32;
              return (
                <div key={block} className="rounded-[1.35rem] bg-muted/45 p-4 leading-7">
                  {hasLabel ? <div className="mb-1 text-sm font-semibold text-primary">{label}</div> : null}
                  <p className="text-sm text-muted-foreground">{hasLabel ? rest.join(": ") : block}</p>
                  {!hasLabel ? <div className="sr-only">Lesson block {index + 1}</div> : null}
                </div>
              );
            })}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl"><Sparkles className="h-5 w-5 text-primary" />Recommended materials</CardTitle>
            <CardDescription>Global materials matched to {course.subjectCode ?? "this subject"}, {course.gradeLabel ?? "this grade"}, and {course.curriculumCode ?? "this curriculum"}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {assets.length === 0 ? (
              <div className="rounded-[1.35rem] bg-muted/45 p-4 text-sm text-muted-foreground">No matched platform materials found for this module scope.</div>
            ) : assets.map((asset) => (
              <div key={asset.id} className="rounded-[1.35rem] bg-muted/45 p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{asset.kind}</Badge>
                  <span className="font-semibold">{asset.title}</span>
                </div>
                <p className="text-sm leading-6 text-muted-foreground">{asset.description}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl"><ClipboardCheck className="h-5 w-5 text-primary" />Interactive practice</CardTitle>
            <CardDescription>{practice.instructions}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {practice.prompts.map((prompt, index) => (
                <div key={prompt} className="rounded-[1.25rem] bg-primary/7 p-4 text-sm leading-6">
                  <div className="mb-2 font-semibold text-primary">Prompt {index + 1}</div>
                  {prompt}
                </div>
              ))}
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="font-semibold">Practice checklist</span>
                <span className="text-muted-foreground">{checkedPercent}%</span>
              </div>
              <Progress value={checkedPercent} />
              {practice.checklist.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleChecklist(item)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm transition ${checkedItems.includes(item) ? "bg-primary text-primary-foreground" : "bg-muted/55 hover:bg-accent"}`}
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-background/70 text-xs text-foreground">
                    {checkedItems.includes(item) ? "OK" : ""}
                  </span>
                  {item}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Quick check quiz</CardTitle>
            <CardDescription>Answer every question before marking the module complete.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {practice.quiz.map((question, questionIndex) => (
              <div key={question.prompt} className="space-y-3 rounded-[1.35rem] bg-muted/45 p-4">
                <div className="font-semibold">{questionIndex + 1}. {question.prompt}</div>
                <div className="grid gap-2">
                  {question.options.map((option, optionIndex) => {
                    const isSelected = answers[questionIndex] === optionIndex;
                    const isCorrect = question.answerIndex === optionIndex;
                    const showState = showScore && (isSelected || isCorrect);
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => {
                          setAnswers((current) => current.map((answer, index) => index === questionIndex ? optionIndex : answer));
                          setShowScore(false);
                        }}
                        className={`rounded-2xl px-4 py-3 text-left text-sm transition ${isSelected ? "bg-primary text-primary-foreground" : "bg-background/70 hover:bg-accent"} ${showState && isCorrect ? "ring-2 ring-primary/50" : ""}`}
                      >
                        {option}
                      </button>
                    );
                  })}
                </div>
                {showScore ? <p className="text-sm text-muted-foreground">{question.feedback}</p> : null}
              </div>
            ))}

            {showScore ? (
              <Alert>
                <AlertDescription>Your quick check score is {quizScore}/{practice.quiz.length} ({quizPercent}%).</AlertDescription>
              </Alert>
            ) : null}

            {error ? (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="outline" onClick={() => setShowScore(true)} disabled={answers.some((answer) => answer < 0)}>
                <ClipboardCheck className="h-4 w-4" />
                Check answers
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setAnswers(Array(practice.quiz.length).fill(-1));
                  setShowScore(false);
                }}
              >
                <RotateCcw className="h-4 w-4" />
                Try again
              </Button>
              <Button type="button" onClick={() => updateProgress("completed")} disabled={!canComplete || isSaving}>
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Mark module complete
              </Button>
            </div>
            {!canComplete ? <p className="text-sm text-muted-foreground">Complete the checklist and answer every quiz question to enable completion.</p> : null}
          </CardContent>
        </Card>
      </section>

      <div className="flex flex-wrap justify-between gap-3">
        {previousModuleId ? <Button asChild variant="outline"><Link href={`/dashboard/courses/${course.id}/modules/${previousModuleId}`}>Previous module</Link></Button> : <span />}
        {nextModuleId ? <Button asChild><Link href={`/dashboard/courses/${course.id}/modules/${nextModuleId}`}>Next module <ArrowRight className="h-4 w-4" /></Link></Button> : <Button asChild><Link href={`/dashboard/courses/${course.id}`}>Back to course</Link></Button>}
      </div>
    </div>
  );
}
