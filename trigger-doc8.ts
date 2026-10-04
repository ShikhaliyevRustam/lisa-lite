import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs'
const sqs = new SQSClient({ region: 'eu-central-1' })
async function main() {
    await sqs.send(new SendMessageCommand({
        QueueUrl: 'https://sqs.eu-central-1.amazonaws.com/207871832731/lisa-lite-ingestion-queue',
        MessageBody: JSON.stringify({ documentId: 8 }),
    }))
    console.log('Message sent for document 8')
}
main()