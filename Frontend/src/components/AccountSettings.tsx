import React, { useEffect, useState } from 'react';
import { Gift, Copy, Check, KeyRound, Bell, Users as UsersIcon, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import {
  getMyReferral, changePassword, updateNotificationPreferences, getMe
} from '../utils/axios';
import { parseApiError, type NormalisedError } from '../utils/apiError';
import { ErrorBanner, SuccessBanner, FieldError } from './FormFeedback';

interface AccountSettingsProps {
  currentUser: any;
  onUserUpdated?: (user: any) => void;
}

/**
 * Account settings: invitation links, password changes and notification preferences.
 *
 * Two workflows from the synopsis live here:
 *  * 9.b.1 — "Users can also generate invitation links to expand the donor network
 *    through referrals."
 *  * Section 10 — "Users can manage their own security by changing their passwords."
 */
const AccountSettings: React.FC<AccountSettingsProps> = ({ currentUser, onUserUpdated }) => {
  return (
    <div className="space-y-6 max-w-3xl">
      <h1 className="text-2xl font-bold text-gray-900">Account settings</h1>
      <VerificationBanner currentUser={currentUser} />
      <ReferralPanel />
      <PasswordPanel />
      <PreferencesPanel currentUser={currentUser} onUserUpdated={onUserUpdated} />
    </div>
  );
};

// --- Verification status --------------------------------------------------

const VerificationBanner: React.FC<{ currentUser: any }> = ({ currentUser }) => {
  const [verified, setVerified] = useState<boolean | null>(currentUser?.isVerified ?? null);

  useEffect(() => {
    // The cookie copy of the user can be stale; confirm against the server.
    getMe().then((r: any) => setVerified(r.data.isVerified)).catch(() => { /* keep the cached value */ });
  }, []);

  if (verified !== false) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start">
      <ShieldCheck className="w-5 h-5 text-amber-600 mr-3 mt-0.5 shrink-0" />
      <div className="text-sm text-amber-900">
        <p className="font-medium">Your account is not verified yet.</p>
        <p className="mt-0.5">
          Sign out and back in to enter the code we sent you, or request a new one. Until then
          you cannot raise a donation request or volunteer to donate.
        </p>
      </div>
    </div>
  );
};

// --- Referrals ------------------------------------------------------------

const ReferralPanel: React.FC = () => {
  const [referral, setReferral] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getMyReferral()
      .then((r: any) => setReferral(r.data))
      .catch((err: any) => setError(parseApiError(err).message));
  }, []);

  const copy = async () => {
    if (!referral?.invitationLink) return;
    try {
      await navigator.clipboard.writeText(referral.invitationLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access needs a secure context; the link stays selectable either way.
      setError('Could not copy automatically — select the link and copy it manually.');
    }
  };

  return (
    <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center mb-1">
        <Gift className="w-5 h-5 text-red-600 mr-2" /> Invite a donor
      </h2>
      <p className="text-sm text-gray-600 mb-4">
        Share this link. Anyone who registers through it is recorded as your referral, which is
        how the donor network grows.
      </p>

      <ErrorBanner error={error} onDismiss={() => setError(null)} className="mb-3" />

      {referral ? (
        <>
          <div className="flex gap-2">
            <input readOnly value={referral.invitationLink} onFocus={(e) => e.target.select()}
              className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-mono text-gray-700" />
            <button onClick={copy}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center text-sm whitespace-nowrap">
              {copied ? <><Check className="w-4 h-4 mr-1.5" /> Copied</> : <><Copy className="w-4 h-4 mr-1.5" /> Copy link</>}
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            Your invitation code is <span className="font-mono font-medium">{referral.referralCode}</span> — it can also
            be typed on the registration form.
          </p>

          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-sm font-medium text-gray-900 flex items-center">
              <UsersIcon className="w-4 h-4 mr-2 text-gray-500" />
              {referral.referralCount} donor{referral.referralCount === 1 ? '' : 's'} joined through your link
            </p>
            {referral.referrals?.length > 0 && (
              <ul className="mt-2 space-y-1">
                {referral.referrals.slice(0, 5).map((r: any) => (
                  <li key={r._id} className="text-sm text-gray-600 flex justify-between">
                    <span>{r.firstName} {r.lastName}</span>
                    <span className="text-xs text-gray-400">{new Date(r.createdAt).toLocaleDateString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      ) : !error && <div className="h-10 bg-gray-100 rounded animate-pulse" />}
    </section>
  );
};

// --- Password -------------------------------------------------------------

const PasswordPanel: React.FC = () => {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<NormalisedError | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setFieldErrors({});

    if (next !== confirm) {
      setFieldErrors({ confirmPassword: 'The two passwords do not match' });
      return;
    }
    setSubmitting(true);
    try {
      await changePassword({ currentPassword: current, newPassword: next });
      setSuccess('Your password has been changed.');
      toast.success('Password changed.');
      setCurrent(''); setNext(''); setConfirm('');
    } catch (err: any) {
      const parsed = parseApiError(err);
      setError(parsed);
      // A rejected current password belongs on that input, not on the new one.
      if (parsed.status === 401) setFieldErrors({ currentPassword: 'This is not your current password' });
      else if (/different from the current/.test(parsed.message)) setFieldErrors({ newPassword: parsed.message });
      else if (/at least|must contain/.test(parsed.message)) setFieldErrors({ newPassword: parsed.message });
      else setFieldErrors(parsed.fieldErrors);
    } finally {
      setSubmitting(false);
    }
  };

  const fieldClass = (field: string) =>
    `w-full px-3 py-2 border rounded-lg focus:ring-2 focus:border-transparent ${
      fieldErrors[field] ? 'border-red-400 bg-red-50 focus:ring-red-500' : 'border-gray-300 focus:ring-red-500'
    }`;

  return (
    <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center mb-4">
        <KeyRound className="w-5 h-5 text-red-600 mr-2" /> Change your password
      </h2>
      <form onSubmit={submit} className="space-y-3 max-w-sm">
        <div>
          <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 mb-1">Current password</label>
          <input id="currentPassword" name="currentPassword" type="password" required value={current}
            onChange={(e) => setCurrent(e.target.value)} aria-invalid={Boolean(fieldErrors.currentPassword)}
            className={fieldClass('currentPassword')} />
          <FieldError message={fieldErrors.currentPassword} />
        </div>
        <div>
          <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 mb-1">New password</label>
          <input id="newPassword" name="newPassword" type="password" required value={next}
            onChange={(e) => setNext(e.target.value)} aria-invalid={Boolean(fieldErrors.newPassword)}
            className={fieldClass('newPassword')} />
          <FieldError message={fieldErrors.newPassword} />
          {!fieldErrors.newPassword && (
            <p className="text-xs text-gray-500 mt-1">At least 8 characters, including a letter and a number.</p>
          )}
        </div>
        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 mb-1">Confirm new password</label>
          <input id="confirmPassword" name="confirmPassword" type="password" required value={confirm}
            onChange={(e) => setConfirm(e.target.value)} aria-invalid={Boolean(fieldErrors.confirmPassword)}
            className={fieldClass('confirmPassword')} />
          <FieldError message={fieldErrors.confirmPassword} />
        </div>

        <ErrorBanner error={error} onDismiss={() => setError(null)} />
        <SuccessBanner message={success} onDismiss={() => setSuccess(null)} />

        <button type="submit" disabled={submitting}
          className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-60">
          {submitting ? 'Updating…' : 'Change password'}
        </button>
      </form>
    </section>
  );
};

// --- Notification preferences ---------------------------------------------

const PreferencesPanel: React.FC<{ currentUser: any; onUserUpdated?: (user: any) => void }> = ({ currentUser, onUserUpdated }) => {
  const [prefs, setPrefs] = useState({
    email: currentUser?.notificationPreferences?.email ?? true,
    sms: currentUser?.notificationPreferences?.sms ?? false,
    app: true
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const toggle = async (channel: 'email' | 'sms', value: boolean) => {
    const next = { ...prefs, [channel]: value };
    setPrefs(next);
    setSaving(true);
    setSaved(false);
    try {
      const response: any = await updateNotificationPreferences({ [channel]: value });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onUserUpdated?.({ ...currentUser, notificationPreferences: response.data.notificationPreferences });
    } catch (err: any) {
      // Put the switch back if the save failed, so the UI does not lie about the setting,
      // and say why — a silent revert looks like the toggle is broken.
      setPrefs(prefs);
      toast.error(parseApiError(err).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold text-gray-900 flex items-center mb-1">
        <Bell className="w-5 h-5 text-red-600 mr-2" /> How we contact you
      </h2>
      <p className="text-sm text-gray-600 mb-4">
        Urgent requests for your blood group always reach you in the app. Choose which other
        channels we may use.
      </p>

      <div className="space-y-3">
        <label className="flex items-center justify-between py-2">
          <span>
            <span className="text-sm font-medium text-gray-900 block">Email</span>
            <span className="text-xs text-gray-500">Request updates, donation confirmations and eligibility reminders</span>
          </span>
          <input type="checkbox" checked={prefs.email} onChange={(e) => toggle('email', e.target.checked)}
            className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500" />
        </label>

        <label className="flex items-center justify-between py-2 border-t border-gray-100">
          <span>
            <span className="text-sm font-medium text-gray-900 block">SMS</span>
            <span className="text-xs text-gray-500">
              Turn this on to receive every notification by text, not just urgent ones
            </span>
          </span>
          <input type="checkbox" checked={prefs.sms} onChange={(e) => toggle('sms', e.target.checked)}
            className="w-5 h-5 rounded border-gray-300 text-red-600 focus:ring-red-500" />
        </label>
      </div>

      {saving && <p className="text-xs text-gray-500 mt-3">Saving…</p>}
      {saved && <p className="text-xs text-green-600 mt-3 flex items-center"><Check className="w-3.5 h-3.5 mr-1" /> Saved</p>}
    </section>
  );
};

export default AccountSettings;
