import React, { useState } from 'react';
import { loginUser, registerUser } from './utils/axios'; // Import the login and register APIs
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import UserManagement from './components/UserManagement';
import DonorManagement from './components/DonorManagement';
import DonationRequests from './components/DonationRequests';
import NotificationCenter from './components/NotificationCenter';
import Reports from './components/Reports';
import RegisterUser from './components/RegisterUser';

export interface LoginProps {
  onLogin: (credentials: any) => Promise<boolean>;
  setCurrentPage: React.Dispatch<React.SetStateAction<string>>;
}

function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Function to handle login using the API
  const handleLogin = async (credentials: any) => {
    try {
      const response = await loginUser(credentials);
      setCurrentUser(response.data);
      return true;
    } catch (error) {
      // Handle login error (e.g., show message)
      return false;
    }
  };

  // Function to handle user registration using the API
  const handleRegister = async (userData: any) => {
    try {
      const response = await registerUser(userData);
      // Optionally, you can log in the user or show a success message
      setCurrentUser(response.data);
      setCurrentPage('users'); // Navigate to users page after registration
      return true;
    } catch (error) {
      // Handle registration error (e.g., show message)
      return false;
    }
  };

  if (!currentUser) {
    return <Login onLogin={handleLogin} setCurrentPage = {setCurrentPage} />;
  }

  const renderContent = () => {
    switch (currentPage) {
      case 'users':
        return <UserManagement userRole={currentUser.role} />;
      case 'donors':
        return <DonorManagement userRole={currentUser.role} />;
      case 'requests':
        return <DonationRequests userRole={currentUser.role} />;
      case 'notifications':
        return <NotificationCenter userRole={currentUser.role} />;
      case 'reports':
        return <Reports userRole={currentUser.role} />;
      case 'register':
        return <RegisterUser onRegister={handleRegister} />;
      case 'dashboard':
        return <Dashboard userRole={currentUser.role} />;
      default:
        return <Dashboard userRole={currentUser.role} />;
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
        userRole={currentUser.role}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header
          onMenuClick={() => setSidebarOpen(true)}
          user={currentUser}
          onLogout={() => setCurrentUser(null)}
        />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-50 p-6">
          {renderContent()}
        </main>
      </div>
    </div>
  );
}

export default App;