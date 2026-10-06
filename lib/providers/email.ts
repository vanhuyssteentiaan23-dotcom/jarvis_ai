export async function sendEmail(to: string[], subject: string, text: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!key) throw new Error("RESEND_API_KEY is not configured");
  if (!from) throw new Error("RESEND_FROM_EMAIL is not configured");

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, text })
  });

  const body = await response.text();
  if (!response.ok) throw new Error(`Email provider ${response.status}: ${body.slice(0, 500)}`);
  return body ? JSON.parse(body) : {};
}
