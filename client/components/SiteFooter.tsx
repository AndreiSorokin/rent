import Link from 'next/link';
import Image from 'next/image';
import Palaci from '../public/logo1.png'

const operatorText =
  'Оператор сервиса Palaci: ИП Федоров Владимир Сергеевич, ОГРНИП 326774600201511, ИНН 366112533269, email: fvs.post@yandex.ru';

export function SiteFooter() {
  return (
    <footer className="border-t border-[#D8D1CB] bg-[#F4EFEB]">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 text-sm text-[#374151] md:px-10">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="max-w-3xl">
            <Image src={Palaci} alt="Palaci" style={{width: 60, height: 50}} />
            <p className="text-lg font-extrabold text-[#111111]">Palaci</p>
            <p className="mt-2 leading-6 text-[#6B6B6B]">{operatorText}</p>
          </div>
          <div className="flex flex-col gap-2 text-sm">
            <Link href="/user-agreement" target="_blank" className="hover:text-[#111111]">
              Пользовательское соглашение
            </Link>
            <Link href="/privacy" target="_blank" className="hover:text-[#111111]">
              Политика обработки персональных данных
            </Link>
            <Link href="/site-consent" target="_blank" className="hover:text-[#111111]">
              Согласие пользователя сайта на обработку ПД
            </Link>
            <Link href="/content-rules" target="_blank" className="hover:text-[#111111]">
              Правила размещения и модерации контента
            </Link>
            <Link href="/operator" target="_blank" className="hover:text-[#111111]">
              Полная информация об операторе
            </Link>
            <Link href="/cookies" target="_blank" className="hover:text-[#111111]">
              Файлы cookie
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
