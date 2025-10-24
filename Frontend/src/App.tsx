import React, { useState } from 'react';
import Cookies from 'js-cookie';
import { loginUser, registerUser } from './utils/axios'; // Import the login and register APIs
import Dashboard from './components/Dashboard';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { UserProfile } from './components/UserProfile';
import DonorManagement from './components/DonorManagement';
import DonationRequests from './components/DonationRequests';
import DonationHistory from './components/DonationHistory';
import NotificationCenter from './components/NotificationCenter';
import Reports from './components/Reports';
import AuthWrapper from './components/AuthWrapper';
import { HospitalManagement } from './components/HospitalManagement';

export interface LoginProps {
  onLogin: (credentials: any) => Promise<boolean>;
  setCurrentPage: React.Dispatch<React.SetStateAction<string>>;
}

function App() {
  const [currentUser, setCurrentUser] = useState<any>(() => {
    const userCookie = Cookies.get('user');
    return userCookie ? JSON.parse(userCookie) : null;
  });
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Function to handle login using the API
  const handleLogin = async (credentials: any) => {
    try {
      const response = await loginUser(credentials);
      const userData: any = response.data;
      setCurrentUser(userData);
      localStorage.setItem('token', userData.accessToken);
      Cookies.set('user', JSON.stringify(userData), { expires: 7 });
      return true;
    } catch (error) {
      return false;
    }
  };

  // Function to handle user registration using the API
  const handleRegister = async (userData: any) => {
    try {
      const response: any = await registerUser(userData);
      setCurrentUser(response.data);
      setCurrentPage('users');
      localStorage.setItem('token', response.data.accessToken);
      Cookies.set('user', JSON.stringify(response.data), { expires: 7 });
      return true;
    } catch (error) {
      return false;
    }
  };

  if (!currentUser) {
    return (
      <AuthWrapper
        onLogin={handleLogin}
        onRegister={handleRegister}
        setCurrentPage={setCurrentPage}
      />
    );
  }

  const renderContent = () => {
    switch (currentPage) {
      case 'hospital':
        return <HospitalManagement />;
      case 'donors':
        return <DonorManagement userRole={currentUser.userRole} />;
      case 'requests':
        return <DonationRequests userRole={currentUser.userRole} />;
      case 'notifications':
        return <NotificationCenter userRole={currentUser.userRole} />;
      case 'reports':
        return <Reports userRole={currentUser.userRole} />;
      case 'donationhistory':
        return (
          <DonationHistory
            userRole={currentUser.userRole || currentUser.role}
            userId={currentUser._id || currentUser.id}
          />
        );
      case 'profile':
        return (
          <UserProfile
            user={{
              id: currentUser._id || currentUser.id,
              firstName: currentUser.firstName || '',
              lastName: currentUser.lastName || '',
              email: currentUser.email || '',
              phone: currentUser.phoneNumber || currentUser.phone || '',
              role: currentUser.role || 'user',
              photo: currentUser.photo || '',
              healthReport: currentUser.healthReport || undefined,
            }}
            isOwnProfile={true}
            onUpdate={(data) => {
              setCurrentUser((prev:any) => ({
                ...prev,
                ...(data.firstName ? { firstName: data.firstName } : {}),
                ...(data.lastName ? { lastName: data.lastName } : {}),
                ...(data.phone ? { phoneNumber: data.phone } : {}),
                ...(data.email ? { email: data.email } : {}),
              }));
            }}
          />
        );
      case 'dashboard':
        return <Dashboard userRole={currentUser.userRole} />;
      default:
        return <Dashboard userRole={currentUser.userRole} />;
    }
  };

  console.log('Current Page:', currentPage);
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        userRole={currentUser.userRole} 
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          user={currentUser}
          onLogout={() => {
            setCurrentUser(null);
            localStorage.removeItem('token');
            Cookies.remove('user');
          }}
          onProfileClick={() => setCurrentPage('profile')}
        />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-6">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

export default App;