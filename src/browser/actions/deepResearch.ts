import type { ChromeClient, BrowserLogger } from "../types.js";
import {
  DEEP_RESEARCH_PLUS_BUTTON,
  DEEP_RESEARCH_DROPDOWN_ITEM_TEXT,
  DEEP_RESEARCH_PILL_LABEL,
  DEEP_RESEARCH_POLL_INTERVAL_MS,
  DEEP_RESEARCH_AUTO_CONFIRM_WAIT_MS,
  DEEP_RESEARCH_DEFAULT_TIMEOUT_MS,
  FINISHED_ACTIONS_SELECTOR,
  STOP_BUTTON_SELECTOR,
} from "../constants.js";
import { delay } from "../utils.js";
import { buildClickDispatcher } from "./domEvents.js";
import { captureAssistantMarkdown, readAssistantSnapshot } from "./assistantResponse.js";
import { BrowserAutomationError } from "../../oracle/errors.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build a browser-side JS expression that:
 * 1. Clicks the "+" button in the composer
 * 2. Waits for the dropdown to appear
 * 3. Finds and clicks the "Deep research" item
 * Returns `{ activated: boolean, alreadyActive?: boolean, error?: string }`.
 */
function buildActivateDeepResearchExpression(): string {
  const clickFn = buildClickDispatcher("__drClick");
  const pillLabel = JSON.stringify(DEEP_RESEARCH_PILL_LABEL);
  const plusBtnSel = JSON.stringify(DEEP_RESEARCH_PLUS_BUTTON);
  const dropdownItemText = JSON.stringify(DEEP_RESEARCH_DROPDOWN_ITEM_TEXT);

  return `(async () => {
    ${clickFn}

    // Check if Deep Research pill is already active
    const existingPills = document.querySelectorAll('[data-testid*="pill"], [class*="pill"]');
    for (const p of existingPills) {
      if (p.textContent?.trim()?.toLowerCase()?.includes(${pillLabel}.toLowerCase())) {
        return { activated: true, alreadyActive: true };
      }
    }

    // Click the "+" button
    const plusBtn = document.querySelector(${plusBtnSel});
    if (!plusBtn) {
      return { activated: false, error: "plus-button-missing" };
    }
    __drClick(plusBtn);

    // Wait for dropdown to appear (up to 3s)
    let dropdown = null;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 100));
      const candidates = document.querySelectorAll('[role="menu"], [role="listbox"], [data-radix-collection-root], [class*="popover"], [class*="dropdown"], [class*="menu"]');
      if (candidates.length > 0) {
        dropdown = candidates[candidates.length - 1];
        break;
      }
    }
    if (!dropdown) {
      return { activated: false, error: "dropdown-not-found" };
    }

    // Find the "Deep research" item in the dropdown
    const items = dropdown.querySelectorAll('button, [role="menuitem"], [role="option"], div[class*="item"], a');
    let targetItem = null;
    for (const item of items) {
      const text = item.textContent?.trim() ?? "";
      if (text.toLowerCase().includes(${dropdownItemText}.toLowerCase())) {
        targetItem = item;
        break;
      }
    }
    if (!targetItem) {
      // Also search globally for the dropdown item
      const allButtons = document.querySelectorAll('button, [role="menuitem"], [role="option"]');
      for (const btn of allButtons) {
        const text = btn.textContent?.trim() ?? "";
        if (text.toLowerCase().includes(${dropdownItemText}.toLowerCase())) {
          targetItem = btn;
          break;
        }
      }
    }
    if (!targetItem) {
      return { activated: false, error: "dropdown-item-missing" };
    }

    __drClick(targetItem);
    return { activated: true, alreadyActive: false };
  })()`;
}

/**
 * Build a browser-side expression that checks if the Deep Research pill is visible.
 */
function buildCheckPillExpression(): string {
  const pillLabel = JSON.stringify(DEEP_RESEARCH_PILL_LABEL);
  return `(() => {
    const candidates = document.querySelectorAll('[data-testid*="pill"], [class*="pill"], button[class*="tag"], span[class*="tag"]');
    for (const el of candidates) {
      if (el.textContent?.trim()?.toLowerCase()?.includes(${pillLabel}.toLowerCase())) {
        return true;
      }
    }
    // Broader search: look in the entire composer area
    const composer = document.querySelector('form, [data-testid*="composer"]');
    if (composer) {
      const text = composer.textContent ?? "";
      if (text.toLowerCase().includes(${pillLabel}.toLowerCase())) {
        return true;
      }
    }
    return false;
  })()`;
}

/**
 * Build a browser-side expression to check deep research status:
 * - Whether FINISHED_ACTIONS_SELECTOR is present (completed)
 * - Whether STOP_BUTTON_SELECTOR is present (in-progress)
 * - Whether an iframe for research is visible
 * - Text length of the latest assistant turn
 */
function buildCheckStatusExpression(): string {
  const finishedSel = JSON.stringify(FINISHED_ACTIONS_SELECTOR);
  const stopSel = JSON.stringify(STOP_BUTTON_SELECTOR);
  return `(() => {
    const finished = document.querySelectorAll(${finishedSel});
    const stop = document.querySelector(${stopSel});
    const iframes = document.querySelectorAll('iframe');
    const turns = document.querySelectorAll('[data-message-author-role="assistant"], [data-turn="assistant"]');
    let textLength = 0;
    if (turns.length > 0) {
      const last = turns[turns.length - 1];
      textLength = (last.textContent ?? "").length;
    }
    return {
      completed: finished.length > 0 && !stop,
      inProgress: !!stop,
      hasIframe: iframes.length > 0,
      textLength,
    };
  })()`;
}

// ---------------------------------------------------------------------------
// Exported functions
// ---------------------------------------------------------------------------

/**
 * Activate Deep Research mode by clicking "+" and selecting "Deep research" from the dropdown.
 * Verifies the pill appeared in the composer after activation.
 */
export async function activateDeepResearch(
  Runtime: ChromeClient["Runtime"],
  _Input: ChromeClient["Input"],
  logger: BrowserLogger,
): Promise<void> {
  logger("Activating Deep Research mode…");

  const { result } = await Runtime.evaluate({
    expression: buildActivateDeepResearchExpression(),
    returnByValue: true,
    awaitPromise: true,
  });

  const value = result?.value as
    | { activated: boolean; alreadyActive?: boolean; error?: string }
    | undefined;

  if (!value?.activated) {
    const code = value?.error ?? "activation-failed";
    throw new BrowserAutomationError(
      `Failed to activate Deep Research: ${code}`,
      { stage: "deep-research-activate", code },
    );
  }

  if (value.alreadyActive) {
    logger("Deep Research pill already active — skipping activation.");
    return;
  }

  // Wait briefly and verify the pill appeared
  await delay(1500);
  const { result: pillResult } = await Runtime.evaluate({
    expression: buildCheckPillExpression(),
    returnByValue: true,
  });

  if (!pillResult?.value) {
    logger("Deep Research pill not confirmed after activation — continuing anyway.");
  } else {
    logger("Deep Research mode activated successfully.");
  }
}

/**
 * Wait for the Deep Research plan to appear and then auto-confirm.
 * ChatGPT shows a research plan with a countdown timer (~70s) that auto-confirms.
 */
export async function waitForResearchPlanAutoConfirm(
  Runtime: ChromeClient["Runtime"],
  logger: BrowserLogger,
  autoConfirmWaitMs: number = DEEP_RESEARCH_AUTO_CONFIRM_WAIT_MS,
): Promise<void> {
  logger("Waiting for Deep Research plan to appear…");

  // First, wait for the research plan / stop button to appear (up to 60s)
  const planDetectStart = Date.now();
  const planDetectTimeoutMs = 60_000;
  let planDetected = false;

  while (Date.now() - planDetectStart < planDetectTimeoutMs) {
    const { result } = await Runtime.evaluate({
      expression: `(() => {
        const stop = document.querySelector(${JSON.stringify(STOP_BUTTON_SELECTOR)});
        const turns = document.querySelectorAll('[data-message-author-role="assistant"], [data-turn="assistant"]');
        return { hasStop: !!stop, turnCount: turns.length };
      })()`,
      returnByValue: true,
    });

    const val = result?.value as { hasStop: boolean; turnCount: number } | undefined;
    if (val?.hasStop || (val?.turnCount ?? 0) > 0) {
      planDetected = true;
      logger("Research plan detected — waiting for auto-confirm countdown…");
      break;
    }
    await delay(2_000);
  }

  if (!planDetected) {
    logger(
      "Warning: Research plan not explicitly detected within 60s — continuing to wait for auto-confirm.",
    );
  }

  // Now wait for the auto-confirm countdown to complete
  logger(`Waiting up to ${Math.round(autoConfirmWaitMs / 1000)}s for research to begin…`);
  await delay(autoConfirmWaitMs);
  logger("Auto-confirm wait complete — research should be in progress.");
}

/**
 * Poll for Deep Research completion. Deep Research runs can take 5-30 minutes.
 * Polls every DEEP_RESEARCH_POLL_INTERVAL_MS and logs progress periodically.
 */
export async function waitForDeepResearchCompletion(
  Runtime: ChromeClient["Runtime"],
  logger: BrowserLogger,
  timeoutMs: number = DEEP_RESEARCH_DEFAULT_TIMEOUT_MS,
): Promise<string> {
  const start = Date.now();
  let lastProgressLog = 0;
  const progressLogIntervalMs = 60_000;

  logger(`Monitoring Deep Research (timeout: ${Math.round(timeoutMs / 60_000)} min)…`);

  while (Date.now() - start < timeoutMs) {
    const status = await checkDeepResearchStatus(Runtime, logger);

    if (status.completed) {
      logger("Deep Research completed — extracting result…");
      return await extractDeepResearchResult(Runtime, logger);
    }

    // Log progress periodically
    const now = Date.now();
    if (now - lastProgressLog >= progressLogIntervalMs) {
      const elapsedMin = Math.round((now - start) / 60_000);
      logger(
        `Deep Research in progress… (${elapsedMin} min elapsed, text: ${status.textLength} chars)`,
      );
      lastProgressLog = now;
    }

    await delay(DEEP_RESEARCH_POLL_INTERVAL_MS);
  }

  const elapsedMin = Math.round((Date.now() - start) / 60_000);
  throw new BrowserAutomationError(
    `Deep Research timed out after ${elapsedMin} minutes`,
    { stage: "deep-research-completion", timeoutMs, elapsedMs: Date.now() - start },
  );
}

/**
 * Extract the final Deep Research result as markdown.
 * Uses the copy-button approach first, falling back to snapshot text.
 */
export async function extractDeepResearchResult(
  Runtime: ChromeClient["Runtime"],
  logger: BrowserLogger,
): Promise<string> {
  // Try readAssistantSnapshot to get metadata for copy button
  const snapshot = await readAssistantSnapshot(Runtime);
  if (snapshot) {
    const markdown = await captureAssistantMarkdown(
      Runtime,
      { messageId: snapshot.messageId, turnId: snapshot.turnId },
      logger,
    );
    if (markdown && markdown.trim().length > 0) {
      logger(`Extracted Deep Research result via copy button (${markdown.length} chars).`);
      return markdown;
    }
  }

  // Fallback: use snapshot text directly
  if (snapshot?.text && snapshot.text.trim().length > 0) {
    logger(`Extracted Deep Research result from snapshot text (${snapshot.text.length} chars).`);
    return snapshot.text;
  }

  // Last resort: grab raw text from the page
  const { result } = await Runtime.evaluate({
    expression: `(() => {
      const turns = document.querySelectorAll('[data-message-author-role="assistant"], [data-turn="assistant"]');
      if (turns.length === 0) return "";
      const last = turns[turns.length - 1];
      return last.textContent ?? "";
    })()`,
    returnByValue: true,
  });

  const text = typeof result?.value === "string" ? result.value : "";
  if (text.trim().length > 0) {
    logger(`Extracted Deep Research result from DOM text (${text.length} chars).`);
    return text;
  }

  throw new BrowserAutomationError("Failed to extract Deep Research result — no content found.", {
    stage: "deep-research-extract",
  });
}

/**
 * Quick status check for Deep Research — useful for reattach scenarios.
 * Returns whether the research is completed, in progress, or unknown.
 */
export async function checkDeepResearchStatus(
  Runtime: ChromeClient["Runtime"],
  _logger: BrowserLogger,
): Promise<{ completed: boolean; inProgress: boolean; hasIframe: boolean; textLength: number }> {
  const { result } = await Runtime.evaluate({
    expression: buildCheckStatusExpression(),
    returnByValue: true,
  });

  const value = result?.value as
    | { completed: boolean; inProgress: boolean; hasIframe: boolean; textLength: number }
    | undefined;

  return {
    completed: value?.completed ?? false,
    inProgress: value?.inProgress ?? false,
    hasIframe: value?.hasIframe ?? false,
    textLength: value?.textLength ?? 0,
  };
}
