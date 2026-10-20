import { SectionTabs } from "@/components/shared/section-tabs";

/** Onboarding | Templates, for people who can use templates. */
export function OnboardingTabs() {
  return (
    <SectionTabs
      items={[
        { href: "/onboarding", label: "Onboarding", exact: true },
        { href: "/onboarding/templates", label: "Templates" },
      ]}
    />
  );
}
