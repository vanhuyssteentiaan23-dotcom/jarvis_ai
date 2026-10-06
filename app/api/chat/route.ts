import { openai } from "@ai-sdk/openai";
import { generateText, tool } from "ai";
import { z } from "zod";

const system = `You are Jarvis, a personal AI operating system. Be concise, capable, and transparent.
You can answer normal questions. Use connected tools whenever the user asks about their actual GitHub/Vercel state.
Never claim an action happened unless a tool actually succeeded.
Current external tools are read-only. For future mutations (sending email, merging/deleting, production changes), require explicit confirmation before execution.`;

async function github(path: string) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is not configured");
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28"
    },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`GitHub returned ${response.status}`);
  return response.json();
}

async function vercel(path: string) {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error("VERCEL_TOKEN is not configured");
  const response = await fetch(`https://api.vercel.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store"
  });
  if (!response.ok) throw new Error(`Vercel returned ${response.status}`);
  return response.json();
}

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
            note: "External mutations are intentionally not exposed yet."
          })
        }),
        listGitHubRepositories: tool({
          description: "List the user's accessible GitHub repositories. Use for questions about available repos/projects.",
          inputSchema: z.object({}),
          execute: async () => {
            const data = await github("/user/repos?per_page=30&sort=updated");
            return data.map((repo: any) => ({
              name: repo.full_name,
              private: repo.private,
              defaultBranch: repo.default_branch,
              url: repo.html_url,
              updatedAt: repo.updated_at
            }));
          }
        }),
        getGitHubRepository: tool({
          description: "Inspect a specific GitHub repository. Use owner/repo format.",
          inputSchema: z.object({ owner: z.string(), repo: z.string() }),
          execute: async ({ owner, repo }) => {
            const data = await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
            return {
              name: data.full_name,
              description: data.description,
              private: data.private,
              defaultBranch: data.default_branch,
              stars: data.stargazers_count,
              openIssues: data.open_issues_count,
              url: data.html_url,
              updatedAt: data.updated_at
            };
          }
        }),
        listVercelProjects: tool({
          description: "List Vercel projects. Use when the user asks what is deployed or what projects they have.",
          inputSchema: z.object({ limit: z.number().min(1).max(50).default(20) }),
          execute: async ({ limit }) => {
            const data = await vercel(`/v9/projects?limit=${limit}`);
            return data.projects.map((project: any) => ({
              name: project.name,
              id: project.id,
              framework: project.framework,
              url: project.targets?.production?.alias?.[0] ? `https://${project.targets.production.alias[0]}` : null,
              updatedAt: project.updatedAt
            }));
          }
        }),
        listVercelDeployments: tool({
          description: "List recent Vercel deployments. Use when the user asks about recent deployments or deployment status.",
          inputSchema: z.object({
            projectId: z.string().optional(),
            limit: z.number().min(1).max(20).default(10)
          }),
          execute: async ({ projectId, limit }) => {
            const query = new URLSearchParams({ limit: String(limit) });
            if (projectId) query.set("projectId", projectId);
            const data = await vercel(`/v6/deployments?${query.toString()}`);
            return data.deployments.map((deployment: any) => ({
              id: deployment.uid,
              project: deployment.name,
              state: deployment.readyState,
              url: deployment.url ? `https://${deployment.url}` : null,
              target: deployment.target,
              createdAt: deployment.createdAt,
              commit: deployment.meta?.githubCommitSha ?? null,
              branch: deployment.meta?.githubCommitRef ?? null
            }));
          }
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
