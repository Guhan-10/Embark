import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

type PaginationProps = {
  page: number;
  pageCount: number;
  total: number;
  /** The page's path, e.g. "/employees". */
  basePath: string;
  /** Current search params, kept when moving between pages. */
  searchParams: Record<string, string | string[] | undefined>;
};

function hrefFor(basePath: string, searchParams: PaginationProps["searchParams"], page: number) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(searchParams)) {
    if (key === "page" || value === undefined) continue;
    for (const v of Array.isArray(value) ? value : [value]) params.append(key, v);
  }
  if (page > 1) params.set("page", String(page));
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/** Previous/next links that keep the current filters. Hidden when everything fits on one page. */
export function Pagination({ page, pageCount, total, basePath, searchParams }: PaginationProps) {
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-4 flex items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground">
        Page {page} of {pageCount} · {total} results
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Button variant="outline" size="lg" asChild>
            <Link href={hrefFor(basePath, searchParams, page - 1)} rel="prev">
              <ChevronLeft /> Previous
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="lg" disabled>
            <ChevronLeft /> Previous
          </Button>
        )}
        {page < pageCount ? (
          <Button variant="outline" size="lg" asChild>
            <Link href={hrefFor(basePath, searchParams, page + 1)} rel="next">
              Next <ChevronRight />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="lg" disabled>
            Next <ChevronRight />
          </Button>
        )}
      </div>
    </nav>
  );
}
