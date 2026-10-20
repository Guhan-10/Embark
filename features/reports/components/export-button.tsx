"use client";

import { useTransition } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";
import { LoadingSpinner } from "@/components/shared/loading-spinner";
import { exportReportAction } from "../actions";
import type { ExportInput } from "../types";

/** Builds the CSV on the server and saves it as a file. */
export function ExportButton({ kind, departmentId, label }: ExportInput & { label: string }) {
  const [pending, startTransition] = useTransition();
  const run = () =>
    startTransition(async () => {
      const result = await exportReportAction({ kind, departmentId });
      if (!result.ok) return void toast.error(result.error);
      const url = URL.createObjectURL(new Blob([result.data.csv], { type: "text/csv;charset=utf-8" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: result.data.filename });
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${result.data.filename}`);
    });
  return (
    <Button variant="outline" className="h-11 rounded-full bg-card px-4" onClick={run} disabled={pending}>
      {pending ? <LoadingSpinner label="Exporting" /> : <Download />} {label}
    </Button>
  );
}
