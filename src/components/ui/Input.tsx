import React, { useId } from 'react';

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  error?: string;
  /** Called with the new string value (not the change event). */
  onChange?: (value: string) => void;
}

export const Input: React.FC<InputProps> = ({
  label,
  error,
  onChange,
  className = '',
  id,
  ...rest
}) => {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className={`block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 ${className}`}
        {...rest}
      />
      {error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
};

export default Input;
