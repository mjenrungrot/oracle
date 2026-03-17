import { describe, expect, test, vi } from "vitest";
import {
  AttachmentUploadError,
  waitForAttachmentCompletion,
  waitForUserTurnAttachments,
} from "../../src/browser/pageActions.js";
import type { ChromeClient } from "../../src/browser/types.js";

const useFakeTime = () => {
  vi.useFakeTimers();
  vi.setSystemTime(0);
};

const useRealTime = () => {
  vi.useRealTimers();
};

describe("attachment completion fallbacks", () => {
  test("waitForAttachmentCompletion resolves when file input contains expected name (no UI chip)", async () => {
    useFakeTime();

    const runtime = {
      evaluate: vi.fn().mockResolvedValue({
        result: {
          value: {
            state: "ready",
            uploading: false,
            filesAttached: true,
            attachedNames: [],
            inputNames: ["oracle-attach-verify.txt"],
          },
        },
      }),
    } as unknown as ChromeClient["Runtime"];

    const promise = waitForAttachmentCompletion(runtime, 10_000, ["oracle-attach-verify.txt"]);
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(promise).resolves.toBeUndefined();
    useRealTime();
  });

  test("waitForAttachmentCompletion resolves even when uploading is flagged, once input match is stable", async () => {
    useFakeTime();

    const runtime = {
      evaluate: vi.fn().mockResolvedValue({
        result: {
          value: {
            state: "ready",
            uploading: true,
            filesAttached: false,
            attachedNames: [],
            inputNames: ["oracle-attach-verify.txt"],
          },
        },
      }),
    } as unknown as ChromeClient["Runtime"];

    const promise = waitForAttachmentCompletion(runtime, 10_000, ["oracle-attach-verify.txt"]);
    await vi.advanceTimersByTimeAsync(5_000);
    await expect(promise).resolves.toBeUndefined();
    useRealTime();
  });

  test("waitForAttachmentCompletion can resolve when send button is missing (input match fallback)", async () => {
    useFakeTime();

    const runtime = {
      evaluate: vi.fn().mockResolvedValue({
        result: {
          value: {
            state: "missing",
            uploading: false,
            filesAttached: true,
            attachedNames: [],
            inputNames: ["oracle-attach-verify.txt"],
          },
        },
      }),
    } as unknown as ChromeClient["Runtime"];

    const promise = waitForAttachmentCompletion(runtime, 10_000, ["oracle-attach-verify.txt"]);
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(promise).resolves.toBeUndefined();
    useRealTime();
  });

  test("waitForAttachmentCompletion times out when send button stays disabled (upload likely in progress)", async () => {
    useFakeTime();

    const runtime = {
      evaluate: vi.fn().mockResolvedValue({
        result: {
          value: {
            state: "disabled",
            uploading: false,
            filesAttached: true,
            attachedNames: ["oracle-attach-verify.txt"],
            inputNames: [],
          },
        },
      }),
    } as unknown as ChromeClient["Runtime"];

    const promise = waitForAttachmentCompletion(runtime, 800, ["oracle-attach-verify.txt"]);
    const assertion = expect(promise).rejects.toThrow(/did not finish uploading/i);
    await vi.advanceTimersByTimeAsync(2_000);
    await assertion;
    useRealTime();
  });

  test("waitForAttachmentCompletion times out when neither UI nor file input matches", async () => {
    useFakeTime();

    const runtime = {
      evaluate: vi.fn().mockResolvedValue({
        result: {
          value: {
            state: "ready",
            uploading: false,
            filesAttached: false,
            attachedNames: [],
            inputNames: [],
          },
        },
      }),
    } as unknown as ChromeClient["Runtime"];

    const promise = waitForAttachmentCompletion(runtime, 800, ["oracle-attach-verify.txt"]);
    const assertion = expect(promise).rejects.toThrow(/did not finish uploading/i);
    await vi.advanceTimersByTimeAsync(2_000);
    await assertion;
    useRealTime();
  });
});

describe("upload error detection", () => {
  test("throws AttachmentUploadError when errorDetected is true", async () => {
    useFakeTime();

    const runtime = {
      evaluate: vi.fn().mockResolvedValue({
        result: {
          value: {
            state: "ready",
            uploading: false,
            filesAttached: false,
            attachedNames: [],
            inputNames: [],
            fileCount: 0,
            errorDetected: true,
            errorText: "Unsupported file type",
          },
        },
      }),
    } as unknown as ChromeClient["Runtime"];

    const promise = waitForAttachmentCompletion(runtime, 10_000, ["component.tsx"]);
    const assertion = expect(promise).rejects.toThrow(AttachmentUploadError);
    await vi.advanceTimersByTimeAsync(2_000);
    await assertion;
    useRealTime();
  });

  test("sticky error flag: error detected once persists even if toast disappears", async () => {
    useFakeTime();

    let callCount = 0;
    const runtime = {
      evaluate: vi.fn().mockImplementation(() => {
        callCount += 1;
        // First two calls: error visible
        if (callCount <= 2) {
          return Promise.resolve({
            result: {
              value: {
                state: "ready",
                uploading: false,
                filesAttached: false,
                attachedNames: [],
                inputNames: [],
                fileCount: 0,
                errorDetected: true,
                errorText: "Can't upload this file",
              },
            },
          });
        }
        // Subsequent calls: toast gone, no error in DOM
        return Promise.resolve({
          result: {
            value: {
              state: "ready",
              uploading: false,
              filesAttached: false,
              attachedNames: [],
              inputNames: [],
              fileCount: 0,
              errorDetected: false,
              errorText: "",
            },
          },
        });
      }),
    } as unknown as ChromeClient["Runtime"];

    const promise = waitForAttachmentCompletion(runtime, 10_000, ["component.tsx"]);
    const assertion = expect(promise).rejects.toThrow(AttachmentUploadError);
    await vi.advanceTimersByTimeAsync(3_000);
    await assertion;
    useRealTime();
  });

  test("partial success: failedFiles contains only missing files", async () => {
    useFakeTime();

    const runtime = {
      evaluate: vi.fn().mockResolvedValue({
        result: {
          value: {
            state: "ready",
            uploading: false,
            filesAttached: true,
            attachedNames: ["utils.ts"],
            inputNames: [],
            fileCount: 1,
            errorDetected: true,
            errorText: "Unsupported file type",
          },
        },
      }),
    } as unknown as ChromeClient["Runtime"];

    const promise = waitForAttachmentCompletion(runtime, 10_000, ["utils.ts", "component.tsx"]);
    // Attach a no-op catch to prevent unhandled rejection warning before advancing timers
    promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(2_000);
    try {
      await promise;
      throw new Error("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(AttachmentUploadError);
      const uploadError = error as AttachmentUploadError;
      expect(uploadError.failedFiles).toEqual(["component.tsx"]);
      expect(uploadError.failedFiles).not.toContain("utils.ts");
      expect(uploadError.errorText).toBe("Unsupported file type");
    }
    useRealTime();
  });

  test("silent rejection: detects files silently dropped by ChatGPT (no error UI)", async () => {
    useFakeTime();

    // ChatGPT accepts .ts files but silently drops .tsx — no error toast, no alert
    const runtime = {
      evaluate: vi.fn().mockResolvedValue({
        result: {
          value: {
            state: "ready",
            uploading: false,
            filesAttached: true,
            attachedNames: ["processing-prompt.ts", "reader-types.ts"],
            inputNames: [],
            fileCount: 2,
            errorDetected: false,
            errorText: "",
          },
        },
      }),
    } as unknown as ChromeClient["Runtime"];

    const promise = waitForAttachmentCompletion(
      runtime,
      30_000,
      ["processing-prompt.ts", "processing-page.tsx", "reader-types.ts"],
    );
    promise.catch(() => {});
    // Need 3s+ stability window for silent rejection detection
    await vi.advanceTimersByTimeAsync(5_000);
    try {
      await promise;
      throw new Error("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(AttachmentUploadError);
      const uploadError = error as AttachmentUploadError;
      expect(uploadError.failedFiles).toEqual(["processing-page.tsx"]);
      expect(uploadError.failedFiles).not.toContain("processing-prompt.ts");
      expect(uploadError.failedFiles).not.toContain("reader-types.ts");
      expect(uploadError.message).toMatch(/silently rejected/i);
    }
    useRealTime();
  });

  test("silent rejection: detects when ALL files are silently dropped (zero attached)", async () => {
    useFakeTime();

    const runtime = {
      evaluate: vi.fn().mockResolvedValue({
        result: {
          value: {
            state: "ready",
            uploading: false,
            filesAttached: false,
            attachedNames: [],
            inputNames: [],
            fileCount: 0,
            errorDetected: false,
            errorText: "",
          },
        },
      }),
    } as unknown as ChromeClient["Runtime"];

    const promise = waitForAttachmentCompletion(
      runtime,
      30_000,
      ["processing-page.tsx", "context-bridge-card.tsx"],
    );
    promise.catch(() => {});
    await vi.advanceTimersByTimeAsync(5_000);
    try {
      await promise;
      throw new Error("Should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(AttachmentUploadError);
      const uploadError = error as AttachmentUploadError;
      expect(uploadError.failedFiles).toEqual(["processing-page.tsx", "context-bridge-card.tsx"]);
      expect(uploadError.message).toMatch(/silently rejected/i);
    }
    useRealTime();
  });
});

describe("sent turn attachment verification", () => {
  test("waitForUserTurnAttachments resolves when last user turn includes filename", async () => {
    const runtime = {
      evaluate: vi.fn().mockResolvedValue({
        result: {
          value: {
            ok: true,
            text: "You said:\noracle-attach-verify.txt\nDocument",
            attrs: [],
            hasAttachmentUi: true,
          },
        },
      }),
    } as unknown as ChromeClient["Runtime"];

    await expect(
      waitForUserTurnAttachments(runtime, ["oracle-attach-verify.txt"], 1000),
    ).resolves.toBe(true);
  });

  test("waitForUserTurnAttachments times out when filename never appears", async () => {
    useFakeTime();

    const runtime = {
      evaluate: vi.fn().mockResolvedValue({
        result: {
          value: {
            ok: true,
            text: "You said:\n(no attachment name here)",
            attrs: [],
            hasAttachmentUi: true,
          },
        },
      }),
    } as unknown as ChromeClient["Runtime"];

    const promise = waitForUserTurnAttachments(runtime, ["oracle-attach-verify.txt"], 600);
    const assertion = expect(promise).rejects.toThrow(/Attachment was not present/i);
    await vi.advanceTimersByTimeAsync(2_000);
    await assertion;
    useRealTime();
  });

  test("waitForUserTurnAttachments skips when user turn lacks attachment UI", async () => {
    useFakeTime();

    const runtime = {
      evaluate: vi.fn().mockResolvedValue({
        result: {
          value: {
            ok: true,
            text: "You said:\n(no attachment UI here)",
            attrs: [],
            hasAttachmentUi: false,
          },
        },
      }),
    } as unknown as ChromeClient["Runtime"];

    const promise = waitForUserTurnAttachments(runtime, ["oracle-attach-verify.txt"], 600);
    await vi.advanceTimersByTimeAsync(2_000);
    await expect(promise).resolves.toBe(false);
    useRealTime();
  });

  test("waitForUserTurnAttachments resolves when attachment UI count satisfies expected files (no filename text)", async () => {
    const runtime = {
      evaluate: vi.fn().mockResolvedValue({
        result: {
          value: {
            ok: true,
            text: "You said:\n(no attachment name here)",
            attrs: [],
            hasAttachmentUi: true,
            attachmentUiCount: 2,
            fileCount: 0,
          },
        },
      }),
    } as unknown as ChromeClient["Runtime"];

    await expect(
      waitForUserTurnAttachments(
        runtime,
        ["oracle-attach-verify-a.txt", "oracle-attach-verify-b.txt"],
        1000,
      ),
    ).resolves.toBe(true);
  });
});
