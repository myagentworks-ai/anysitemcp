import { IntegrationHub } from "@webmcp/core";
export type { IntegrationConfig, IntegrationEntry } from "@webmcp/core";

// Module-level singleton — survives across requests in the same Node.js process
const hub = new IntegrationHub();

export function getHub(): IntegrationHub {
  return hub;
}
