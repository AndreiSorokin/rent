'use client';

import type { InputHTMLAttributes } from 'react';
import { useMemo, useState } from 'react';

type AuthFieldProps = {
  id: string;
  label: string;
  inputClassName?: string;
  allowPasswordReveal?: boolean;
} & InputHTMLAttributes<HTMLInputElement>;

export function AuthField({
  id,
  label,
  inputClassName = '',
  allowPasswordReveal = true,
  type,
  ...props
}: AuthFieldProps) {
  const isPasswordField = type === 'password';
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const effectiveType = useMemo(() => {
    if (!isPasswordField || !allowPasswordReveal) return type;
    return isPasswordVisible ? 'text' : 'password';
  }, [allowPasswordReveal, isPasswordField, isPasswordVisible, type]);

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-[#111111]" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={effectiveType}
          className={`w-full rounded-xl border border-[#d8d1cb] bg-white px-3 py-2.5 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:ring-2 focus:ring-[#ff6a13]/20 ${
            isPasswordField && allowPasswordReveal ? 'pr-12' : ''
          } ${inputClassName}`.trim()}
          {...props}
        />
        {isPasswordField && allowPasswordReveal ? (
          <button
            type="button"
            onClick={() => setIsPasswordVisible((current) => !current)}
            className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-[#6b6b6b] transition hover:text-[#111111]"
            aria-label={isPasswordVisible ? 'Скрыть пароль' : 'Показать пароль'}
            title={isPasswordVisible ? 'Скрыть пароль' : 'Показать пароль'}
          >
            {isPasswordVisible ? (
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 3l18 18" />
                <path d="M10.6 10.7a2 2 0 102.7 2.7" />
                <path d="M9.9 5.1A10.9 10.9 0 0112 5c5.2 0 9.4 4.7 10 6.9a11.8 11.8 0 01-3.2 4.5" />
                <path d="M6.2 6.3C3.8 8 2.3 10.3 2 12c.3 1.2 1.7 3.9 5 5.8A11 11 0 0012 19c1 0 2-.1 2.9-.4" />
              </svg>
            ) : (
              <svg
                aria-hidden="true"
                viewBox="0 0 24 24"
                className="h-5 w-5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        ) : null}
      </div>
    </div>
  );
}
