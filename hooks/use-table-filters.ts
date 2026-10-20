"use client";

import { useCallback, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Reads and writes list filters in the URL (?q=…&status=…), so filtered views survive a refresh and can be
 * shared as a link. Changing a filter goes back to page 1. `pending` is true while the new page loads.
 */
export function useTableFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = useTransition();

  const get = useCallback((key: string) => searchParams.get(key) ?? "", [searchParams]);

  const set = useCallback(
    (updates: Record<string, string | null | undefined>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      params.delete("page");
      const query = params.toString();
      startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }));
    },
    [pathname, router, searchParams],
  );

  const clear = useCallback(() => startTransition(() => router.replace(pathname, { scroll: false })), [pathname, router]);

  return { get, set, clear, pending, hasFilters: searchParams.size > 0 };
}
