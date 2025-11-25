import  React, { useState, useEffect } from 'react';
import { updateUserProfile, uploadProfilePhoto } from '../utils/axios';
import PlacesAutocomplete from './PlacesAutocomplete';
import MapPicker from './MapPicker';
import { User, Phone, Mail, Camera, FileText, History, Edit2, Save, MapPin } from 'lucide-react';

interface UserData {
  id: string;
  firstName: string;
  lastName?: string;
  email: string;
  phone: string;
  bloodGroup?: string;
  address?: string;
  locationName?: string;
  latitude?: number | null;
  longitude?: number | null;
  locationGeo?: { type: string; coordinates: number[] };
  adminEmail?: string;
  height?: number | string;
  weight?: number | string;
  dateofBirth?: string;
  photo?: string;
  role: 'donor' | 'admin' | 'user';
  healthReport?: {
    date: string;
    status: string;
    details: string;
  };
}

interface UserProfileProps {
  user: UserData;
  isOwnProfile?: boolean;
  onUpdate?: (data: Partial<UserData>) => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({ 
  user, 
  isOwnProfile = false, 
  onUpdate 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>({
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    email: user.email,
    address: (user as any).address || '',
    locationName: (user as any).locationName || '',
    latitude: (user as any).locationGeo && Array.isArray((user as any).locationGeo.coordinates) ? (user as any).locationGeo.coordinates[1] : null,
    longitude: (user as any).locationGeo && Array.isArray((user as any).locationGeo.coordinates) ? (user as any).locationGeo.coordinates[0] : null,
    height: (user as any).height || '',
    weight: (user as any).weight || '',
    dateofBirth: (user as any).dateofBirth ? new Date((user as any).dateofBirth).toISOString().slice(0,10) : '',
  });
  const [showHealthHistory, setShowHealthHistory] = useState(false);
  const [showMap, setShowMap] = useState<boolean>(false);
  const [uploadingPhoto, setUploadingPhoto] = useState<boolean>(false);
  const [localPhotoPreview, setLocalPhotoPreview] = useState<string | null>(null);

  // clear local preview when server photo is set or on unmount
  useEffect(() => {
    if (user.photo && localPhotoPreview) {
      try { URL.revokeObjectURL(localPhotoPreview); } catch (e) { /* ignore */ }
      setLocalPhotoPreview(null);
    }
  }, [user.photo]);

  useEffect(() => {
    return () => {
      if (localPhotoPreview) {
        try { URL.revokeObjectURL(localPhotoPreview); } catch (e) { /* ignore */ }
      }
    };
  }, []);

  const healthHistory = [
    { date: '2024-01-15', status: 'Healthy', details: 'All parameters normal' },
    { date: '2024-02-20', status: 'Healthy', details: 'Good health condition' },
    { date: '2024-03-10', status: 'Minor issues', details: 'Low iron levels' }
  ];

  const handleSave = () => {
    const payload: any = {
      firstName: editData.firstName,
      lastName: editData.lastName,
      // Only allow updating first/last name and address via this UI
      address: editData.address,
      latitude: typeof editData.latitude === 'number' ? editData.latitude : undefined,
      longitude: typeof editData.longitude === 'number' ? editData.longitude : undefined,
      locationGeo: (typeof editData.latitude === 'number' && typeof editData.longitude === 'number') ? { type: 'Point', coordinates: [editData.longitude, editData.latitude] } : undefined,
      locationName: editData.locationName || undefined,
      height: editData.height,
      weight: editData.weight,
      dateofBirth: editData.dateofBirth,
    };
    updateUserProfile(user.id, payload)
      .then((res:any) => {
        const data = res.data || {};
        onUpdate?.({
          firstName: data.firstName ?? editData.firstName,
          lastName: data.lastName ?? editData.lastName,
          address: data.address ?? editData.address,
          height: data.height ?? editData.height,
          weight: data.weight ?? editData.weight,
          dateofBirth: data.dateofBirth ?? editData.dateofBirth,
          latitude: editData.latitude ?? data.latitude,
          longitude: editData.longitude ?? data.longitude,
          locationGeo: data.locationGeo ?? (typeof editData.latitude === 'number' && typeof editData.longitude === 'number' ? { type: 'Point', coordinates: [editData.longitude, editData.latitude]} : undefined),
        });
        setIsEditing(false);
      })
      .catch(() => {
        // Optionally show error
      });
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && isOwnProfile) {
      // create a local preview immediately so users see the selected image
      try {
        if (localPhotoPreview) URL.revokeObjectURL(localPhotoPreview);
      } catch (er) { /* ignore */ }
      const previewUrl = URL.createObjectURL(file);
      setLocalPhotoPreview(previewUrl);
      onUpdate?.({ photo: previewUrl });
      setUploadingPhoto(true);
      const _token = localStorage.getItem('token');
      console.log('Starting photo upload', { userId: user.id, tokenPresent: !!_token, fileName: file.name, fileSize: file.size });
      try {
        const res: any = await uploadProfilePhoto(user.id, file);
        console.log('Upload response', res && res.data);
        const photoUrl = res.data && res.data.photo ? res.data.photo : res.data?.user?.photo;
        if (photoUrl) onUpdate?.({ photo: photoUrl });
        // we no longer need the local preview after server returns the hosted url
        if (localPhotoPreview) {
          try { URL.revokeObjectURL(localPhotoPreview); } catch (e) { /*ignore*/ }
          setLocalPhotoPreview(null);
        }
      } catch (err) {
        console.warn('Photo upload failed', err);
        // fall back to local preview
        // local preview is already set
      } finally {
        setUploadingPhoto(false);
      }
    }
  };

  // Parse phone into country code and local number for display
  const parsePhone = (phone?: string) => {
    if (!phone) return { country: '+91', number: '' };
    const p = phone.replace(/\s+/g, '');
    if (p.startsWith('+')) {
      if (p.startsWith('+91')) return { country: '+91', number: p.slice(3) };
      // fallback: take first 3 chars as country
      return { country: p.slice(0, 3), number: p.slice(3) };
    }
    if (p.startsWith('91') && p.length > 10) {
      return { country: '+91', number: p.slice(2) };
    }
    // default to +91 and full number
    return { country: '+91', number: p };
  }; 
  // Read admin email directly from environment (Vite) instead of user object
  const adminEmail = (import.meta as any).env?.ADMIN_EMAIL || 'admin@yourdomain.com';
  // console.log("Admin email (env):", adminEmail);
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Profile Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center gap-6">
          <div className="relative">
              <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden relative">
              {localPhotoPreview || user.photo ? (
                <img src={localPhotoPreview ?? user.photo} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-12 h-12 text-gray-400" />
              )}
              {uploadingPhoto && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/40">
                  <div className="w-6 h-6 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin" />
                </div>
              )}
            </div>
            {isOwnProfile && (
              <label className="absolute bottom-0 right-0 bg-blue-600 rounded-full p-1.5 cursor-pointer hover:bg-blue-700">
                <Camera className="w-4 h-4 text-white" />
                <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                {uploadingPhoto && <span className="sr-only">Uploading...</span>}
              </label>
            )}
          </div>
          
          <div className="flex-1">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl font-bold">{user.firstName}{user.lastName ? ` ${user.lastName}` : ''}</h1>
              {isOwnProfile && (
                <button
                  onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  {isEditing ? <Save className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                  {isEditing ? 'Save' : 'Edit Profile'}
                </button>
              )}
            </div>
            <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm capitalize">
              {user.role}
            </span>
          </div>
        </div>
      </div>

      {/* Profile Information */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-lg font-semibold mb-4">Personal Information</h2>
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-100 text-yellow-800 rounded">
          To change <strong>email</strong>, <strong>phone</strong>, or <strong>blood group</strong>, contact admin at{' '}
          <a className="underline font-medium" href={`mailto:${adminEmail}`}>
            {adminEmail}
          </a>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
            {isEditing ? (
              <input
                type="text"
                value={editData.firstName}
                onChange={(e) => setEditData({...editData, firstName: e.target.value})}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            ) : (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <User className="w-4 h-4 text-gray-400" />
                <span>{user.firstName}</span>
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
            {isEditing ? (
              <input
                type="text"
                value={editData.lastName}
                onChange={(e) => setEditData({...editData, lastName: e.target.value})}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            ) : (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <User className="w-4 h-4 text-gray-400" />
                <span>{user.lastName || '-'}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <Phone className="w-4 h-4 text-gray-400" />
              {(() => {
                const { country, number } = parsePhone(user.phone);
                return (
                  <div className="flex items-center">
                    <div className="px-2 py-1 bg-gray-100 text-sm text-gray-700 rounded-l border">{country}</div>
                    <div className="px-3 py-1 bg-gray-50 text-sm text-gray-900 border-l">{number || '-'}</div>
                  </div>
                );
              })()}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <Mail className="w-4 h-4 text-gray-400" />
              <span>{user.email}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Blood Group</label>
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
              <span className="text-gray-700">{user.bloodGroup || '-'}</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
            {isEditing ? (
              <div>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <PlacesAutocomplete
                    value={editData.address}
                    placeholder="Search location"
                    className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent h-12"
                    onSelect={({ address, name, lat, lng }) => setEditData({ ...editData, address: address || '', locationName: name || editData.locationName, latitude: typeof lat === 'number' ? lat : editData.latitude, longitude: typeof lng === 'number' ? lng : editData.longitude })}
                  />
                </div>
                {typeof editData.latitude === 'number' && typeof editData.longitude === 'number' && (
                  <div className="text-xs text-gray-500 mt-1">Coordinates: {editData.latitude.toFixed(6)}, {editData.longitude.toFixed(6)}</div>
                )}
                <div className="mt-2">
                  <label className="sr-only">Location name</label>
                  <input
                    type="text"
                    value={editData.locationName || ''}
                    onChange={(e) => setEditData({ ...editData, locationName: e.target.value })}
                    placeholder="Location name (optional)"
                    className="w-full mt-2 p-2 border rounded-lg bg-white"
                  />
                </div>
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => setShowMap((s) => !s)}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    {showMap ? 'Hide map' : 'Verify pin on map'}
                  </button>
                  {showMap && (
                    <div className="mt-3 bg-gray-50 p-2 rounded">
                      <MapPicker
                        lat={editData.latitude ?? 0}
                        lng={editData.longitude ?? 0}
                        onChange={(lat, lng) => setEditData({ ...editData, latitude: lat, longitude: lng })}
                      />
                    </div>
                  )}
                </div>
              </div>
            ) : (
                <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-semibold">{user.locationName || user.address || '-'}</div>
                  <div className="text-xs text-gray-500">{user.address || ''}</div>
                </div>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
            {isEditing ? (
              <input
                type="date"
                value={(editData as any).dateofBirth}
                onChange={(e) => setEditData({...editData, dateofBirth: e.target.value})}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            ) : (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <span>{user.dateofBirth ? new Date(user.dateofBirth).toLocaleDateString() : '-'}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Height</label>
            {isEditing ? (
              <div className="flex items-center w-full">
                <input
                  type="number"
                  value={(editData as any).height}
                  onChange={(e) => setEditData({...editData, height: e.target.value})}
                  className="flex-1 min-w-0 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {((editData as any).height !== undefined && (editData as any).height !== null && String((editData as any).height).trim() !== '') && (
                  <span className="ml-2 text-sm text-gray-600">cm</span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <span>{(user.height !== undefined && user.height !== null && String(user.height).trim() !== '') ? `${user.height} cm` : '-'}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Weight</label>
            {isEditing ? (
              <div className="flex items-center w-full">
                <input
                  type="number"
                  value={(editData as any).weight}
                  onChange={(e) => setEditData({...editData, weight: e.target.value})}
                  className="flex-1 min-w-0 p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                {((editData as any).weight !== undefined && (editData as any).weight !== null && String((editData as any).weight).trim() !== '') && (
                  <span className="ml-2 text-sm text-gray-600">kg</span>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <span>{(user.weight !== undefined && user.weight !== null && String(user.weight).trim() !== '') ? `${user.weight} kg` : '-'}</span>
              </div>
            )}
          </div>

        </div>

        {isEditing && (
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
            >
              Save Changes
            </button>
            <button
              onClick={() => setIsEditing(false)}
              className="px-4 py-2 border rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Health Information - For Donors */}
      {(user.role === 'donor' || user.role === 'admin') && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Health Information</h2>
            {user.role === 'admin' && (
              <button
                onClick={() => setShowHealthHistory(!showHealthHistory)}
                className="flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200"
              >
                <History className="w-4 h-4" />
                Health History
              </button>
            )}
          </div>

          {user.healthReport && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <FileText className="w-5 h-5 text-green-600" />
                <span className="font-medium">Latest Health Report</span>
              </div>
              <div className="text-sm text-gray-600">
                <p>Date: {user.healthReport.date}</p>
                <p>Status: <span className="font-medium text-green-700">{user.healthReport.status}</span></p>
                <p>Details: {user.healthReport.details}</p>
              </div>
            </div>
          )}

          {/* Health History - Admin Only */}
          {showHealthHistory && user.role === 'admin' && (
            <div className="mt-4">
              <h3 className="font-medium mb-3">Complete Health History</h3>
              <div className="space-y-3">
                {healthHistory.map((report, index) => (
                  <div key={index} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-medium text-sm">{report.date}</span>
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        report.status === 'Healthy' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {report.status}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">{report.details}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
 