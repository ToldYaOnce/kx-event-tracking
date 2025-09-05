#!/usr/bin/env node

// Script to fix remaining lambda.Function instances
const fs = require('fs');

function fixReadme() {
  console.log('Fixing remaining lambda.Function instances in README.md...');
  
  let content = fs.readFileSync('README.md', 'utf8');
  let changed = false;
  
  // Replace all remaining lambda.Function with NodejsFunction
  content = content.replace(/new lambda\.Function\(/g, 'new NodejsFunction(');
  
  // Fix any remaining lambda imports that weren't caught
  content = content.replace(/import \* as lambda from 'aws-cdk-lib\/aws-lambda';/g, 
    "import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';");
  
  // Fix runtime and handler properties - remove them since NodejsFunction handles this
  content = content.replace(/runtime: lambda\.Runtime\.[^,]+,\s*/g, '');
  content = content.replace(/handler: [^,\}]+,\s*/g, '');
  
  // Fix code properties to entry
  content = content.replace(/code: lambda\.Code\.fromInline\([^}]+\},?\s*\)/gs, 
    "entry: 'src/handlers/inline-handler.ts', // Move inline code to separate file");
  
  // Add entry property where missing
  content = content.replace(/new NodejsFunction\(([^,]+),\s*([^,]+),\s*\{\s*([^}]*)\}\)/gs, 
    (match, scope, id, props) => {
      if (!props.includes('entry:') && !props.includes('code:')) {
        // Generate entry path from function name
        let functionName = id.replace(/['"]/g, '').replace(/([A-Z])/g, '-$1').toLowerCase();
        if (functionName.startsWith('-')) functionName = functionName.substring(1);
        let entryPath = `src/handlers/${functionName}.ts`;
        
        if (props.trim()) {
          return `new NodejsFunction(${scope}, ${id}, {\n      entry: '${entryPath}',\n      ${props}\n    })`;
        } else {
          return `new NodejsFunction(${scope}, ${id}, {\n      entry: '${entryPath}'\n    })`;
        }
      }
      return match;
    });
  
  fs.writeFileSync('README.md', content);
  console.log('✅ Fixed README.md');
}

fixReadme();
console.log('🎉 All remaining lambda.Function instances fixed!');


