#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { EventTrackingStack } from './bin/stack';

console.log('=== TESTING RDS BUG REPRODUCTION ===\n');

// Reproduce the exact user scenario
const app = new cdk.App();

console.log('Creating EventTrackingStack with resourcePrefix: "kxgen"...');
const stack = new EventTrackingStack(app, 'Events', { 
  resourcePrefix: 'kxgen' 
});

console.log('✅ Stack created successfully');

// Verify resources exist
console.log('\n=== RESOURCE VERIFICATION ===');
console.log('VPC exists:', !!stack.vpc);
console.log('Database construct exists:', !!stack.database);
console.log('Database instance exists:', !!stack.database?.instance);
console.log('Database secret exists:', !!stack.database?.secret);
console.log('EventsBus exists:', !!stack.eventsBus);

if (stack.database?.secret) {
  console.log('Secret name should be: kxgen-db-credentials');
}

console.log('\n=== CLOUDFORMATION TEMPLATE ANALYSIS ===');
try {
  const assembly = app.synth();
  const stackTemplate = assembly.getStackByName('Events');
  
  console.log(`Stack: ${stackTemplate.stackName}`);
  const resources = Object.keys(stackTemplate.template.Resources || {});
  console.log(`Total resources: ${resources.length}`);
  
  // Analyze resource types
  const resourcesByType: Record<string, string[]> = {};
  resources.forEach(resourceId => {
    const resource = stackTemplate.template.Resources[resourceId];
    const type = resource.Type;
    if (!resourcesByType[type]) {
      resourcesByType[type] = [];
    }
    resourcesByType[type].push(resourceId);
  });
  
  console.log('\n=== RESOURCES BY TYPE ===');
  Object.entries(resourcesByType).forEach(([type, resourceIds]) => {
    console.log(`${type}: ${resourceIds.length}`);
    resourceIds.forEach(id => {
      console.log(`  - ${id}`);
    });
  });
  
  // Check specifically for RDS resources
  const rdsResources = resources.filter(r => 
    stackTemplate.template.Resources[r].Type?.includes('RDS')
  );
  
  const secretsResources = resources.filter(r => 
    stackTemplate.template.Resources[r].Type?.includes('SecretsManager')
  );
  
  const vpcResources = resources.filter(r => 
    stackTemplate.template.Resources[r].Type?.includes('EC2::VPC')
  );
  
  console.log('\n=== CRITICAL RESOURCE CHECK ===');
  console.log(`RDS resources: ${rdsResources.length}`);
  console.log(`Secrets Manager resources: ${secretsResources.length}`);
  console.log(`VPC resources: ${vpcResources.length}`);
  
  // Check for the specific resources the user expects
  const hasRdsInstance = rdsResources.some(r => 
    stackTemplate.template.Resources[r].Type === 'AWS::RDS::DBInstance'
  );
  
  const hasSecret = secretsResources.some(r => 
    stackTemplate.template.Resources[r].Type === 'AWS::SecretsManager::Secret'
  );
  
  console.log('\n=== USER ISSUE VERIFICATION ===');
  console.log('❌ Expected: RDS DB Instance -', hasRdsInstance ? '✅ FOUND' : '❌ MISSING');
  console.log('❌ Expected: Secrets Manager Secret -', hasSecret ? '✅ FOUND' : '❌ MISSING');
  
  if (hasRdsInstance) {
    const rdsInstanceId = rdsResources.find(r => 
      stackTemplate.template.Resources[r].Type === 'AWS::RDS::DBInstance'
    );
    if (rdsInstanceId) {
      const rdsResource = stackTemplate.template.Resources[rdsInstanceId];
      console.log(`RDS Instance ID: ${rdsResource.Properties?.DBInstanceIdentifier || 'Not set'}`);
    }
  }
  
  if (hasSecret) {
    const secretId = secretsResources.find(r => 
      stackTemplate.template.Resources[r].Type === 'AWS::SecretsManager::Secret'
    );
    if (secretId) {
      const secretResource = stackTemplate.template.Resources[secretId];
      console.log(`Secret Name: ${secretResource.Properties?.Name || 'Not set'}`);
    }
  }
  
  // Final diagnosis
  if (!hasRdsInstance || !hasSecret) {
    console.log('\n🚨 BUG CONFIRMED: RDS infrastructure is NOT being created!');
    console.log('The user report is accurate - Lambda functions are created but RDS is missing.');
  } else {
    console.log('\n✅ No bug found: All RDS infrastructure is being created correctly.');
  }
  
} catch (error) {
  console.error('❌ Template synthesis failed:', error instanceof Error ? error.message : String(error));
  console.log('\nThis might be the Docker bundling issue preventing template generation.');
}

console.log('\n=== TEST COMPLETE ===');
