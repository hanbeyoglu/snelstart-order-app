const { readdirSync, statSync } = require('node:fs');
const { join } = require('node:path');
const { spawnSync } = require('node:child_process');

function collectSpecFiles(directory) {
  const files = [];

  for (const entry of readdirSync(directory)) {
    const fullPath = join(directory, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      files.push(...collectSpecFiles(fullPath));
    } else if (entry.endsWith('.spec.js')) {
      files.push(fullPath);
    }
  }

  return files;
}

const specFiles = collectSpecFiles(join(__dirname, '..', 'dist'));

if (specFiles.length === 0) {
  console.error('No compiled test files found in apps/api/dist.');
  process.exit(1);
}

const result = spawnSync(process.execPath, ['--test', ...specFiles], {
  stdio: 'inherit',
});

process.exit(result.status ?? 1);
