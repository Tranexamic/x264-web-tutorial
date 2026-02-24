import fs from 'node:fs/promises';
import path from 'node:path';
import { unified } from 'unified';
import rehypeParse from 'rehype-parse';
import rehypeRemark from 'rehype-remark';
import remarkStringify from 'remark-stringify';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';
import { toText } from 'hast-util-to-text';

const ROOT = process.cwd();
const HTML_PATH = path.join(ROOT, 'HTML', 'index.html');
const OUTPUT_DIR = path.join(ROOT, 'markdown');
const SECTION_DIR = path.join(OUTPUT_DIR, 'sections');
const FULL_MD_PATH = path.join(OUTPUT_DIR, 'index.full.md');

const slugify = (text) =>
  text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-\u4e00-\u9fff]/g, '')
    .replace(/-+/g, '-');

function removeComments() {
  return (tree) => {
    visit(tree, 'comment', (node, index, parent) => {
      if (!parent || index === undefined) {
        return;
      }
      parent.children.splice(index, 1);
      return index;
    });
  };
}

function flattenTableCells() {
  return (tree) => {
    visit(tree, 'element', (node) => {
      if (node.tagName !== 'td' && node.tagName !== 'th') {
        return;
      }
      const text = toText(node, { whitespace: 'normalize' }).replace(/\s*\n\s*/g, ' ').trim();
      node.children = text ? [{ type: 'text', value: text }] : [];
    });
  };
}

function splitByH2(markdown) {
  const lines = markdown.split(/\r?\n/);
  const sections = [];

  let current = { title: '00-前言', lines: [] };

  for (const line of lines) {
    if (line.startsWith('## ')) {
      if (current.lines.length > 0) {
        sections.push(current);
      }
      const rawTitle = line.slice(3).trim();
      current = {
        title: rawTitle,
        lines: [line],
      };
    } else {
      current.lines.push(line);
    }
  }

  if (current.lines.length > 0) {
    sections.push(current);
  }

  return sections.map((section, idx) => {
    const prefix = String(idx).padStart(2, '0');
    const safe = slugify(section.title) || `section-${prefix}`;
    return {
      fileName: `${prefix}-${safe}.md`,
      title: section.title,
      content: section.lines.join('\n').trim() + '\n',
    };
  });
}

async function run() {
  const html = await fs.readFile(HTML_PATH, 'utf8');

  const processor = unified()
    .use(rehypeParse, { fragment: false })
    .use(removeComments)
    .use(flattenTableCells)
    .use(rehypeRemark)
    .use(remarkGfm)
    .use(remarkStringify, {
      bullet: '-',
      fences: true,
      listItemIndent: 'one',
      strong: '*'
    });

  const file = await processor.process(html);
  const markdown = String(file);

  await fs.mkdir(SECTION_DIR, { recursive: true });
  await fs.writeFile(FULL_MD_PATH, markdown, 'utf8');

  const sections = splitByH2(markdown);

  for (const section of sections) {
    await fs.writeFile(path.join(SECTION_DIR, section.fileName), section.content, 'utf8');
  }

  const manifest = sections.map((section) => `- ${section.fileName}: ${section.title}`).join('\n') + '\n';
  await fs.writeFile(path.join(OUTPUT_DIR, 'sections.manifest.md'), manifest, 'utf8');

  console.log(`Wrote ${FULL_MD_PATH}`);
  console.log(`Split into ${sections.length} markdown files in ${SECTION_DIR}`);
}

run().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
