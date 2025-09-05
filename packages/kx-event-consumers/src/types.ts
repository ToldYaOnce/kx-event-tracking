import type { EventBridgeEvent } from 'aws-lambda';

/**
 * KX Event Tracking event structure as received from EventBridge
 */
export interface KxTrackedEvent {
  eventId: string;
  clientId: string;
  previousEventId?: string | null;
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
 * EventBridge event containing KX tracked event data
 */
export type KxEventBridgeEvent = EventBridgeEvent<string, KxTrackedEvent>;

/**
 * Event handler function type for KX events
 */
export type KxEventHandler<T = KxTrackedEvent> = (
  event: EventBridgeEvent<string, T>
) => Promise<void> | void;

/**
 * Event pattern options for filtering KX events
 */
export interface KxEventPattern {
  entityTypes?: string[];
  eventTypes?: string[];
  clientIds?: string[];
  sources?: string[];
  detailTypePrefix?: string;
  pointsAwarded?: {
    exists?: boolean;
    numeric?: [string, number]; // e.g., [">", 0]
  };
  metadata?: Record<string, any>;
}

/**
 * Consumer configuration options
 */
export interface ConsumerConfig {
  serviceName: string;
  region?: string;
  account?: string;
  stackName?: string;
}

/**
 * Event routing configuration
 */
export interface EventRoute {
  pattern: KxEventPattern;
  handler: KxEventHandler;
  description?: string;
}

/**
 * Service discovery result
 */
export interface ServiceDiscoveryResult {
  eventBusArn: string;
  eventBusName: string;
  serviceInfo: {
    version: string;
    eventSources: string[];
    supportedEvents: string[];
    region: string;
    account: string;
  };
}
