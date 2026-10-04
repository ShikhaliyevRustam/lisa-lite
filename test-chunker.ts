import { chunkMarkdown } from './chunker.ts'

const sample = `# API Guide

Welcome to the guide.

## Authentication

Use your API key.

\`\`\`bash
curl -H "Authorization: Bearer KEY"
\`\`\`

## Rate Limits

| Tier | Limit |
|------|-------|
| Free | 100/day |
| Pro  | 10000/day |
`

const chunks = chunkMarkdown(sample)
console.log(JSON.stringify(chunks, null, 2))