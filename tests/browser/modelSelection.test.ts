import { describe, expect, it } from "vitest";
import {
  buildModelMatchersLiteralForTest,
  buildModelSelectionExpressionForTest,
} from "../../src/browser/actions/modelSelection.js";

const expectContains = (arr: string[], value: string) => {
  expect(arr).toContain(value);
};

describe("browser model selection matchers", () => {
  it("includes pro + 5.4 tokens for gpt-5.4-pro", () => {
    const { labelTokens, testIdTokens } = buildModelMatchersLiteralForTest("gpt-5.4-pro");
    expect(labelTokens.some((t) => t.includes("pro"))).toBe(true);
    expect(labelTokens.some((t) => t.includes("5.4") || t.includes("5-4"))).toBe(true);
    expect(testIdTokens.some((t) => t.includes("gpt-5.4-pro") || t.includes("gpt-5-4-pro"))).toBe(
      true,
    );
  });

  it("includes rich tokens for gpt-5.1", () => {
    const { labelTokens, testIdTokens } = buildModelMatchersLiteralForTest("gpt-5.1");
    expectContains(labelTokens, "gpt-5.1");
    expectContains(labelTokens, "gpt-5-1");
    expectContains(labelTokens, "gpt51");
    expectContains(labelTokens, "chatgpt 5.1");
    expectContains(testIdTokens, "gpt-5-1");
    expect(
      testIdTokens.some(
        (t) => t.includes("gpt-5.1") || t.includes("gpt-5-1") || t.includes("gpt51"),
      ),
    ).toBe(true);
  });

  it("includes pro/research tokens for gpt-5.2-pro", () => {
    const { labelTokens, testIdTokens } = buildModelMatchersLiteralForTest("gpt-5.2-pro");
    expect(labelTokens.some((t) => t.includes("pro") || t.includes("research"))).toBe(true);
    expectContains(testIdTokens, "gpt-5.2-pro");
    expect(testIdTokens.some((t) => t.includes("model-switcher-gpt-5.2-pro"))).toBe(true);
  });

  it("includes pro + 5.2 tokens for gpt-5.2-pro", () => {
    const { labelTokens, testIdTokens } = buildModelMatchersLiteralForTest("gpt-5.2-pro");
    expect(labelTokens.some((t) => t.includes("pro"))).toBe(true);
    expect(labelTokens.some((t) => t.includes("5.2") || t.includes("5-2"))).toBe(true);
    expect(testIdTokens.some((t) => t.includes("gpt-5.2-pro") || t.includes("gpt-5-2-pro"))).toBe(
      true,
    );
  });

  it("includes thinking tokens for gpt-5.2-thinking", () => {
    const { labelTokens, testIdTokens } = buildModelMatchersLiteralForTest("gpt-5.2-thinking");
    expect(labelTokens.some((t) => t.includes("thinking"))).toBe(true);
    expect(labelTokens.some((t) => t.includes("5.2") || t.includes("5-2"))).toBe(true);
    expect(testIdTokens).toContain("model-switcher-gpt-5-2-thinking");
    expect(testIdTokens).toContain("gpt-5.2-thinking");
  });

  it("includes instant tokens for gpt-5.2-instant", () => {
    const { labelTokens, testIdTokens } = buildModelMatchersLiteralForTest("gpt-5.2-instant");
    expect(labelTokens.some((t) => t.includes("instant"))).toBe(true);
    expect(labelTokens.some((t) => t.includes("5.2") || t.includes("5-2"))).toBe(true);
    expect(testIdTokens).toContain("model-switcher-gpt-5-2-instant");
    expect(testIdTokens).toContain("gpt-5.2-instant");
  });

  it("closes the menu after a successful selection path", () => {
    const expression = buildModelSelectionExpressionForTest("gpt-5.4");
    expect(expression).toContain("const closeMenu = () =>");
    expect(expression).toContain("key: 'Escape'");
    expect(expression).toContain("closeMenu();");
  });

  it("falls back to global model option nodes when menu containers are absent", () => {
    const expression = buildModelSelectionExpressionForTest("Extended Pro");
    expect(expression).toContain("const getButton = () => document.querySelector(BUTTON_SELECTOR)");
    expect(expression).toContain("const getComposerFooterLabel = () =>");
    expect(expression).toContain('[data-testid="composer-footer-actions"]');
    expect(expression).toContain("const FALLBACK_OPTION_SELECTOR");
    expect(expression).toContain(
      '[data-testid^=\\"model-switcher-\\"]:not([data-testid=\\"model-switcher-dropdown-button\\"])',
    );
    expect(expression).toContain("document.querySelectorAll('[data-testid]')");
    expect(expression).toContain("document.querySelectorAll(FALLBACK_OPTION_SELECTOR)");
    expect(expression).toContain("hasVisibleFallbackOptions");
    expect(expression).toContain("currentButton?.getAttribute('aria-expanded') === 'true'");
    expect(expression).toContain(
      "(currentButton?.getAttribute('data-state') ?? '').toLowerCase() === 'open'",
    );
  });
});
