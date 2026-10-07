// Optional presentation inputs, separate from authored assessment and grading contracts.
export interface ErrorLogConceptPresentation {
  id: string;
  label: string;
  topic: string;
  type: string;
  lastSaved: string;
  examples: { id?: string; attemptId?: string; partId?: string; part: string; prompt: string; attempt: string; date: string }[];
  topicId?: string;
  exampleCount?: number;
  examplesLoading?: boolean;
  examplesError?: string;
  hasMoreExamples?: boolean;
  archived?: boolean;
  reopened?: boolean;
}

export interface ErrorLogEntry {
  conceptId: string;
  status: "to_review" | "archived";
  createdAt: string;
  lastSavedAt: string;
  archivedAt: string | null;
  reopenedAt: string | null;
  exampleCount: number;
}
export interface ErrorLogState {
  catalogue: ErrorLogCatalogue;
  entries: ErrorLogEntry[];
  attemptId: string | null;
  savedSources: Record<string, string[]>;
  toReviewCount: number;
}
export interface ErrorLogExample {
  id: string; attemptId: string; unitId: string; partId: string; prompt: string;
  questionNumber: number; partNumber: number; examKind: "mock" | "custom";
  finishedAt: string; savedAt: string;
}
export interface ErrorLogExamplePage {
  examples: ErrorLogExample[];
  nextCursor: { savedAt: string; id: string } | null;
}

export interface ErrorLogSaveConcept {
  id: string;
  label: string;
  saved?: boolean;
}

export type ErrorLogSavePresentation = Record<string, readonly ErrorLogSaveConcept[]>;

// Safe post-submission metadata. Catalogue definitions stay separate from frozen mappings.
export interface ErrorLogMapping {
  partConceptIds?: string[];
  criterionConceptIds?: Record<string, string[]>;
  incorrectOptionConceptIds?: Record<string, string[]>;
}

export interface ErrorLogCatalogue {
  topics: { id: string; label: string }[];
  concepts: { id: string; label: string; topicId: string; errorType: string; active: boolean }[];
}

// One suggested study area per source Part. Display labels resolve from the current catalogue.
export interface ErrorLogCandidate {
  conceptId: string;
  partId: string;
  evidence: {
    partMarkLoss: boolean;
    criterionIds: string[];
    incorrectOptionIds: string[];
    unanswered: boolean;
  };
}
