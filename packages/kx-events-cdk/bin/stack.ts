#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import { RdsDatabase } from '../src/constructs/RdsDatabase';
import { EventsBus } from '../src/constructs/EventsBus';

export interface EventTrackingStackProps extends cdk.StackProps {
  readonly resourcePrefix?: string;
  readonly vpcName?: string;
  readonly databaseName?: string;
  readonly secretName?: string;
  readonly queueName?: string;
  readonly functionName?: string;
}

export class EventTrackingStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;
  public readonly database: RdsDatabase;
  public readonly eventsBus: EventsBus;

  constructor(scope: Construct, id: string, props?: EventTrackingStackProps) {
    super(scope, id, props);

    const resourcePrefix = props?.resourcePrefix || id.toLowerCase();
    const stackName = this.stackName;

    // Create VPC with public and private subnets
    this.vpc = new ec2.Vpc(this, 'EventTrackingVpc', {
      vpcName: props?.vpcName || `${resourcePrefix}-vpc`,
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
      databaseName: props?.databaseName || 'events',
      instanceClass: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      allocatedStorage: 20,
      resourcePrefix,
      secretName: props?.secretName,
    });

    // Create SQS queue and consumer Lambda
    this.eventsBus = new EventsBus(this, 'EventsBus', {
      vpc: this.vpc,
      databaseSecurityGroup: this.database.securityGroup,
      databaseSecret: this.database.secret,
      resourcePrefix,
      queueName: props?.queueName,
      functionName: props?.functionName,
    });



    // Stack outputs with export names for cross-stack referencing
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'ID of the VPC',
      exportName: `${stackName}-VpcId`,
    });

    new cdk.CfnOutput(this, 'PrivateSubnetIds', {
      value: this.vpc.privateSubnets.map(s => s.subnetId).join(','),
      description: 'Comma-separated list of private subnet IDs',
      exportName: `${stackName}-PrivateSubnetIds`,
    });

    new cdk.CfnOutput(this, 'PublicSubnetIds', {
      value: this.vpc.publicSubnets.map(s => s.subnetId).join(','),
      description: 'Comma-separated list of public subnet IDs',
      exportName: `${stackName}-PublicSubnetIds`,
    });

    new cdk.CfnOutput(this, 'DatabaseEndpoint', {
      value: this.database.instance.instanceEndpoint.hostname,
      description: 'RDS PostgreSQL database endpoint',
      exportName: `${stackName}-DbEndpoint`,
    });

    new cdk.CfnOutput(this, 'DatabasePort', {
      value: this.database.instance.instanceEndpoint.port.toString(),
      description: 'RDS PostgreSQL database port',
      exportName: `${stackName}-DbPort`,
    });

    new cdk.CfnOutput(this, 'DatabaseName', {
      value: this.database.instance.instanceIdentifier,
      description: 'RDS PostgreSQL database name',
      exportName: `${stackName}-DbName`,
    });

    new cdk.CfnOutput(this, 'DatabaseSecretArn', {
      value: this.database.secret.secretArn,
      description: 'ARN of the database credentials secret',
      exportName: `${stackName}-DbSecretArn`,
    });

    new cdk.CfnOutput(this, 'DatabaseSecurityGroupId', {
      value: this.database.securityGroup.securityGroupId,
      description: 'Security group ID for database access',
      exportName: `${stackName}-DbSecurityGroupId`,
    });

    new cdk.CfnOutput(this, 'EventsQueueUrl', {
      value: this.eventsBus.queue.queueUrl,
      description: 'URL of the events SQS queue',
      exportName: `${stackName}-EventsQueueUrl`,
    });

    new cdk.CfnOutput(this, 'EventsQueueArn', {
      value: this.eventsBus.queue.queueArn,
      description: 'ARN of the events SQS queue',
      exportName: `${stackName}-EventsQueueArn`,
    });

    new cdk.CfnOutput(this, 'DeadLetterQueueUrl', {
      value: this.eventsBus.deadLetterQueue.queueUrl,
      description: 'URL of the dead letter queue',
      exportName: `${stackName}-DeadLetterQueueUrl`,
    });

    new cdk.CfnOutput(this, 'DeadLetterQueueArn', {
      value: this.eventsBus.deadLetterQueue.queueArn,
      description: 'ARN of the dead letter queue',
      exportName: `${stackName}-DeadLetterQueueArn`,
    });

    new cdk.CfnOutput(this, 'ConsumerFunctionArn', {
      value: this.eventsBus.consumerFunction.functionArn,
      description: 'ARN of the events consumer Lambda function',
      exportName: `${stackName}-ConsumerFunctionArn`,
    });
  }

  /**
   * Import existing EventTrackingStack resources from CloudFormation exports
   * @param scope The construct scope
   * @param id The construct ID
   * @param stackName The name of the EventTrackingStack to import from
   * @returns Object containing imported resource references
   */
  public static fromStackOutputs(scope: Construct, id: string, stackName: string) {
    return {
      vpcId: cdk.Fn.importValue(`${stackName}-VpcId`),
      privateSubnetIds: cdk.Fn.importValue(`${stackName}-PrivateSubnetIds`).split(','),
      publicSubnetIds: cdk.Fn.importValue(`${stackName}-PublicSubnetIds`).split(','),
      databaseEndpoint: cdk.Fn.importValue(`${stackName}-DbEndpoint`),
      databasePort: cdk.Fn.importValue(`${stackName}-DbPort`),
      databaseName: cdk.Fn.importValue(`${stackName}-DbName`),
      databaseSecretArn: cdk.Fn.importValue(`${stackName}-DbSecretArn`),
      databaseSecurityGroupId: cdk.Fn.importValue(`${stackName}-DbSecurityGroupId`),
      eventsQueueUrl: cdk.Fn.importValue(`${stackName}-EventsQueueUrl`),
      eventsQueueArn: cdk.Fn.importValue(`${stackName}-EventsQueueArn`),
      deadLetterQueueUrl: cdk.Fn.importValue(`${stackName}-DeadLetterQueueUrl`),
      deadLetterQueueArn: cdk.Fn.importValue(`${stackName}-DeadLetterQueueArn`),
      consumerFunctionArn: cdk.Fn.importValue(`${stackName}-ConsumerFunctionArn`),
    };
  }

  /**
   * Import VPC from existing EventTrackingStack
   * @param scope The construct scope
   * @param id The construct ID
   * @param stackName The name of the EventTrackingStack to import from
   * @returns VPC construct
   */
  public static importVpc(scope: Construct, id: string, stackName: string): ec2.IVpc {
    return ec2.Vpc.fromVpcAttributes(scope, id, {
      vpcId: cdk.Fn.importValue(`${stackName}-VpcId`),
      privateSubnetIds: cdk.Fn.importValue(`${stackName}-PrivateSubnetIds`).split(','),
      publicSubnetIds: cdk.Fn.importValue(`${stackName}-PublicSubnetIds`).split(','),
      availabilityZones: cdk.Stack.of(scope).availabilityZones,
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