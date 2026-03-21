"use client";

import { startTransition, useRef, useState } from "react";

import type { BenchmarkQuestion, BenchmarkSubmission, TasteProfile } from "@go-fish/contracts";
import { benchmarkSubmissionSchema } from "@go-fish/contracts";
import { Button, Chip } from "@go-fish/ui";

type SelectionMap = Record<string, string[]>;

function toSelectionMap(initialValue?: TasteProfile | null) {
  const next: SelectionMap = {};

  for (const answer of initialValue?.answers ?? []) {
    next[answer.questionId] = [...answer.selections];
  }

  return next;
}

export function PreferenceBenchmark({
  initialValue,
  questions,
  submitLabel = "Save preferences",
  onSubmit,
}: {
  initialValue?: TasteProfile | null;
  questions: readonly BenchmarkQuestion[];
  submitLabel?: string;
  onSubmit: (payload: BenchmarkSubmission) => Promise<void>;
}) {
  const [selections, setSelections] = useState<SelectionMap>(() => toSelectionMap(initialValue));
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [submittedOnce, setSubmittedOnce] = useState(false);
  const questionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const answeredCount = questions.filter((q) => (selections[q.id] ?? []).length > 0).length;
  const progress = questions.length > 0 ? (answeredCount / questions.length) * 100 : 0;

  function toggle(questionId: string, option: string) {
    setSelections((current) => {
      const active = new Set(current[questionId] ?? []);
      if (active.has(option)) {
        active.delete(option);
      } else {
        active.add(option);
      }

      return {
        ...current,
        [questionId]: [...active],
      };
    });
  }

  function handleSubmit() {
    setSubmittedOnce(true);

    // Find first unanswered question
    const firstUnanswered = questions.find((q) => (selections[q.id] ?? []).length === 0);
    if (firstUnanswered) {
      questionRefs.current[firstUnanswered.id]?.scrollIntoView({ behavior: "smooth", block: "center" });
      setError("Please answer all questions.");
      return;
    }

    try {
      setError(null);
      const payload = benchmarkSubmissionSchema.parse({
        answers: questions.map((question) => ({
          questionId: question.id,
          selections: selections[question.id] ?? [],
        })),
      });

      setIsSaving(true);
      startTransition(() => {
        void onSubmit(payload)
          .catch((submitError) => {
            const msg = submitError instanceof Error ? submitError.message : "";
            setError(msg === "Failed to fetch" ? "Could not reach the server. Please try again." : msg || "Could not save preferences.");
          })
          .finally(() => setIsSaving(false));
      });
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : "Please answer all benchmark questions.");
    }
  }

  return (
    <div className="gf-stack gf-stack--xl">
      <div className="gf-benchmark-progress">
        <div className="gf-benchmark-progress__fill" style={{ width: `${progress}%` }} />
      </div>

      {questions.map((question, index) => {
        const questionSelections = selections[question.id] ?? [];
        const hasError = submittedOnce && questionSelections.length === 0;

        return (
          <div
            className={`gf-benchmark-question${hasError ? " gf-benchmark-question--error" : ""}`}
            key={question.id}
            ref={(el) => { questionRefs.current[question.id] = el; }}
          >
            <div className="gf-benchmark-question__header">
              <span className="gf-benchmark-question__number">{index + 1}.</span>
              <span>{question.label}</span>
            </div>
            <div className="gf-chip-grid">
              {question.options.map((option) => {
                const active = questionSelections.includes(option);
                return (
                  <button className="gf-chip-button" key={option} onClick={() => toggle(question.id, option)} type="button">
                    <Chip active={active}>{option}</Chip>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}

      {error ? <p className="gf-feedback gf-feedback--error">{error}</p> : null}
      <Button loading={isSaving} onClick={handleSubmit}>
        {submitLabel}
      </Button>
    </div>
  );
}
