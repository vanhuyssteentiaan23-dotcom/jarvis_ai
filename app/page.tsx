'use client';

import { FormEvent, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

const suggestions = ["What can you do with my GitHub?", "Show me my latest deployment", "Deploy Jarvis to production"];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Good afternoon. I’m Jarvis. Ask me anything, or ask me to inspect and manage your GitHub and Vercel projects." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState<string | null>(null);

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next); setInput(""); setLoading(true);
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages: next }) });
      const data = await response.json();
      setMessages((current) => [...current, { role: "assistant", content: data.text ?? data.error ?? "I couldn't complete that request." }]);
    } catch {
      setMessages((current) => [...current, { role: "assistant", content: "I couldn't reach the Jarvis backend." }]);
    } finally { setLoading(false); }
  }

  async function executeAction(actionId: string) {
    setExecuting(actionId);
    try {
      const response = await fetch("/api/actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ actionId }) });
      const data = await response.json();
      setMessages((current) => [...current, { role: "assistant", content: data.ok ? `Action completed successfully. ${data.result?.url ? data.result.url : ""}` : `Action failed: ${data.error}` }]);
    } catch {
      setMessages((current) => [...current, { role: "assistant", content: "I couldn't execute that action." }]);
    } finally { setExecuting(null); }
  }

  function renderContent(content: string) {
    const match = content.match(/ACTION_CONFIRM:([a-f0-9-]+)/);
    if (!match) return <p>{content}</p>;
    const clean = content.replace(match[0], "").trim();
    return <><p>{clean || "I’ve prepared the requested action. Review it and approve it to continue."}</p><div className="approval"><div><b>Approval required</b><span>Jarvis is ready to execute this external change.</span></div><button disabled={executing === match[1]} onClick={() => executeAction(match[1])}>{executing === match[1] ? "Executing…" : "Approve & execute"}</button></div></>;
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="orb" /> JARVIS</div>
        <div className="status"><span /> SYSTEM ONLINE</div>
        <nav><div className="navItem active">Command Center</div><div className="navItem">Projects</div><div className="navItem">Activity</div><div className="navItem">Connections</div></nav>
        <div className="sideFooter"><div className="connection"><b>GitHub</b><span>Connected</span></div><div className="connection"><b>Vercel</b><span>Connected</span></div><div className="connection"><b>Email</b><span>Next</span></div></div>
      </aside>
      <section className="chat">
        <header className="topbar"><div><div className="eyebrow">PERSONAL AI OPERATING SYSTEM</div><h1>Command Center</h1></div><div className="avatar">V</div></header>
        <div className="conversation">
          <div className="welcome"><div className="bigOrb" /><p className="eyebrow">READY FOR COMMAND</p><h2>What should I take care of?</h2><p>Ask naturally. Jarvis can reason across your apps, inspect what is happening, and execute approved actions.</p></div>
          <div className="messages">
            {messages.map((message, index) => <div className={message.role === "user" ? "message user" : "message assistant"} key={index}>{message.role === "assistant" && <span className="miniOrb" />}<div><div className="messageRole">{message.role === "user" ? "YOU" : "JARVIS"}</div>{renderContent(message.content)}</div></div>)}
            {loading && <div className="message assistant"><span className="miniOrb" /><div><div className="messageRole">JARVIS</div><p className="typing">Thinking…</p></div></div>}
          </div>
          <div className="suggestions">{suggestions.map((suggestion) => <button key={suggestion} onClick={() => setInput(suggestion)}>{suggestion}</button>)}</div>
          <form className="composer" onSubmit={sendMessage}><textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask Jarvis anything…" rows={1} /><button type="submit" disabled={loading || !input.trim()}>↑</button></form>
          <div className="hint">Enter to send · External changes always require your approval.</div>
        </div>
      </section>
    </main>
  );
}
