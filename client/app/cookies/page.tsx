import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, Cookie, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Файлы cookie | Palaci',
  description:
    'Информация о том, как сервис Palaci использует файлы cookie и похожие технологии.',
};

const sections = [
  {
    title: '1. Общие положения',
    paragraphs: [
      '1.1. Настоящая Политика использования файлов cookie описывает, какие файлы cookie и аналогичные технологии использует сайт https://palaci.ru/ и программная платформа «Palaci», а также цели и порядок их применения.',
      '1.2. Политика является частью Политики обработки персональных данных и Пользовательского соглашения Сайта. Используя Сайт, вы соглашаетесь с условиями настоящей Политики.',
    ],
  },
  {
    title: '2. Что такое файлы cookie',
    paragraphs: [
      '2.1. Cookie — это небольшие текстовые файлы, которые сохраняются в браузере или на устройстве пользователя при посещении Сайта.',
      '2.2. Cookie позволяют распознавать устройство пользователя, запоминать его действия и настройки, обеспечивать корректную работу Сайта и улучшать качество сервиса.',
    ],
  },
  {
    title: '3. Какие cookie мы используем',
    paragraphs: [
      '3.1. На Сайте могут использоваться следующие категории cookie:',
    ],
    bullets: [
      'Строго необходимые (технические) cookie — обеспечивают работу Сайта и Платформы: авторизацию, поддержание сессии, безопасность, работу формы входа и Личного кабинета.',
      'Функциональные cookie — запоминают настройки и выборы пользователя, включая язык интерфейса, сохраненные фильтры и предпочтения отображения.',
      'Аналитические cookie — помогают собирать статистику использования Сайта и Платформы, включая посещаемость страниц, источники трафика и поведение пользователей.',
      'Маркетинговые и рекламные cookie — могут использоваться для показа релевантной рекламы и оценки эффективности рекламных кампаний.',
    ],
    tail: [
      '3.2. Некоторые cookie устанавливаются непосредственно Оператором, другие — поставщиками сторонних сервисов, которые используются на Сайте.',
    ],
  },
  {
    title: '4. Сторонние сервисы',
    paragraphs: [
      '4.1. На Сайте могут использоваться сторонние сервисы, в том числе сервисы веб-аналитики и сервисы рассылок/уведомлений. Фактический перечень зависит от текущего технического стека.',
    ],
    bullets: [
      'Яндекс.Метрика — для сбора статистики посещений и анализа поведения пользователей.',
      'Сервисы рассылок и уведомлений — для отправки электронных писем и информационных сообщений.',
    ],
    tail: [
      '4.2. Такие сервисы могут размещать собственные cookie и собирать информацию о вашем устройстве, браузере, посещенных страницах и действиях на Сайте. Обработка данных такими сервисами осуществляется в соответствии с их собственными политиками конфиденциальности.',
    ],
  },
  {
    title: '5. Цели использования cookie',
    bullets: [
      'обеспечение работы и безопасности Сайта и Платформы;',
      'сохранение пользовательских настроек и параметров работы с сервисом;',
      'анализ использования Сайта, выявление технических ошибок и улучшение функционала;',
      'измерение эффективности рекламных и маркетинговых активностей;',
      'защита от мошеннических и несанкционированных действий.',
    ],
  },
  {
    title: '6. Управление cookie и настройка согласия',
    paragraphs: [
      '6.1. При первом посещении Сайта пользователю отображается баннер с уведомлением об использовании файлов cookie и предложением выбрать категории cookie.',
      '6.2. Строго необходимые cookie устанавливаются автоматически, так как они необходимы для работы Сайта. Аналитические, функциональные и маркетинговые cookie используются только при наличии согласия пользователя.',
      '6.3. Пользователь может в любой момент изменить свой выбор или отозвать согласие через настройки браузера, через специальную панель/кнопку настроек cookie на Сайте или через интерфейс Платформы, если такая возможность реализована.',
      '6.4. Отключение или блокировка части cookie может привести к некорректной работе отдельных функций Сайта и Платформы.',
    ],
  },
  {
    title: '7. Срок хранения cookie',
    paragraphs: [
      '7.1. Cookie могут быть сессионными и постоянными.',
    ],
    bullets: [
      'Сессионные cookie хранятся только на время работы браузера и удаляются после его закрытия.',
      'Постоянные cookie остаются на устройстве до окончания срока хранения или их удаления пользователем.',
    ],
    tail: [
      '7.2. Конкретные сроки хранения зависят от типа cookie и настроек браузера и обычно составляют от нескольких минут до 24 месяцев.',
    ],
  },
  {
    title: '8. Обработка персональных данных',
    paragraphs: [
      '8.1. В некоторых случаях cookie и собранные с их помощью данные могут относиться к персональным данным, например IP-адрес, идентификаторы устройств и данные о поведении на Сайте.',
      '8.2. Обработка таких данных осуществляется в соответствии с Политикой обработки персональных данных Оператора и законодательством Российской Федерации.',
      '8.3. Правовые основания, цели, сроки хранения и права пользователя как субъекта персональных данных подробно описаны в соответствующей политике.',
    ],
  },
  {
    title: '9. Изменение Политики',
    paragraphs: [
      '9.1. Оператор вправе в любое время вносить изменения в настоящую Политику.',
      '9.2. Актуальная версия Политики всегда доступна на странице https://palaci.ru/cookies.',
      '9.3. Если изменения носят существенный характер, Оператор может дополнительно уведомить пользователей через баннер на Сайте или иным доступным способом.',
    ],
  },
  {
    title: '10. Контакты',
    paragraphs: [
      'По вопросам использования файлов cookie и обработки персональных данных вы можете обратиться к Оператору.',
    ],
    bullets: [
      'Оператор: ИП Федоров Владимир Сергеевич',
      'Email: fvs.post@yandex.ru',
      'Почтовый адрес: 295022, Республика Крым, г. Симферополь, ул. Жени Дерюгиной, д. 6',
    ],
  },
];

export default function CookiesPage() {
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
              <h1 className="text-3xl font-extrabold leading-tight md:text-4xl">
                Политика использования файлов cookie
              </h1>
              <p className="mt-4 max-w-2xl text-base text-[#4B5563]">
                Здесь размещена информация о том, какие cookie использует Palaci,
                для чего они нужны и как пользователь может управлять своим согласием.
              </p>
            </div>

            <div className="flex gap-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F4EFEB] text-[#FF6A13]">
                <Cookie className="h-6 w-6" />
              </div>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F4EFEB] text-[#111111]">
                <ShieldCheck className="h-6 w-6" />
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-[#E5DED8] bg-[#F9F5F0] p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-[#6B6B6B]">Сайт</p>
              <p className="mt-2 text-sm font-semibold text-[#111111]">https://palaci.ru/</p>
            </div>
            <div className="rounded-2xl border border-[#E5DED8] bg-[#F9F5F0] p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-[#6B6B6B]">Дата вступления в силу</p>
              <p className="mt-2 text-sm font-semibold text-[#111111]">25.03.2026</p>
            </div>
            <div className="rounded-2xl border border-[#E5DED8] bg-[#F9F5F0] p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-[#6B6B6B]">Версия</p>
              <p className="mt-2 text-sm font-semibold text-[#111111]">1</p>
            </div>
          </div>

          <div className="mt-6 rounded-[1.5rem] border border-[#E5DED8] bg-[#FFF8F2] p-6">
            <p className="text-sm leading-7 text-[#4B5563]">
              Оператор: ИП Федоров Владимир Сергеевич, ОГРНИП 326774600201511, ИНН 366112533269
            </p>
          </div>

          <div className="mt-8 space-y-6">
            {sections.map((section) => (
              <section
                key={section.title}
                className="rounded-[1.5rem] border border-[#E5DED8] bg-white p-6"
              >
                <h2 className="text-xl font-extrabold">{section.title}</h2>
                <div className="mt-4 space-y-3 text-sm leading-7 text-[#4B5563]">
                  {section.paragraphs?.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                  {section.bullets && (
                    <ul className="space-y-2">
                      {section.bullets.map((bullet) => (
                        <li
                          key={bullet}
                          className="rounded-xl border border-[#F0E7DE] bg-[#F9F5F0] px-4 py-3 text-[#374151]"
                        >
                          {bullet}
                        </li>
                      ))}
                    </ul>
                  )}
                  {section.tail?.map((paragraph) => (
                    <p key={paragraph}>{paragraph}</p>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/privacy"
              className="rounded-full border border-[#d8d1cb] bg-white px-5 py-2.5 text-sm font-semibold text-[#111111] transition hover:bg-[#f4efeb]"
            >
              Политика конфиденциальности
            </Link>
            <Link
              href="/operator"
              className="rounded-full border border-[#d8d1cb] bg-white px-5 py-2.5 text-sm font-semibold text-[#111111] transition hover:bg-[#f4efeb]"
            >
              Информация об операторе
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
