// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ContactScreen } from "./ContactScreen";

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

describe("ContactScreen", () => {
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

  it("renders the contact details without a dashboard link or educational disclaimer", () => {
    act(() => {
      root.render(
        <MemoryRouter initialEntries={["/contact/"]}>
          <ContactScreen />
        </MemoryRouter>
      );
    });

    expect(container.querySelector("h1")?.textContent).toBe("Get in touch.One inbox, one human.");
    expect(container.textContent).toContain("No forms, no ticketing system — just an email address.");
    expect(container.querySelector<HTMLAnchorElement>(".contact-page__email-card")?.getAttribute("href")).toBe("mailto:hello@abgmaster.com");
    expect(Array.from(container.querySelectorAll(".contact-page__topic-card h2")).map(heading => heading.textContent)).toEqual([
      "Feedback",
      "Corrections",
      "Everything else"
    ]);
    expect(container.querySelector("a[href=\"/dashboard\"]")).toBeNull();
    expect(container.querySelector(".comp-rules-page__footer")).toBeNull();
    expect(container.querySelector(".contact-page__footer")?.textContent).toContain("© 2026 ABG Master · Dr Thanh Truong");
  });
});
