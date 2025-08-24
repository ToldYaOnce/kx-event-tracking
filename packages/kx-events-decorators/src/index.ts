// Main exports
export { EventTracking } from './decorators/EventTracking';
export { publishEvent, createTrackedEvent, extractClientId, extractPreviousEventId } from './publish';

// Type exports
export type {
  TrackedEvent,
  EventTrackingOptions,
  RequestContext,
  LambdaEvent,
  LambdaContext,
  LambdaHandler,
} from './types';

// Utility exports
export { getEventsQueueUrl } from './env';
export { getSQSClient, sendMessageToQueue } from './sqsClient';

