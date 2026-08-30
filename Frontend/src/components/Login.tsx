import React, { useState } from 'react';
import { Lock, User, Activity } from 'lucide-react';
import { parseApiError, type NormalisedError } from '../utils/apiError';
import { ErrorBanner, FieldError } from './FormFeedback';

interface LoginProps {
  onLogin: (user: any) => void;
  setCurrentPage: (page: any) => void;
  setShowRegister: (show: boolean) => void;
  showRegister: boolean;
  /** Opens the password recovery flow. */
  onForgotPassword: () => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, setCurrentPage, setShowRegister, showRegister, onForgotPassword }) => {
  const [credentials, setCredentials] = useState({ username: '', password: '', role: 'donor' });
  const [error, setError] = useState<NormalisedError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Which input to highlight for a given sign-in failure. The API deliberately does not
  // say whether the address or the password was wrong — that would let anyone probe which
  // emails are registered — so a rejected credential flags both.
  const highlight = (): Record<string, boolean> => {
    if (!error) return {};
    if (error.fieldErrors.email || error.fieldErrors.password) {
      return { email: Boolean(error.fieldErrors.email), password: Boolean(error.fieldErrors.password) };
    }
    if (error.status === 401) return { email: true, password: true };
    return {};
  };

  const userTypes = [
    { id: 'donor', name: 'Donor', icon: User },
    { id: 'admin', name: 'Administrator', icon: Lock }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onLogin({ email: credentials.username, role: credentials.role, password: credentials.password });
    } catch (err: any) {
      // The banner no longer disappears on a timer: a sign-in failure the user did not
      // manage to read is a failure they cannot act on.
      setError(parseApiError(err, { email: 'email', password: 'password' }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4 relative">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Activity className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Blood Donation System</h1>
            <p className="text-gray-600 mt-2">Saving lives, one donation at a time</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-2 gap-2 mb-6">
              {userTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => {
                    if (type.id === 'register') {
                      setCurrentPage('register');
                    } else {
                      setCredentials({ ...credentials, role: type.id });
                    }
                  }}
                  className={`p-3 rounded-lg border-2 transition-all ${credentials.role === type.id
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <type.icon className="w-5 h-5 mx-auto mb-1" />
                  <div className="text-xs font-medium">{type.name}</div>
                </button>
              ))}
            </div>

            <div>
              <input
                id="email"
                name="email"
                type="email"
                placeholder="Email"
                value={credentials.username}
                onChange={(e) => { setCredentials({ ...credentials, username: e.target.value }); setError(null); }}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:border-transparent ${
                  highlight().email ? 'border-red-400 bg-red-50 focus:ring-red-500' : 'border-gray-300 focus:ring-red-500'
                }`}
                aria-invalid={Boolean(highlight().email)}
                autoComplete="email"
                required
              />
              <FieldError message={error?.fieldErrors.email} />
            </div>

            <div>
              <input
                type="password"
                id="password"
                name="password"
                placeholder="Password"
                value={credentials.password}
                onChange={(e) => { setCredentials({ ...credentials, password: e.target.value }); setError(null); }}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:border-transparent ${
                  highlight().password ? 'border-red-400 bg-red-50 focus:ring-red-500' : 'border-gray-300 focus:ring-red-500'
                }`}
                aria-invalid={Boolean(highlight().password)}
                autoComplete="current-password"
                required
              />
              <FieldError message={error?.fieldErrors.password} />
            </div>

            <ErrorBanner error={error} onDismiss={() => setError(null)} />

            {/* A wrong-role sign-in is a common mistake with two role buttons on screen. */}
            {error?.message?.includes("You're not") && (
              <p className="text-sm text-gray-600 -mt-3">
                Check the role selected above — an account can only sign in under its own role.
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? 'Signing in…' : 'Sign In'}
            </button>
            <div className="text-center mt-4 space-y-2">
              <button
                type="button"
                className="text-red-600 underline block w-full"
                onClick={() => setShowRegister(!showRegister)}
              >
                {showRegister ? 'Already have an account? Login' : "Don't have an account? Register"}
              </button>
              {/* type="button" matters here: inside a form, a bare button submits it. */}
              <button
                type="button"
                className="text-sm text-gray-600 hover:text-gray-900 underline"
                onClick={onForgotPassword}
              >
                Forgot your password?
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
