import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const coreDir = path.join(rootDir, 'node_modules', '@ffmpeg', 'core', 'dist', 'esm');
const outDir = path.join(rootDir, 'public', 'ffmpeg');

const MAX_CHUNK_BYTES = 16 * 1024 * 1024; // 16 MiB (comfortably under Cloudflare Pages' 25 MiB limit)

function prepareFfmpegAssets() {
  const coreJsSrc = path.join(coreDir, 'ffmpeg-core.js');
  const coreWasmSrc = path.join(coreDir, 'ffmpeg-core.wasm');

  if (!fs.existsSync(coreJsSrc) || !fs.existsSync(coreWasmSrc)) {
    throw new Error(`Missing @ffmpeg/core ESM assets in ${coreDir}. Run npm install first.`);
  }

  fs.mkdirSync(outDir, { recursive: true });

  const coreJsDest = path.join(outDir, 'ffmpeg-core.js');
  fs.copyFileSync(coreJsSrc, coreJsDest);

  const wasmBuffer = fs.readFileSync(coreWasmSrc);
  const totalParts = Math.ceil(wasmBuffer.length / MAX_CHUNK_BYTES);

  // Remove stale parts if core size changed across upgrades
  for (const existing of fs.readdirSync(outDir)) {
    if (existing.startsWith('ffmpeg-core.wasm.part')) {
      fs.unlinkSync(path.join(outDir, existing));
    }
  }

  const parts = [];
  for (let i = 0; i < totalParts; i += 1) {
    const start = i * MAX_CHUNK_BYTES;
    const end = Math.min(start + MAX_CHUNK_BYTES, wasmBuffer.length);
    const partName = `ffmpeg-core.wasm.part${i}`;
    fs.writeFileSync(path.join(outDir, partName), wasmBuffer.subarray(start, end));
    parts.push({ name: partName, bytes: end - start });
  }

  const manifest = {
    version: JSON.parse(
      fs.readFileSync(path.join(rootDir, 'node_modules', '@ffmpeg', 'core', 'package.json'), 'utf8'),
    ).version,
    totalBytes: wasmBuffer.length,
    parts: parts.map((p) => p.name),
  };

  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(
    `[prepare-ffmpeg] Ready: ffmpeg-core.js + ${parts.length} wasm chunks (${(wasmBuffer.length / (1024 * 1024)).toFixed(2)} MiB total)`,
  );
}

prepareFfmpegAssets();
