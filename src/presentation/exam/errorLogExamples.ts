import type { errorLogClient } from "../../core/examErrorLog";
import type { ErrorLogEntry, ErrorLogExamplePage } from "./errorLogTypes";

type Client = ReturnType<typeof errorLogClient>;
type Page = ErrorLogExamplePage & { loading?: boolean; error?: string };
export type ExamplePages = Record<string, Page>;

class ErrorLogExamples {
  private pages: ExamplePages = {};
  private listeners = new Set<() => void>();
  private entries = new Map<string, ErrorLogEntry>();

  constructor(private client: Client) {}

  snapshot = () => this.pages;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private publish(pages: ExamplePages) {
    this.pages = pages;
    this.listeners.forEach(listener => listener());
  }

  reconcile(entries: ErrorLogEntry[]) {
    const next = new Map(entries.map(entry => [entry.conceptId, entry]));
    let pages = this.pages;
    for (const id of Object.keys(pages)) {
      const before = this.entries.get(id);
      const after = next.get(id);
      if (after && before?.exampleCount === after.exampleCount && before.lastSavedAt === after.lastSavedAt) continue;
      if (pages === this.pages) pages = { ...pages };
      delete pages[id];
    }
    this.entries = next;
    if (pages !== this.pages) this.publish(pages);
  }

  cancelPending() {
    let pages = this.pages;
    for (const [id, page] of Object.entries(this.pages)) {
      if (!page.loading) continue;
      if (pages === this.pages) pages = { ...pages };
      if (page.nextCursor) pages[id] = { ...page, loading: false };
      else delete pages[id];
    }
    if (pages !== this.pages) this.publish(pages);
  }

  async load(id: string, next = false) {
    const previous = this.pages[id];
    if (!this.entries.has(id) || previous?.loading) return;
    const cursor = next ? previous?.nextCursor : null;
    const pending = { examples: previous?.examples ?? [], nextCursor: cursor ?? null, error: previous?.error, loading: true };
    this.publish({ ...this.pages, [id]: pending });
    try {
      const page = await this.client.examples(id, cursor);
      if (this.pages[id] !== pending) return;
      const examples = cursor ? [...pending.examples, ...page.examples.filter(e => !pending.examples.some(old => old.id === e.id))] : page.examples;
      this.publish({ ...this.pages, [id]: { examples, nextCursor: page.nextCursor } });
    } catch {
      if (this.pages[id] === pending) this.publish({ ...this.pages, [id]: { ...pending, loading: false,
        error: "We couldn't load your saved examples. Please try again." } });
    }
  }
}

const caches = new WeakMap<Client, ErrorLogExamples>();
export function examplesFor(client: Client) {
  let cache = caches.get(client);
  if (!cache) { cache = new ErrorLogExamples(client); caches.set(client, cache); }
  return cache;
}
