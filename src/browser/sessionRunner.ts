import chalk from "chalk";
import type { RunOracleOptions } from "../oracle.js";
import { formatTokenCount } from "../oracle/runUtils.js";
import { formatFinishLine } from "../oracle/finishLine.js";
import type { BrowserSessionConfig, BrowserRuntimeMetadata } from "../sessionStore.js";
import { runBrowserMode } from "../browserMode.js";
import type { BrowserRunResult } from "../browserMode.js";
import { assembleBrowserPrompt } from "./prompt.js";
import { BrowserAutomationError } from "../oracle/errors.js";
import { extractConversationIdFromUrl } from "./reattachHelpers.js";
import type { BrowserLogger } from "./types.js";

export interface BrowserExecutionResult {
  usage: {
    inputTokens: number;
    outputTokens: number;
    reasoningTokens: number;
    totalTokens: number;
  };
  elapsedMs: number;
  runtime: BrowserRuntimeMetadata;
  answerText: string;
}

export interface BrowserPrefillResult {
  elapsedMs: number;
  runtime: BrowserRuntimeMetadata;
}

interface RunBrowserSessionArgs {
  runOptions: RunOracleOptions;
  browserConfig: BrowserSessionConfig;
  cwd: string;
  log: (message?: string) => void;
}

export interface BrowserSessionRunnerDeps {
  assemblePrompt?: typeof assembleBrowserPrompt;
  executeBrowser?: typeof runBrowserMode;
  persistRuntimeHint?: (runtime: BrowserRuntimeMetadata) => Promise<void> | void;
}

function logPromptArtifacts(
  runOptions: RunOracleOptions,
  browserConfig: BrowserSessionConfig,
  promptArtifacts: Awaited<ReturnType<typeof assembleBrowserPrompt>>,
  log: (message?: string) => void,
) {
  if (runOptions.verbose) {
    log(
      chalk.dim(
        `[verbose] Browser config: ${JSON.stringify({
          ...browserConfig,
        })}`,
      ),
    );
    log(chalk.dim(`[verbose] Browser prompt length: ${promptArtifacts.composerText.length} chars`));
    if (promptArtifacts.attachments.length > 0) {
      const attachmentList = promptArtifacts.attachments
        .map((attachment) => attachment.displayPath)
        .join(", ");
      log(chalk.dim(`[verbose] Browser attachments: ${attachmentList}`));
      if (promptArtifacts.bundled) {
        log(
          chalk.yellow(
            `[browser] Bundled ${promptArtifacts.bundled.originalCount} files into ${promptArtifacts.bundled.bundlePath}.`,
          ),
        );
      }
    } else if (
      runOptions.file &&
      runOptions.file.length > 0 &&
      promptArtifacts.attachmentMode === "inline"
    ) {
      log(chalk.dim("[verbose] Browser will paste file contents inline (no uploads)."));
    }
  }
  if (promptArtifacts.bundled) {
    log(
      chalk.dim(
        `Packed ${promptArtifacts.bundled.originalCount} files into 1 bundle (contents counted in token estimate).`,
      ),
    );
  }
}

function createAutomationLogger(
  runOptions: RunOracleOptions,
  log: (message?: string) => void,
): BrowserLogger {
  const automationLogger: BrowserLogger = ((message?: string) => {
    if (typeof message !== "string") return;
    const shouldAlwaysPrint = message.startsWith("[browser] ") && /fallback|retry|rejected|re-uploading/i.test(message);
    if (!runOptions.verbose && !shouldAlwaysPrint) return;
    log(message);
  }) as BrowserLogger;
  automationLogger.verbose = Boolean(runOptions.verbose);
  automationLogger.sessionLog = runOptions.verbose ? log : () => {};
  return automationLogger;
}

export async function runBrowserSessionExecution(
  { runOptions, browserConfig, cwd, log }: RunBrowserSessionArgs,
  deps: BrowserSessionRunnerDeps = {},
): Promise<BrowserExecutionResult> {
  const assemblePrompt = deps.assemblePrompt ?? assembleBrowserPrompt;
  const executeBrowser = deps.executeBrowser ?? runBrowserMode;
  const promptArtifacts = await assemblePrompt(runOptions, { cwd });
  logPromptArtifacts(runOptions, browserConfig, promptArtifacts, log);
  const headerLine = `Launching browser mode (${runOptions.model}) with ~${promptArtifacts.estimatedInputTokens.toLocaleString()} tokens.`;
  const automationLogger = createAutomationLogger(runOptions, log);

  log(headerLine);
  const isDeepResearch = Boolean(browserConfig.deepResearch);
  log(
    chalk.dim(
      isDeepResearch
        ? "Deep Research mode — this run typically takes 5-30 minutes."
        : "This run can take up to an hour (usually ~10 minutes).",
    ),
  );
  if (runOptions.verbose) {
    log(chalk.dim("Chrome automation does not stream output; this may take a minute..."));
  }
  const persistRuntimeHint = deps.persistRuntimeHint ?? (() => {});
  let browserResult: BrowserRunResult;
  try {
    browserResult = await executeBrowser({
      prompt: promptArtifacts.composerText,
      attachments: promptArtifacts.attachments,
      fallbackSubmission: promptArtifacts.fallback
        ? {
            prompt: promptArtifacts.fallback.composerText,
            attachments: promptArtifacts.fallback.attachments,
          }
        : undefined,
      config: browserConfig,
      log: automationLogger,
      heartbeatIntervalMs: runOptions.heartbeatIntervalMs,
      verbose: runOptions.verbose,
      runtimeHintCb: async (runtime) => {
        await persistRuntimeHint({
          ...runtime,
          controllerPid: runtime.controllerPid ?? process.pid,
        });
      },
    });
  } catch (error) {
    if (error instanceof BrowserAutomationError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "Browser automation failed.";
    throw new BrowserAutomationError(message, { stage: "execute-browser" }, error);
  }
  if (!runOptions.silent) {
    log(chalk.bold("Answer:"));
    log(browserResult.answerMarkdown || browserResult.answerText || chalk.dim("(no text output)"));
    log("");
  }
  const answerText = browserResult.answerMarkdown || browserResult.answerText || "";
  const usage = {
    inputTokens: promptArtifacts.estimatedInputTokens,
    outputTokens: browserResult.answerTokens,
    reasoningTokens: 0,
    totalTokens: promptArtifacts.estimatedInputTokens + browserResult.answerTokens,
  };
  const tokensDisplay = [
    usage.inputTokens,
    usage.outputTokens,
    usage.reasoningTokens,
    usage.totalTokens,
  ]
    .map((value) => formatTokenCount(value))
    .join("/");
  const tokensPart = (() => {
    const parts = tokensDisplay.split("/");
    if (parts.length !== 4) return tokensDisplay;
    return `↑${parts[0]} ↓${parts[1]} ↻${parts[2]} Δ${parts[3]}`;
  })();
  const { line1, line2 } = formatFinishLine({
    elapsedMs: browserResult.tookMs,
    model: `${runOptions.model}[browser]`,
    tokensPart,
    detailParts: [
      runOptions.file && runOptions.file.length > 0 ? `files=${runOptions.file.length}` : null,
    ],
  });
  log(chalk.blue(line1));
  if (line2) {
    log(chalk.dim(line2));
  }
  return {
    usage,
    elapsedMs: browserResult.tookMs,
    runtime: {
      chromePid: browserResult.chromePid,
      chromePort: browserResult.chromePort,
      chromeHost: browserResult.chromeHost,
      userDataDir: browserResult.userDataDir,
      chromeTargetId: browserResult.chromeTargetId,
      tabUrl: browserResult.tabUrl,
      conversationId: browserResult.tabUrl
        ? extractConversationIdFromUrl(browserResult.tabUrl)
        : undefined,
      controllerPid: browserResult.controllerPid ?? process.pid,
    },
    answerText,
  };
}

export async function runBrowserDryRunExecution(
  { runOptions, browserConfig, cwd, log }: RunBrowserSessionArgs,
  deps: BrowserSessionRunnerDeps = {},
): Promise<BrowserPrefillResult> {
  const assemblePrompt = deps.assemblePrompt ?? assembleBrowserPrompt;
  const executeBrowser = deps.executeBrowser ?? runBrowserMode;
  const promptArtifacts = await assemblePrompt(runOptions, { cwd });
  logPromptArtifacts(runOptions, browserConfig, promptArtifacts, log);

  const automationLogger = createAutomationLogger(runOptions, log);
  log(
    `Preparing browser dry-run (${runOptions.model}) with ~${promptArtifacts.estimatedInputTokens.toLocaleString()} tokens.`,
  );
  log(chalk.dim("Opening ChatGPT, filling the composer, and stopping before send."));
  if (runOptions.verbose) {
    log(chalk.dim("Chrome automation does not stream output; this may take a minute..."));
  }

  let browserResult: BrowserRunResult;
  try {
    browserResult = await executeBrowser({
      prompt: promptArtifacts.composerText,
      attachments: promptArtifacts.attachments,
      prepareOnly: true,
      fallbackSubmission: promptArtifacts.fallback
        ? {
            prompt: promptArtifacts.fallback.composerText,
            attachments: promptArtifacts.fallback.attachments,
          }
        : undefined,
      config: browserConfig,
      log: automationLogger,
      heartbeatIntervalMs: runOptions.heartbeatIntervalMs,
      verbose: runOptions.verbose,
    });
  } catch (error) {
    if (error instanceof BrowserAutomationError) {
      throw error;
    }
    const message = error instanceof Error ? error.message : "Browser automation failed.";
    throw new BrowserAutomationError(message, { stage: "prepare-browser" }, error);
  }

  log(chalk.green("Prompt prepared in ChatGPT. Nothing was sent."));
  if (browserResult.tabUrl) {
    log(chalk.dim(`Prepared tab: ${browserResult.tabUrl}`));
  }

  return {
    elapsedMs: browserResult.tookMs,
    runtime: {
      chromePid: browserResult.chromePid,
      chromePort: browserResult.chromePort,
      chromeHost: browserResult.chromeHost,
      userDataDir: browserResult.userDataDir,
      controllerPid: browserResult.controllerPid ?? process.pid,
    },
  };
}
