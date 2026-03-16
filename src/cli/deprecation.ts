import type { UserConfig } from "../config.js";

const BROWSER_ONLY_GUIDANCE =
  "Local oracle is browser-only now. Use ChatGPT/GPT browser models or `oracle serve` for remote browser automation.";

export function browserOnlyEngineMessage(source: string): string {
  return `${source} is deprecated in this local repository. ${BROWSER_ONLY_GUIDANCE}`;
}

export function deprecatedFeatureMessage(feature: string, replacement?: string): string {
  const replacementText = replacement ? ` ${replacement}` : "";
  return `${feature} is deprecated in this local repository.${replacementText} ${BROWSER_ONLY_GUIDANCE}`.trim();
}

export function nonChatGptModelMessage(model: string): string {
  return `Model "${model}" is deprecated in this local repository. Only ChatGPT/GPT browser models are supported.`;
}

export function mcpDeprecationMessage(command = "oracle-mcp"): string {
  return `${command} is deprecated in this local repository. MCP is no longer supported. Use \`oracle\` directly, or \`oracle serve\` for remote browser automation.`;
}

export function collectDeprecatedConfigWarnings(userConfig: UserConfig): string[] {
  const deprecatedKeys = [
    userConfig.search !== undefined ? "search" : null,
    userConfig.background !== undefined ? "background" : null,
    typeof userConfig.apiBaseUrl === "string" && userConfig.apiBaseUrl.trim().length > 0
      ? "apiBaseUrl"
      : null,
    userConfig.azure ? "azure" : null,
  ].filter((value): value is string => Boolean(value));

  if (deprecatedKeys.length === 0) {
    return [];
  }

  return [
    `Ignoring deprecated config keys in oracle config: ${deprecatedKeys.join(", ")}. The local repository no longer supports API/MCP provider settings.`,
  ];
}
