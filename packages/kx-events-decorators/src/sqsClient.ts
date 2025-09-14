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
    
    // Parse event for logging
    let eventInfo = 'unknown';
    try {
      const event = JSON.parse(messageBody);
      eventInfo = `${event.eventId} (${event.entityType}.${event.eventType})`;
    } catch (e) {
      // Ignore parsing errors for logging
    }
    
    console.log(`📤 Sending SQS message for event ${eventInfo} to queue: ${queueUrl}`);
    
    const command = new SendMessageCommand({
      QueueUrl: queueUrl,
      MessageBody: messageBody,
    });
    
    const result = await client.send(command);
    console.log(`📤 SQS message sent successfully for event ${eventInfo}, MessageId: ${result.MessageId}`);
  } catch (error) {
    // Re-throw for Promise.allSettled to catch
    console.error('📤 Failed to send message to SQS:', error);
    throw error;
  }
};

