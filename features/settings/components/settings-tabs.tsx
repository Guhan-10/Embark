import { SectionTabs } from "@/components/shared/section-tabs";
import type { CurrentUser } from "@/lib/auth/rbac";
import { settingsSectionsFor } from "../sections";

export function SettingsTabs({ user }: { user: CurrentUser }) {
  return (
    <div className="max-w-full overflow-x-auto [scrollbar-width:none]">
      <SectionTabs
        items={[{ href: "/settings", label: "Overview", exact: true }, ...settingsSectionsFor(user).map((s) => ({ href: s.href, label: s.label }))]}
      />
    </div>
  );
}
