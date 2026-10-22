# Accord

Round 2 implementation for the Inkloom AI brand-governance problem at CodeAxis. Built by Team Noct (solo participant).

Accord reviews a campaign against versioned, approved brand references. Creators can inspect cited findings, revise copy and send a specific revision for a human decision. Export is enforced on the server and includes the approved copy, original creative files and an audit receipt.

## Try the workflow

1. Open **Review the sample campaign**, then **Run checks**.
2. Expand a finding to inspect its source. Try submitting the unchanged draft: the server rejects its blocking issues.
3. Use individual edits or **Use corrected example**, then **Save revision** and **Run checks** again.
4. **Submit for approval**. Choose **Reviewer · demo** in the top bar.
5. **Approve revision**, write a decision note and explicitly confirm coverage. **Verify & export** downloads a ZIP.
6. Save another edit or update a brand reference: the old approval becomes invalid.

Each browser session receives a separate server-persisted sandbox. Lumen is fictional. Persona switching demonstrates workflow permissions; it is **not** authentication of distinct employees and does not provide production separation of duties.

## Implemented

- Campaign creation, intended purpose, audience and channel.
- Versioned brand references with reviewer-only changes and review invalidation.
- Rule checks for discount, plan scope, eligibility, expiry, unsupported-promise patterns, glossary spelling and pressure-language patterns.
- Creator-entered image text checked against captions; alternative-text presence, declared logo version and supplied-colour contrast checks.
- PNG/JPEG and text-based PDF uploads in private R2 storage. PDF.js extracts PDF text locally before submission. Scanned PDFs are rejected with an explanation.
- Findings with source snapshots, category, severity, blocking status and method.
- Local suggested edits, saved content revisions, before/after revision views, comments, request-changes decisions and reasoned dismissals.
- Server-enforced review/approval/release state transitions and SHA-256 approval binding.
- ZIP export containing exact copy, uploaded originals and JSON evidence/audit receipt. Missing originals fail the export.
- Category counts, rule-disagreement summaries and persisted activity history.
- Optimistic concurrency, same-origin mutation checks and session-bound file/data access.
- Optional server-side Gemini contextual review. **This is active only when a valid runtime key is configured. Without it, the UI says rules + human review; no AI result is fabricated.**

## Stack and data flow

- Next-compatible React/TypeScript app on Vinext/Vite and Cloudflare Workers through Sites.
- D1/SQLite with a Drizzle-managed schema. A bounded JSON workspace snapshot is written with a compare-and-swap version check, making a single workflow change atomic.
- R2 stores private original files under a hashed session prefix. A random 256-bit HttpOnly session cookie is hashed for database lookup; the raw token is not stored in the database or returned in JSON.
- Zod validates incoming actions. Server code decides permissions and approval transitions.
- The rule engine runs before optional contextual AI review. AI output is validated, including source IDs and verbatim excerpts, before findings are displayed. Model output never authorises release.
- SHA-256 covers content, purpose, channel, audience and asset metadata. Approvals also record the brand-pack version. Export rechecks these values and offer expiry.
- PDF.js extracts browser-local PDF text. `fflate` creates download archives. Lucide supplies UI icons; the interface uses ordinary CSS.

`app/accord-app.tsx` contains the UI; `app/api/` contains API routes; `lib/model.ts` defines domain records; `lib/review.ts` implements review; `lib/store.ts` handles D1/session access; `db/schema.ts` and `drizzle/` contain the schema and migrations.

## Run locally

Node 22.13+ is required. Use the committed npm lockfile.

```sh
npm ci
node scripts/prepare-pdf-worker.mjs
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_white_zaran.sql
npm run dev
```

Open the Local URL printed by the server (normally `http://127.0.0.1:5173`). This setup uses local D1/R2; deployed data is separate. The included Sites helpers maintain the host execution profile and deployment bindings.

For optional contextual AI review, configure `GEMINI_API_KEY` as a server-side runtime secret and optionally `GEMINI_MODEL` (default `gemini-3.8-flash`). Never use a `NEXT_PUBLIC_` key or commit secrets. See `.env.example` for names only. For local development, put these values in ignored `.env.local`. For the hosted demo, add the key through Sites runtime environment settings and redeploy a saved version; a local file does not configure the public app. The server calls the Gemini REST generateContent API with a JSON response schema, bounded output and a 35-second timeout. It sends submitted text, declared creative text and active references to Google; it does not send original image bytes. All findings are validated before any model result is accepted. Verify provider connectivity separately from mocked tests. No Gemini key is configured in the delivered demo yet; live provider verification is pending your later key setup.

## Verify

```sh
npm run typecheck
npm test
# With the local server running:
npm run test:workflow
# Against a deployed environment, if desired:
# ACCORD_TEST_URL=https://your-site.example npm run test:workflow
```

Unit tests cover rule behaviour, clean content, changing evidence, expiry, contrast, copied evidence, hashes and invalid model citations. The model-transport test is mocked; it is not evidence of a live provider call.

The API workflow test creates isolated disposable demo sessions and checks the complete review-to-export sequence, blocked transitions, workspace boundaries, origin enforcement, file persistence, stale approvals and concurrency. It does not modify another visitor's workspace.

## Changes from the Round 1 proposal

The product name is Accord. A single TypeScript Worker application replaces the planned Next.js/FastAPI split, and D1/R2 replace PostgreSQL/private object storage for the hosted event prototype. This removes a second deployment and keeps the core journey working in one environment. Evidence retrieval currently uses the small structured brand pack rather than embeddings. Contextual AI now uses Gemini instead of the originally planned OpenAI provider, following the participant's preference.

PDF.js replaces server-side PyMuPDF. Automated image OCR and logo recognition are deferred: the creator supplies visible image text, colour values and logo-version metadata, and the reviewer verifies them against the original. The interface labels this clearly. Real employee invitations and independent role authentication are also deferred; public demo personas make the workflow testable without inventing real team members.

## Three substantive Round 3 improvements

1. **Authenticated collaboration and separation of duties.** Invite real creators/managers/reviewers, enforce tenant membership and independent claim approval, and deliver reviewer assignments/notifications. Test that creators cannot grant themselves approval rights and that revoked users lose data access.
2. **Automated multimodal evidence collection.** OCR image regions, detect supported logo variants and annotate visual/accessibility findings on the original; add native DOCX/slide extraction. Record extraction confidence, request manual inspection when uncertain, and evaluate against labelled clean and problematic assets.
3. **Connected publishing with evidence lifecycle control.** Add a CMS publishing integration that releases only the approved hash, supports scheduled releases and cancels stale schedules after reference changes or expiry. Test duplicate webhooks, expired offers and changed drafts against a real test CMS.

## Honest limits

This public event demo is for fictional material. It is not ready for confidential production uploads. Session isolation is real; employee identity, enterprise retention policies and multi-user membership are not implemented. Sandbox cookies expire after seven days; hosted records are not automatically purged on that date. The activity log is bounded, not an immutable compliance ledger.

Rule checks are intentionally scoped to the seeded brand pack and are not universal truth detection. Creator-supplied image metadata is not automatic visual recognition. Contrast checks do not establish full WCAG conformance. AI availability is displayed separately and a provider failure remains visible as incomplete contextual coverage requiring human inspection.

## References

- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
- [OWASP: Prompt Injection](https://genai.owasp.org/llmrisk/llm01-prompt-injection/)
- [Google: Gemini structured outputs](https://ai.google.dev/gemini-api/docs/generate-content/structured-output)
