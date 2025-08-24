import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { getEventsQueueUrl } from './env';

let sqsClient: SQSClient | null = null;

export const getSQSClient = (): SQSClient => {
  if (!sqsClient) {
    sqsClient = new SQSClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }
  return sqsClient;
};

export const sendMessageToQueue = async (messageBody: string): Promise<void> => {
  try {
    const client = getSQSClient();
    const queueUrl = getEventsQueueUrl();
    
    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: messageBody,
    });
    
    await client.send(command);
  } catch (error) {
    // Fire-and-forget: log errors, don't throw
    console.error('Failed to send message to SQS:', error);
  }
};

