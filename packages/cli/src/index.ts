#!/usr/bin/env node
import { Command } from "commander";
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
    console.log(`Analyzing ${url}...`);
    const result = await discover(url, { skipLlm: opts.skipLlm });
    console.log(`\nDiscovered ${result.tools.length} tools (via ${result.discoveredVia}):\n`);
    for (const tool of result.tools) {
      const badge = tool.transport === "http" ? "[HTTP]   " : "[Browser]";
      console.log(`  • ${tool.name.padEnd(30)} ${badge} ${tool.description}`);
    }
  });

program
  .command("serve <url>")
  .description("Analyze a website and start an MCP server")
  .option("--transport <type>", "Transport: stdio or http", "stdio")
  .option("--port <number>", "Port for HTTP transport", "4000")
  .option("--skip-llm", "Skip LLM enrichment stage")
  .action(async (url: string, opts: { transport: string; port: string; skipLlm?: boolean }) => {
    await startServer({
      url,
      transport: opts.transport as "stdio" | "http",
      port: parseInt(opts.port, 10),
      skipLlm: opts.skipLlm,
      onProgress: (stage, msg) => console.error(`  Stage ${stage}: ${msg}`),
    });
  });

program.parse();
