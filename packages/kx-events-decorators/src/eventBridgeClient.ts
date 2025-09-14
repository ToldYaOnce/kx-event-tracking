import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { getEventBusName } from './env';
import { TrackedEvent } from './types';

let eventBridgeClient: EventBridgeClient | null = null;

export const getEventBridgeClient = (): EventBridgeClient => {
  if (!eventBridgeClient) {
    eventBridgeClient = new EventBridgeClient({
      region: process.env.AWS_REGION || 'us-east-1',
    });
  }
  return eventBridgeClient;
};

export const publishToEventBridge = async (event: TrackedEvent): Promise<void> => {
  try {
    const client = getEventBridgeClient();
    const busName = getEventBusName();
    
    const entry = {
      Source: 'kx-event-tracking',
      DetailType: `${event.entityType}.${event.eventType}`,
      Detail: JSON.stringify(event),
      EventBusName: busName,
      Time: new Date(event.occurredAt),
    };

    console.log(`⚡ Sending EventBridge event ${event.eventId} (${event.entityType}.${event.eventType}) to bus: ${busName}`);
    
    const command = new PutEventsCommand({ Entries: [entry] });
    const result = await client.send(command);
    
    if (result.FailedEntryCount && result.FailedEntryCount > 0) {
      const errorCode = result.Entries?.[0]?.ErrorCode;
      const errorMessage = result.Entries?.[0]?.ErrorMessage;
      console.error(`⚡ EventBridge FAILED for event ${event.eventId}: ${errorCode} - ${errorMessage}`);
      throw new Error(`EventBridge entry failed: ${errorCode} - ${errorMessage}`);
    } else {
      console.log(`⚡ EventBridge SUCCESS for event ${event.eventId} (${event.entityType}.${event.eventType}) → Bus: ${busName}`);
    }
  } catch (error) {
    // Fire-and-forget: log errors, don't throw - but make error visible
    if (error instanceof Error && error.message.includes('AccessDeniedException')) {
      console.warn('⚠️ EventBridge permissions missing - add events:PutEvents permission to Lambda role');
    } else if (error instanceof Error && error.message.includes('EVENT_BUS_NAME')) {
      console.warn('⚠️ EVENT_BUS_NAME environment variable missing');
    } else {
      console.warn('⚠️ EventBridge publishing failed (real-time notifications disabled):', error);
    }
    
    // Re-throw to be caught by Promise.allSettled in publish.ts
    throw error;
  }
};
