import { describe, expect, test, vi } from "vitest";
import {
  activateDeepResearch,
  checkDeepResearchStatus,
  extractDeepResearchResult,
} from "../../src/browser/actions/deepResearch.js";
import type { BrowserLogger, ChromeClient } from "../../src/browser/types.js";
import { BrowserAutomationError } from "../../src/oracle/errors.js";

type MockRuntime = ChromeClient["Runtime"];
type MockInput = ChromeClient["Input"];

function createMockRuntime(evaluateImpl: (params: { expression: string }) => Promise<{ result: { value: unknown } }>): MockRuntime {
  return { evaluate: evaluateImpl } as unknown as MockRuntime;
}

function createMockInput(): MockInput {
  return {} as unknown as MockInput;
}

function createLogger(): BrowserLogger {
  const logger = vi.fn() as BrowserLogger;
  logger.verbose = true;
  return logger;
}

describe("activateDeepResearch", () => {
  test("activates successfully when DOM elements are found", async () => {
    const runtime = createMockRuntime(async () => ({
      result: { value: { activated: true, alreadyActive: false } },
    }));
    const input = createMockInput();
    const logger = createLogger();

    await activateDeepResearch(runtime, input, logger);
    expect(logger).toHaveBeenCalledWith("Activating Deep Research mode…");
  });

  test("skips activation when already active", async () => {
    const runtime = createMockRuntime(async () => ({
      result: { value: { activated: true, alreadyActive: true } },
    }));
    const input = createMockInput();
    const logger = createLogger();

    await activateDeepResearch(runtime, input, logger);
    expect(logger).toHaveBeenCalledWith("Deep Research pill already active — skipping activation.");
  });

  test("throws when plus button is missing", async () => {
    const runtime = createMockRuntime(async () => ({
      result: { value: { activated: false, error: "plus-button-missing" } },
    }));
    const input = createMockInput();
    const logger = createLogger();

    await expect(activateDeepResearch(runtime, input, logger)).rejects.toThrow(
      BrowserAutomationError,
    );
    await expect(activateDeepResearch(runtime, input, logger)).rejects.toThrow(
      "plus-button-missing",
    );
  });

  test("throws when dropdown item is missing", async () => {
    const runtime = createMockRuntime(async () => ({
      result: { value: { activated: false, error: "dropdown-item-missing" } },
    }));
    const input = createMockInput();
    const logger = createLogger();

    await expect(activateDeepResearch(runtime, input, logger)).rejects.toThrow(
      "dropdown-item-missing",
    );
  });

  test("continues when pill not confirmed after activation", async () => {
    let callCount = 0;
    const runtime = createMockRuntime(async () => {
      callCount++;
      if (callCount === 1) {
        // activateDeepResearch expression
        return { result: { value: { activated: true, alreadyActive: false } } };
      }
      // checkPill expression returns false
      return { result: { value: false } };
    });
    const input = createMockInput();
    const logger = createLogger();

    await activateDeepResearch(runtime, input, logger);
    expect(logger).toHaveBeenCalledWith(
      "Deep Research pill not confirmed after activation — continuing anyway.",
    );
  });
});


describe("checkDeepResearchStatus", () => {
  test("returns completed status", async () => {
    const runtime = createMockRuntime(async () => ({
      result: { value: { completed: true, inProgress: false, hasIframe: false, textLength: 5000 } },
    }));
    const logger = createLogger();

    const status = await checkDeepResearchStatus(runtime, logger);
    expect(status.completed).toBe(true);
    expect(status.inProgress).toBe(false);
    expect(status.textLength).toBe(5000);
  });

  test("returns in-progress status", async () => {
    const runtime = createMockRuntime(async () => ({
      result: { value: { completed: false, inProgress: true, hasIframe: true, textLength: 200 } },
    }));
    const logger = createLogger();

    const status = await checkDeepResearchStatus(runtime, logger);
    expect(status.completed).toBe(false);
    expect(status.inProgress).toBe(true);
    expect(status.hasIframe).toBe(true);
  });

  test("handles unknown/empty state gracefully", async () => {
    const runtime = createMockRuntime(async () => ({
      result: { value: undefined },
    }));
    const logger = createLogger();

    const status = await checkDeepResearchStatus(runtime, logger);
    expect(status.completed).toBe(false);
    expect(status.inProgress).toBe(false);
    expect(status.textLength).toBe(0);
  });
});

describe("extractDeepResearchResult", () => {
  test("extracts via copy button when available", async () => {
    let callCount = 0;
    const runtime = createMockRuntime(async () => {
      callCount++;
      if (callCount === 1) {
        // readAssistantSnapshot
        return {
          result: {
            value: { text: "raw text", messageId: "m1", turnId: "t1" },
          },
        };
      }
      // captureAssistantMarkdown
      return {
        result: { value: { success: true, markdown: "# Markdown Result" } },
      };
    });
    const logger = createLogger();

    const result = await extractDeepResearchResult(runtime, logger);
    expect(result).toBe("# Markdown Result");
  });

  test("falls back to snapshot text", async () => {
    let callCount = 0;
    const runtime = createMockRuntime(async () => {
      callCount++;
      if (callCount === 1) {
        // readAssistantSnapshot
        return {
          result: {
            value: { text: "Snapshot text result", messageId: null, turnId: null },
          },
        };
      }
      // captureAssistantMarkdown returns null
      return { result: { value: { success: false, status: "missing-button" } } };
    });
    const logger = createLogger();

    const result = await extractDeepResearchResult(runtime, logger);
    expect(result).toBe("Snapshot text result");
  });
});
