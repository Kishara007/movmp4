import type { FFmpeg } from '@ffmpeg/ffmpeg';

interface FfmpegManifest {
  version: string;
  totalBytes: number;
  parts: string[];
}

const CDN_CORE_BASE = 'https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/esm';

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;
let cachedWasmBlobUrl: string | null = null;

async function fetchLocalWasmBlobUrl(): Promise<{ coreURL: string; wasmURL: string }> {
  const origin = window.location.origin;
  const manifestRes = await fetch(`${origin}/ffmpeg/manifest.json`);
  if (!manifestRes.ok) {
    throw new Error(`Local FFmpeg manifest unavailable (${manifestRes.status})`);
  }
  const manifest = (await manifestRes.json()) as FfmpegManifest;
  if (!Array.isArray(manifest.parts) || manifest.parts.length === 0) {
    throw new Error('Invalid local FFmpeg manifest');
  }

  const chunkBuffers = await Promise.all(
    manifest.parts.map(async (partName) => {
      const res = await fetch(`${origin}/ffmpeg/${partName}`);
      if (!res.ok) {
        throw new Error(`Failed to fetch FFmpeg WASM part: ${partName}`);
      }
      return res.arrayBuffer();
    }),
  );

  const wasmBlob = new Blob(chunkBuffers, { type: 'application/wasm' });
  cachedWasmBlobUrl = URL.createObjectURL(wasmBlob);

  return {
    coreURL: `${origin}/ffmpeg/ffmpeg-core.js`,
    wasmURL: cachedWasmBlobUrl,
  };
}

async function fetchCdnCoreUrls(): Promise<{ coreURL: string; wasmURL: string }> {
  const { toBlobURL } = await import('@ffmpeg/util');
  const [coreURL, wasmURL] = await Promise.all([
    toBlobURL(`${CDN_CORE_BASE}/ffmpeg-core.js`, 'text/javascript'),
    toBlobURL(`${CDN_CORE_BASE}/ffmpeg-core.wasm`, 'application/wasm'),
  ]);
  return { coreURL, wasmURL };
}

async function initializeFfmpeg(): Promise<FFmpeg> {
  const { FFmpeg } = await import('@ffmpeg/ffmpeg');
  const instance = new FFmpeg();

  let urls: { coreURL: string; wasmURL: string };
  try {
    urls = await fetchLocalWasmBlobUrl();
  } catch {
    urls = await fetchCdnCoreUrls();
  }

  await instance.load({
    coreURL: urls.coreURL,
    wasmURL: urls.wasmURL,
  });

  ffmpegInstance = instance;
  return instance;
}

/**
 * Lazily loads the single-threaded FFmpeg WASM engine once on demand.
 * Safe to call repeatedly; shares the in-flight promise and resets on failure.
 */
export function ensureFfmpegLoaded(): Promise<FFmpeg> {
  if (ffmpegInstance?.loaded) {
    return Promise.resolve(ffmpegInstance);
  }
  if (!loadPromise) {
    loadPromise = initializeFfmpeg().catch((err) => {
      loadPromise = null;
      if (cachedWasmBlobUrl) {
        URL.revokeObjectURL(cachedWasmBlobUrl);
        cachedWasmBlobUrl = null;
      }
      throw err;
    });
  }
  return loadPromise;
}

/**
 * Starts loading FFmpeg silently after user file selection so conversion starts quickly.
 */
export function warmupFfmpeg(): void {
  if (typeof window === 'undefined') return;
  void ensureFfmpegLoaded().catch(() => {
    // Errors are surfaced cleanly when the user invokes conversion.
  });
}
