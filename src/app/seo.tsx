import { useEffect } from "react";
import { useLocation } from "react-router-dom";

const SITE_URL = "https://www.abgmaster.com";

interface SeoMetadataConfig {
  title: string;
  description: string;
}

const HOME_METADATA: SeoMetadataConfig = {
  title: "ABG Master | Learn Blood Gas Interpretation",
  description: "Learn blood gas interpretation with step-by-step lessons, interactive ABG practice cases, and exam-style questions."
};

const SEO_BY_PATH: Record<string, SeoMetadataConfig> = {
  "/": HOME_METADATA,
  "/practice": {
    title: "ABG Practice Cases | ABG Master",
    description: "Practise ABG interpretation with interactive blood gas cases, step-by-step feedback, and progressive difficulty."
  },
  "/learn": {
    title: "Learn ABG Interpretation | ABG Master",
    description: "Build your ABG interpretation skills with structured lessons covering pH, PaCO2, bicarbonate, compensation, anion gap, and mixed disorders."
  },
  "/learn/foundations": {
    title: "ABG Basics: pH, PaCO2 and HCO3 | ABG Master",
    description: "Learn the foundations of ABG interpretation, including pH, PaCO2, bicarbonate, acid-base status, and the first steps in reading a blood gas."
  },
  "/learn/beginner": {
    title: "Primary ABG Disorders Explained | ABG Master",
    description: "Learn how to identify the primary acid-base disorder in an ABG using pH, PaCO2, and bicarbonate."
  },
  "/learn/intermediate": {
    title: "ABG Compensation Explained | ABG Master",
    description: "Learn how compensation works in ABG interpretation and how to recognise when the body response does not fit."
  },
  "/learn/advanced": {
    title: "Anion Gap Explained | ABG Master",
    description: "Learn how to calculate and interpret the anion gap, including raised anion gap acidosis and common clinical patterns."
  },
  "/learn/master": {
    title: "Mixed Acid-Base Disorders | ABG Master",
    description: "Learn how to recognise mixed acid-base disorders, layered metabolic processes, and complex ABG patterns."
  },
  "/privacy": {
    title: "Privacy Notice | ABG Master",
    description: "Read how ABG Master handles signup emails, browser storage, protected practice submissions, analytics, and diagnostics."
  },
  "/blood-gas-compensation-rules": {
    title: "Blood Gas Compensation Rules Explained | ABG Master",
    description: "Learn the blood gas compensation rules used by ABG Master, including Winter's formula, metabolic alkalosis compensation, and acute and chronic respiratory compensation."
  },
  "/delta-ratio": {
    title: "Delta Ratio Explained | ABG Master",
    description: "Learn how to calculate and interpret the delta ratio in high anion gap metabolic acidosis, with worked examples for detecting mixed metabolic disorders."
  },
  "/abg-interpretation": {
    title: "ABG Interpretation | Step-by-Step Guide to Blood Gas Analysis",
    description: "Learn how to interpret an ABG step by step, including oxygenation, pH, primary acid-base process, compensation, anion gap, mixed disorders, and ABG vs VBG differences."
  },
  "/anion-gap": {
    title: "Anion Gap Explained | ABG Master",
    description: "Learn how to calculate and interpret the anion gap, including normal ranges, albumin correction, high-gap acidosis, normal-gap acidosis, and key pitfalls."
  }
};

const CANONICAL_PATH_BY_PATH: Record<string, string> = {
  "/blood-gas-compensation-rules": "/blood-gas-compensation-rules/",
  "/delta-ratio": "/delta-ratio/",
  "/abg-interpretation": "/abg-interpretation/",
  "/anion-gap": "/anion-gap/"
};

function normalizePathname(pathname: string) {
  if (pathname === "/") return pathname;
  return pathname.replace(/\/+$/, "");
}

function upsertMetaByName(name: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("name", name);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

function upsertMetaByProperty(property: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[property="${property}"]`);

  if (!element) {
    element = document.createElement("meta");
    element.setAttribute("property", property);
    document.head.appendChild(element);
  }

  element.setAttribute("content", content);
}

function upsertCanonical(href: string) {
  let element = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

  if (!element) {
    element = document.createElement("link");
    element.setAttribute("rel", "canonical");
    document.head.appendChild(element);
  }

  element.setAttribute("href", href);
}

export function SeoMetadata() {
  const location = useLocation();

  useEffect(() => {
    const pathname = normalizePathname(location.pathname);
    const metadata = SEO_BY_PATH[pathname] ?? HOME_METADATA;
    const canonicalPath = CANONICAL_PATH_BY_PATH[pathname] ?? (SEO_BY_PATH[pathname] ? pathname : "/");
    const canonicalUrl = `${SITE_URL}${canonicalPath}`;

    document.title = metadata.title;
    upsertMetaByName("description", metadata.description);
    upsertCanonical(canonicalUrl);
    upsertMetaByProperty("og:title", metadata.title);
    upsertMetaByProperty("og:description", metadata.description);
    upsertMetaByProperty("og:url", canonicalUrl);
    upsertMetaByName("twitter:title", metadata.title);
    upsertMetaByName("twitter:description", metadata.description);
  }, [location.pathname]);

  return null;
}
