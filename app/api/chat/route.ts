import { openai } from "@ai-sdk/openai";
import { generateText, tool } from "ai";
import { z } from "zod";
import { stageAction } from "@/lib/action-types";

const system = `You are Jarvis, a personal AI operating system. Be concise, capable, and transparent.
You can answer normal questions. Use connected tools whenever the user asks about their actual GitHub/Vercel state.
Never claim an action happened unless a tool actually succeeded.
For external mutations, NEVER execute them directly. Prepare a confirmation action instead.
When a preparation tool returns ACTION_CONFIRM:<id>, preserve that exact token in your response on its own line.`;

async function github(path: string) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is not configured");
  const r = await fetch(`https://api.github.com${path}`, { headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }, cache: "no-store" });
  if (!r.ok) throw new Error(`GitHub returned ${r.status}`);
  return r.json();
}
async function vercel(path: string) {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error("VERCEL_TOKEN is not configured");
  const r = await fetch(`https://api.vercel.com${path}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
  if (!r.ok) throw new Error(`Vercel returned ${r.status}`);
  return r.json();
}

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();
    if (!Array.isArray(messages)) return Response.json({ error: "Invalid messages" }, { status: 400 });
    if (!process.env.OPENAI_API_KEY) return Response.json({ text: "I’m online, but OPENAI_API_KEY is not configured yet." });

    const result = await generateText({
      model: openai(process.env.JARVIS_MODEL || "gpt-5-mini"),
      system,
      messages,
      tools: {
        getSystemStatus: tool({
          description: "Return Jarvis integration readiness.",
          inputSchema: z.object({}),
          execute: async () => ({ github: Boolean(process.env.GITHUB_TOKEN), vercel: Boolean(process.env.VERCEL_TOKEN), email: Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL) })
        }),
        listGitHubRepositories: tool({
          description: "List accessible GitHub repositories.",
          inputSchema: z.object({}),
          execute: async () => (await github("/user/repos?per_page=30&sort=updated")).map((r: any) => ({ name: r.full_name, private: r.private, defaultBranch: r.default_branch, url: r.html_url }))
        }),
        getGitHubRepository: tool({
          description: "Inspect a GitHub repository.",
          inputSchema: z.object({ owner: z.string(), repo: z.string() }),
          execute: async ({ owner, repo }) => {
            const r = await github(`/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`);
            return { name: r.full_name, description: r.description, defaultBranch: r.default_branch, openIssues: r.open_issues_count, url: r.html_url, updatedAt: r.updated_at };
          }
        }),
        listVercelProjects: tool({
          description: "List Vercel projects.",
          inputSchema: z.object({ limit: z.number().min(1).max(50).default(20) }),
          execute: async ({ limit }) => (await vercel(`/v9/projects?limit=${limit}`)).projects.map((p: any) => ({ name: p.name, id: p.id, framework: p.framework, url: p.targets?.production?.alias?.[0] ? `https://${p.targets.production.alias[0]}` : null }))
        }),
        listVercelDeployments: tool({
          description: "List recent Vercel deployments.",
          inputSchema: z.object({ projectId: z.string().optional(), limit: z.number().min(1).max(20).default(10) }),
          execute: async ({ projectId, limit }) => {
            const q = new URLSearchParams({ limit: String(limit) }); if (projectId) q.set("projectId", projectId);
            return (await vercel(`/v6/deployments?${q}`)).deployments.map((d: any) => ({ id: d.uid, project: d.name, state: d.readyState, url: d.url ? `https://${d.url}` : null, target: d.target, commit: d.meta?.githubCommitSha ?? null, branch: d.meta?.githubCommitRef ?? null }));
          }
        }),
        prepareVercelDeploy: tool({
          description: "Prepare a Vercel deployment for confirmation. Never execute it.",
          inputSchema: z.object({ projectId: z.string(), projectName: z.string(), teamId: z.string().optional(), target: z.enum(["production", "preview"]).default("production") }),
          execute: async ({ projectId, projectName, teamId, target }) => {
            const action = stageAction({ kind: "vercel_deploy", title: `Deploy ${projectName}`, description: `Deploy ${projectName} to ${target} on Vercel.`, risk: target === "production" ? "high" : "medium", input: { projectId, projectName, teamId, target } });
            return `ACTION_CONFIRM:${action.id}`;
          }
        }),
        prepareGitHubBranch: tool({
          description: "Prepare creation of a GitHub branch for confirmation. Never execute it.",
          inputSchema: z.object({ owner: z.string(), repo: z.string(), base: z.string(), branch: z.string() }),
          execute: async ({ owner, repo, base, branch }) => {
            const action = stageAction({ kind: "github_create_branch", title: `Create branch ${branch}`, description: `Create ${branch} from ${base} in ${owner}/${repo}.`, risk: "medium", input: { owner, repo, base, branch } });
            return `ACTION_CONFIRM:${action.id}`;
          }
        }),
        prepareGitHubFileChange: tool({
          description: "Prepare a GitHub file change for confirmation. Never execute it.",
          inputSchema: z.object({ owner: z.string(), repo: z.string(), branch: z.string(), path: z.string(), message: z.string(), content: z.string() }),
          execute: async (input) => {
            const action = stageAction({ kind: "github_create_file", title: `Change ${input.path}`, description: `Commit a change to ${input.path} on ${input.owner}/${input.repo}.`, risk: "high", input });
            return `ACTION_CONFIRM:${action.id}`;
          }
        }),
        prepareEmail: tool({
          description: "Prepare an email for explicit user approval. Never send it directly.",
          inputSchema: z.object({ to: z.array(z.string().email()).min(1).max(50), subject: z.string().min(1), text: z.string().min(1) }),
          execute: async ({ to, subject, text }) => {
            const action = stageAction({ kind: "email_send", title: `Send email: ${subject}`, description: `Send this email to ${to.length} recipient(s).`, risk: "high", input: { to, subject, text } });
            return `ACTION_CONFIRM:${action.id}`;
          }
        })
      },
      maxOutputTokens: 900
    });
    return Response.json({ text: result.text });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error instanceof Error ? error.message : "Jarvis backend error" }, { status: 500 });
  }
}
