import { describe, expect, test } from "vitest";
import { formatSessionTableRow } from "../../src/cli/sessionTable.js";
import type { SessionMetadata } from "../../src/sessionManager.js";

function makeMetadata(overrides: Partial<SessionMetadata> = {}): SessionMetadata {
  return {
    id: "deep-research-test",
    createdAt: new Date().toISOString(),
    status: "completed",
    mode: "browser",
    options: {},
    ...overrides,
  };
}

describe("formatSessionTableRow deep research mode label", () => {
  test("shows browser/dr when deepResearch is enabled in browser config", () => {
    const meta = makeMetadata({
      browser: { config: { deepResearch: true } },
    });
    const row = formatSessionTableRow(meta, { rich: false });
    expect(row).toContain("browser/dr");
  });

  test("shows browser/dr when deepResearch is enabled in options.browserConfig", () => {
    const meta = makeMetadata({
      options: { browserConfig: { deepResearch: true } },
    });
    const row = formatSessionTableRow(meta, { rich: false });
    expect(row).toContain("browser/dr");
  });

  test("shows plain browser mode when deepResearch is not set", () => {
    const meta = makeMetadata();
    const row = formatSessionTableRow(meta, { rich: false });
    expect(row).toContain("browser");
    expect(row).not.toContain("browser/dr");
  });

  test("shows api mode for api sessions", () => {
    const meta = makeMetadata({ mode: "api" });
    const row = formatSessionTableRow(meta, { rich: false });
    expect(row).toContain("api");
    expect(row).not.toContain("browser/dr");
  });
});
