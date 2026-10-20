"use server";

import { requireUser } from "@/lib/auth/rbac";
import { runAction, type ActionResult } from "@/lib/utils/action";
import { exportReport } from "./service";
import type { ExportInput } from "./types";

/** Returns the CSV text; the export button turns it into a download. */
export async function exportReportAction(
  input: ExportInput,
): Promise<ActionResult<{ filename: string; csv: string }>> {
  return runAction(async () => exportReport(await requireUser(), input));
}
