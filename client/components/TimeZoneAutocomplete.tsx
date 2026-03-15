'use client';

import { useEffect, useMemo, useState } from 'react';
import { buildTimeZoneOptions, searchTimeZoneOptions } from '@/lib/timeZones';

type TimeZoneAutocompleteProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
  inputClassName?: string;
  dropdownClassName?: string;
  itemClassName?: string;
  emptyTextClassName?: string;
  fallbackTextClassName?: string;
  emptyText?: string;
  fallbackText?: string;
};

export function TimeZoneAutocomplete({
  value,
  onChange,
  disabled = false,
  placeholder = 'Введите город',
  inputClassName = '',
  dropdownClassName = '',
  itemClassName = '',
  emptyTextClassName = '',
  fallbackTextClassName = '',
  emptyText = 'Ничего не найдено',
  fallbackText = 'Ближайшие подходящие города и локации',
}: TimeZoneAutocompleteProps) {
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedQuery(value.trim().toLowerCase());
    }, 250);
    return () => clearTimeout(timeout);
  }, [value]);

  const timeZoneOptions = useMemo(() => buildTimeZoneOptions(), []);
  const timeZoneSearch = useMemo(
    () => searchTimeZoneOptions(debouncedQuery, timeZoneOptions),
    [debouncedQuery, timeZoneOptions],
  );

  return (
    <div className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setShowSuggestions(true);
        }}
        onFocus={() => setShowSuggestions(true)}
        onBlur={() => {
          setTimeout(() => setShowSuggestions(false), 120);
        }}
        disabled={disabled}
        placeholder={placeholder}
        className={inputClassName}
      />
      {showSuggestions && (
        <div className={dropdownClassName}>
          {timeZoneSearch.fallbackUsed && timeZoneSearch.options.length > 0 && (
            <p className={fallbackTextClassName}>{fallbackText}</p>
          )}
          {timeZoneSearch.options.length === 0 ? (
            <p className={emptyTextClassName}>{emptyText}</p>
          ) : (
            timeZoneSearch.options.map((option) => (
              <button
                key={`${option.value}-${option.label}`}
                type="button"
                disabled={disabled}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(option.value);
                  setShowSuggestions(false);
                }}
                className={itemClassName}
              >
                {option.label}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
