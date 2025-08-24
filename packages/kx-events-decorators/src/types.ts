export interface TrackedEvent {
  eventId: string; // uuid v4, required
  clientId: string; // required; comes from request payload/context
  previousEventId: string | null; // links to immediate predecessor; null = journey root
  userId?: string;
  entityId?: string;
  entityType: string; // required
  eventType: string; // required
  source?: string;
  campaignId?: string;
  pointsAwarded?: number;
  sessionId?: string;
  occurredAt: string; // ISO8601 string, required
  metadata?: Record<string, any>; // JSON object, optional
}

export interface EventTrackingOptions {
  entityType: string;
  eventType: string;
  extra?: Partial<TrackedEvent>;
}

export interface RequestContext {
  headers?: Record<string, string>;
  body?: string | Record<string, any>;
  authorizer?: Record<string, any>;
  requestContext?: Record<string, any>;
}

export interface LambdaEvent {
  headers?: Record<string, string | undefined>;
  body?: string;
  requestContext?: {
    authorizer?: Record<string, any>;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface LambdaContext {
  callbackWaitsForEmptyEventLoop?: boolean;
  functionName?: string;
  functionVersion?: string;
  invokedFunctionArn?: string;
  memoryLimitInMB?: string;
  awsRequestId?: string;
  logGroupName?: string;
  logStreamName?: string;
  identity?: any;
  clientContext?: any;
  getRemainingTimeInMillis?: () => number;
  [key: string]: any;
}

export type LambdaHandler<TEvent = any, TResult = any> = (
  event: TEvent,
  context: LambdaContext
) => Promise<TResult>;

