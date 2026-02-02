import { format } from 'date-fns';

interface ICSEventData {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endTime?: string | null; // HH:mm
  description?: string;
  partySize?: number;
}

function formatICSDate(date: string, time: string): string {
  // Format: YYYYMMDDTHHMMSS
  const [hours, minutes] = time.split(':');
  const dateObj = new Date(`${date}T${hours}:${minutes}:00`);
  return format(dateObj, "yyyyMMdd'T'HHmmss");
}

function escapeICSText(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

export function generateICSContent(event: ICSEventData): string {
  const { id, title, date, startTime, endTime, description, partySize } = event;
  
  const dtStart = formatICSDate(date, startTime);
  // Default to 2 hours if no end time
  const dtEnd = endTime 
    ? formatICSDate(date, endTime)
    : formatICSDate(date, `${(parseInt(startTime.split(':')[0]) + 2).toString().padStart(2, '0')}:${startTime.split(':')[1]}`);
  
  const descriptionParts: string[] = [];
  if (partySize) {
    descriptionParts.push(`Party of ${partySize} guests`);
  }
  if (description) {
    descriptionParts.push(description);
  }
  descriptionParts.push('Hosted SGD event');
  
  const fullDescription = escapeICSText(descriptionParts.join('\\n\\n'));
  const uid = `booking-${id}@sgd.app`;
  const now = format(new Date(), "yyyyMMdd'T'HHmmss'Z'");
  
  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SGD Reservations//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeICSText(title)}`,
    `DESCRIPTION:${fullDescription}`,
    'STATUS:CONFIRMED',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  
  return icsContent;
}

export function downloadICSFile(event: ICSEventData): void {
  const icsContent = generateICSContent(event);
  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = `${event.title.replace(/[^a-zA-Z0-9]/g, '-')}.ics`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
