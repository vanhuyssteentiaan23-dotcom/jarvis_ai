import { consumeAction } from "@/lib/action-types";
import { createBranch, createPullRequest, updateFile, getBranch } from "@/lib/providers/github";
import { createDeployment } from "@/lib/providers/vercel";

export async function POST(request: Request) {
  try {
    const { actionId } = await request.json();
    if (!actionId) return Response.json({ error: "Missing actionId" }, { status: 400 });

    const action = consumeAction(actionId);
    if (!action) return Response.json({ error: "Action expired or already executed." }, { status: 404 });

    const input = action.input as any;

    if (action.kind === "github_create_branch") {
      const branch = await getBranch(input.owner, input.repo, input.base);
      const result = await createBranch(input.owner, input.repo, input.branch, branch.object.sha);
      return Response.json({ ok: true, result: { branch: input.branch, ref: result.ref } });
    }

    if (action.kind === "github_create_file") {
      const result = await updateFile(input.owner, input.repo, input.path, input.message, input.content, input.branch);
      return Response.json({ ok: true, result: { path: result.content?.path, commit: result.commit?.sha } });
    }

    if (action.kind === "github_create_pr") {
      const result = await createPullRequest(input.owner, input.repo, input.title, input.body, input.head, input.base);
      return Response.json({ ok: true, result: { number: result.number, url: result.html_url } });
    }

    if (action.kind === "vercel_deploy") {
      const result = await createDeployment(input.projectId, input.teamId, input.target || "production");
      return Response.json({ ok: true, result: { id: result.id, url: result.url, state: result.readyState } });
    }

    return Response.json({ error: "Unsupported action" }, { status: 400 });
  } catch (error) {
    console.error(error);
    return Response.json({ error: error instanceof Error ? error.message : "Action failed" }, { status: 500 });
  }
}
