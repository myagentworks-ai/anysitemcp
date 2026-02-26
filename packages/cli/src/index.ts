#!/usr/bin/env node
import { Command, Option } from "commander";
import { discover } from "@webmcp/core";
import { startServer } from "@webmcp/mcp-server";

const program = new Command()
  .name("webmcp")
  .description("Generate MCP servers from any website")
  .version("0.0.1");

program
  .command("analyze <url>")
  .description("Analyze a website and print discovered tools")
  .option("--skip-llm", "Skip LLM enrichment stage")
  .action(async (url: string, opts: { skipLlm?: boolean }) => {
    try {
      console.log(`Analyzing ${url}...`);
      const result = await discover(url, {
        skipLlm: opts.skipLlm,
        onProgress: (stage, msg) => console.error(`  Stage ${stage}: ${msg}`),
      });
      console.log(`\nDiscovered ${result.tools.length} tools (via ${result.discoveredVia}):\n`);
      for (const tool of result.tools) {
        const badge = tool.transport === "http" ? "[HTTP]   " : "[Browser]";
        console.log(`  • ${tool.name.padEnd(30)} ${badge} ${tool.description}`);
      }
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program
  .command("serve <url>")
  .description("Analyze a website and start an MCP server")
  .addOption(
    new Option("--transport <type>", "Transport: stdio or http")
      .choices(["stdio", "http"])
      .default("stdio")
  )
  .option("--port <number>", "Port for HTTP transport", "4000")
  .option("--skip-llm", "Skip LLM enrichment stage")
  .action(async (url: string, opts: { transport: string; port: string; skipLlm?: boolean }) => {
    try {
      const port = parseInt(opts.port, 10);
      if (isNaN(port) || port < 1 || port > 65535) {
        console.error(`Error: --port must be a number between 1 and 65535 (got "${opts.port}")`);
        process.exit(1);
      }
      await startServer({
        url,
        transport: opts.transport as "stdio" | "http",
        port,
        skipLlm: opts.skipLlm,
        onProgress: (stage, msg) => console.error(`  Stage ${stage}: ${msg}`),
      });
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  });

program.parse();
