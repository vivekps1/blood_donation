import React, { useState } from 'react';
import RegisterUser from './RegisterUser';
import Login from './Login';

interface AuthWrapperProps {
  onLogin: (credentials: any) => Promise<boolean>;
  onRegister: (data: any) => Promise<boolean>;
  setCurrentPage: React.Dispatch<React.SetStateAction<string>>;
}

const AuthWrapper: React.FC<AuthWrapperProps> = ({ onLogin, onRegister, setCurrentPage }) => {
  const [showRegister, setShowRegister] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showErrorPopup, setShowErrorPopup] = useState(false);
  const [loadingError, setLoadingError] = useState(false);

  // Error popup logic
  const triggerErrorPopup = (msg: string) => {
    setErrorMsg(msg);
    setShowErrorPopup(true);
    setLoadingError(true);
    setTimeout(() => {
      setShowErrorPopup(false);
      setLoadingError(false);
    }, 5000);
  };

  return (
    <div className="relative">
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
      {showRegister ? (
        <RegisterUser
          onRegister={async (data) => {
            try {
              const success = await onRegister(data);
              if (success) setShowRegister(false);
            } catch (err: any) {
              let msg = 'Registration failed';
              if (err && err.response && err.response.data) {
                if (err.response.data.msg) {
                  msg = err.response.data.msg;
                } else {
                  msg = typeof err.response.data === 'string' ? err.response.data : err.response.data.error || 'Registration failed';
                }
              }
              triggerErrorPopup(msg);
            }
          }}
          setShowRegister={setShowRegister}
          showRegister={showRegister}
        />
      ) : (
        <Login
          onLogin={async (credentials) => {
            try {
              const success = await onLogin(credentials);
              if (success) setCurrentPage('dashboard');
            } catch (err: any) {
              let msg = 'Login failed';
              if (err && err.response && err.response.data) {
                if (err.response.data.msg) {
                  msg = err.response.data.msg;
                } else {
                  msg = typeof err.response.data === 'string' ? err.response.data : err.response.data.error || 'Login failed';
                }
              }
              triggerErrorPopup(msg);
            }
          }}
          setCurrentPage={setCurrentPage}
          setShowRegister={setShowRegister}
          showRegister={showRegister}
        />
      )}
    </div>
  );
};

export default AuthWrapper;