import { v4 as uuidv4 } from 'uuid';
import { TrackedEvent, LambdaEvent, LambdaContext } from './types';
import { sendMessageToQueue } from './sqsClient';
import { publishToEventBridge } from './eventBridgeClient';

/**
 * Extracts clientId from request payload or context
 * Priority: headers > query params > body > authorizer context
 */
export const extractClientId = (event: LambdaEvent, context: LambdaContext): string | null => {
  // Try headers first (case-insensitive)
  if (event.headers) {
    const clientIdHeader = Object.keys(event.headers).find(
      key => key.toLowerCase() === 'x-client-id' || key.toLowerCase() === 'client-id'
    );
    if (clientIdHeader && event.headers[clientIdHeader]) {
      return event.headers[clientIdHeader];
    }
  }

  // Try query parameters (for GET requests)
  if ((event as any).queryStringParameters?.clientId) {
    return (event as any).queryStringParameters.clientId;
  }

  // Try body (parsed or string)
  if (event.body) {
    let bodyObj: any;
    try {
      bodyObj = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      if (bodyObj.clientId) {
        return bodyObj.clientId;
      }
    } catch {
      // Ignore parsing errors
    }
  }

  // Try authorizer context
  if (event.requestContext?.authorizer?.clientId) {
    return event.requestContext.authorizer.clientId;
  }

  // Try direct event properties (for worker lambdas)
  if ((event as any).clientId) {
    return (event as any).clientId;
  }

  return null;
};

/**
 * Extracts previousEventId from request headers, query params, or body
 */
export const extractPreviousEventId = (event: LambdaEvent): string | null => {
  // Try headers first (case-insensitive)
  if (event.headers) {
    const prevEventIdHeader = Object.keys(event.headers).find(
      key => key.toLowerCase() === 'x-previous-event-id' || key.toLowerCase() === 'previous-event-id'
    );
    if (prevEventIdHeader && event.headers[prevEventIdHeader]) {
      return event.headers[prevEventIdHeader];
    }
  }

  // Try query parameters
  if ((event as any).queryStringParameters?.previousEventId) {
    return (event as any).queryStringParameters.previousEventId;
  }

  // Try body (parsed or string)
  if (event.body) {
    let bodyObj: any;
    try {
      bodyObj = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
      if (bodyObj.previousEventId) {
        return bodyObj.previousEventId;
      }
    } catch {
      // Ignore parsing errors
    }
  }

  // Try direct event properties
  if ((event as any).previousEventId) {
    return (event as any).previousEventId;
  }

  return null;
};

/**
 * Publishes a TrackedEvent to both SQS and EventBridge
 * Fire-and-forget: logs errors, doesn't throw
 */
export const publishEvent = async (event: TrackedEvent): Promise<void> => {
  try {
    // Validate required fields
    if (!event.eventId || !event.clientId || !event.entityType || !event.eventType || !event.occurredAt) {
      console.error('Invalid TrackedEvent: missing required fields', event);
      return;
    }

    // Dual publishing: SQS for guaranteed delivery + RDS, EventBridge for real-time
    const messageBody = JSON.stringify(event);
    
    console.log(`🚀 Starting dual publish for event ${event.eventId}: ${event.entityType}.${event.eventType}`);
    
    // Fire both simultaneously (don't await both to avoid blocking)
    const sqsPromise = sendMessageToQueue(messageBody);
    const eventBridgePromise = publishToEventBridge(event);
    
    // Wait for both to complete - CRITICAL for EventBridge delivery
    // SQS failures are critical, EventBridge failures are warnings
    const results = await Promise.allSettled([sqsPromise, eventBridgePromise]);
    
    const sqsResult = results[0];
    const eventBridgeResult = results[1];
    
    if (sqsResult.status === 'rejected') {
      console.error(`🚨 SQS publishing FAILED for event ${event.eventId} (CRITICAL - data loss risk):`, sqsResult.reason);
      // Re-throw SQS failures as they're critical for data persistence
      throw sqsResult.reason;
    } else {
      console.log(`✅ SQS publishing SUCCESS for event ${event.eventId}: ${event.entityType}.${event.eventType} → Queue`);
    }
    
    if (eventBridgeResult.status === 'rejected') {
      console.warn(`⚠️ EventBridge publishing FAILED for event ${event.eventId} (real-time notifications disabled):`, eventBridgeResult.reason);
      // Don't throw EventBridge failures - they're non-critical
    } else {
      console.log(`🚀 EventBridge publishing SUCCESS for event ${event.eventId}: ${event.entityType}.${event.eventType} → Real-time consumers`);
    }
  } catch (error) {
    console.error('Failed to publish event:', error);
  }
};

/**
 * Creates a TrackedEvent from the provided parameters and context
 */
export const createTrackedEvent = (
  entityType: string,
  eventType: string,
  event: LambdaEvent,
  context: LambdaContext,
  extra?: Partial<TrackedEvent>
): TrackedEvent | null => {
  const clientId = extractClientId(event, context);
  if (!clientId) {
    console.error('Cannot create TrackedEvent: clientId not found in request');
    return null;
  }

  const previousEventId = extractPreviousEventId(event);

  return {
    eventId: uuidv4(),
    clientId,
    previousEventId,
    entityType,
    eventType,
    occurredAt: new Date().toISOString(),
    ...extra,
  };
};

