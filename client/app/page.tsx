import Link from 'next/link';
import {
  BarChart3,
  Building2,
  FileClock,
  HandCoins,
  ShieldCheck,
  Users,
} from 'lucide-react';
import logo1 from './logo1.png';

const features = [
  {
    icon: Building2,
    title: 'Объекты и павильоны',
    text: 'Управляйте магазинами, павильонами и статусами оплаты в одном месте.',
  },
  {
    icon: HandCoins,
    title: 'Финансы по кассам',
    text: 'Разделяйте операции по безналу, кассе 1 и кассе 2 без ручных таблиц.',
  },
  {
    icon: FileClock,
    title: 'История и контроль',
    text: 'Фиксируйте изменения и быстро находите нужные операции в журнале действий.',
  },
  {
    icon: BarChart3,
    title: 'Сводка и прогноз',
    text: 'Видите доходы, расходы и переносы по месяцам для каждого объекта.',
  },
  {
    icon: Users,
    title: 'Права доступа',
    text: 'Гибко настраивайте роли: кто может видеть, менять или удалять данные.',
  },
  {
    icon: ShieldCheck,
    title: 'Для ежедневной работы',
    text: 'Открытие и закрытие смены, сверка по кассам и прозрачный учет.',
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f9f5f0] text-[#111111]">
      <section className="mx-auto max-w-7xl px-6 pb-12 pt-12 md:px-10 md:pt-16">
        <header className="mb-14 flex flex-col gap-5 md:mb-20 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="mb-2 flex items-center gap-3">
              <p className="text-lg font-semibold uppercase tracking-[0.2em] text-[#6B6B6B]">
                Palaci
              </p>
            </div>
            <h1 className="max-w-4xl text-4xl font-extrabold leading-tight md:text-5xl">
              Управление объектами и финансами без хаоса в таблицах
            </h1>
            <p className="mt-5 max-w-2xl text-base text-[#4B5563] md:text-lg">
              Система для владельцев торговых объектов и управляющих: павильоны,
              начисления, сводка, бухгалтерские операции и журнал действий.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 md:w-auto">
            <Link
              href="/register"
              className="inline-flex items-center justify-center rounded-full bg-[#FF6A13] px-6 py-3 text-sm font-bold uppercase tracking-wide text-white transition hover:bg-[#E65C00]"
            >
              Начать работу
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full border border-[#D8D1CB] bg-white px-6 py-3 text-sm font-semibold text-[#111111] transition hover:bg-[#f4efeb]"
            >
              Войти
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-full border border-[#D8D1CB] bg-[#F4EFEB] px-6 py-3 text-sm font-semibold text-[#374151] transition hover:bg-[#ede7e2]"
            >
              Перейти в панель
            </Link>
          </div>
        </header>

        <div className="mb-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[#D8D1CB] bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-widest text-[#6B6B6B]">Фокус</p>
            <p className="mt-2 text-xl font-bold">Павильоны и начисления</p>
          </div>
          <div className="rounded-2xl border border-[#D8D1CB] bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-widest text-[#6B6B6B]">Прозрачность</p>
            <p className="mt-2 text-xl font-bold">Сводка и кассовая сверка</p>
          </div>
          <div className="rounded-2xl border border-[#D8D1CB] bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-widest text-[#6B6B6B]">Безопасность</p>
            <p className="mt-2 text-xl font-bold">Права доступа и журнал действий</p>
          </div>
        </div>

        <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
          {features.map((feature) => (
            <article
              key={feature.title}
              className="rounded-[1.75rem] border border-[#D8D1CB] bg-white p-6 shadow-[0_6px_24px_rgba(0,0,0,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_10px_28px_rgba(0,0,0,0.08)]"
            >
              <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-xl bg-[#F4EFEB] text-[#FF6A13]">
                <feature.icon className="h-5 w-5" />
              </div>
              <h2 className="mb-2 text-xl font-bold">{feature.title}</h2>
              <p className="text-sm leading-6 text-[#4B5563]">{feature.text}</p>
            </article>
          ))}
        </section>

        <section className="mt-12 grid grid-cols-1 gap-5 lg:grid-cols-2">
          <article className="rounded-[1.75rem] border border-[#D8D1CB] bg-white p-7 shadow-[0_6px_24px_rgba(0,0,0,0.04)]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6B6B6B]">
              Тариф
            </p>
            <h3 className="mt-2 text-3xl font-extrabold">Базовый</h3>
            <p className="mt-2 text-[#4B5563]">
              Для запуска учета в одном объекте с командой и контролем операций.
            </p>
            <ul className="mt-4 space-y-2 text-sm text-[#374151]">
              <li>• До 1 объекта и неограниченно павильонов</li>
              <li>• Сводка, бухгалтерская таблица, журнал действий</li>
              <li>• Роли и права доступа для сотрудников</li>
            </ul>
            <div className="mt-6">
              <Link
                href="/register"
                className="inline-flex items-center justify-center rounded-full bg-[#FF6A13] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#E65C00]"
              >
                Подключить тариф
              </Link>
            </div>
          </article>

          <article className="rounded-[1.75rem] border border-[#D8D1CB] bg-[#F4EFEB] p-7 shadow-[0_6px_24px_rgba(0,0,0,0.04)]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6B6B6B]">
              Демо
            </p>
            <h3 className="mt-2 text-3xl font-extrabold">Попробуйте месяц бесплатно</h3>
            <p className="mt-2 text-[#4B5563]">
              Если у вас уже есть доступ, перейдите в панель и оцените работу
              модулей на реальных данных.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-full bg-[#2563EB] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#1D4ED8]"
              >
                Открыть дашборд
              </Link>
              <Link
                href="/login"
                className="inline-flex items-center justify-center rounded-full border border-[#D8D1CB] bg-white px-5 py-2.5 text-sm font-semibold text-[#111111] transition hover:bg-[#ede7e2]"
              >
                Войти в аккаунт
              </Link>
            </div>
          </article>
        </section>
      </section>

      <footer className="border-t border-[#D8D1CB] bg-[#F4EFEB]">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 py-10 md:grid-cols-3 md:px-10">
          <div>
            <p className="text-lg font-extrabold">Palaci</p>
            <p className="mt-2 text-sm text-[#6B6B6B]">
              Управление объектами, платежами и сверкой в одном рабочем контуре.
            </p>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-[#6B6B6B]">
              Разделы
            </p>
            <div className="mt-3 flex flex-col gap-2 text-sm">
              <Link href="/login" className="text-[#374151] hover:text-[#111111]">
                Вход
              </Link>
              <Link href="/register" className="text-[#374151] hover:text-[#111111]">
                Регистрация
              </Link>
              <Link href="/dashboard" className="text-[#374151] hover:text-[#111111]">
                Панель
              </Link>
            </div>
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-[#6B6B6B]">
              Документы
            </p>
            <div className="mt-3 flex flex-col gap-2 text-sm text-[#374151]">
              {/* <span>Политика конфиденциальности</span> */}
              {/* <span>Пользовательское соглашение</span> */}
              {/* <span>Поддержка: support@rentmanager.app</span> */}
            </div>
          </div>
        </div>
      </footer>
    </main>
  );
}
