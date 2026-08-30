import React, { useState } from 'react';
import { ShieldCheck, Mail, RefreshCw, CheckCircle } from 'lucide-react';
import { verifyAccount, resendVerificationCode } from '../utils/axios';
import { parseApiError } from '../utils/apiError';

interface VerifyAccountProps {
  /** Shown so the user knows where the code was sent. */
  email?: string;
  /** Called once verification succeeds, with the refreshed user object. */
  onVerified: (user: any) => void;
  /** Lets the user carry on and verify later; hidden during the blocking flow. */
  onSkip?: () => void;
}

/**
 * Account verification.
 *
 * Synopsis 9.b.1: "The system generates a unique profile and sends verification via SMS
 * and email." Registration now issues a six-digit code over both channels; this screen
 * is where it is entered.
 */
const VerifyAccount: React.FC<VerifyAccountProps> = ({ email, onVerified, onSkip }) => {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (code.trim().length !== 6) {
      setStatus({ type: 'error', text: 'Enter the six-digit code from your email or SMS.' });
      return;
    }
    setSubmitting(true);
    setStatus(null);
    try {
      const response: any = await verifyAccount({ code: code.trim(), email });
      setStatus({ type: 'success', text: 'Your account is verified.' });
      // Brief pause so the confirmation is visible before the screen changes.
      setTimeout(() => onVerified(response.data?.user), 800);
    } catch (err: any) {
      const parsed = parseApiError(err);
      // The API counts down the remaining attempts before it locks the code; showing that
      // tells the user whether to retype or request a new one.
      const attemptsRemaining = err?.response?.data?.attemptsRemaining;
      setStatus({
        type: 'error',
        text: typeof attemptsRemaining === 'number'
          ? `${parsed.message} ${attemptsRemaining} attempt(s) remaining.`
          : parsed.message
      });
      // An expired or exhausted code cannot be retyped — clear it and point at Resend.
      if (['CODE_EXPIRED', 'TOO_MANY_ATTEMPTS'].includes(parsed.code || '')) setCode('');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setStatus(null);
    try {
      await resendVerificationCode({ email });
      setStatus({ type: 'success', text: 'A new code is on its way to your email and phone.' });
      setCode('');
    } catch (err: any) {
      setStatus({ type: 'error', text: parseApiError(err).message });
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 max-w-md w-full">
      <div className="flex items-center mb-4">
        <div className="w-10 h-10 bg-red-50 rounded-full flex items-center justify-center mr-3">
          <ShieldCheck className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Verify your account</h2>
          <p className="text-sm text-gray-600">
            We sent a six-digit code{email ? <> to <span className="font-medium">{email}</span></> : ' to your email and phone'}.
          </p>
        </div>
      </div>

      <form onSubmit={handleVerify} className="space-y-4">
        <div>
          <label htmlFor="verification-code" className="block text-sm font-medium text-gray-700 mb-1">
            Verification code
          </label>
          <input
            id="verification-code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            // Strip anything that is not a digit so a pasted code with spaces still works.
            onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); if (status?.type === 'error') setStatus(null); }}
            placeholder="000000"
            aria-invalid={status?.type === 'error'}
            className={`w-full px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono border rounded-lg focus:ring-2 focus:border-transparent ${
              status?.type === 'error'
                ? 'border-red-400 bg-red-50 text-red-900 focus:ring-red-500'
                : 'border-gray-300 focus:ring-red-500'
            }`}
          />
          <p className="text-xs text-gray-500 mt-1">The code expires 30 minutes after it was sent.</p>
        </div>

        {status && (
          <div
            role="status"
            className={`text-sm rounded-lg px-3 py-2 flex items-start ${
              status.type === 'error'
                ? 'bg-red-50 text-red-700 border border-red-200'
                : 'bg-green-50 text-green-700 border border-green-200'
            }`}
          >
            {status.type === 'success' && <CheckCircle className="w-4 h-4 mr-2 mt-0.5 shrink-0" />}
            <span>{status.text}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-red-600 text-white py-2.5 rounded-lg hover:bg-red-700 disabled:opacity-60 disabled:cursor-not-allowed font-medium"
        >
          {submitting ? 'Verifying…' : 'Verify account'}
        </button>
      </form>

      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
        <button
          type="button"
          onClick={handleResend}
          disabled={resending}
          className="text-sm text-red-600 hover:text-red-700 flex items-center disabled:opacity-60"
        >
          <RefreshCw className={`w-4 h-4 mr-1.5 ${resending ? 'animate-spin' : ''}`} />
          {resending ? 'Sending…' : 'Send a new code'}
        </button>
        {onSkip && (
          <button type="button" onClick={onSkip} className="text-sm text-gray-500 hover:text-gray-700">
            Verify later
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500 mt-4 flex items-start">
        <Mail className="w-3.5 h-3.5 mr-1.5 mt-0.5 shrink-0" />
        Until your account is verified you can browse the system, but you cannot raise a
        donation request or volunteer to donate.
      </p>
    </div>
  );
};

export default VerifyAccount;
