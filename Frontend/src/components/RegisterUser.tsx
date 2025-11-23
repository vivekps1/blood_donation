import  React, { useState, useEffect } from 'react';
import { User, Mail, Lock, Phone, MapPin, Eye, EyeOff } from 'lucide-react';

interface LoginData {
  email: string;
  password: string;
}

interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  address: string;
  bloodType: string;
}

export default function RegisterUser({
  onRegister,
  setShowRegister,
  showRegister
}: {
  onRegister?: (data: RegisterData) => void;
  setShowRegister: (show: boolean) => void;
  showRegister: boolean;
}) {
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loginData, setLoginData] = useState<LoginData>({ email: '', password: '' });
  const [registerData, setRegisterData] = useState<RegisterData>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    address: '',
    bloodType: ''
  });

  const initialRegisterData: RegisterData = {
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    address: '',
    bloodType: ''
  };

  // Clear/reset the register form whenever the Register view is shown
  useEffect(() => {
    if (showRegister) {
      setRegisterData(initialRegisterData);
    }
  }, [showRegister]);

  const bloodTypes = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Login:', loginData);
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    if (registerData.password !== registerData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    // Map frontend fields to backend expected payload keys
    const payload: any = {
      firstName: registerData.firstName,
      lastName: registerData.lastName,
      email: registerData.email,
      password: registerData.password,
      phoneNumber: registerData.phone,
      address: registerData.address,
      bloodGroup: registerData.bloodType,
      // create a simple username if backend expects one
      userName: `${registerData.firstName || ''}${registerData.lastName || ''}`.toLowerCase()
    };
    console.log('Register payload:', payload);
    onRegister && onRegister(payload);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 bg-white rounded-full"></div>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Blood Bank</h1>
          <p className="text-gray-600">Save lives, donate blood</p>
        </div>

        {/* Toggle Buttons */}
        <div className="flex bg-gray-100 rounded-lg p-1 mb-6">
            <button
              // Make the Register tab visible but not clickable as requested
              onClick={() => { /* intentionally disabled */ }}
              disabled
              aria-disabled="true"
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors cursor-not-allowed bg-white text-gray-900 shadow-sm`}
            >
              Register
            </button>
        </div>

        {/* Login Form */}
    
          <form onSubmit={handleRegister} className="space-y-4" autoComplete="off">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="First Name"
                    value={registerData.firstName}
                    onChange={(e) => setRegisterData({...registerData, firstName: e.target.value})}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    autoComplete="given-name"
                    required
                  />
                </div>
              </div>
              <div>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="Last Name"
                    value={registerData.lastName}
                    onChange={(e) => setRegisterData({...registerData, lastName: e.target.value})}
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    autoComplete="family-name"
                    required
                  />
                </div>
              </div>
            </div>

            <div>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="email"
                  placeholder="Email"
                  value={registerData.email}
                  onChange={(e) => setRegisterData({...registerData, email: e.target.value})}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  autoComplete="email"
                  required
                />
              </div>
            </div>

            <div>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="tel"
                  placeholder="Phone Number"
                  value={registerData.phone}
                  onChange={(e) => setRegisterData({...registerData, phone: e.target.value})}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  autoComplete="tel"
                  required
                />
              </div>
            </div>

            <div>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Address"
                  value={registerData.address}
                  onChange={(e) => setRegisterData({...registerData, address: e.target.value})}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  autoComplete="street-address"
                  required
                />
              </div>
            </div>

            <div>
              <select
                value={registerData.bloodType}
                onChange={(e) => setRegisterData({...registerData, bloodType: e.target.value})}
                className="w-full py-3 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                autoComplete="off"
                required
              >
                  <option value="" disabled hidden>Blood Type</option>
                {bloodTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            <div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={registerData.password}
                  onChange={(e) => setRegisterData({...registerData, password: e.target.value})}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="password"
                  placeholder="Confirm Password"
                  value={registerData.confirmPassword}
                  onChange={(e) => setRegisterData({...registerData, confirmPassword: e.target.value})}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  autoComplete="new-password"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={registerData.bloodType === ''}
              className={`w-full rounded-lg font-medium transition-colors py-3 ${registerData.bloodType === '' ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-700'}`}
            >
              Register
            </button>
             <div className="text-center mt-4">
                <button
                className="text-red-600 underline"
                onClick={() => setShowRegister(!showRegister)}
                >
                {showRegister ? 'Already have an account? Login' : "Don't have an account? Register"}
        </button>
      </div>
          </form>
    

        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600">
            By continuing, you agree to our Terms of Service
          </p>
        </div>
      </div>
    </div>
  );
};
