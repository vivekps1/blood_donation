import  React from 'react';
import { Menu, Bell, User, LogOut } from 'lucide-react';

interface HeaderProps {
  onMenuClick: () => void;
  user: any;
  onLogout: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick, user, onLogout }) => {
  return (
    <header className="bg-white shadow-sm border-b border-gray-200 h-16 flex items-center justify-between px-6">
      <div className="flex items-center space-x-4">
        <button
          onClick={onMenuClick}
          className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-xl font-semibold text-gray-900 capitalize">
          Welcome, {user.username}
        </h1>
      </div>

      <div className="flex items-center space-x-4">
        <button className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 relative">
          <Bell className="w-5 h-5" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
        </button>
        
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-gray-600" />
          </div>
          <div className="hidden md:block">
            <div className="text-sm font-medium text-gray-900">{user.username}</div>
            <div className="text-xs text-gray-500 capitalize">{user.role}</div>
          </div>
        </div>

        <button
          onClick={onLogout}
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </header>
  );
};

export default Header;
 