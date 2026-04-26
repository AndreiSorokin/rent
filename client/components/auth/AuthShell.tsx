import type { ReactNode } from 'react';

type AuthShellProps = {
  title: string;
  subtitle?: string;
  sideTitle: string;
  sideDescription: string;
  sideFooter?: ReactNode;
  topActions?: ReactNode;
  children: ReactNode;
};

export function AuthShell({
  title,
  subtitle,
  sideTitle,
  sideDescription,
  sideFooter,
  topActions,
  children,
}: AuthShellProps) {
  return (
    <div className="min-h-screen bg-[#f6f1eb] px-4 py-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center justify-center">
        <div className="grid w-full overflow-hidden rounded-3xl border border-[#d8d1cb] bg-white shadow-[0_20px_60px_-20px_rgba(17,17,17,0.25)] lg:grid-cols-2">
          <section className="hidden bg-[#f4efeb] p-10 lg:block">
            <div className="flex h-full flex-col justify-between">
              <div>
                <p className="text-sm font-semibold tracking-[0.2em] text-[#6b6b6b]">Rendlify</p>
                <h1 className="mt-6 text-4xl font-extrabold leading-tight text-[#111111]">{sideTitle}</h1>
                <p className="mt-4 max-w-sm text-sm leading-6 text-[#6b6b6b]">{sideDescription}</p>
              </div>
              {sideFooter ? (
                <div className="rounded-2xl border border-[#e6ded7] bg-white p-4 text-sm text-[#6b6b6b]">
                  {sideFooter}
                </div>
              ) : null}
            </div>
          </section>

          <section className="p-6 sm:p-10">
            {topActions ? <div>{topActions}</div> : null}
            <h2 className={`${topActions ? 'mt-5' : ''} text-3xl font-bold text-[#111111]`}>{title}</h2>
            {subtitle ? <p className="mt-2 text-sm text-[#6b6b6b]">{subtitle}</p> : null}
            <div className="mt-8">{children}</div>
          </section>
        </div>
      </div>
    </div>
  );
}
