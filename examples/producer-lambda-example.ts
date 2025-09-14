import { APIGatewayProxyEvent, APIGatewayProxyResult, Context } from 'aws-lambda';
import { EventTracking } from '@toldyaonce/kx-events-decorators';

/**
 * Example Lambda handlers showing @EventTracking decorator usage
 * 
 * IMPORTANT: Your CDK stack must grant EventBridge permissions for real-time delivery!
 * See examples/producer-stack-example.ts for the required permissions.
 */

export class UserService {
  /**
   * Creates a new user and tracks the event
   * 
   * Events published:
   * - SQS: Guaranteed delivery to RDS (5+ second delay)
   * - EventBridge: Real-time delivery to consumers (0-1 second) ⚡
   */
  @EventTracking('user', 'user_created', {
    source: 'api',
    pointsAwarded: 100
  })
  async createUser(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
    // Your business logic here
    const userData = JSON.parse(event.body || '{}');
    
    // Simulate user creation
    const user = {
      userId: `user_${Date.now()}`,
      email: userData.email,
      name: userData.name,
      createdAt: new Date().toISOString()
    };
    
    // The @EventTracking decorator will automatically publish:
    // {
    //   "eventId": "uuid",
    //   "clientId": "extracted-from-headers-or-body",
    //   "entityType": "user",
    //   "eventType": "user_created", 
    //   "entityId": "user_123",
    //   "source": "api",
    //   "pointsAwarded": 100,
    //   "occurredAt": "2024-01-01T12:00:00.000Z",
    //   "metadata": { /* request context */ }
    // }
    
    return {
      statusCode: 201,
      body: JSON.stringify({
        success: true,
        user,
        message: 'User created successfully - event published to EventBridge + SQS'
      })
    };
  }

  @EventTracking('user', 'user_updated')
  async updateUser(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
    const userId = event.pathParameters?.userId;
    const updates = JSON.parse(event.body || '{}');
    
    // Your update logic here
    const updatedUser = {
      userId,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        user: updatedUser,
        message: 'User updated - real-time notifications sent!'
      })
    };
  }
}

export class OrderService {
  @EventTracking('order', 'order_placed', {
    source: 'api',
    pointsAwarded: 50
  })
  async placeOrder(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
    const orderData = JSON.parse(event.body || '{}');
    
    const order = {
      orderId: `order_${Date.now()}`,
      userId: orderData.userId,
      items: orderData.items,
      total: orderData.total,
      status: 'placed',
      placedAt: new Date().toISOString()
    };
    
    return {
      statusCode: 201,
      body: JSON.stringify({
        success: true,
        order,
        message: 'Order placed - inventory and notification services notified instantly!'
      })
    };
  }

  @EventTracking('order', 'order_shipped')
  async shipOrder(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
    const orderId = event.pathParameters?.orderId;
    
    // Your shipping logic here
    const shippedOrder = {
      orderId,
      status: 'shipped',
      trackingNumber: `TRK${Date.now()}`,
      shippedAt: new Date().toISOString()
    };
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        order: shippedOrder,
        message: 'Order shipped - customer notified via real-time EventBridge!'
      })
    };
  }
}

export class PaymentService {
  @EventTracking('payment', 'payment_completed', {
    source: 'payment-gateway'
  })
  async processPayment(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
    const paymentData = JSON.parse(event.body || '{}');
    
    // Simulate payment processing
    const payment = {
      paymentId: `pay_${Date.now()}`,
      orderId: paymentData.orderId,
      amount: paymentData.amount,
      currency: paymentData.currency || 'USD',
      status: 'completed',
      processedAt: new Date().toISOString()
    };
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        payment,
        message: 'Payment processed - order fulfillment triggered instantly!'
      })
    };
  }

  @EventTracking('payment', 'payment_failed', {
    source: 'payment-gateway'
  })
  async handleFailedPayment(event: APIGatewayProxyEvent, context: Context): Promise<APIGatewayProxyResult> {
    const paymentData = JSON.parse(event.body || '{}');
    
    const failedPayment = {
      paymentId: `pay_${Date.now()}`,
      orderId: paymentData.orderId,
      amount: paymentData.amount,
      status: 'failed',
      errorCode: paymentData.errorCode,
      failedAt: new Date().toISOString()
    };
    
    return {
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        payment: failedPayment,
        message: 'Payment failed - customer and support team notified immediately'
      })
    };
  }
}

// Export handlers for CDK
const userService = new UserService();
const orderService = new OrderService();
const paymentService = new PaymentService();

export const createUser = userService.createUser.bind(userService);
export const updateUser = userService.updateUser.bind(userService);
export const placeOrder = orderService.placeOrder.bind(orderService);
export const shipOrder = orderService.shipOrder.bind(orderService);
export const processPayment = paymentService.processPayment.bind(paymentService);
export const handleFailedPayment = paymentService.handleFailedPayment.bind(paymentService);
