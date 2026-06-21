import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const sourceRoots = ['src/app', 'src/components'];
const numberInputPattern = /\btype\s*=\s*(?:"number"|'number'|\{\s*["']number["']\s*\})/;

function collectTsxFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const fullPath = path.join(directory, entry);
    const stats = statSync(fullPath);

    if (stats.isDirectory()) {
      return collectTsxFiles(fullPath);
    }

    return fullPath.endsWith('.tsx') ? [fullPath] : [];
  });
}

test('numeric fields use manual text entry instead of native number steppers', () => {
  const filesWithNumberInputs = sourceRoots
    .flatMap((sourceRoot) => collectTsxFiles(path.join(repoRoot, sourceRoot)))
    .filter((file) => numberInputPattern.test(readFileSync(file, 'utf8')))
    .map((file) => path.relative(repoRoot, file));

  assert.deepEqual(filesWithNumberInputs, []);
});
