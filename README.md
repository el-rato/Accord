# Accord

Brand review and revision approval for Team Noct's CodeAxis submission.

Accord checks campaign content against versioned brand references. Creators inspect source-linked findings, save corrections and submit a revision for a human decision. Release verifies the exact content hash and downloads approved copy, original files and an evidence receipt.

## Deploy on Vercel

1. Import **el-rato/Accord** into Vercel. Choose **Next.js**, repository root `./`, Node.js **22.x**. Keep the default output directory and use `npm run build`.
2. In the project's **Storage** section, connect a **Neon Postgres** database. Ensure it provides `DATABASE_URL` to the deployment environment. Accord creates its `accord_workspaces` table on first use; the database role needs permission to create it.
3. Connect a **private Vercel Blob store** to the same project. Use its `BLOB_STORE_ID` with Vercel OIDC, or its server-only `BLOB_READ_WRITE_TOKEN`. Do not create a public store for these files.
4. Add `GEMINI_API_KEY` when ready. It is optional: fixed rules and human review work without it. `GEMINI_MODEL` defaults to `gemini-3.8-flash`.
5. Redeploy after connecting storage or changing environment variables. Set the variables in Production and any Preview environment you intend to test.

The app now uses **standard Next.js**, not Vinext or a Cloudflare Worker. Do not select Vite, configure `dist/` as output, or use the old Sites build command. The original Sites deployment is separate and is not updated by Vercel deployments.

`vercel.json` declares the framework and build command. No credentials belong in that file, browser code or a `NEXT_PUBLIC_` variable. `.env.example` lists names only; local environment files and `.vercel/` are ignored.

Without `DATABASE_URL` on Vercel the workspace endpoint returns an explicit setup error. It never silently switches deployed visitors to temporary filesystem storage. Without a private Blob connection, text review still works but uploads report the missing storage configuration.

Existing Cloudflare demo records are **not migrated** automatically. Vercel visitors receive fresh isolated demo workspaces. The legacy Sites/Vite scaffolding remains in the repository for reference; the Next.js commands and active API routes do not use it.

## Run locally

```sh
npm ci
npm run dev
```

Open `http://127.0.0.1:3000`. Node.js 22.13+ is required. PDF.js's worker is already included; the production build also copies it from the installed package.

For local development without service credentials, workspaces and originals persist under ignored `.accord-data/`. Workspace writes use an atomic file replacement and a per-workspace lock. This adapter is disabled on Vercel. To test hosted services locally, configure the relevant environment variables in ignored `.env.local`; Next.js loads them automatically. For OIDC Blob access locally, use Vercel's supported environment pull/auth flow or a local read/write token.

Uploads are capped at **4 MB per original** so multipart requests stay below the Vercel Functions request limit. Text-based PDFs support up to 20 pages and 14,000 extracted characters. The server checks file signatures rather than trusting the supplied extension.

## Try the complete workflow

1. Choose **Review sample** and **Run checks**.
2. Expand a finding's cited source. Try submitting the unchanged draft: blockers prevent it.
3. Make edits or use **Use corrected example**, then **Save revision** and run checks again.
4. **Submit for approval** and choose **Reviewer · demo** in the top bar.
5. **Approve revision**, enter a decision note and confirm inspection of the coverage gaps.
6. **Verify & export** downloads the exact approved package. Editing the content or changing a reference invalidates the approval.

Each browser session has a separate persisted workspace. Lumen is fictional. Persona switching is a demonstration of workflow permissions, **not authentication of distinct employees**.

## Completed features

- Campaign purpose, audience, channel and saved revisions.
- Versioned, reviewer-editable brand references with captured source snapshots.
- Discount, eligibility, expiry, qualification, terminology and unsupported-promise pattern checks.
- Image text supplied by the creator, PDF text extracted locally, and cross-item discount comparisons.
- Declared logo-version checks, alternative-text presence and supplied-colour contrast measurement.
- Private original uploads and session-checked retrieval.
- Explanations, suggested edits, comments, revision comparisons, request-changes decisions and reasoned dismissals.
- Human approval tied to the exact SHA-256 content hash and reference version.
- Server-verified ZIP export containing approved copy, original files and evidence/audit JSON.
- Issue-category insights, rule disagreements and bounded activity history.
- Optional Gemini contextual review with structured response validation and explicit incomplete coverage on failure.

## Implementation

React 19 and TypeScript run in Next.js App Router. Server route handlers validate actions with Zod. Neon Postgres stores bounded workspace snapshots; conditional version updates reject stale writes atomically. A random 256-bit HttpOnly session cookie is hashed before database lookup. Private Vercel Blob objects are prefixed with that hashed workspace key; browsers receive only session-checked application file URLs.

`lib/storage.ts` contains hosted storage and the development adapter. `lib/store.ts` owns session lookup and persistence. `lib/review.ts` implements checks. `app/api/` enforces the workflow. `app/accord-app.tsx` and `app/accord.css` implement the product interface. The UI uses existing components and icons, system typography, a compact campaign register and a source-reference desk.

Fixed checks run before Gemini. The server sends submitted text, declared creative text and active references to Google, not original image bytes. Structured findings must use valid source IDs and excerpts present in the submitted content. A single invalid finding rejects the entire model batch. Blocked/truncated generations, bad citations, invented excerpts and provider errors leave contextual coverage incomplete. Model output never grants approval.

Gemini has not been verified live without the participant's API key. Mocked transport tests establish request/validation behaviour only.

## Verify

```sh
npm run typecheck
npm test
npm run build
# With the local server running:
npm run test:workflow
```

Set `ACCORD_TEST_URL` to test a configured hosted deployment. Workflow tests create their own disposable sessions and inspect review, approval, release, stale writes, origin checks, file isolation and ZIP bytes. Unit tests cover rules, hashes, source snapshots and Gemini failure handling.

## Changes from the proposal

The original proposal used Next.js/FastAPI, PostgreSQL and server extraction. Round 2 initially used a single Vinext Worker with D1/R2. This revision moves the running application to **Next.js + Neon + private Vercel Blob** for Vercel deployment. The data model, source-backed findings and approval semantics are retained. The UI removes promotional slogans and illustration panels in favour of a quieter working interface.

PDF.js replaces PyMuPDF. Automatic image OCR/logo recognition remains deferred in favour of clearly labelled declarations and human inspection. Real employee invitations and independent role authentication remain Round 3 work. Gemini replaces the originally proposed OpenAI provider at the participant's request.

## Three substantive Round 3 improvements

1. **Authenticated collaboration and independent approvals:** real membership, invitations, assignments and revocation; creators cannot grant themselves approval rights.
2. **Automated multimodal evidence collection:** OCR regions, supported logo recognition and annotated findings; native document/slide extraction and labelled quality evaluation.
3. **Connected publishing and evidence lifecycle checks:** CMS publishing of the approved hash, scheduled release cancellation after edits/reference changes/expiry, and duplicate delivery handling.

## Boundaries

Use fictional material in this event demo. Session isolation is implemented; organisation memberships, enterprise retention/deletion and an immutable compliance ledger are not. Session cookies expire after seven days, but stored records are not automatically purged then. Image metadata does not establish automatic visual recognition or full accessibility compliance. Contextual findings remain subject to human judgement.

## References

- [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs)
- [Neon serverless driver](https://neon.com/docs/serverless/serverless-driver)
- [Private Vercel Blob](https://vercel.com/docs/vercel-blob/using-blob-sdk)
- [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/generate-content/structured-output)
- [WCAG 2.2](https://www.w3.org/TR/WCAG22/)
