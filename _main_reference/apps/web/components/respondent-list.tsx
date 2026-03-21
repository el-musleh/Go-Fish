"use client";

import { Chip } from "@go-fish/ui";
import type { Invitee } from "@go-fish/contracts";

import { prettyDate } from "../lib/date";

export function RespondentList({ invitees }: { invitees: Invitee[] }) {
  if (invitees.length === 0) {
    return <p className="gf-muted">No respondents yet.</p>;
  }

  return (
    <div className="gf-respondent-list">
      {invitees.map((invitee) => (
        <div className="gf-respondent" key={invitee.id}>
          <div style={{ flex: 1 }}>
            <span className="gf-respondent__name">
              {invitee.name ?? invitee.email.split("@")[0]}
            </span>
            {invitee.responseStatus === "responded" && invitee.availableDates.length > 0 ? (
              <div className="gf-respondent__dates">
                {invitee.availableDates.map((date) => (
                  <Chip active key={date}>
                    {prettyDate(date)}
                  </Chip>
                ))}
              </div>
            ) : null}
          </div>
          <Chip active={invitee.responseStatus === "responded"}>
            {invitee.responseStatus === "responded" ? "Responded" : "Pending"}
          </Chip>
        </div>
      ))}
    </div>
  );
}
