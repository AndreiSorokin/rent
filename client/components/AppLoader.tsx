'use client';

type AppLoaderProps = {
  label?: string;
  fullScreen?: boolean;
};

export function AppLoader({
  label = 'Загружаем данные...',
  fullScreen = true,
}: AppLoaderProps) {
  const shellClass = fullScreen
    ? 'flex min-h-screen w-full items-center justify-center bg-[#f6f1eb] px-6 py-12'
    : 'flex items-center justify-center bg-[#f6f1eb] px-4 py-6';

  return (
    <div className={shellClass}>
      <div className="flex flex-col items-center justify-center gap-4 text-center">
        <div className="relative h-12 w-12">
          <div className="absolute inset-0 rounded-full border-2 border-[#e8d8cc]" />
          <div className="absolute inset-0 animate-spin rounded-full border-2 border-transparent border-t-[#ff6a13] border-r-[#f59e0b]" />
          <div className="absolute inset-[11px] rounded-full bg-[#ff6a13]/12" />
        </div>

        <div className="space-y-1">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[#9a6a4d]">
            Palaci
          </p>
          <p className="text-sm font-medium text-[#3f3a37]">{label}</p>
        </div>
      </div>
    </div>
  );
}

export function FullScreenLoader({ label }: { label?: string }) {
  return <AppLoader label={label} fullScreen />;
}
