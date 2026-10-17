# LISA Lite

A serverless application that lets you upload Markdown documents and ask questions across them in plain language. Each answer is shown with citations that point to the source file, heading and line range. Built on TanStack Start, AWS Lambda, S3, SQS, Postgres with pgvector, OpenAI embeddings and Claude.

## Project Definition and Overall Description

Uploaded `.md` files are parsed into a structure (headings, paragraphs, lists, code blocks, tables), split into chunks that keep their heading path and original line range, and embedded for search. A question runs two searches, by vector similarity and by full-text matching, and the merged passages go to Claude with instructions to answer only from them. After generation, the application itself resolves each citation against the stored chunk. It does not trust file names, headings or line numbers written by the model.

The system is built around one risk: a document assistant can sound confident and be wrong, or silently fail to process content it claims to have indexed. Citation resolution, a support label, abstention, and ingestion that records success or failure per chunk exist to make that risk visible. They don't remove it, and the limitations below say where the system is known to be weak.

Ingestion is asynchronous because it is slow. Processing the 305,764-word test document took about 377 seconds, which is far too long to hold a browser request open.

## Architecture Overview

### Main application (TanStack Start on Lambda)

Serves the UI and two kinds of requests: creating a presigned S3 upload URL (plus the database row and the queue message), and answering questions. It runs as one Lambda function behind a Lambda Function URL. Only file names ending in `.md` are accepted, checked in the browser and again on the server. Conversation history lives in browser memory only, so a refresh clears it.

### Ingestion worker (a separate Lambda)

Triggered by SQS messages. For each document it fetches the file from S3, chunks it, requests an embedding for every chunk from OpenAI, and writes the chunks to Postgres. A document's status moves from `uploaded` to `processing` to `ready`. It becomes `ready` only if every chunk was stored. Any failure, including one before chunking begins (for example a missing S3 object), marks it `failed`. Before inserting, the worker deletes the document's existing chunks, so re-running or re-delivering a message does not duplicate them. Two runs on the same document at the same time can still duplicate chunks (see Known Limitations).

### S3

Stores uploaded files exactly as submitted. The browser uploads directly to S3 with a presigned URL that expires after 5 minutes, so file bytes never pass through Lambda. The same bucket serves the built static assets.

### Postgres and pgvector (Neon)

A `documents` table (filename, S3 key, status) and a `chunks` table (text, heading path, start and end line, document id, and a 1536-dimension embedding). I chose Neon over AWS RDS to avoid VPC and networking setup that would not have taught anything central to this assignment. Neon's pooled connection string also helps with the many short-lived Lambda connections.

### SQS

Decouples an upload from its processing. The queue's visibility timeout (900 s) is longer than the worker's timeout (600 s), as AWS requires, so a message still being processed is not delivered again.

### Retrieval

Two queries per question: a pgvector cosine-distance search and a Postgres full-text search, 5 results each, merged and de-duplicated. A chunk found by both methods is marked as such. Only chunks from `ready` documents are searched. Vector search alone is poor at exact names, IDs and numbers, which is why the full-text search is there. The full-text search uses `plainto_tsquery`, which requires every word of the question to appear in one chunk, so it rarely matches long questions.

### Generation and citations (Claude)

Claude receives the retrieved passages under a system prompt that says the passages are untrusted data, that instructions inside them must be ignored, that conflicting passages must be presented rather than silently resolved, and that if the passages don't support an answer it must say "I could not find sufficient support in the documents." and cite nothing. The model only supplies a citation number. The application maps that number to the stored chunk to get the filename, heading and line range, flags numbers that don't exist among the retrieved chunks, and runs a word-overlap check on each cited sentence. An answer that abstains carries no citations.

### The interface

Upload, document list with statuses, and a chat. Each answer shows a support label (`well supported`, `partially supported` or `unsupported`), and each citation shows the filename, heading path and line range, with the cited chunk expandable underneath.

## Hallucination Controls and Confidence

- **Abstention:** 5 of 5 unanswerable test questions abstained, with no citations (see `EVALUATION.md`).
- **Conflict surfacing:** tested with one document containing two contradictory procedures. The answer presented both.
- **Prompt injection:** tested with one document containing a hidden instruction. The instruction was not followed.
- **Citation resolution:** the model supplies only a number. The application supplies everything the user sees about the source.
- **Support label:** derived from citation validity, the word-overlap check, and whether a cited chunk was found by both search methods. It is not the model's self-reported confidence and not a vector similarity score, and it is not a probability that the answer is right. In the evaluation, 5 answers were `well supported`, 12 `partially supported` and 5 `unsupported` (exactly the abstentions), but there were no wrong answers, so how well it tracks correctness is untested. `well supported` requires the full-text search to have matched, which rarely happens for long questions.

None of these controls guarantees there are no hallucinations.

## Evaluation

`EVALUATION.md` records 22 questions over 8 documents (five of 25,000+ words, one of 305,764), with expected results, the first run that found two false abstentions, how they were traced to missing embeddings and duplicated chunks, the metrics, and the limits of the evidence. Raw output of the latest run is in `eval/results.json`. The evaluation calls the answering code directly from my machine, so it does not exercise upload, queue and worker on the deployed site.

## Known Limitations

- **Uploads on the deployed site failed until the main app's role was given `sqs:SendMessage`.** I found this after the evaluation, which ran through local scripts under my own credentials. After the permission was added, one test upload went from `uploaded` to `processing` to `ready`. In early October some uploads left a database row but no file in S3 and no worker activity. They may have had the same cause, but I did not confirm it, and the app logs I checked for one of them showed no error line. A document that is never picked up still stays `uploaded`, because nothing times it out.
- **Overlapping ingestion on the same document can duplicate chunks.**
- **The word-overlap flag is a weak signal.** It scores each sentence against one passage at a time, so a sentence supported jointly by two passages can be flagged, and the number of flags varied between runs (20, 27 and 13). I reviewed one flagged citation by hand.
- **Citations are per sentence and coarse**: they don't say which of several cited passages backs which part of a sentence.
- **The cited-passage view shows only the cited chunk**, not the text around it.
- **The document list updates only when the page loads.**
- **Chunks are sized by characters**, not tokens.
- **Ingestion runs one embedding request per chunk in sequence.** The 305,764-word document used about 377 of the 600 allowed seconds. Anything much larger would exceed the limit.
- **The generated evaluation documents are not reproducible**: the generator is not seeded, so regenerating them changes the planted facts that some evaluation questions refer to.
- No authentication or user separation, as the assignment specifies.

## Technology Stack

- TanStack Start, deployed with the Nitro `aws-lambda` preset
- AWS Lambda (two functions), S3, SQS
- Neon Postgres with pgvector
- OpenAI `text-embedding-3-small` (1536 dimensions)
- Anthropic Claude (Sonnet 5.5)
- remark and remark-gfm for Markdown parsing, including tables

## Running Locally

Prerequisites: Node.js 22+, an AWS account with the CLI configured, a Neon (or other Postgres with pgvector) database, an OpenAI API key and an Anthropic API key.

1. Run `npm install`.
2. Create a `.env` file with `DATABASE_URL`, `OPENAI_API_KEY` and `ANTHROPIC_API_KEY`, one `NAME=value` per line with no quotes.
3. Create the tables: `node --env-file=.env scripts/setup-pgvector.ts` and `node --env-file=.env scripts/setup-chunks-table.ts`. The `documents` table also has to exist (`id`, `filename`, `s3_key`, `status`, `created_at`); its SQL is not in a script yet.
4. Run `npm run dev`.

Run the scripts from the project root so Node finds `.env`.

## Deployment

1. Create an S3 bucket. Apply `aws-policies/bucket-policy.json` (public read for `/assets/*`) and `aws-policies/cors-config.json` (GET, PUT, POST).
2. Create an IAM role with `aws-policies/trust-policy.json`, the CloudWatch Logs managed policy, and three inline policies: `s3-permissions-policy.json`, `sqs-permissions-policy.json` (the worker receives and deletes messages) and `sqs-send-policy.json` (the main app sends them; without it every upload on the deployed site fails).
3. Create an SQS queue with a visibility timeout of 900 seconds.
4. Build and deploy the main app: `npm run build`, sync `.output/public` to the bucket, zip `.output/server`, create the function, and use `aws lambda update-function-code` for later deploys. Confirm the `CodeSha256` changes after each deploy.
5. Bundle and deploy the worker as CommonJS (bundling the AWS SDK as ESM failed at runtime): `npx esbuild src/worker.ts --bundle --platform=node --target=node22 --outfile=worker-dist/index.js --format=cjs`. Zip `worker-dist` and deploy it as a separate function with a 600 second timeout.
6. Create an event source mapping from the queue to the worker with batch size 1.
7. Set `DATABASE_URL`, `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` on both functions. `update-function-configuration` replaces the whole set of variables, so send all three every time.
8. Create a Lambda Function URL with auth type `NONE` and grant both `lambda:InvokeFunctionUrl` and `lambda:InvokeFunction` (the second with `--invoked-via-function-url`).

## Running the Evaluation

`node --env-file=.env scripts/generate-large-doc.ts` and `scripts/generate-eval-docs.ts` create the test documents. Upload them (or register them with `scripts/insert-eval-docs.ts`) and ingest with `scripts/ingest-batch.ts <id> <id> ...`. Then run `node --env-file=.env scripts/run-eval.ts`. It writes `eval/results.json`. `scripts/review-citations.ts <question id>` prints each flagged citation next to its cited passage for manual review. The expected values for Q16 and Q17 in `run-eval.ts` come from the currently ingested generated files, so after regenerating them, update those two questions.

## Repository Structure

```
src/
  routes/index.tsx     UI, plus the upload, document list and question server functions
  chunker.ts           Markdown parsing and chunking
  hybridSearch.ts      vector + full-text retrieval
  generate.ts          generation, citation resolution, support label
  worker.ts            ingestion worker (SQS-triggered Lambda)
scripts/               ingestion, setup, document generators, evaluation runner
test-data/             two small hand-written test documents
aws-policies/          S3 and IAM policy files
eval/results.json      raw output of the latest evaluation run
EVALUATION.md
AI_USAGE_AND_BACKGROUND.md
```

Generated test documents are not committed. Re-create them with the generator scripts.

## Cost

Not instrumented. Embeddings are priced at $0.02 per million tokens; I did not record totals for embedding or for generation. The infrastructure stayed inside free tiers at this usage.
