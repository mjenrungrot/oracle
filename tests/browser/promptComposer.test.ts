import { describe, expect, test, vi } from "vitest";
import {
  __test__ as promptComposer,
  fillPromptComposer,
} from "../../src/browser/actions/promptComposer.js";
import { BrowserAutomationError } from "../../src/oracle/errors.js";

describe("promptComposer", () => {
  test("overwrites restored draft text with the requested prompt", async () => {
    vi.useFakeTimers();
    try {
      const runtime = {
        evaluate: vi
          .fn()
          .mockResolvedValueOnce({
            result: { value: { ready: true, composer: true, fileInput: false } },
          })
          .mockResolvedValueOnce({ result: { value: { focused: true } } })
          .mockResolvedValueOnce({
            result: {
              value: {
                editorText: "restored draft",
                fallbackValue: "",
                activeValue: "restored draft",
              },
            },
          })
          .mockResolvedValueOnce({ result: { value: undefined } })
          .mockResolvedValueOnce({
            result: {
              value: {
                editorText: "target prompt",
                fallbackValue: "",
                activeValue: "target prompt",
              },
            },
          }),
      } as unknown as {
        evaluate: (args: { expression: string; returnByValue?: boolean }) => Promise<unknown>;
      };
      const input = {
        insertText: vi.fn().mockResolvedValue(undefined),
      } as unknown as {
        insertText: (args: { text: string }) => Promise<void>;
      };
      const logger = Object.assign(vi.fn(), { verbose: false });

      const promise = fillPromptComposer(
        { runtime: runtime as never, input: input as never },
        "target prompt",
        logger as never,
      );
      await vi.runAllTimersAsync();
      await expect(promise).resolves.toBeUndefined();
      expect(input.insertText).toHaveBeenCalledWith({ text: "target prompt" });
      expect(runtime.evaluate).toHaveBeenCalledTimes(5);
    } finally {
      vi.useRealTimers();
    }
  });

  test("throws when the requested prompt still does not match after overwrite fallback", async () => {
    vi.useFakeTimers();
    try {
      const runtime = {
        evaluate: vi
          .fn()
          .mockResolvedValueOnce({
            result: { value: { ready: true, composer: true, fileInput: false } },
          })
          .mockResolvedValueOnce({ result: { value: { focused: true } } })
          .mockResolvedValueOnce({
            result: {
              value: {
                editorText: "restored draft",
                fallbackValue: "",
                activeValue: "restored draft",
              },
            },
          })
          .mockResolvedValueOnce({ result: { value: undefined } })
          .mockResolvedValueOnce({
            result: {
              value: {
                editorText: "restored draft plus target prompt",
                fallbackValue: "",
                activeValue: "restored draft plus target prompt",
              },
            },
          }),
      } as unknown as {
        evaluate: (args: { expression: string; returnByValue?: boolean }) => Promise<unknown>;
      };
      const input = {
        insertText: vi.fn().mockResolvedValue(undefined),
      } as unknown as {
        insertText: (args: { text: string }) => Promise<void>;
      };
      const logger = Object.assign(vi.fn(), { verbose: false });

      const promise = fillPromptComposer(
        { runtime: runtime as never, input: input as never },
        "target prompt",
        logger as never,
      );
      const assertion = expect(promise).rejects.toMatchObject({
        details: expect.objectContaining({ code: "prompt-mismatch" }),
      });
      await vi.runAllTimersAsync();
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  test("attachment sends throw instead of falling back to Enter when composer never becomes send-ready", async () => {
    vi.useFakeTimers();
    try {
      const runtime = {
        evaluate: vi.fn().mockResolvedValue({
          result: {
            value: {
              state: "disabled",
              uploading: true,
              filesAttached: true,
              attachedNames: ["report.txt"],
              inputNames: [],
              fileCount: 1,
              attachmentUiCount: 1,
              errorDetected: false,
              errorText: "",
            },
          },
        }),
      } as unknown as {
        evaluate: (args: { expression: string; returnByValue?: boolean }) => Promise<unknown>;
      };

      const promise = promptComposer.attemptSendButton(
        runtime as never,
        undefined,
        ["report.txt"],
        15_000,
      );
      const assertion = expect(promise).rejects.toThrow(BrowserAutomationError);
      await vi.advanceTimersByTimeAsync(20_000);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  test("does not treat cleared composer + stop button as committed without a new turn", async () => {
    vi.useFakeTimers();
    try {
      const runtime = {
        evaluate: vi
          .fn()
          // Baseline read (turn count)
          .mockResolvedValueOnce({ result: { value: 10 } })
          // Polls (repeat)
          .mockResolvedValue({
            result: {
              value: {
                baseline: 10,
                turnsCount: 10,
                userMatched: false,
                prefixMatched: false,
                lastMatched: false,
                hasNewTurn: false,
                stopVisible: true,
                assistantVisible: false,
                composerCleared: true,
                inConversation: false,
              },
            },
          }),
      } as unknown as {
        evaluate: (args: { expression: string; returnByValue?: boolean }) => Promise<unknown>;
      };

      const promise = promptComposer.verifyPromptCommitted(runtime as never, "hello", 150);
      // Attach the rejection handler before timers advance to avoid unhandled-rejection warnings.
      const assertion = expect(promise).rejects.toThrow(/prompt did not appear/i);
      await vi.advanceTimersByTimeAsync(250);
      await assertion;
    } finally {
      vi.useRealTimers();
    }
  });

  test("allows prompt match even if baseline turn count cannot be read", async () => {
    const runtime = {
      evaluate: vi
        .fn()
        // Baseline read fails
        .mockRejectedValueOnce(new Error("turn read failed"))
        // First poll shows prompt match (baseline unknown)
        .mockResolvedValueOnce({
          result: {
            value: {
              baseline: -1,
              turnsCount: 1,
              userMatched: true,
              prefixMatched: false,
              lastMatched: true,
              hasNewTurn: false,
              stopVisible: false,
              assistantVisible: false,
              composerCleared: false,
              inConversation: true,
            },
          },
        }),
    } as unknown as {
      evaluate: (args: { expression: string; returnByValue?: boolean }) => Promise<unknown>;
    };

    await expect(
      promptComposer.verifyPromptCommitted(runtime as never, "hello", 150),
    ).resolves.toBe(1);
  });
});
