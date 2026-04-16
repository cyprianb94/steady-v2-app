import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const appDir = path.resolve(rootDir, '..', 'packages', 'app');
const includeExtensions = new Set(['.ts', '.tsx', '.js', '.jsx', '.json']);
const blockedPatterns = [
  {
    pattern: /@steady\/server\/src\//g,
    message: 'Use @steady/server/contracts instead of server internals.',
  },
  {
    pattern: /(?:\.\.\/)+server\/src\//g,
    message: 'Do not reach into packages/server/src from the app package.',
  },
];

const violations = [];

walk(appDir);

if (violations.length > 0) {
  console.error('Package boundary check failed:\n');
  for (const violation of violations) {
    console.error(
      `${violation.file}:${violation.line}  ${violation.message}\n  ${violation.sourceLine}`,
    );
  }
  process.exit(1);
}

console.log('Package boundary check passed.');

function walk(currentDir) {
  for (const entry of fs.readdirSync(currentDir, { withFileTypes: true })) {
    const entryPath = path.join(currentDir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') {
        continue;
      }
      walk(entryPath);
      continue;
    }

    if (!includeExtensions.has(path.extname(entry.name))) {
      continue;
    }

    inspectFile(entryPath);
  }
}

function inspectFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const blockedPattern of blockedPatterns) {
      if (!blockedPattern.pattern.test(line)) {
        blockedPattern.pattern.lastIndex = 0;
        continue;
      }

      violations.push({
        file: path.relative(path.resolve(rootDir, '..'), filePath),
        line: index + 1,
        message: blockedPattern.message,
        sourceLine: line.trim(),
      });
      blockedPattern.pattern.lastIndex = 0;
    }
  });
}
