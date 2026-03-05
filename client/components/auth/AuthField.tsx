import type { InputHTMLAttributes } from 'react';

type AuthFieldProps = {
  id: string;
  label: string;
  inputClassName?: string;
} & InputHTMLAttributes<HTMLInputElement>;

export function AuthField({ id, label, inputClassName = '', ...props }: AuthFieldProps) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-[#111111]" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className={`w-full rounded-xl border border-[#d8d1cb] bg-white px-3 py-2.5 text-[#111111] outline-none transition focus:border-[#ff6a13] focus:ring-2 focus:ring-[#ff6a13]/20 ${inputClassName}`.trim()}
        {...props}
      />
    </div>
  );
}
