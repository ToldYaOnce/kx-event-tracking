import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import * as path from 'path';

export interface EventsBusProps {
  vpc: ec2.Vpc;
  databaseSecurityGroup: ec2.SecurityGroup;
  databaseSecret: secretsmanager.Secret;
}

export class EventsBus extends Construct {
  public readonly queue: sqs.Queue;
  public readonly deadLetterQueue: sqs.Queue;
  public readonly consumerFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: EventsBusProps) {
    super(scope, id);

    // Create Dead Letter Queue
    this.deadLetterQueue = new sqs.Queue(this, 'EventsDeadLetterQueue', {
      queueName: 'events-dlq',
      retentionPeriod: cdk.Duration.days(14),
    });

    // Create main SQS queue
    this.queue = new sqs.Queue(this, 'EventsQueue', {
      queueName: 'events-queue',
      visibilityTimeout: cdk.Duration.minutes(5), // Should be >= Lambda timeout
      retentionPeriod: cdk.Duration.days(14),
      deadLetterQueue: {
        queue: this.deadLetterQueue,
        maxReceiveCount: 3,
      },
    });

    // Create security group for Lambda
    const lambdaSecurityGroup = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc: props.vpc,
      description: 'Security group for events consumer Lambda',
      allowAllOutbound: true,
    });

    // Allow Lambda to connect to RDS
    props.databaseSecurityGroup.addIngressRule(
      lambdaSecurityGroup,
      ec2.Port.tcp(5432),
      'Allow Lambda to connect to database'
    );

    // Create Lambda function
    this.consumerFunction = new lambda.Function(this, 'EventsConsumerFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambdas/events-consumer')),
      timeout: cdk.Duration.minutes(5),
      memorySize: 512,
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      securityGroups: [lambdaSecurityGroup],
      environment: {
        DB_SECRET_ARN: props.databaseSecret.secretArn,
        AWS_REGION: cdk.Stack.of(this).region,
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

    // Output the queue URL
    new cdk.CfnOutput(this, 'EventsQueueUrl', {
      value: this.queue.queueUrl,
      description: 'URL of the events SQS queue',
    });

    // Output the queue ARN
    new cdk.CfnOutput(this, 'EventsQueueArn', {
      value: this.queue.queueArn,
      description: 'ARN of the events SQS queue',
    });

    // Output the DLQ URL
    new cdk.CfnOutput(this, 'EventsDeadLetterQueueUrl', {
      value: this.deadLetterQueue.queueUrl,
      description: 'URL of the events dead letter queue',
    });
  }
}

