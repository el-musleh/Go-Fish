export interface CalendarEvent {
  title: string;
  description?: string;
  location?: string;
  startDate: Date;
  endDate: Date;
}

function formatICSDate(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

function escapeICS(str: string): string {
  return str.replace(/[\\;,\n]/g, (match) => {
    switch (match) {
      case '\n':
        return '\\n';
      case '\\':
        return '\\\\';
      case ';':
        return '\\;';
      case ',':
        return '\\,';
      default:
        return match;
    }
  });
}

export function generateICS(event: CalendarEvent): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Go Fish//Event Planner//EN',
    'BEGIN:VEVENT',
    `DTSTART:${formatICSDate(event.startDate)}`,
    `DTEND:${formatICSDate(event.endDate)}`,
    `SUMMARY:${escapeICS(event.title)}`,
  ];

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeICS(event.description)}`);
  }

  if (event.location) {
    lines.push(`LOCATION:${escapeICS(event.location)}`);
  }

  lines.push('END:VEVENT', 'END:VCALENDAR');
  return lines.join('\r\n');
}

export function downloadICS(event: CalendarEvent, filename: string = 'event.ics') {
  const icsContent = generateICS(event);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function getGoogleCalendarUrl(event: CalendarEvent): string {
  const startDate = event.startDate
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  const endDate = event.endDate
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${startDate}/${endDate}`,
    details: event.description || '',
    location: event.location || '',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function getOutlookCalendarUrl(event: CalendarEvent): string {
  const params = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: event.title,
    startdt: event.startDate.toISOString(),
    enddt: event.endDate.toISOString(),
    body: event.description || '',
    location: event.location || '',
  });
  return `https://outlook.live.com/calendar/0/deeplink/compose?${params.toString()}`;
}

export function getAppleCalendarUrl(event: CalendarEvent): string {
  const icsContent = generateICS(event);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  return URL.createObjectURL(blob);
}

export interface CalendarOption {
  id: string;
  name: string;
  icon: string;
  action: () => void;
}

export function getCalendarOptions(
  event: CalendarEvent,
  filename: string = 'event'
): CalendarOption[] {
  return [
    {
      id: 'google',
      name: 'Google Calendar',
      icon: 'G',
      action: () => {
        window.open(getGoogleCalendarUrl(event), '_blank', 'noopener,noreferrer');
      },
    },
    {
      id: 'outlook',
      name: 'Outlook',
      icon: 'O',
      action: () => {
        window.open(getOutlookCalendarUrl(event), '_blank', 'noopener,noreferrer');
      },
    },
    {
      id: 'apple',
      name: 'Apple Calendar',
      icon: '\u2605',
      action: () => {
        const url = getAppleCalendarUrl(event);
        const link = document.createElement('a');
        link.href = url;
        link.download = `${filename}.ics`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      },
    },
    {
      id: 'download',
      name: 'Download .ics',
      icon: '\u2193',
      action: () => {
        downloadICS(event, `${filename}.ics`);
      },
    },
  ];
}
