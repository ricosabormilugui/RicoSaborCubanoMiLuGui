import { readFileSync } from 'node:fs';

const files = ['package.json', 'angular.json', 'tsconfig.json', 'tsconfig.app.json', 'netlify.toml'];
for (const file of files) {
  const content = readFileSync(file, 'utf8');
  if (file.endsWith('.json')) {
    JSON.parse(content);
  }
}
console.log('JSON files are valid');
