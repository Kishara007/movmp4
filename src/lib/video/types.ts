export type ResolutionOption = 'original' | '1080p' | '720p' | '480p';

export type ConversionMode = 'remux' | 'transcode';

export type ConversionStage =
  | 'idle'
  | 'loading'
  | 'remuxing'
  | 'transcoding'
  | 'done'
  | 'error';

export interface ConversionOptions {
  trimStart: string;
  trimEnd: string;
  muteAudio: boolean;
  resolution: ResolutionOption;
}

export interface ConversionResult {
  blob: Blob;
  url: string;
  fileName: string;
  sizeBytes: number;
  mode: ConversionMode;
  durationMs: number;
}

export interface ConversionCallbacks {
  onStageChange?: (stage: Exclude<ConversionStage, 'idle' | 'done' | 'error'>) => void;
  onProgress?: (percent: number) => void;
}
