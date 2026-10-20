import { SectionTabs } from "@/components/shared/section-tabs";

export function TaskTabs() {
  return (
    <SectionTabs
      items={[
        { href: "/tasks/assigned-to-me", label: "My tasks" },
        { href: "/tasks", label: "All tasks", exact: true },
      ]}
    />
  );
}
