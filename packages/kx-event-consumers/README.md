# @toldyaonce/kx-event-consumers

**Dead-simple EventBridge discovery and consumer utilities for KX Event Tracking**

Consume events from any KX Event Tracking service with just the service name - no stack dependencies, no ARN lookups, no complexity.

## 🚀 Dead-Simple Quick Start

### 1. Install

```bash
npm install @toldyaonce/kx-event-consumers
```

### 2. Create Event Consumer (CDK)

```typescript
import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { EventBridgeDiscovery } from '@toldyaonce/kx-event-consumers';

export class MyEventConsumerStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 🎯 STEP 1: Get EventBridge by service name (that's it!)
    const kxEvents = EventBridgeDiscovery.importEventBridge(
      this, 
      'KxEventBridge', 
      'kx-event-tracking'  // Just the service name!
    );

    // 🎯 STEP 2: Create your consumer Lambda
    const emailLambda = new NodejsFunction(this, 'EmailNotifications', {
      entry: 'src/lambdas/email/index.ts',
    });

    // 🎯 STEP 3: Create rules for the events you want
    new events.Rule(this, 'UserEventsRule', {
      eventBus: kxEvents,
      eventPattern: EventBridgeDiscovery.createEventPattern({
        entityTypes: ['user'],
        eventTypes: ['user_created', 'user_updated'],
      }),
      targets: [new targets.LambdaFunction(emailLambda)],
    });

    // That's it! Deploy and start receiving events 🎉
  }
}
```

### 3. Handle Events in Lambda

```typescript
import { KxEventBridgeEvent, EventUtils } from '@toldyaonce/kx-event-consumers';

export const handler = async (event: KxEventBridgeEvent) => {
  // Parse the event type
  const { entityType, eventType } = EventUtils.parseDetailType(event['detail-type']);
  
  // Handle different event types
  switch (`${entityType}.${eventType}`) {
    case 'user.user_created':
      await sendWelcomeEmail(event.detail.userId);
      break;
    case 'payment.payment_completed':
      await sendPaymentConfirmation(event.detail.entityId);
      break;
  }
};
```

## 🎯 Why This Package?

**Before** (complex):
```typescript
// ❌ Hard way - need to know stack names, manage exports
const eventBridge = events.EventBus.fromEventBusArn(
  this, 'EventBridge', 
  cdk.Fn.importValue('SomeComplexStackName-EventBridgeArn-RandomSuffix')
);
```

**After** (dead-simple):
```typescript
// ✅ Easy way - just use service name
const eventBridge = EventBridgeDiscovery.importEventBridge(
  this, 'EventBridge', 'kx-event-tracking'
);
```

## 📋 Common Use Cases

### Email Notifications

```typescript
// Get events for user actions
new events.Rule(this, 'EmailRule', {
  eventBus: kxEvents,
  eventPattern: EventBridgeDiscovery.createEventPattern({
    entityTypes: ['user'],
    eventTypes: ['user_created', 'user_updated', 'password_reset'],
  }),
  targets: [new targets.LambdaFunction(emailLambda)],
});
```

### Analytics & Reporting

```typescript
// Get all events with points for analytics
new events.Rule(this, 'AnalyticsRule', {
  eventBus: kxEvents,
  eventPattern: {
    source: ['kx-event-tracking'],
    detail: {
      pointsAwarded: [{ "exists": true }], // Only events with points
    },
  },
  targets: [new targets.LambdaFunction(analyticsLambda)],
});
```

### Client-Specific Processing

```typescript
// Get events for specific clients only
new events.Rule(this, 'ClientRule', {
  eventBus: kxEvents,
  eventPattern: EventBridgeDiscovery.createEventPattern({
    clientIds: ['client_123', 'client_456'],
    sources: ['api'], // Only API events, not background jobs
  }),
  targets: [new targets.LambdaFunction(clientLambda)],
});
```

### Real-time Notifications

```typescript
// Get QR code access events for real-time notifications
new events.Rule(this, 'QrRule', {
  eventBus: kxEvents,
  eventPattern: EventBridgeDiscovery.createEventPattern({
    entityTypes: ['qr'],
    eventTypes: ['qr.get'],
  }),
  targets: [
    new targets.LambdaFunction(notificationLambda),
    new targets.SqsQueue(notificationQueue), // Fan out to multiple targets
  ],
});
```

## 🛠️ Framework Integration

### Serverless Framework

```yaml
# serverless.yml
service: my-event-consumer

custom:
  # Dead-simple: just reference the service name
  eventBridgeArn: ${ssm:/eventbridge/services/kx-event-tracking/arn}

functions:
  emailNotifications:
    handler: src/handlers/email.handler
    events:
      - eventBridge:
          eventBus: ${self:custom.eventBridgeArn}
          pattern:
            source: ['kx-event-tracking']
            detail-type: ['user.user_created', 'user.user_updated']

  analytics:
    handler: src/handlers/analytics.handler
    events:
      - eventBridge:
          eventBus: ${self:custom.eventBridgeArn}
          pattern:
            source: ['kx-event-tracking']
            detail:
              pointsAwarded: [{ "exists": true }]
```

### SAM (Serverless Application Model)

```yaml
# template.yaml
AWSTemplateFormatVersion: '2010-09-09'
Transform: AWS::Serverless-2016-10-31

Parameters:
  EventBridgeArn:
    Type: AWS::SSM::Parameter::Value<String>
    Default: /eventbridge/services/kx-event-tracking/arn

Resources:
  EmailFunction:
    Type: AWS::Serverless::Function
    Properties:
      CodeUri: src/
      Handler: email.handler
      Runtime: nodejs18.x
      Events:
        UserEvents:
          Type: EventBridgeRule
          Properties:
            EventBusName: !Ref EventBridgeArn
            Pattern:
              source: ['kx-event-tracking']
              detail-type: ['user.user_created']
```

### Terraform

```hcl
# Get EventBridge ARN from SSM
data "aws_ssm_parameter" "eventbridge_arn" {
  name = "/eventbridge/services/kx-event-tracking/arn"
}

# Create EventBridge rule
resource "aws_cloudwatch_event_rule" "user_events" {
  name           = "user-events-rule"
  event_bus_name = data.aws_ssm_parameter.eventbridge_arn.value
  
  event_pattern = jsonencode({
    source      = ["kx-event-tracking"]
    detail-type = ["user.user_created", "user.user_updated"]
  })
}

# Connect to Lambda
resource "aws_cloudwatch_event_target" "lambda_target" {
  rule           = aws_cloudwatch_event_rule.user_events.name
  event_bus_name = data.aws_ssm_parameter.eventbridge_arn.value
  target_id      = "SendToLambda"
  arn            = aws_lambda_function.email_handler.arn
}
```

## 📱 Complete Examples

### Email Notification Service

**CDK Stack:**
```typescript
import { EventBridgeDiscovery } from '@toldyaonce/kx-event-consumers';

export class EmailServiceStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const kxEvents = EventBridgeDiscovery.importEventBridge(this, 'KxEvents', 'kx-event-tracking');

    const emailLambda = new NodejsFunction(this, 'EmailHandler', {
      entry: 'src/handlers/email.ts',
      environment: {
        SMTP_HOST: process.env.SMTP_HOST!,
        FROM_EMAIL: 'noreply@yourcompany.com',
      },
    });

    // Welcome emails for new users
    new events.Rule(this, 'WelcomeEmails', {
      eventBus: kxEvents,
      eventPattern: EventBridgeDiscovery.createEventPattern({
        entityTypes: ['user'],
        eventTypes: ['user_created'],
      }),
      targets: [new targets.LambdaFunction(emailLambda)],
    });

    // Payment confirmations
    new events.Rule(this, 'PaymentEmails', {
      eventBus: kxEvents,
      eventPattern: EventBridgeDiscovery.createEventPattern({
        entityTypes: ['payment'],
        eventTypes: ['payment_completed'],
      }),
      targets: [new targets.LambdaFunction(emailLambda)],
    });
  }
}
```

**Lambda Handler:**
```typescript
import { KxEventBridgeEvent, EventUtils } from '@toldyaonce/kx-event-consumers';
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

const ses = new SESClient({});

export const handler = async (event: KxEventBridgeEvent) => {
  const { entityType, eventType } = EventUtils.parseDetailType(event['detail-type']);
  
  switch (`${entityType}.${eventType}`) {
    case 'user.user_created':
      await sendWelcomeEmail(event.detail);
      break;
    case 'payment.payment_completed':
      await sendPaymentConfirmation(event.detail);
      break;
  }
};

async function sendWelcomeEmail(eventDetail: any) {
  await ses.send(new SendEmailCommand({
    Source: process.env.FROM_EMAIL,
    Destination: { ToAddresses: [eventDetail.metadata?.email] },
    Message: {
      Subject: { Data: 'Welcome!' },
      Body: { Text: { Data: `Welcome, ${eventDetail.metadata?.name}!` } },
    },
  }));
}

async function sendPaymentConfirmation(eventDetail: any) {
  await ses.send(new SendEmailCommand({
    Source: process.env.FROM_EMAIL,
    Destination: { ToAddresses: [eventDetail.metadata?.customerEmail] },
    Message: {
      Subject: { Data: 'Payment Confirmed' },
      Body: { Text: { Data: `Payment ${eventDetail.entityId} confirmed!` } },
    },
  }));
}
```

### Analytics Pipeline

**CDK Stack:**
```typescript
export class AnalyticsStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const kxEvents = EventBridgeDiscovery.importEventBridge(this, 'KxEvents', 'kx-event-tracking');

    // Kinesis stream for real-time analytics
    const analyticsStream = new kinesis.Stream(this, 'AnalyticsStream', {
      shardCount: 1,
    });

    // Lambda to process events
    const analyticsLambda = new NodejsFunction(this, 'AnalyticsProcessor', {
      entry: 'src/handlers/analytics.ts',
      environment: {
        KINESIS_STREAM: analyticsStream.streamName,
      },
    });

    analyticsStream.grantWrite(analyticsLambda);

    // Capture ALL events for analytics
    new events.Rule(this, 'AllEventsRule', {
      eventBus: kxEvents,
      eventPattern: { source: ['kx-event-tracking'] },
      targets: [new targets.LambdaFunction(analyticsLambda)],
    });
  }
}
```

**Analytics Handler:**
```typescript
import { KxEventBridgeEvent } from '@toldyaonce/kx-event-consumers';
import { KinesisClient, PutRecordCommand } from '@aws-sdk/client-kinesis';

const kinesis = new KinesisClient({});

export const handler = async (event: KxEventBridgeEvent) => {
  // Transform event for analytics
  const analyticsRecord = {
    eventId: event.detail.eventId,
    clientId: event.detail.clientId,
    eventType: event['detail-type'],
    userId: event.detail.userId,
    pointsAwarded: event.detail.pointsAwarded || 0,
    timestamp: event.time,
    source: event.detail.source,
  };

  // Send to Kinesis for real-time processing
  await kinesis.send(new PutRecordCommand({
    StreamName: process.env.KINESIS_STREAM,
    Data: Buffer.from(JSON.stringify(analyticsRecord)),
    PartitionKey: event.detail.clientId,
  }));
};
```

## 🔧 Simple API Reference

### One-Liner Discovery

```typescript
// CDK: Get EventBridge by service name
const eventBridge = EventBridgeDiscovery.importEventBridge(scope, id, 'kx-event-tracking');

// Lambda: Get EventBridge ARN at runtime
const arn = await EventBridgeDiscovery.getEventBridgeArn('kx-event-tracking');
```

### Event Pattern Helpers

```typescript
// Simple patterns
EventBridgeDiscovery.createEventPattern({
  entityTypes: ['user', 'payment'],           // What entities
  eventTypes: ['created', 'updated'],         // What actions
  clientIds: ['client_123'],                  // Which clients
  sources: ['api', 'worker'],                 // Which sources
});

// Advanced patterns
{
  source: ['kx-event-tracking'],
  detail: {
    pointsAwarded: [{ "numeric": [">", 0] }], // Events with points > 0
    metadata: { campaign: ['holiday-2024'] }, // Specific campaign
  }
}
```

### Event Utilities

```typescript
// Parse event type
const { entityType, eventType } = EventUtils.parseDetailType('user.user_created');
// Returns: { entityType: 'user', eventType: 'user_created' }

// Check if event matches criteria
const matches = EventUtils.matchesEvent(event, {
  entityType: 'user',
  clientId: 'client_123'
});
```

## 🚀 Deployment Guide

### Step 1: Deploy KX Event Tracking

First, make sure you have the KX Event Tracking system deployed:

```bash
# Deploy the event tracking infrastructure
cd packages/kx-events-cdk
npm run deploy
```

This creates the EventBridge and registers it in SSM Parameter Store.

### Step 2: Deploy Your Consumer

```bash
# CDK
cdk deploy MyEventConsumerStack

# Serverless Framework
serverless deploy

# SAM
sam deploy

# Terraform
terraform apply
```

### Step 3: Test Events

Send a test event to verify everything works:

```typescript
// In your application using @EventTracking decorator
@EventTracking('user', 'user_created', { pointsAwarded: 100 })
async createUser(event, context) {
  return { success: true, userId: 'user_123' };
}
```

## 🔧 Troubleshooting

### EventBridge Not Found

**Error**: `EventBridge service 'kx-event-tracking' not found`

**Solution**: Make sure the KX Event Tracking stack is deployed first:
```bash
cd packages/kx-events-cdk && npm run deploy
```

### SSM Parameter Not Found

**Error**: `Parameter /eventbridge/services/kx-event-tracking/arn not found`

**Solutions**:
1. Check the service name matches what you deployed
2. Verify you're in the same AWS region
3. Check SSM Parameter Store in AWS Console

### No Events Received

**Checklist**:
1. ✅ KX Event Tracking stack deployed
2. ✅ Consumer stack deployed  
3. ✅ EventBridge rule created
4. ✅ Lambda has EventBridge permissions
5. ✅ Events are being published (check CloudWatch logs)

### Cross-Region Issues

For cross-region consumers, use the explicit ARN method:

```typescript
// Instead of service discovery
const eventBridge = events.EventBus.fromEventBusArn(
  this, 'EventBridge',
  'arn:aws:events:us-east-1:123456789012:event-bus/kx-event-tracking-events-bus'
);
```

## 🎯 Event Types Reference

Common event types you can consume:

| Entity Type | Event Type | Description |
|-------------|------------|-------------|
| `user` | `user_created` | New user registration |
| `user` | `user_updated` | User profile changes |
| `payment` | `payment_completed` | Successful payment |
| `payment` | `payment_failed` | Failed payment |
| `qr` | `qr.get` | QR code accessed |
| `notification` | `email_sent` | Email notification sent |

### Event Structure

All events follow this format:

```json
{
  "source": "kx-event-tracking",
  "detail-type": "user.user_created",
  "detail": {
    "eventId": "uuid",
    "clientId": "client_123",
    "userId": "user_456",
    "entityType": "user",
    "eventType": "user_created",
    "occurredAt": "2024-01-15T10:30:00.000Z",
    "pointsAwarded": 100,
    "metadata": { "email": "user@example.com" }
  }
}
```

## 📊 Monitoring

### CloudWatch Metrics

Monitor your event consumers:

```typescript
// Add custom metrics to your Lambda
import { CloudWatchClient, PutMetricDataCommand } from '@aws-sdk/client-cloudwatch';

const cloudwatch = new CloudWatchClient({});

export const handler = async (event: KxEventBridgeEvent) => {
  try {
    // Process event
    await processEvent(event);
    
    // Track success
    await cloudwatch.send(new PutMetricDataCommand({
      Namespace: 'KxEventConsumer',
      MetricData: [{
        MetricName: 'EventsProcessed',
        Value: 1,
        Unit: 'Count',
        Dimensions: [
          { Name: 'EventType', Value: event['detail-type'] },
          { Name: 'ClientId', Value: event.detail.clientId },
        ],
      }],
    }));
  } catch (error) {
    // Track errors
    await cloudwatch.send(new PutMetricDataCommand({
      Namespace: 'KxEventConsumer',
      MetricData: [{
        MetricName: 'EventsErrored',
        Value: 1,
        Unit: 'Count',
      }],
    }));
    throw error;
  }
};
```

### Logging Best Practices

```typescript
export const handler = async (event: KxEventBridgeEvent) => {
  console.log('Processing event:', {
    eventId: event.detail.eventId,
    eventType: event['detail-type'],
    clientId: event.detail.clientId,
    timestamp: event.time,
  });

  // Your processing logic here
  
  console.log('Event processed successfully:', event.detail.eventId);
};
```

## 🔗 Related Packages

- **[@toldyaonce/kx-events-cdk](../kx-events-cdk)** - Infrastructure and event publishing
- **[@toldyaonce/kx-events-decorators](../kx-events-decorators)** - Event tracking decorators

## 📄 License

MIT License - see LICENSE file for details.
