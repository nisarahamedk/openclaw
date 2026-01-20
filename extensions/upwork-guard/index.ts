/**
 * Upwork Guard Plugin
 *
 * Blocks web_fetch for upwork.com URLs and nudges users to use upwork-cli instead.
 */

import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";
import { emptyPluginConfigSchema } from "clawdbot/plugin-sdk";

const plugin = {
  id: "upwork-guard",
  name: "Upwork Guard",
  description: "Blocks upwork.com web fetches and nudges to use upwork-cli.",
  configSchema: emptyPluginConfigSchema(),
  register(api: ClawdbotPluginApi) {
    api.on("before_tool_call", async (event, ctx) => {
      if (ctx.agentId === "upwork-coach" && event.toolName === "web_fetch") {
        const url = event.params?.url as string;
        if (url && /upwork\.com/i.test(url)) {
          return {
            block: true,
            blockReason: "For fetching jobs from upwork, use upwork-cli instead.",
          };
        }
      }
    });
  },
};

export default plugin;
