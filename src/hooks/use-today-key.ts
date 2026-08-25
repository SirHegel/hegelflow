"use client";

import { useEffect, useState } from "react";
import { dateKeyInTimeZone } from "@/lib/utils";

export function useTodayKey(initialTodayKey: string, timeZone: string) {
  const [todayKey, setTodayKey] = useState(initialTodayKey);

  useEffect(() => {
    const syncDay = () => setTodayKey(dateKeyInTimeZone(new Date(), timeZone));
    syncDay();
    const interval = window.setInterval(syncDay, 60_000);
    return () => window.clearInterval(interval);
  }, [timeZone]);

  return todayKey;
}
