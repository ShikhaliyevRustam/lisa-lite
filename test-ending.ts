import { chunkMarkdown } from './chunker.ts'

const sample = `# Doc

Some content.

## Special Facts

The secret deployment code is ALPHA-7749.
The support contact is support@example-test.com.
The maximum file size allowed is 512 MB.
`

const chunks = chunkMarkdown(sample)
console.log(JSON.stringify(chunks, null, 2))