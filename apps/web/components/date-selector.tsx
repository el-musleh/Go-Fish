"use client";

import { useState } from "react";

import { Button, Card, Chip } from "@go-fish/ui";

import { eachDateInRange, prettyDate } from "../lib/date";

export function DateSelector({
  dateFrom,
  dateTo,
  initialSelection = [],
  onSubmit,
  submitLabel = "Submit availability",
}: {
  dateFrom: string;
  dateTo: string;
  initialSelection?: string[];
  onSubmit: (dates: string[]) => Promise<void>;
  submitLabel?: string;
}) {
  const [selectedDates, setSelectedDates] = useState<string[]>(initialSelection);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const dateOptions = eachDateInRange(dateFrom, dateTo);

  function toggle(date: string) {
    setSelectedDates((current) => (current.includes(date) ? current.filter((item) => item !== date) : [...current, date].sort()));
  }

  async function handleSubmit() {
    if (selectedDates.length === 0) {
      setError("Pick at least one date.");
      return;
    }

    setIsSaving(true);
    setError(null);
    try {
      await onSubmit(selectedDates);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not save your dates.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="gf-stack gf-stack--xl">
      <h2 className="gf-section-title">Pick your dates</h2>
      <Card className="gf-date-grid">
        {dateOptions.map((date) => (
          <button className="gf-chip-button" key={date} onClick={() => toggle(date)} type="button">
            <Chip active={selectedDates.includes(date)}>{prettyDate(date)}</Chip>
          </button>
        ))}
      </Card>
      {error ? <p className="gf-feedback gf-feedback--error">{error}</p> : null}
      <Button loading={isSaving} onClick={handleSubmit}>
        {submitLabel}
      </Button>
    </div>
  );
}
