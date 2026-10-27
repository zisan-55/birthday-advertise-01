export type CountdownValues = {
  hours: number;
  minutes: number;
  seconds: number;
  complete: boolean;
  valid: boolean;
};

const invalidCountdown: CountdownValues = {
  hours: 0,
  minutes: 0,
  seconds: 0,
  complete: false,
  valid: false,
};

function timestampInTimeZone(date: string, time: string, timeZone: string): number | null {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const timeMatch = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!dateMatch || !timeMatch) return null;

  const [year, month, day] = dateMatch.slice(1).map(Number);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const second = timeMatch[3] ? Number(timeMatch[3]) : 0;
  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;

  const wanted = Date.UTC(year, month - 1, day, hour, minute, second);
  let candidate = wanted;
  try {
    const format = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    // Reconcile the requested wall-clock time with what the timezone says the
    // current candidate represents. Two passes cover ordinary DST offsets.
    for (let pass = 0; pass < 2; pass += 1) {
      const parts = Object.fromEntries(format.formatToParts(new Date(candidate)).map((part) => [part.type, part.value]));
      const represented = Date.UTC(
        Number(parts.year), Number(parts.month) - 1, Number(parts.day),
        Number(parts.hour), Number(parts.minute), Number(parts.second),
      );
      candidate += wanted - represented;
    }
    const check = new Date(candidate);
    const localParts = Object.fromEntries(format.formatToParts(check).map((part) => [part.type, part.value]));
    if (
      Number(localParts.year) !== year || Number(localParts.month) !== month || Number(localParts.day) !== day ||
      Number(localParts.hour) !== hour || Number(localParts.minute) !== minute || Number(localParts.second) !== second
    ) return null;
    return candidate;
  } catch {
    return null;
  }
}

export function getCountdown(date: string, time: string, timeZone: string, now = Date.now()): CountdownValues {
  const target = timestampInTimeZone(date, time, timeZone);
  if (target === null) return invalidCountdown;
  const totalSeconds = Math.max(0, Math.ceil((target - now) / 1000));
  return {
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    complete: now >= target,
    valid: true,
  };
}
