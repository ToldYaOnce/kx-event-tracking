import { KxEventBridgeEvent, EventUtils } from '@toldyaonce/kx-event-consumers';

/**
 * Example Lambda handler for consuming KX Event Tracking events
 */
export const handler = async (event: KxEventBridgeEvent) => {
  console.log('Received KX Event:', JSON.stringify(event, null, 2));

  // Extract event information
  const eventInfo = EventUtils.extractEventInfo(event);
  const { entityType, eventType } = EventUtils.parseDetailType(event['detail-type']);
  
  console.log('Event Info:', {
    source: eventInfo.source,
    entityType,
    eventType,
    clientId: event.detail.clientId,
    userId: event.detail.userId,
    occurredAt: event.detail.occurredAt,
  });

  try {
    // Route based on event type
    switch (`${entityType}.${eventType}`) {
      case 'user.user_created':
        await handleUserCreated(event.detail);
        break;
        
      case 'user.user_updated':
        await handleUserUpdated(event.detail);
        break;
        
      case 'payment.payment_completed':
        await handlePaymentCompleted(event.detail);
        break;
        
      case 'qr.qr.get':
        await handleQrAccessed(event.detail);
        break;
        
      default:
        console.log('Unhandled event type:', event['detail-type']);
        await handleGenericEvent(event.detail);
    }

    console.log('Successfully processed event:', event.detail.eventId);
    return { statusCode: 200, message: 'Event processed successfully' };
    
  } catch (error) {
    console.error('Failed to process event:', error);
    throw error; // This will cause EventBridge to retry
  }
};

/**
 * Handle user creation events
 */
async function handleUserCreated(eventDetail: any) {
  console.log('Processing user creation:', {
    userId: eventDetail.userId,
    clientId: eventDetail.clientId,
    source: eventDetail.source,
  });

  // Example: Send welcome email
  if (eventDetail.userId) {
    await sendWelcomeEmail(eventDetail.userId, eventDetail.clientId);
  }

  // Example: Award welcome points
  if (eventDetail.pointsAwarded) {
    await awardPoints(eventDetail.userId, eventDetail.pointsAwarded);
  }
}

/**
 * Handle user update events
 */
async function handleUserUpdated(eventDetail: any) {
  console.log('Processing user update:', {
    userId: eventDetail.userId,
    clientId: eventDetail.clientId,
    metadata: eventDetail.metadata,
  });

  // Example: Send profile update notification
  await sendProfileUpdateNotification(eventDetail.userId);
}

/**
 * Handle payment completion events
 */
async function handlePaymentCompleted(eventDetail: any) {
  console.log('Processing payment completion:', {
    entityId: eventDetail.entityId, // Payment ID
    clientId: eventDetail.clientId,
    pointsAwarded: eventDetail.pointsAwarded,
    metadata: eventDetail.metadata,
  });

  // Example: Send payment confirmation
  await sendPaymentConfirmation(eventDetail.entityId, eventDetail.clientId);

  // Example: Award loyalty points
  if (eventDetail.pointsAwarded) {
    await awardPoints(eventDetail.userId, eventDetail.pointsAwarded);
  }
}

/**
 * Handle QR code access events
 */
async function handleQrAccessed(eventDetail: any) {
  console.log('Processing QR access:', {
    entityId: eventDetail.entityId, // QR ID
    clientId: eventDetail.clientId,
    sessionId: eventDetail.sessionId,
    metadata: eventDetail.metadata,
  });

  // Example: Track QR analytics
  await trackQrAnalytics(eventDetail.entityId, eventDetail.clientId);
}

/**
 * Handle any other events
 */
async function handleGenericEvent(eventDetail: any) {
  console.log('Processing generic event:', {
    eventId: eventDetail.eventId,
    entityType: eventDetail.entityType,
    eventType: eventDetail.eventType,
    clientId: eventDetail.clientId,
  });

  // Example: Log to analytics system
  await logToAnalytics(eventDetail);
}

// Mock implementation functions (replace with your actual logic)

async function sendWelcomeEmail(userId: string, clientId: string) {
  console.log(`📧 Sending welcome email to user ${userId} for client ${clientId}`);
  // Your email sending logic here
}

async function sendProfileUpdateNotification(userId: string) {
  console.log(`🔔 Sending profile update notification to user ${userId}`);
  // Your notification logic here
}

async function sendPaymentConfirmation(paymentId: string, clientId: string) {
  console.log(`💳 Sending payment confirmation for payment ${paymentId} to client ${clientId}`);
  // Your payment confirmation logic here
}

async function awardPoints(userId: string, points: number) {
  console.log(`🎯 Awarding ${points} points to user ${userId}`);
  // Your points system logic here
}

async function trackQrAnalytics(qrId: string, clientId: string) {
  console.log(`📊 Tracking QR analytics for QR ${qrId} and client ${clientId}`);
  // Your analytics tracking logic here
}

async function logToAnalytics(eventDetail: any) {
  console.log(`📈 Logging event to analytics:`, {
    eventId: eventDetail.eventId,
    entityType: eventDetail.entityType,
    eventType: eventDetail.eventType,
    clientId: eventDetail.clientId,
    timestamp: eventDetail.occurredAt,
  });
  // Your analytics logging logic here
}


