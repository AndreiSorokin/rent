import Link from 'next/link';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import Rendlify from '../public/logo1.png';

export function SiteFooter() {
  const t = useTranslations('Footer');

  return (
    <footer className="border-t border-[#D8D1CB] bg-[#F4EFEB]">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-6 py-8 text-sm text-[#374151] md:px-10">
        <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
          <div className="max-w-3xl">
            <Image src={Rendlify} alt="Rendlify" style={{ width: 60, height: 50 }} />
            <p className="text-lg font-extrabold text-[#111111]">Rendlify</p>
            <p className="mt-2 leading-6 text-[#6B6B6B]">{t('operatorText')}</p>
          </div>
          <div className="grid grid-cols-1 gap-2 text-sm md:grid-cols-2 md:gap-x-8">
            <Link href="/support" className="hover:text-[#111111]">
              {t('support')}
            </Link>
            <Link href="/solutions" className="hover:text-[#111111]">
              {t('solutions')}
            </Link>
            <Link href="/tariffs" target="_blank" className="hover:text-[#111111]">
              {t('tariffs')}
            </Link>
            <Link href="/offer" target="_blank" className="hover:text-[#111111]">
              {t('offer')}
            </Link>
            <Link href="/user-agreement" target="_blank" className="hover:text-[#111111]">
              {t('userAgreement')}
            </Link>
            <Link href="/privacy" target="_blank" className="hover:text-[#111111]">
              {t('privacy')}
            </Link>
            <Link href="/site-consent" target="_blank" className="hover:text-[#111111]">
              {t('siteConsent')}
            </Link>
            <Link href="/content-rules" target="_blank" className="hover:text-[#111111]">
              {t('contentRules')}
            </Link>
            <Link href="/operator" target="_blank" className="hover:text-[#111111]">
              {t('operator')}
            </Link>
            <Link href="/cookies" target="_blank" className="hover:text-[#111111]">
              {t('cookies')}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
