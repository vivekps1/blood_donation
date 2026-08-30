import React from 'react';
import { AlertCircle, CheckCircle, WifiOff, X } from 'lucide-react';
import type { NormalisedError } from '../utils/apiError';

/**
 * Shared error and success presentation.
 *
 * Before this, API failures were reported with `alert()` or swallowed entirely, and no
 * form ever highlighted the field the server actually objected to. These three pieces —
 * a banner, a per-field message, and an input class helper — give every form the same
 * behaviour.
 */

// --- Banner ---------------------------------------------------------------

interface ErrorBannerProps {
  error: NormalisedError | string | null;
  /** Shows a dismiss button when provided. */
  onDismiss?: () => void;
  className?: string;
}

export const ErrorBanner: React.FC<ErrorBannerProps> = ({ error, onDismiss, className = '' }) => {
  if (!error) return null;

  const normalised = typeof error === 'string'
    ? { message: error, fieldErrors: {}, reasons: [], isNetworkError: false }
    : error;

  const Icon = normalised.isNetworkError ? WifiOff : AlertCircle;
  const fieldMessages = Object.entries(normalised.fieldErrors || {});

  return (
    <div
      // role="alert" makes screen readers announce the failure without moving focus.
      role="alert"
      className={`bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 flex items-start ${className}`}
    >
      <Icon className="w-5 h-5 mr-2.5 mt-0.5 shrink-0 text-red-600" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{normalised.message}</p>

        {/* Why a donor is ineligible, or any other supporting detail the API sent. */}
        {normalised.reasons?.length > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {normalised.reasons.map((reason, i) => (
              <li key={i} className="text-sm text-red-700">• {reason}</li>
            ))}
          </ul>
        )}

        {/* Repeat the field problems in the banner: the offending input may be scrolled
            out of view, or inside a section the user has collapsed. */}
        {fieldMessages.length > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {fieldMessages.map(([field, message]) => (
              <li key={field} className="text-sm text-red-700">• {message}</li>
            ))}
          </ul>
        )}
      </div>

      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="ml-2 text-red-500 hover:text-red-700 shrink-0">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

// --- Success --------------------------------------------------------------

export const SuccessBanner: React.FC<{ message: string | null; onDismiss?: () => void; className?: string }> = ({
  message, onDismiss, className = ''
}) => {
  if (!message) return null;
  return (
    <div role="status" className={`bg-green-50 border border-green-200 text-green-800 rounded-lg px-4 py-3 flex items-start ${className}`}>
      <CheckCircle className="w-5 h-5 mr-2.5 mt-0.5 shrink-0 text-green-600" />
      <p className="text-sm flex-1">{message}</p>
      {onDismiss && (
        <button type="button" onClick={onDismiss} aria-label="Dismiss" className="ml-2 text-green-600 hover:text-green-800 shrink-0">
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

// --- Per-field ------------------------------------------------------------

export const FieldError: React.FC<{ message?: string }> = ({ message }) => {
  if (!message) return null;
  return (
    <p className="mt-1 text-sm text-red-600 flex items-start">
      <AlertCircle className="w-3.5 h-3.5 mr-1 mt-0.5 shrink-0" />
      <span>{message}</span>
    </p>
  );
};

/**
 * Input classes with the error state applied.
 *
 * Usage:  <input className={inputClass(fieldErrors.email)} ... />
 *
 * Pass `base` to keep a form's own sizing while still picking up the error styling.
 */
export const inputClass = (error?: string, base = 'w-full px-3 py-2 rounded-lg border focus:ring-2 focus:border-transparent transition-colors') =>
  `${base} ${
    error
      ? 'border-red-400 bg-red-50 text-red-900 placeholder-red-400 focus:ring-red-500'
      : 'border-gray-300 focus:ring-red-500'
  }`;

/** Accessibility attributes to spread onto an input that has an error. */
export const errorProps = (id: string, error?: string) =>
  error ? { 'aria-invalid': true as const, 'aria-describedby': `${id}-error` } : {};

/**
 * Scrolls the first invalid input into view and focuses it.
 *
 * Long forms (registration, raising a request) can push the offending field off screen,
 * so the banner alone leaves the user hunting for it.
 */
export const focusFirstError = (fieldErrors: Record<string, string>) => {
  const first = Object.keys(fieldErrors)[0];
  if (!first) return;
  // Defer to the next frame so the error styling has been painted first.
  requestAnimationFrame(() => {
    const el = document.querySelector<HTMLElement>(`[name="${first}"], #${CSS.escape(first)}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    el.focus({ preventScroll: true });
  });
};
