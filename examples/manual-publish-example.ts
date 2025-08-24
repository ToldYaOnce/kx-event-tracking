/**
 * Example: Manual Event Publishing
 * 
 * This example shows how to manually publish events using the publishEvent helper
 * without using the decorator. This is useful for complex scenarios where you need
 * more control over event publishing or when working with non-Lambda functions.
 */

import { Context } from 'aws-lambda';
import { publishEvent, createTrackedEvent, TrackedEvent } from 'kx-events-decorators';

interface PaymentEvent {
  paymentId: string;
  clientId: string;
  userId: string;
  amount: number;
  currency: string;
  method: string;
  status: 'pending' | 'completed' | 'failed';
}

interface OrderEvent {
  orderId: string;
  clientId: string;
  userId: string;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  total: number;
}

class PaymentService {
  /**
   * Process payment with manual event tracking
   * This example shows how to publish multiple related events
   */
  async processPayment(
    event: { body: string; headers: Record<string, string> },
    context: Context
  ): Promise<{ success: boolean; paymentId: string }> {
    const paymentData: PaymentEvent = JSON.parse(event.body);
    const paymentId = `payment_${Date.now()}`;
    
    try {
      // Start payment processing
      await this.publishPaymentStartedEvent(paymentData, paymentId, event, context);
      
      // Simulate payment processing
      const success = await this.processPaymentWithProvider(paymentData);
      
      if (success) {
        // Payment succeeded
        await this.publishPaymentCompletedEvent(paymentData, paymentId, event, context);
        
        // Award points for successful payment
        await this.publishPointsAwardedEvent(paymentData, paymentId, event, context);
        
        return { success: true, paymentId };
      } else {
        // Payment failed
        await this.publishPaymentFailedEvent(paymentData, paymentId, event, context);
        
        return { success: false, paymentId };
      }
    } catch (error) {
      console.error('Payment processing error:', error);
      
      // Publish error event
      await this.publishPaymentErrorEvent(paymentData, paymentId, error, event, context);
      
      throw error;
    }
  }

  private async publishPaymentStartedEvent(
    paymentData: PaymentEvent,
    paymentId: string,
    event: any,
    context: Context
  ): Promise<void> {
    const trackedEvent = createTrackedEvent(
      'payment',
      'payment_started',
      event,
      context,
      {
        entityId: paymentId,
        userId: paymentData.userId,
        source: 'payment-service',
        metadata: {
          amount: paymentData.amount,
          currency: paymentData.currency,
          method: paymentData.method,
        },
      }
    );

    if (trackedEvent) {
      await publishEvent(trackedEvent);
    }
  }

  private async publishPaymentCompletedEvent(
    paymentData: PaymentEvent,
    paymentId: string,
    event: any,
    context: Context
  ): Promise<void> {
    const trackedEvent = createTrackedEvent(
      'payment',
      'payment_completed',
      event,
      context,
      {
        entityId: paymentId,
        userId: paymentData.userId,
        source: 'payment-service',
        pointsAwarded: Math.floor(paymentData.amount / 10), // 1 point per $10
        metadata: {
          amount: paymentData.amount,
          currency: paymentData.currency,
          method: paymentData.method,
          processingTime: Date.now(),
        },
      }
    );

    if (trackedEvent) {
      await publishEvent(trackedEvent);
    }
  }

  private async publishPaymentFailedEvent(
    paymentData: PaymentEvent,
    paymentId: string,
    event: any,
    context: Context
  ): Promise<void> {
    const trackedEvent = createTrackedEvent(
      'payment',
      'payment_failed',
      event,
      context,
      {
        entityId: paymentId,
        userId: paymentData.userId,
        source: 'payment-service',
        metadata: {
          amount: paymentData.amount,
          currency: paymentData.currency,
          method: paymentData.method,
          failureReason: 'Payment declined by provider',
        },
      }
    );

    if (trackedEvent) {
      await publishEvent(trackedEvent);
    }
  }

  private async publishPointsAwardedEvent(
    paymentData: PaymentEvent,
    paymentId: string,
    event: any,
    context: Context
  ): Promise<void> {
    const points = Math.floor(paymentData.amount / 10);
    
    if (points > 0) {
      const trackedEvent = createTrackedEvent(
        'loyalty',
        'points_awarded',
        event,
        context,
        {
          entityId: paymentId,
          userId: paymentData.userId,
          source: 'loyalty-service',
          pointsAwarded: points,
          metadata: {
            reason: 'payment_completed',
            paymentId: paymentId,
            paymentAmount: paymentData.amount,
          },
        }
      );

      if (trackedEvent) {
        await publishEvent(trackedEvent);
      }
    }
  }

  private async publishPaymentErrorEvent(
    paymentData: PaymentEvent,
    paymentId: string,
    error: any,
    event: any,
    context: Context
  ): Promise<void> {
    const trackedEvent = createTrackedEvent(
      'payment',
      'payment_error',
      event,
      context,
      {
        entityId: paymentId,
        userId: paymentData.userId,
        source: 'payment-service',
        metadata: {
          amount: paymentData.amount,
          currency: paymentData.currency,
          method: paymentData.method,
          error: error.message || 'Unknown error',
          stack: error.stack,
        },
      }
    );

    if (trackedEvent) {
      await publishEvent(trackedEvent);
    }
  }

  private async processPaymentWithProvider(paymentData: PaymentEvent): Promise<boolean> {
    // Simulate payment processing
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // 90% success rate for demo
    return Math.random() > 0.1;
  }
}

/**
 * Example: Publishing events in a batch operation
 */
class OrderService {
  async createOrder(orderData: OrderEvent, event: any, context: Context): Promise<string> {
    const orderId = `order_${Date.now()}`;
    
    // Create multiple events for order creation
    const events: TrackedEvent[] = [];
    
    // Order created event
    const orderCreatedEvent = createTrackedEvent(
      'order',
      'order_created',
      event,
      context,
      {
        entityId: orderId,
        userId: orderData.userId,
        source: 'order-service',
        metadata: {
          itemCount: orderData.items.length,
          total: orderData.total,
          items: orderData.items,
        },
      }
    );
    
    if (orderCreatedEvent) {
      events.push(orderCreatedEvent);
    }

    // Individual item events
    for (const item of orderData.items) {
      const itemEvent = createTrackedEvent(
        'product',
        'product_ordered',
        event,
        context,
        {
          entityId: item.productId,
          userId: orderData.userId,
          source: 'order-service',
          metadata: {
            orderId: orderId,
            quantity: item.quantity,
            price: item.price,
          },
        }
      );
      
      if (itemEvent) {
        events.push(itemEvent);
      }
    }

    // Publish all events (fire-and-forget)
    for (const evt of events) {
      await publishEvent(evt);
    }

    return orderId;
  }
}

/**
 * Example: Direct event publishing without Lambda context
 */
export async function publishCustomEvent(
  clientId: string,
  entityType: string,
  eventType: string,
  additionalData?: Partial<TrackedEvent>
): Promise<void> {
  const event: TrackedEvent = {
    eventId: `custom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    clientId,
    previousEventId: null,
    entityType,
    eventType,
    occurredAt: new Date().toISOString(),
    source: 'custom',
    ...additionalData,
  };

  await publishEvent(event);
}

// Export service instances
export const paymentService = new PaymentService();
export const orderService = new OrderService();

/**
 * Usage examples:
 * 
 * // In a Lambda handler
 * export const handler = async (event, context) => {
 *   const result = await paymentService.processPayment(event, context);
 *   return {
 *     statusCode: 200,
 *     body: JSON.stringify(result)
 *   };
 * };
 * 
 * // Direct event publishing
 * await publishCustomEvent('client_123', 'user', 'profile_updated', {
 *   userId: 'user_456',
 *   metadata: { field: 'email', oldValue: 'old@example.com', newValue: 'new@example.com' }
 * });
 * 
 * // Batch order creation
 * const orderId = await orderService.createOrder({
 *   orderId: '',
 *   clientId: 'client_123',
 *   userId: 'user_456',
 *   items: [
 *     { productId: 'prod_1', quantity: 2, price: 29.99 },
 *     { productId: 'prod_2', quantity: 1, price: 49.99 }
 *   ],
 *   total: 109.97
 * }, event, context);
 */
