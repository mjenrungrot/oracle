import { describe, expect, it } from "vitest";
import { resolveRunOptionsFromConfig } from "../src/cli/runOptions.js";
import { estimateRequestTokens } from "../src/oracle/tokenEstimate.js";
import { DEFAULT_MODEL, MODEL_CONFIGS } from "../src/oracle/config.js";

describe("resolveRunOptionsFromConfig", () => {
  const basePrompt = "This prompt is comfortably above twenty characters.";

  it("defaults to browser when nothing overrides the engine", () => {
    const { resolvedEngine } = resolveRunOptionsFromConfig({
      prompt: basePrompt,
      env: { OPENAI_API_KEY: "sk-test" },
    });
    expect(resolvedEngine).toBe("browser");
  });

  it("rejects explicit api engine requests", () => {
    expect(() =>
      resolveRunOptionsFromConfig({
        prompt: basePrompt,
        engine: "api",
      }),
    ).toThrow(/API engine is deprecated/i);
  });

  it("rejects config engine api requests", () => {
    expect(() =>
      resolveRunOptionsFromConfig({
        prompt: basePrompt,
        userConfig: { engine: "api" },
      }),
    ).toThrow(/API engine is deprecated/i);
  });

  it("rejects ORACLE_ENGINE=api", () => {
    expect(() =>
      resolveRunOptionsFromConfig({
        prompt: basePrompt,
        env: { ORACLE_ENGINE: "api" },
      }),
    ).toThrow(/API engine is deprecated/i);
  });

  it("defaults to gpt-5.4-pro when model not provided", () => {
    const { runOptions } = resolveRunOptionsFromConfig({
      prompt: basePrompt,
    });
    expect(runOptions.model).toBe(DEFAULT_MODEL);
  });

  it("maps legacy GPT aliases to current browser targets", () => {
    const { runOptions } = resolveRunOptionsFromConfig({
      prompt: basePrompt,
      model: "gpt-5.1-pro",
    });
    expect(runOptions.model).toBe("gpt-5.4-pro");
  });

  it("maps gpt-5.1 to the current browser auto target", () => {
    const { runOptions } = resolveRunOptionsFromConfig({
      prompt: basePrompt,
      model: "gpt-5.1",
    });
    expect(runOptions.model).toBe("gpt-5.2");
  });

  it("rejects non-ChatGPT models", () => {
    expect(() =>
      resolveRunOptionsFromConfig({
        prompt: basePrompt,
        model: "gemini-3-pro",
      }),
    ).toThrow(/Only ChatGPT\/GPT browser models are supported/i);
  });

  it("rejects multi-model requests", () => {
    expect(() =>
      resolveRunOptionsFromConfig({
        prompt: basePrompt,
        models: ["gpt-5.4", "gpt-5.2"],
      }),
    ).toThrow(/--models is deprecated/i);
  });

  it("rejects deprecated provider config", () => {
    expect(() =>
      resolveRunOptionsFromConfig({
        prompt: basePrompt,
        userConfig: { apiBaseUrl: "https://proxy.test/v1" },
      }),
    ).toThrow(/config apiBaseUrl/i);
  });

  it("appends prompt suffix from config", () => {
    const { runOptions } = resolveRunOptionsFromConfig({
      prompt: "Hi there, this exceeds twenty characters.",
      userConfig: { promptSuffix: "// signed" },
    });
    expect(runOptions.prompt).toBe("Hi there, this exceeds twenty characters.\n// signed");
  });

  it("uses heartbeatSeconds from config", () => {
    const { runOptions } = resolveRunOptionsFromConfig({
      prompt: basePrompt,
      userConfig: { heartbeatSeconds: 5 },
    });
    expect(runOptions.heartbeatIntervalMs).toBe(5000);
  });

  it("uses maxFileSizeBytes from config", () => {
    const { runOptions } = resolveRunOptionsFromConfig({
      prompt: basePrompt,
      userConfig: { maxFileSizeBytes: 2_097_152 },
    });
    expect(runOptions.maxFileSizeBytes).toBe(2_097_152);
  });
});

describe("estimateRequestTokens", () => {
  const modelConfig = MODEL_CONFIGS["gpt-5.1"];

  it("includes instructions, input text, tools, reasoning, background/store, plus buffer", () => {
    const request = {
      model: "gpt-5.1",
      instructions: "sys",
      input: [
        {
          role: "user",
          content: [{ type: "input_text", text: "hello world" }],
        },
      ],
      tools: [{ type: "web_search_preview" }],
      reasoning: { effort: "high" },
      background: true,
      store: true,
    };
    const estimate = estimateRequestTokens(
      request as unknown as Parameters<typeof estimateRequestTokens>[0],
      modelConfig,
      10,
    );
    expect(estimate).toBeGreaterThan(10);
  });

  it("adds buffer even with minimal input", () => {
    const request = {
      model: "gpt-5.1",
      instructions: "a",
      input: [{ role: "user", content: [{ type: "input_text", text: "b" }] }],
    };
    const estimate = estimateRequestTokens(
      request as unknown as Parameters<typeof estimateRequestTokens>[0],
      modelConfig,
      50,
    );
    expect(estimate).toBeGreaterThanOrEqual(50);
  });
});
