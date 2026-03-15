'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

type ToastTone = 'success' | 'error';

type ToastItem = {
  id: number;
  tone: ToastTone;
  message: string;
  visible: boolean;
};

type ToastContextValue = {
  success: (message: string, options?: { duration?: number }) => void;
  error: (message: string, options?: { duration?: number }) => void;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextIdRef = useRef(1);
  const timersRef = useRef<
    Record<
      number,
      {
        show?: ReturnType<typeof setTimeout>;
        hide?: ReturnType<typeof setTimeout>;
        remove?: ReturnType<typeof setTimeout>;
      }
    >
  >({});

  const clearTimers = useCallback((id: number) => {
    const timers = timersRef.current[id];
    if (!timers) return;

    if (timers.show) clearTimeout(timers.show);
    if (timers.hide) clearTimeout(timers.hide);
    if (timers.remove) clearTimeout(timers.remove);
    delete timersRef.current[id];
  }, []);

  const dismiss = useCallback(
    (id: number) => {
      const timers = timersRef.current[id];
      if (timers?.show) clearTimeout(timers.show);
      if (timers?.hide) clearTimeout(timers.hide);

      setItems((prev) =>
        prev.map((item) => (item.id === id ? { ...item, visible: false } : item)),
      );

      const removeTimer = setTimeout(() => {
        setItems((prev) => prev.filter((item) => item.id !== id));
        clearTimers(id);
      }, 240);

      timersRef.current[id] = {
        ...timersRef.current[id],
        remove: removeTimer,
      };
    },
    [clearTimers],
  );

  const push = useCallback(
    (tone: ToastTone, message: string, duration = 5000) => {
      const id = nextIdRef.current++;

      setItems((prev) => [{ id, tone, message, visible: false }, ...prev]);

      const showTimer = setTimeout(() => {
        setItems((prev) =>
          prev.map((item) => (item.id === id ? { ...item, visible: true } : item)),
        );
      }, 10);

      const hideTimer = setTimeout(() => {
        dismiss(id);
      }, duration);

      timersRef.current[id] = {
        show: showTimer,
        hide: hideTimer,
      };
    },
    [dismiss],
  );

  useEffect(() => {
    return () => {
      Object.keys(timersRef.current).forEach((key) => {
        clearTimers(Number(key));
      });
    };
  }, [clearTimers]);

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (message, options) => push('success', message, options?.duration ?? 4000),
      error: (message, options) => push('error', message, options?.duration ?? 5000),
      dismiss,
    }),
    [dismiss, push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-4 top-4 z-[120] flex flex-col gap-3 sm:left-auto sm:right-4 sm:w-full sm:max-w-sm">
        {items.map((item) => {
          const toneClasses =
            item.tone === 'success'
              ? 'border-emerald-200 bg-white shadow-[0_18px_45px_-28px_rgba(34,197,94,0.45)]'
              : 'border-red-200 bg-white shadow-[0_18px_45px_-28px_rgba(239,68,68,0.4)]';
          const badgeClasses =
            item.tone === 'success'
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-red-100 text-red-700';
          const label =
            item.tone === 'success'
              ? '\u0423\u0441\u043f\u0435\u0448\u043d\u043e'
              : '\u041e\u0448\u0438\u0431\u043a\u0430';

          return (
            <div
              key={item.id}
              className={`pointer-events-auto rounded-2xl border px-4 py-3 transition-all duration-300 ease-out ${toneClasses} ${item.visible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'}`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`mt-0.5 rounded-full px-2.5 py-1 text-xs font-semibold ${badgeClasses}`}
                >
                  {label}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-5 text-[#111111]">
                    {item.message}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(item.id)}
                  className="rounded-full p-1 text-[#6b6b6b] transition hover:bg-[#f4efeb] hover:text-[#111111]"
                  aria-label="\u0417\u0430\u043a\u0440\u044b\u0442\u044c \u0443\u0432\u0435\u0434\u043e\u043c\u043b\u0435\u043d\u0438\u0435"
                >
                  <span className="block h-5 w-5 text-base leading-5">&times;</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }

  return context;
}
