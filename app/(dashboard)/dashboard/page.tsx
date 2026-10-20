import type { Metadata } from "next";
import { HrDashboard } from "@/features/reports/components/hr-dashboard";
import { MyDashboard } from "@/features/reports/components/my-dashboard";
import { can, requirePageAccess } from "@/lib/auth/rbac";
import { PERMISSIONS } from "@/lib/constants/permissions";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requirePageAccess();
  return can(user, PERMISSIONS.REPORT_READ) ? <HrDashboard user={user} /> : <MyDashboard user={user} />;
}
