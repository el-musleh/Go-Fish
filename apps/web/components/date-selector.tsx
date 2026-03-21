"use client";

import { useState } from "react";

import { Button } from "@go-fish/ui";

import { eachDateInRange, formatDateCard } from "../lib/date";

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
      <h2 className="gf-section-title">When are you free?</h2>
      <div className="gf-date-grid">
        {dateOptions.map((date) => {
          const card = formatDateCard(date);
          const active = selectedDates.includes(date);
          return (
            <button
              className={`gf-date-card${active ? " gf-date-card--active" : ""}`}
              key={date}
              onClick={() => toggle(date)}
              type="button"
            >
              <span className="gf-date-card__label">{card.label}</span>
              <span className="gf-date-card__day">{card.day}</span>
              <span className="gf-date-card__month">{card.month}</span>
            </button>
          );
        })}
      </div>
      {error ? <p className="gf-feedback gf-feedback--error">{error}</p> : null}
      <Button loading={isSaving} onClick={handleSubmit}>
        {selectedDates.length > 0 ? `${submitLabel} (${selectedDates.length})` : submitLabel}
      </Button>
    </div>
  );
}
