import  React, { useState, useEffect,useRef } from 'react';
import PlacesAutocomplete from './PlacesAutocomplete';
import { Plus, Edit2, Trash, Save, X, MapPin, Phone, Mail, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const [sortField, setSortField] = useState<'hospitalName' | ''>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  const [sortModalOpen, setSortModalOpen] = useState(false);
  const [sortTempField, setSortTempField] = useState(sortField);
  const [sortTempOrder, setSortTempOrder] = useState(sortOrder);
  const [originalHospitalData, setOriginalHospitalData] = useState<Partial<Hospital>>({});

  useEffect(() => {
    const fetchHospitals = async () => {
      setLoading(true);
      try {
        const res: any = await getAllHospitals(
          currentPage,
          pageSize,
          sortField || undefined,
          sortOrder || undefined,
          searchTerm
        );
        // Handle both response formats: {hospitals: [], totalPages: x} or direct array
        if (res.data.hospitals) {
          setHospitals(res.data.hospitals);
          setTotalPages(res.data.totalPages || 1);
        } else if (Array.isArray(res.data)) {
          setHospitals(res.data);
          setTotalPages(1);
        } else {
          setHospitals([]);
          setTotalPages(1);
        }
      } catch (err) {
        console.error('Error fetching hospitals:', err);
        setHospitals([]);
        setTotalPages(1);
      }
      setLoading(false);
    };
    fetchHospitals();
  }, [currentPage, pageSize, sortField, sortOrder, searchTerm]);

    // Google Places will be used as the primary location input


  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editData, setEditData] = useState<Partial<Hospital>>({});
  const [emailError, setEmailError] = useState<string>('');
  const [phoneError, setPhoneError] = useState<string>('');
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
    const digits = String(hospital.phoneNumber || '').replace(/\D/g, '');
    const last10 = digits.slice(-10);
    const hospitalData = { ...hospital, phoneNumber: last10 };
    setEditData(hospitalData);
    setOriginalHospitalData(hospitalData);
  };

  const hasChanges = () => {
    if (!isEditing || !originalHospitalData) return false;
    return JSON.stringify(editData) !== JSON.stringify(originalHospitalData);
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
        await createHospital(payload);
        // Refresh the hospital list after adding
        setCurrentPage(1);
        const res: any = await getAllHospitals(1, pageSize, sortField || undefined, sortOrder || undefined, searchTerm);
        if (res.data.hospitals) {
          setHospitals(res.data.hospitals);
          setTotalPages(res.data.totalPages || 1);
        } else if (Array.isArray(res.data)) {
          setHospitals(res.data);
          setTotalPages(1);
        }
      } catch (err) {
        console.error('Error creating hospital:', err);
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
        await updateHospital(isEditing, payload as Hospital);
        // Refresh the hospital list after updating
        const res: any = await getAllHospitals(currentPage, pageSize, sortField || undefined, sortOrder || undefined, searchTerm);
        if (res.data.hospitals) {
          setHospitals(res.data.hospitals);
          setTotalPages(res.data.totalPages || 1);
        } else if (Array.isArray(res.data)) {
          setHospitals(res.data);
          setTotalPages(1);
        }
      } catch (err) {
        console.error('Error updating hospital:', err);
      }
      setIsEditing(null);
    }
    setEditData({});
    setOriginalHospitalData({});
    setEmailError('');
    setPhoneError('');
  };

  const handleCancel = () => {
    setIsEditing(null);
    setIsAdding(false);
    setEditData({});
    setOriginalHospitalData({});
    setEmailError('');
    setPhoneError('');
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this hospital?')) {
      try {
        await deleteHospital(id);
        // Refresh the hospital list after deleting
        const res: any = await getAllHospitals(currentPage, pageSize, sortField || undefined, sortOrder || undefined, searchTerm);
        if (res.data.hospitals) {
          setHospitals(res.data.hospitals);
          setTotalPages(res.data.totalPages || 1);
        } else if (Array.isArray(res.data)) {
          setHospitals(res.data);
          setTotalPages(1);
        }
      } catch (err) {
        console.error('Error deleting hospital:', err);
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
        {hospitals.length > 0 && (
          <button
            onClick={handleAdd}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Plus className="w-4 h-4" />
            Add Hospital
          </button>
        )}
      </div>

      {/* Search and Sort Bar */}
      {!loading && hospitals.length > 0 && (
        <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 mb-6">
          <div className="flex flex-wrap items-center gap-2 w-full">
            {/* Search Input */}
            <input
              type="text"
              className="border rounded px-3 py-2 w-72"
              placeholder="Search by hospital name"
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  setSearchTerm(searchInput);
                  setCurrentPage(1);
                }
              }}
            />

            {/* Clear Search Button */}
            <button
              className="px-4 py-2 bg-gray-100 rounded border hover:bg-gray-200"
              onClick={() => {
                setSearchInput('');
                setSearchTerm('');
                setCurrentPage(1);
              }}
            >
              Clear Search
            </button>

            {/* Sort Button */}
            <div className="relative flex items-center gap-2">
              <div className="relative">
                <button
                  className="px-4 py-2 bg-blue-100 rounded border flex items-center gap-1 hover:bg-blue-200"
                  onClick={() => {
                    setSortTempField(sortField);
                    setSortTempOrder(sortOrder);
                    setSortModalOpen(true);
                  }}
                  type="button"
                >
                  <span>Sort</span>
                  <span className="flex flex-col">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M4 6L8 2L12 6" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M4 10L8 14L12 10" stroke="#2563eb" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </span>
                </button>
                {sortModalOpen && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-20">
                    <div className="bg-white rounded-lg shadow-lg p-6 min-w-[300px] relative">
                      <div className="flex justify-between items-center mb-2">
                        <span className="font-semibold text-lg">Sort Options</span>
                        <button className="text-gray-400 hover:text-gray-700 text-xl" onClick={() => setSortModalOpen(false)}>&times;</button>
                      </div>
                      <div className="mb-4">
                        <div className="font-medium mb-1">Hospital Name</div>
                        <label className="mr-4">
                          <input
                            type="radio"
                            name="sortName"
                            checked={sortTempField === 'hospitalName' && sortTempOrder === 'asc'}
                            onChange={() => { setSortTempField('hospitalName'); setSortTempOrder('asc'); }}
                          /> Ascending
                        </label>
                        <label>
                          <input
                            type="radio"
                            name="sortName"
                            checked={sortTempField === 'hospitalName' && sortTempOrder === 'desc'}
                            onChange={() => { setSortTempField('hospitalName'); setSortTempOrder('desc'); }}
                          /> Descending
                        </label>
                      </div>
                      <div className="flex gap-2 mt-4">
                        <button
                          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                          onClick={() => {
                            setSortField(sortTempField);
                            setSortOrder(sortTempOrder);
                            setCurrentPage(1);
                            setSortModalOpen(false);
                          }}
                        >
                          Sort
                        </button>
                        <button
                          className="px-4 py-2 bg-gray-100 text-gray-800 rounded hover:bg-gray-200 font-semibold"
                          onClick={() => {
                            setSortField('');
                            setSortOrder('asc');
                            setSortTempField('');
                            setSortTempOrder('asc');
                            setCurrentPage(1);
                            setSortModalOpen(false);
                          }}
                        >
                          Reset Sort
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Add New Hospital Modal */}
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Add New Hospital</h2>
                <button onClick={handleCancel} className="text-gray-400 hover:text-gray-700 text-2xl">&times;</button>
              </div>
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
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <div className="flex w-full">
                    <span className="px-3 py-3 border rounded-l-lg bg-gray-100 text-sm text-gray-700 select-none">+91</span>
                    <input
                      type="tel"
                      placeholder="10-digit number"
                      value={editData.phoneNumber || ''}
                      onChange={(e) => {
                        const digits = e.target.value.replace(/\D/g, '').slice(0,10);
                        setEditData({...editData, phoneNumber: digits});
                        if (!digits) { setPhoneError(''); return; }
                        setPhoneError(isValidPhone(digits) ? '' : 'Enter a valid 10-digit phone number');
                      }}
                      className={`flex-1 px-3 py-3 border border-l-0 rounded-r-lg focus:ring-2 focus:ring-blue-500 ${phoneError ? 'border-red-500' : ''}`}
                    />
                  </div>
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
              </div>
              <div className="flex gap-2 mt-6 justify-end">
                <button
                  onClick={handleCancel}
                  className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Save className="w-4 h-4" />
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

  {/* Hospitals List */}
      {loading ? (
        <div className="grid gap-4">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white rounded-lg shadow-sm border p-6 animate-pulse">
              <div className="h-6 w-40 bg-gray-200 rounded mb-4" />
              <div className="flex items-center gap-2 mb-3">
                <div className="w-4 h-4 bg-gray-200 rounded" />
                <div className="h-4 w-64 bg-gray-200 rounded" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-3">
                <div className="h-4 bg-gray-200 rounded" />
                <div className="h-4 bg-gray-200 rounded" />
                <div className="h-4 bg-gray-200 rounded" />
              </div>
              <div className="flex gap-6 items-center">
                <div className="h-4 w-32 bg-gray-200 rounded" />
                <div className="h-4 w-40 bg-gray-200 rounded" />
                <div className="h-6 w-20 bg-gray-200 rounded ml-auto" />
              </div>
            </div>
          ))}
        </div>
      ) : hospitals.length === 0 ? (
        <div className="bg-white rounded-lg shadow-sm border p-10 text-center">
          <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
            <MapPin className="w-6 h-6 text-gray-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No hospitals found</h3>
          <p className="text-gray-600 mb-4">Get started by adding your first hospital.</p>
          <button onClick={handleAdd} className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Add Hospital
          </button>
        </div>
      ) : (
        <div className="grid gap-4">
          {hospitals.map((hospital) => (
            <div key={hospital._id} className="bg-white rounded-lg shadow-sm border p-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
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
            </div>
        ))}
      </div>)}

      {/* Edit Hospital Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Edit Hospital</h2>
                <button onClick={handleCancel} className="text-gray-400 hover:text-gray-700 text-2xl">&times;</button>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <input type="text" placeholder="Hospital Name" value={editData.hospitalName || ''} onChange={e => setEditData({...editData, hospitalName: e.target.value})} className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500" />
                <PlacesAutocomplete value={editData.address as string} placeholder="Address" onSelect={({ address, lat, lng }) => setEditData({ ...editData, address: address, hospitalLocationGeo: (lat && lng) ? { type: 'Point', coordinates: [lng, lat] } : undefined })} />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                  <div className="flex w-full">
                    <span className="px-3 py-3 border rounded-l-lg bg-gray-100 text-sm text-gray-700 select-none">+91</span>
                    <input
                      type="tel"
                      placeholder="10-digit number"
                      value={editData.phoneNumber || ''}
                      onChange={e => {
                        const digits = e.target.value.replace(/\D/g, '').slice(0,10);
                        setEditData({...editData, phoneNumber: digits});
                        if (!digits) { setPhoneError(''); return; }
                        setPhoneError(isValidPhone(digits) ? '' : 'Enter a valid 10-digit phone number');
                      }}
                      className={`flex-1 px-3 py-3 border border-l-0 rounded-r-lg focus:ring-2 focus:ring-blue-500 ${phoneError ? 'border-red-500' : ''}`}
                    />
                  </div>
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
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="isVerifiedEdit" checked={!!editData.isVerified} onChange={e => setEditData({...editData, isVerified: e.target.checked })} className="w-4 h-4 text-blue-600" />
                  <label htmlFor="isVerifiedEdit" className="text-sm">Verified</label>
                </div>
              </div>
              <div className="flex gap-2 mt-6 justify-end">
                <button onClick={handleCancel} className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50"><X className="w-4 h-4" /> Cancel</button>
                <button
                  onClick={handleSave}
                  disabled={!hasChanges() || emailError !== '' || phoneError !== ''}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                    hasChanges() && !emailError && !phoneError
                      ? 'bg-green-600 text-white hover:bg-green-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                >
                  <Save className="w-4 h-4" /> Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && hospitals.length > 0 && (
        <div className="flex justify-center items-center mt-6 gap-4">
          <button
            className="px-3 py-2 bg-gray-100 rounded disabled:opacity-50 flex items-center hover:bg-gray-200"
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            aria-label="Previous page"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <span className="mx-2 font-medium">Page {currentPage} of {totalPages}</span>

          <button
            className="px-3 py-2 bg-gray-100 rounded disabled:opacity-50 flex items-center hover:bg-gray-200"
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            aria-label="Next page"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      )}
    </div>
    );
  }