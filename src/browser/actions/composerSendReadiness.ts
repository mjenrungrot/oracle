import type { ChromeClient } from "../types.js";
import {
  INPUT_SELECTORS,
  SEND_BUTTON_SELECTORS,
  UPLOAD_STATUS_SELECTORS,
  UPLOAD_ERROR_SELECTORS,
} from "../constants.js";
import { buildClickDispatcher } from "./domEvents.js";

export interface ComposerSendReadinessState {
  state: "ready" | "disabled" | "missing";
  uploading: boolean;
  filesAttached: boolean;
  attachedNames: string[];
  inputNames: string[];
  fileCount: number;
  attachmentUiCount: number;
  errorDetected: boolean;
  errorText: string;
}

export interface ComposerAttachmentEvidence {
  allNamesMatched: boolean;
  fileCountSatisfied: boolean;
  hasEvidence: boolean;
  missingNames: string[];
}

/**
 * Single DOM expression that reads all composer state needed for both
 * attachment completion and send-button readiness decisions.
 */
export function buildComposerSendReadinessExpression(): string {
  return `(() => {
    const sendSelectors = ${JSON.stringify(SEND_BUTTON_SELECTORS)};
    const promptSelectors = ${JSON.stringify(INPUT_SELECTORS)};
    const findPromptNode = () => {
      for (const selector of promptSelectors) {
        const nodes = Array.from(document.querySelectorAll(selector));
        for (const node of nodes) {
          if (!(node instanceof HTMLElement)) continue;
          const rect = node.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) return node;
        }
      }
      for (const selector of promptSelectors) {
        const node = document.querySelector(selector);
        if (node) return node;
      }
      return null;
    };
    const attachmentSelectors = [
      'input[type="file"]',
      '[data-testid*="attachment"]',
      '[data-testid*="upload"]',
      '[aria-label*="Remove"]',
      '[aria-label*="remove"]',
    ];
    const locateComposerRoot = () => {
      const promptNode = findPromptNode();
      if (promptNode) {
        const initial =
          promptNode.closest('[data-testid*="composer"]') ??
          promptNode.closest('form') ??
          promptNode.parentElement ??
          document.body;
        let current = initial;
        let fallback = initial;
        while (current && current !== document.body) {
          const hasSend = sendSelectors.some((selector) => current.querySelector(selector));
          if (hasSend) {
            fallback = current;
            const hasAttachment = attachmentSelectors.some((selector) => current.querySelector(selector));
            if (hasAttachment) {
              return current;
            }
          }
          current = current.parentElement;
        }
        return fallback ?? initial;
      }
      return document.querySelector('form') ?? document.body;
    };
    const composerRoot = locateComposerRoot();
    const composerScope = (() => {
      if (!composerRoot) return document;
      const parent = composerRoot.parentElement;
      const parentHasSend = parent && sendSelectors.some((selector) => parent.querySelector(selector));
      return parentHasSend ? parent : composerRoot;
    })();

    let button = null;
    for (const selector of sendSelectors) {
      button = document.querySelector(selector);
      if (button) break;
    }
    const disabled = button
      ? button.hasAttribute('disabled') ||
        button.getAttribute('aria-disabled') === 'true' ||
        button.getAttribute('data-disabled') === 'true' ||
        window.getComputedStyle(button).pointerEvents === 'none'
      : null;

    const uploadingSelectors = ${JSON.stringify(UPLOAD_STATUS_SELECTORS)};
    const uploading = uploadingSelectors.some((selector) => {
      return Array.from(document.querySelectorAll(selector)).some((node) => {
        const ariaBusy = node.getAttribute?.('aria-busy');
        const dataState = node.getAttribute?.('data-state');
        if (ariaBusy === 'true' || dataState === 'loading' || dataState === 'uploading' || dataState === 'pending') {
          return true;
        }
        const text = node.textContent?.toLowerCase?.() ?? '';
        return /\\buploading\\b/.test(text) || /\\bprocessing\\b/.test(text);
      });
    });

    const attachmentChipSelectors = [
      '[data-testid*="chip"]',
      '[data-testid*="attachment"]',
      '[data-testid*="upload"]',
      '[data-testid*="file"]',
      '[aria-label*="Remove"]',
      'button[aria-label*="Remove"]',
    ];
    const attachedNames = [];
    for (const selector of attachmentChipSelectors) {
      for (const node of Array.from(composerScope.querySelectorAll(selector))) {
        if (!node) continue;
        const text = node.textContent ?? '';
        const aria = node.getAttribute?.('aria-label') ?? '';
        const title = node.getAttribute?.('title') ?? '';
        const parentText = node.parentElement?.parentElement?.innerText ?? '';
        for (const value of [text, aria, title, parentText]) {
          const normalized = value?.toLowerCase?.();
          if (normalized) attachedNames.push(normalized);
        }
      }
    }
    const cardTexts = Array.from(composerScope.querySelectorAll('[aria-label*="Remove"]')).map((btn) =>
      btn?.parentElement?.parentElement?.innerText?.toLowerCase?.() ?? '',
    );
    attachedNames.push(...cardTexts.filter(Boolean));

    const inputNames = [];
    const inputScopeNodes = composerScope ? Array.from(composerScope.querySelectorAll('input[type="file"]')) : [];
    const inputNodes = [];
    const inputSeen = new Set();
    for (const el of [...inputScopeNodes, ...Array.from(document.querySelectorAll('input[type="file"]'))]) {
      if (!inputSeen.has(el)) {
        inputSeen.add(el);
        inputNodes.push(el);
      }
    }
    for (const input of inputNodes) {
      if (!(input instanceof HTMLInputElement) || !input.files?.length) continue;
      for (const file of Array.from(input.files)) {
        if (file?.name) inputNames.push(file.name.toLowerCase());
      }
    }

    const countRegex = /(?:^|\\b)(\\d+)\\s+(?:files?|attachments?)\\b/;
    const fileCountSelectors = [
      'button',
      '[role="button"]',
      '[data-testid*="file"]',
      '[data-testid*="upload"]',
      '[data-testid*="attachment"]',
      '[data-testid*="chip"]',
      '[aria-label*="file"]',
      '[title*="file"]',
      '[aria-label*="attachment"]',
      '[title*="attachment"]',
    ].join(',');
    const collectFileCount = (nodes) => {
      let count = 0;
      for (const node of nodes) {
        if (!(node instanceof HTMLElement)) continue;
        if (node.matches('textarea,input,[contenteditable="true"]')) continue;
        const dataTestId = node.getAttribute?.('data-testid') ?? '';
        const aria = node.getAttribute?.('aria-label') ?? '';
        const title = node.getAttribute?.('title') ?? '';
        const tooltip =
          node.getAttribute?.('data-tooltip') ?? node.getAttribute?.('data-tooltip-content') ?? '';
        const text = node.textContent ?? '';
        const parent = node.parentElement;
        const parentText = parent?.textContent ?? '';
        const parentAria = parent?.getAttribute?.('aria-label') ?? '';
        const parentTitle = parent?.getAttribute?.('title') ?? '';
        const parentTooltip =
          parent?.getAttribute?.('data-tooltip') ?? parent?.getAttribute?.('data-tooltip-content') ?? '';
        const parentTestId = parent?.getAttribute?.('data-testid') ?? '';
        const candidates = [
          text, aria, title, tooltip, dataTestId,
          parentText, parentAria, parentTitle, parentTooltip, parentTestId,
        ];
        let hasFileHint = false;
        for (const raw of candidates) {
          if (!raw) continue;
          const lowered = String(raw).toLowerCase();
          if (lowered.includes('file') || lowered.includes('attachment')) {
            hasFileHint = true;
            break;
          }
        }
        if (!hasFileHint) continue;
        for (const raw of candidates) {
          if (!raw) continue;
          const match = String(raw).toLowerCase().match(countRegex);
          if (match) {
            const parsed = Number(match[1]);
            if (Number.isFinite(parsed)) {
              count = Math.max(count, parsed);
            }
          }
        }
      }
      return count;
    };
    const localFileCountNodes = composerScope
      ? Array.from(composerScope.querySelectorAll(fileCountSelectors))
      : [];
    let fileCount = collectFileCount(localFileCountNodes);
    if (!fileCount) {
      fileCount = collectFileCount(Array.from(document.querySelectorAll(fileCountSelectors)));
    }
    const filesAttached = attachedNames.length > 0 || fileCount > 0;

    const attachmentUiCount = composerScope.querySelectorAll(attachmentChipSelectors.join(',')).length;

    const errorSelectors = ${JSON.stringify(UPLOAD_ERROR_SELECTORS)};
    const errorPatterns = [
      /unsupported\\s+file/i, /upload\\s+fail/i, /can['\\u2019]?t\\s+upload/i,
      /unable\\s+to\\s+upload/i, /file\\s+type.*not\\s+(?:supported|allowed)/i,
      /error\\s+uploading/i, /couldn['\\u2019]?t\\s+(?:upload|attach)/i,
      /not\\s+(?:a\\s+)?supported/i,
    ];
    let errorDetected = false;
    let errorText = '';
    for (const selector of errorSelectors) {
      for (const el of Array.from(document.querySelectorAll(selector))) {
        const elText = (el.textContent || '').trim();
        if (!elText) continue;
        for (const pattern of errorPatterns) {
          if (pattern.test(elText)) {
            errorDetected = true;
            errorText = elText;
            break;
          }
        }
        if (errorDetected) break;
      }
      if (errorDetected) break;
    }
    if (!errorDetected) {
      for (const selector of attachmentChipSelectors) {
        for (const node of Array.from(composerScope.querySelectorAll(selector))) {
          const ds = node.getAttribute?.('data-state') ?? '';
          if (ds === 'error' || ds === 'failed') {
            errorDetected = true;
            errorText = (node.textContent || '').trim() || 'Attachment ' + ds;
            break;
          }
        }
        if (errorDetected) break;
      }
    }

    return {
      state: button ? (disabled ? 'disabled' : 'ready') : 'missing',
      uploading,
      filesAttached,
      attachedNames,
      inputNames,
      fileCount,
      attachmentUiCount,
      errorDetected,
      errorText,
    };
  })()`;
}

/**
 * DOM expression that finds and clicks the send button within the composer scope.
 * Returns 'clicked' | 'disabled' | 'missing'.
 */
export function buildComposerSendClickExpression(): string {
  return `(() => {
    ${buildClickDispatcher()}
    const selectors = ${JSON.stringify(SEND_BUTTON_SELECTORS)};
    let button = null;
    for (const selector of selectors) {
      button = document.querySelector(selector);
      if (button) break;
    }
    if (!button) return 'missing';
    const ariaDisabled = button.getAttribute('aria-disabled');
    const dataDisabled = button.getAttribute('data-disabled');
    const style = window.getComputedStyle(button);
    const disabled =
      button.hasAttribute('disabled') ||
      ariaDisabled === 'true' ||
      dataDisabled === 'true' ||
      style.pointerEvents === 'none' ||
      style.display === 'none';
    if (disabled) return 'disabled';
    dispatchClickSequence(button);
    return 'clicked';
  })()`;
}

export async function readComposerSendReadiness(
  Runtime: ChromeClient["Runtime"],
): Promise<ComposerSendReadinessState | null> {
  const { result } = await Runtime.evaluate({
    expression: buildComposerSendReadinessExpression(),
    returnByValue: true,
  });
  const value = result?.value as Record<string, unknown> | undefined;
  if (!value) return null;
  return {
    state: (value.state as ComposerSendReadinessState["state"]) ?? "missing",
    uploading: Boolean(value.uploading),
    filesAttached: Boolean(value.filesAttached),
    attachedNames: Array.isArray(value.attachedNames) ? value.attachedNames : [],
    inputNames: Array.isArray(value.inputNames) ? value.inputNames : [],
    fileCount: typeof value.fileCount === "number" ? value.fileCount : 0,
    attachmentUiCount: typeof value.attachmentUiCount === "number" ? value.attachmentUiCount : 0,
    errorDetected: Boolean(value.errorDetected),
    errorText: typeof value.errorText === "string" ? value.errorText : "",
  };
}

export function evaluateComposerAttachmentEvidence(
  state: ComposerSendReadinessState,
  expectedNames: string[],
): ComposerAttachmentEvidence {
  if (!expectedNames.length) {
    return { allNamesMatched: true, fileCountSatisfied: true, hasEvidence: true, missingNames: [] };
  }

  const expectedNormalized = expectedNames.map((n) => n.toLowerCase());
  const attachedNames = (state.attachedNames ?? [])
    .map((n) => n.toLowerCase().replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const inputNames = (state.inputNames ?? [])
    .map((n) => n.toLowerCase().replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const allNames = [...attachedNames, ...inputNames];

  const matchesExpected = (expected: string): boolean => {
    const baseName = expected.split("/").pop()?.split("\\").pop() ?? expected;
    const normalized = baseName.toLowerCase().replace(/\s+/g, " ").trim();
    const noExt = normalized.replace(/\.[a-z0-9]{1,10}$/i, "");
    return allNames.some((raw) => {
      if (raw.includes(normalized)) return true;
      if (noExt.length >= 6 && raw.includes(noExt)) return true;
      if (raw.includes("\u2026") || raw.includes("...")) {
        const marker = raw.includes("\u2026") ? "\u2026" : "...";
        const [prefix, suffix] = raw.split(marker);
        const target = noExt.length >= 6 ? noExt : normalized;
        return (
          (!prefix?.trim() || target.includes(prefix.trim())) &&
          (!suffix?.trim() || target.includes(suffix.trim()))
        );
      }
      return false;
    });
  };

  const missingNames = expectedNormalized.filter((n) => !matchesExpected(n));
  const fileCountSatisfied = state.fileCount >= expectedNormalized.length;
  const allNamesMatched = missingNames.length === 0;
  const hasEvidence = allNamesMatched || fileCountSatisfied;

  return { allNamesMatched, fileCountSatisfied, hasEvidence, missingNames };
}

export function hasAttachmentCompletionEvidence(
  state: ComposerSendReadinessState,
  expectedNames: string[],
): boolean {
  return evaluateComposerAttachmentEvidence(state, expectedNames).hasEvidence;
}

export function summarizeComposerSendReadiness(
  state: ComposerSendReadinessState,
  expectedNames?: string[],
): string {
  const parts = [
    `state=${state.state}`,
    `uploading=${state.uploading}`,
    `filesAttached=${state.filesAttached}`,
    `attachedNames=${(state.attachedNames ?? []).slice(0, 3).join(",")}`,
    `inputNames=${(state.inputNames ?? []).slice(0, 3).join(",")}`,
    `fileCount=${state.fileCount ?? 0}`,
    `attachmentUiCount=${state.attachmentUiCount ?? 0}`,
  ];
  if (expectedNames?.length) {
    const evidence = evaluateComposerAttachmentEvidence(state, expectedNames);
    parts.push(`evidence=${evidence.hasEvidence}`);
    if (evidence.missingNames.length > 0) {
      parts.push(`missing=${evidence.missingNames.join(",")}`);
    }
  }
  return parts.join(" ");
}
