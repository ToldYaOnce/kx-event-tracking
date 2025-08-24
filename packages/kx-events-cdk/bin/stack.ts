#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { RdsDatabase } from '../src/constructs/RdsDatabase';
import { EventsBus } from '../src/constructs/EventsBus';

export class EventTrackingStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly database: RdsDatabase;
  public readonly eventsBus: EventsBus;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create VPC with public and private subnets
    this.vpc = new ec2.Vpc(this, 'EventTrackingVpc', {
      maxAzs: 2, // Use 2 AZs for high availability
      natGateways: 1, // Use 1 NAT Gateway to reduce costs
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
    });

    // Create RDS PostgreSQL database
    this.database = new RdsDatabase(this, 'EventsDatabase', {
      vpc: this.vpc,
      databaseName: 'events',
      instanceClass: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      allocatedStorage: 20,
    });

    // Create SQS queue and consumer Lambda
    this.eventsBus = new EventsBus(this, 'EventsBus', {
      vpc: this.vpc,
      databaseSecurityGroup: this.database.securityGroup,
      databaseSecret: this.database.secret,
    });

    // Stack outputs
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'ID of the VPC',
    });

    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: this.database.instance.instanceEndpoint.hostname,
      description: 'RDS PostgreSQL database endpoint',
    });

    new cdk.CfnOutput(this, 'DatabaseSecretArn', {
      value: this.database.secret.secretArn,
      description: 'ARN of the database credentials secret',
    });

    new cdk.CfnOutput(this, 'EventsQueueUrl', {
      value: this.eventsBus.queue.queueUrl,
      description: 'URL of the events SQS queue',
    });

    new cdk.CfnOutput(this, 'EventsQueueArn', {
      value: this.eventsBus.queue.queueArn,
      description: 'ARN of the events SQS queue',
    });
  }
}

// CDK App
const app = new cdk.App();
new EventTrackingStack(app, 'EventTrackingStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION,
  },
});

