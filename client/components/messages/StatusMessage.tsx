import { useEffect, useRef, useState, type ReactNode } from 'react';

type StatusMessageProps = {
  tone: 'error' | 'success';
  children: ReactNode;
  className?: string;
  onClose?: () => void;
  autoHideMs?: number;
};

export function StatusMessage({
  tone,
  children,
  className = '',
  onClose,
  autoHideMs = 5000,
}: StatusMessageProps) {
  const [visible, setVisible] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const enterTimer = window.setTimeout(() => {
      setVisible(true);
      wrapperRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }, 20);

    if (!onClose) {
      return () => window.clearTimeout(enterTimer);
    }

    const exitTimer = window.setTimeout(() => {
      setVisible(false);
      window.setTimeout(() => {
        onClose();
      }, 250);
    }, autoHideMs);

    return () => {
      window.clearTimeout(enterTimer);
      window.clearTimeout(exitTimer);
    };
  }, [autoHideMs, onClose]);

  const styles =
    tone === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : 'border-red-200 bg-red-50 text-red-700';

  return (
    <div
      ref={wrapperRef}
      className={`rounded-xl border px-3 py-2 text-sm transition-all duration-300 ease-out ${styles} ${visible ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'} ${className}`.trim()}
    >
      {children}
    </div>
  );
}

type MessageProps = {
  children: ReactNode;
  className?: string;
  onClose?: () => void;
  autoHideMs?: number;
};

export function SuccessMessage({ children, className, onClose, autoHideMs }: MessageProps) {
  return (
    <StatusMessage
      tone="success"
      className={className}
      onClose={onClose}
      autoHideMs={autoHideMs}
    >
      {children}
    </StatusMessage>
  );
}

export function ErrorMessage({ children, className, onClose, autoHideMs }: MessageProps) {
  return (
    <StatusMessage
      tone="error"
      className={className}
      onClose={onClose}
      autoHideMs={autoHideMs}
    >
      {children}
    </StatusMessage>
  );
}
