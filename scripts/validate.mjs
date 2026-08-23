#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errors = [];
const warnings = [];
const readJson = relativePath => JSON.parse(fs.readFileSync(path.join(root, relativePath), 'utf8'));
const exists = relativePath => fs.existsSync(path.join(root, relativePath));
const fail = message => errors.push(message);
const warn = message => warnings.push(message);

const manifest = readJson('data/manifest.json');
const site = manifest.site || {};
const sharedPath = `data/${site.sharedDefinitions || manifest.sharedDefinitions || 'shared-definitions.json'}`;
if (!exists(sharedPath)) fail(`Missing shared definitions: ${sharedPath}`);
const shared = exists(sharedPath) ? readJson(sharedPath) : { ppe: {}, sectionIcons: {} };
const publicationMode = site.studentPublicationMode === 'approved-only' ? 'approved-only' : 'curated-drafts';

const tools = [];
const draftStudentIds = [];
for (const dataset of (manifest.datasets || []).filter(item => item.enabled !== false)) {
  const relativePath = `data/${dataset.file}`;
  if (!exists(relativePath)) {
    fail(`Manifest dataset does not exist: ${relativePath}`);
    continue;
  }
  const data = readJson(relativePath);
  if (!data.department?.id || !data.department?.name) fail(`${relativePath}: missing department id/name`);
  for (const tool of data.tools || []) {
    tools.push({ ...tool, department: data.department, modes: dataset.modes || ['student', 'teacher'], file: relativePath });
  }
}

const duplicateValues = (items, getKey) => {
  const counts = new Map();
  for (const item of items) {
    const key = getKey(item);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts].filter(([, count]) => count > 1).map(([key]) => key);
};

for (const id of duplicateValues(tools, tool => tool.id)) fail(`Duplicate tool id: ${id}`);
for (const route of duplicateValues(tools, tool => `${tool.department?.id}/${tool.slug || tool.id}`)) fail(`Duplicate department route: ${route}`);

const canShowStudent = tool => {
  if (!tool.modes.includes('student')) return false;
  if (tool.sourceAccess === 'teacher-only') return false;
  if (tool.studentVisible === false) return false;
  if (tool.student?.summaryStatus !== 'curated') return false;
  if (tool.local?.studentUseApproved === false) return false;
  if (publicationMode === 'approved-only' && tool.local?.studentUseApproved !== true) return false;
  return true;
};

const usedPpe = new Set();
for (const tool of tools) {
  if (!tool.id || !tool.name) fail(`${tool.file}: tool missing id/name`);
  if (!tool.image) fail(`${tool.id}: SOP has no image`);
  else if (path.extname(tool.image).toLowerCase() !== '.webp') fail(`${tool.id}: SOP image must be WebP: ${tool.image}`);
  else if (!exists(tool.image)) fail(`${tool.id}: missing image ${tool.image}`);
  for (const key of tool.student?.ppe || []) usedPpe.add(key);
  for (const key of tool.teacher?.ppe || []) usedPpe.add(key);

  if (canShowStudent(tool)) {
    const qrPath = `${site.qrCodeDirectory || 'assets/qrcodes/student'}/${tool.id}.svg`;
    if (!exists(qrPath)) fail(`${tool.id}: missing Student SOP QR code ${qrPath}`);
    for (const field of ['headline', 'hazards', 'beforeStart', 'dos', 'donts', 'stop']) {
      const value = tool.student?.[field];
      if (value == null || (Array.isArray(value) && value.length === 0) || (typeof value === 'string' && !value.trim())) {
        fail(`${tool.id}: published Student SOP missing student.${field}`);
      }
    }
    if (!tool.student?.ppe?.length) warn(`${tool.id}: Student SOP has no specific PPE/preparation keys`);
    if (tool.local?.studentUseApproved !== true) draftStudentIds.push(tool.id);
  }
}

if (draftStudentIds.length) {
  warn(`${draftStudentIds.length} Student SOPs are published as clearly marked drafts while local approval is pending`);
}

for (const key of usedPpe) {
  if (!shared.ppe?.[key]) fail(`Unknown PPE/preparation key: ${key}`);
}
for (const [key, item] of Object.entries(shared.ppe || {})) {
  if (!item.icon) fail(`PPE/preparation definition has no icon: ${key}`);
  else if (path.extname(item.icon).toLowerCase() !== '.webp') fail(`PPE/preparation icon must be WebP for ${key}: ${item.icon}`);
  else if (!exists(item.icon)) fail(`PPE/preparation icon missing: ${item.icon}`);
}
for (const [key, item] of Object.entries(shared.sectionIcons || {})) {
  if (!item.icon || !exists(item.icon)) fail(`Section icon missing for ${key}: ${item.icon || '(no path)'}`);
}

const qrDirectory = path.join(root, site.qrCodeDirectory || 'assets/qrcodes/student');
if (fs.existsSync(qrDirectory)) {
  const misplaced = fs.readdirSync(qrDirectory).filter(name => name.toLowerCase().endsWith('.webp'));
  for (const name of misplaced) fail(`Machine image is misplaced in QR directory: ${name}`);
}

for (const legacy of ['building.json', 'food.json', 'shared-definitions.json']) {
  if (exists(legacy)) fail(`Legacy root-level data file should not exist: ${legacy}`);
}

const indexPath = `${site.qrCodeDirectory || 'assets/qrcodes/student'}/index.json`;
if (!exists(indexPath)) {
  fail(`Missing QR index: ${indexPath}`);
} else {
  const index = readJson(indexPath);
  const studentTools = tools.filter(canShowStudent);
  const expectedById = new Map(studentTools.map(tool => [tool.id, tool]));
  const baseUrl = String(site.publicBaseUrl || '').replace(/\/?$/, '/');
  if (index.length !== studentTools.length) fail(`QR index has ${index.length} entries; expected ${studentTools.length}`);
  for (const id of duplicateValues(index, entry => entry.id)) fail(`Duplicate QR index id: ${id}`);
  for (const entry of index) {
    const tool = expectedById.get(entry.id);
    if (!tool) {
      fail(`QR index contains an unpublished or unknown tool: ${entry.id}`);
      continue;
    }
    const expectedUrl = `${baseUrl}#/${tool.department.id}/${tool.slug || tool.id}`;
    if (entry.url !== expectedUrl) fail(`${entry.id}: QR index URL is ${entry.url}; expected ${expectedUrl}`);
    if (!entry.file || !exists(entry.file)) fail(`${entry.id}: QR index file is missing: ${entry.file || '(no path)'}`);
  }
  for (const tool of studentTools) {
    if (!index.some(entry => entry.id === tool.id)) fail(`${tool.id}: missing from QR index`);
  }

  if (fs.existsSync(qrDirectory)) {
    const expectedSvgNames = new Set(studentTools.map(tool => `${tool.id}.svg`));
    for (const name of fs.readdirSync(qrDirectory).filter(item => item.endsWith('.svg'))) {
      if (!expectedSvgNames.has(name)) fail(`Obsolete/orphan QR SVG: ${name}`);
    }
  }
}

console.log(`Checked ${tools.length} SOP records.`);
for (const message of warnings) console.warn(`WARNING: ${message}`);
if (errors.length) {
  for (const message of errors) console.error(`ERROR: ${message}`);
  console.error(`Validation failed with ${errors.length} error(s) and ${warnings.length} warning(s).`);
  process.exit(1);
}
console.log(`Validation passed with ${warnings.length} warning(s).`);
