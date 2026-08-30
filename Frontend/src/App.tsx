import React, { useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import toast from 'react-hot-toast';
import { loginUser, registerUser, SESSION_EXPIRED_EVENT } from './utils/axios';
import Dashboard from './components/Dashboard';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import { UserProfile } from './components/UserProfile';
import DonorManagement from './components/DonorManagement';
import DonationRequests from './components/DonationRequests';
import DonationHistory from './components/DonationHistory';
import NotificationCenter from './components/NotificationCenter';
import AuthWrapper from './components/AuthWrapper';
import { HospitalManagement } from './components/HospitalManagement';
import UserManagement from './components/UserManagement';
import BloodInventory from './components/BloodInventory';
import MedicalReports from './components/MedicalReports';
import Reports from './components/Reports';
import AccountSettings from './components/AccountSettings';
import VerifyAccount from './components/VerifyAccount';

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
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  // Set when the API reports the account still needs its emailed/texted code entered
  // (synopsis 9.b.1). Shown as a full-screen step immediately after registration and as a
  // dismissible banner after a normal sign-in.
  const [needsVerification, setNeedsVerification] = useState(false);
  const [verificationDismissed, setVerificationDismissed] = useState(false);

  const persistUser = (userData: any) => {
    setCurrentUser(userData);
    Cookies.set('user', JSON.stringify(userData), { expires: 7 });
  };

  const signOut = () => {
    setCurrentUser(null);
    localStorage.removeItem('token');
    Cookies.remove('user');
    setCurrentPage('dashboard');
  };

  // The axios interceptor raises this when the API rejects a call with 401 while a token
  // was held — the session expired, or an administrator deactivated the account. Without
  // it the user stays on a screen where every request silently fails.
  useEffect(() => {
    const handleExpiry = () => {
      toast.error('Your session has ended. Please sign in again.', { id: 'session-expired' });
      signOut();
    };
    window.addEventListener(SESSION_EXPIRED_EVENT, handleExpiry);
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, handleExpiry);
  }, []);

  // Function to handle login using the API
  const handleLogin = async (credentials: any) => {
    const response = await loginUser(credentials);
    const respData: any = response.data;
    // Support responses that either return the user directly or wrap it in a `user` field
    const userData: any = respData.user ?? respData;
    // token might be at top-level (respData.accessToken) or on the user object
    const token = userData.accessToken ?? respData.accessToken ?? respData.token ?? userData.token;

    if (token) localStorage.setItem('token', token);
    persistUser(userData);
    setNeedsVerification(Boolean(respData.verificationRequired));
    setVerificationDismissed(false);
    return true;
  };

  // Function to handle user registration using the API
  const handleRegister = async (userData: any) => {
    const response: any = await registerUser(userData);
    const respData: any = response.data;
    const createdUser: any = respData.user ?? respData;
    const token = createdUser.accessToken ?? respData.accessToken ?? respData.token ?? createdUser.token;

    if (token) localStorage.setItem('token', token);
    persistUser(createdUser);
    setCurrentPage('dashboard');
    // A freshly registered account always has a code waiting, so the verification step is
    // shown before anything else.
    setNeedsVerification(true);
    setVerificationDismissed(false);
    return true;
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

  const userRole = currentUser.userRole || currentUser.role || 'donor';
  const userId = currentUser._id || currentUser.id;

  // Straight after registration the verification step is the whole screen, so the code is
  // entered while it is fresh. It can be deferred, after which it becomes a banner.
  if (needsVerification && !verificationDismissed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
        <VerifyAccount
          email={currentUser.email}
          onVerified={(updated) => {
            setNeedsVerification(false);
            if (updated) persistUser({ ...currentUser, ...updated });
          }}
          onSkip={() => setVerificationDismissed(true)}
        />
      </div>
    );
  }

  const renderContent = () => {
    switch (currentPage) {
      case 'hospital':
        return <HospitalManagement />;
      case 'users':
        return <UserManagement userRole={userRole} currentUserId={userId} />;
      case 'inventory':
        return <BloodInventory userRole={userRole} />;
      case 'medicalreports':
        return <MedicalReports userRole={userRole} userId={userId} />;
      case 'reports':
        return <Reports />;
      case 'settings':
        return <AccountSettings currentUser={currentUser} onUserUpdated={persistUser} />;
      case 'donors':
        return <DonorManagement userRole={currentUser.userRole} />;
      case 'requests':
        return <DonationRequests currentUser={currentUser} userRole={currentUser.userRole} />;
      case 'notifications':
        return <NotificationCenter currentUser={currentUser} />;
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
          onLogout={() => setShowLogoutModal(true)}
          onProfileClick={() => setCurrentPage('profile')}
        />
        <main className={`flex-1 overflow-x-hidden ${currentPage === 'profile' ? '' : 'overflow-y-auto'} bg-gray-50 p-6`}>
          {needsVerification && verificationDismissed && (
            <div className="mb-6 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 flex items-center justify-between gap-3">
              <p className="text-sm text-amber-900">
                Your account is not verified, so you cannot raise a request or volunteer to donate yet.
              </p>
              <button
                onClick={() => setVerificationDismissed(false)}
                className="px-3 py-1.5 bg-amber-600 text-white rounded-lg hover:bg-amber-700 text-sm whitespace-nowrap"
              >
                Enter code
              </button>
            </div>
          )}
          {renderContent()}
        </main>
      </div>

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">Confirm Logout</h2>
            <p className="text-gray-600 mb-6">Are you sure you want to logout?</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowLogoutModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  signOut();
                  setShowLogoutModal(false);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;