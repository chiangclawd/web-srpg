// Meshy API 小工具：建立任務 → 輪詢到完成 → 下載結果檔。
// 金鑰由環境的網路密鑰自動附加（Authorization 標頭），程式裡不放金鑰。
// 用法：
//   NODE_USE_ENV_PROXY=1 node scripts/art/meshy.mjs image <out-dir> <image.png>          圖轉 3D（A 字姿勢、含材質）
//   NODE_USE_ENV_PROXY=1 node scripts/art/meshy.mjs remesh <out-dir> <image-to-3d task id>  減面（綁骨架上限 32 萬面）
//   NODE_USE_ENV_PROXY=1 node scripts/art/meshy.mjs rig <out-dir> <remesh task id>  自動綁骨架
//   NODE_USE_ENV_PROXY=1 node scripts/art/meshy.mjs anim <out-dir> <rig task id> <action_id>...  套用動作（一次最多 10 個）
//   NODE_USE_ENV_PROXY=1 node scripts/art/meshy.mjs fetch <out-dir> <image|remesh|rig|anim>    重新下載已完成任務的 GLB
// 每個任務的回應存成 <out-dir>/<kind>.json；rig / anim 的 GLB 下載到同一個資料夾。
import fs from 'node:fs';
import path from 'node:path';

const API = 'https://api.meshy.ai/openapi/v1';
const [kind, outDir, arg, ...rest] = process.argv.slice(2);
if (!kind || !outDir || !arg) {
  console.error('usage: meshy.mjs image|remesh|rig|anim|fetch <out-dir> <input> [action ids]');
  process.exit(2);
}
fs.mkdirSync(outDir, { recursive: true });

async function call(method, url, body) {
  const res = await fetch(url, { method, headers: { 'content-type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const text = await res.text();
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}: ${text.slice(0, 500)}`);
  return JSON.parse(text);
}

async function run(endpoint, body) {
  const created = await call('POST', `${API}/${endpoint}`, body);
  const id = created.result;
  console.log(`${endpoint} task ${id}`);
  for (;;) {
    await new Promise((r) => setTimeout(r, 8000));
    const t = await call('GET', `${API}/${endpoint}/${id}`);
    process.stdout.write(`\r${t.status} ${t.progress ?? ''}%   `);
    if (t.status === 'SUCCEEDED') {
      console.log('');
      return t;
    }
    if (t.status === 'FAILED' || t.status === 'CANCELED') throw new Error(`${endpoint} ${t.status}: ${JSON.stringify(t.task_error ?? t).slice(0, 400)}`);
  }
}

/** 把結果裡所有 .glb 網址下載下來 */
async function downloadAll(obj, prefix) {
  const urls = [];
  const walk = (o, keyPath) => {
    if (typeof o === 'string' && /^https?:\/\/.*\.glb(\?|$)/.test(o)) urls.push([keyPath, o]);
    else if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) walk(v, keyPath ? `${keyPath}.${k}` : k);
  };
  walk(obj, '');
  for (const [k, u] of urls) {
    // 結果檔放在 assets.meshy.ai；網路政策沒開放時只留 JSON，之後用 fetch 子指令補下載
    const res = await fetch(u).catch((e) => ({ ok: false, status: e.cause?.code ?? e.message }));
    if (!res.ok) {
      console.warn(`download ${k} failed: ${res.status}`);
      continue;
    }
    const f = path.join(outDir, `${prefix}_${k.replace(/[^a-z0-9]+/gi, '_')}.glb`);
    fs.writeFileSync(f, Buffer.from(await res.arrayBuffer()));
    console.log(`saved ${f}`);
  }
}

let task;
if (kind === 'image') {
  const b64 = fs.readFileSync(arg).toString('base64');
  task = await run('image-to-3d', {
    image_url: `data:image/png;base64,${b64}`,
    ai_model: process.env.MESHY_MODEL ?? 'latest',
    should_texture: true,
    enable_pbr: false,
    // 人形用 A 字姿勢方便綁骨架；動物等非人形設 MESHY_POSE=none（照原圖姿勢）
    pose_mode: process.env.MESHY_POSE === 'none' ? '' : (process.env.MESHY_POSE ?? 'a-pose'),
    topology: 'triangle',
    target_polycount: Number(process.env.MESHY_POLY ?? 20000),
    target_formats: ['glb'],
  });
} else if (kind === 'remesh') {
  // 圖轉 3D 的原始模型面數太多（上百萬面），綁骨架前要先減面
  task = await run('remesh', { input_task_id: arg, target_polycount: Number(process.env.MESHY_POLY ?? 20000), topology: 'triangle', target_formats: ['glb'] });
} else if (kind === 'rig') {
  task = await run('rigging', { input_task_id: arg, height_meters: Number(process.env.MESHY_HEIGHT ?? 1.7) });
} else if (kind === 'anim') {
  task = await run('animations', { rig_task_id: arg, action_ids: rest.map(Number) });
} else if (kind === 'fetch') {
  // 重新下載某個已存的任務結果：fetch <out-dir> <kind>
  task = JSON.parse(fs.readFileSync(path.join(outDir, `${arg}.json`), 'utf8'));
  await downloadAll(task, arg);
  process.exit(0);
} else {
  throw new Error(`unknown kind ${kind}`);
}
fs.writeFileSync(path.join(outDir, `${kind}.json`), JSON.stringify(task, null, 2));
// 圖轉 3D 和減面的模型很大（數十 MB）又用不到，只下載綁好骨架和套好動作的檔
if (kind === 'rig' || kind === 'anim') await downloadAll(task, kind);
