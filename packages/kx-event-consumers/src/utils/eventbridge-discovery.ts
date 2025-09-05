import { SSMClient, GetParameterCommand } from '@aws-sdk/client-ssm';
import * as events from 'aws-cdk-lib/aws-events';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import { Construct } from 'constructs';
import * as cdk from 'aws-cdk-lib';

export interface EventBridgeServiceInfo {
  arn: string;
  name: string;
  version: string;
  eventSources: string[];
  supportedEvents: string[];
  region: string;
  account: string;
}

/**
 * EventBridge Service Discovery Utility
 * 
 * Provides both runtime and CDK build-time discovery of EventBridge services
 * registered by the KX Event Tracking system.
 */
export class EventBridgeDiscovery {
  private static ssmClient = new SSMClient({});

  /**
   * Discover EventBridge service at runtime (for Lambda functions)
   * 
   * @param serviceName The name of the service (e.g., 'kx-event-tracking')
   * @returns Promise<EventBridgeServiceInfo> Service information including ARN
   */
  static async discoverService(serviceName: string): Promise<EventBridgeServiceInfo> {
    try {
      const response = await this.ssmClient.send(new GetParameterCommand({
        Name: `/eventbridge/services/${serviceName}/info`
      }));
      
      if (!response.Parameter?.Value) {
        throw new Error(`EventBridge service '${serviceName}' not found`);
      }
      
      return JSON.parse(response.Parameter.Value);
    } catch (error) {
      throw new Error(`Failed to discover EventBridge service '${serviceName}': ${error}`);
    }
  }

  /**
   * Get EventBridge ARN by service name (for Lambda functions)
   * 
   * @param serviceName The name of the service
   * @returns Promise<string> The EventBridge ARN
   */
  static async getEventBridgeArn(serviceName: string): Promise<string> {
    try {
      const response = await this.ssmClient.send(new GetParameterCommand({
        Name: `/eventbridge/services/${serviceName}/arn`
      }));
      
      if (!response.Parameter?.Value) {
        throw new Error(`EventBridge service '${serviceName}' not found`);
      }
      
      return response.Parameter.Value;
    } catch (error) {
      throw new Error(`Failed to get EventBridge ARN for '${serviceName}': ${error}`);
    }
  }

  /**
   * Import EventBridge by service name (for CDK constructs)
   * 
   * @param scope The construct scope
   * @param id The construct ID
   * @param serviceName The name of the service
   * @returns events.IEventBus The imported EventBridge
   */
  static importEventBridge(scope: Construct, id: string, serviceName: string): events.IEventBus {
    const parameterName = `/eventbridge/services/${serviceName}/arn`;
    const eventBridgeArn = ssm.StringParameter.valueFromLookup(scope, parameterName);
    
    return events.EventBus.fromEventBusArn(scope, id, eventBridgeArn);
  }

  /**
   * Import EventBridge using CloudFormation exports (alternative method)
   * 
   * @param scope The construct scope
   * @param id The construct ID
   * @param stackName The CloudFormation stack name
   * @returns events.IEventBus The imported EventBridge
   */
  static importEventBridgeFromStack(scope: Construct, id: string, stackName: string): events.IEventBus {
    const eventBridgeArn = cdk.Fn.importValue(`${stackName}-EventBridgeArn`);
    return events.EventBus.fromEventBusArn(scope, id, eventBridgeArn);
  }

  /**
   * Import EventBridge with cross-region support (for CDK constructs)
   * 
   * @param scope The construct scope
   * @param id The construct ID
   * @param serviceName The name of the service
   * @param region The target region (optional, defaults to current stack region)
   * @param account The target account (optional, defaults to current stack account)
   * @returns events.IEventBus The imported EventBridge
   */
  static importEventBridgeCrossRegion(
    scope: Construct, 
    id: string, 
    serviceName: string, 
    region?: string,
    account?: string
  ): events.IEventBus {
    const stack = cdk.Stack.of(scope);
    const targetRegion = region || stack.region;
    const targetAccount = account || stack.account;
    
    // Construct the ARN for cross-region access
    const eventBridgeArn = `arn:aws:events:${targetRegion}:${targetAccount}:event-bus/${serviceName}-events-bus`;
    
    return events.EventBus.fromEventBusArn(scope, id, eventBridgeArn);
  }

  /**
   * Get service discovery information for CDK constructs
   * 
   * @param scope The construct scope
   * @param id The construct ID
   * @param serviceName The name of the service
   * @returns Object with EventBridge connection details
   */
  static getServiceInfo(scope: Construct, id: string, serviceName: string) {
    const arnParameterName = `/eventbridge/services/${serviceName}/arn`;
    const infoParameterName = `/eventbridge/services/${serviceName}/info`;
    
    return {
      eventBusArn: ssm.StringParameter.valueFromLookup(scope, arnParameterName),
      serviceInfo: ssm.StringParameter.valueFromLookup(scope, infoParameterName),
      
      // Helper method to create the EventBus construct
      toEventBus: (busScope: Construct, busId: string) => {
        const arn = ssm.StringParameter.valueFromLookup(busScope, arnParameterName);
        return events.EventBus.fromEventBusArn(busScope, busId, arn);
      }
    };
  }

  /**
   * Create a standardized event pattern for KX Event Tracking events
   * 
   * @param options Event pattern options
   * @returns EventBridge event pattern
   */
  static createEventPattern(options: {
    entityTypes?: string[];
    eventTypes?: string[];
    clientIds?: string[];
    sources?: string[];
    detailTypePrefix?: string;
  }) {
    const pattern: any = {
      source: ['kx-event-tracking']
    };

    // Build detail-type patterns
    if (options.detailTypePrefix) {
      pattern.detailType = [{ "prefix": options.detailTypePrefix }];
    } else if (options.entityTypes && options.eventTypes) {
      // Create combinations of entityType.eventType
      const detailTypes: string[] = [];
      for (const entityType of options.entityTypes) {
        for (const eventType of options.eventTypes) {
          detailTypes.push(`${entityType}.${eventType}`);
        }
      }
      pattern.detailType = detailTypes;
    } else if (options.entityTypes) {
      // Match any event type for these entity types
      pattern.detailType = options.entityTypes.map(et => ({ "prefix": `${et}.` }));
    }

    // Add detail filters
    const detail: any = {};
    
    if (options.clientIds) {
      detail.clientId = options.clientIds;
    }
    
    if (options.sources) {
      detail.source = options.sources;
    }

    if (Object.keys(detail).length > 0) {
      pattern.detail = detail;
    }

    return pattern;
  }
}

/**
 * Utility functions for working with KX Event Tracking events
 */
export class EventUtils {
  /**
   * Extract event information from EventBridge event
   */
  static extractEventInfo(event: any) {
    return {
      source: event.source,
      detailType: event['detail-type'],
      detail: event.detail,
      time: event.time,
      region: event.region,
      account: event.account,
    };
  }

  /**
   * Parse entity and event type from detail-type
   */
  static parseDetailType(detailType: string): { entityType: string; eventType: string } {
    const parts = detailType.split('.');
    if (parts.length < 2) {
      throw new Error(`Invalid detail-type format: ${detailType}. Expected: entityType.eventType`);
    }
    
    return {
      entityType: parts[0],
      eventType: parts.slice(1).join('.') // Handle event types with dots
    };
  }

  /**
   * Check if event matches criteria
   */
  static matchesEvent(event: any, criteria: {
    entityType?: string;
    eventType?: string;
    clientId?: string;
    source?: string;
  }): boolean {
    const { entityType, eventType } = this.parseDetailType(event['detail-type']);
    
    if (criteria.entityType && entityType !== criteria.entityType) {
      return false;
    }
    
    if (criteria.eventType && eventType !== criteria.eventType) {
      return false;
    }
    
    if (criteria.clientId && event.detail.clientId !== criteria.clientId) {
      return false;
    }
    
    if (criteria.source && event.detail.source !== criteria.source) {
      return false;
    }
    
    return true;
  }
}


