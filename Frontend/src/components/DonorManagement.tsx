import  React, { useState } from 'react';
import { Users, Search, Filter, MapPin, Calendar, Activity, Phone, Mail } from 'lucide-react';
import type { Donor, User } from '../types';

interface DonorManagementProps {
  userRole: string;
}

const DonorManagement: React.FC<DonorManagementProps> = ({ userRole }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [bloodTypeFilter, setBloodTypeFilter] = useState('all');
  const [eligibilityFilter, setEligibilityFilter] = useState('all');

  const donors: (Donor & User)[] = [
    {
      user_id: '1',
      first_name: 'John',
      last_name: 'Smith',
      username: 'johnsmith',
      email: 'john@email.com',
      phone_number: '+1-555-0123',
      password: '',
      blood_group: 'O+',
      role: 'donor',
      date_of_birth: '1990-05-15',
      created_at: '2024-01-01',
      is_active: true,
      last_donation_date: '2023-10-15',
      total_donations: 5,
      is_eligible: true,
      weight: 70,
      location: 'New York',
      notification_preferences: { sms: true, email: true }
    },
    {
      user_id: '2',
      first_name: 'Sarah',
      last_name: 'Johnson',
      username: 'sarahjohnson',
      email: 'sarah@email.com',
      phone_number: '+1-555-0124',
      password: '',
      blood_group: 'A-',
      role: 'donor',
      date_of_birth: '1985-08-22',
      created_at: '2024-01-05',
      is_active: true,
      last_donation_date: '2024-01-10',
      total_donations: 12,
      is_eligible: false,
      weight: 65,
      location: 'Boston',
      notification_preferences: { sms: false, email: true }
    }
  ];

  const filteredDonors = donors.filter(donor => {
    const matchesSearch = `${donor.first_name} ${donor.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         donor.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesBloodType = bloodTypeFilter === 'all' || donor.blood_group === bloodTypeFilter;
    const matchesEligibility = eligibilityFilter === 'all' || 
                              (eligibilityFilter === 'eligible' && donor.is_eligible) ||
                              (eligibilityFilter === 'ineligible' && !donor.is_eligible);
    return matchesSearch && matchesBloodType && matchesEligibility;
  });

  const getEligibilityStatus = (donor: Donor) => {
    if (!donor.last_donation_date) return { status: 'eligible', message: 'Never donated' };
    
    const lastDonation = new Date(donor.last_donation_date);
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
    
    if (lastDonation < threeMonthsAgo) {
      return { status: 'eligible', message: 'Eligible to donate' };
    } else {
      const nextEligible = new Date(lastDonation);
      nextEligible.setMonth(nextEligible.getMonth() + 3);
      return { 
        status: 'ineligible', 
        message: `Eligible from ${nextEligible.toDateString()}` 
      };
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <Users className="w-7 h-7 text-blue-600 mr-3" />
          Donor Management
        </h1>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-3 text-gray-400" />
            <input
              type="text"
              placeholder="Search donors..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={bloodTypeFilter}
            onChange={(e) => setBloodTypeFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Blood Types</option>
            <option value="O+">O+</option>
            <option value="O-">O-</option>
            <option value="A+">A+</option>
            <option value="A-">A-</option>
            <option value="B+">B+</option>
            <option value="B-">B-</option>
            <option value="AB+">AB+</option>
            <option value="AB-">AB-</option>
          </select>
          <select
            value={eligibilityFilter}
            onChange={(e) => setEligibilityFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Donors</option>
            <option value="eligible">Eligible</option>
            <option value="ineligible">Ineligible</option>
          </select>
          <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center">
            <Filter className="w-4 h-4 mr-2" />
            Apply Filters
          </button>
        </div>
      </div>

      {/* Donors Grid */}
      <div className="grid gap-6">
        {filteredDonors.map((donor) => {
          const eligibility = getEligibilityStatus(donor);
          return (
            <div key={donor.user_id} className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-4 flex-1">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                    {donor.first_name[0]}{donor.last_name[0]}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-xl font-semibold text-gray-900">
                        {donor.first_name} {donor.last_name}
                      </h3>
                      <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                        {donor.blood_group}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        eligibility.status === 'eligible' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {eligibility.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="flex items-center space-x-2 text-gray-600">
                        <Mail className="w-4 h-4" />
                        <span className="text-sm">{donor.email}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-gray-600">
                        <Phone className="w-4 h-4" />
                        <span className="text-sm">{donor.phone_number}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-gray-600">
                        <MapPin className="w-4 h-4" />
                        <span className="text-sm">{donor.location}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Total Donations</p>
                        <p className="font-semibold text-blue-600">{donor.total_donations}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Last Donation</p>
                        <p className="font-medium">
                          {donor.last_donation_date ? new Date(donor.last_donation_date).toDateString() : 'Never'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500">Weight</p>
                        <p className="font-medium">{donor.weight} kg</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Status</p>
                        <p className="font-medium">{eligibility.message}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-2">
                  {eligibility.status === 'eligible' && (
                    <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 text-sm">
                      Notify for Donation
                    </button>
                  )}
                  <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm">
                    View Profile
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 text-center">
          <div className="text-2xl font-bold text-blue-600">{donors.length}</div>
          <div className="text-sm text-gray-600">Total Donors</div>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 text-center">
          <div className="text-2xl font-bold text-green-600">
            {donors.filter(d => d.is_eligible).length}
          </div>
          <div className="text-sm text-gray-600">Eligible Donors</div>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 text-center">
          <div className="text-2xl font-bold text-red-600">
            {donors.reduce((sum, d) => sum + d.total_donations, 0)}
          </div>
          <div className="text-sm text-gray-600">Total Donations</div>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 text-center">
          <div className="text-2xl font-bold text-purple-600">
            {donors.filter(d => d.notification_preferences.sms && d.notification_preferences.email).length}
          </div>
          <div className="text-sm text-gray-600">Active Notifications</div>
        </div>
      </div>
    </div>
  );
};

export default DonorManagement;
 