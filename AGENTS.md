# Together Insights agent workflow

Preserve the user's selected lead model and reasoning level. The lead coordinates
implementation, integration, verification, and deployment. The user has requested
the orchestration approach used in Bright Unified.

- Use no subagents for trivial or dependent work. Delegate substantial independent
  implementation or review when it reduces total work or improves verification.
- Default to one subagent; use two or three only for distinct workstreams with
  separate file ownership. Maximum three concurrent subagents including descendants.
- Give each agent a bounded deliverable, owned files, constraints, and acceptance
  checks. Prefer concise context. Do not duplicate a completed investigation.
- Lead work must complement delegated work. The lead owns final integration and
  deployment and waits for required verification before declaring completion.
- Use the smallest sufficient available model: GPT-5.6 Luna low/medium for narrow
  extraction; GPT-5.6 Terra medium/high for implementation and tests; GPT-5.6 Sol
  high for complex review; GPT-6 Astra high/xhigh for difficult architecture or
  unresolved consequential bugs. Keep max/ultra for explicit requests.
- Reuse passing evidence for unchanged work. Test changed behavior and material
  risks. Distinguish browser emulation from physical Android/iOS testing.
- Never print, commit, or bundle SMTP passwords or privileged Supabase keys.
  Only the public Supabase URL and publishable key belong in browser builds.
- Preserve user changes. If workspace permissions require a staging copy,
  synchronize reviewed files to the requested repository before committing and deploying.
- Do not modify Bright Unified; it is a reference for this workflow only.
