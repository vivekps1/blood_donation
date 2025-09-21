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
    <div>
      {showRegister ? (
        <RegisterUser
          onRegister={async (data) => {
            const success = await onRegister(data);
            if (success) setShowRegister(false);
          }}
        />
      ) : (
        <Login
          onLogin={async (credentials) => {
            const success = await onLogin(credentials);
            if (success) setCurrentPage('dashboard');
          }}
          setCurrentPage={setCurrentPage}
        />
      )}
      <div className="text-center mt-4">
        <button
          className="text-red-600 underline"
          onClick={() => setShowRegister(!showRegister)}
        >
          {showRegister ? 'Already have an account? Login' : "Don't have an account? Register"}
        </button>
      </div>
    </div>
  );
};

export default AuthWrapper;