import { openai } from "@ai-sdk/openai";
import { generateText, tool } from "ai";
import { z } from "zod";

const system = `You are Jarvis, a personal AI operating system. Be concise, capable, and transparent.
You can answer normal questions. When connected tools are available, use them for current information or actions.
Never claim an action happened unless a tool actually succeeded.
For actions that change external state (sending email, merging/deleting, production changes), explain the action and require explicit user confirmation before executing it.
Current MVP tools are intentionally read-only and limited to safe project/deployment inspection.`;

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();
    if (!Array.isArray(messages)) return Response.json({ error: "Invalid messages" }, { status: 400 });

    if (!process.env.OPENAI_API_KEY) {
      return Response.json({
        text: "I’m online, but the AI provider is not configured yet. Add OPENAI_API_KEY to this deployment, then I can become the full conversational Jarvis."
      });
    }

    const result = await generateText({
      model: openai(process.env.JARVIS_MODEL || "gpt-5-mini"),
      system,
      messages,
      tools: {
        getSystemStatus: tool({
          description: "Return Jarvis integration readiness. Use when the user asks what is connected or available.",
          inputSchema: z.object({}),
          execute: async () => ({
            github: Boolean(process.env.GITHUB_TOKEN),
            vercel: Boolean(process.env.VERCEL_TOKEN),
            email: Boolean(process.env.RESEND_API_KEY),
            note: "External mutations are intentionally not exposed in the MVP."
          })
        })
      },
      maxOutputTokens: 900
    });

    return Response.json({ text: result.text });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Jarvis backend error" }, { status: 500 });
  }
}