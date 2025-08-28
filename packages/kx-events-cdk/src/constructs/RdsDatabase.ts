import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';

export interface RdsDatabaseProps {
  vpc: ec2.Vpc;
  databaseName?: string;
  instanceClass?: ec2.InstanceType;
  allocatedStorage?: number;
  resourcePrefix?: string;
  secretName?: string;
}

export class RdsDatabase extends Construct {
  public readonly instance: rds.DatabaseInstance;
  public readonly secret: secretsmanager.Secret;
  public readonly securityGroup: ec2.SecurityGroup;

  constructor(scope: Construct, id: string, props: RdsDatabaseProps) {
    super(scope, id);

    const resourcePrefix = props.resourcePrefix || 'events-tracking';

    // Create security group for RDS
    this.securityGroup = new ec2.SecurityGroup(this, 'DatabaseSecurityGroup', {
      vpc: props.vpc,
      securityGroupName: `${resourcePrefix}-db-sg`,
      description: 'Security group for RDS PostgreSQL database',
      allowAllOutbound: false,
    });

    // Allow inbound connections on PostgreSQL port from VPC
    this.securityGroup.addIngressRule(
      ec2.Peer.ipv4(props.vpc.vpcCidrBlock),
      ec2.Port.tcp(5432),
      'Allow PostgreSQL connections from VPC'
    );

    // Create database credentials secret
    this.secret = new secretsmanager.Secret(this, 'DatabaseCredentials', {
      secretName: props.secretName || `${resourcePrefix}-db-credentials`,
      description: 'Credentials for the events tracking database',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: 'eventsadmin',
        }),
        generateStringKey: 'password',
        excludeCharacters: '"@/\\\'',
        includeSpace: false,
        passwordLength: 32,
      },
    });

    // Create database subnet group
    const subnetGroup = new rds.SubnetGroup(this, 'DatabaseSubnetGroup', {
      vpc: props.vpc,
      subnetGroupName: `${resourcePrefix}-db-subnet-group`,
      description: 'Subnet group for events tracking database',
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    });

    // Create RDS instance
    this.instance = new rds.DatabaseInstance(this, 'Database', {
      instanceIdentifier: `${resourcePrefix}-db`,
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15,
      }),
      instanceType: props.instanceClass || ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      credentials: rds.Credentials.fromSecret(this.secret),
      vpc: props.vpc,
      subnetGroup,
      securityGroups: [this.securityGroup],
      databaseName: props.databaseName || 'events',
      allocatedStorage: props.allocatedStorage || 20,
      storageType: rds.StorageType.GP2,
      backupRetention: cdk.Duration.days(7),
      deletionProtection: false, // Set to true for production
      deleteAutomatedBackups: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Set to RETAIN for production
    });

    // Outputs are handled by the main EventTrackingStack
  }
}

