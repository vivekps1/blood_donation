import  React from 'react';
import  { Home, Users, Activity, Database, Settings, LogOut, X, Bell, Building, Cross, Droplet } from 'lucide-react';
 

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: string;
  setCurrentPage: (page: string) => void;
  userRole: string;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, currentPage, setCurrentPage, userRole }) => {
   const menuItems = [
    { id: 'dashboard', name: 'Dashboard', icon: Home },
    { id: 'hospital', name: 'Hospital', icon: Cross },
    { id: 'donors', name: 'Donors', icon: Users },
    {id: 'donationhistory', name: 'Donation History', icon: Droplet},
    { id: 'requests', name: 'Donation Requests', icon: Activity },
    { id: 'notifications', name: 'Notifications', icon: Bell },
  ];
 

   const filteredItems = menuItems.filter(item => {
    console.log(userRole);
    if (userRole === 'donor') return ['dashboard', 'donationhistory','requests', 'notifications'].includes(item.id);
    return true;
  });
 

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 lg:hidden" onClick={onClose} />
      )}
      
      <div className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">BloodDMS</span>
          </div>
          <button onClick={onClose} className="lg:hidden">
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        <nav className="mt-6 px-3">
          {filteredItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setCurrentPage(item.id);
                onClose();
              }}
              className={`w-full flex items-center space-x-3 px-3 py-3 rounded-lg mb-1 transition-colors ${
                currentPage === item.id
                  ? 'bg-red-50 text-red-700 border-r-2 border-red-600'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              <item.icon className="w-5 h-5" />
              <span className="font-medium">{item.name}</span>
            </button>
          ))}
        </nav>
      </div>
    </>
  );
};

export default Sidebar;
 