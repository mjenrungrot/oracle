#!/usr/bin/env node
import { mcpDeprecationMessage } from "../src/cli/deprecation.js";

console.error(mcpDeprecationMessage());
process.exitCode = 1;
