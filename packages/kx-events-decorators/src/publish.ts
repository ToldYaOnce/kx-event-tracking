import { v4 as uuidv4 } from 'uuid';
import { TrackedEvent, LambdaEvent, LambdaContext } from './types';
import { sendMessageToQueue } from './sqsClient';

/**
 * Extracts clientId from request payload or context
 * Priority: headers > body > authorizer context
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
 * Extracts previousEventId from request headers or body
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
 * Publishes a TrackedEvent to SQS
 * Fire-and-forget: logs errors, doesn't throw
 */
export const publishEvent = async (event: TrackedEvent): Promise<void> => {
  try {
    // Validate required fields
    if (!event.eventId || !event.clientId || !event.entityType || !event.eventType || !event.occurredAt) {
      console.error('Invalid TrackedEvent: missing required fields', event);
      return;
    }

    const messageBody = JSON.stringify(event);
    await sendMessageToQueue(messageBody);
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

