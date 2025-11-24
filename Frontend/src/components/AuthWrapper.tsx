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

  return (
    <div className="relative">
      {showRegister ? (
        <RegisterUser
          onRegister={async (data) => {
            try {
              const success = await onRegister(data);
              if (success) setShowRegister(false);
              return true;
            } catch (err: any) {
              throw err; // rethrow so child can set field errors
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
              // Login error handling
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