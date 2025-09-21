import  { useState } from 'react';
import { Calendar, Filter, Download, Eye } from 'lucide-react';

interface DonationHistoryProps {
  userRole: 'admin' | 'hospital' | 'donor';
}

export default function DonationHistory({ userRole }: DonationHistoryProps) {
  const [filterType, setFilterType] = useState('all');
  const [dateRange, setDateRange] = useState('month');

  const donations = [
    { id: 1, donor: 'John Smith', bloodType: 'O+', date: '2024-01-15', hospital: 'City General Hospital', units: 1, status: 'Completed' },
    { id: 2, donor: 'Sarah Johnson', bloodType: 'A-', date: '2024-01-14', hospital: 'Regional Medical Center', units: 1, status: 'Completed' },
    { id: 3, donor: 'Mike Davis', bloodType: 'B+', date: '2024-01-13', hospital: 'Community Health Center', units: 1, status: 'Processing' },
    { id: 4, donor: 'Emily Wilson', bloodType: 'AB+', date: '2024-01-12', hospital: 'City General Hospital', units: 1, status: 'Completed' },
    { id: 5, donor: 'David Brown', bloodType: 'O-', date: '2024-01-11', hospital: 'Regional Medical Center', units: 1, status: 'Completed' },
  ];

  const filteredDonations = donations.filter(donation => {
    if (filterType === 'all') return true;
    return donation.bloodType === filterType;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-3xl font-bold text-gray-900">Donation History</h2>
        <div className="flex space-x-4">
          <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center space-x-2">
            <Download size={20} />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Hero Image */}
      <div className="relative h-48 bg-gradient-to-r from-blue-600 to-blue-800 rounded-lg overflow-hidden">
        <img 
          src="https://images.unsplash.com/photo-1615461066159-fea0960485d5?ixid=M3w3MjUzNDh8MHwxfHNlYXJjaHwzfHxibG9vZCUyMGRvbmF0aW9uJTIwbWVkaWNhbCUyMGhlYWx0aGNhcmV8ZW58MHx8fHwxNzU4NDMxMjE4fDA&ixlib=rb-4.1.0&fit=fillmax&h=800&w=1200"
          alt="Blood donation process"
          className="w-full h-full object-cover opacity-30"
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="text-center text-white">
            <h3 className="text-3xl font-bold mb-2">Track Every Donation</h3>
            <p className="text-lg">Complete history of all blood donations and their impact</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4">
        <div className="flex items-center space-x-2">
          <Filter size={20} className="text-gray-500" />
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="all">All Blood Types</option>
            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center space-x-2">
          <Calendar size={20} className="text-gray-500" />
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <option value="week">This Week</option>
            <option value="month">This Month</option>
            <option value="quarter">This Quarter</option>
            <option value="year">This Year</option>
          </select>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Total Donations</h3>
          <p className="text-3xl font-bold text-red-600">1,247</p>
          <p className="text-sm text-gray-600">+15% from last month</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Blood Units</h3>
          <p className="text-3xl font-bold text-blue-600">1,247</p>
          <p className="text-sm text-gray-600">Lives potentially saved</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Active Donors</h3>
          <p className="text-3xl font-bold text-green-600">892</p>
          <p className="text-sm text-gray-600">Regular contributors</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Success Rate</h3>
          <p className="text-3xl font-bold text-purple-600">98.5%</p>
          <p className="text-sm text-gray-600">Successful donations</p>
        </div>
      </div>

      {/* Donations Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Donor</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Blood Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Hospital</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Units</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {filteredDonations.map((donation) => (
              <tr key={donation.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 text-sm font-medium text-gray-900">{donation.donor}</td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                    {donation.bloodType}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">{donation.date}</td>
                <td className="px-6 py-4 text-sm text-gray-900">{donation.hospital}</td>
                <td className="px-6 py-4 text-sm text-gray-900">{donation.units}</td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    donation.status === 'Completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {donation.status}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <button className="text-blue-600 hover:text-blue-900">
                    <Eye size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
 