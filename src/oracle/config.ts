import { countTokens as countTokensGpt5 } from "gpt-tokenizer/model/gpt-5";
import { countTokens as countTokensGpt5Pro } from "gpt-tokenizer/model/gpt-5-pro";
import type { ModelConfig, ModelName, KnownModelName, ProModelName, TokenizerFn } from "./types.js";

export const DEFAULT_MODEL: ModelName = "gpt-5.4-pro";
export const PRO_MODELS = new Set<ProModelName>([
  "gpt-5.4-pro",
  "gpt-5.1-pro",
  "gpt-5-pro",
  "gpt-5.2-pro",
]);

export const MODEL_CONFIGS: Record<KnownModelName, ModelConfig> = {
  "gpt-5.1-pro": {
    model: "gpt-5.1-pro",
    apiModel: "gpt-5.4-pro",
    provider: "openai",
    tokenizer: countTokensGpt5Pro as TokenizerFn,
    inputLimit: 196000,
    pricing: {
      inputPerToken: 30 / 1_000_000,
      outputPerToken: 180 / 1_000_000,
    },
    reasoning: null,
  },
  "gpt-5-pro": {
    model: "gpt-5-pro",
    provider: "openai",
    tokenizer: countTokensGpt5Pro as TokenizerFn,
    inputLimit: 196000,
    pricing: {
      inputPerToken: 15 / 1_000_000,
      outputPerToken: 120 / 1_000_000,
    },
    reasoning: null,
  },
  "gpt-5.1": {
    model: "gpt-5.1",
    provider: "openai",
    tokenizer: countTokensGpt5 as TokenizerFn,
    inputLimit: 196000,
    pricing: {
      inputPerToken: 1.25 / 1_000_000,
      outputPerToken: 10 / 1_000_000,
    },
    reasoning: { effort: "high" },
  },
  "gpt-5.4": {
    model: "gpt-5.4",
    provider: "openai",
    tokenizer: countTokensGpt5 as TokenizerFn,
    inputLimit: 196000,
    pricing: {
      inputPerToken: 2.5 / 1_000_000,
      outputPerToken: 15 / 1_000_000,
    },
    reasoning: { effort: "xhigh" },
  },
  "gpt-5.4-pro": {
    model: "gpt-5.4-pro",
    provider: "openai",
    tokenizer: countTokensGpt5Pro as TokenizerFn,
    inputLimit: 196000,
    pricing: {
      inputPerToken: 30 / 1_000_000,
      outputPerToken: 180 / 1_000_000,
    },
    reasoning: { effort: "xhigh" },
  },
  "gpt-5.2": {
    model: "gpt-5.2",
    provider: "openai",
    tokenizer: countTokensGpt5 as TokenizerFn,
    inputLimit: 196000,
    pricing: {
      inputPerToken: 1.75 / 1_000_000,
      outputPerToken: 14 / 1_000_000,
    },
    reasoning: { effort: "xhigh" },
  },
  "gpt-5.2-instant": {
    model: "gpt-5.2-instant",
    apiModel: "gpt-5.2-chat-latest",
    provider: "openai",
    tokenizer: countTokensGpt5 as TokenizerFn,
    inputLimit: 196000,
    pricing: {
      inputPerToken: 1.75 / 1_000_000,
      outputPerToken: 14 / 1_000_000,
    },
    reasoning: null,
  },
  "gpt-5.2-pro": {
    model: "gpt-5.2-pro",
    apiModel: "gpt-5.4-pro",
    provider: "openai",
    tokenizer: countTokensGpt5Pro as TokenizerFn,
    inputLimit: 196000,
    pricing: {
      inputPerToken: 30 / 1_000_000,
      outputPerToken: 180 / 1_000_000,
    },
    reasoning: { effort: "xhigh" },
  },
  "gpt-5.2-thinking": {
    model: "gpt-5.2-thinking",
    apiModel: "gpt-5.2",
    provider: "openai",
    tokenizer: countTokensGpt5 as TokenizerFn,
    inputLimit: 196000,
    pricing: {
      inputPerToken: 1.75 / 1_000_000,
      outputPerToken: 14 / 1_000_000,
    },
    reasoning: { effort: "xhigh" },
  },
};

export const DEFAULT_SYSTEM_PROMPT = [
  "You are Oracle, a focused one-shot problem solver.",
  "Emphasize direct answers and cite any files referenced.",
].join(" ");

export const TOKENIZER_OPTIONS = { allowedSpecial: "all" } as const;
