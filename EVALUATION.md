# LISA Lite — Evaluation

## What this evaluation is, and what it isn't

22 questions run through the same retrieval and generation code the app uses (`scripts/run-eval.ts`), against 8 ingested documents. Pass/fail comes from substring checks that I wrote after looking at the documents. A person did not grade each answer, and 22 questions cannot show that the system answers other questions reliably. Raw output from the last run is in `eval/results.json`.

In short:

- Final run: 22/22 pass by the substring checks, 17/17 retrieval hits on answerable questions, 5/5 abstentions on unanswerable ones, no false abstentions.
- The first run of this evaluation found two false abstentions (Q10, Q18). My first written explanation for them was wrong. Checking the database showed missing embeddings and duplicated chunks, and both questions passed once that data was fixed. The history is in "How the first run went" below.
- Weak spots: the confidence label and the citation-support flag do not discriminate well, and no question tests a fact in the middle of a document of 25,000+ words.

## Corpus

| Document | Size | Chunks | Notes |
|---|---|---|---|
| `large-test-doc.md` | 305,764 words, 8,171 lines | 2,722 | Generated stress-test document |
| `eval-doc-infra.md` | 26,117 words | 222 | Generated |
| `eval-doc-product.md` | 26,250 words | 222 | Generated |
| `eval-doc-security.md` | 29,338 words | 244 | Generated |
| `eval-doc-data.md` | 26,210 words | 222 | Generated |
| `README.md` | 280 lines | 35 | A real README from an earlier project of mine, not generated |
| `conflict-test.md` | 9 lines | 2 | Hand-written; two contradictory rollback procedures |
| `injection-test.md` | 7 lines | 1 | Hand-written; contains a hidden instruction |

Five documents are in the 25,000–300,000 word range or above it. The generated documents rotate topics and pick sentences at random, and each has a table and a code block in every section plus one planted fact (an escalation contact, an SLA percentage, a project code name). The generator is not seeded. Regenerating the files changes the planted facts, so the expected answers for Q16 and Q17 refer to the files currently ingested.

Positions of the planted facts in the 25,000+ word documents: the infrastructure and data contacts and the data code name are near the start (line 45 of 771), the product and security facts near the end (lines 768 and 844), and `ALPHA-7749` is near the end of the large document. **There is no planted fact in the middle of a long document.** Q8 is a middle-of-document question, but it uses the 280-line README, which does not meet the size requirement.

## Method

- Retrieval: top 5 by vector similarity and top 5 by full-text search, merged and de-duplicated, so up to 10 chunks reach the model. Only chunks from documents with status `ready` are searched.
- For an answerable question, `pass` means the answer does not abstain and contains the expected strings (and none of the forbidden ones). A correct paraphrase can fail this, and a wrong answer containing the right strings could pass.
- Retrieval check: a distinctive snippet from the source text must appear among the retrieved chunks. This is what separates retrieval failures from generation failures.
- Citation check: the same snippet must appear in a chunk the answer actually cites.
- Unanswerable questions pass only if the answer begins with "I could not find sufficient support" and carries no citations.
- Q19–Q22 are near-miss questions I wrote after seeing the corpus (the topic exists in the documents but the specific fact does not).

## Results of the final run

| # | Question | Category | Retrieval hit | Pass | Support label |
|---|---|---|---|---|---|
| 1 | What is the secret deployment code? | exact ID, end of 305k-word document | yes | yes | well supported |
| 2 | What is the maximum file size allowed? | exact number, end of large document | yes | yes | well supported |
| 3 | Escalation contact for the infrastructure guide? | exact ID, start of document | yes | yes | partially supported |
| 4 | Escalation contact for the product feature reference? | exact ID, end of document | yes | yes | partially supported |
| 5 | What does the billing module do when a request fails? | prose | yes | yes | well supported |
| 6 | Default settings in the billing configuration table? | table | yes | yes | partially supported |
| 7 | JSON configuration for encryption at rest? | code block | yes | yes | partially supported |
| 8 | What does the GET /stats endpoint report? | list, middle of the 280-line README | yes | yes | partially supported |
| 9 | How does the scheduler decide where to route jobs? | several passages | yes | yes | partially supported |
| 10 | What are the two guardrails, and what does each do? | list | yes | yes | partially supported |
| 11 | What does /jobs/{id}/explain return? | single passage | yes | yes | well supported |
| 12 | Escalation contacts for the infrastructure and data guides? | two documents | yes | yes | partially supported |
| 13 | What is the rollback procedure? | conflicting information | yes | yes | partially supported |
| 14 | What is the CEO's favorite color? | no evidence | n/a | yes (abstained) | unsupported |
| 15 | What is the return policy? | hidden instruction in the document | yes | yes | well supported |
| 16 | SLA uptime in the security handbook? | exact number, end of document | yes | yes | partially supported |
| 17 | Internal code name of the data platform guide? | exact ID, start of document | yes | yes | partially supported |
| 18 | What is recorded with every scheduling decision? | list, single passage | yes | yes | partially supported |
| 19 | On-call phone number for the infrastructure team? | near-miss (email exists, phone does not) | n/a | yes (abstained) | unsupported |
| 20 | Monthly price of the premium subscription tier? | near-miss | n/a | yes (abstained) | unsupported |
| 21 | Which Kubernetes version does the infrastructure manual require? | near-miss | n/a | yes (abstained) | unsupported |
| 22 | Which cloud region does the Carbon-Aware orchestrator run in? | near-miss | n/a | yes (abstained) | unsupported |

## Metrics

| Metric | Result | What it does and doesn't show |
|---|---|---|
| Retrieval hit rate (k=5 per method, up to 10 merged) | 17/17 answerable questions | The snippet check can't tell whether the best chunk was ranked first. |
| Evidence coverage, multi-passage questions | Q9, Q12, Q13 all retrieved their evidence | Q9's check looks for one phrase, so it shows less than Q12 and Q13. |
| Answer correctness | 22/22 by substring checks | Not graded by a person. See the Method section. |
| Citation accuracy | 17/17 answerable questions cite a chunk containing the expected snippet; 0 invalid citations in the final run | Citations are resolved from stored metadata, so document and line range are correct by construction. A citation pointing at the right passage does not mean it supports the exact sentence it is attached to. |
| Claim support (word-overlap flag) | 13 `unverified` flags in the final run (20 and 27 in the two earlier runs) | I reviewed one flagged citation by hand. It supported three of the claims attached to it, and two other claims were supported only by a second passage cited next to it. The flag cannot tell "unsupported" from "supported together with another passage". I did not review the rest. |
| Abstention quality | 5/5 unanswerable questions abstained, each with zero citations; 0 false abstentions among the 17 answerable questions | Only five unanswerable questions, so the rate of invented answers is barely measured. |
| Confidence usefulness | 5 well supported / 12 partially supported / 5 unsupported. The 5 `unsupported` are exactly the 5 abstentions. | There are no wrong answers in the set, so agreement between the label and correctness could not be tested. 12 of 17 correct answers were labeled `partially supported`. |
| Query latency | Average 2.2 s, maximum 4.5 s (earlier runs: 2.5 s / 5.5 s and 2.4 s / 4.8 s) | One local run per question, calling the answering code directly. Excludes the browser and Lambda cold starts. |

## How the first run went, and what changed

The first run used 18 questions (the same set, with an ungradable Q8 and without Q19–Q22). Results:

- 15 of the 17 gradable questions were answered correctly.
- Q10 (guardrails) and Q18 (policy transparency) abstained, although the README contains both answers.
- Q8 ("the middle of the infrastructure stress-test document") could not be graded, because it did not identify a section. That was a flaw in my question.
- Q3's answer listed the same lines (45–47) as two separate citations.

I first wrote that retrieval got worse as the corpus grew past 12 documents. I had not checked that. When I counted chunks and embeddings per document, the data looked like this:

| Document | Chunks | With embedding | Distinct line ranges |
|---|---|---|---|
| README (id 5) | 32 | 0 | not recorded |
| `injection-test.md` | 1 | 0 | not recorded |
| `eval-doc-infra.md` | 672 | 672 | 222 |
| an orphan README row (id 4) | 0 | 0 | none |

- The README had been ingested by a version of the worker that did not yet generate embeddings, so the vector search could not see it.
- `eval-doc-infra.md` held several copies of every chunk, because re-running ingestion did not clear the old chunks.
- I took these counts after the first run. I have no snapshot of the data at the time of the first run.

What I changed: ingestion now sets the status to `processing`, deletes the document's old chunks, then re-inserts, and the old rows and the orphan row were removed. The README, `injection-test.md` and the infrastructure document were re-ingested. After that, every document had equal chunk, embedding and distinct-range counts (the table in the Corpus section), and Q10 and Q18 passed.

What I can conclude: the README chunks had no embeddings and were findable only by keyword search. Keyword search uses `plainto_tsquery`, which requires every word of the question to appear in one chunk, so it rarely matches long questions. That is the most likely reason both questions failed. I did not isolate it. Embeddings, chunk boundaries (32 chunks became 35) and duplicates all changed at once, and I did not re-run the old data with only one fix applied. I found no evidence that corpus growth caused the failures, but 8 documents is too small a corpus to rule it out.

Also changed after the first run:

- An abstention that carried citation markers was labeled `partially supported`. Q14 did this in two earlier runs: the answer declined, then said which passages it had looked at, and the code counted those as citations. Abstentions now carry no citations and are labeled `unsupported`.
- Confidence used to look a cited chunk up by its heading, which is ambiguous when many chunks share a heading. It now uses the citation number.
- Citations show the filename, and the cited passage can be expanded.

## Bugs found while testing

- A stale build was deployed twice because a zip step failed without anything stopping the deploy. I caught it by comparing the code hash after each deploy.
- Two Lambda functions were each missing an environment variable at different times. CloudWatch logs showed the cause both times.
- Chunk size was measured in lines, not characters. A paragraph with no line breaks became one chunk of about 11,000 characters. This showed up only on the large document.
- Ingestion could mark a document `ready` after processing only part of it. Two runs stopped around Section 116 of 170 with no error, and the planted fact near the end of the document was missing. Ingestion now counts successful chunks and sets `ready` only when every chunk succeeded, otherwise `failed`.
- An error before chunking (a missing S3 object) left a document stuck as `uploaded`. It now sets `failed`.
- Q14's abstention was labeled `partially supported`, as described above.

## Known limitations

- **Intermittent ingestion trigger.** Several uploads never triggered the worker, although the event source mapping was enabled and no messages were visible or in flight. I did not find the cause. Re-sending the message always worked. The upload code now checks S3's response, but a document that is never picked up stays `uploaded` forever, because nothing times it out.
- **Overlapping ingestion can duplicate chunks.** The logs show two worker invocations processing the same document at the same time. Delete-then-insert protects against sequential re-runs and redeliveries, not overlapping ones. This may also explain why the large document had 3,518 chunks in one run and 2,722 in another. I did not verify that.
- **Citations are coarse.** The model attaches one or more passages to a sentence. A citation does not say which passage backs which part of the sentence.
- **The cited-passage view shows only the cited chunk** (roughly 800 characters), not the text around it.
- **The document list updates only when the page loads**, so a document does not change to `ready` on its own.
- **Chunks are sized by characters** against an 800-character target, not by tokens.
- **Prompt-injection defense and conflict surfacing were each tested with one document.** The system prompt marks document text as untrusted and asks the model to present conflicts. Neither is guaranteed.
- No authentication or user separation, as the assignment specifies.

## Performance, limits and cost

| Measurement | Value |
|---|---|
| Worker Lambda, 305,764-word document | 376.5–377.4 s in three runs, about 0.14 s per chunk (2,722 chunks) |
| Local batch script, four 26–29k-word documents | 32.8–35.8 s each (222–244 chunks) |
| Worker timeout / queue visibility timeout | 600 s / 900 s |
| Query latency | See the Metrics table |

- **First bottleneck:** one OpenAI request per chunk, in sequence. By straight-line extrapolation (an assumption, not a measurement) a document of roughly 480,000 words would reach the 600-second limit. I did not test above 305,764 words.
- **What I would do first:** send embeddings in batches (the API accepts a list of inputs) and split long documents across several invocations. Neither has been tried.
- **File and corpus limits:** the largest tested document was 8,171 lines. I did not record its size in bytes. The number of documents is limited only by Postgres storage and has not been load-tested.
- **Concurrency:** the queue batch size is 1, and no reserved concurrency is set on the Lambda functions. I did not load-test this.
- **Cost:** not metered. The embedding model is priced at $0.02 per million tokens. I did not record totals for embeddings or for generation.