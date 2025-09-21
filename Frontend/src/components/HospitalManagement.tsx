import  React, { useState } from 'react';
import { Plus, Edit2, Trash, Save, X, MapPin, Phone, Mail } from 'lucide-react';

interface Hospital {
  id: string;
  name: string;
  address: string;
  phone: string;
  email: string;
  capacity: number;
  bloodBankAvailable: boolean;
}

export const HospitalManagement: React.FC = () => {
  const [hospitals, setHospitals] = useState<Hospital[]>([
    {
      id: '1',
      name: 'City General Hospital',
      address: '123 Medical Center Dr',
      phone: '+1 555-0123',
      email: 'contact@citygeneral.com',
      capacity: 500,
      bloodBankAvailable: true
    },
    {
      id: '2',
      name: 'Regional Medical Center',
      address: '456 Health Ave',
      phone: '+1 555-0456',
      email: 'info@regionalmc.com',
      capacity: 300,
      bloodBankAvailable: false
    }
  ]);

  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editData, setEditData] = useState<Partial<Hospital>>({});

  const handleEdit = (hospital: Hospital) => {
    setIsEditing(hospital.id);
    setEditData(hospital);
  };

  const handleAdd = () => {
    setIsAdding(true);
    setEditData({
      name: '',
      address: '',
      phone: '',
      email: '',
      capacity: 0,
      bloodBankAvailable: false
    });
  };

  const handleSave = () => {
    if (isAdding) {
      const newHospital: Hospital = {
        id: Date.now().toString(),
        ...editData as Hospital
      };
      setHospitals([...hospitals, newHospital]);
      setIsAdding(false);
    } else if (isEditing) {
      setHospitals(hospitals.map(h => 
        h.id === isEditing ? { ...h, ...editData } : h
      ));
      setIsEditing(null);
    }
    setEditData({});
  };

  const handleCancel = () => {
    setIsEditing(null);
    setIsAdding(false);
    setEditData({});
  };

  const handleDelete = (id: string) => {
    if (confirm('Are you sure you want to delete this hospital?')) {
      setHospitals(hospitals.filter(h => h.id !== id));
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
              value={editData.name || ''}
              onChange={(e) => setEditData({...editData, name: e.target.value})}
              className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Address"
              value={editData.address || ''}
              onChange={(e) => setEditData({...editData, address: e.target.value})}
              className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="tel"
              placeholder="Phone Number"
              value={editData.phone || ''}
              onChange={(e) => setEditData({...editData, phone: e.target.value})}
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
              placeholder="Capacity"
              value={editData.capacity || ''}
              onChange={(e) => setEditData({...editData, capacity: parseInt(e.target.value)})}
              className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="bloodBank"
                checked={editData.bloodBankAvailable || false}
                onChange={(e) => setEditData({...editData, bloodBankAvailable: e.target.checked})}
                className="w-4 h-4 text-blue-600"
              />
              <label htmlFor="bloodBank" className="text-sm">Blood Bank Available</label>
            </div>
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
      <div className="grid gap-4">
        {hospitals.map((hospital) => (
          <div key={hospital.id} className="bg-white rounded-lg shadow-sm border p-6">
            {isEditing === hospital.id ? (
              <div>
                <div className="grid md:grid-cols-2 gap-4 mb-4">
                  <input
                    type="text"
                    value={editData.name || ''}
                    onChange={(e) => setEditData({...editData, name: e.target.value})}
                    className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="text"
                    value={editData.address || ''}
                    onChange={(e) => setEditData({...editData, address: e.target.value})}
                    className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="tel"
                    value={editData.phone || ''}
                    onChange={(e) => setEditData({...editData, phone: e.target.value})}
                    className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="email"
                    value={editData.email || ''}
                    onChange={(e) => setEditData({...editData, email: e.target.value})}
                    className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="number"
                    value={editData.capacity || ''}
                    onChange={(e) => setEditData({...editData, capacity: parseInt(e.target.value)})}
                    className="p-3 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={editData.bloodBankAvailable || false}
                      onChange={(e) => setEditData({...editData, bloodBankAvailable: e.target.checked})}
                      className="w-4 h-4 text-blue-600"
                    />
                    <label className="text-sm">Blood Bank Available</label>
                  </div>
                </div>
                <div className="flex gap-2">
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
            ) : (
              <div>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold">{hospital.name}</h3>
                    <div className="flex items-center gap-1 text-gray-600 mt-1">
                      <MapPin className="w-4 h-4" />
                      <span>{hospital.address}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleEdit(hospital)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(hospital.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <Trash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                
                <div className="grid md:grid-cols-3 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <span>{hospital.phone}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <span>{hospital.email}</span>
                  </div>
                  <div>
                    <span className="font-medium">Capacity: </span>
                    <span>{hospital.capacity} beds</span>
                  </div>
                </div>
                
                <div className="mt-3">
                  <span className={`inline-block px-3 py-1 rounded-full text-xs ${
                    hospital.bloodBankAvailable 
                      ? 'bg-green-100 text-green-700' 
                      : 'bg-gray-100 text-gray-700'
                  }`}>
                    {hospital.bloodBankAvailable ? 'Blood Bank Available' : 'No Blood Bank'}
                  </span>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );