# 🚀 Getting Started - Dead Simple Event Consumers

**Create an event consumer in 3 steps, 5 minutes.**

## Step 1: Install (30 seconds)

```bash
npm install @toldyaonce/kx-event-consumers aws-cdk-lib constructs
```

## Step 2: Create Consumer Stack (2 minutes)

Create `consumer-stack.ts`:

```typescript
import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { EventBridgeDiscovery } from '@toldyaonce/kx-event-consumers';

export class MyConsumerStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Get EventBridge (dead simple!)
    const kxEvents = EventBridgeDiscovery.importEventBridge(
      this, 'KxEvents', 'kx-event-tracking'
    );

    // Create Lambda
    const myLambda = new NodejsFunction(this, 'MyEventHandler', {
      entry: 'src/handlers/events.ts', // Your handler file
      // Or use inline code for quick testing:
      // code: lambda.Code.fromInline(`
      //   exports.handler = async (event) => {
      //     console.log('Got event:', event['detail-type']);
      //     console.log('Event data:', event.detail);
      //     return { statusCode: 200 };
      //   };
      // `),
    });

    // Listen to user events
    new events.Rule(this, 'UserEvents', {
      eventBus: kxEvents,
      eventPattern: EventBridgeDiscovery.createEventPattern({
        entityTypes: ['user'],
      }),
      targets: [new targets.LambdaFunction(myLambda)],
    });
  }
}

// Deploy it
const app = new cdk.App();
new MyConsumerStack(app, 'MyConsumerStack');
```

## Step 3: Deploy (2 minutes)

```bash
cdk deploy MyConsumerStack
```

**That's it!** 🎉

Your Lambda will now receive all user events from the KX Event Tracking system.

## What You Get

- ✅ Automatic event routing from KX Event Tracking
- ✅ Type-safe event handling
- ✅ No stack dependencies or complex ARN management
- ✅ Real-time event processing

## Next Steps

### Add More Event Types

```typescript
// Listen to payments too
new events.Rule(this, 'PaymentEvents', {
  eventBus: kxEvents,
  eventPattern: EventBridgeDiscovery.createEventPattern({
    entityTypes: ['payment'],
    eventTypes: ['payment_completed'],
  }),
  targets: [new targets.LambdaFunction(myLambda)],
});
```

### Filter by Client

```typescript
// Only events from specific clients
eventPattern: EventBridgeDiscovery.createEventPattern({
  entityTypes: ['user'],
  clientIds: ['client_123'],
})
```

### Better Lambda Handler

```typescript
import { KxEventBridgeEvent, EventUtils } from '@toldyaonce/kx-event-consumers';

export const handler = async (event: KxEventBridgeEvent) => {
  const { entityType, eventType } = EventUtils.parseDetailType(event['detail-type']);
  
  console.log(`Processing ${entityType}.${eventType} for client ${event.detail.clientId}`);
  
  // Your business logic here
  if (entityType === 'user' && eventType === 'user_created') {
    await sendWelcomeEmail(event.detail.userId);
  }
};
```

## Troubleshooting

**No events received?**
1. Make sure KX Event Tracking is deployed first
2. Check CloudWatch logs for your Lambda
3. Verify the EventBridge rule was created

**Need help?** Check the [full README](./README.md) for complete examples and troubleshooting.

---

**You're now consuming KX events!** 🚀 Start building amazing event-driven features.
