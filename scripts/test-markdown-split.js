import fs from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const FULL_MD_PATH = path.join(ROOT, 'markdown', 'index.full.md');
const SECTION_DIR = path.join(ROOT, 'markdown', 'sections');

const normalize = (text) =>
  text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/\s+/g, '')
    .trim();

async function run() {
  const full = await fs.readFile(FULL_MD_PATH, 'utf8');
  const sectionFiles = (await fs.readdir(SECTION_DIR))
    .filter((name) => name.endsWith('.md'))
    .sort((a, b) => a.localeCompare(b));

  const merged = (
    await Promise.all(sectionFiles.map((name) => fs.readFile(path.join(SECTION_DIR, name), 'utf8')))
  ).join('\n');

  const normalizedFull = normalize(full);
  const normalizedMerged = normalize(merged);

  if (normalizedFull !== normalizedMerged) {
    throw new Error('Split+merge verification failed: text mismatch detected.');
  }

  console.log(`Verified ${sectionFiles.length} files, no text loss after split+merge.`);
}

run().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
