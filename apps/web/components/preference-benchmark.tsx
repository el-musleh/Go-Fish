"use client";

import { startTransition, useState } from "react";

import type { BenchmarkQuestion, BenchmarkSubmission, TasteProfile } from "@go-fish/contracts";
import { benchmarkSubmissionSchema } from "@go-fish/contracts";
import { Button, Card, Chip } from "@go-fish/ui";

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
  const [currentIndex, setCurrentIndex] = useState(0);

  const currentQuestion = questions[currentIndex];

  if (!currentQuestion) {
    return null;
  }

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

  function goBack() {
    setError(null);
    setCurrentIndex((current) => Math.max(0, current - 1));
  }

  function goNext() {
    if (!currentQuestion) {
      return;
    }

    if ((selections[currentQuestion.id] ?? []).length === 0) {
      setError("Choose at least one option to continue.");
      return;
    }

    setError(null);
    setCurrentIndex((current) => Math.min(questions.length - 1, current + 1));
  }

  function handleSubmit() {
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
            setError(submitError instanceof Error ? submitError.message : "Could not save preferences.");
          })
          .finally(() => setIsSaving(false));
      });
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : "Please answer all benchmark questions.");
    }
  }

  return (
    <div className="gf-stack gf-stack--xl">
      <h2 className="gf-section-title">{currentQuestion.label}</h2>
      <Card>
        <div className="gf-chip-grid">
          {currentQuestion.options.map((option) => {
            const active = (selections[currentQuestion.id] ?? []).includes(option);
            return (
              <button className="gf-chip-button" key={option} onClick={() => toggle(currentQuestion.id, option)} type="button">
                <Chip active={active}>{option}</Chip>
              </button>
            );
          })}
        </div>
      </Card>
      {error ? <p className="gf-feedback gf-feedback--error">{error}</p> : null}
      <div className="gf-actions">
        <Button disabled={currentIndex === 0 || isSaving} onClick={goBack} type="button" variant="ghost">
          Back
        </Button>
        <span className="gf-muted">{currentIndex + 1}/{questions.length}</span>
        {currentIndex < questions.length - 1 ? (
          <Button disabled={(selections[currentQuestion.id] ?? []).length === 0 || isSaving} onClick={goNext} type="button">
            Next
          </Button>
        ) : (
          <Button loading={isSaving} onClick={handleSubmit} type="button">
            {submitLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
