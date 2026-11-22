import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Download,
  FileVideo,
  Film,
  Loader2,
  Plus,
  RotateCcw,
  Scissors,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  Upload,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { useI18n } from '../i18n';
import {
  convertMovToMp4,
  formatFileSize,
  validateTrimRange,
  warmupFfmpeg,
  type ConversionOptions,
  type ConversionResult,
  type ConversionStage,
  type ResolutionOption,
} from '../lib/video';

interface QueuedVideo {
  id: string;
  file: File;
  options: ConversionOptions;
  lastConvertedOptions: ConversionOptions | null;
  optionsOpen: boolean;
  stage: ConversionStage;
  errorMessage: string | null;
  result: ConversionResult | null;
}

const DEFAULT_OPTIONS: ConversionOptions = {
  trimStart: '',
  trimEnd: '',
  muteAudio: false,
  resolution: 'original',
};

function isMovFile(file: File): boolean {
  const lower = file.name.toLowerCase();
  return (
    lower.endsWith('.mov') ||
    file.type === 'video/quicktime' ||
    file.type === 'video/x-quicktime'
  );
}

function optionsEqual(a: ConversionOptions, b: ConversionOptions | null): boolean {
  if (!b) return false;
  return (
    a.trimStart.trim() === b.trimStart.trim() &&
    a.trimEnd.trim() === b.trimEnd.trim() &&
    a.muteAudio === b.muteAudio &&
    a.resolution === b.resolution
  );
}

function createQueueItem(file: File): QueuedVideo {
  return {
    id: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 8)}`,
    file,
    options: { ...DEFAULT_OPTIONS },
    lastConvertedOptions: null,
    optionsOpen: false,
    stage: 'loading',
    errorMessage: null,
    result: null,
  };
}

function triggerDownload(url: string, fileName: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

function MovToMp4Visual({ active = false, float = true }: { active?: boolean; float?: boolean }) {
  return (
    <div
      className={`${float ? 'animate-float-smooth ' : ''}inline-flex items-center gap-2.5 sm:gap-3.5 rounded-2xl border px-3.5 py-2.5 sm:px-4 sm:py-3 shadow-sm transition-colors duration-200`}
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: active ? 'var(--accent-mist)' : 'var(--border-main)',
      }}
      aria-hidden="true"
    >
      {/* Source .MOV pill */}
      <div
        className="animate-mov-nudge flex items-center gap-1.5 sm:gap-2 rounded-xl border px-2.5 py-1.5 sm:px-3"
        style={{
          backgroundColor: 'var(--bg-subtle)',
          borderColor: 'var(--border-main)',
        }}
      >
        <Film className="h-5 w-5 sm:h-6 sm:w-6 text-[#967E76] dark:text-[#B7C4CF]" />
        <span className="text-xs sm:text-sm font-extrabold tracking-wider">.MOV</span>
      </div>

      {/* Animated stream conduit */}
      <div className="relative flex w-12 sm:w-16 items-center justify-center overflow-hidden py-1">
        <div
          className="absolute inset-x-1 h-0.5 rounded-full opacity-35"
          style={{ backgroundColor: 'var(--border-main)' }}
        />
        <span
          className={`${
            active ? 'animate-stream-packet-fast' : 'animate-stream-packet'
          } absolute left-0 h-2.5 w-2.5 rounded-full shadow-xs`}
          style={{ backgroundColor: 'var(--action-primary)' }}
        />
        <div className="relative z-10 flex items-center -space-x-1.5 text-[#967E76] dark:text-[#EEE3CB]">
          <ChevronRight className="animate-chevron-1 h-4 w-4" />
          <ChevronRight className="animate-chevron-2 h-4 w-4" />
          <ChevronRight className="animate-chevron-3 h-4 w-4" />
        </div>
      </div>

      {/* Target .MP4 pill with cool slate mist highlight + receive pulse + sheen */}
      <div
        className="animate-mp4-receive relative overflow-hidden flex items-center gap-1.5 sm:gap-2 rounded-xl px-2.5 py-1.5 sm:px-3"
        style={{
          backgroundColor: 'var(--accent-mist)',
          color: '#231F1E',
        }}
      >
        <div className="animate-mp4-sheen pointer-events-none absolute inset-y-0 w-7 bg-white/55" />
        <FileVideo className="relative z-10 h-5 w-5 sm:h-6 sm:w-6" />
        <span className="relative z-10 text-xs sm:text-sm font-extrabold tracking-wider">.MP4</span>
      </div>
    </div>
  );
}

export default function MovToMp4Tool() {
  const { dict } = useI18n();
  const [items, setItems] = useState<QueuedVideo[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [dropWarning, setDropWarning] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<{ id: number; text: string; url: string; fileName: string } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const itemsRef = useRef<QueuedVideo[]>(items);
  itemsRef.current = items;

  const activeUrlsRef = useRef<Set<string>>(new Set());
  const inFlightRef = useRef<Set<string>>(new Set());
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const urls = activeUrlsRef.current;
    return () => {
      for (const url of urls) {
        URL.revokeObjectURL(url);
      }
      urls.clear();
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const showToast = useCallback((text: string, url: string, fileName: string) => {
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    setToastMessage({ id: Date.now(), text, url, fileName });
    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage(null);
      toastTimerRef.current = null;
    }, 5000);
  }, []);

  const registerUrl = (url: string) => {
    activeUrlsRef.current.add(url);
  };

  const revokeItemResult = (item: QueuedVideo | undefined) => {
    if (item?.result?.url) {
      URL.revokeObjectURL(item.result.url);
      activeUrlsRef.current.delete(item.result.url);
    }
  };

  const updateItem = useCallback((id: string, updater: (item: QueuedVideo) => QueuedVideo) => {
    setItems((prev) => prev.map((item) => (item.id === id ? updater(item) : item)));
  }, []);

  const runConversion = useCallback(
    async (
      id: string,
      file: File,
      optionsSnapshot: ConversionOptions,
      showAppliedToast = false,
    ) => {
      if (inFlightRef.current.has(id)) return;

      const trimCheck = validateTrimRange(optionsSnapshot.trimStart, optionsSnapshot.trimEnd);
      if (!trimCheck.valid) {
        updateItem(id, (item) => ({
          ...item,
          stage: 'error',
          errorMessage: dict.converter.invalidTrimError,
          optionsOpen: true,
        }));
        return;
      }

      inFlightRef.current.add(id);

      const previousItem = itemsRef.current.find((item) => item.id === id);
      revokeItemResult(previousItem);

      updateItem(id, (item) => ({
        ...item,
        stage: 'loading',
        errorMessage: null,
        result: null,
      }));

      try {
        const result = await convertMovToMp4(file, optionsSnapshot, {
          onStageChange: (stage) => {
            updateItem(id, (item) => ({ ...item, stage }));
          },
        });

        const stillPresent = itemsRef.current.some((item) => item.id === id);
        if (!stillPresent) {
          URL.revokeObjectURL(result.url);
          return;
        }

        registerUrl(result.url);
        updateItem(id, (item) => ({
          ...item,
          stage: 'done',
          lastConvertedOptions: { ...optionsSnapshot },
          result,
        }));

        if (showAppliedToast) {
          showToast(dict.converter.settingsAppliedToast, result.url, result.fileName);
        }
      } catch (err) {
        const message =
          err instanceof Error && err.message === 'INVALID_TRIM'
            ? dict.converter.invalidTrimError
            : err instanceof Error
              ? err.message
              : dict.converter.statusError;
        updateItem(id, (item) => ({
          ...item,
          stage: 'error',
          errorMessage: message,
        }));
      } finally {
        inFlightRef.current.delete(id);
      }
    },
    [
      dict.converter.invalidTrimError,
      dict.converter.settingsAppliedToast,
      dict.converter.statusError,
      showToast,
      updateItem,
    ],
  );

  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      const incoming = Array.from(fileList);
      if (incoming.length === 0) return;

      const valid = incoming.filter(isMovFile);
      if (valid.length === 0) {
        setDropWarning(dict.converter.invalidFileAlert);
        return;
      }

      if (valid.length < incoming.length) {
        setDropWarning(dict.converter.invalidFileAlert);
      } else {
        setDropWarning(null);
      }

      warmupFfmpeg();

      const newItems = valid.map(createQueueItem);
      setItems((prev) => [...prev, ...newItems]);

      // Instantly convert each newly added MOV file in the browser
      for (const item of newItems) {
        void runConversion(item.id, item.file, item.options);
      }
    },
    [dict.converter.invalidFileAlert, runConversion],
  );

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      addFiles(event.target.files);
      event.target.value = '';
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragging(false);
    if (event.dataTransfer.files) {
      addFiles(event.dataTransfer.files);
    }
  };

  const updateItemOptions = (id: string, patch: Partial<ConversionOptions>) => {
    updateItem(id, (item) => {
      if (item.stage === 'loading' || item.stage === 'remuxing' || item.stage === 'transcoding') {
        return item;
      }
      return {
        ...item,
        options: { ...item.options, ...patch },
        errorMessage: null,
      };
    });
  };

  const toggleOptionsPanel = (id: string) => {
    updateItem(id, (item) => ({ ...item, optionsOpen: !item.optionsOpen }));
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const target = prev.find((item) => item.id === id);
      revokeItemResult(target);
      return prev.filter((item) => item.id !== id);
    });
  };

  const clearQueue = () => {
    for (const item of itemsRef.current) {
      revokeItemResult(item);
    }
    setItems([]);
    setDropWarning(null);
    setToastMessage(null);
  };

  const reconvertItem = (item: QueuedVideo) => {
    void runConversion(item.id, item.file, { ...item.options }, true);
  };

  const downloadAllDone = () => {
    const completed = itemsRef.current.filter((item) => item.stage === 'done' && item.result);
    completed.forEach((item, idx) => {
      if (!item.result) return;
      const { url, fileName } = item.result;
      window.setTimeout(() => {
        triggerDownload(url, fileName);
      }, idx * 180);
    });
  };

  const anyProcessing = items.some(
    (item) => item.stage === 'loading' || item.stage === 'remuxing' || item.stage === 'transcoding',
  );
  const completedCount = items.filter((item) => item.stage === 'done' && item.result).length;
  const singleItem = items.length === 1 ? items[0] : null;
  const singleItemBusy =
    singleItem !== null &&
    (singleItem.stage === 'loading' ||
      singleItem.stage === 'remuxing' ||
      singleItem.stage === 'transcoding');

  const renderSettingsControls = (item: QueuedVideo, alwaysShowButton: boolean) => {
    const isBusy =
      item.stage === 'loading' || item.stage === 'remuxing' || item.stage === 'transcoding';
    const trimValidation = validateTrimRange(item.options.trimStart, item.options.trimEnd);
    const hasPendingEdits = !optionsEqual(item.options, item.lastConvertedOptions);

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 1. Trim Clip */}
          <div
            className="rounded-2xl border p-4 space-y-2.5"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-main)',
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide">
                <Scissors className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{dict.converter.trimSectionLabel}</span>
              </div>
              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {dict.converter.trimHelper}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <label className="block">
                <span className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                  {dict.converter.trimStartLabel}
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder={dict.converter.trimPlaceholder}
                  disabled={isBusy}
                  value={item.options.trimStart}
                  onChange={(e) => updateItemOptions(item.id, { trimStart: e.target.value })}
                  className="w-full min-h-[42px] rounded-xl border px-3 py-1.5 text-sm font-medium outline-none"
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    borderColor: trimValidation.valid ? 'var(--border-main)' : '#B91C1C',
                    color: 'var(--text-primary)',
                  }}
                />
              </label>
              <label className="block">
                <span className="block text-xs font-medium mb-1" style={{ color: 'var(--text-muted)' }}>
                  {dict.converter.trimEndLabel}
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder={dict.converter.trimPlaceholder}
                  disabled={isBusy}
                  value={item.options.trimEnd}
                  onChange={(e) => updateItemOptions(item.id, { trimEnd: e.target.value })}
                  className="w-full min-h-[42px] rounded-xl border px-3 py-1.5 text-sm font-medium outline-none"
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    borderColor: trimValidation.valid ? 'var(--border-main)' : '#B91C1C',
                    color: 'var(--text-primary)',
                  }}
                />
              </label>
            </div>
            {!trimValidation.valid && (
              <p className="text-xs font-medium text-red-700 dark:text-red-400">
                {dict.converter.invalidTrimError}
              </p>
            )}
          </div>

          {/* 2. Mute Audio */}
          <div
            className="rounded-2xl border p-4 space-y-2.5"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-main)',
            }}
          >
            <span className="block text-xs font-bold uppercase tracking-wide">
              {dict.converter.muteAudioLabel}
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={item.options.muteAudio}
              disabled={isBusy}
              onClick={() => updateItemOptions(item.id, { muteAudio: !item.options.muteAudio })}
              className="flex w-full min-h-[48px] items-center justify-between gap-3 rounded-xl border px-3.5 py-2 text-left transition-colors cursor-pointer disabled:opacity-60"
              style={{
                backgroundColor: item.options.muteAudio ? 'var(--accent-mist)' : 'var(--bg-subtle)',
                borderColor: 'var(--border-main)',
                color: item.options.muteAudio ? '#231F1E' : 'var(--text-primary)',
              }}
            >
              <div className="flex items-center gap-2.5">
                {item.options.muteAudio ? (
                  <VolumeX className="h-4 w-4 shrink-0" aria-hidden="true" />
                ) : (
                  <Volume2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                )}
                <span className="text-sm font-semibold leading-tight">
                  {item.options.muteAudio ? dict.converter.audioMuted : dict.converter.audioKeep}
                </span>
              </div>
              <span
                className={`inline-flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                  item.options.muteAudio ? 'bg-[#231F1E]' : 'bg-[#D7C0AE] dark:bg-[#1E2226]'
                }`}
              >
                <span
                  className={`h-5 w-5 rounded-full bg-white transition-transform ${
                    item.options.muteAudio ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </span>
            </button>
          </div>

          {/* 3. Resolution / Quality */}
          <div
            className="rounded-2xl border p-4 space-y-2.5"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--border-main)',
            }}
          >
            <label className="block">
              <span className="block text-xs font-bold uppercase tracking-wide mb-2.5">
                {dict.converter.resolutionLabel}
              </span>
              <select
                disabled={isBusy}
                value={item.options.resolution}
                onChange={(e) =>
                  updateItemOptions(item.id, {
                    resolution: e.target.value as ResolutionOption,
                  })
                }
                className="w-full min-h-[48px] rounded-xl border px-3 py-2 text-sm font-semibold outline-none cursor-pointer disabled:opacity-60"
                style={{
                  backgroundColor: 'var(--bg-subtle)',
                  borderColor: 'var(--border-main)',
                  color: 'var(--text-primary)',
                }}
              >
                <option value="original">{dict.converter.resOriginal}</option>
                <option value="1080p">{dict.converter.res1080}</option>
                <option value="720p">{dict.converter.res720}</option>
                <option value="480p">{dict.converter.res480}</option>
              </select>
            </label>
          </div>
        </div>

        {(alwaysShowButton || hasPendingEdits) && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
            <p className="text-xs sm:text-sm font-medium" style={{ color: 'var(--text-muted)' }}>
              {hasPendingEdits ? dict.converter.settingsChangedHint : dict.converter.moreSettingsSubtitle}
            </p>
            <button
              type="button"
              onClick={() => reconvertItem(item)}
              disabled={isBusy || !trimValidation.valid}
              className="inline-flex min-h-[48px] shrink-0 items-center justify-center gap-2 rounded-2xl px-6 py-2.5 text-sm sm:text-base font-bold shadow-sm transition-all hover:opacity-90 disabled:opacity-55 cursor-pointer"
              style={{
                backgroundColor: hasPendingEdits ? 'var(--action-primary)' : 'var(--bg-card)',
                borderWidth: hasPendingEdits ? '0px' : '1px',
                borderColor: 'var(--border-main)',
                color: hasPendingEdits ? 'var(--action-primary-text)' : 'var(--text-primary)',
              }}
            >
              {isBusy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Zap className="h-4 w-4" aria-hidden="true" />
              )}
              <span>{dict.converter.convertWithSettings}</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      className="w-full rounded-3xl border shadow-lg transition-colors duration-200"
      style={{
        backgroundColor: 'var(--bg-card)',
        borderColor: 'var(--border-main)',
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".mov,video/quicktime"
        multiple
        onChange={handleFileInputChange}
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
      />

      {dropWarning && (
        <div
          role="alert"
          className="mx-4 mt-4 sm:mx-6 sm:mt-6 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-medium"
          style={{
            backgroundColor: 'var(--bg-subtle)',
            borderColor: 'var(--accent-taupe)',
            color: 'var(--text-primary)',
          }}
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="h-5 w-5 shrink-0 text-[#967E76] dark:text-[#B7C4CF]" aria-hidden="true" />
            <span>{dropWarning}</span>
          </div>
          <button
            type="button"
            onClick={() => setDropWarning(null)}
            className="text-xs font-semibold underline cursor-pointer px-2 py-1"
          >
            OK
          </button>
        </div>
      )}

      {/* SCREEN 1: EMPTY DROPZONE */}
      {items.length === 0 ? (
        <div
          onDragEnter={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            setIsDragging(false);
          }}
          onDrop={handleDrop}
          className={`m-3 sm:m-5 rounded-2xl border-2 border-dashed px-5 py-10 sm:px-10 sm:py-14 text-center transition-all duration-200 ${
            isDragging ? 'scale-[1.01]' : ''
          }`}
          style={{
            backgroundColor: isDragging ? 'var(--bg-dropzone-active)' : 'var(--bg-dropzone)',
            borderColor: isDragging ? 'var(--accent-mist)' : 'var(--border-main)',
          }}
        >
          <div className="mb-6 flex items-center justify-center">
            <MovToMp4Visual active={isDragging} float />
          </div>

          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            {dict.converter.dropzoneTitle}
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm sm:text-base" style={{ color: 'var(--text-muted)' }}>
            {dict.converter.dropzoneSubtitle}
          </p>

          <div className="mt-7 flex flex-col items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex min-h-[54px] items-center justify-center gap-3 rounded-2xl px-8 py-3.5 text-base sm:text-lg font-bold shadow-md transition-all hover:opacity-92 active:scale-[0.99] cursor-pointer"
              style={{
                backgroundColor: 'var(--action-primary)',
                color: 'var(--action-primary-text)',
              }}
            >
              <Upload className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
              <span>{dict.converter.selectFiles}</span>
            </button>
          </div>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5 text-xs sm:text-sm font-medium">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5"
              style={{
                backgroundColor: 'var(--bg-card)',
                borderColor: 'var(--border-main)',
                color: 'var(--text-primary)',
              }}
            >
              <ShieldCheck className="h-4 w-4 text-[#967E76] dark:text-[#B7C4CF]" aria-hidden="true" />
              <span>{dict.converter.privacyBadge}</span>
            </span>
          </div>
        </div>
      ) : singleItem && singleItemBusy ? (
        /* SCREEN 1.5: INSTANT AUTO-CONVERSION ANIMATION (Single File) */
        <div className="px-6 py-12 sm:px-10 sm:py-16 text-center space-y-5">
          <div className="flex items-center justify-center">
            <MovToMp4Visual active float={false} />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              {dict.converter.makingMp4}
            </h2>
            <p className="text-sm sm:text-base font-medium" style={{ color: 'var(--text-muted)' }}>
              {singleItem.file.name} • {formatFileSize(singleItem.file.size)}
            </p>
          </div>

          <p className="text-xs sm:text-sm" style={{ color: 'var(--text-muted)' }}>
            {dict.converter.makingMp4Hint}
          </p>
        </div>
      ) : singleItem ? (
        /* SCREEN 2: MP4 READY + CLEAR MORE SETTINGS (Single File) */
        <div
          className="p-4 sm:p-6 space-y-6"
          onDragEnter={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            setIsDragging(false);
          }}
          onDrop={handleDrop}
        >
          {/* Ready / Error Banner */}
          {singleItem.stage === 'done' && singleItem.result ? (
            <div
              className="rounded-2xl border p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-5"
              style={{
                backgroundColor: 'var(--bg-subtle)',
                borderColor: 'var(--border-main)',
              }}
            >
              <div className="flex items-start gap-4 min-w-0">
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderColor: 'var(--border-main)',
                  }}
                >
                  <CheckCircle2
                    className="animate-check-pop h-7 w-7 text-emerald-700 dark:text-emerald-400"
                    aria-hidden="true"
                  />
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight">
                      {dict.converter.readyTitle}
                    </h2>
                    <span
                      className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold"
                      style={{
                        backgroundColor: 'var(--accent-mist)',
                        color: '#231F1E',
                      }}
                    >
                      {singleItem.result.mode === 'remux'
                        ? dict.converter.modeRemuxBadge
                        : dict.converter.modeTranscodeBadge}
                    </span>
                  </div>
                  <p className="truncate text-sm sm:text-base font-semibold">
                    {singleItem.result.fileName}{' '}
                    <span className="font-normal" style={{ color: 'var(--text-muted)' }}>
                      ({formatFileSize(singleItem.result.sizeBytes)})
                    </span>
                  </p>
                  <p className="text-xs sm:text-sm" style={{ color: 'var(--text-muted)' }}>
                    {singleItem.result.mode === 'remux'
                      ? dict.converter.readyHintRemux
                      : dict.converter.readyHintTranscode}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <a
                  href={singleItem.result.url}
                  download={singleItem.result.fileName}
                  className="inline-flex min-h-[52px] items-center justify-center gap-2.5 rounded-2xl px-6 py-3 text-base font-bold shadow-md transition-opacity hover:opacity-90"
                  style={{
                    backgroundColor: 'var(--action-primary)',
                    color: 'var(--action-primary-text)',
                  }}
                >
                  <Download className="h-5 w-5" aria-hidden="true" />
                  <span>{dict.converter.downloadOne}</span>
                </a>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition-opacity hover:opacity-85 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderColor: 'var(--border-main)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>{dict.converter.addMoreFiles}</span>
                </button>

                <button
                  type="button"
                  onClick={clearQueue}
                  aria-label={dict.converter.convertAnother}
                  className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold transition-opacity hover:opacity-85 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderColor: 'var(--border-main)',
                    color: 'var(--text-muted)',
                  }}
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  <span>{dict.converter.convertAnother}</span>
                </button>
              </div>
            </div>
          ) : (
            <div
              role="alert"
              className="rounded-2xl border p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              style={{
                backgroundColor: 'var(--bg-subtle)',
                borderColor: 'var(--border-main)',
              }}
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="h-6 w-6 shrink-0 text-red-700 dark:text-red-400" aria-hidden="true" />
                <div>
                  <p className="font-bold">{singleItem.file.name}</p>
                  <p className="text-sm text-red-700 dark:text-red-400">
                    {singleItem.errorMessage || dict.converter.statusError}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => reconvertItem(singleItem)}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold cursor-pointer"
                  style={{
                    backgroundColor: 'var(--action-primary)',
                    color: 'var(--action-primary-text)',
                  }}
                >
                  <RotateCcw className="h-4 w-4" aria-hidden="true" />
                  <span>{dict.converter.retryButton}</span>
                </button>
                <button
                  type="button"
                  onClick={clearQueue}
                  className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-4 py-2 text-sm font-semibold cursor-pointer"
                  style={{
                    backgroundColor: 'var(--bg-card)',
                    borderColor: 'var(--border-main)',
                    color: 'var(--text-primary)',
                  }}
                >
                  <span>{dict.converter.convertAnother}</span>
                </button>
              </div>
            </div>
          )}

          {/* Second Screen: Collapsible More Settings Section (Trim, Mute Audio, Quality + Convert MP4) */}
          <section
            aria-label={dict.converter.moreSettingsTitle}
            className="rounded-2xl border transition-colors"
            style={{
              backgroundColor: 'var(--bg-subtle)',
              borderColor: 'var(--border-main)',
            }}
          >
            <button
              type="button"
              onClick={() => toggleOptionsPanel(singleItem.id)}
              aria-expanded={singleItem.optionsOpen}
              className="flex w-full min-h-[56px] items-center justify-between gap-3 px-4 py-3.5 sm:px-5 text-left transition-opacity hover:opacity-85 cursor-pointer"
            >
              <div className="flex flex-wrap items-center gap-2.5">
                <SlidersHorizontal className="h-5 w-5 text-[#967E76] dark:text-[#B7C4CF]" aria-hidden="true" />
                <span className="text-base sm:text-lg font-bold">{dict.converter.moreSettingsTitle}</span>
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold"
                  style={{
                    backgroundColor: 'var(--accent-mist)',
                    color: '#231F1E',
                  }}
                >
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  <span>{dict.converter.moreSettingsOptional}</span>
                </span>
              </div>

              <span
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border"
                style={{
                  backgroundColor: 'var(--bg-card)',
                  borderColor: 'var(--border-main)',
                  color: 'var(--text-primary)',
                }}
              >
                <ChevronDown
                  className={`h-5 w-5 transition-transform duration-200 ${
                    singleItem.optionsOpen ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                />
              </span>
            </button>

            {singleItem.optionsOpen && (
              <div
                className="px-4 pb-4 pt-3 sm:px-5 sm:pb-5 border-t"
                style={{ borderColor: 'var(--border-main)' }}
              >
                {renderSettingsControls(singleItem, true)}
              </div>
            )}
          </section>
        </div>
      ) : (
        /* BATCH MODE (2+ Files): Auto-converting queue + per-item settings */
        <div
          className="p-4 sm:p-6 space-y-5"
          onDragEnter={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            if (e.currentTarget.contains(e.relatedTarget as Node)) return;
            setIsDragging(false);
          }}
          onDrop={handleDrop}
        >
          <div
            className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b"
            style={{ borderColor: 'var(--border-main)' }}
          >
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-base sm:text-lg font-bold">
                {dict.converter.batchProgress
                  .replace('{done}', String(completedCount))
                  .replace('{total}', String(items.length))}
              </span>
              <span
                className="inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium"
                style={{
                  backgroundColor: 'var(--bg-subtle)',
                  borderColor: 'var(--border-main)',
                  color: 'var(--text-muted)',
                }}
              >
                <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
                <span>{dict.converter.privacyBadge}</span>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={anyProcessing}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-opacity hover:opacity-85 disabled:opacity-50 cursor-pointer"
                style={{
                  borderColor: 'var(--border-main)',
                  backgroundColor: 'var(--bg-subtle)',
                  color: 'var(--text-primary)',
                }}
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                <span>{dict.converter.addMoreFiles}</span>
              </button>

              {completedCount > 1 && (
                <button
                  type="button"
                  onClick={downloadAllDone}
                  className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold shadow-sm transition-opacity hover:opacity-90 cursor-pointer"
                  style={{
                    backgroundColor: 'var(--action-primary)',
                    color: 'var(--action-primary-text)',
                  }}
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  <span>{dict.converter.downloadAll}</span>
                </button>
              )}

              <button
                type="button"
                onClick={clearQueue}
                disabled={anyProcessing}
                className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50 cursor-pointer"
                style={{
                  borderColor: 'var(--border-main)',
                  color: 'var(--text-muted)',
                }}
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                <span>{dict.converter.clearAll}</span>
              </button>
            </div>
          </div>

          <div className="space-y-3.5">
            {items.map((item) => {
              const isBusy =
                item.stage === 'loading' ||
                item.stage === 'remuxing' ||
                item.stage === 'transcoding';

              let statusLabel = dict.converter.makingMp4;
              if (item.stage === 'done') {
                statusLabel =
                  item.result?.mode === 'remux'
                    ? dict.converter.statusDoneRemux
                    : dict.converter.statusDoneTranscode;
              } else if (item.stage === 'error') {
                statusLabel = item.errorMessage || dict.converter.statusError;
              }

              return (
                <div
                  key={item.id}
                  className="rounded-2xl border p-4 sm:p-5 transition-all"
                  style={{
                    backgroundColor: 'var(--bg-subtle)',
                    borderColor: 'var(--border-main)',
                  }}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5 min-w-0">
                      <div
                        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
                        style={{
                          backgroundColor: 'var(--bg-card)',
                          borderColor: 'var(--border-main)',
                        }}
                      >
                        {item.stage === 'done' ? (
                          <CheckCircle2
                            className="animate-check-pop h-6 w-6 text-emerald-700 dark:text-emerald-400"
                            aria-hidden="true"
                          />
                        ) : isBusy ? (
                          <Loader2
                            className="h-6 w-6 animate-spin text-[#967E76] dark:text-[#B7C4CF]"
                            aria-hidden="true"
                          />
                        ) : item.stage === 'error' ? (
                          <AlertCircle className="h-6 w-6 text-red-700 dark:text-red-400" aria-hidden="true" />
                        ) : (
                          <Film className="h-6 w-6 text-[#967E76] dark:text-[#B7C4CF]" aria-hidden="true" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-bold">{item.file.name}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs sm:text-sm">
                          <span className="font-semibold" style={{ color: 'var(--text-muted)' }}>
                            {formatFileSize(item.file.size)}
                          </span>
                          <span aria-hidden="true" style={{ color: 'var(--text-muted)' }}>
                            •
                          </span>
                          <span
                            className={
                              item.stage === 'error' ? 'font-semibold text-red-700 dark:text-red-400' : ''
                            }
                            style={item.stage === 'error' ? undefined : { color: 'var(--text-muted)' }}
                          >
                            {statusLabel}
                          </span>
                          {item.stage === 'done' && item.result && (
                            <>
                              <span
                                className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold"
                                style={{
                                  backgroundColor: 'var(--accent-mist)',
                                  color: '#231F1E',
                                }}
                              >
                                {item.result.mode === 'remux'
                                  ? dict.converter.modeRemuxBadge
                                  : dict.converter.modeTranscodeBadge}
                              </span>
                              <span className="font-semibold">
                                {dict.converter.outputSizeLabel}: {formatFileSize(item.result.sizeBytes)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                      <button
                        type="button"
                        onClick={() => toggleOptionsPanel(item.id)}
                        disabled={isBusy}
                        aria-expanded={item.optionsOpen}
                        className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border px-3 py-2 text-xs sm:text-sm font-semibold transition-opacity hover:opacity-85 disabled:opacity-50 cursor-pointer"
                        style={{
                          backgroundColor: 'var(--bg-card)',
                          borderColor: 'var(--border-main)',
                          color: 'var(--text-primary)',
                        }}
                      >
                        <SlidersHorizontal className="h-4 w-4" aria-hidden="true" />
                        <span>{dict.converter.moreSettingsTitle}</span>
                        <ChevronDown
                          className={`h-4 w-4 transition-transform duration-200 ${
                            item.optionsOpen ? 'rotate-180' : ''
                          }`}
                          aria-hidden="true"
                        />
                      </button>

                      {item.stage === 'done' && item.result ? (
                        <a
                          href={item.result.url}
                          download={item.result.fileName}
                          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold shadow-sm transition-opacity hover:opacity-90"
                          style={{
                            backgroundColor: 'var(--action-primary)',
                            color: 'var(--action-primary-text)',
                          }}
                        >
                          <Download className="h-4 w-4" aria-hidden="true" />
                          <span>{dict.converter.downloadOne}</span>
                        </a>
                      ) : item.stage === 'error' ? (
                        <button
                          type="button"
                          onClick={() => reconvertItem(item)}
                          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold shadow-sm transition-opacity hover:opacity-90 cursor-pointer"
                          style={{
                            backgroundColor: 'var(--action-primary)',
                            color: 'var(--action-primary-text)',
                          }}
                        >
                          <RotateCcw className="h-4 w-4" aria-hidden="true" />
                          <span>{dict.converter.retryButton}</span>
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => removeItem(item.id)}
                        disabled={isBusy}
                        aria-label={dict.converter.removeFile}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-xl border transition-opacity hover:opacity-80 disabled:opacity-40 cursor-pointer"
                        style={{
                          backgroundColor: 'var(--bg-card)',
                          borderColor: 'var(--border-main)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  {item.optionsOpen && (
                    <div className="mt-4 pt-4 border-t" style={{ borderColor: 'var(--border-main)' }}>
                      {renderSettingsControls(item, true)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Toast confirmation after applying More Settings conversion */}
      {toastMessage && (
        <div
          key={toastMessage.id}
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 left-4 sm:left-auto sm:max-w-md z-50 animate-check-pop"
        >
          <div
            className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 shadow-xl"
            style={{
              backgroundColor: 'var(--bg-card)',
              borderColor: 'var(--accent-taupe)',
              color: 'var(--text-primary)',
            }}
          >
            <div className="flex items-center gap-3 min-w-0">
              <CheckCircle2
                className="h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-400"
                aria-hidden="true"
              />
              <p className="text-sm font-bold leading-snug">{toastMessage.text}</p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <a
                href={toastMessage.url}
                download={toastMessage.fileName}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold transition-opacity hover:opacity-90"
                style={{
                  backgroundColor: 'var(--action-primary)',
                  color: 'var(--action-primary-text)',
                }}
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>MP4</span>
              </a>
              <button
                type="button"
                onClick={() => setToastMessage(null)}
                aria-label={dict.supportModal.closeAria}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-opacity hover:opacity-80 cursor-pointer"
                style={{
                  backgroundColor: 'var(--bg-subtle)',
                  borderColor: 'var(--border-main)',
                  color: 'var(--text-muted)',
                }}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
