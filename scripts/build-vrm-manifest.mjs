#!/usr/bin/env node
// scripts/build-vrm-manifest.mjs
// Scans ALL model files, groups them by character, embeds audit data.
// No deduplication. Models served via @fs/ prefix.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const MANIFEST_DIR = path.join(ROOT, 'public', 'vrm-viewer');
const MANIFEST_PATH = path.join(MANIFEST_DIR, 'manifest.json');
const AUDITS_DIR = path.join(ROOT, 'model-audits');

// ── Source directories ──────────────────────────────────────────────
const CONSOLIDATED_BASE = path.join(
  process.env.HOME,
  'Downloads',
  'PosePuppet_Consolidated_Attempts_20260611-204228',
  'models',
);

const EXTENSIONS = new Set(['.vrm', '.glb', '.gltf']);

// ── Helpers ─────────────────────────────────────────────────────────

function walk(dir) {
  const results = [];
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return results; }
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) results.push(...walk(full));
    else if (ent.isFile() && EXTENSIONS.has(path.extname(ent.name).toLowerCase())) {
      const stat = fs.statSync(full);
      if (stat.size >= 100) results.push({ path: full, size: stat.size });
    }
  }
  return results;
}

function humanSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

function encPath(p) {
  return p.split('/').map((seg, i) => i === 0 ? seg : encodeURIComponent(seg)).join('/');
}

// ── Load audit data ─────────────────────────────────────────────────

function loadAuditData() {
  const auditMap = {};

  // summary.json has score, profile, action per slug
  const summaryPath = path.join(AUDITS_DIR, 'summary.json');
  if (fs.existsSync(summaryPath)) {
    const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
    for (const a of summary.audits) {
      auditMap[a.slug] = {
        name: a.name,
        score: a.overall,
        profile: a.profile,
        action: a.action,
      };
    }
  }

  // avatar-registry-plan.json has controls, warning, notes per slug
  const regPath = path.join(AUDITS_DIR, 'avatar-registry-plan.json');
  if (fs.existsSync(regPath)) {
    const reg = JSON.parse(fs.readFileSync(regPath, 'utf-8'));
    for (const av of reg.avatars) {
      if (!auditMap[av.avatar_id]) auditMap[av.avatar_id] = {};
      Object.assign(auditMap[av.avatar_id], {
        name: auditMap[av.avatar_id]?.name || av.display_name,
        displayName: av.display_name,
        enabledControls: av.default_enabled_controls,
        disabledControls: av.default_disabled_controls,
        warningLabel: av.warning_label,
        notes: av.notes,
        profile: av.profile,
      });
    }
  }

  return auditMap;
}

// ── Main ────────────────────────────────────────────────────────────

fs.mkdirSync(MANIFEST_DIR, { recursive: true });

const auditMap = loadAuditData();
console.log(`Loaded audit data for ${Object.keys(auditMap).length} characters`);

// Build character groups
const characters = [];
const ungroupedModels = [];

// 1. Scan consolidated folder — each top-level subdir is a character
if (fs.existsSync(CONSOLIDATED_BASE)) {
  const charDirs = fs.readdirSync(CONSOLIDATED_BASE, { withFileTypes: true })
    .filter(d => d.isDirectory() && d.name !== '.DS_Store')
    .map(d => d.name)
    .sort();

  for (const slug of charDirs) {
    const charDir = path.join(CONSOLIDATED_BASE, slug);
    const audit = auditMap[slug] || {};

    // Find all attempt subdirs
    const attemptDirs = fs.readdirSync(charDir, { withFileTypes: true })
      .filter(d => d.isDirectory() && d.name !== '.DS_Store')
      .map(d => d.name)
      .sort();

    const attempts = [];
    for (const attemptName of attemptDirs) {
      const attemptDir = path.join(charDir, attemptName);
      const files = walk(attemptDir);

      const models = files.map(f => {
        const ext = path.extname(f.path).toLowerCase().slice(1);
        const relPath = path.relative(attemptDir, f.path);
        return {
          name: relPath,
          url: `/@fs${encPath(f.path)}`,
          type: ext,
          size: f.size,
          sizeHuman: humanSize(f.size),
        };
      });

      if (models.length > 0) {
        attempts.push({
          name: attemptName,
          models,
        });
      }
    }

    characters.push({
      slug,
      displayName: audit.displayName || audit.name || slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
      score: audit.score ?? null,
      profile: audit.profile ?? 'unknown',
      action: audit.action ?? null,
      warningLabel: audit.warningLabel ?? null,
      enabledControls: audit.enabledControls ?? [],
      disabledControls: audit.disabledControls ?? [],
      notes: audit.notes ?? [],
      attempts,
      totalFiles: attempts.reduce((sum, a) => sum + a.models.length, 0),
    });
  }
}

// 2. Scan public/avatars (shipping VRMs)
const pubAvatarsDir = path.join(ROOT, 'public', 'avatars');
if (fs.existsSync(pubAvatarsDir)) {
  const files = walk(pubAvatarsDir);
  for (const f of files) {
    const ext = path.extname(f.path).toLowerCase().slice(1);
    const basename = path.basename(f.path);
    ungroupedModels.push({
      name: `public/avatars/${basename}`,
      url: `/avatars/${encodeURIComponent(basename)}`,
      type: ext,
      size: f.size,
      sizeHuman: humanSize(f.size),
      source: 'public/avatars',
    });
  }
}

// 3. Scan models_for_animation
const animDir = path.join(ROOT, 'models_for_animation');
if (fs.existsSync(animDir)) {
  const files = walk(animDir);
  for (const f of files) {
    const ext = path.extname(f.path).toLowerCase().slice(1);
    const relPath = path.relative(animDir, f.path);
    ungroupedModels.push({
      name: `models_for_animation/${relPath}`,
      url: `/@fs${encPath(f.path)}`,
      type: ext,
      size: f.size,
      sizeHuman: humanSize(f.size),
      source: 'models_for_animation',
    });
  }
}

// Count totals
const totalGrouped = characters.reduce((s, c) => s + c.totalFiles, 0);
const totalUngrouped = ungroupedModels.length;
const total = totalGrouped + totalUngrouped;

const allFiles = [
  ...characters.flatMap(c => c.attempts.flatMap(a => a.models)),
  ...ungroupedModels,
];
const vrmCount = allFiles.filter(m => m.type === 'vrm').length;
const glbCount = allFiles.filter(m => m.type === 'glb').length;

const manifest = {
  generatedAt: new Date().toISOString(),
  totalModels: total,
  byType: { vrm: vrmCount, glb: glbCount, gltf: allFiles.filter(m => m.type === 'gltf').length },
  characters,
  ungroupedModels,
};

fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');

console.log(`\n✅ Manifest written: ${MANIFEST_PATH}`);
console.log(`   ${characters.length} characters with ${totalGrouped} files`);
console.log(`   ${totalUngrouped} ungrouped files (public/avatars + models_for_animation)`);
console.log(`   Total: ${total} models | VRM: ${vrmCount} | GLB: ${glbCount}`);
for (const c of characters) {
  const scoreStr = c.score != null ? `${c.score}/100` : '?';
  console.log(`   ${c.displayName.padEnd(28)} ${scoreStr.padEnd(8)} ${c.profile.padEnd(24)} ${c.totalFiles} files`);
}
