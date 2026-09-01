// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { TranslationSafeInline } from "./TranslationSafeInline";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("TranslationSafeInline", () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it("replaces its host wrapper after a translator moves the original text node", () => {
    act(() => {
      root.render(
        <TranslationSafeInline identity="Continue">Continue</TranslationSafeInline>
      );
    });

    const originalWrapper = container.querySelector<HTMLElement>("[data-translation-safe-inline]");
    const originalTextNode = originalWrapper?.firstChild;
    const translatedWrapper = document.createElement("font");

    expect(originalTextNode?.nodeType).toBe(Node.TEXT_NODE);
    originalWrapper?.appendChild(translatedWrapper);
    translatedWrapper.appendChild(originalTextNode as Node);

    expect(() => {
      act(() => {
        root.render(
          <TranslationSafeInline identity="Submit Case">Submit Case</TranslationSafeInline>
        );
      });
    }).not.toThrow();

    const replacementWrapper = container.querySelector<HTMLElement>("[data-translation-safe-inline]");
    expect(replacementWrapper).not.toBe(originalWrapper);
    expect(replacementWrapper?.textContent).toBe("Submit Case");
  });
});
