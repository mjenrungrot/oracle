import type { RunOracleOptions } from "../oracle.js";
import { DEFAULT_MODEL } from "../oracle.js";
import type { UserConfig } from "../config.js";
import type { EngineMode } from "./engine.js";
import { resolveEngine } from "./engine.js";
import { normalizeModelOption, resolveApiModel } from "./options.js";
import { PromptValidationError } from "../oracle/errors.js";
import { normalizeChatGptModelForBrowser } from "./browserConfig.js";
import { resolveConfiguredMaxFileSizeBytes } from "./fileSize.js";
import { browserOnlyEngineMessage, deprecatedFeatureMessage } from "./deprecation.js";

export interface ResolveRunOptionsInput {
  prompt: string;
  files?: string[];
  model?: string;
  models?: string[];
  engine?: EngineMode;
  userConfig?: UserConfig;
  env?: NodeJS.ProcessEnv;
}

export interface ResolvedRunOptions {
  runOptions: RunOracleOptions;
  resolvedEngine: EngineMode;
}

export function resolveRunOptionsFromConfig({
  prompt,
  files = [],
  model,
  models,
  engine,
  userConfig,
  env = process.env,
}: ResolveRunOptionsInput): ResolvedRunOptions {
  const resolvedEngine = resolveEngineWithConfig({ engine, configEngine: userConfig?.engine, env });
  const requestedModelList = Array.isArray(models) ? models : [];
  const normalizedRequestedModels = requestedModelList
    .map((entry) => normalizeModelOption(entry))
    .filter(Boolean);
  if (resolvedEngine === "api") {
    throw new PromptValidationError(browserOnlyEngineMessage("API engine"), {
      engine: resolvedEngine,
    });
  }
  if (normalizedRequestedModels.length > 0) {
    throw new PromptValidationError(deprecatedFeatureMessage("--models"), {
      models: normalizedRequestedModels,
    });
  }
  if (userConfig?.search !== undefined) {
    throw new PromptValidationError(deprecatedFeatureMessage("config search"), {
      search: userConfig.search,
    });
  }
  if (userConfig?.background !== undefined) {
    throw new PromptValidationError(deprecatedFeatureMessage("config background"), {
      background: userConfig.background,
    });
  }
  if (userConfig?.apiBaseUrl) {
    throw new PromptValidationError(deprecatedFeatureMessage("config apiBaseUrl"), {
      baseUrl: userConfig.apiBaseUrl,
    });
  }
  if (userConfig?.azure) {
    throw new PromptValidationError(deprecatedFeatureMessage("config azure"), {
      azure: userConfig.azure,
    });
  }

  const cliModelArg = normalizeModelOption(model ?? userConfig?.model) || DEFAULT_MODEL;
  const resolvedModel = normalizeChatGptModelForBrowser(resolveApiModel(cliModelArg));

  const promptWithSuffix =
    userConfig?.promptSuffix && userConfig.promptSuffix.trim().length > 0
      ? `${prompt.trim()}\n${userConfig.promptSuffix}`
      : prompt;

  const heartbeatIntervalMs =
    userConfig?.heartbeatSeconds !== undefined ? userConfig.heartbeatSeconds * 1000 : 30_000;
  const maxFileSizeBytes = resolveConfiguredMaxFileSizeBytes(userConfig, env);

  const runOptions: RunOracleOptions = {
    prompt: promptWithSuffix,
    model: resolvedModel,
    file: files ?? [],
    maxFileSizeBytes,
    heartbeatIntervalMs,
    filesReport: userConfig?.filesReport,
    effectiveModelId: resolvedModel,
  };

  return { runOptions, resolvedEngine };
}

function resolveEngineWithConfig({
  engine,
  configEngine,
  env,
}: {
  engine?: EngineMode;
  configEngine?: EngineMode;
  env: NodeJS.ProcessEnv;
}): EngineMode {
  if (engine) return engine;
  const envOverride = (env.ORACLE_ENGINE ?? "").trim().toLowerCase();
  if (envOverride === "api" || envOverride === "browser") {
    return envOverride as EngineMode;
  }
  if (configEngine) return configEngine;
  return resolveEngine({ engine: undefined, env });
}
