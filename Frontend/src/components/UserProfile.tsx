import  React, { useState } from 'react';
import { updateUserProfile } from '../utils/axios';
import { User, Phone, Mail, Camera, FileText, History, Edit2, Save } from 'lucide-react';

interface UserData {
  id: string;
  firstName: string;
  lastName?: string;
  email: string;
  phone: string;
  bloodGroup?: string;
  address?: string;
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
  const [editData, setEditData] = useState({
    firstName: user.firstName,
    lastName: user.lastName,
    phone: user.phone,
    email: user.email,
    address: (user as any).address || '',
    height: (user as any).height || '',
    weight: (user as any).weight || '',
    dateofBirth: (user as any).dateofBirth ? new Date((user as any).dateofBirth).toISOString().slice(0,10) : '',
  });
  const [showHealthHistory, setShowHealthHistory] = useState(false);

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
      height: editData.height,
      weight: editData.weight,
      dateofBirth: editData.dateofBirth,
    };
    updateUserProfile(user.id, payload)
      .then(() => {
        onUpdate?.({
          firstName: editData.firstName,
          lastName: editData.lastName,
          address: editData.address,
          height: editData.height,
          weight: editData.weight,
          dateofBirth: editData.dateofBirth,
        });
        setIsEditing(false);
      })
      .catch(() => {
        // Optionally show error
      });
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onUpdate?.({ photo: url });
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
            <div className="w-24 h-24 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
              {user.photo ? (
                <img src={user.photo} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-12 h-12 text-gray-400" />
              )}
            </div>
            {isOwnProfile && (
              <label className="absolute bottom-0 right-0 bg-blue-600 rounded-full p-1.5 cursor-pointer hover:bg-blue-700">
                <Camera className="w-4 h-4 text-white" />
                <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
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
              <input
                type="text"
                value={editData.address}
                onChange={(e) => setEditData({...editData, address: e.target.value})}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            ) : (
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <span>{user.address || '-'}</span>
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
 