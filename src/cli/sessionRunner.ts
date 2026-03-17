import kleur from "kleur";
import fs from "node:fs/promises";
import path from "node:path";
import { cwd as getCwd } from "node:process";
import type {
  SessionMetadata,
  SessionMode,
  BrowserSessionConfig,
  BrowserRuntimeMetadata,
} from "../sessionStore.js";
import type { RunOracleOptions } from "../oracle.js";
import { asOracleUserError } from "../oracle.js";
import {
  runBrowserSessionExecution,
  type BrowserSessionRunnerDeps,
} from "../browser/sessionRunner.js";
import {
  type NotificationSettings,
  sendSessionNotification,
  deriveNotificationSettingsFromMetadata,
} from "./notifier.js";
import { sessionStore } from "../sessionStore.js";
import { wait } from "../sessionManager.js";
import { resumeBrowserSession } from "../browser/reattach.js";
import { estimateTokenCount } from "../browser/utils.js";
import type { BrowserLogger } from "../browser/types.js";
import { formatElapsed } from "../oracle/format.js";
import { browserOnlyEngineMessage } from "./deprecation.js";

const isTty = process.stdout.isTTY;
const dim = (text: string): string => (isTty ? kleur.dim(text) : text);

export interface SessionRunParams {
  sessionMeta: SessionMetadata;
  runOptions: RunOracleOptions;
  mode: SessionMode;
  browserConfig?: BrowserSessionConfig;
  cwd: string;
  log: (message?: string) => void;
  write: (chunk: string) => boolean;
  version: string;
  notifications?: NotificationSettings;
  browserDeps?: BrowserSessionRunnerDeps;
  muteStdout?: boolean;
}

export async function performSessionRun({
  sessionMeta,
  runOptions,
  mode,
  browserConfig,
  cwd,
  log,
  write,
  notifications,
  browserDeps,
  muteStdout = false,
}: SessionRunParams): Promise<void> {
  if (mode !== "browser") {
    throw new Error(browserOnlyEngineMessage(`Stored ${mode} sessions`));
  }

  const _writeInline = (chunk: string): boolean => {
    write(chunk);
    return muteStdout ? true : process.stdout.write(chunk);
  };

  await sessionStore.updateSession(sessionMeta.id, {
    status: "running",
    startedAt: new Date().toISOString(),
    mode,
    ...(browserConfig ? { browser: { config: browserConfig } } : {}),
  });

  const notificationSettings =
    notifications ?? deriveNotificationSettingsFromMetadata(sessionMeta, process.env);
  const modelForStatus = runOptions.model ?? sessionMeta.model;

  try {
    if (!browserConfig) {
      throw new Error("Missing browser configuration for session.");
    }
    if (modelForStatus) {
      await sessionStore.updateModelRun(sessionMeta.id, modelForStatus, {
        status: "running",
        startedAt: new Date().toISOString(),
      });
    }

    const runnerDeps = {
      ...browserDeps,
      persistRuntimeHint: async (runtime: BrowserRuntimeMetadata) => {
        await sessionStore.updateSession(sessionMeta.id, {
          status: "running",
          browser: { config: browserConfig, runtime },
        });
      },
    };

    const result = await runBrowserSessionExecution(
      { runOptions, browserConfig, cwd, log },
      runnerDeps,
    );
    if (modelForStatus) {
      await sessionStore.updateModelRun(sessionMeta.id, modelForStatus, {
        status: "completed",
        completedAt: new Date().toISOString(),
        usage: result.usage,
      });
    }
    await sessionStore.updateSession(sessionMeta.id, {
      status: "completed",
      completedAt: new Date().toISOString(),
      usage: result.usage,
      elapsedMs: result.elapsedMs,
      browser: {
        config: browserConfig,
        runtime: result.runtime,
      },
      response: undefined,
      transport: undefined,
      error: undefined,
    });
    await writeAssistantOutput(runOptions.writeOutputPath, result.answerText ?? "", log);
    await sendSessionNotification(
      {
        sessionId: sessionMeta.id,
        sessionName: sessionMeta.options?.slug ?? sessionMeta.id,
        mode,
        model: sessionMeta.model,
        usage: result.usage,
        characters: result.answerText?.length,
      },
      notificationSettings,
      log,
      result.answerText?.slice(0, 140),
    );
  } catch (error: unknown) {
    const message = formatError(error);
    log(`ERROR: ${message}`);
    const userError = asOracleUserError(error);
    const details = (userError?.details as { stage?: string; runtime?: BrowserRuntimeMetadata }) ?? {};
    const connectionLost = userError?.category === "browser-automation" && details.stage === "connection-lost";
    const assistantTimeout =
      userError?.category === "browser-automation" && details.stage === "assistant-timeout";
    const cloudflareChallenge =
      userError?.category === "browser-automation" && details.stage === "cloudflare-challenge";

    if (connectionLost) {
      log(dim("Chrome disconnected before completion; keeping session running for reattach."));
      if (modelForStatus) {
        await sessionStore.updateModelRun(sessionMeta.id, modelForStatus, {
          status: "running",
          completedAt: undefined,
        });
      }
      await sessionStore.updateSession(sessionMeta.id, {
        status: "running",
        errorMessage: message,
        mode,
        browser: {
          config: browserConfig,
          runtime: details.runtime ?? sessionMeta.browser?.runtime,
        },
        response: { status: "running", incompleteReason: "chrome-disconnected" },
      });
      return;
    }

    if (assistantTimeout) {
      log(dim("Assistant response timed out; keeping session running for reattach."));
      if (modelForStatus) {
        await sessionStore.updateModelRun(sessionMeta.id, modelForStatus, {
          status: "running",
          completedAt: undefined,
        });
      }
      await sessionStore.updateSession(sessionMeta.id, {
        status: "running",
        errorMessage: message,
        mode,
        browser: {
          config: browserConfig,
          runtime: details.runtime ?? sessionMeta.browser?.runtime,
        },
        response: { status: "running", incompleteReason: "assistant-timeout" },
      });
      const autoReattachIntervalMs = browserConfig?.autoReattachIntervalMs ?? 0;
      if (autoReattachIntervalMs > 0) {
        const success = await autoReattachUntilComplete({
          sessionMeta,
          runtime: details.runtime ?? sessionMeta.browser?.runtime,
          browserConfig,
          runOptions,
          modelForStatus,
          notificationSettings,
          log,
        });
        if (success) {
          return;
        }
      }
      log(dim(`Reattach later with: oracle session ${sessionMeta.id}`));
      return;
    }

    if (cloudflareChallenge) {
      const reuseProfileHint = (
        userError?.details as { reuseProfileHint?: string } | undefined
      )?.reuseProfileHint;
      log(
        dim("Cloudflare challenge detected; browser left running so you can complete the check."),
      );
      if (reuseProfileHint) {
        log(dim(`Reuse this browser profile with: ${reuseProfileHint}`));
      }
    }

    await sessionStore.updateSession(sessionMeta.id, {
      status: "error",
      completedAt: new Date().toISOString(),
      errorMessage: message,
      mode,
      browser: browserConfig
        ? {
            config: browserConfig,
            runtime: details.runtime ?? undefined,
          }
        : undefined,
      error: userError
        ? {
            category: userError.category,
            message: userError.message,
            details: userError.details,
          }
        : undefined,
    });
    if (modelForStatus) {
      await sessionStore.updateModelRun(sessionMeta.id, modelForStatus, {
        status: "error",
        completedAt: new Date().toISOString(),
      });
    }
    throw error;
  }
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function writeAssistantOutput(
  targetPath: string | undefined,
  content: string,
  log: (message: string) => void,
) {
  if (!targetPath) return;
  if (!content || content.trim().length === 0) {
    log(dim("write-output skipped: no assistant content to save."));
    return;
  }
  const normalizedTarget = path.resolve(targetPath);
  const normalizedSessionsDir = path.resolve(sessionStore.sessionsDir());
  if (
    normalizedTarget === normalizedSessionsDir ||
    normalizedTarget.startsWith(`${normalizedSessionsDir}${path.sep}`)
  ) {
    log(
      dim(
        `write-output skipped: refusing to write inside session storage (${normalizedSessionsDir}).`,
      ),
    );
    return;
  }
  try {
    await fs.mkdir(path.dirname(normalizedTarget), { recursive: true });
    const payload = content.endsWith("\n") ? content : `${content}\n`;
    await fs.writeFile(normalizedTarget, payload, "utf8");
    log(dim(`Saved assistant output to ${normalizedTarget}`));
    return normalizedTarget;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (isPermissionError(error)) {
      const fallbackPath = buildFallbackPath(normalizedTarget);
      if (fallbackPath) {
        try {
          await fs.mkdir(path.dirname(fallbackPath), { recursive: true });
          const payload = content.endsWith("\n") ? content : `${content}\n`;
          await fs.writeFile(fallbackPath, payload, "utf8");
          log(dim(`write-output fallback to ${fallbackPath} (original failed: ${reason})`));
          return fallbackPath;
        } catch (innerError) {
          const innerReason = innerError instanceof Error ? innerError.message : String(innerError);
          log(
            dim(
              `write-output failed (${reason}); fallback failed (${innerReason}); session completed anyway.`,
            ),
          );
          return;
        }
      }
    }
    log(dim(`write-output failed (${reason}); session completed anyway.`));
  }
}

async function autoReattachUntilComplete({
  sessionMeta,
  runtime,
  browserConfig,
  runOptions,
  modelForStatus,
  notificationSettings,
  log,
}: {
  sessionMeta: SessionMetadata;
  runtime?: BrowserRuntimeMetadata;
  browserConfig?: BrowserSessionConfig;
  runOptions: RunOracleOptions;
  modelForStatus?: string;
  notificationSettings: NotificationSettings;
  log: (message?: string) => void;
}): Promise<boolean> {
  if (!runtime || !browserConfig) {
    log(dim("Auto-reattach disabled: missing runtime or browser config."));
    return false;
  }
  const isDeepResearch = Boolean(browserConfig.deepResearch);
  const delayMs = Math.max(isDeepResearch ? 120_000 : 0, browserConfig.autoReattachDelayMs ?? 0);
  const intervalMs = Math.max(
    isDeepResearch ? 60_000 : 0,
    browserConfig.autoReattachIntervalMs ?? 0,
  );
  if (intervalMs <= 0) {
    return false;
  }
  const timeoutMs = isDeepResearch
    ? Math.max(300_000, browserConfig.autoReattachTimeoutMs ?? 0, browserConfig.timeoutMs ?? 0)
    : Math.max(0, browserConfig.autoReattachTimeoutMs ?? 0) ||
      Math.max(0, browserConfig.timeoutMs ?? 0) ||
      120_000;
  const maxTotalMs = 2 * 60 * 60 * 1000;
  const maxDeadline = Date.now() + maxTotalMs;

  if (delayMs > 0) {
    log(dim(`Auto-reattach starting in ${formatElapsed(delayMs)}...`));
    await wait(delayMs);
  }
  log(dim(`Auto-reattach will stop after ${formatElapsed(maxTotalMs)} if no answer is captured.`));

  const logger: BrowserLogger = ((message?: string) => {
    if (message) {
      log(dim(message));
    }
  }) as BrowserLogger;
  logger.verbose = true;

  let attempt = 0;
  for (;;) {
    const remainingBudgetMs = maxDeadline - Date.now();
    if (remainingBudgetMs <= 0) {
      log(
        dim(
          `Auto-reattach stopped after ${formatElapsed(maxTotalMs)} without capturing an answer.`,
        ),
      );
      return false;
    }
    attempt += 1;
    log(dim(`Auto-reattach attempt ${attempt}...`));
    try {
      const reattachConfig: BrowserSessionConfig = {
        ...browserConfig,
        timeoutMs,
      };
      const result = await resumeBrowserSession(runtime, reattachConfig, logger, {
        promptPreview: sessionMeta.promptPreview,
      });
      const answerText = result.answerMarkdown || result.answerText || "";
      const outputTokens = estimateTokenCount(answerText);
      const logWriter = sessionStore.createLogWriter(sessionMeta.id);
      logWriter.logLine(`[auto-reattach] captured assistant response on attempt ${attempt}`);
      logWriter.logLine("Answer:");
      logWriter.logLine(answerText);
      logWriter.stream.end();
      if (modelForStatus) {
        await sessionStore.updateModelRun(sessionMeta.id, modelForStatus, {
          status: "completed",
          completedAt: new Date().toISOString(),
          usage: {
            inputTokens: 0,
            outputTokens,
            reasoningTokens: 0,
            totalTokens: outputTokens,
          },
        });
      }
      await sessionStore.updateSession(sessionMeta.id, {
        status: "completed",
        completedAt: new Date().toISOString(),
        usage: {
          inputTokens: 0,
          outputTokens,
          reasoningTokens: 0,
          totalTokens: outputTokens,
        },
        browser: {
          config: browserConfig,
          runtime,
        },
        response: { status: "completed" },
        error: undefined,
        transport: undefined,
      });
      await writeAssistantOutput(runOptions.writeOutputPath, answerText, log);
      await sendSessionNotification(
        {
          sessionId: sessionMeta.id,
          sessionName: sessionMeta.options?.slug ?? sessionMeta.id,
          mode: sessionMeta.mode ?? "browser",
          model: sessionMeta.model ?? runOptions.model,
          usage: {
            inputTokens: 0,
            outputTokens,
          },
          characters: answerText.length,
        },
        notificationSettings,
        log,
        answerText.slice(0, 140),
      );
      log(kleur.green("Auto-reattach succeeded; session marked completed."));
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      log(dim(`Auto-reattach attempt ${attempt} failed: ${message}`));
    }
    const remainingAfterAttemptMs = maxDeadline - Date.now();
    if (remainingAfterAttemptMs <= 0) {
      log(
        dim(
          `Auto-reattach stopped after ${formatElapsed(maxTotalMs)} without capturing an answer.`,
        ),
      );
      return false;
    }
    await wait(Math.min(intervalMs, remainingAfterAttemptMs));
  }
}

export function deriveModelOutputPath(
  basePath: string | undefined,
  model: string,
): string | undefined {
  if (!basePath) return undefined;
  const ext = path.extname(basePath);
  const stem = path.basename(basePath, ext);
  const dir = path.dirname(basePath);
  const suffix = ext.length > 0 ? `${stem}.${model}${ext}` : `${stem}.${model}`;
  return path.join(dir, suffix);
}

function isPermissionError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  const code = (error as { code?: string }).code;
  return code === "EACCES" || code === "EPERM";
}

function buildFallbackPath(original: string): string | null {
  const ext = path.extname(original);
  const stem = path.basename(original, ext);
  const dir = getCwd();
  const candidate = ext ? `${stem}.fallback${ext}` : `${stem}.fallback`;
  const fallback = path.join(dir, candidate);
  const normalizedSessionsDir = path.resolve(sessionStore.sessionsDir());
  const normalizedFallback = path.resolve(fallback);
  if (
    normalizedFallback === normalizedSessionsDir ||
    normalizedFallback.startsWith(`${normalizedSessionsDir}${path.sep}`)
  ) {
    return null;
  }
  return fallback;
}
