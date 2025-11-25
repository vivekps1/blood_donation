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
      const respData: any = response.data;
      // Support responses that either return the user directly or wrap it in a `user` field
      const userData: any = respData.user ?? respData;
      // token might be at top-level (respData.accessToken) or on the user object
      const token = userData.accessToken ?? respData.accessToken ?? respData.token ?? userData.token;

      setCurrentUser(userData);
      if (token) localStorage.setItem('token', token);
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
      const respData: any = response.data;
      const createdUser: any = respData.user ?? respData;
      const token = createdUser.accessToken ?? respData.accessToken ?? respData.token ?? createdUser.token;

      setCurrentUser(createdUser);
      setCurrentPage('users');
      if (token) localStorage.setItem('token', token);
      Cookies.set('user', JSON.stringify(createdUser), { expires: 7 });
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
        return <DonationRequests currentUser={currentUser} userRole={currentUser.userRole} />;
      case 'notifications':
        return <NotificationCenter currentUser={currentUser} />;
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
              bloodGroup: currentUser.bloodGroup || currentUser.bloodGroup || '',
              address: currentUser.address || '',
              adminEmail: currentUser.adminEmail || '',
              height: currentUser.height ?? currentUser?.profile?.height ?? '',
              weight: currentUser.weight ?? currentUser?.profile?.weight ?? '',
              dateofBirth: currentUser.dateofBirth || currentUser.dateOfBirth || '',
              role: currentUser.role || 'user',
              photo: currentUser.photo || '',
              healthReport: currentUser.healthReport || undefined,
            }}
            isOwnProfile={true}
            onUpdate={(data) => {
              setCurrentUser((prev:any) => {
                const updated = {
                  ...prev,
                  ...(data.firstName ? { firstName: data.firstName } : {}),
                  ...(data.lastName ? { lastName: data.lastName } : {}),
                  ...(data.phone ? { phoneNumber: data.phone } : {}),
                  ...(data.email ? { email: data.email } : {}),
                  ...(data.address ? { address: data.address } : {}),
                  ...(data.height ? { height: data.height } : {}),
                  ...(data.weight ? { weight: data.weight } : {}),
                  ...(data.dateofBirth ? { dateofBirth: data.dateofBirth } : {}),
                  ...(data.latitude ? { latitude: data.latitude } : {}),
                  ...(data.longitude ? { longitude: data.longitude } : {}),
                  ...(data.locationGeo ? { locationGeo: data.locationGeo } : {}),
                  ...(data.photo ? { photo: data.photo } : {}),
                  ...(data.locationName ? { locationName: data.locationName } : {}),
                };
                Cookies.set('user', JSON.stringify(updated), { expires: 7 });
                return updated;
              });
            }}
          />
        );
      case 'dashboard':
        return <Dashboard userRole={currentUser.userRole} setCurrentPage={setCurrentPage} />;
      default:
        return <Dashboard userRole={currentUser.userRole} setCurrentPage={setCurrentPage} />;
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