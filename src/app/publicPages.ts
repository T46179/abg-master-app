export interface PublicResource {
  href: string;
  label: string;
  title: string;
  subtitle: string;
  description: string;
}

export interface PublicUpdate {
  date: string;
  category: "new" | "improved" | "fixed";
  title: string;
  summary: string;
  version?: string;
  subtitle?: string;
  highlights?: string[];
}

export const publicResources: PublicResource[] = [
  {
    href: "/abg-interpretation/",
    label: "Core guide",
    title: "ABG Interpretation",
    subtitle: "Step-by-step",
    description: "A structured walkthrough for reading any arterial blood gas — from pH to compensation, in the order it actually matters."
  },
  {
    href: "/anion-gap/",
    label: "Concept guide",
    title: "Anion Gap",
    subtitle: "Explained",
    description: "One of the quickest ways to make sense of a low bicarbonate — and to decide what's actually replacing it."
  },
  {
    href: "/delta-ratio/",
    label: "Concept guide",
    title: "Delta Ratio",
    subtitle: "When the gap doesn't add up",
    description: "The follow-up question to the anion gap. Use it to uncover a second, hidden acid–base disorder lurking beneath the obvious one."
  },
  {
    href: "/blood-gas-compensation-rules/",
    label: "Reference",
    title: "Compensation Rules",
    subtitle: "Expected, not assumed",
    description: "The formulas worth memorising, and the reasoning behind them — so you can tell adequate compensation from a mixed picture."
  }
];

// Keep this list limited to confirmed public additions. Add new entries when the
// corresponding change has been released, with the release date as the source of truth.
export const publicUpdates: PublicUpdate[] = [
  {
    date: "2026-06-28",
    version: "v1.4",
    category: "fixed",
    title: "Mobile Navigation",
    summary: "UI fixes, explanation cleanup and a new mobile navigation menu",
    highlights: [
      "Fixed an issue that occured when only 2-3 metric value cards were displayed on mobile devices. Metric cards should now display properly on mobile devices",
      "Fixed summary explanations and internal consistency for some acute-on-chronic COPD cases",
      "Added a new contact page",
      "Improved the mobile navigation menu",
      "General UI fixes"
    ]
  },
  {
    date: "2026-06-21",
    version: "v1.4",
    category: "new",
    title: "Updates Page",
    subtitle: "A home for the changelog",
    summary: "Added a new page outlining recent changes to ABG Master, along with dashboard and resource-page improvements",
    highlights: [
      "New Updates page",
      "Added a new resource page: Anion Gap",
      "UI fixes to resource pages and the main dashboard",
      "Updated the dashboard footer with links to Updates, Resources, About, Analytics choices, and Privacy"
    ]
  },
  {
    date: "2026-06-14",
    version: "v1.3",
    category: "new",
    title: "New Dashboard",
    summary: "Added a brand new Dashboard and some QOL improvements",
    highlights: [
      "Added a new dashboard that is clearer and more concise. It includes rotating clinical pearls, a featured case tile (in progress) and various other UI fixes",
      "UI fixes for clearer progress visibility",
      "Updated privacy notice",
      "Updated website footer"
    ]
  },
  {
    date: "2026-06-07",
    version: "v1.2",
    category: "new",
    title: "Insights",
    subtitle: "Detailed breakdown of your progress",
    summary: "Insights are now available to provide more granular detail about your progress",
    highlights: [
      "Added a new Insights page, where you can review recent performance and get personalised feedback on areas to improve.",
      "You can now see more structured recent-case review and clearer pattern detection based on your recent performance, rather than old results lingering indefinitely",
      "Made practice feedback labels and summaries clearer in several places, including broader acid-base pattern wording that should be easier to interpret",
      "Added new Master-level cases, including the first oxygenation-focused cases. These are limited while I test and validate them. They are intentionally complex, so you’ll need to have unlocked Master level to encounter them",
      "Fixed a few content issues affecting some advanced DKA-related cases",
      "Privacy notice updates"
    ]
  }
];
