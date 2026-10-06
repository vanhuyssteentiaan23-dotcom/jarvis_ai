'use client';

import { FormEvent, useState } from "react";

type Message = { role: "user" | "assistant"; content: string };

const suggestions = [
  "What can you do with my GitHub?",
  "Show me my latest deployment",
  "Explain how Jarvis should work"
];

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Good afternoon. I’m Jarvis. I can answer questions, inspect your development stack, and—once integrations are configured—take actions for you."
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function sendMessage(event?: FormEvent) {
    event?.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const next = [...messages, { role: "user" as const, content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: next })
      });
      const data = await response.json();
      setMessages((current) => [...current, { role: "assistant", content: data.text ?? "I couldn't complete that request." }]);
    } catch {
      setMessages((current) => [...current, { role: "assistant", content: "I couldn't reach the Jarvis backend. Check the server configuration and try again." }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="shell">
      <aside className="sidebar">
        <div className="brand"><span className="orb" /> JARVIS</div>
        <div className="status"><span /> SYSTEM ONLINE</div>
        <nav>
          <div className="navItem active">Command Center</div>
          <div className="navItem">Projects</div>
          <div className="navItem">Activity</div>
          <div className="navItem">Connections</div>
        </nav>
        <div className="sideFooter">
          <div className="connection"><b>GitHub</b><span>Ready</span></div>
          <div className="connection"><b>Vercel</b><span>Ready</span></div>
          <div className="connection"><b>Email</b><span>Coming next</span></div>
        </div>
      </aside>

      <section className="chat">
        <header className="topbar">
          <div><div className="eyebrow">PERSONAL AI OPERATING SYSTEM</div><h1>Command Center</h1></div>
          <div className="avatar">V</div>
        </header>

        <div className="conversation">
          <div className="welcome">
            <div className="bigOrb" />
            <p className="eyebrow">READY FOR COMMAND</p>
            <h2>What should I take care of?</h2>
            <p>Ask naturally. Jarvis can eventually reason across your apps, inspect what is happening, and execute approved actions.</p>
          </div>

          <div className="messages">
            {messages.map((message, index) => (
              <div className={message.role === "user" ? "message user" : "message assistant"} key={index}>
                {message.role === "assistant" && <span className="miniOrb" />}
                <div><div className="messageRole">{message.role === "user" ? "YOU" : "JARVIS"}</div><p>{message.content}</p></div>
              </div>
            ))}
            {loading && <div className="message assistant"><span className="miniOrb" /><div><div className="messageRole">JARVIS</div><p className="typing">Thinking…</p></div></div>}
          </div>

          <div className="suggestions">
            {suggestions.map((suggestion) => <button key={suggestion} onClick={() => setInput(suggestion)}>{suggestion}</button>)}
          </div>

          <form className="composer" onSubmit={sendMessage}>
            <textarea value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask Jarvis anything…" rows={1} />
            <button type="submit" disabled={loading || !input.trim()}>↑</button>
          </form>
          <div className="hint">Enter to send · Your commands will require confirmation before high-impact actions.</div>
        </div>
      </section>
    </main>
  );
}