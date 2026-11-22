import type { FFFSType } from '@ffmpeg/ffmpeg';
import { ensureFfmpegLoaded } from './ffmpeg-loader';
import { buildMp4Filename, validateTrimRange } from './time';
import type {
  ConversionCallbacks,
  ConversionMode,
  ConversionOptions,
  ConversionResult,
  ResolutionOption,
} from './types';

let jobQueue: Promise<unknown> = Promise.resolve();

function runExclusive<T>(task: () => Promise<T>): Promise<T> {
  const next = jobQueue.then(task, task);
  jobQueue = next.catch(() => undefined);
  return next;
}

function getScaleFilter(resolution: ResolutionOption): string {
  if (resolution === 'original') {
    return 'scale=trunc(iw/2)*2:trunc(ih/2)*2';
  }
  const target = resolution === '1080p' ? 1080 : resolution === '720p' ? 720 : 480;
  return `scale='if(gt(iw,ih),-2,trunc(min(${target},iw)/2)*2)':'if(gt(iw,ih),trunc(min(${target},ih)/2)*2,-2)'`;
}

function parseLogDurationSeconds(logs: string[]): number | null {
  for (const line of logs) {
    const match = /Duration:\s*(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)/.exec(line);
    if (match) {
      const hours = Number(match[1]);
      const minutes = Number(match[2]);
      const seconds = Number(match[3]);
      const total = hours * 3600 + minutes * 60 + seconds;
      if (Number.isFinite(total) && total > 0) return total;
    }
  }
  return null;
}

function isVideoStreamMp4Remuxable(logs: string[]): boolean {
  const combined = logs.join('\n');
  return /Video:\s*(h264|hevc|h265)\b/i.test(combined);
}

function normalizeJobPathName(index: number): string {
  return `job_${Date.now()}_${index}`;
}

let jobCounter = 0;

export function convertMovToMp4(
  file: File,
  options: ConversionOptions,
  callbacks: ConversionCallbacks = {},
): Promise<ConversionResult> {
  return runExclusive(async () => {
    const startedAt = performance.now();
    const trim = validateTrimRange(options.trimStart, options.trimEnd);
    if (!trim.valid) {
      throw new Error('INVALID_TRIM');
    }

    callbacks.onStageChange?.('loading');
    callbacks.onProgress?.(0);

    const ffmpeg = await ensureFfmpegLoaded();

    jobCounter += 1;
    const jobId = normalizeJobPathName(jobCounter);
    const mountDir = `/in_${jobId}`;
    const fallbackInput = `/raw_${jobId}.mov`;
    const outputPath = `/out_${jobId}.mp4`;

    let mountedWorkerFs = false;
    let wroteFallbackFile = false;
    let inputPath = '';

    const logs: string[] = [];
    let detectedDurationSec: number | null = null;
    const targetTrimDurationSec =
      trim.endSec !== null
        ? trim.endSec - (trim.startSec ?? 0)
        : null;

    const handleLog = ({ message }: { type: string; message: string }) => {
      logs.push(message);
      if (detectedDurationSec === null) {
        const parsed = parseLogDurationSeconds([message]);
        if (parsed !== null) detectedDurationSec = parsed;
      }
    };

    const handleProgress = ({ progress, time }: { progress: number; time: number }) => {
      let pct = 0;
      const expectedSec =
        targetTrimDurationSec ??
        (detectedDurationSec !== null && trim.startSec !== null
          ? Math.max(0.1, detectedDurationSec - trim.startSec)
          : detectedDurationSec);

      if (expectedSec && expectedSec > 0 && Number.isFinite(time) && time > 0) {
        pct = Math.round(((time / 1_000_000) / expectedSec) * 100);
      } else if (Number.isFinite(progress) && progress > 0) {
        pct = Math.round(progress * 100);
      }

      callbacks.onProgress?.(Math.max(0, Math.min(99, pct)));
    };

    ffmpeg.on('log', handleLog);
    ffmpeg.on('progress', handleProgress);

    try {
      try {
        await ffmpeg.createDir(mountDir);
        await ffmpeg.mount('WORKERFS' as FFFSType, { blobs: [{ name: 'input.mov', data: file }] }, mountDir);
        mountedWorkerFs = true;
        inputPath = `${mountDir}/input.mov`;
      } catch {
        const buffer = new Uint8Array(await file.arrayBuffer());
        await ffmpeg.writeFile(fallbackInput, buffer);
        wroteFallbackFile = true;
        inputPath = fallbackInput;
      }

      const canAttemptRemux =
        options.resolution === 'original' && trim.startSec === null && trim.endSec === null;

      let completedMode: ConversionMode = 'transcode';
      let succeeded = false;

      if (canAttemptRemux) {
        callbacks.onStageChange?.('remuxing');
        const remuxArgs = options.muteAudio
          ? [
              '-i',
              inputPath,
              '-map',
              '0:v:0',
              '-an',
              '-c:v',
              'copy',
              '-dn',
              '-sn',
              '-movflags',
              '+faststart',
              outputPath,
            ]
          : [
              '-i',
              inputPath,
              '-map',
              '0:v:0',
              '-map',
              '0:a:0?',
              '-c',
              'copy',
              '-dn',
              '-sn',
              '-movflags',
              '+faststart',
              outputPath,
            ];

        const exitCode = await ffmpeg.exec(remuxArgs);
        if (exitCode === 0) {
          succeeded = true;
          completedMode = 'remux';
        } else {
          await ffmpeg.deleteFile(outputPath).catch(() => undefined);

          // Hybrid remux: copy H.264/HEVC video losslessly and transcode only incompatible PCM audio to AAC
          if (!options.muteAudio && isVideoStreamMp4Remuxable(logs)) {
            const hybridArgs = [
              '-i',
              inputPath,
              '-map',
              '0:v:0',
              '-map',
              '0:a:0?',
              '-c:v',
              'copy',
              '-c:a',
              'aac',
              '-b:a',
              '192k',
              '-ac',
              '2',
              '-dn',
              '-sn',
              '-movflags',
              '+faststart',
              outputPath,
            ];
            const hybridCode = await ffmpeg.exec(hybridArgs);
            if (hybridCode === 0) {
              succeeded = true;
              completedMode = 'remux';
            } else {
              await ffmpeg.deleteFile(outputPath).catch(() => undefined);
            }
          }
        }
      }

      if (!succeeded) {
        callbacks.onStageChange?.('transcoding');
        callbacks.onProgress?.(0);

        const transcodeArgs: string[] = [];
        if (trim.startSec !== null) {
          transcodeArgs.push('-ss', String(trim.startSec));
        }
        transcodeArgs.push('-i', inputPath);
        if (targetTrimDurationSec !== null) {
          transcodeArgs.push('-t', String(targetTrimDurationSec));
        }
        transcodeArgs.push('-map', '0:v:0');
        if (options.muteAudio) {
          transcodeArgs.push('-an');
        } else {
          transcodeArgs.push('-map', '0:a:0?', '-c:a', 'aac', '-b:a', '192k', '-ac', '2');
        }
        transcodeArgs.push(
          '-vf',
          getScaleFilter(options.resolution),
          '-c:v',
          'libx264',
          '-preset',
          'ultrafast',
          '-crf',
          '23',
          '-pix_fmt',
          'yuv420p',
          '-dn',
          '-sn',
          '-movflags',
          '+faststart',
          outputPath,
        );

        const exitCode = await ffmpeg.exec(transcodeArgs);
        if (exitCode !== 0) {
          const tail = logs.slice(-6).join(' ').trim();
          throw new Error(tail || `FFmpeg exited with code ${exitCode}`);
        }
        completedMode = 'transcode';
      }

      const rawOutput = await ffmpeg.readFile(outputPath);
      if (!(rawOutput instanceof Uint8Array) || rawOutput.byteLength === 0) {
        throw new Error('Generated MP4 output was empty.');
      }

      const safeBytes = new Uint8Array(rawOutput.byteLength);
      safeBytes.set(rawOutput);
      const blob = new Blob([safeBytes.buffer], { type: 'video/mp4' });
      const url = URL.createObjectURL(blob);

      callbacks.onProgress?.(100);

      return {
        blob,
        url,
        fileName: buildMp4Filename(file.name),
        sizeBytes: blob.size,
        mode: completedMode,
        durationMs: Math.round(performance.now() - startedAt),
      };
    } finally {
      ffmpeg.off('log', handleLog);
      ffmpeg.off('progress', handleProgress);
      await ffmpeg.deleteFile(outputPath).catch(() => undefined);
      if (wroteFallbackFile) {
        await ffmpeg.deleteFile(fallbackInput).catch(() => undefined);
      }
      if (mountedWorkerFs) {
        await ffmpeg.unmount(mountDir).catch(() => undefined);
        await ffmpeg.deleteDir(mountDir).catch(() => undefined);
      }
    }
  });
}
