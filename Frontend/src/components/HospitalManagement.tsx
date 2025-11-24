import  React, { useState, useEffect,useRef } from 'react';
import PlacesAutocomplete from './PlacesAutocomplete';
import { Plus, Edit2, Trash, Save, X, MapPin, Phone, Mail } from 'lucide-react';
import { getAllHospitals, createHospital, updateHospital, deleteHospital } from '../utils/axios';
import { isValidEmail, isValidPhone, normalizePhone } from '../utils/validation';

interface Hospital {
  _id: string;
  hospitalId?: string; // now string identifier supplied by backend
  hospitalName: string;
  location?: string;
  latitude?: number;
  longitude?: number;
  locationGeo?: { type: string; coordinates: number[] };
  regNo: string;
  contactName: string;
  email: string;
  phoneNumber: string;
  address: string;
  pincode: string;
  isVerified: boolean; // changed from string
  hospitalLocationGeo?: { type: string; coordinates: number[] };
}

export const HospitalManagement: React.FC = () => {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
 const [loading, setLoading] = useState<boolean>(true);
  useEffect(() => {
    const fetchHospitals = async () => {
      setLoading(true);
      try {
        const res:any = await getAllHospitals();
        setHospitals(res.data);
      } catch (err) {
        // handle error (show toast, etc)
      }
      setLoading(false);
    };
    fetchHospitals();
      }, []);

    // Google Places will be used as the primary location input


  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editData, setEditData] = useState<Partial<Hospital>>({});

  const isHospitalFormValid = (data: Partial<Hospital>) => {
    if (!data) return false;
    const required = [
      'hospitalName',
      'regNo',
      'contactName',
      'email',
      'phoneNumber',
      'address',
      'pincode',
    ];
    for (const key of required) {
      const val = (data as any)[key];
      if (val === undefined || val === null) return false;
      if (typeof val === 'string' && val.trim() === '') return false;
      if (key === 'regNo' && Number.isNaN(Number(val))) return false;
    }
    // basic email check
    const email = (data as any).email || '';
    const emailOk = /\S+@\S+\.\S+/.test(String(email));
    if (!emailOk) return false;
    return true;
  };
  const [emailError, setEmailError] = useState<string>('');
  const [phoneError, setPhoneError] = useState<string>('');
  const saveDisabled = !isHospitalFormValid(editData);
  const addPlaceRef = useRef<HTMLInputElement | null>(null);
  const editPlaceRef = useRef<HTMLInputElement | null>(null);

  // Load Google Maps Places script if VITE_GOOGLE_MAPS_API_KEY is provided
  const loadGoogleMaps = () => {
    const key = (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY;
    if (!key) return;
    if (document.getElementById('google-maps-script')) return;
    const s = document.createElement('script');
    s.id = 'google-maps-script';
    s.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
    s.async = true;
    s.defer = true;
    document.head.appendChild(s);
  }

  // Initialize Places Autocomplete for a given input element
  const initAutocomplete = (inputEl: HTMLInputElement | null) => {
    if (!inputEl) return;
    const timeout = setTimeout(() => {
      const win: any = window as any;
      if (!win.google || !win.google.maps || !win.google.maps.places) return;
      const ac = new win.google.maps.places.Autocomplete(inputEl, { types: ['geocode'] });
      ac.addListener('place_changed', () => {
        const place = ac.getPlace();
        if (!place.geometry) return;
        const lat = place.geometry.location.lat();
        const lng = place.geometry.location.lng();
        setEditData({ ...(editData as any), address: place.formatted_address || inputEl.value, latitude: lat, longitude: lng, location: place.name || place.formatted_address });
      });
    }, 500);
    return () => clearTimeout(timeout);
  }

  const handleEdit = (hospital: Hospital) => {
  setIsEditing(hospital._id);
    setEditData(hospital);
  };

  const handleAdd = () => {
    setIsAdding(true);
    setEditData({
      hospitalName: '',
      location: '',
      latitude: '',
      longitude: '',
      regNo: '',
      contactName: '',
      email: '',
      phoneNumber: '',
      address: '',
      pincode: '',
      isVerified: false,
    } as any);
    setEmailError('');
    setPhoneError('');
  };


  const handleSave = async () => {
    if (isAdding) {
      // Block save if validation errors or required fields missing
      if (emailError || phoneError) return;
      if (!editData.hospitalName || !editData.phoneNumber || !editData.email || !editData.address || !editData.pincode) {
        alert('Please fill all required fields');
        return;
      }
      if (!isValidEmail(editData.email || '')) { setEmailError('Enter a valid email'); return; }
      if (!isValidPhone(editData.phoneNumber || '')) { setPhoneError('Enter a valid 10-digit phone number'); return; }
      const payload: any = { ...(editData as any) };
      // Normalize latitude/longitude to numbers when present
      if (payload.latitude !== undefined && payload.latitude !== null && payload.latitude !== '') {
        payload.latitude = parseFloat(payload.latitude);
      }
      if (payload.longitude !== undefined && payload.longitude !== null && payload.longitude !== '') {
        payload.longitude = parseFloat(payload.longitude);
      }
      // Normalize phone to +91 prefix
      const { prefixed } = normalizePhone(payload.phoneNumber || '');
      if (prefixed) payload.phoneNumber = prefixed;
      try {
        const res:any = await createHospital(payload);
        // push the created hospital returned from server (with _id)
        setHospitals([...hospitals, res.data]);
      } catch (err) {
        // handle error (show toast, etc)
      }
      setIsAdding(false);
    } else if (isEditing) {
      try {
        // Validation for edit
        if (emailError || phoneError) return;
        if (!editData.hospitalName || !editData.phoneNumber || !editData.email || !editData.address || !editData.pincode) {
          alert('Please fill all required fields');
          return;
        }
        if (!isValidEmail(editData.email || '')) { setEmailError('Enter a valid email'); return; }
        if (!isValidPhone(editData.phoneNumber || '')) { setPhoneError('Enter a valid 10-digit phone number'); return; }
        const payload: any = { ...(editData as any) };
        const { prefixed } = normalizePhone(payload.phoneNumber || '');
        if (prefixed) payload.phoneNumber = prefixed;
        const res:any = await updateHospital(isEditing, payload as Hospital);
        setHospitals(hospitals.map(h => h._id === isEditing ? res.data : h));
      } catch (err) {
        // handle error (show toast, etc)
      }
      setIsEditing(null);
    }
    setEditData({});
    setEmailError('');
    setPhoneError('');
  };

  const handleCancel = () => {
    setIsEditing(null);
    setIsAdding(false);
    setEditData({});
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this hospital?')) {
      try {
        await deleteHospital(id);
        setHospitals(hospitals.filter(h => h._id !== id));
      } catch (err) {
        // handle error (show toast, etc)
      }
    }
  };

  // Whenever add/edit form is opened, attempt to load Google Maps and init autocomplete
  useEffect(() => {
    loadGoogleMaps();
    // try to init right away in case script already loaded
    try { initAutocomplete(addPlaceRef.current); } catch {}
    try { initAutocomplete(editPlaceRef.current); } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isAdding) {
      // init autocomplete for add input if present
      initAutocomplete(addPlaceRef.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdding]);

  useEffect(() => {
    if (isEditing) {
      initAutocomplete(editPlaceRef.current);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing]);

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Hospital Management</h1>
        <button
          onClick={handleAdd}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          <Plus className="w-4 h-4" />
          Add Hospital
        </button>
      </div>

      {/* Nearby Filter Controls
      <div className="bg-white rounded-lg p-4 mb-6 border flex flex-col md:flex-row gap-3 items-center">
        <div className="flex items-center gap-2">
          <input type="text" placeholder="Latitude" value={filterLat} onChange={e => setFilterLat(e.target.value)} className="p-2 border rounded" />
          <input type="text" placeholder="Longitude" value={filterLng} onChange={e => setFilterLng(e.target.value)} className="p-2 border rounded" />
          <input type="number" placeholder="Radius (m)" value={filterRadius} onChange={e => setFilterRadius(parseInt(e.target.value || '0'))} className="p-2 border rounded w-32" />
        </div>
        <div className="flex gap-2">
          <button onClick={handleFindNearby} className="px-3 py-2 bg-indigo-600 text-white rounded">Find Nearby</button>
          <button onClick={async () => { setFilterLat(''); setFilterLng(''); setFilterRadius(5000); const res:any = await getAllHospitals(); setHospitals(res.data); }} className="px-3 py-2 border rounded">Reset</button>
        </div>
      </div> */}

      {/* Add New Hospital Form */}
      {isAdding && (
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Add New Hospital</h2>
          <div className="grid md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Hospital Name"
              value={editData.hospitalName || ''}
              onChange={(e) => setEditData({...editData, hospitalName: e.target.value})}
              className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
                <PlacesAutocomplete
                  value={editData.address as string}
                  placeholder="Address"
                  onSelect={({ address, lat, lng }) => setEditData({ ...editData, address: address, hospitalLocationGeo: (lat && lng) ? { type: 'Point', coordinates: [lng, lat] } : undefined })}
                />
            <div>
              <input
                type="tel"
                placeholder="Phone Number"
                value={editData.phoneNumber || ''}
                onChange={(e) => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0,10);
                  setEditData({...editData, phoneNumber: digits});
                  if (!digits) { setPhoneError(''); return; }
                  setPhoneError(isValidPhone(digits) ? '' : 'Enter a valid 10-digit phone number');
                }}
                className={`p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${phoneError ? 'border-red-500' : ''}`}
              />
              {phoneError && <p className="text-xs text-red-600 mt-1">{phoneError}</p>}
            </div>
            <div>
              <input
                type="email"
                placeholder="Email"
                value={editData.email || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  setEditData({...editData, email: val});
                  if (!val) { setEmailError(''); return; }
                  setEmailError(isValidEmail(val) ? '' : 'Enter a valid email');
                }}
                className={`p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${emailError ? 'border-red-500' : ''}`}
              />
              {emailError && <p className="text-xs text-red-600 mt-1">{emailError}</p>}
            </div>
            <input
              type="text"
              placeholder="Reg No"
              value={editData.regNo || ''}
              onChange={(e) => setEditData({...editData, regNo: e.target.value})}
              className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Contact Name"
              value={editData.contactName || ''}
              onChange={(e) => setEditData({...editData, contactName: e.target.value})}
              className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            {/* Location will be selected via Google Places above */}
            <input
              type="text"
              placeholder="Pincode"
              value={editData.pincode || ''}
              onChange={(e) => setEditData({...editData, pincode: e.target.value})}
              className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isVerified"
                checked={!!editData.isVerified}
                onChange={(e) => setEditData({...editData, isVerified: e.target.checked })}
                className="w-4 h-4 text-blue-600"
              />
              <label htmlFor="isVerified" className="text-sm">Verified</label>
            </div>
            {/* Removed bloodBankAvailable field as per new API model */}
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              disabled={saveDisabled}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg ${saveDisabled ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}
            >
              <Save className="w-4 h-4" />
              Save
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

  {/* Hospitals List */}
      {loading ? (
        <div>Loading hospitals...</div>
      ) : (
        <div className="grid gap-4">
          {hospitals.map((hospital) => (
            <div key={hospital._id} className="bg-white rounded-lg shadow-sm border p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              {isEditing === hospital._id ? (
                <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
                  <h2 className="text-lg font-semibold mb-4">Edit Hospital</h2>
                  <div className="grid md:grid-cols-2 gap-4">
                    <input type="text" placeholder="Hospital Name" value={editData.hospitalName || ''} onChange={e => setEditData({...editData, hospitalName: e.target.value})} className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500" />
                    {/* <input type="text" placeholder="Address" value={editData.address || ''} onChange={e => setEditData({...editData, address: e.target.value})} className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500" /> */}
                      <PlacesAutocomplete value={editData.address as string} placeholder="Address" onSelect={({ address, lat, lng }) => setEditData({ ...editData, address: address, hospitalLocationGeo: (lat && lng) ? { type: 'Point', coordinates: [lng, lat] } : undefined })} />
                    <div>
                      <input type="tel" placeholder="Phone Number" value={editData.phoneNumber || ''} onChange={e => {
                        const digits = e.target.value.replace(/\D/g, '').slice(0,10);
                        setEditData({...editData, phoneNumber: digits});
                        if (!digits) { setPhoneError(''); return; }
                        setPhoneError(isValidPhone(digits) ? '' : 'Enter a valid 10-digit phone number');
                      }} className={`p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${phoneError ? 'border-red-500' : ''}`} />
                      {phoneError && <p className="text-xs text-red-600 mt-1">{phoneError}</p>}
                    </div>
                    <div>
                      <input type="email" placeholder="Email" value={editData.email || ''} onChange={e => {
                        const val = e.target.value;
                        setEditData({...editData, email: val});
                        if (!val) { setEmailError(''); return; }
                        setEmailError(isValidEmail(val) ? '' : 'Enter a valid email');
                      }} className={`p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 ${emailError ? 'border-red-500' : ''}`} />
                      {emailError && <p className="text-xs text-red-600 mt-1">{emailError}</p>}
                    </div>
                    <input type="text" placeholder="Reg No" value={editData.regNo || ''} onChange={e => setEditData({...editData, regNo: e.target.value})} className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500" />
                    <input type="text" placeholder="Contact Name" value={editData.contactName || ''} onChange={e => setEditData({...editData, contactName: e.target.value})} className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500" />
                    <input type="text" placeholder="Pincode" value={editData.pincode || ''} onChange={e => setEditData({...editData, pincode: e.target.value})} className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500" />
                      <div>
                        {/* Location selected via Google Places search above */}
                      </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="isVerifiedEdit" checked={!!editData.isVerified} onChange={e => setEditData({...editData, isVerified: e.target.checked })} className="w-4 h-4 text-blue-600" />
                      <label htmlFor="isVerifiedEdit" className="text-sm">Verified</label>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={handleSave} disabled={saveDisabled} className={`flex items-center gap-2 px-4 py-2 rounded-lg ${saveDisabled ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-green-600 text-white hover:bg-green-700'}`}><Save className="w-4 h-4" /> Save</button>
                    <button onClick={handleCancel} className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"><X className="w-4 h-4" /> Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="w-full flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold mb-1">{hospital.hospitalName}</h3>
                    <div className="flex items-center gap-2 text-gray-700 mb-1">
                      <MapPin className="w-4 h-4" />
                      <span className="font-medium">{hospital.address}</span>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-1 text-sm text-gray-500 mb-2">
                      <div>Reg No: <span className="font-semibold">{hospital.regNo}</span></div>
                      <div>Contact: <span className="font-semibold">{hospital.contactName}</span></div>
                      <div>Pincode: <span className="font-semibold">{hospital.pincode}</span></div>
                    </div>
                    <div className="flex flex-wrap gap-6 items-center mt-2">
                      <div className="flex items-center gap-2 text-gray-700">
                        <Phone className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{hospital.phoneNumber}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-700">
                        <Mail className="w-4 h-4 text-gray-400" />
                        <span className="font-medium">{hospital.email}</span>
                      </div>
                      <div className="font-semibold text-green-700 ml-auto">
                        Verified: <span className="font-bold">{hospital.isVerified ? 'Yes' : 'No'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col md:flex-row gap-2 md:gap-4 items-start md:items-center mt-2 md:mt-0">
                    <button onClick={() => handleEdit(hospital)} className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg border border-blue-100" title="Edit"><Edit2 className="w-4 h-4" /></button>
                    <button onClick={() => handleDelete(hospital._id)} className="p-2 text-red-600 hover:bg-red-50 rounded-lg border border-red-100" title="Delete"><Trash className="w-4 h-4" /></button>
                  </div>
                </div>
              )}
            </div>
        ))}
      </div>)}
    </div>
    );
  }