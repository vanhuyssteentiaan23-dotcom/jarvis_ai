async function request(path: string, init: RequestInit = {}) {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error("VERCEL_TOKEN is not configured");
  const response = await fetch(`https://api.vercel.com${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...(init.headers || {}) },
    cache: "no-store"
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Vercel ${response.status}: ${body.slice(0, 500)}`);
  return body ? JSON.parse(body) : {};
}

export async function createDeployment(projectId: string, teamId?: string, target: "production" | "preview" = "production") {
  const params = teamId ? `?teamId=${encodeURIComponent(teamId)}` : "";
  return request(`/v13/deployments${params}`, {
    method: "POST",
    body: JSON.stringify({ project: projectId, target })
  });
}
