# LISA Lite

A serverless application that lets users upload Markdown documents and ask natural-language questions across them, with every answer backed by direct, verifiable citations to the source text. Built on TanStack Start, AWS Lambda, S3, SQS, Postgres (pgvector), OpenAI embeddings, and Claude.

## Project Definition and Overall Description

This project implements a retrieval-augmented question-answering system over user-uploaded Markdown documents. Uploaded files are parsed into a structural tree (headings, paragraphs, lists, code blocks, tables), split into context-preserving chunks, and embedded for semantic search. A hybrid retrieval step (semantic + keyword) finds relevant passages for a question, and an LLM generates an answer grounded strictly in those passages, with every citation resolved against stored metadata rather than trusted from the model's own output.

The system is designed around a specific risk: that a document-QA assistant can sound confident while being wrong, or silently fail to process content it claims to have indexed. Several of this project's design choices — citation verification, confidence labeling, explicit abstention, and failure-tracked ingestion — exist specifically to make that risk visible rather than to claim it is eliminated.

Documents are ingested asynchronously, since a single ingestion run (parsing, chunking, and generating one embedding per chunk) can take from under a second to several minutes depending on document size, and a 300,000-word document was measured taking ~377 seconds — well past what a single synchronous HTTP request should hold open.

## Architecture Overview

### Main Application (TanStack Start on Lambda)

Serves the web UI and handles two kinds of requests: generating presigned S3 upload URLs (and creating the corresponding database row), and answering chat questions via the retrieval + generation pipeline. Deployed as a single Lambda function behind a Lambda Function URL.

### Ingestion Worker (separate Lambda)

A second, independent Lambda function, triggered by SQS messages rather than HTTP. For each document, it fetches the raw file from S3, parses and chunks it, generates an OpenAI embedding per chunk, and writes chunks to Postgres. It only marks a document `ready` if every chunk was processed successfully; any failure — including a failure before chunking even begins — marks the document `failed` rather than leaving it in an ambiguous state.

### S3 (Original File Storage)

Stores uploaded `.md` files exactly as submitted. The main app never touches file bytes directly for uploads — the browser uploads straight to S3 using a short-lived presigned URL, so large files never pass through Lambda's request/response cycle.

### Postgres + pgvector (Neon)

Stores two things: a `documents` table tracking filename, S3 key, and status (`uploaded` / `ready` / `failed`), and a `chunks` table holding each chunk's text, heading breadcrumb, original line range, document foreign key, and a 1536-dimension embedding vector. Chosen over AWS RDS specifically to avoid VPC/networking setup that would have added real time cost without teaching anything central to this assignment — a deliberate scope tradeoff, documented as such.

### SQS (Ingestion Queue)

Decouples "a file was uploaded" from "a file is processed." The main app sends one message per upload; the worker Lambda is invoked automatically by an SQS event source mapping. Queue visibility timeout is set to exceed the worker's Lambda timeout, as AWS requires, to avoid duplicate processing of a message still being handled.

### Retrieval (Hybrid Search)

Two independent queries run per question: a pgvector cosine-distance search over embeddings (semantic similarity), and a Postgres full-text search (`tsvector`/`tsquery`) for exact term matches. Results are merged, with chunks found by both methods flagged as more strongly corroborated. This exists because embeddings alone are unreliable for exact names, IDs, and numbers — confirmed directly in this project's own evaluation (see `EVALUATION.md`).

### Generation and Citation Verification (Claude)

The retrieved chunks are passed to Claude with an explicit system prompt instructing it to treat chunk content as untrusted data (not as instructions), to answer only from the provided passages, to surface rather than silently resolve conflicting information, and to abstain with a specific phrase when evidence is insufficient. After generation, the application — not the model — resolves every citation marker back to the actual retrieved chunk's stored metadata, and runs a word-overlap heuristic to flag citations whose claimed content doesn't clearly match the source text.

## Hallucination Controls and Confidence

- **Abstention**: the model is instructed to respond with a specific phrase when passages don't support an answer. Verified directly against a question with no supporting evidence in the corpus.
- **Conflict surfacing**: the system prompt instructs the model to explicitly present disagreeing passages rather than picking one. Verified directly against a document containing two contradictory procedures.
- **Prompt injection resistance**: document content is explicitly framed as untrusted in the system prompt. Verified directly against a document containing a hidden instruction attempting to hijack the model's behavior.
- **Citation resolution**: citation numbers are mapped back to real, stored chunk metadata server-side; a citation pointing outside the retrieved set is flagged invalid rather than trusted.
- **Confidence labeling** (`well supported` / `partially supported` / `unsupported`): derived from citation validity and cross-method retrieval agreement, not from the model's self-reported confidence or raw vector similarity, per the assignment's explicit caution against presenting either as a calibrated probability.

None of these controls are claimed to eliminate hallucination. The evaluation in `EVALUATION.md` documents two real false-negative abstentions found during testing, where a correct answer existed in the corpus but retrieval failed to surface it — a retrieval limitation, not a claim the system is immune to failure.

## Observability and Evaluation

`EVALUATION.md` contains 18 questions run against a corpus of 8 documents (5 in the required 25,000–300,000 word range, including one at 305,764 words), covering exact-detail lookups, table and code-block content, multi-passage and multi-document questions, conflicting information, no-evidence questions, and a prompt injection attempt. It reports retrieval hit rate, citation accuracy, abstention quality, and measured ingestion performance, and documents every known limitation discovered during testing, including a retrieval degradation issue, a quote-verification heuristic's false-negative rate, and an intermittent, unresolved SQS delivery gap.

## Known Limitations

- **Retrieval degrades as corpus size grows.** With a fixed top-k of 5 per search method, two genuine questions were incorrectly abstained on once the corpus reached 12+ documents, because the correct chunk was crowded out by superficially similar content from other documents.
- **The quote-support heuristic is word-overlap based, not semantic**, and produces false negatives on markdown with multiple adjacent citation markers or list structure.
- **Automatic SQS-triggered ingestion is intermittently unreliable** for reasons not fully diagnosed; manually re-triggering ingestion reliably succeeds. Most likely cause: presigned upload URLs (5-minute expiry) expiring during long interactive sessions, causing a silent upload failure that only surfaces as a `NoSuchKey` error at ingestion time.
- **Chunking is sized by character count against an ~800-character target**, not token count; very dense content (e.g. minified code) could produce chunks with more tokens than expected.
- **No authentication and no multi-user isolation**, per the assignment's explicit scope — this is a shared demonstration environment.

## Technology Stack

- **TanStack Start**: full-stack React framework, deployed via the Nitro `aws-lambda` preset
- **AWS Lambda**: hosts both the main application and the ingestion worker as two separate functions
- **AWS S3**: original file storage and static asset hosting
- **AWS SQS**: ingestion queue, decoupling upload from processing
- **Neon (Postgres + pgvector)**: document/chunk metadata and vector search
- **OpenAI `text-embedding-3-small`**: chunk and query embeddings (1536 dimensions)
- **Anthropic Claude (Sonnet 5.5)**: answer generation
- **remark / remark-gfm**: Markdown parsing into an AST, including GitHub-flavored tables

## Running Locally

### Prerequisites

- Node.js 22+
- An AWS account with CLI access configured
- A Neon (or other Postgres + pgvector) database
- An OpenAI API key
- An Anthropic API key

### Setup

1. Clone the repository and run `npm install`.
2. Create a `.env` file with:
   ```
   DATABASE_URL=postgresql://...
   OPENAI_API_KEY=sk-...
   ANTHROPIC_API_KEY=sk-ant-...
   ```
3. Run the database setup scripts to create the `documents` and `chunks` tables and enable `pgvector`: `node --env-file=.env scripts/setup-chunks-table.ts` and `node --env-file=.env scripts/setup-pgvector.ts`.
4. Start the dev server: `npm run dev`.

### Deployment

1. Create an S3 bucket and apply a public-read bucket policy scoped to `/assets/*`, plus a CORS configuration allowing `GET`, `PUT`, and `POST` from any origin (see `bucket-policy.json`, `cors-config.json`).
2. Create an IAM role with S3 read/write, SQS receive/delete, and CloudWatch Logs permissions.
3. Build and deploy the main app: `npm run build`, sync `.output/public` to S3, zip `.output/server`, and `aws lambda update-function-code`.
4. Bundle and deploy the worker separately with `esbuild` (CommonJS output — ESM bundling of the AWS SDK fails at runtime): `npx esbuild worker.ts --bundle --platform=node --target=node22 --outfile=worker-dist/index.js --format=cjs`.
5. Create an SQS queue and an event source mapping to the worker Lambda; set the queue's visibility timeout to exceed the worker's Lambda timeout.
6. Set `DATABASE_URL`, `OPENAI_API_KEY`, and `ANTHROPIC_API_KEY` as environment variables on both Lambda functions.
7. Create a Lambda Function URL with `auth-type NONE` and grant both `lambda:InvokeFunctionUrl` and `lambda:InvokeFunction` permissions (both are required as of a 2025 platform change).

### Running the Evaluation

The evaluation corpus is generated by `scripts/generate-large-doc.ts` (the 300k-word stress-test document) and `scripts/generate-eval-docs.ts` (four additional 25k–30k word documents). Upload each via the chat UI, or register and ingest directly with `node --env-file=.env scripts/insert-eval-docs.ts` followed by `node --env-file=.env scripts/ingest-batch.ts <id1> <id2> ...`. The 18 evaluation questions and expected answers are recorded in `EVALUATION.md`, run manually against the deployed chat interface.

## Repository Structure

```
.
├── src/
│   ├── routes/
│   │   ├── index.tsx        # Main UI: upload, document list, chat; also hosts the
│   │   │                    #   getUploadUrl, getDocuments, and askQuestion server functions
│   │   └── __root.tsx
│   ├── chunker.ts           # Markdown parsing (AST) and structure-aware chunking
│   ├── hybridSearch.ts      # Semantic (pgvector) + keyword (full-text) retrieval
│   ├── generate.ts          # Generation, citation verification, confidence scoring
│   ├── worker.ts            # Ingestion worker — a separate Lambda, triggered by SQS
│   └── router.tsx
├── scripts/
│   ├── ingest.ts                # Run ingestion directly for one document ID
│   ├── ingest-batch.ts          # Run ingestion for several document IDs in sequence
│   ├── setup-chunks-table.ts    # Create the chunks table
│   ├── setup-pgvector.ts        # Enable the pgvector extension, add the embedding column
│   ├── insert-eval-docs.ts      # Register the generated eval documents in the database
│   ├── generate-large-doc.ts    # Reproducibly generates the 300k-word stress-test document
│   ├── generate-eval-docs.ts    # Reproducibly generates the four 25k-30k word eval documents
│   ├── test-chunker.ts          # Quick manual check of chunking output
│   └── test-generate.ts         # Quick manual check of retrieval + generation output
├── test-data/
│   ├── conflict-test.md     # Hand-written: two directly contradictory procedures
│   └── injection-test.md    # Hand-written: a hidden prompt-injection attempt
├── aws-policies/
│   ├── bucket-policy.json           # S3 public-read policy, scoped to /assets/*
│   ├── cors-config.json             # S3 CORS rules (GET/PUT/POST)
│   ├── trust-policy.json            # Lambda execution role trust policy
│   ├── s3-permissions-policy.json   # S3 read/write permissions for the execution role
│   └── sqs-permissions-policy.json  # SQS receive/delete permissions for the execution role
├── EVALUATION.md               # Evaluation questions, results, and metrics
├── AI_USAGE_AND_BACKGROUND.md  # Background and AI tool usage disclosure
└── README.md
```

The large generated test documents themselves (`large-test-doc.md`, `eval-doc-*.md`) are not committed — they're fully reproducible via `scripts/generate-large-doc.ts` and `scripts/generate-eval-docs.ts`.

## Costs (Observed)

Embeddings and generation together cost well under a few dollars across all development and evaluation testing in this project. Infrastructure (Lambda, S3, SQS, Neon free tier) stayed within free-tier limits at this usage scale. Exact per-request costs were not instrumented; see `EVALUATION.md` for the testing volume these figures are based on.
