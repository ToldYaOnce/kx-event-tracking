import { SQSEvent, SQSRecord, Context } from 'aws-lambda';
import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge';
import { insertEvents, closeDbConnection, initializeSchema } from './db';

// Initialize EventBridge client
const eventBridgeClient = new EventBridgeClient({});

interface TrackedEvent {
  eventId: string;
  clientId: string;
  previousEventId: string | null;
  userId?: string;
  entityId?: string;
  entityType: string;
  eventType: string;
  source?: string;
  campaignId?: string;
  pointsAwarded?: number;
  sessionId?: string;
  occurredAt: string;
  metadata?: Record<string, any>;
}

/**
 * Validates a TrackedEvent against the contract
 */
function validateTrackedEvent(event: any): event is TrackedEvent {
  if (!event || typeof event !== 'object') {
    return false;
  }

  // Required fields
  if (!event.eventId || typeof event.eventId !== 'string') {
    console.error('Invalid event: missing or invalid eventId');
    return false;
  }

  if (!event.clientId || typeof event.clientId !== 'string') {
    console.error('Invalid event: missing or invalid clientId');
    return false;
  }

  if (!event.entityType || typeof event.entityType !== 'string') {
    console.error('Invalid event: missing or invalid entityType');
    return false;
  }

  if (!event.eventType || typeof event.eventType !== 'string') {
    console.error('Invalid event: missing or invalid eventType');
    return false;
  }

  if (!event.occurredAt || typeof event.occurredAt !== 'string') {
    console.error('Invalid event: missing or invalid occurredAt');
    return false;
  }

  // Validate ISO8601 date format
  try {
    new Date(event.occurredAt);
  } catch {
    console.error('Invalid event: occurredAt is not a valid ISO8601 date');
    return false;
  }

  // Optional fields type validation
  if (event.previousEventId !== null && event.previousEventId !== undefined && typeof event.previousEventId !== 'string') {
    console.error('Invalid event: previousEventId must be string or null');
    return false;
  }

  if (event.userId !== undefined && typeof event.userId !== 'string') {
    console.error('Invalid event: userId must be string');
    return false;
  }

  if (event.entityId !== undefined && typeof event.entityId !== 'string') {
    console.error('Invalid event: entityId must be string');
    return false;
  }

  if (event.source !== undefined && typeof event.source !== 'string') {
    console.error('Invalid event: source must be string');
    return false;
  }

  if (event.campaignId !== undefined && typeof event.campaignId !== 'string') {
    console.error('Invalid event: campaignId must be string');
    return false;
  }

  if (event.pointsAwarded !== undefined && typeof event.pointsAwarded !== 'number') {
    console.error('Invalid event: pointsAwarded must be number');
    return false;
  }

  if (event.sessionId !== undefined && typeof event.sessionId !== 'string') {
    console.error('Invalid event: sessionId must be string');
    return false;
  }

  if (event.metadata !== undefined && (typeof event.metadata !== 'object' || Array.isArray(event.metadata))) {
    console.error('Invalid event: metadata must be an object');
    return false;
  }

  return true;
}

/**
 * Parses and validates SQS messages
 */
function parseAndValidateMessages(records: SQSRecord[]): TrackedEvent[] {
  const validEvents: TrackedEvent[] = [];

  for (const record of records) {
    try {
      const event = JSON.parse(record.body);
      
      if (validateTrackedEvent(event)) {
        validEvents.push(event);
      } else {
        console.error('Skipping invalid event from SQS message:', record.messageId);
      }
    } catch (error) {
      console.error('Failed to parse SQS message:', record.messageId, error);
    }
  }

  return validEvents;
}

/**
 * Publishes events to EventBridge after successful RDS insertion
 */
async function publishToEventBridge(events: TrackedEvent[]): Promise<void> {
  const eventBusArn = process.env.EVENT_BUS_ARN;
  const eventBusName = process.env.EVENT_BUS_NAME;
  
  if (!eventBusArn && !eventBusName) {
    console.warn('Neither EVENT_BUS_ARN nor EVENT_BUS_NAME configured, skipping EventBridge publishing');
    return;
  }

  if (events.length === 0) {
    return;
  }

  // Use explicit bus name if provided, otherwise extract from ARN
  let busName: string;
  if (eventBusName) {
    busName = eventBusName;
  } else if (eventBusArn) {
    // Extract bus name from ARN for EventBridge API
    // ARN format: arn:aws:events:region:account:event-bus/bus-name
    busName = eventBusArn.split('/').pop() || eventBusArn;
  } else {
    console.warn('No valid EventBridge configuration found');
    return;
  }

  console.log(`Publishing ${events.length} events to EventBridge bus: ${busName}${eventBusArn ? ` (ARN: ${eventBusArn})` : ''}`);

  try {
    // EventBridge has a limit of 10 entries per PutEvents call
    const batchSize = 10;
    const batches = [];
    
    for (let i = 0; i < events.length; i += batchSize) {
      batches.push(events.slice(i, i + batchSize));
    }

    for (const batch of batches) {
      const entries = batch.map(event => ({
        Source: 'kx-event-tracking',
        DetailType: `${event.entityType}.${event.eventType}`,
        Detail: JSON.stringify(event),
        EventBusName: busName,
        Time: new Date(event.occurredAt),
      }));

      // Log detailed information about what we're publishing
      console.log('📤 EventBridge entries being published:', JSON.stringify({
        busName,
        entriesCount: entries.length,
        entries: entries.map(entry => ({
          Source: entry.Source,
          DetailType: entry.DetailType,
          EventBusName: entry.EventBusName,
          Time: entry.Time,
          DetailPreview: JSON.parse(entry.Detail).eventId || 'No eventId'
        }))
      }, null, 2));

      const command = new PutEventsCommand({ Entries: entries });
      const result = await eventBridgeClient.send(command);
      
      if (result.FailedEntryCount && result.FailedEntryCount > 0) {
        console.warn(`EventBridge publishing: ${result.FailedEntryCount} failed entries out of ${entries.length}`);
        result.Entries?.forEach((entry, index) => {
          if (entry.ErrorCode) {
            console.error(`EventBridge entry ${index} failed:`, entry.ErrorCode, entry.ErrorMessage);
          }
        });
      } else {
        console.log(`Successfully published ${entries.length} events to EventBridge`);
      }
    }
  } catch (error) {
    console.error('Failed to publish events to EventBridge:', error);
    // Don't throw - this is fire-and-forget to avoid affecting RDS insertion
  }
}

/**
 * Lambda handler for processing SQS events
 */
export const handler = async (event: SQSEvent, context: Context): Promise<void> => {
  console.log(`Processing ${event.Records.length} SQS messages`);

  try {
    // Initialize database schema on first run
    await initializeSchema();

    // Parse and validate messages
    const validEvents = parseAndValidateMessages(event.Records);
    
    if (validEvents.length === 0) {
      console.log('No valid events to process');
      return;
    }

    console.log(`Processing ${validEvents.length} valid events`);

    // Batch insert events with idempotency
    await insertEvents(validEvents);

    // Publish events to EventBridge after successful RDS insertion
    await publishToEventBridge(validEvents);

    console.log('Successfully processed all events');
  } catch (error) {
    console.error('Failed to process SQS events:', error);
    throw error; // This will cause the messages to be retried or sent to DLQ
  } finally {
    // Close DB connection per invocation
    await closeDbConnection();
  }
};

