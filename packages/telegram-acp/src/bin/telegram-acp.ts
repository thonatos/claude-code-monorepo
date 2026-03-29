#!/usr/bin/env node

/**
 * telegram-acp CLI entry point.
 */

import { TelegramAcpBridge } from "../bridge.ts";
import { loadConfig, listPresets } from "../config.ts";

function usage(): void {
  const presets = listPresets()
    .map(({ id }) => id)
    .join(", ");

  console.log(`
telegram-acp — Bridge Telegram to ACP-compatible AI agents

Usage:
  telegram-acp --preset <name>    Start with preset (config from ~/.telegram-acp/config.yaml)
  telegram-acp --config <file>    Start with config file
  telegram-acp agents             List available presets
  telegram-acp                    Start with default config

Presets: ${presets}

Config file format (~/.telegram-acp/config.yaml):
  telegram:
    botToken: "..."
  agent:
    preset: claude
  proxy: "socks5://..."
  allowedUsers:
    - "12345"
  open: false
  reaction:
    enabled: true
`);
}

function parseArgs(argv: string[]): {
  preset?: string;
  configFile?: string;
  help: boolean;
} {
  const result: { preset?: string; configFile?: string; help: boolean } = {
    help: false,
  };

  const args = argv.slice(2);
  let i = 0;

  // Check for subcommand first
  if (args[0] && !args[0].startsWith("-")) {
    if (args[0] === "agents") {
      handleAgents();
      process.exit(0);
    }
    console.error(`Unknown command: ${args[0]}`);
    usage();
    process.exit(1);
  }

  while (i < args.length) {
    const arg = args[i];
    switch (arg) {
      case "--preset":
        result.preset = args[++i];
        break;
      case "--config":
        result.configFile = args[++i];
        break;
      case "-h":
      case "--help":
        result.help = true;
        break;
      default:
        if (arg?.startsWith("-")) {
          console.error(`Unknown option: ${arg}`);
          usage();
          process.exit(1);
        }
    }
    i++;
  }

  return result;
}

function handleAgents(): void {
  console.log("Available presets:\n");
  for (const { id, preset } of listPresets()) {
    console.log(`  ${id.padEnd(8)} ${preset.label}`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv);

  if (args.help) {
    usage();
    process.exit(0);
  }

  const config = loadConfig(args.configFile, args.preset);

  // Validate bot token
  if (!config.telegram.botToken) {
    console.error("Error: botToken not configured");
    console.error("Add 'telegram.botToken' to ~/.telegram-acp/config.yaml");
    process.exit(1);
  }

  // Validate agent
  if (!config.agent.command) {
    console.error("Error: agent not configured");
    console.error("Use --preset <name> or add 'agent.preset' to config");
    process.exit(1);
  }

  // Setup logger
  const log = (msg: string) => {
    const ts = new Date().toISOString().substring(11, 19);
    console.log(`[${ts}] ${msg}`);
  };
  config.log = log;

  const bridge = new TelegramAcpBridge(config);

  const shutdown = async () => {
    await bridge.stop();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  try {
    await bridge.start();
  } catch (err: any) {
    console.error(`Fatal: ${err.message}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`Fatal: ${String(err)}`);
  process.exit(1);
});