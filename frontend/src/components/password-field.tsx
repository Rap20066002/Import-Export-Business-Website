"use client";

import { useState } from "react";

export function PasswordField({
  label = "Password",
  value,
  onChange,
  autoComplete,
  required = true,
  minLength,
}: {
  label?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  required?: boolean;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div>
      <label className="block text-xs font-medium text-slate-700 mb-1">{label}</label>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          className="w-full rounded-md border px-3 py-2 pr-10 text-sm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={required}
          minLength={minLength}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4" strokeWidth="2">
              <path d="M3 3l18 18" />
              <path d="M10.6 10.6a2 2 0 002.8 2.8" />
              <path d="M9.9 5.1A9.8 9.8 0 0112 5c5 0 9.3 3.1 11 7-0.5 1.1-1.2 2.1-2 3" />
              <path d="M6.7 6.7C4.6 8.1 3 10 2 12c1.7 3.9 6 7 10 7 1.3 0 2.6-.3 3.8-.8" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-4 w-4" strokeWidth="2">
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
