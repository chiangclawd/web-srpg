#!/usr/bin/env node
/* eslint-disable */
/**
 * 一次性圖檔壓縮腳本：把 public/assets/ 下的 PNG 縮到實際使用尺寸並重新 PNG 壓縮。
 * 使用方法： node scripts/optimize-assets.mjs
 *
 * 縮放規則：
 *   tiles/   → 短邊 256（hex 形顯示 69×80，2x retina + 餘裕）
 *   cg/      → 寬度 1280（in-game canvas 1560×720，1280 已足夠 sharp）
 *   sprites/ → 寬度 256（顯示 ~80px，2x 餘裕）
 *   portraits/ → 寬度 512（cutscene 立繪可達 480px 高，2x 餘裕）
 *
 * 跑完輸出每張節省多少。
 */
import sharp from 'sharp';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = 'public/assets';
const RULES = {
  tiles:     { width: 256 },
  cg:        { width: 1280 },
  sprites:   { width: 256 },
  portraits: { width: 512 },
};

async function* walkPngs(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) yield* walkPngs(full);
    else if (e.isFile() && e.name.toLowerCase().endsWith('.png')) yield full;
  }
}

function ruleFor(path) {
  for (const [key, rule] of Object.entries(RULES)) {
    if (path.includes(`/${key}/`)) return rule;
  }
  return null;
}

let totalBefore = 0;
let totalAfter = 0;
let touched = 0;

for await (const p of walkPngs(ROOT)) {
  const rule = ruleFor(p);
  if (!rule) continue;
  const before = (await stat(p)).size;
  totalBefore += before;
  const meta = await sharp(p).metadata();
  // 已小於目標寬度就只重新壓縮（不放大）
  const targetW = Math.min(rule.width, meta.width ?? rule.width);
  const buf = await sharp(p)
    .resize({ width: targetW, withoutEnlargement: true })
    .png({ compressionLevel: 9, palette: true, effort: 10 })
    .toBuffer();
  // 只在新檔案更小才覆寫（保險）
  if (buf.length < before) {
    await sharp(buf).toFile(p);
    const after = (await stat(p)).size;
    totalAfter += after;
    touched += 1;
    const pct = Math.round((1 - after / before) * 100);
    console.log(`  ${p}: ${(before / 1024 / 1024).toFixed(2)}MB → ${(after / 1024 / 1024).toFixed(2)}MB  (-${pct}%)`);
  } else {
    totalAfter += before;
    console.log(`  ${p}: skip (already optimal)`);
  }
}

const savedMB = ((totalBefore - totalAfter) / 1024 / 1024).toFixed(1);
const beforeMB = (totalBefore / 1024 / 1024).toFixed(1);
const afterMB = (totalAfter / 1024 / 1024).toFixed(1);
console.log(`\nDone. ${touched} files re-encoded.`);
console.log(`Total: ${beforeMB}MB → ${afterMB}MB  (saved ${savedMB}MB)`);
