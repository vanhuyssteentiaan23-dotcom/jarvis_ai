async function request(path: string, init: RequestInit = {}) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is not configured");
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
      ...(init.headers || {})
    },
    cache: "no-store"
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`GitHub ${response.status}: ${body.slice(0, 500)}`);
  return body ? JSON.parse(body) : {};
}

export async function createBranch(owner: string, repo: string, branch: string, fromSha: string) {
  return request(`/repos/${owner}/${repo}/git/refs`, {
    method: "POST",
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha: fromSha })
  });
}

export async function getBranch(owner: string, repo: string, branch: string) {
  return request(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
}

export async function updateFile(owner: string, repo: string, path: string, message: string, content: string, branch: string) {
  let sha: string | undefined;
  try {
    const current = await request(`/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}`);
    sha = current.sha;
  } catch {}
  return request(`/repos/${owner}/${repo}/contents/${path}`, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: Buffer.from(content).toString("base64"),
      branch,
      ...(sha ? { sha } : {})
    })
  });
}

export async function createPullRequest(owner: string, repo: string, title: string, body: string, head: string, base: string) {
  return request(`/repos/${owner}/${repo}/pulls`, {
    method: "POST",
    body: JSON.stringify({ title, body, head, base })
  });
}
