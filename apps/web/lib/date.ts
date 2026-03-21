export function eachDateInRange(dateFrom: string, dateTo: string) {
  const dates: string[] = [];
  let cursor = new Date(`${dateFrom}T00:00:00.000Z`);
  const end = new Date(`${dateTo}T00:00:00.000Z`);

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }

  return dates;
}

export function prettyDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

export function formatDateCard(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00.000Z`);
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  let label: string;
  if (dateStr === todayStr) {
    label = "Today";
  } else if (dateStr === tomorrow) {
    label = "Tmrw";
  } else {
    label = date.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  }

  return {
    label,
    day: String(date.getUTCDate()),
    month: date.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
  };
}

