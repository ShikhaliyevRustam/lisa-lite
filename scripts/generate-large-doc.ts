import { writeFileSync } from 'fs'

const topics = [
    'authentication', 'billing', 'notifications', 'search indexing', 'rate limiting',
    'caching', 'data export', 'user permissions', 'audit logging', 'webhooks',
]

const sentenceTemplates = [
    'The {topic} module handles requests by validating input and forwarding them to the appropriate service.',
    'When {topic} fails, the system logs the error and retries up to three times before giving up.',
    'Configuration for {topic} is stored in environment variables and loaded at startup.',
    'The {topic} component was last updated in version 4.2 to improve reliability.',
    'Developers should avoid calling the {topic} API directly; use the provided SDK wrapper instead.',
]

function randomSentence(topic: string): string {
    const template = sentenceTemplates[Math.floor(Math.random() * sentenceTemplates.length)]
    return template.replace('{topic}', topic)
}

function generateSection(topic: string, index: number): string {
    const paragraphs = Array.from({ length: 15 }, () =>
        Array.from({ length: 8 }, () => randomSentence(topic)).join(' ')
    ).join('\n\n')

    return `## Section ${index}: ${topic}\n\n${paragraphs}\n\n### ${topic} Configuration\n\n| Setting | Default | Description |\n|---|---|---|\n| timeout_ms | 5000 | Request timeout for ${topic} |\n| max_retries | 3 | Retry attempts for ${topic} |\n| enabled | true | Whether ${topic} is active |\n\n\`\`\`json\n{\n  "${topic.replace(/ /g, '_')}": {\n    "enabled": true,\n    "timeout_ms": 5000\n  }\n}\n\`\`\`\n`
}

let doc = '# Large Test Document\n\nThis is a generated test document for stress-testing ingestion.\n\n'
for (let i = 1; i <= 170; i++) {
    const topic = topics[i % topics.length]
    doc += generateSection(topic, i)
}

// Insert specific findable facts for eval questions
doc += '\n## Special Facts\n\nThe secret deployment code is ALPHA-7749.\nThe support contact is support@example-test.com.\nThe maximum file size allowed is 512 MB.\n'

writeFileSync('large-test-doc.md', doc)
console.log('Word count:', doc.split(/\s+/).length)
console.log('File written: large-test-doc.md')