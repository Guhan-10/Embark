"use client";

import { useEffect, useState } from "react";
import { getUnreadCountAction } from "@/features/notifications/actions";

/**
 * Unread notification count for the bell: starts from the server's number, then refreshes every minute
 * and whenever the tab regains focus. Resets when the server sends a new number (e.g. after "mark all read").
 */
export function useUnreadCount(serverCount: number, intervalMs = 60_000) {
  const [state, setState] = useState({ base: serverCount, count: serverCount });
  if (state.base !== serverCount) setState({ base: serverCount, count: serverCount });

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const count = await getUnreadCountAction();
        if (active) setState((s) => ({ ...s, count }));
      } catch {
        // Offline or signed out: keep the last number.
      }
    };
    const timer = setInterval(refresh, intervalMs);
    window.addEventListener("focus", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [intervalMs]);

  return state.count;
}
