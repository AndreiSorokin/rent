import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, BadgeCheck, ShieldCheck } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Согласие пользователя сайта на обработку персональных данных | Rendlify',
  description:
    'Согласие пользователя сайта Rendlify на обработку персональных данных при регистрации, использовании сайта и направлении обращений.',
};

const sections = [
  {
    title: '1. Общие положения',
    paragraphs: [
      'Настоящее согласие дается пользователем сайта Rendlify свободно, своей волей и в своем интересе в соответствии с Федеральным законом от 27.07.2006 № 152-ФЗ «О персональных данных».',
      'Согласие предоставляется оператору сервиса Rendlify — Индивидуальному предпринимателю Федорову Владимиру Сергеевичу, ОГРНИП 326774600201511, ИНН 366112533269.',
    ],
  },
  {
    title: '2. Какие данные могут обрабатываться',
    bullets: [
      'фамилия, имя, отчество или имя, если пользователь указывает эти сведения;',
      'адрес электронной почты;',
      'номер телефона, если он предоставляется пользователем;',
      'логин, пароль в хешированном виде, внутренний идентификатор пользователя;',
      'IP-адрес, сведения об устройстве и браузере, дата и время входа в систему;',
      'история действий пользователя на сайте и в платформе, включая отправленные формы и загруженные материалы.',
    ],
  },
  {
    title: '3. Цели обработки',
    bullets: [
      'регистрация пользователя на сайте и создание учетной записи;',
      'предоставление доступа к сервису Rendlify и его функциям;',
      'обеспечение безопасности, аутентификации и восстановления доступа;',
      'направление сервисных уведомлений и ответов на обращения пользователя;',
      'соблюдение требований законодательства Российской Федерации.',
    ],
  },
  {
    title: '4. Действия с персональными данными',
    paragraphs: [
      'Оператор вправе осуществлять сбор, запись, систематизацию, накопление, хранение, уточнение, использование, передачу в случаях, предусмотренных законом или договором, обезличивание, блокирование, удаление и уничтожение персональных данных.',
    ],
  },
  {
    title: '5. Срок действия согласия и отзыв',
    paragraphs: [
      'Согласие действует с момента его предоставления до достижения целей обработки либо до момента отзыва согласия субъектом персональных данных, если иное не предусмотрено законодательством Российской Федерации.',
      'Согласие может быть отозвано путем направления обращения на email fvs.post@yandex.ru. Отзыв согласия не влияет на законность обработки, осуществленной до момента отзыва.',
    ],
  },
  {
    title: '6. Подтверждение пользователя',
    paragraphs: [
      'Отмечая чекбокс при регистрации, пользователь подтверждает, что ознакомился с Политикой обработки персональных данных, понимает содержание настоящего согласия и выражает согласие на обработку своих персональных данных на изложенных условиях.',
    ],
  },
];

export default function SiteConsentPage() {
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
              <h1 className="text-3xl font-extrabold leading-tight md:text-5xl">
                Согласие пользователя сайта на обработку персональных данных
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-[#4B5563]">
                Этот документ используется при регистрации в Rendlify и подтверждает согласие
                пользователя на обработку персональных данных в объеме, необходимом для работы
                сайта и платформы.
              </p>
            </div>

            <div className="flex gap-3">
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F4EFEB] text-[#FF6A13]">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[#F4EFEB] text-[#111111]">
                <BadgeCheck className="h-6 w-6" />
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-[#E5DED8] bg-[#F9F5F0] p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-[#6B6B6B]">Оператор</p>
              <p className="mt-2 text-sm font-semibold text-[#111111]">
                ИП Федоров Владимир Сергеевич
              </p>
            </div>
            <div className="rounded-2xl border border-[#E5DED8] bg-[#F9F5F0] p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-[#6B6B6B]">Дата вступления в силу</p>
              <p className="mt-2 text-sm font-semibold text-[#111111]">31.03.2026</p>
            </div>
            <div className="rounded-2xl border border-[#E5DED8] bg-[#F9F5F0] p-5">
              <p className="text-xs uppercase tracking-[0.16em] text-[#6B6B6B]">Применение</p>
              <p className="mt-2 text-sm font-semibold text-[#111111]">Регистрация и доступ к сайту</p>
            </div>
          </div>

          <div className="mt-8 space-y-6">
            {sections.map((section) => (
              <section
                key={section.title}
                className="rounded-[1.5rem] border border-[#E5DED8] bg-white p-6"
              >
                <h2 className="text-xl font-extrabold md:text-2xl">{section.title}</h2>
                <div className="mt-4 space-y-3 text-sm leading-7 text-[#4B5563] md:text-[15px]">
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
                </div>
              </section>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/privacy"
              className="rounded-full border border-[#d8d1cb] bg-white px-5 py-2.5 text-sm font-semibold text-[#111111] transition hover:bg-[#f4efeb]"
            >
              Политика обработки ПД
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
