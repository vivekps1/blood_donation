import React, { useState } from 'react';
import { Lock, User, Activity } from 'lucide-react';

interface LoginProps {
  onLogin: (user: any) => void;
  setCurrentPage: (page: any) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin, setCurrentPage }) => {
  const [credentials, setCredentials] = useState({ username: '', password: '', role: 'donor' });

  const userTypes = [
    { id: 'donor', name: 'Donor', icon: User },
    { id: 'hospital', name: 'Hospital Staff', icon: Activity },
    { id: 'admin', name: 'Administrator', icon: Lock },
    {id: 'register', name:'Register', icon:User}
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onLogin({ email: credentials.username, role: credentials.role, password: credentials.password });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-white rounded-lg shadow-xl p-8">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Activity className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Blood Donation System</h1>
            <p className="text-gray-600 mt-2">Saving lives, one donation at a time</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-3 gap-2 mb-6">
              {userTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => {
                    if (type.id === 'register') {
                      setCurrentPage('register');
                    } else {
                      setCredentials({ ...credentials, role: type.id });
                    }
                  }}
                  className={`p-3 rounded-lg border-2 transition-all ${
                    credentials.role === type.id
                      ? 'border-red-500 bg-red-50 text-red-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <type.icon className="w-5 h-5 mx-auto mb-1" />
                  <div className="text-xs font-medium">{type.name}</div>
                </button>
              ))}
            </div>

            <div>
              <input
                type="text"
                placeholder="Username"
                value={credentials.username}
                onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <input
                type="password"
                placeholder="Password"
                value={credentials.password}
                onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                required
              />
            </div>

            <button
              type="submit"
              className="w-full bg-red-600 text-white py-3 px-4 rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              Sign In
            </button>
          </form>

          <div className="mt-4 text-center">
            <button
              onClick={() => setCurrentPage('register')}
              className="text-red-600 hover:underline"
            >
              Register
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
