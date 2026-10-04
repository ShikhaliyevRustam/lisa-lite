import { writeFileSync } from 'fs'

interface DocSpec {
  filename: string
  topics: string[]
  sections: number
  title: string
}

const sentenceTemplates = [
  'The {topic} module handles requests by validating input and forwarding them to the appropriate service.',
  'When {topic} fails, the system logs the error and retries up to three times before giving up.',
  'Configuration for {topic} is stored in environment variables and loaded at startup.',
  'The {topic} component was last updated in version {version} to improve reliability.',
  'Developers should avoid calling the {topic} API directly; use the provided SDK wrapper instead.',
  'Monitoring for {topic} is handled by the observability stack, which emits metrics every 30 seconds.',
  'The {topic} feature was deprecated in favor of a newer implementation, but remains supported for backward compatibility.',
]

function randomSentence(topic: string): string {
  const template = sentenceTemplates[Math.floor(Math.random() * sentenceTemplates.length)]
  const version = (Math.random() * 5 + 1).toFixed(1)
  return template.replace('{topic}', topic).replace('{version}', version)
}

function generateSection(topic: string, index: number): string {
  const paragraphs = Array.from({ length: 10 }, () =>
    Array.from({ length: 8 }, () => randomSentence(topic)).join(' ')
  ).join('\n\n')

  return `## Section ${index}: ${topic}\n\n${paragraphs}\n\n### ${topic} Configuration\n\n| Setting | Default | Description |\n|---|---|---|\n| timeout_ms | 5000 | Request timeout for ${topic} |\n| max_retries | 3 | Retry attempts for ${topic} |\n| enabled | true | Whether ${topic} is active |\n\n\`\`\`json\n{\n  "${topic.replace(/ /g, '_')}": {\n    "enabled": true,\n    "timeout_ms": 5000\n  }\n}\n\`\`\`\n`
}

const specs: DocSpec[] = [
  {
    filename: 'eval-doc-infra.md',
    title: 'Infrastructure Operations Manual',
    topics: ['load balancing', 'container orchestration', 'secrets management', 'disaster recovery', 'network policies'],
    sections: 20,
  },
  {
    filename: 'eval-doc-product.md',
    title: 'Product Feature Reference',
    topics: ['onboarding flow', 'subscription tiers', 'referral program', 'in-app messaging', 'account settings'],
    sections: 20,
  },
  {
    filename: 'eval-doc-security.md',
    title: 'Security Policy Handbook',
    topics: ['access control', 'encryption at rest', 'incident response', 'vulnerability scanning', 'audit trails'],
    sections: 22,
  },
  {
    filename: 'eval-doc-data.md',
    title: 'Data Platform Guide',
    topics: ['ETL pipelines', 'data warehousing', 'schema migrations', 'backup retention', 'query optimization'],
    sections: 20,
  },
]

for (const spec of specs) {
  let doc = `# ${spec.title}\n\nThis is a generated test document for the LISA Lite evaluation corpus.\n\n`
  for (let i = 1; i <= spec.sections; i++) {
    const topic = spec.topics[i % spec.topics.length]
    doc += generateSection(topic, i)
  }
  // Each doc gets a unique findable fact for eval questions, placed at different relative positions
  const factPlacement = Math.random()
  const uniqueFact = `\n## Reference Information\n\nThe designated escalation contact is oncall-${spec.filename.replace('.md', '')}@example-test.com.\nThe service level agreement guarantees ${(95 + Math.random() * 4).toFixed(1)}% uptime.\nThe internal project code name is ${spec.filename.split('-')[2].toUpperCase()}-${Math.floor(Math.random() * 9000 + 1000)}.\n`

  if (factPlacement < 0.33) {
    // insert near beginning
    const parts = doc.split('\n## Section 2:')
    doc = parts[0] + uniqueFact + '\n## Section 2:' + (parts[1] || '')
  } else if (factPlacement < 0.66) {
    // insert near middle - just append at current midpoint via string length
    const midpoint = Math.floor(doc.length / 2)
    const nextHeading = doc.indexOf('\n## Section', midpoint)
    doc = doc.slice(0, nextHeading) + uniqueFact + doc.slice(nextHeading)
  } else {
    // append at end
    doc += uniqueFact
  }

  writeFileSync(spec.filename, doc)
  const wordCount = doc.split(/\s+/).length
  console.log(`${spec.filename}: ${wordCount} words`)
}
