import  React, { useState } from 'react';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import  UserManagement from './components/UserManagement';
import DonorManagement from './components/DonorManagement';
import DonationRequests from './components/DonationRequests';
import NotificationCenter from './components/NotificationCenter';
import Reports from './components/Reports';
 

function App() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (!currentUser) {
    return <Login onLogin={setCurrentUser} />;
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
      default:
        return <Dashboard userRole={currentUser.role} />;
    }
  };
 

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