import type { Metadata } from 'next';
import Link from 'next/link';
import { LifeBuoy, Mail, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Тех поддержка | Rendlify',
  description:
    'Как связаться с технической поддержкой Rendlify. Если у вас есть вопрос по платформе, напишите на info@rendlify.com.',
  alternates: {
    canonical: '/support',
  },
  openGraph: {
    title: 'Тех поддержка | Rendlify',
    description:
      'Если у вас есть вопрос по платформе Rendlify, напишите на info@rendlify.com.',
    url: '/support',
    siteName: 'Rendlify',
    locale: 'ru_RU',
    type: 'website',
  },
};

export default function SupportPage() {
  return (
    <main className="min-h-screen bg-[#f9f5f0] text-[#111111]">
      <section className="mx-auto max-w-5xl px-6 pb-16 pt-14 md:px-10 md:pt-20">
        <div className="rounded-[2rem] border border-[#D8D1CB] bg-white p-8 shadow-[0_10px_40px_rgba(0,0,0,0.05)] md:p-12">
          <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F4EFEB] text-[#FF6A13]">
            <LifeBuoy className="h-7 w-7" />
          </div>

          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#6B6B6B]">
            Тех поддержка
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-extrabold leading-tight md:text-4xl">
            Если у вас есть вопрос по платформе, мы на связи
          </h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-[#4B5563] md:text-lg">
            Если что-то работает не так, как вы ожидаете, или вам нужна помощь по
            работе с Rendlify, напишите нам на почту. Опишите вопрос как можно
            подробнее - так мы сможем помочь быстрее.
          </p>

          <div className="mt-8 rounded-[1.5rem] border border-[#f3c6a8] bg-[#fff1e8] p-5 md:p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-sm text-[#8A4B26]">Почта технической поддержки</p>
                <a
                  href="mailto:info@rendlify.com"
                  className="mt-1 inline-flex items-center gap-2 text-xl font-bold text-[#C2410C] transition hover:text-[#9A3412]"
                >
                  info@rendlify.com
                </a>
              </div>

              <a
                href="mailto:info@rendlify.com?subject=Вопрос%20по%20Rendlify"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-[#FF6A13] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#E65C00]"
              >
                Написать в поддержку
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>
          </div>

          <div className="mt-8 grid gap-4 text-sm text-[#4B5563] md:grid-cols-2">
            <div className="rounded-2xl border border-[#E7DED7] bg-[#FAF7F3] p-4">
              <p className="font-semibold text-[#111111]">Что полезно указать в письме</p>
              <p className="mt-2 leading-6">
                Название объекта, краткое описание проблемы, шаги до ошибки и, если
                есть, скриншот или точный текст сообщения.
              </p>
            </div>
          </div>

          <div className="mt-10">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#374151] transition hover:text-[#111111]"
            >
              <ArrowRight className="h-4 w-4 rotate-180" />
              Вернуться на главную
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
