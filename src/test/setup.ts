import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

// jsdom has no layout, so scrollTo is not implemented and every navigation logs a "Not
// implemented" error. The router scrolls to the top on a push, which is real behaviour worth
// keeping, so the method is stubbed rather than the call removed.
window.scrollTo = vi.fn() as unknown as typeof window.scrollTo;

// Each test renders its own screen; without this the previous one stays in the document and
// queries start matching two of everything.
afterEach(() => {
  cleanup();
});
