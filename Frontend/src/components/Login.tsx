import React, { useState } from 'react';
import { Lock, User, Activity } from 'lucide-react';

interface LoginProps {
  onLogin: (user: any) => void;
  setCurrentPage: (page: any) => void;
  setShowRegister: (show: boolean) => void;
  showRegister: boolean;
}

const Login: React.FC<LoginProps> = ({ onLogin, setCurrentPage, setShowRegister, showRegister }) => {
  const [credentials, setCredentials] = useState({ username: '', password: '', role: 'donor' });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const userTypes = [
    { id: 'donor', name: 'Donor', icon: User },
    { id: 'admin', name: 'Administrator', icon: Lock }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      await onLogin({ email: credentials.username, role: credentials.role, password: credentials.password });
    } catch (err: any) {
      console.log('Login error caught:', err);
      console.log('Error response:', err?.response);
      console.log('Error response data:', err?.response?.data);
      let msg = 'Login failed';
      if (err && err.response && err.response.data) {
        if (err.response.data.msg) {
          msg = err.response.data.msg;
        } else {
          msg = typeof err.response.data === 'string' ? err.response.data : err.response.data.error || 'Login failed';
        }
      }
      console.log('Final error message:', msg);
      setErrorMsg(msg);
      setTimeout(() => {
        setErrorMsg(null);
      }, 5000);
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
                type="text"
                placeholder="Email"
                value={credentials.username}
                onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <input
                type="password"
                placeholder="Password"
                value={credentials.password}
                onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                required
              />
            </div>

            {errorMsg && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-start">
                <svg className="w-5 h-5 mr-2 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <span className="text-sm">{errorMsg}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              Sign In
            </button>
            <div className="text-center mt-4">
              <button
                className="text-red-600 underline"
                onClick={() => setShowRegister(!showRegister)}
              >
                {showRegister ? 'Already have an account? Login' : "Don't have an account? Register"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Login;
