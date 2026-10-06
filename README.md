# Jarvis AI

Personal AI assistant for controlling development, deployment, communication, and everyday workflows from a natural-language interface.

## Vision

Jarvis should let you say things like:

- "Deploy the latest main branch."
- "What failed on my last Vercel deployment?"
- "Fix the failing build and open a PR."
- "Create an issue for the login bug."
- "Send John an email saying the deployment is delayed."
- "What projects are currently deployed?"
- "Explain why this GitHub Actions run failed."
- "What should I work on today?"

The assistant should also handle ordinary questions in the same conversational interface, similar to Siri/Gemini, while gaining the ability to take actions through connected tools.

## Architecture

1. **Chat / voice interface**
   - Web chat first
   - Voice input/output as a later layer
   - Streaming responses

2. **Agent orchestrator**
   - Understand the user's intent
   - Decide whether to answer directly or call tools
   - Support multi-step tool workflows
   - Maintain conversation context

3. **Safety / approval layer**
   - Read-only actions can run automatically
   - Mutating actions should use confirmation policies
   - High-impact actions (delete, merge, production changes, sending external messages) require explicit confirmation unless the user has configured trusted automation rules
   - Show exactly what will happen before confirmation

4. **Tool layer**
   - GitHub
   - Vercel
   - Email
   - General web/search
   - Future integrations: calendar, reminders, smart home, etc.

5. **Memory / preferences**
   - User-specific preferences
   - Project aliases
   - Preferred deployment environments
   - Communication style
   - Persistent task/context state

6. **Observability**
   - Tool calls and results
   - Agent decisions
   - Errors
   - Audit trail for mutating actions

## Example interaction

User: "Jarvis, check my latest deployment."

Jarvis:
- Identifies the relevant Vercel project
- Fetches the latest deployment
- Summarizes status, commit, duration, and errors
- Offers a next action if something failed

User: "Fix it."

Jarvis:
- Inspects the deployment/build output
- Inspects the relevant GitHub code
- Proposes the smallest safe change
- Creates a branch and commit
- Opens a PR
- Reports the PR and deployment state

## Design principles

- Natural language first
- Tool calls are explicit and inspectable
- Prefer reversible actions
- Confirm destructive or externally visible actions
- Never expose secrets to the model or client
- Keep provider-specific integrations behind a common tool interface
- Every action should have a clear success/failure result
