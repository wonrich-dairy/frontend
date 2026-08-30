import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Each test renders its own screen; without this the previous one stays in the document and
// queries start matching two of everything.
afterEach(() => {
  cleanup();
});
