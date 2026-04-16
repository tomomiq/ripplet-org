#!/usr/bin/env node
// scripts/generate-descriptions.mjs
// Generates SEO meta descriptions for markdown content files using the Claude API.
// Usage: node scripts/generate-descriptions.mjs [--dir <dir>] [--all]

import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';

const args = process.argv.slice(2);
const dirFlag = args.indexOf('--dir');
const dir = dirFlag !== -1 ? args[dirFlag + 1] : 'writing';
const replaceAll = args.includes('--all');

const contentDir = path.join(process.cwd(), 'src/content', dir);

// Split file into frontmatter YAML string + body string.
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return null;
  return { yaml: match[1], body: match[2] };
}

// Read a YAML key from a single-line value (handles quoted or bare values).
function getYamlValue(yaml, key) {
  const regex = new RegExp(`^${key}:\\s*(.*)$`, 'm');
  const m = yaml.match(regex);
  if (!m) return null;
  let val = m[1].trim();
  if ((val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  return val;
}

// Replace or insert a YAML key's value. Wraps in double-quotes if value contains a colon.
function setYamlValue(yaml, key, value) {
  const formatted = value.includes(':') ? `"${value}"` : value;
  const lineRegex = new RegExp(`^(${key}:)\\s*.*$`, 'm');
  if (lineRegex.test(yaml)) {
    return yaml.replace(lineRegex, `$1 ${formatted}`);
  }
  // Key absent — insert after the title line (or append).
  const titleLineRegex = /^(title:.*)$/m;
  if (titleLineRegex.test(yaml)) {
    return yaml.replace(titleLineRegex, `$1\ndescription: ${formatted}`);
  }
  return yaml + `\ndescription: ${formatted}`;
}

async function main() {
  if (!fs.existsSync(contentDir)) {
    console.error(`Content directory not found: ${contentDir}`);
    process.exit(1);
  }

  const client = new Anthropic();
  const files = fs.readdirSync(contentDir).filter(f => f.endsWith('.md'));

  console.log(`Processing ${files.length} files in src/content/${dir} (--all: ${replaceAll})\n`);

  for (const file of files) {
    const filePath = path.join(contentDir, file);
    const raw = fs.readFileSync(filePath, 'utf-8');
    const parsed = parseFrontmatter(raw);
    if (!parsed) {
      console.log(`  SKIP ${file} — could not parse frontmatter`);
      continue;
    }

    const { yaml, body } = parsed;
    const title = getYamlValue(yaml, 'title') ?? file;
    const existing = getYamlValue(yaml, 'description');
    const needsRegen = replaceAll || !existing || existing.length < 80;

    if (!needsRegen) {
      console.log(`  OK   ${file} (${existing.length} chars)`);
      continue;
    }

    process.stdout.write(`  GEN  ${file} … `);

    const bodyExcerpt = body.trim().slice(0, 3000);

    const response = await client.messages.create({
      model: 'claude-opus-4-6',
      max_tokens: 200,
      messages: [{
        role: 'user',
        content: `Write an SEO meta description for the article below.

Requirements:
- 120–160 characters long (count carefully)
- Plain, direct language — no jargon
- Do not start with "In this essay", "This article", "Explore", or similar opener phrases
- Do not use colons anywhere in the description
- Return only the description text — no labels, no quotes, no commentary

Title: ${title}

Article:
${bodyExcerpt}`
      }]
    });

    const newDesc = response.content[0].text.trim();
    const updatedYaml = setYamlValue(yaml, 'description', newDesc);
    const updatedFile = `---\n${updatedYaml}\n---\n${body}`;

    fs.writeFileSync(filePath, updatedFile);
    console.log(`${newDesc.length} chars\n       "${newDesc}"`);
  }

  console.log('\nDone.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
