// Main exports
export { EventBridgeDiscovery, EventUtils } from './utils/eventbridge-discovery';
export type { EventBridgeServiceInfo } from './utils/eventbridge-discovery';

// Type exports
export type {
  KxTrackedEvent,
  KxEventBridgeEvent,
  KxEventHandler,
  KxEventPattern,
  ConsumerConfig,
  EventRoute,
  ServiceDiscoveryResult,
} from './types';

// Re-export useful AWS CDK types for convenience
export type { IEventBus } from 'aws-cdk-lib/aws-events';
export type { EventBridgeEvent } from 'aws-lambda';
