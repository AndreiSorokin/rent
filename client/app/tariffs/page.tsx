import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Calculator, Receipt } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Тарифы | Palaci',
  description:
    'Тарифы сервиса Palaci. Актуальная стоимость рассчитывается по количеству занятых павильонов объекта.',
};

const examples = [
  { occupied: 1, amount: '2 000 ₽' },
  { occupied: 5, amount: '10 000 ₽' },
  { occupied: 12, amount: '24 000 ₽' },
];

export default function TariffsPage() {
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
                Тарифы
              </p>
              <h1 className="text-3xl font-extrabold leading-tight md:text-5xl">
                Текущий тариф Palaci
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-[#4B5563]">
                Стоимость доступа к платформе рассчитывается просто:
                мы берем количество павильонов со статусом <span className="font-semibold text-[#111111]">«ЗАНЯТ»</span> и
                умножаем его на <span className="font-semibold text-[#111111]">2 000 рублей</span>.
              </p>
            </div>

            <div className="flex gap-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F4EFEB] text-[#FF6A13]">
                <Calculator className="h-6 w-6" />
              </div>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F4EFEB] text-[#111111]">
                <Receipt className="h-6 w-6" />
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-[#E5DED8] bg-[#F9F5F0] p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-[#6B6B6B]">Модель</p>
              <p className="mt-2 text-sm font-semibold text-[#111111]">За занятый павильон</p>
            </div>
            <div className="rounded-2xl border border-[#E5DED8] bg-[#F9F5F0] p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-[#6B6B6B]">Ставка</p>
              <p className="mt-2 text-sm font-semibold text-[#111111]">2 000 ₽ за павильон</p>
            </div>
            <div className="rounded-2xl border border-[#E5DED8] bg-[#F9F5F0] p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-[#6B6B6B]">Статус</p>
              <p className="mt-2 text-sm font-semibold text-[#111111]">Актуальный тариф</p>
            </div>
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-[#E5DED8] bg-[#FFF8F2] p-6">
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-[#6B6B6B]">
              Формула расчета
            </p>
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-[#F1D7C3] bg-white px-5 py-4 text-lg font-extrabold text-[#111111] md:text-2xl">
                Стоимость = количество павильонов со статусом «ЗАНЯТ» × 2 000 ₽
              </div>
              <p className="text-sm leading-7 text-[#4B5563]">
                В расчет берутся только павильоны, у которых установлен статус{' '}
                <span className="font-semibold text-[#111111]">«ЗАНЯТ»</span>. Свободные
                павильоны, павильоны с предоплатой и другие статусы в текущем тарифе не
                учитываются.
              </p>
            </div>
          </div>

          <section className="mt-8 rounded-[1.5rem] border border-[#E5DED8] bg-white p-6 md:p-8">
            <div className="mb-5 border-b border-[#EFE7E1] pb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6B6B6B]">
                Примеры расчета
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {examples.map((example) => (
                <div
                  key={example.occupied}
                  className="rounded-2xl border border-[#EAE1D9] bg-[#F9F5F0] p-5"
                >
                  <p className="text-sm text-[#6B6B6B]">Занятых павильонов</p>
                  <p className="mt-2 text-3xl font-extrabold text-[#111111]">
                    {example.occupied}
                  </p>
                  <p className="mt-4 text-sm text-[#6B6B6B]">Ежемесячная стоимость</p>
                  <p className="mt-2 text-xl font-bold text-[#FF6A13]">{example.amount}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/offer"
              className="rounded-full border border-[#d8d1cb] bg-white px-5 py-2.5 text-sm font-semibold text-[#111111] transition hover:bg-[#f4efeb]"
            >
              Публичная оферта
            </Link>
            <Link
              href="/user-agreement"
              className="rounded-full border border-[#d8d1cb] bg-white px-5 py-2.5 text-sm font-semibold text-[#111111] transition hover:bg-[#f4efeb]"
            >
              Пользовательское соглашение
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
