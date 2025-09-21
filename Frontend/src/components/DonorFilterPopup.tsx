import  React, { useState, useEffect } from 'react';
import { X, MapPin, Droplet, Users, Send } from 'lucide-react';

interface Donor {
  id: string;
  name: string;
  location: string;
  bloodType: string;
  isEligible: boolean;
  lastDonation: string;
}

interface DonorFilterPopupProps {
  isOpen: boolean;
  onClose: () => void;
  requestLocation: string;
  requestBloodType: string;
}

export const DonorFilterPopup: React.FC<DonorFilterPopupProps> = ({
  isOpen,
  onClose,
  requestLocation,
  requestBloodType
}) => {
  const [donors, setDonors] = useState<Donor[]>([]);
  const [selectedDonors, setSelectedDonors] = useState<string[]>([]);
  const [filterStep, setFilterStep] = useState<'location' | 'eligible' | 'bloodType'>('location');

  const mockDonors: Donor[] = [
    { id: '1', name: 'John Doe', location: 'Downtown', bloodType: 'A+', isEligible: true, lastDonation: '2024-01-15' },
    { id: '2', name: 'Jane Smith', location: 'Downtown', bloodType: 'O+', isEligible: true, lastDonation: '2024-02-20' },
    { id: '3', name: 'Mike Johnson', location: 'Uptown', bloodType: 'A+', isEligible: false, lastDonation: '2024-03-10' },
    { id: '4', name: 'Sarah Wilson', location: 'Downtown', bloodType: 'A+', isEligible: true, lastDonation: '2024-01-30' }
  ];

  useEffect(() => {
    if (isOpen) {
      setDonors(mockDonors);
      setSelectedDonors([]);
      setFilterStep('location');
    }
  }, [isOpen]);

  const getFilteredDonors = () => {
    let filtered = donors;
    
    if (filterStep === 'location' || filterStep === 'eligible' || filterStep === 'bloodType') {
      filtered = filtered.filter(donor => donor.location === requestLocation);
    }
    
    if (filterStep === 'eligible' || filterStep === 'bloodType') {
      filtered = filtered.filter(donor => donor.isEligible);
    }
    
    if (filterStep === 'bloodType') {
      filtered = filtered.filter(donor => donor.bloodType === requestBloodType);
    }
    
    return filtered;
  };

  const handleSelectAll = () => {
    const filteredDonors = getFilteredDonors();
    const allIds = filteredDonors.map(donor => donor.id);
    setSelectedDonors(allIds);
  };

  const handleSendNotifications = () => {
    console.log('Sending notifications to:', selectedDonors);
    onClose();
  };

  const filteredDonors = getFilteredDonors();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl mx-4 max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-semibold">Filter Donors</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="flex items-center gap-4 mb-6">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              <span className="text-sm">Location: {requestLocation}</span>
            </div>
            <div className="flex items-center gap-2">
              <Droplet className="w-4 h-4 text-red-600" />
              <span className="text-sm">Blood Type: {requestBloodType}</span>
            </div>
          </div>

          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setFilterStep('location')}
              className={`px-4 py-2 rounded ${filterStep === 'location' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            >
              By Location ({donors.filter(d => d.location === requestLocation).length})
            </button>
            <button
              onClick={() => setFilterStep('eligible')}
              className={`px-4 py-2 rounded ${filterStep === 'eligible' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            >
              Eligible ({donors.filter(d => d.location === requestLocation && d.isEligible).length})
            </button>
            <button
              onClick={() => setFilterStep('bloodType')}
              className={`px-4 py-2 rounded ${filterStep === 'bloodType' ? 'bg-blue-600 text-white' : 'bg-gray-200'}`}
            >
              Blood Type Match ({donors.filter(d => d.location === requestLocation && d.isEligible && d.bloodType === requestBloodType).length})
            </button>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {filteredDonors.length} donors found
            </span>
            <button
              onClick={handleSelectAll}
              className="px-3 py-1 bg-gray-100 rounded text-sm hover:bg-gray-200"
            >
              Select All
            </button>
          </div>

          <div className="max-h-64 overflow-y-auto border rounded">
            {filteredDonors.map(donor => (
              <div key={donor.id} className="flex items-center p-3 border-b hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={selectedDonors.includes(donor.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedDonors([...selectedDonors, donor.id]);
                    } else {
                      setSelectedDonors(selectedDonors.filter(id => id !== donor.id));
                    }
                  }}
                  className="mr-3"
                />
                <div className="flex-1">
                  <div className="font-medium">{donor.name}</div>
                  <div className="text-sm text-gray-600">
                    {donor.location} • {donor.bloodType} • 
                    {donor.isEligible ? ' Eligible' : ' Not Eligible'} • 
                    Last donation: {donor.lastDonation}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-between items-center mt-6">
            <span className="text-sm text-gray-600">
              {selectedDonors.length} donors selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSendNotifications}
                disabled={selectedDonors.length === 0}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                <Send className="w-4 h-4" />
                Send Notifications ({selectedDonors.length})
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
 