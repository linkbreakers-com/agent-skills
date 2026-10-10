#!/usr/bin/env node
// Regenerates discovery.json skills[] from skills/*/SKILL.md.
// --check exits non-zero instead of writing when discovery.json is stale or a skill is invalid.
import { readFileSync, readdirSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function parseFrontmatter(text, file) {
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) throw new Error(`${file}: missing YAML frontmatter`);
  const fields = {};
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z][\w-]*):\s*(.*)$/);
    if (!kv) continue;
    let value = kv[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    fields[kv[1]] = value;
  }
  return fields;
}

const errors = [];
const skillsDir = join(root, 'skills');
const skills = readdirSync(skillsDir)
  .filter((entry) => statSync(join(skillsDir, entry)).isDirectory())
  .sort()
  .flatMap((dir) => {
    const path = `skills/${dir}/SKILL.md`;
    if (!existsSync(join(root, path))) {
      errors.push(`${path}: missing`);
      return [];
    }
    const fm = parseFrontmatter(readFileSync(join(root, path), 'utf8'), path);
    if (!fm.name) errors.push(`${path}: frontmatter "name" is required`);
    else if (!NAME_RE.test(fm.name) || fm.name.length > 64) errors.push(`${path}: invalid name "${fm.name}"`);
    else if (fm.name !== dir) errors.push(`${path}: name "${fm.name}" must match folder "${dir}"`);
    if (!fm.description) errors.push(`${path}: frontmatter "description" is required`);
    else if (fm.description.length > 1024) errors.push(`${path}: description exceeds 1024 characters`);
    return [{ name: fm.name, description: fm.description, path }];
  });

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

const discoveryPath = join(root, 'discovery.json');
const current = readFileSync(discoveryPath, 'utf8');
const discovery = JSON.parse(current);
discovery.skills = skills;
const next = `${JSON.stringify(discovery, null, 2)}\n`;

if (check) {
  if (next !== current) {
    console.error('discovery.json skills[] is out of date. Run: node scripts/build-discovery.mjs');
    process.exit(1);
  }
  console.log(`discovery.json lists all ${skills.length} skills`);
} else {
  writeFileSync(discoveryPath, next);
  console.log(`wrote ${skills.length} skills to discovery.json`);
}
