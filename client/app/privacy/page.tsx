import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Политика конфиденциальности | Palaci',
  description:
    'Политика конфиденциальности сервиса Palaci. Страница подготовлена для размещения условий обработки и защиты персональных данных.',
};

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#f9f5f0] text-[#111111]">
      <section className="mx-auto max-w-5xl px-6 pb-14 pt-12 md:px-10 md:pt-16">
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-[#D8D1CB] bg-white px-4 py-2 text-sm font-semibold text-[#374151] transition hover:bg-[#f4efeb]"
          >
            <ArrowLeft className="h-4 w-4" />
            На главную
          </Link>
        </div>

        <div className="rounded-[2rem] border border-[#D8D1CB] bg-white p-7 shadow-[0_8px_30px_rgba(0,0,0,0.04)] md:p-10">
          <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <p className="mb-2 text-sm font-semibold uppercase tracking-[0.18em] text-[#6B6B6B]">
                Документ
              </p>
              <h1 className="text-4xl font-extrabold leading-tight md:text-5xl">
                Политика конфиденциальности
              </h1>
              <p className="mt-4 max-w-2xl text-base text-[#4B5563]">
                Здесь будет размещен полный текст политики конфиденциальности
                сервиса Palaci. Страница уже подготовлена для публикации
                документа в едином стиле платформы.
              </p>
            </div>

            <div className="flex gap-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F4EFEB] text-[#FF6A13]">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F4EFEB] text-[#111111]">
                <FileText className="h-6 w-6" />
              </div>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-[#E5DED8] bg-[#F9F5F0] p-6">
            <p className="text-sm leading-7 text-[#4B5563]">
              После утверждения текста сюда можно будет добавить разделы о
              собираемых данных, целях обработки, сроках хранения, защите
              информации и правах пользователей.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
