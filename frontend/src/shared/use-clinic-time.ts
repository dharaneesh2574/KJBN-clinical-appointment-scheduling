import { useEffect, useState } from "react";

// This clock drives display and button hints only. The API decides every rule.
export function useClinicTime(reviewNow: string): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);
  return reviewNow || new Date(now).toISOString();
}
