import  React, { useState, useEffect } from 'react';
import PlacesAutocomplete from './PlacesAutocomplete';
import MapPicker from './MapPicker';
import { User, Mail, Lock, Phone, MapPin, Eye, EyeOff, Activity, Gift } from 'lucide-react';
import { validateReferralCode } from '../utils/axios';
import { parseApiError, type NormalisedError } from '../utils/apiError';
import { ErrorBanner, FieldError, focusFirstError } from './FormFeedback';

// Removed login data type since this component is registration-only.

interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  password: string;
  confirmPassword: string;
  phone: string;
  address: string;
  latitude?: number | null;
  longitude?: number | null;
  locationName?: string | null;
  bloodType: string;
  height?: string;
  weight?: string;
  dateOfBirth?: string;
}

export default function RegisterUser({
  onRegister,
  setShowRegister,
  showRegister,
  referralCode
}: {
  onRegister?: (data: RegisterData) => void;
  setShowRegister: (show: boolean) => void;
  showRegister: boolean;
  /** Invitation code from a /register?ref=... link (synopsis 9.b.1). */
  referralCode?: string | null;
}) {
  // Who invited this person, resolved from the code so the form can name them.
  const [referrerName, setReferrerName] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  // One map for every field problem, whether raised locally or returned by the API, so
  // client-side and server-side validation highlight inputs the same way.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<NormalisedError | null>(null);

  const setFieldError = (field: string, message: string) =>
    setFieldErrors(prev => ({ ...prev, [field]: message }));

  const clearFieldError = (field: string) =>
    setFieldErrors(prev => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [pendingRegistration, setPendingRegistration] = useState<any>(null);
  const [loginData, setLoginData] = useState<LoginData>({ email: '', password: '' });
  const [registerData, setRegisterData] = useState<RegisterData>({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    address: '',
    latitude: null,
    longitude: null,
    locationName: null,
    bloodType: ''
    ,height: '', weight: '', dateOfBirth: ''
  });
  const [showMap, setShowMap] = useState<boolean>(false);

  useEffect(() => {
    if (!referralCode) return;
    // A bad or expired code must not block registration — it just goes unattributed.
    validateReferralCode(referralCode)
      .then((r: any) => setReferrerName(r.data?.referrerName || null))
      .catch(() => setReferrerName(null));
  }, [referralCode]);

  const initialRegisterData: RegisterData = {
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    address: '',
    latitude: null,
    longitude: null,
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

  // Swaps an input's border and background when that field has been flagged, so the
  // problem is visible on the control itself and not only in the banner.
  const errorStyle = (field: string) =>
    fieldErrors[field]
      ? 'border-red-400 bg-red-50 focus:ring-red-500'
      : 'border-gray-300 focus:ring-red-500';

  // Login not used in this modal/flow; leaving registration only

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setFormError(null);
    setFieldErrors({});

    if (registerData.password !== registerData.confirmPassword) {
      setFieldError('confirmPassword', 'The two passwords do not match');
      focusFirstError({ confirmPassword: 'x' });
      return;
    }
    // Email format validation (allowed domains: .co, .com, .in, .net)
    const email = registerData.email || '';
    const emailValid = /^[^\s@]+@[^\s@]+\.(?:co|com|in|net)$/i.test(email);
    if (!emailValid) {
      setFieldError('email', 'Enter a valid email address');
      focusFirstError({ email: 'x' });
      return;
    }

    // Phone validation: require exactly 10 digits (local number)
    const rawPhone = registerData.phone || '';
    const cleanedPhone = rawPhone.replace(/\D/g, '');
    const phoneValid = /^\d{10}$/.test(cleanedPhone);
    if (!phoneValid) {
      setFieldError('phone', 'Enter a valid 10-digit phone number');
      focusFirstError({ phone: 'x' });
      return;
    }
    // Validate age >= 18
    if (!registerData.dateOfBirth) {
      setFieldError('dateOfBirth', 'Your date of birth is required');
      focusFirstError({ dateOfBirth: 'x' });
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
      setFieldError('dateOfBirth', 'You must be at least 18 years old to donate blood');
      focusFirstError({ dateOfBirth: 'x' });
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
      // include geo coordinates and location name if present
      latitude: typeof registerData.latitude === 'number' ? registerData.latitude : undefined,
      longitude: typeof registerData.longitude === 'number' ? registerData.longitude : undefined,
      locationGeo: (typeof registerData.latitude === 'number' && typeof registerData.longitude === 'number') ? { type: 'Point', coordinates: [registerData.longitude, registerData.latitude] } : undefined,
      locationName: registerData.locationName || undefined,
      bloodGroup: registerData.bloodType,
      height: registerData.height,
      weight: registerData.weight,
      dateofBirth: registerData.dateOfBirth,
      referralCode: referralCode || undefined
    };
    
    // Store payload and show confirmation modal
    setPendingRegistration(payload);
    setShowConfirmModal(true);
  };

  const confirmRegistration = async () => {
    if (!pendingRegistration) return;
    
    setShowConfirmModal(false);
    
    try {
      await onRegister?.(pendingRegistration);
      setShowSuccessModal(true);
    } catch (err: any) {
      // parseApiError maps the API's field names onto this form's input names, so a
      // rejected bloodGroup highlights the "bloodType" select and a duplicate
      // phoneNumber highlights the "phone" input. Previously anything that was not a
      // 409 was swallowed and the user saw the form simply do nothing.
      const parsed = parseApiError(err);
      setFormError(parsed);
      setFieldErrors(parsed.fieldErrors);
      focusFirstError(parsed.fieldErrors);
    } finally {
      setPendingRegistration(null);
    }
  };

  // Live validation when user types
  const onEmailChange = (val: string) => {
    setRegisterData({ ...registerData, email: val });
    if (!val) {
      clearFieldError('email');
      return;
    }
    const ok = /^[^\s@]+@[^\s@]+\.(?:co|com|in|net)$/i.test(val);
    if (ok) clearFieldError('email');
    else setFieldError('email', 'Enter a valid email address');
  };

  const onPhoneChange = (val: string) => {
    // allow only digits and limit to 10 digits for local number
    const digits = val.replace(/\D/g, '').slice(0, 10);
    setRegisterData({ ...registerData, phone: digits });
    if (!digits) {
      clearFieldError('phone');
      return;
    }
    const ok = /^\d{10}$/.test(digits);
    if (ok) clearFieldError('phone');
    else setFieldError('phone', 'Enter a valid 10-digit phone number');
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

        {/* Shown when the visitor arrived through an invitation link. */}
        {referralCode && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-lg px-4 py-3 flex items-start">
            <Gift className="w-5 h-5 text-red-600 mr-2.5 mt-0.5 shrink-0" />
            <p className="text-sm text-red-900">
              {referrerName
                ? <>You were invited by <span className="font-medium">{referrerName}</span>.</>
                : <>You are registering with invitation code <span className="font-mono font-medium">{referralCode}</span>.</>}
              <span className="block text-xs text-red-700 mt-0.5">Thank you for joining the donor network.</span>
            </p>
          </div>
        )}

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
                    id="firstName"
                    name="firstName"
                    type="text"
                    placeholder="First Name *"
                    value={registerData.firstName}
                    onChange={(e) => { setRegisterData({...registerData, firstName: e.target.value}); clearFieldError('firstName'); }}
                    className={`w-full pl-10 pr-4 py-3 border rounded-lg focus:ring-2 focus:border-transparent ${errorStyle('firstName')}`}
                    aria-invalid={Boolean(fieldErrors.firstName)}
                    autoComplete="given-name"
                    required
                  />
                </div>
                <FieldError message={fieldErrors.firstName} />
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
                    id="email"
                    name="email"
                    type="email"
                    placeholder="Email *"
                    value={registerData.email}
                    onChange={(e) => onEmailChange(e.target.value)}
                    className={`w-full pl-10 pr-4 h-12 border rounded-lg focus:ring-2 focus:border-transparent ${errorStyle('email')}`}
                    aria-invalid={Boolean(fieldErrors.email)}
                    autoComplete="email"
                    required
                  />
                </div>
                <FieldError message={fieldErrors.email} />
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
                      id="phone"
                      name="phone"
                      type="tel"
                      placeholder="10-digit number"
                      value={registerData.phone}
                      onChange={(e) => onPhoneChange(e.target.value)}
                      className={`w-full pl-10 pr-4 h-12 border border-l-0 rounded-r-lg focus:ring-2 focus:border-transparent ${errorStyle('phone')}`}
                      aria-invalid={Boolean(fieldErrors.phone)}
                      autoComplete="tel"
                      required
                    />
                  </div>
                </div>
                <FieldError message={fieldErrors.phone} />
              </div>
            </div>

            <div>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <PlacesAutocomplete
                  value={registerData.address}
                  placeholder="Search location"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent h-12"
                  onSelect={({ address, name, lat, lng }) => setRegisterData({ ...registerData, address: address || '', locationName: name || null, latitude: typeof lat === 'number' ? lat : null, longitude: typeof lng === 'number' ? lng : null })}
                />
              </div>
            </div>

            {/* Single DOB + Blood Type row (duplicate removed) */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center">
                  <div className="w-full">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth <span className="text-red-600">*</span></label>
                    <input
                      id="dateOfBirth"
                      name="dateOfBirth"
                      type="date"
                      placeholder="Date of Birth"
                      value={registerData.dateOfBirth}
                      onChange={(e) => { setRegisterData({...registerData, dateOfBirth: e.target.value}); clearFieldError('dateOfBirth'); }}
                      className={`w-full h-12 px-3 border rounded-lg focus:ring-2 focus:border-transparent appearance-none box-border leading-tight ${errorStyle('dateOfBirth')}`}
                      aria-invalid={Boolean(fieldErrors.dateOfBirth)}
                      required
                    />
                    <FieldError message={fieldErrors.dateOfBirth} />
                  </div>
                </div>
                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-1 opacity-0">Blood Type</label>
                  <select
                    id="bloodType"
                    name="bloodType"
                    value={registerData.bloodType}
                    onChange={(e) => { setRegisterData({...registerData, bloodType: e.target.value}); clearFieldError('bloodType'); }}
                    className={`w-full h-12 pl-3 pr-10 border rounded-lg focus:ring-2 focus:border-transparent appearance-none box-border ${
                      fieldErrors.bloodType ? 'border-red-400 bg-red-50 focus:ring-red-500' : 'border-gray-300 bg-white focus:ring-red-500'
                    }`}
                    aria-invalid={Boolean(fieldErrors.bloodType)}
                    autoComplete="off"
                    required
                  >
                    <option value="" disabled hidden>Blood Type *</option>
                    {bloodTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">▾</span>
                  <FieldError message={fieldErrors.bloodType} />
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
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password *"
                  value={registerData.password}
                  onChange={(e) => { setRegisterData({...registerData, password: e.target.value}); clearFieldError('password'); }}
                  className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:border-transparent ${errorStyle('password')}`}
                  aria-invalid={Boolean(fieldErrors.password)}
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
              {/* The API enforces this policy too; stating it up front avoids a round trip. */}
              <FieldError message={fieldErrors.password} />
              {!fieldErrors.password && (
                <p className="mt-1 text-xs text-gray-500">At least 8 characters, including a letter and a number.</p>
              )}
            </div>

            <div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirm Password *"
                  value={registerData.confirmPassword}
                  onChange={(e) => { setRegisterData({...registerData, confirmPassword: e.target.value}); clearFieldError('confirmPassword'); }}
                  className={`w-full pl-10 pr-12 py-3 border rounded-lg focus:ring-2 focus:border-transparent ${errorStyle('confirmPassword')}`}
                  aria-invalid={Boolean(fieldErrors.confirmPassword)}
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

            {/* Whatever the API rejected, shown in full above the button. */}
            <ErrorBanner error={formError} onDismiss={() => setFormError(null)} />

            {
              (() => {
                const requiredFilled = Boolean(registerData.firstName && registerData.phone && registerData.email && registerData.dateOfBirth && registerData.bloodType && registerData.password);
                const passwordsMatch = registerData.password === registerData.confirmPassword;
                const noFieldErrors = Object.keys(fieldErrors).length === 0;
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

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4">Confirm Registration</h2>
            <p className="text-gray-600 mb-6">Are you sure you want to register with the provided information?</p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowConfirmModal(false);
                  setPendingRegistration(null);
                }}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmRegistration}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-semibold mb-4 text-green-600">Registration Successful!</h2>
            <p className="text-gray-600 mb-6">Successfully registered! Please login with your credentials.</p>
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  setShowRegister(false);
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Go to Login
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
