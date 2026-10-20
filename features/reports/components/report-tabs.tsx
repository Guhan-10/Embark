import { SectionTabs } from "@/components/shared/section-tabs";

export function ReportTabs() {
  return (
    <SectionTabs
      items={[
        { href: "/reports", label: "Overview", exact: true },
        { href: "/reports/onboarding", label: "Onboarding" },
        { href: "/reports/employees", label: "Employees" },
      ]}
    />
  );
}
