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
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [loadingError, setLoadingError] = useState(false);

  const userTypes = [
    { id: 'donor', name: 'Donor', icon: User },
    { id: 'admin', name: 'Administrator', icon: Lock }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setShowErrorPopup(false);
    setLoadingError(false);
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
      setShowErrorPopup(true);
      setLoadingError(true);
      setTimeout(() => {
        setShowErrorPopup(false);
        setLoadingError(false);
      }, 5000);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4 relative">
      {/* Error Popup Overlay */}
      {showErrorPopup && (
        <div className="fixed inset-0 flex items-center justify-center z-[9999]">
          <div className="bg-white border border-red-400 rounded-lg shadow-lg p-6 flex flex-col items-center relative min-w-[300px]">
            <button
              className="absolute top-2 right-2 text-red-600 hover:text-red-800 text-lg font-bold"
              onClick={() => { setShowErrorPopup(false); setLoadingError(false); }}
            >
              &times;
            </button>
            <div className="flex items-center space-x-3">
              <span className="text-red-600 font-semibold">{errorMsg}</span>
              {loadingError && (
                <span className="ml-2 animate-spin inline-block w-5 h-5 border-2 border-red-400 border-t-transparent rounded-full"></span>
              )}
            </div>
            <div className="mt-2 text-xs text-gray-400">This popup will close automatically in 5 seconds.</div>
          </div>
        </div>
      )}
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
                  className={`p-3 rounded-lg border-2 transition-all ${
                    credentials.role === type.id
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
