import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

async function main() {
    const response = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: 'The cat sat on the mat.',
    })

    const embedding = response.data[0].embedding
    console.log('Vector length:', embedding.length)
    console.log('First 5 values:', embedding.slice(0, 5))
}

main()