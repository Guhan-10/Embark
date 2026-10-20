import type { z } from "zod";
import type { exportSchema, reportRangeSchema } from "./schemas";
import type {
  getHrDashboard,
  getMyDashboard,
  getOnboardingByDepartment,
  getOnboardingTrends,
  getTaskBreakdown,
  getWeekAgenda,
} from "./queries";

export type ReportRange = z.input<typeof reportRangeSchema>;
export type ExportInput = z.input<typeof exportSchema>;

export type HrDashboard = Awaited<ReturnType<typeof getHrDashboard>>;
export type MyDashboard = Awaited<ReturnType<typeof getMyDashboard>>;
export type DepartmentProgress = Awaited<ReturnType<typeof getOnboardingByDepartment>>;
export type OnboardingTrends = Awaited<ReturnType<typeof getOnboardingTrends>>;
export type TaskBreakdown = Awaited<ReturnType<typeof getTaskBreakdown>>;
export type WeekAgenda = Awaited<ReturnType<typeof getWeekAgenda>>;
