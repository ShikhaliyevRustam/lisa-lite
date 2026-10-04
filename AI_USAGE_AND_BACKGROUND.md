# Background and AI Tool Usage

I'd built a related project before this one — a Kubernetes-based job orchestrator that routes AI workloads based on policy rules (carbon intensity, urgency, SLOs). A lot of the thinking behind that project shows up here too: splitting work across services connected by a queue, building in an explain/trace mechanism rather than leaving decisions as a black box, and writing down what the system doesn't do well instead of hiding it. The specific stack for this assignment was new to me though — TanStack Start, Lambda, SQS, pgvector, and the RAG side of things in general — so I was learning that as I built.

I used Claude a lot while building this, for writing code, explaining things I didn't know, and putting together documentation. But I ran everything myself — every deploy, every test, every bug. A few of the real ones worth mentioning:

The deploy pipeline had a stale-build bug that bit me more than once: a packaging step would fail silently and I'd end up redeploying old code without realizing it. I caught it by checking the code hash before and after each deploy.

I had two separate Lambda functions missing environment variables at different points (OPENAI_API_KEY on one, then the same thing again on a different function) — found both by reading the actual CloudWatch logs rather than guessing.

The chunking logic had a real bug that only showed up once I tested against the full 300k-word document — it was measuring chunk size by line count instead of character count, so a single very long paragraph with no line breaks became one enormous chunk instead of being split properly.

The biggest one: during that same stress test, I found that the ingestion pipeline could silently mark a document "ready" even though it had only processed part of it — no error, no warning, just an incomplete result reported as a success. I confirmed this by comparing the actual stored chunk count against what the document should have produced, then fixed it so the pipeline only reports "ready" when every chunk is verified processed, and "failed" otherwise.

I also ran into an intermittent issue where some uploads never triggered automatic ingestion, even though the queue and the worker both looked healthy. I wasn't able to fully pin down the cause in the time I had — I ruled out a few things (the event mapping being disabled, messages stuck in the queue) but the most likely explanation is that presigned upload URLs were expiring during long sessions. I documented this as a known, unresolved limitation rather than pretend it isn't there.
