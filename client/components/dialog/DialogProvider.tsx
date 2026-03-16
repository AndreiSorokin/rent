'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

type DialogTone = 'warning' | 'danger' | 'info';
type DialogKind = 'alert' | 'confirm';

type DialogOptions = {
  title?: string;
  message: string;
  tone?: DialogTone;
  confirmText?: string;
  cancelText?: string;
};

type DialogRequest = DialogOptions & {
  id: number;
  kind: DialogKind;
};

type DialogQueueItem = DialogRequest & {
  resolve: (value: boolean) => void;
};

type DialogContextValue = {
  alert: (options: DialogOptions | string) => Promise<void>;
  confirm: (options: DialogOptions | string) => Promise<boolean>;
};

const DialogContext = createContext<DialogContextValue | null>(null);

const normalizeOptions = (options: DialogOptions | string): DialogOptions =>
  typeof options === 'string' ? { message: options } : options;

const getDefaultTitle = (kind: DialogKind, tone: DialogTone) => {
  if (kind === 'confirm') {
    return tone === 'danger' ? 'Подтвердите действие' : 'Нужно подтверждение';
  }

  if (tone === 'danger') return 'Обратите внимание';
  if (tone === 'warning') return 'Предупреждение';
  return 'Сообщение';
};

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [current, setCurrent] = useState<DialogQueueItem | null>(null);
  const queueRef = useRef<DialogQueueItem[]>([]);
  const currentRef = useRef<DialogQueueItem | null>(null);
  const nextIdRef = useRef(1);

  const showNext = useCallback(() => {
    if (currentRef.current || queueRef.current.length === 0) return;
    const next = queueRef.current.shift() ?? null;
    currentRef.current = next;
    setCurrent(next);
  }, []);

  const openDialog = useCallback(
    (kind: DialogKind, options: DialogOptions | string) =>
      new Promise<boolean>((resolve) => {
        const normalized = normalizeOptions(options);
        const request: DialogQueueItem = {
          id: nextIdRef.current++,
          kind,
          tone: normalized.tone ?? (kind === 'confirm' ? 'warning' : 'info'),
          title: normalized.title,
          message: normalized.message,
          confirmText: normalized.confirmText,
          cancelText: normalized.cancelText,
          resolve,
        };

        queueRef.current.push(request);
        showNext();
      }),
    [showNext],
  );

  const closeCurrent = useCallback(
    (result: boolean) => {
      if (!currentRef.current) return;
      currentRef.current.resolve(result);
      currentRef.current = null;
      setCurrent(null);
      setTimeout(() => {
        showNext();
      }, 10);
    },
    [showNext],
  );

  const value = useMemo<DialogContextValue>(
    () => ({
      alert: async (options) => {
        await openDialog('alert', options);
      },
      confirm: (options) => openDialog('confirm', options),
    }),
    [openDialog],
  );

  const tone = current?.tone ?? 'info';
  const title = current
    ? current.title || getDefaultTitle(current.kind, tone)
    : '';
  const confirmText =
    current?.confirmText || (current?.kind === 'confirm' ? 'Подтвердить' : 'Понятно');
  const cancelText = current?.cancelText || 'Отмена';
  const toneBadgeClass =
    tone === 'danger'
      ? 'bg-red-100 text-red-700'
      : tone === 'warning'
        ? 'bg-amber-100 text-amber-700'
        : 'bg-[#f4efeb] text-[#6b6b6b]';
  const toneButtonClass =
    tone === 'danger'
      ? 'bg-[#ef4444] hover:bg-[#dc2626]'
      : 'bg-[#ff6a13] hover:bg-[#e85a0c]';
  const badgeText =
    tone === 'danger' ? 'Важно' : tone === 'warning' ? 'Подтверждение' : 'Palaci';

  return (
    <DialogContext.Provider value={value}>
      {children}
      {current ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-black/45 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-[28px] border border-[#d8d1cb] bg-white p-6 shadow-[0_30px_90px_-40px_rgba(17,17,17,0.5)]">
            <div className="mb-4 flex items-center gap-3">
              <h3 className="text-lg font-semibold text-[#111111]">{title}</h3>
            </div>

            <p className="text-sm leading-6 text-[#4b4b4b]">{current.message}</p>

            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              {current.kind === 'confirm' ? (
                <button
                  type="button"
                  onClick={() => closeCurrent(false)}
                  className="rounded-xl border border-[#d8d1cb] px-4 py-2.5 font-semibold text-[#111111] transition hover:bg-[#f4efeb]"
                >
                  {cancelText}
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => closeCurrent(true)}
                className={`rounded-xl px-4 py-2.5 font-semibold text-white transition ${toneButtonClass}`}
              >
                {confirmText}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);

  if (!context) {
    throw new Error('useDialog must be used within DialogProvider');
  }

  return context;
}
