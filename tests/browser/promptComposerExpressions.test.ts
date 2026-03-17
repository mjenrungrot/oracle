import { describe, expect, test } from "vitest";
import { buildComposerSendReadinessExpressionForTest } from "../../src/browser/actions/promptComposer.ts";

describe("prompt composer attachment expressions", () => {
  test("attachment ready check does not match prompt text", () => {
    const expression = buildComposerSendReadinessExpressionForTest();
    expect(expression).toContain('[data-testid*="composer"]');
    expect(expression).toContain("composerScope.querySelectorAll");
    expect(expression).toContain('input[type="file"]');
    expect(expression).not.toContain("a,div,span");
    expect(expression).not.toContain(
      'document.querySelectorAll(\'[data-testid*="chip"],[data-testid*="attachment"],a,div,span\')',
    );
  });
});
