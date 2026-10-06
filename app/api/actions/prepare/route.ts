import { stageAction } from "@/lib/action-types";
import { z } from "zod";

const schema = z.object({
  kind: z.enum(["github_create_branch", "github_create_file", "github_create_pr", "vercel_deploy", "email_send"]),
  title: z.string(),
  description: z.string(),
  risk: z.enum(["low", "medium", "high"]),
  input: z.record(z.string(), z.unknown())
});

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    return Response.json({ action: stageAction(parsed.data) });
  } catch {
    return Response.json({ error: "Could not prepare action" }, { status: 500 });
  }
}
