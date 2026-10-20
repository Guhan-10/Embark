import type { z } from "zod";
import type { documentListSchema, reviewSchema, uploadMetaSchema } from "./schemas";
import type { getDocument, getDocumentChecklist, listDocuments } from "./queries";

export type UploadMeta = z.input<typeof uploadMetaSchema>;
export type ReviewInput = z.input<typeof reviewSchema>;
export type DocumentListFilters = z.input<typeof documentListSchema>;

export type UploadFile = { name: string; bytes: Uint8Array };

export type DocumentList = Awaited<ReturnType<typeof listDocuments>>;
export type DocumentListItem = DocumentList["items"][number];
export type DocumentDetail = NonNullable<Awaited<ReturnType<typeof getDocument>>>;
export type DocumentChecklist = Awaited<ReturnType<typeof getDocumentChecklist>>;
