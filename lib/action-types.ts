export type ActionKind =
  | "github_create_branch"
  | "github_create_file"
  | "github_create_pr"
  | "vercel_deploy"
  | "email_send";

export type PendingAction = {
  id: string;
  kind: ActionKind;
  title: string;
  description: string;
  risk: "low" | "medium" | "high";
  input: Record<string, unknown>;
  createdAt: number;
};

const pending = new Map<string, PendingAction>();

export function stageAction(action: Omit<PendingAction, "id" | "createdAt">) {
  const id = crypto.randomUUID();
  const pendingAction = { ...action, id, createdAt: Date.now() };
  pending.set(id, pendingAction);
  return pendingAction;
}

export function getAction(id: string) {
  return pending.get(id);
}

export function consumeAction(id: string) {
  const action = pending.get(id);
  if (action) pending.delete(id);
  return action;
}
