import  React, { useState, useEffect } from 'react';
import PlacesAutocomplete from './PlacesAutocomplete';
import { Plus, Edit2, Trash, Save, X, MapPin, Phone, Mail } from 'lucide-react';
import { getAllHospitals, createHospital, updateHospital, deleteHospital } from '../utils/axios';

interface Hospital {
  _id: string;
  hospitalId?: string; // now string identifier supplied by backend
  hospitalName: string;
  regNo: number;
  contactName: string;
  email: string;
  phoneNumber: string;
  address: string;
  city: string;
  state: string;
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


  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editData, setEditData] = useState<Partial<Hospital>>({});

  const handleEdit = (hospital: Hospital) => {
  setIsEditing(hospital._id);
    setEditData(hospital);
  };

  const handleAdd = () => {
    setIsAdding(true);
    setEditData({
      hospitalName: '',
      regNo: 0,
      contactName: '',
      email: '',
      phoneNumber: '',
      address: '',
      city: '',
      state: '',
      pincode: '',
      isVerified: false,
    });
  };

  const handleSave = async () => {
    if (isAdding) {
      const newHospital: Hospital = {
        ...(editData as Hospital),
        // _id: Date.now().toString()
      };
      try {
        const res:any = await createHospital(newHospital);
        // push the created hospital returned from server (with _id)
        setHospitals([...hospitals, res.data]);
      } catch (err) {
        // handle error (show toast, etc)
      }
      setIsAdding(false);
    } else if (isEditing) {
      try {
        const res:any = await updateHospital(isEditing, editData as Hospital);
        setHospitals(hospitals.map(h => h._id === isEditing ? res.data : h));
      } catch (err) {
        // handle error (show toast, etc)
      }
      setIsEditing(null);
    }
    setEditData({});
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
            <input
              type="tel"
              placeholder="Phone Number"
              value={editData.phoneNumber || ''}
              onChange={(e) => setEditData({...editData, phoneNumber: e.target.value})}
              className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="email"
              placeholder="Email"
              value={editData.email || ''}
              onChange={(e) => setEditData({...editData, email: e.target.value})}
              className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="number"
              placeholder="Reg No"
              value={editData.regNo || ''}
              onChange={(e) => setEditData({...editData, regNo: parseInt(e.target.value)})}
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
              placeholder="City"
              value={editData.city || ''}
              onChange={(e) => setEditData({...editData, city: e.target.value})}
              className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="State"
              value={editData.state || ''}
              onChange={(e) => setEditData({...editData, state: e.target.value})}
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
            {/* Removed bloodBankAvailable field as per new API model */}
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
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
                    <input type="text" placeholder="Address" value={editData.address || ''} onChange={e => setEditData({...editData, address: e.target.value})} className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500" />
                      <PlacesAutocomplete value={editData.address as string} placeholder="Address" onSelect={({ address, lat, lng }) => setEditData({ ...editData, address: address, hospitalLocationGeo: (lat && lng) ? { type: 'Point', coordinates: [lng, lat] } : undefined })} />
                    <input type="tel" placeholder="Phone Number" value={editData.phoneNumber || ''} onChange={e => setEditData({...editData, phoneNumber: e.target.value})} className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500" />
                    <input type="email" placeholder="Email" value={editData.email || ''} onChange={e => setEditData({...editData, email: e.target.value})} className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500" />
                    <input type="number" placeholder="Reg No" value={editData.regNo || ''} onChange={e => setEditData({...editData, regNo: parseInt(e.target.value)})} className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500" />
                    <input type="text" placeholder="Contact Name" value={editData.contactName || ''} onChange={e => setEditData({...editData, contactName: e.target.value})} className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500" />
                    <input type="text" placeholder="City" value={editData.city || ''} onChange={e => setEditData({...editData, city: e.target.value})} className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500" />
                    <input type="text" placeholder="State" value={editData.state || ''} onChange={e => setEditData({...editData, state: e.target.value})} className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500" />
                    <input type="text" placeholder="Pincode" value={editData.pincode || ''} onChange={e => setEditData({...editData, pincode: e.target.value})} className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500" />
                    <div className="flex items-center gap-2">
                      <input type="checkbox" id="isVerifiedEdit" checked={!!editData.isVerified} onChange={e => setEditData({...editData, isVerified: e.target.checked })} className="w-4 h-4 text-blue-600" />
                      <label htmlFor="isVerifiedEdit" className="text-sm">Verified</label>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"><Save className="w-4 h-4" /> Save</button>
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
                      <div>City: <span className="font-semibold">{hospital.city}</span></div>
                      <div>State: <span className="font-semibold">{hospital.state}</span></div>
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