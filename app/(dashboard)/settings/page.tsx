import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, ChevronRight, FileCog, History, ShieldCheck, UserCog, type LucideIcon } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { getSettingsSummary } from "@/features/settings/queries";
import { SettingsTabs } from "@/features/settings/components/settings-tabs";
import { settingsSectionsFor, type SettingsSectionKey } from "@/features/settings/sections";
import { requirePageAccess } from "@/lib/auth/rbac";
import { cn } from "@/lib/utils/cn";
import { plural } from "@/lib/utils/format";

export const metadata: Metadata = { title: "Settings" };

const LOOK: Record<SettingsSectionKey, { icon: LucideIcon; tone: string }> = {
  users: { icon: UserCog, tone: "bg-sky text-info-ink" },
  roles: { icon: ShieldCheck, tone: "bg-mint text-success-ink" },
  departments: { icon: Building2, tone: "bg-accent text-primary-ink" },
  documentTypes: { icon: FileCog, tone: "bg-sun text-pending-ink" },
  audit: { icon: History, tone: "bg-neutral-soft text-neutral-ink" },
};

export default async function SettingsPage() {
  const user = await requirePageAccess();
  const sections = settingsSectionsFor(user);
  if (sections.length === 0) redirect("/dashboard");
  const s = await getSettingsSummary(user);

  const detail: Record<SettingsSectionKey, string | null> = {
    users: s.users === null ? null : `${plural(s.users, "login")}${s.inactiveUsers ? ` · ${s.inactiveUsers} turned off` : ""}`,
    roles: s.roles === null ? null : plural(s.roles, "role"),
    departments:
      s.departments === null ? null : `${plural(s.departments, "department")}${s.unassignedDepartments ? ` · ${s.unassignedDepartments} without HR` : ""}`,
    documentTypes: s.documentTypes === null ? null : plural(s.documentTypes, "document type"),
    audit: s.auditToday === null ? null : `${plural(s.auditToday, "change")} in the last 24 hours`,
  };

  return (
    <>
      <PageHeader title="Settings" description="How Embark is set up for your company." />
      <SettingsTabs user={user} />
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {sections.map((section) => {
          const { icon: Icon, tone } = LOOK[section.key];
          return (
            <li key={section.key}>
              <Link
                href={section.href}
                className="group flex h-full items-start gap-4 rounded-[1.75rem] bg-card p-5 shadow-card transition-transform hover:-translate-y-0.5 focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none"
              >
                <span className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl", tone)} aria-hidden="true">
                  <Icon className="size-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{section.label}</span>
                  <span className="mt-0.5 block text-sm text-muted-foreground">{section.description}</span>
                  {detail[section.key] ? <span className="mt-2 block text-xs font-semibold text-primary-ink">{detail[section.key]}</span> : null}
                </span>
                <ChevronRight className="mt-1 size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}
