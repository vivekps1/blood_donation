import  React, { useState, useEffect } from 'react';
import { User, Mail, Lock, Phone, MapPin, Eye, EyeOff, Activity } from 'lucide-react';

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
  height?: string;
  weight?: string;
  dateOfBirth?: string;
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
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [phoneError, setPhoneError] = useState('');
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
    ,height: '', weight: '', dateOfBirth: ''
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
    ,height: '', weight: '', dateOfBirth: ''
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

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (registerData.password !== registerData.confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    // Email format validation (allowed domains: .co, .com, .in, .net)
    const email = registerData.email || '';
    const emailValid = /^[^\s@]+@[^\s@]+\.(?:co|com|in|net)$/i.test(email);
    if (!emailValid) {
      setEmailError('Enter a valid email');
      return;
    }

    // Phone validation: require exactly 10 digits (local number)
    const rawPhone = registerData.phone || '';
    const cleanedPhone = rawPhone.replace(/\D/g, '');
    const phoneValid = /^\d{10}$/.test(cleanedPhone);
    if (!phoneValid) {
      setPhoneError('Enter a valid 10-digit phone number');
      return;
    }
    // Validate age >= 18
    if (!registerData.dateOfBirth) {
      alert('Please provide your date of birth');
      return;
    }
    const dob = new Date(registerData.dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    if (age < 18) {
      alert('You must be at least 18 years old to register');
      return;
    }
    // Map frontend fields to backend expected payload keys
    // Ensure phone is saved with +91 prefix in the backend
    const payload: any = {
      firstName: registerData.firstName,
      lastName: registerData.lastName,
      email: registerData.email,
      password: registerData.password,
      phoneNumber: `+91${cleanedPhone}`,
      address: registerData.address,
      bloodGroup: registerData.bloodType,
      height: registerData.height,
      weight: registerData.weight,
      dateofBirth: registerData.dateOfBirth,
      // create a simple username if backend expects one
      userName: `${registerData.firstName || ''}${registerData.lastName || ''}`.toLowerCase()
    };
    try {
      await onRegister?.(payload);
    } catch (err: any) {
      const data = err?.response?.data;
      if (err?.response?.status === 409 && data?.fields) {
        if (data.fields.email) setEmailError('Email already exists');
        if (data.fields.phoneNumber) setPhoneError('Phone number already exists');
        return;
      }
      // fallback
      setEmailError('');
      setPhoneError('');
    }
  };

  // Live validation when user types
  const onEmailChange = (val: string) => {
    setRegisterData({ ...registerData, email: val });
    if (!val) {
      setEmailError('');
      return;
    }
    const ok = /^[^\s@]+@[^\s@]+\.(?:co|com|in|net)$/i.test(val);
    setEmailError(ok ? '' : 'Enter a valid email');
  };

  const onPhoneChange = (val: string) => {
    // allow only digits and limit to 10 digits for local number
    const digits = val.replace(/\D/g, '').slice(0, 10);
    setRegisterData({ ...registerData, phone: digits });
    if (!digits) {
      setPhoneError('');
      return;
    }
    const ok = /^\d{10}$/.test(digits);
    setPhoneError(ok ? '' : 'Enter a valid 10-digit phone number');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 to-red-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Activity className="w-8 h-8 text-white" />
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
                    placeholder="First Name *"
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
                    
                  />
                </div>
              </div>
            </div>

            <div>
              <div>
                <div className="relative h-12">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="email"
                    placeholder="Email *"
                    value={registerData.email}
                    onChange={(e) => onEmailChange(e.target.value)}
                    className="w-full pl-10 pr-4 h-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    autoComplete="email"
                    required
                  />
                </div>
                {emailError && <div className="text-sm text-red-600 mt-2">{emailError}</div>}
              </div>
            </div>

            <div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number <span className="text-red-600">*</span></label>
                <div className="flex w-full h-12">
                  <span className="px-3 py-3 border rounded-l-lg bg-gray-100 text-sm text-gray-700 select-none">+91</span>
                  <div className="relative flex-1">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                    <input
                      type="tel"
                      placeholder="10-digit number"
                      value={registerData.phone}
                      onChange={(e) => onPhoneChange(e.target.value)}
                      className="w-full pl-10 pr-4 h-12 border border-l-0 border-gray-300 rounded-r-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      autoComplete="tel"
                      required
                    />
                  </div>
                </div>
                {phoneError && <div className="text-sm text-red-600 mt-2">{phoneError}</div>}
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
                />
              </div>
            </div>

            {/* Single DOB + Blood Type row (duplicate removed) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center">
                  <div className="w-full">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth <span className="text-red-600">*</span></label>
                    <input
                      type="date"
                      placeholder="Date of Birth"
                      value={registerData.dateOfBirth}
                      onChange={(e) => setRegisterData({...registerData, dateOfBirth: e.target.value})}
                      className="w-full h-12 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent appearance-none box-border leading-tight"
                      required
                    />
                  </div>
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1 opacity-0">Blood Type</label>
                  <select
                    value={registerData.bloodType}
                    onChange={(e) => setRegisterData({...registerData, bloodType: e.target.value})}
                    className="w-full h-12 pl-3 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent bg-white appearance-none box-border"
                    autoComplete="off"
                    required
                  >
                    <option value="" disabled hidden>Blood Type *</option>
                    {bloodTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">▾</span>
                </div>
              </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="w-full">
                <label className="sr-only">Height (cm)</label>
                <div className="flex items-center w-full">
                  <input
                    type="number"
                    placeholder="Height"
                    value={registerData.height}
                    onChange={(e) => setRegisterData({...registerData, height: e.target.value})}
                    className="flex-1 min-w-0 py-3 px-3 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    min={0}
                  />
                  <span className="px-3 py-2 border border-gray-300 border-l-0 rounded-r-lg bg-gray-50 text-sm text-gray-600">cm</span>
                </div>
              </div>
              <div className="w-full">
                <label className="sr-only">Weight (kg)</label>
                <div className="flex items-center w-full">
                  <input
                    type="number"
                    placeholder="Weight"
                    value={registerData.weight}
                    onChange={(e) => setRegisterData({...registerData, weight: e.target.value})}
                    className="flex-1 min-w-0 py-3 px-3 border border-gray-300 rounded-l-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    min={0}
                  />
                  <span className="px-3 py-2 border border-gray-300 border-l-0 rounded-r-lg bg-gray-50 text-sm text-gray-600">kg</span>
                </div>
              </div>
            </div>

            <div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password *"
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
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm Password *"
                  value={registerData.confirmPassword}
                  onChange={(e) => setRegisterData({...registerData, confirmPassword: e.target.value})}
                  className="w-full pl-10 pr-12 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {registerData.confirmPassword && registerData.password !== registerData.confirmPassword && (
                <div className="text-sm text-red-600 mt-2">Passwords do not match.</div>
              )}
            </div>

            {
              (() => {
                const requiredFilled = Boolean(registerData.firstName && registerData.phone && registerData.email && registerData.dateOfBirth && registerData.bloodType && registerData.password);
                const passwordsMatch = registerData.password === registerData.confirmPassword;
                const noFieldErrors = !emailError && !phoneError;
                const isFormValid = requiredFilled && passwordsMatch && noFieldErrors;
                return (
                  <button
                    type="submit"
                    disabled={!isFormValid}
                    className={`w-full rounded-lg font-medium transition-colors py-3 ${!isFormValid ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-red-600 text-white hover:bg-red-700'}`}
                  >
                    Register
                  </button>
                );
              })()
            }
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
