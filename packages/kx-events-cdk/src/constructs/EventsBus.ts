import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as sources from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Construct } from 'constructs';
import * as path from 'path';

export interface EventsBusProps {
  vpc: ec2.Vpc;
  databaseSecurityGroup: ec2.SecurityGroup;
  databaseSecret: secretsmanager.Secret;
  resourcePrefix?: string;
  queueName?: string;
  functionName?: string;
}

export class EventsBus extends Construct {
  public readonly queue: sqs.Queue;
  public readonly deadLetterQueue: sqs.Queue;
  public readonly consumerFunction: NodejsFunction;

  constructor(scope: Construct, id: string, props: EventsBusProps) {
    super(scope, id);

    const resourcePrefix = props.resourcePrefix || 'events-tracking';

    // Create dead letter queue
    this.deadLetterQueue = new sqs.Queue(this, 'EventsDeadLetterQueue', {
      queueName: `${resourcePrefix}-events-dlq`,
      retentionPeriod: cdk.Duration.days(14), // Keep failed messages for 14 days
    });

    // Create main SQS queue
    this.queue = new sqs.Queue(this, 'EventsQueue', {
      queueName: props.queueName || `${resourcePrefix}-events-queue`,
      visibilityTimeout: cdk.Duration.minutes(5), // Should match Lambda timeout
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount: 3, // Retry failed messages 3 times
      },
    });

    // Create security group for Lambda
    const lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc: props.vpc,
      securityGroupName: `${resourcePrefix}-lambda-sg`,
      description: 'Security group for events consumer Lambda',
      allowAllOutbound: true,
    });

    // Allow Lambda to connect to database
    props.databaseSecurityGroup.addIngressRule(
      lambdaSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow Lambda to connect to database'
    );

    // Create Lambda function using NodejsFunction (INDUSTRY STANDARD)
    this.consumerFunction = new NodejsFunction(this, 'EventsConsumerFunction', {
      functionName: props.functionName || `${resourcePrefix}-events-consumer`,
      runtime: lambda.Runtime.NODEJS_18_X,
      entry: path.join(__dirname, '../lambdas/events-consumer/index.js'),
      handler: 'handler',
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [lambdaSecurityGroup],
      environment: {
        DB_SECRET_ARN: props.databaseSecret.secretArn,
      },
      bundling: {
        // Keep external modules external so they're installed as node_modules
        externalModules: ['aws-sdk'],
        // Explicitly include these modules in the Lambda package
        nodeModules: ['pg', '@aws-sdk/client-secrets-manager'],
        minify: false,
        sourceMap: true,
        // Force local bundling to avoid Docker issues
        forceDockerBundling: false,
      },
    });

    // Grant Lambda permission to read the database secret
    props.databaseSecret.grantRead(this.consumerFunction);

    // Add SQS event source to Lambda
    this.consumerFunction.addEventSource(
      new sources.SqsEventSource(this.queue, {
        batchSize: 10, // Process up to 10 messages at once
        maxBatchingWindow: cdk.Duration.seconds(5),
        reportBatchItemFailures: true, // Enable partial batch failure reporting
      })
    );

    // Grant Lambda permission to receive messages from SQS
    this.queue.grantConsumeMessages(this.consumerFunction);

    // Outputs are handled by the main EventTrackingStack
  }
}