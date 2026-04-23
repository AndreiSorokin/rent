'use client';

import {
  formatDateInputDisplay,
  formatDateKey,
  normalizeDateInputToDateKey,
} from '@/lib/dateTime';

type FormattedDateInputProps = {
  value: string;
  onChange: (value: string) => void;
  onTouched?: () => void;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
};

export function FormattedDateInput({
  value,
  onChange,
  onTouched,
  disabled = false,
  className,
  placeholder = 'дд.мм.гггг',
}: FormattedDateInputProps) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(formatDateInputDisplay(e.target.value))}
      onBlur={() => {
        onTouched?.();
        const normalized = normalizeDateInputToDateKey(value);
        if (normalized) {
          onChange(formatDateKey(normalized));
        }
      }}
      className={className}
      placeholder={placeholder}
      inputMode="numeric"
      disabled={disabled}
    />
  );
}
