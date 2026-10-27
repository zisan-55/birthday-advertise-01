import { useEffect, useState } from "react";
import { getCountdown } from "../lib/time";

export function useCountdown(date: string, time: string, timeZone: string) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let timer: number;
    const updateAtNextSecond = () => {
      const currentTime = Date.now();
      setNow(currentTime);
      timer = window.setTimeout(updateAtNextSecond, 1000 - (currentTime % 1000));
    };
    timer = window.setTimeout(updateAtNextSecond, 1000 - (Date.now() % 1000));
    return () => window.clearTimeout(timer);
  }, []);

  return getCountdown(date, time, timeZone, now);
}
