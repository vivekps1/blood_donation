import  React from 'react';
import { Home, Users, Activity, LogOut, X, Bell, Cross, Droplet, FileText, BarChart3, Settings, UserCog } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  currentPage: string;
  setCurrentPage: (page: string) => void;
  userRole: string;
}

interface MenuItem {
  id: string;
  name: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Roles that may see this item. Omitted means everyone. */
  roles?: string[];
}

// The navigation is driven by role rather than by an "everything unless donor" rule, so a
// new role (hospital staff) gets the right menu without editing the filter each time.
const MENU_ITEMS: MenuItem[] = [
  { id: 'dashboard', name: 'Dashboard', icon: Home },
  { id: 'requests', name: 'Donation Requests', icon: Activity },
  { id: 'donationhistory', name: 'Donation History', icon: Droplet },
  { id: 'inventory', name: 'Blood Inventory', icon: Droplet },
  { id: 'medicalreports', name: 'Medical Reports', icon: FileText },
  { id: 'notifications', name: 'Notifications', icon: Bell },
  { id: 'hospital', name: 'Hospitals', icon: Cross, roles: ['admin', 'hospital'] },
  { id: 'donors', name: 'Donors', icon: Users, roles: ['admin', 'hospital'] },
  { id: 'users', name: 'User Management', icon: UserCog, roles: ['admin'] },
  { id: 'reports', name: 'Reports', icon: BarChart3, roles: ['admin', 'hospital'] },
  { id: 'settings', name: 'Account Settings', icon: Settings }
];

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, currentPage, setCurrentPage, userRole }) => {
  const role = userRole || 'donor';
  const filteredItems = MENU_ITEMS.filter(item => !item.roles || item.roles.includes(role));

  return (
    <>
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 lg:hidden" onClick={onClose} />
      )}

      <div className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
        flex flex-col
      `}>
        <div className="flex items-center justify-between h-16 px-6 border-b border-gray-200 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center">
              <Activity className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold text-gray-900">BloodDMS</span>
          </div>
          <button onClick={onClose} className="lg:hidden" aria-label="Close menu">
            <X className="w-6 h-6 text-gray-500" />
          </button>
        </div>

        {/* The menu is longer than it was, so it scrolls independently of the page. */}
        <nav className="mt-6 px-3 flex-1 overflow-y-auto pb-6">
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
              <item.icon className="w-5 h-5 shrink-0" />
              <span className="font-medium text-left">{item.name}</span>
            </button>
          ))}
        </nav>
      </div>
    </>
  );
};

export default Sidebar;
