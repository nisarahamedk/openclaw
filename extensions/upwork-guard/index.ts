/**
 * Upwork Guard Plugin
 *
 * Blocks web_fetch for upwork.com URLs and nudges users to use upwork-cli instead.
 */

import type { ClawdbotPluginApi } from "clawdbot/plugin-sdk";

export default function upworkGuardPlugin(api: ClawdbotPluginApi) {
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
}
