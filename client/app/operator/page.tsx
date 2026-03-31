import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Информация об операторе | Palaci',
  description:
    'Полная информация об операторе сервиса Palaci: реквизиты, адрес и контактные данные.',
};

export default function OperatorPage() {
  return (
    <main className="min-h-screen bg-[#f9f5f0] px-6 py-12 text-[#111111] md:px-10">
      <div className="mx-auto max-w-4xl rounded-[2rem] border border-[#d8d1cb] bg-white p-8 shadow-[0_20px_60px_-30px_rgba(17,17,17,0.25)]">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#6B6B6B]">
          Palaci
        </p>
        <h1 className="mt-3 text-3xl font-extrabold md:text-4xl">
          Полная информация об операторе сервиса
        </h1>
        <p className="mt-4 text-base leading-7 text-[#4B5563]">
          Ниже размещены идентификационные и контактные данные оператора сервиса Palaci.
        </p>

        <div className="mt-8 rounded-2xl border border-[#e8e1da] bg-[#f8f4ef] p-6">
          <div className="space-y-3 text-base leading-7 text-[#111111]">
            <p className="font-semibold">Оператор сервиса Palaci</p>
            <p>Индивидуальный предприниматель Федоров Владимир Сергеевич</p>
            <p>ОГРНИП: 326774600201511</p>
            <p>ИНН: 366112533269</p>
            <p>
              Адрес регистрации: 295022, Республика Крым, г. Симферополь,
              ул. Ж. Дерюгиной, д. 6
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <section className="rounded-2xl border border-[#e8e1da] bg-white p-6">
            <h2 className="text-lg font-bold">Контакты по общим вопросам и претензиям</h2>
            <p className="mt-3 text-[#4B5563]">
              Email:{' '}
              <a
                href="mailto:fvs.post@yandex.ru"
                className="font-semibold text-[#111111] hover:text-[#ff6a13]"
              >
                fvs.post@yandex.ru
              </a>
            </p>
          </section>

          <section className="rounded-2xl border border-[#e8e1da] bg-white p-6">
            <h2 className="text-lg font-bold">
              Контакты для обращений субъектов персональных данных
            </h2>
            <p className="mt-3 text-[#4B5563]">
              Email:{' '}
              <a
                href="mailto:fvs.post@yandex.ru"
                className="font-semibold text-[#111111] hover:text-[#ff6a13]"
              >
                fvs.post@yandex.ru
              </a>
            </p>
          </section>
        </div>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link
            href="/privacy"
            className="rounded-full border border-[#d8d1cb] bg-white px-5 py-2.5 text-sm font-semibold text-[#111111] transition hover:bg-[#f4efeb]"
          >
            Политика конфиденциальности
          </Link>
          <Link
            href="/cookies"
            className="rounded-full border border-[#d8d1cb] bg-white px-5 py-2.5 text-sm font-semibold text-[#111111] transition hover:bg-[#f4efeb]"
          >
            Файлы cookie
          </Link>
        </div>
      </div>
    </main>
  );
}
