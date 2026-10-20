"use client";

import { useEffect, useState } from "react";

/** The value, but only after it has stopped changing for `delayMs` (e.g. search-as-you-type). */
export function useDebounce<T>(value: T, delayMs = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}
