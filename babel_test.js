const fs = require('fs');
const parser = require('@babel/parser');
const traverse = require('@babel/traverse').default;

const code = fs.readFileSync('frontend/app/(app)/leadership/index.tsx', 'utf-8');

const ast = parser.parse(code, {
  sourceType: 'module',
  plugins: ['jsx', 'typescript']
});

traverse(ast, {
  JSXText(path) {
    const text = path.node.value;
    // Check if it contains any non-whitespace
    if (text.trim().length > 0) {
      const parent = path.parent;
      if (parent.type === 'JSXElement') {
        const openingElement = parent.openingElement;
        const tagName = openingElement.name.name;
        if (tagName !== 'Text') {
          console.log(`Found non-whitespace text "${text.trim()}" inside <${tagName}> at line ${path.node.loc.start.line}`);
        }
      }
    }
  },
  JSXExpressionContainer(path) {
    const parent = path.parent;
    if (parent.type === 'JSXElement') {
      const openingElement = parent.openingElement;
      const tagName = openingElement.name.name;
      if (tagName !== 'Text' && tagName !== 'Animated.ScrollView' && tagName !== 'Animated.View') {
         if (path.node.expression.type === 'LogicalExpression') {
             console.log(`Found LogicalExpression inside <${tagName}> at line ${path.node.loc.start.line}`);
         }
      }
    }
  }
});
