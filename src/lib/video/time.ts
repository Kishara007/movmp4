/**
 * Parses a trim timestamp in MM:SS (or HH:MM:SS / plain seconds) into total seconds.
 * Returns null if the input string is empty/whitespace.
 * Throws Error('INVALID_TRIM') if the input is malformed.
 */
export function parseTimestampToSeconds(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const val = Number(trimmed);
    if (!Number.isFinite(val) || val < 0) throw new Error('INVALID_TRIM');
    return val;
  }

  const parts = trimmed.split(':');
  if (parts.length < 2 || parts.length > 3) {
    throw new Error('INVALID_TRIM');
  }

  const numericParts = parts.map((part, index) => {
    const isLast = index === parts.length - 1;
    const pattern = isLast ? /^\d{1,2}(\.\d+)?$/ : /^\d+$/;
    if (!pattern.test(part)) {
      throw new Error('INVALID_TRIM');
    }
    const num = Number(part);
    if (!Number.isFinite(num) || num < 0 || (index > 0 && num >= 60)) {
      throw new Error('INVALID_TRIM');
    }
    return num;
  });

  if (numericParts.length === 2) {
    return numericParts[0] * 60 + numericParts[1];
  }
  return numericParts[0] * 3600 + numericParts[1] * 60 + numericParts[2];
}

export function validateTrimRange(trimStart: string, trimEnd: string): {
  valid: boolean;
  startSec: number | null;
  endSec: number | null;
} {
  try {
    const startSec = parseTimestampToSeconds(trimStart);
    const endSec = parseTimestampToSeconds(trimEnd);
    if (startSec !== null && endSec !== null && endSec <= startSec) {
      return { valid: false, startSec: null, endSec: null };
    }
    if (startSec === null && endSec !== null && endSec <= 0) {
      return { valid: false, startSec: null, endSec: null };
    }
    return { valid: true, startSec, endSec };
  } catch {
    return { valid: false, startSec: null, endSec: null };
  }
}

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const idx = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, idx);
  return `${value >= 100 || idx === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[idx]}`;
}

export function buildMp4Filename(originalName: string): string {
  const cleaned = originalName.replace(/\.[^/.]+$/, '');
  return `${cleaned || 'converted'}.mp4`;
}
