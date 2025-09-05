#!/usr/bin/env node

// Script to fix all lambda.Function instances to use NodejsFunction
const fs = require('fs');
const path = require('path');

function fixFile(filePath) {
  console.log(`Fixing ${filePath}...`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let changed = false;
  
  // Fix imports - add NodejsFunction import
  if (content.includes("import * as lambda from 'aws-cdk-lib/aws-lambda';")) {
    content = content.replace(
      "import * as lambda from 'aws-cdk-lib/aws-lambda';",
      "import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';"
    );
    changed = true;
  }
  
  // Fix lambda.Function instances with fromAsset
  const fromAssetRegex = /new lambda\.Function\(([^,]+),\s*([^,]+),\s*\{\s*runtime:\s*lambda\.Runtime\.[^,]+,\s*code:\s*lambda\.Code\.fromAsset\(([^)]+)\),\s*handler:\s*([^,\}]+),?([^}]*)\}\)/gs;
  
  content = content.replace(fromAssetRegex, (match, scope, id, assetPath, handler, rest) => {
    // Extract entry path from asset path
    let entryPath = assetPath.replace(/['"]/g, '');
    if (!entryPath.endsWith('.ts')) {
      entryPath = entryPath + '/index.ts';
    }
    
    // Clean up rest of the properties
    let restProps = rest.trim();
    if (restProps.startsWith(',')) {
      restProps = restProps.substring(1).trim();
    }
    
    let result = `new NodejsFunction(${scope}, ${id}, {\n      entry: '${entryPath}'`;
    if (restProps) {
      result += `,\n      ${restProps}`;
    }
    result += '\n    })';
    
    changed = true;
    return result;
  });
  
  // Fix simple lambda.Function instances without fromAsset
  const simpleFunctionRegex = /new lambda\.Function\(([^,]+),\s*([^,]+),\s*\{\s*runtime:\s*lambda\.Runtime\.[^,]+,\s*handler:\s*([^,\}]+),?([^}]*)\}\)/gs;
  
  content = content.replace(simpleFunctionRegex, (match, scope, id, handler, rest) => {
    // Skip if it's already been processed or has inline code
    if (match.includes('Code.fromInline') || match.includes('NodejsFunction')) {
      return match;
    }
    
    let restProps = rest.trim();
    if (restProps.startsWith(',')) {
      restProps = restProps.substring(1).trim();
    }
    
    // Generate entry path from function name
    let functionName = id.replace(/['"]/g, '').replace(/([A-Z])/g, '-$1').toLowerCase().substring(1);
    let entryPath = `src/handlers/${functionName}.ts`;
    
    let result = `new NodejsFunction(${scope}, ${id}, {\n      entry: '${entryPath}'`;
    if (restProps) {
      result += `,\n      ${restProps}`;
    }
    result += '\n    })';
    
    changed = true;
    return result;
  });
  
  if (changed) {
    fs.writeFileSync(filePath, content);
    console.log(`✅ Fixed ${filePath}`);
  } else {
    console.log(`⏭️  No changes needed in ${filePath}`);
  }
}

// Files to fix
const filesToFix = [
  'README.md',
  'packages/kx-event-consumers/README.md',
  'packages/kx-event-consumers/GETTING_STARTED.md',
  'examples/event-consumer-example/consumer-stack.ts'
];

console.log('🔧 Fixing lambda.Function instances to use NodejsFunction...\n');

filesToFix.forEach(file => {
  if (fs.existsSync(file)) {
    fixFile(file);
  } else {
    console.log(`⚠️  File not found: ${file}`);
  }
});

console.log('\n🎉 All files processed!');


