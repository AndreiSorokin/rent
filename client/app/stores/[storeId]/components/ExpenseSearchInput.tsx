'use client';

type ExpenseSearchInputProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function ExpenseSearchInput({
  value,
  onChange,
  placeholder = 'Поиск по названию',
  className = '',
}: ExpenseSearchInputProps) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`.trim()}>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="min-w-[220px] rounded-lg border border-[#d8d1cb] bg-white px-3 py-2 text-sm text-[#111111] outline-none transition focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/15"
        aria-label={placeholder}
      />
    </div>
  );
}
