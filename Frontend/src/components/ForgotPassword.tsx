import React, { useState } from 'react';
import { KeyRound, ArrowLeft, CheckCircle } from 'lucide-react';
import { forgotPassword, resetPassword } from '../utils/axios';
import { parseApiError, type NormalisedError } from '../utils/apiError';
import { ErrorBanner, FieldError } from './FormFeedback';

interface ForgotPasswordProps {
  onBackToLogin: () => void;
}

/**
 * Password recovery.
 *
 * Synopsis section 10 states that users "can manage their own security by changing their
 * passwords". No recovery path existed, so a forgotten password meant an administrator
 * had to edit the database. Two steps: request a code, then set a new password with it.
 */
const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onBackToLogin }) => {
  const [step, setStep] = useState<'request' | 'reset' | 'done'>('request');
  const [email, setEmail] = useState('');
  const [token, setToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<NormalisedError | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const fieldClass = (field: string) =>
    `w-full px-4 py-2 border rounded-lg focus:ring-2 focus:border-transparent ${
      fieldErrors[field] ? 'border-red-400 bg-red-50 focus:ring-red-500' : 'border-gray-300 focus:ring-red-500'
    }`;

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const response: any = await forgotPassword(email.trim());
      // The API deliberately answers identically whether or not the address is
      // registered, so this message must not claim the account exists.
      setNotice(response.data?.msg || 'If that email is registered, a reset code has been sent to it.');
      setStep('reset');
    } catch (err: any) {
      const parsed = parseApiError(err);
      setError(parsed);
      setFieldErrors(parsed.fieldErrors);
    } finally {
      setSubmitting(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    if (newPassword !== confirmPassword) {
      setFieldErrors({ confirmPassword: 'The two passwords do not match' });
      return;
    }
    setSubmitting(true);
    try {
      await resetPassword({ email: email.trim(), token: token.trim(), newPassword });
      setStep('done');
    } catch (err: any) {
      const parsed = parseApiError(err);
      setError(parsed);
      // An invalid or expired code belongs on the code input; a policy failure on the
      // password input.
      if (/reset code/i.test(parsed.message)) setFieldErrors({ token: parsed.message });
      else if (/at least|must contain/i.test(parsed.message)) setFieldErrors({ newPassword: parsed.message });
      else setFieldErrors(parsed.fieldErrors);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-xl p-8">
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <KeyRound className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">
            {step === 'done' ? 'Password updated' : 'Reset your password'}
          </h1>
        </div>

        {step === 'request' && (
          <form onSubmit={handleRequest} className="space-y-4">
            <p className="text-sm text-gray-600">
              Enter the email address on your account and we will send you a reset code.
            </p>
            <div>
              <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 mb-1">Email address</label>
              <input
                id="email" name="email" type="email" required value={email}
                onChange={(e) => { setEmail(e.target.value); setFieldErrors({}); }}
                aria-invalid={Boolean(fieldErrors.email)}
                className={fieldClass('email')} placeholder="you@example.com"
              />
              <FieldError message={fieldErrors.email} />
            </div>
            <ErrorBanner error={error} onDismiss={() => setError(null)} />
            <button type="submit" disabled={submitting}
              className="w-full bg-red-600 text-white py-2.5 rounded-lg hover:bg-red-700 disabled:opacity-60 font-medium">
              {submitting ? 'Sending…' : 'Send reset code'}
            </button>
          </form>
        )}

        {step === 'reset' && (
          <form onSubmit={handleReset} className="space-y-4">
            {notice && <p className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">{notice}</p>}
            <div>
              <label htmlFor="reset-token" className="block text-sm font-medium text-gray-700 mb-1">Reset code</label>
              <input
                id="token" name="token" type="text" inputMode="numeric" maxLength={6} required value={token}
                onChange={(e) => { setToken(e.target.value.replace(/\D/g, '')); setFieldErrors({}); }}
                aria-invalid={Boolean(fieldErrors.token)}
                className={`${fieldClass('token')} text-center tracking-[0.4em] font-mono`} placeholder="000000"
              />
              <FieldError message={fieldErrors.token} />
            </div>
            <div>
              <label htmlFor="new-password" className="block text-sm font-medium text-gray-700 mb-1">New password</label>
              <input
                id="newPassword" name="newPassword" type="password" required value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); setFieldErrors({}); }}
                aria-invalid={Boolean(fieldErrors.newPassword)}
                className={fieldClass('newPassword')} placeholder="At least 8 characters"
              />
              <FieldError message={fieldErrors.newPassword} />
              {!fieldErrors.newPassword && (
                <p className="text-xs text-gray-500 mt-1">At least 8 characters, including a letter and a number.</p>
              )}
            </div>
            <div>
              <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
              <input
                id="confirmPassword" name="confirmPassword" type="password" required value={confirmPassword}
                onChange={(e) => { setConfirmPassword(e.target.value); setFieldErrors({}); }}
                aria-invalid={Boolean(fieldErrors.confirmPassword)}
                className={fieldClass('confirmPassword')}
              />
              <FieldError message={fieldErrors.confirmPassword} />
            </div>
            <ErrorBanner error={error} onDismiss={() => setError(null)} />
            <button type="submit" disabled={submitting}
              className="w-full bg-red-600 text-white py-2.5 rounded-lg hover:bg-red-700 disabled:opacity-60 font-medium">
              {submitting ? 'Updating…' : 'Set new password'}
            </button>
            <button type="button" onClick={() => { setStep('request'); setError(null); }}
              className="w-full text-sm text-gray-500 hover:text-gray-700">
              Use a different email address
            </button>
          </form>
        )}

        {step === 'done' && (
          <div className="text-center space-y-4">
            <CheckCircle className="w-12 h-12 text-green-600 mx-auto" />
            <p className="text-sm text-gray-600">
              Your password has been updated. You can now sign in with your new password.
            </p>
            <button onClick={onBackToLogin}
              className="w-full bg-red-600 text-white py-2.5 rounded-lg hover:bg-red-700 font-medium">
              Back to sign in
            </button>
          </div>
        )}

        {step !== 'done' && (
          <button onClick={onBackToLogin}
            className="w-full mt-4 pt-4 border-t border-gray-100 text-sm text-gray-600 hover:text-gray-900 flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Back to sign in
          </button>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
