import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BarChart3,
  Building2,
  FileClock,
  HandCoins,
  ShieldCheck,
  Store,
  Users,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Rendlify — контроль торгового объекта в реальном времени',
  description:
    'Rendlify помогает собственнику или управляющему в реальном времени видеть доходы, расходы, арендаторов, павильоны, долги и состояние объекта в одном интерфейсе.',
  keywords: [
    'контроль торгового объекта',
    'программа для торгового дома',
    'управление павильонами',
    'контроль арендаторов и платежей',
    'доходы и расходы объекта',
  ],
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Rendlify — контроль торгового объекта в реальном времени',
    description:
      'Павильоны, арендаторы, платежи, доходы, расходы и состояние объекта — в одной понятной системе.',
    url: '/',
    siteName: 'Rendlify',
    locale: 'ru_RU',
    type: 'website',
  },
};

const features = [
  {
    icon: Building2,
    title: 'Объект и павильоны',
    text: 'Держите под контролем занятость, площадь, арендаторов и начисления по каждому павильону.',
  },
  {
    icon: HandCoins,
    title: 'Платежи и кассы',
    text: 'Разделяйте операции по безналу, кассе 1 и кассе 2 без хаоса в таблицах и ручных сверках.',
  },
  {
    icon: FileClock,
    title: 'История и контроль',
    text: 'Фиксируйте изменения, отслеживайте действия сотрудников и быстро находите нужные операции.',
  },
  {
    icon: BarChart3,
    title: 'Сводка и аналитика',
    text: 'Видите доходы, расходы, прибыль, прогноз и фактическое состояние объекта на одном экране.',
  },
  {
    icon: Users,
    title: 'Права доступа',
    text: 'Настраивайте роли так, чтобы каждый сотрудник видел и менял только нужные разделы.',
  },
  {
    icon: ShieldCheck,
    title: 'Ежедневная работа',
    text: 'Открытие и закрытие смены, сверка по кассам и понятный контроль финансовой ситуации.',
  },
];

const solutionLinks = [
  {
    href: '/solutions/trading-houses',
    title: 'Для торговых центров и торговых домов',
    text: 'Контроль объекта, арендаторов и павильонов в одном интерфейсе.',
  },
  {
    href: '/solutions/tenant-payments',
    title: 'Арендаторы и платежи',
    text: 'Начисления, оплаты, коммунальные, реклама и задолженность по каждому павильону.',
  },
  {
    href: '/solutions/pavilion-management',
    title: 'Управление объектами аренды и павильонами',
    text: 'Заполняемость, статусы, площадь и оперативная работа с торговыми точками.',
  },
  {
    href: '/solutions/object-analytics',
    title: 'Доходы, расходы и прибыль',
    text: 'Прозрачная сводка для собственника и управляющего по текущему состоянию объекта.',
  },
];

const faqItems = [
  {
    q: 'Для каких объектов подходит Rendlify?',
    a: 'Rendlify подходит для торговых домов, рынков, галерей и других объектов, где важно быстро видеть ситуацию по павильонам, арендаторам, платежам и доходам.',
  },
  {
    q: 'Это система учета или система контроля объекта?',
    a: 'И то и другое. Но основной сценарий — быстрый и понятный контроль ситуации по объекту в реальном времени: кто оплатил, где есть долг, какие расходы уже проведены и как выглядит итоговая сводка.',
  },
  {
    q: 'Можно ли разделять оплату по нескольким каналам?',
    a: 'Да. В системе поддерживаются безналичные платежи, наличные касса 1 и наличные касса 2.',
  },
  {
    q: 'Есть ли разграничение прав доступа?',
    a: 'Да. Можно отдельно настраивать права на просмотр, создание, редактирование и удаление данных для разных сотрудников.',
  },
];

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: faqItems.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: {
      '@type': 'Answer',
      text: item.a,
    },
  })),
};

const softwareSchema = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'Rendlify',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description:
    'Платформа для контроля торгового объекта, павильонов, арендаторов, платежей, доходов и расходов в реальном времени.',
  offers: {
    '@type': 'Offer',
    url: 'https://rendlify.com/tariffs',
  },
};

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f9f5f0] text-[#111111]">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareSchema) }}
      />

      <section className="mx-auto max-w-7xl px-6 pb-12 pt-12 md:px-10 md:pt-16">
        <header className="mb-14 flex flex-col gap-5 md:mb-20 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="mb-2 text-lg font-semibold uppercase tracking-[0.2em] text-[#6B6B6B]">
              Rendlify
            </p>
            <h1 className="max-w-4xl text-4xl font-extrabold leading-tight md:text-5xl">
              Контроль торгового объекта без хаоса в таблицах
            </h1>
            <p className="mt-5 max-w-3xl text-base text-[#4B5563] md:text-lg">
              Платформа для собственников и управляющих, которым важно в реальном времени
              видеть, что происходит с объектом: павильоны, арендаторы, начисления, платежи,
              доходы, расходы, долги и состояние касс — в одном рабочем контуре.
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
              href="/solutions"
              className="inline-flex items-center justify-center rounded-full border border-[#D8D1CB] bg-white px-6 py-3 text-sm font-semibold text-[#111111] transition hover:bg-[#f4efeb]"
            >
              Посмотреть решения
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center justify-center rounded-full border border-[#D8D1CB] bg-[#F4EFEB] px-6 py-3 text-sm font-semibold text-[#374151] transition hover:bg-[#ede7e2]"
            >
              Войти
            </Link>
          </div>
        </header>

        <div className="mb-12 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[#D8D1CB] bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-widest text-[#6B6B6B]">Фокус</p>
            <p className="mt-2 text-xl font-bold">Ситуация по объекту — в одном экране</p>
          </div>
          <div className="rounded-2xl border border-[#D8D1CB] bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-widest text-[#6B6B6B]">Прозрачность</p>
            <p className="mt-2 text-xl font-bold">
              Доходы, расходы, долги и кассы без ручной сводки
            </p>
          </div>
          <div className="rounded-2xl border border-[#D8D1CB] bg-white p-5 shadow-sm">
            <p className="text-xs uppercase tracking-widest text-[#6B6B6B]">Контроль</p>
            <p className="mt-2 text-xl font-bold">
              Права доступа и журнал действий для команды
            </p>
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

        <section className="mt-12 rounded-[1.75rem] border border-[#D8D1CB] bg-white p-7 shadow-[0_6px_24px_rgba(0,0,0,0.04)]">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#F4EFEB] text-[#FF6A13]">
              <Store className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-2xl font-extrabold md:text-3xl">
                Не только учет, а быстрый контроль ситуации
              </h2>
              <p className="mt-2 max-w-3xl text-sm text-[#4B5563] md:text-base">
                Rendlify помогает сначала понять, что происходит по объекту прямо сейчас, и
                только потом уже управлять данными глубже. Это особенно важно для собственников
                и управляющих, которым нужен понятный ответ на вопрос: где деньги, где долг, где
                отклонение и что требует внимания.
              </p>
            </div>
          </div>
        </section>

        <section className="mt-12">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#6B6B6B]">
                Посадочные страницы под кластеры
              </p>
              <h2 className="mt-2 text-2xl font-extrabold md:text-3xl">
                Основные направления, по которым нас могут искать
              </h2>
            </div>
            <Link
              href="/solutions"
              className="text-sm font-semibold text-[#FF6A13] hover:text-[#E65C00]"
            >
              Все решения →
            </Link>
          </div>
          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2">
            {solutionLinks.map((item) => (
              <article
                key={item.href}
                className="rounded-[1.5rem] border border-[#D8D1CB] bg-white p-6 shadow-[0_6px_24px_rgba(0,0,0,0.04)]"
              >
                <h3 className="text-xl font-bold">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#4B5563]">{item.text}</p>
                <Link
                  href={item.href}
                  className="mt-5 inline-flex items-center justify-center rounded-full border border-[#D8D1CB] bg-[#F4EFEB] px-4 py-2.5 text-sm font-semibold text-[#111111] transition hover:bg-[#ede7e2]"
                >
                  Открыть страницу
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-[1.75rem] border border-[#D8D1CB] bg-white p-7 shadow-[0_6px_24px_rgba(0,0,0,0.04)]">
          <h2 className="text-2xl font-extrabold md:text-3xl">Частые вопросы</h2>
          <div className="mt-5 space-y-3">
            {faqItems.map((item) => (
              <details
                key={item.q}
                className="rounded-xl border border-[#E5DED8] bg-[#F9F5F0] p-4"
              >
                <summary className="cursor-pointer list-none text-sm font-semibold text-[#111111]">
                  {item.q}
                </summary>
                <p className="mt-2 text-sm leading-6 text-[#4B5563]">{item.a}</p>
              </details>
            ))}
          </div>
        </section>
      </section>
    </main>
  );
}
