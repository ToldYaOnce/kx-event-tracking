import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { EventTrackingStack } from '@toldyaonce/kx-events-cdk';
import { Construct } from 'constructs';

/**
 * Example producer stack showing how to set up EventBridge permissions
 * for real-time event delivery (0-1 second vs 5+ seconds)
 */
export class ProducerStackExample extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // 1. Create event tracking infrastructure
    const eventsStack = new EventTrackingStack(this, 'Events', {
      serviceName: 'my-service', // For EventBridge discovery by consumers
      resourcePrefix: 'myapp',   // Optional: customize resource names
    });

    // 2. Your business Lambdas (with @EventTracking decorators)
    const userService = new NodejsFunction(this, 'UserService', {
      entry: 'src/services/user.ts',
      // Your Lambda will use @EventTracking('user', 'user_created') decorator
    });

    const orderService = new NodejsFunction(this, 'OrderService', {
      entry: 'src/services/order.ts',
      // Your Lambda will use @EventTracking('order', 'order_placed') decorator
    });

    const paymentService = new NodejsFunction(this, 'PaymentService', {
      entry: 'src/services/payment.ts',
      // Your Lambda will use @EventTracking('payment', 'payment_completed') decorator
    });

    // 3. 🚨 CRITICAL: Add EventBridge permissions to ALL business Lambdas
    // Without this, events will be delayed by 5+ seconds!
    const businessLambdas = [userService, orderService, paymentService];
    
    businessLambdas.forEach(lambda => {
      // Grant EventBridge publishing permission for real-time delivery
      lambda.addToRolePolicy(new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ['events:PutEvents'],
        resources: [eventsStack.eventsBus.eventBridge.eventBusArn]
      }));
      
      // Add environment variables for dual publishing
      lambda.addEnvironment('EVENT_BUS_NAME', eventsStack.eventsBus.eventBridge.eventBusName);
      lambda.addEnvironment('EVENTS_QUEUE_URL', eventsStack.eventsBus.queue.queueUrl);
    });

    // 4. Outputs for consumers to discover your EventBridge
    new cdk.CfnOutput(this, 'EventBridgeArn', {
      value: eventsStack.eventsBus.eventBridge.eventBusArn,
      description: 'EventBridge ARN for real-time event consumption',
      exportName: `${this.stackName}-EventBridgeArn`,
    });

    new cdk.CfnOutput(this, 'ServiceName', {
      value: 'my-service',
      description: 'Service name for EventBridge discovery',
    });
  }
}

// Example app
const app = new cdk.App();
new ProducerStackExample(app, 'MyProducerStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});
