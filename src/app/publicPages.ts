export interface PublicResource {
  href: string;
  label: string;
  title: string;
  description: string;
}

export interface PublicUpdate {
  date: string;
  label: string;
  title: string;
  summary: string;
}

export const publicResources: PublicResource[] = [
  {
    href: "/abg-interpretation/",
    label: "Step-by-step guide",
    title: "How to Interpret a Blood Gas",
    description: "Work through a structured approach to oxygenation, acid-base disorders, compensation, and mixed patterns."
  },
  {
    href: "/blood-gas-compensation-rules/",
    label: "Methodology",
    title: "Blood Gas Compensation Rules",
    description: "Review the compensation rules ABG Master uses to teach and explain generated practice cases."
  },
  {
    href: "/anion-gap/",
    label: "Core concept",
    title: "Anion Gap Explained",
    description: "Learn how to calculate, correct, and interpret the anion gap in clinical context."
  },
  {
    href: "/delta-ratio/",
    label: "Mixed disorders",
    title: "Delta Ratio Explained",
    description: "Use the delta ratio to reason through additional metabolic processes in high-anion-gap acidosis."
  }
];

// Keep this list limited to confirmed public additions. Add new entries when the
// corresponding change has been released, with the release date as the source of truth.
export const publicUpdates: PublicUpdate[] = [
  {
    date: "2026-06-19",
    label: "June 2026",
    title: "Anion gap guide added",
    summary: "Published a public guide covering anion gap calculation, albumin correction, and common interpretation pitfalls."
  }
];
