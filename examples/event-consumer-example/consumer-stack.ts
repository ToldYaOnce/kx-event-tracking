import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import { EventBridgeDiscovery } from '@toldyaonce/kx-event-consumers';

/**
 * Example CDK stack showing how to consume KX Event Tracking events
 */
export class EventConsumerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Method 1: Import EventBridge by service name (recommended)
    const kxEventBridge = EventBridgeDiscovery.importEventBridge(
      this,
      'KxEventBridge',
      'kx-event-tracking'
    );

    // Method 2: Import from CloudFormation exports (alternative)
    // const kxEventBridge = EventBridgeDiscovery.importEventBridgeFromStack(
    //   this,
    //   'KxEventBridge',
    //   'EventTrackingStack'
    // );

    // Create email notification Lambda
    const emailLambda = new NodejsFunction(this, 'EmailNotificationFunction', {
      entry: 'src/handlers/email.ts',
      // For quick testing, you can use inline code instead:
      // code: lambda.Code.fromInline(`...`)
    });

    // Create analytics Lambda
    const analyticsLambda = new NodejsFunction(this, 'AnalyticsFunction', {
      entry: 'src/handlers/analytics.ts',
      // For quick testing, you can use inline code instead:
      // code: lambda.Code.fromInline(`...`)
    });

    // Rule 1: User events for email notifications
    new events.Rule(this, 'UserEventsRule', {
      eventBus: kxEventBridge,
      eventPattern: EventBridgeDiscovery.createEventPattern({
        entityTypes: ['user'],
        eventTypes: ['user_created', 'user_updated'],
      }),
      targets: [new targets.LambdaFunction(emailLambda)],
    });

    // Rule 2: Payment events for email notifications
    new events.Rule(this, 'PaymentEventsRule', {
      eventBus: kxEventBridge,
      eventPattern: EventBridgeDiscovery.createEventPattern({
        entityTypes: ['payment'],
        eventTypes: ['payment_completed'],
      }),
      targets: [new targets.LambdaFunction(emailLambda)],
    });

    // Rule 3: All events with points for analytics
    new events.Rule(this, 'PointsEventsRule', {
      eventBus: kxEventBridge,
      eventPattern: {
        source: ['kx-event-tracking'],
        detail: {
          pointsAwarded: [{ "exists": true }],
        },
      },
      targets: [new targets.LambdaFunction(analyticsLambda)],
    });

    // Rule 4: QR events for analytics
    new events.Rule(this, 'QrEventsRule', {
      eventBus: kxEventBridge,
      eventPattern: EventBridgeDiscovery.createEventPattern({
        entityTypes: ['qr'],
      }),
      targets: [new targets.LambdaFunction(analyticsLambda)],
    });

    // Rule 5: Client-specific events (example filtering)
    new events.Rule(this, 'ClientSpecificRule', {
      eventBus: kxEventBridge,
      eventPattern: EventBridgeDiscovery.createEventPattern({
        clientIds: ['client_123'],
        sources: ['api'], // Only API events, not worker events
      }),
      targets: [new targets.LambdaFunction(analyticsLambda)],
    });

    // Outputs
    new cdk.CfnOutput(this, 'EmailLambdaArn', {
      value: emailLambda.functionArn,
      description: 'ARN of the email notification Lambda',
    });

    new cdk.CfnOutput(this, 'AnalyticsLambdaArn', {
      value: analyticsLambda.functionArn,
      description: 'ARN of the analytics Lambda',
    });
  }
}

// Example app
const app = new cdk.App();
new EventConsumerStack(app, 'EventConsumerStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
