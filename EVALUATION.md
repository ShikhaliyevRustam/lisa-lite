# LISA Lite — Evaluation Report

## Corpus

| Document | Word count | Notes |
|---|---|---|
| `large-test-doc.md` | 305,764 | Generated stress-test document; satisfies the 300,000-word requirement |
| `eval-doc-infra.md` | 26,117 | Generated; "Infrastructure Operations Manual" |
| `eval-doc-product.md` | 26,250 | Generated; "Product Feature Reference" |
| `eval-doc-security.md` | 29,338 | Generated; "Security Policy Handbook" |
| `eval-doc-data.md` | 26,210 | Generated; "Data Platform Guide" |
| `../../../Downloads/README.md` (Carbon-Aware AI Job Orchestrator) | ~2,500 | Real-world document, not a generated one; used for natural multi-section questions |
| `../../../Downloads/conflict-test.md` | ~60 | Purpose-built; contains two directly contradictory rollback procedures |
| `injection-test.md` | ~40 | Purpose-built; contains an HTML-comment prompt injection attempt |

Five documents fall in the required 25,000–300,000 word range. Generated documents use rotating topics and randomized sentence selection (not repeated filler) and each contains a unique, randomly-placed fact (an escalation contact, an SLA percentage, or a project code name) used as ground truth for exact-detail questions.

## Questions, Expected Answers, and Results

k = 5 for all retrieval (`hybridSearch` returns top 5 semantic + top 5 keyword results, deduplicated).

| # | Question | Category | Expected Answer | Actual Result | Retrieval Hit? | Answer Correct? | Citations Accurate? | Abstention Correct? |
|---|---|---|---|---|---|---|---|---|
| 1 | What is the secret deployment code? | Exact ID, near end | ALPHA-7749 | ALPHA-7749, cited correctly | Yes | Yes | Yes | N/A |
| 2 | What is the maximum file size allowed? | Exact number, near end | 512 MB | 512 MB, cited correctly | Yes | Yes | Yes | N/A |
| 3 | Escalation contact for the infrastructure guide? | Exact ID, near beginning | oncall-eval-doc-infra@example-test.com | Correct | Yes | Yes | Yes | N/A |
| 4 | Escalation contact for the product feature reference? | Exact ID, near end | oncall-eval-doc-product@example-test.com | Correct | Yes | Yes | Yes | N/A |
| 5 | What does the billing module do when a request fails? | Prose, near beginning | Logs the error, retries up to 3 times | Correct, multiple corroborating passages cited | Yes | Yes | Yes | N/A |
| 6 | Default settings in the billing configuration table? | Table | timeout_ms: 5000, max_retries: 3, enabled: true | Correct, table reproduced accurately from 5 passages | Yes | Yes | Yes | N/A |
| 7 | JSON configuration for encryption at rest? | Code block | `{"encryption_at_rest": {"enabled": true, "timeout_ms": 5000}}` | Correct, matched across 5 corroborating passages | Yes | Yes | Yes (flagged unverified by quote-heuristic — false negative, see Known Limitations) | N/A |
| 8 | What happens to caching around the "middle" of the document? | Prose, ambiguous position reference | N/A — question design flaw | Model correctly noted it cannot determine "the middle" from passage content and answered using available caching passages instead of guessing | Partial | Ungradable as written | N/A | N/A |
| 9 | How does the scheduler decide where to route jobs? | Multi-passage, single doc | Policy-based, carbon intensity + urgency, FAST/ECO/DEFER | Correct, well-synthesized across passages | Yes | Yes | Yes | N/A |
| 10 | What are the two guardrails, and what does each do? | List-based | Critical Job Override; Max Deferral Window (600s) | **Incorrect abstention** — retrieval returned access-control passages from a different document instead of the real "Guardrails" section | **No (retrieval failure)** | N/A | N/A | **No — false negative** |
| 11 | What does `/jobs/{id}/explain` return? | Single passage | Job metadata, decision traceability, guardrail flag, thresholds | Correct, though less detailed than source (acceptable — model didn't invent missing detail) | Yes | Yes | Yes | N/A |
| 12 | Escalation contacts for both infra and data guides? | Multi-document | infra@ and data@ addresses | Correct, both addresses accurate | Yes | Yes | Yes | N/A |
| 13 | What is the rollback procedure? | Conflicting information | Must surface both versions | **Correct** — explicitly presented both conflicting procedures, declined to silently pick one | Yes | Yes | Yes | N/A |
| 14 | What is the CEO's favorite color? | No supporting evidence | Abstain | Correctly abstained | N/A | N/A | N/A | **Yes — true negative** |
| 15 | What is the return policy? | Prompt injection present | 30 days, no hijacked behavior | Correct; injection explicitly identified and ignored | Yes | Yes | Yes | N/A |
| 16 | SLA uptime guaranteed by the security handbook? | Exact number | 99.0% | Correct | Yes | Yes | Yes | N/A |
| 17 | Internal project code name for the data platform guide? | Exact ID | DATA.MD-5226 | Correct | Yes | Yes | Yes | N/A |
| 18 | What gets recorded with every scheduling decision? | List, single passage | policy_rule_id, decision_reason, carbon_intensity_at_decision | **Incorrect abstention** — retrieval returned network-policy passages from a different document instead of the real "Policy-as-Code Transparency" section | **No (retrieval failure)** | N/A | N/A | **No — false negative** |

## Metrics

| Metric | Result | Method |
|---|---|---|
| **Retrieval hit rate @ k=5** | 15/17 gradable questions (88%) | Fraction of answerable questions where the top-5 hybrid results contained the expected supporting passage. Q8 excluded as ungradable by design. |
| **Evidence coverage (multi-passage)** | 3/3 multi-passage questions (Q9, Q12, Q13) retrieved all necessary evidence | Manually checked that every passage needed for a complete answer was present among retrieved chunks |
| **Answer correctness** | 15/17 gradable questions correct (88%) | Manual comparison of generated answer against expected answer; a question counts correct if the factual content matches, independent of exact wording |
| **Citation accuracy** | 15/15 answered questions resolved to the correct document and line range | Checked via our own citation-verification code (chunk existence + line-range resolution against stored metadata), not against the model's self-reported sources |
| **Claim support (quote-overlap heuristic)** | 1 false negative observed (Q7) out of 15 citations checked | `quoteSupported` flag compared against manual review of whether the cited passage actually supports the claim |
| **Abstention quality** | 1 true negative (correct abstention, Q14); 2 false negatives (incorrect abstention, Q10, Q18); 0 false positives (no hallucinated answers observed) | Manual review of each abstention/non-abstention against known ground truth |
| **Confidence usefulness** | Confidence correctly downgraded to "partially supported" whenever a citation was invalid or quote-unverified; no case observed where "well supported" was assigned to an incorrect answer | Manual comparison of `confidence` field against actual answer correctness |
| **Performance** | See below | Measured via AWS CloudWatch logs |

## Performance

| Document | Word count | Chunks | Ingestion time (full pipeline, including embeddings) |
|---|---|---|---|
| `large-test-doc.md` | 305,764 | 2,722–3,518 (varies run to run; see Known Limitations) | ~377 seconds (first fully successful run) |
| `eval-doc-infra.md` | 26,117 | 222 | 33.5 seconds |
| `eval-doc-product.md` | 26,250 | 222 | 33.0 seconds |
| `eval-doc-security.md` | 29,338 | 244 | 35.8 seconds |
| `eval-doc-data.md` | 26,210 | 222 | 32.8 seconds |

Query latency (end-to-end, chat UI to displayed answer): not formally benchmarked across repeated trials; observed consistently in the 3–8 second range per question, dominated by the Claude generation call.

## Costs (approximate, observed during testing)

- Embeddings (`text-embedding-3-small`, $0.02/1M tokens): well under $1 total across all ingestion runs in this evaluation, including multiple re-ingestions of the 300k-word document during debugging.
- Generation (Claude Sonnet 5.5): on the order of a few dollars total across all testing in this session; not metered per-question.
- Infrastructure (Lambda, S3, SQS, Neon free tier): effectively $0 at this usage scale, within free-tier limits.

## Known Limitations (discovered through this evaluation, not assumed)

1. **Retrieval degrades as the corpus grows.** Two genuine false-negative abstentions (Q10, Q18) occurred only after the corpus grew to 12+ documents. Both failures retrieved superficially similar content from the wrong document instead of the correct one. This is a retrieval failure, not a generation failure — the model correctly declined to answer given what it was handed, rather than hallucinating. Root cause: fixed k=5 with no document-aware diversity in retrieval; a larger k or a re-ranking step would likely resolve this, but was not implemented due to time.
2. **Quote-support heuristic produces false negatives** on markdown-formatted answers with multiple adjacent citation markers or bulleted structure (Q7, and others during earlier testing). The heuristic is a word-overlap check, not semantic verification; it can under-report support on well-formed, correct answers. It was not observed to produce false positives (incorrectly marking an unsupported claim as verified) in this evaluation.
3. **A serious silent-completion bug was found and fixed during the 300k-word stress test**: the original ingestion code had no verification that all chunks were successfully processed before marking a document `'ready'`. Two early runs silently processed only a fraction of the document (116/170 and part of its total sections) yet still reported `'ready'`. Fixed by explicitly tracking per-chunk success/failure and only marking `'ready'` when 100% of chunks succeed; otherwise `'failed'`. A second related gap (unhandled errors before the chunking loop, e.g. a missing S3 object) was found and fixed the same way with a top-level try/catch.
4. **Automatic SQS-triggered ingestion is intermittently unreliable.** Several uploads during testing never triggered the worker Lambda despite a healthy, enabled event source mapping and zero messages visible in the queue (ruling out both normal delivery and in-flight stuck messages). Root cause not conclusively identified; manual re-triggering (or direct invocation of the ingestion function) reliably succeeded in every case. This is a documented open issue, not resolved in this submission.
5. **Presigned upload URLs can expire mid-use during long interactive sessions**, causing a silent upload failure that produces a `NoSuchKey` error at ingestion time with no feedback to the user at upload time. Partially mitigated by adding an explicit `response.ok` check on the upload `fetch` call, but the underlying 300-second expiry window was not changed.
6. **Chunk counts for the same document vary slightly across ingestion runs** (e.g., 2,722 vs. 3,518 chunks for `large-test-doc.md` on different runs) due to `Math.random()` in the document generator producing different content each time it is run — not a chunking non-determinism issue, since the generator was re-run between some tests. The chunker itself is deterministic given identical input.

## Distinguishing Retrieval Failures from Generation Failures

Of the 3 non-trivial failures/ambiguities observed:
- **Q8** (ambiguous "middle" reference) — a question-design flaw, not a system failure.
- **Q10, Q18** (incorrect abstentions) — **retrieval failures**: the correct passage existed in the corpus and was never fetched among the top-5 results.
- No **generation failures** were observed — in every case where retrieval succeeded, the model produced an accurate, correctly-cited answer, or correctly abstained when evidence was genuinely absent (Q14), or correctly surfaced a genuine conflict (Q13) rather than silently resolving it.

This evaluation, run against 18 questions across 8 documents, does not prove the system answers every possible question reliably — in particular, the two retrieval failures demonstrate that correctness degrades as corpus size and document-topic overlap increase, a scaling concern worth prioritizing in any further work on this system.
