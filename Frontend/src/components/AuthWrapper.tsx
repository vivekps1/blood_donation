import React, { useEffect, useState } from 'react';
import RegisterUser from './RegisterUser';
import Login from './Login';
import ForgotPassword from './ForgotPassword';

interface AuthWrapperProps {
  onLogin: (credentials: any) => Promise<boolean>;
  onRegister: (data: any) => Promise<boolean>;
  setCurrentPage: React.Dispatch<React.SetStateAction<string>>;
}

type Screen = 'login' | 'register' | 'forgot';

const AuthWrapper: React.FC<AuthWrapperProps> = ({ onLogin, onRegister, setCurrentPage }) => {
  const [screen, setScreen] = useState<Screen>('login');
  const [referralCode, setReferralCode] = useState<string | null>(null);

  // Invitation links look like /register?ref=A1B2C3D4 (synopsis 9.b.1). Arriving on one
  // opens the registration form with the code already filled in.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref) {
      setReferralCode(ref.toUpperCase());
      setScreen('register');
    }
  }, []);

  if (screen === 'forgot') {
    return <ForgotPassword onBackToLogin={() => setScreen('login')} />;
  }

  if (screen === 'register') {
    return (
      <RegisterUser
        onRegister={async (data) => {
          // Rethrow so the form can map field errors onto its inputs.
          await onRegister(data);
          return true;
        }}
        setShowRegister={(show: boolean) => setScreen(show ? 'register' : 'login')}
        showRegister
        referralCode={referralCode}
      />
    );
  }

  return (
    <Login
      onLogin={async (credentials) => {
        const success = await onLogin(credentials);
        if (success) setCurrentPage('dashboard');
      }}
      setCurrentPage={setCurrentPage}
      setShowRegister={(show: boolean) => setScreen(show ? 'register' : 'login')}
      showRegister={false}
      onForgotPassword={() => setScreen('forgot')}
    />
  );
};

export default AuthWrapper;
