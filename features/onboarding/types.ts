import type { z } from "zod";
import type { processListSchema, startOnboardingSchema, teamProgressSchema, templateSchema } from "./schemas";
import type { getProcess, getTemplate, listProcesses, listTeamProgress, listTemplates } from "./queries";

export type TemplateInput = z.input<typeof templateSchema>;
export type StartOnboardingInput = z.input<typeof startOnboardingSchema>;
export type ProcessListFilters = z.input<typeof processListSchema>;
export type TeamProgressFilters = z.input<typeof teamProgressSchema>;

export type ProcessList = Awaited<ReturnType<typeof listProcesses>>;
export type ProcessListItem = ProcessList["items"][number];
export type ProcessDetail = NonNullable<Awaited<ReturnType<typeof getProcess>>>;
export type TemplateSummary = Awaited<ReturnType<typeof listTemplates>>[number];
export type TemplateDetail = NonNullable<Awaited<ReturnType<typeof getTemplate>>>;
export type { Progress } from "./queries";
export type TeamProgress = Awaited<ReturnType<typeof listTeamProgress>>;
export type TeamProgressItem = TeamProgress["items"][number];
