import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shows PDFs and images inline; other files (Word) get a download card. */
export function DocumentPreview({ url, mimeType, fileName }: { url: string; mimeType: string; fileName: string }) {
  if (mimeType === "application/pdf") {
    return <iframe src={`${url}?inline=1`} title={`Preview of ${fileName}`} className="h-[70svh] w-full rounded-2xl border bg-muted" />;
  }
  if (mimeType.startsWith("image/")) {
    // eslint-disable-next-line @next/next/no-img-element -- a private, access-checked file, not a static asset
    return <img src={`${url}?inline=1`} alt={`Preview of ${fileName}`} className="max-h-[70svh] w-full rounded-2xl border bg-muted object-contain" />;
  }
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed bg-muted/40 px-4 py-16 text-center">
      <FileText className="size-10 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">This file type can&apos;t be previewed. Download it to open it.</p>
      <Button asChild className="rounded-full">
        <a href={url}>
          <Download /> Download
        </a>
      </Button>
    </div>
  );
}
