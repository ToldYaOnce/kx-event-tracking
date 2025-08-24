import { EventTrackingOptions, LambdaHandler, LambdaEvent, LambdaContext } from '../types';
import { createTrackedEvent, publishEvent } from '../publish';

/**
 * EventTracking decorator for Lambda handlers
 * Wraps a Lambda handler and publishes a TrackedEvent to SQS after successful execution
 * 
 * @param entityType - The type of entity being tracked
 * @param eventType - The type of event being tracked
 * @param extra - Additional event properties (optional)
 */
export function EventTracking(
  entityType: string,
  eventType: string,
  extra?: Partial<EventTrackingOptions['extra']>
) {
  return function <TEvent = any, TResult = any>(
    target: any,
    propertyName: string,
    descriptor: TypedPropertyDescriptor<(...args: any[]) => any>
  ) {
    const method = descriptor.value;
    if (!method) {
      throw new Error('EventTracking decorator can only be applied to methods');
    }

    descriptor.value = async function (this: any, event: TEvent, context: any): Promise<TResult> {
      let result: TResult;
      
      try {
        // Execute the original handler
        result = await method.call(this, event, context);
      } catch (error) {
        // Don't publish events for failed executions
        throw error;
      }

      // After successful execution, publish the event
      try {
        const trackedEvent = createTrackedEvent(entityType, eventType, event as any, context, extra);
        if (trackedEvent) {
          await publishEvent(trackedEvent);
        }
      } catch (error) {
        // Fire-and-forget: log but don't fail the handler
        console.error('Failed to publish tracked event:', error);
      }

      return result;
    };

    return descriptor;
  };
}

