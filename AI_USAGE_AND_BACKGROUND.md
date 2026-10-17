# Background and AI Tool Usage

I built a related project before this one: a Kubernetes job orchestrator that routes AI workloads using policy rules (carbon intensity, urgency, SLOs). Some of that thinking carried over here: separating work with a queue, recording why a decision was made instead of leaving it opaque, and writing down what the system doesn't do well. The stack for this assignment was new to me, though. TanStack Start, Lambda, SQS, pgvector and retrieval-augmented generation in general were things I learned while building.

I used Claude heavily: to write code, to explain things I didn't know, and to draft documentation. I ran every command, deployment and test myself, and Claude helped me work out what the results meant. Some of what we ran into:

- A deploy script kept reusing an old build because a zip step failed without stopping anything. Comparing the code hash after each deploy exposed it.
- Two Lambda functions were missing environment variables at different times. CloudWatch logs showed which one.
- Chunk size was measured in lines instead of characters, so one very long paragraph became one huge chunk. It only appeared when I tested the 300,000-word document.
- Ingestion could mark a document `ready` after processing only part of it, with no error. I found it because a planted fact near the end of the document could not be found. Checking the chunk count against the file confirmed it, and the ingestion code now records success per chunk.
- When I wrote up the evaluation, the explanation for two failed questions (that retrieval got worse as the corpus grew) came from Claude and I accepted it without checking. A later check of chunk and embedding counts per document showed the README's chunks had no embeddings and one document held duplicated chunks. I rewrote that part of the report, kept the original failed run in it, and noted that I can't separate the causes completely.
- Some uploads never reached S3 or triggered the worker. Claude's first explanations (a browser crash, then expiring upload links) were never checked. Much later I read the main app's IAM role and found it could receive queue messages but not send them, which makes uploads on the deployed site fail. I found this after the evaluation, because the evaluation ran through local scripts under my own credentials. After I added the permission, a test upload reached `ready`. Some of the earlier cases may have had the same cause, but I haven't confirmed it.

I wrote the evaluation questions and the automatic checks with Claude's help. How the results are scored, and what they can't show, is in `EVALUATION.md`.
