import React, { useEffect, useState } from 'react';
import { Users, Search, Filter, MapPin, Phone, Mail } from 'lucide-react';
import type { Donor } from '../types';
import { getAllDonors, getDonationHistoryByUser, getDonorsStats, getDonationEntriesStats } from '../utils/axios';

const DonorManagement: React.FC = () => {
  const [donors, setDonors] = useState<Donor[]>([]);
  const [donorHistories, setDonorHistories] = useState<Record<string, any>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [bloodTypeFilter, setBloodTypeFilter] = useState('all');
  const [eligibilityFilter, setEligibilityFilter] = useState('all');
  const [appliedFilters, setAppliedFilters] = useState({ bloodType: 'all', eligibility: 'all', search: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  // Stats states
  const [donorStats, setDonorStats] = useState<{ totalDonors: number; eligibleDonors: number; ineligibleDonors: number; totalSuccessDonations: number } | null>(null);
  const [donationStats, setDonationStats] = useState<{ eligibleDonors: number; ineligibleDonors: number; totalDonations: number } | null>(null);

  useEffect(() => {
    const fetchDonors = async () => {
      try {
        // Pass page and size to backend
        const response = await getAllDonors(currentPage, pageSize);
        const data = response.data as { donors: Donor[]; totalPages?: number };
        const donorList = data.donors;
        setDonors(donorList);
        setTotalPages(data.totalPages || 1);
        // Fetch donation history for each donor
        const histories: Record<string, any> = {};
        await Promise.all(
          donorList.map(async (donor) => {
            try {
              const historyRes = await getDonationHistoryByUser(donor._id);
              histories[donor._id] = historyRes.data;
            } catch {
              histories[donor._id] = null;
            }
          })
        );
        setDonorHistories(histories);
      } catch {
        setDonors([]);
      }
    };
    fetchDonors();
  }, [currentPage, pageSize]);

  // Fetch donor stats and donation history stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const donorStatsRes = await getDonorsStats();
  setDonorStats(donorStatsRes.data as { totalDonors: number; eligibleDonors: number; ineligibleDonors: number; totalSuccessDonations: number });
      } catch {
        setDonorStats(null);
      }
      try {
        const donationStatsRes = await getDonationEntriesStats();
  setDonationStats(donationStatsRes.data as { eligibleDonors: number; ineligibleDonors: number; totalDonations: number });
      } catch {
        setDonationStats(null);
      }
    };
    fetchStats();
  }, []);


  // Use backend pagination, but apply filters on current page
  const paginatedDonors = donors.filter(donor => {
    const matchesSearch = appliedFilters.search === '' || `${donor.name}`.toLowerCase().includes(appliedFilters.search.toLowerCase()) || donor.email.toLowerCase().includes(appliedFilters.search.toLowerCase());
    const matchesBloodType = appliedFilters.bloodType === 'all' || donor.bloodGroup === appliedFilters.bloodType;
    const history = donorHistories[donor._id];
    let eligibilityValue = 'N/A';
    if (history && typeof history === 'object' && typeof history.eligibility === 'string') {
      eligibilityValue = history.eligibility;
    }
    const matchesEligibility = appliedFilters.eligibility === 'all' ||
      (appliedFilters.eligibility === 'eligible' && eligibilityValue === 'eligible') ||
      (appliedFilters.eligibility === 'ineligible' && eligibilityValue === 'ineligible');
    return matchesSearch && matchesBloodType && matchesEligibility;
  });

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
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center"
            onClick={() => {
              setAppliedFilters({ bloodType: bloodTypeFilter, eligibility: eligibilityFilter, search: searchTerm });
              setCurrentPage(1);
            }}
          >
            <Filter className="w-4 h-4 mr-2" />
            Apply Filters
          </button>
        </div>
      </div>

      {/* Donors Grid */}
      <div className="grid gap-6">
        {paginatedDonors.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No donors found for selected filters.</div>
        ) : (
          paginatedDonors.map((donor) => {
            const history = donorHistories[donor._id];
            // Extract donation info
            let totalDonations = '-';
            let lastDonationDate = '-';
            let lastStatus = '-';
            let eligibility = { status: 'N/A', message: 'N/A' };
            if (history && typeof history === 'object' && Array.isArray(history.requests) && typeof history.count === 'number') {
              totalDonations = history.count.toString();
              eligibility.status = history.eligibility || 'N/A';
              eligibility.message = history.eligibility || 'N/A';
              if (history.requests.length > 0) {
                // Find latest Date
                const sorted = [...history.requests].sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime());
                lastDonationDate = sorted[0].Date ? new Date(sorted[0].Date).toLocaleDateString() : 'N/A';
                lastStatus = sorted[0].status || 'N/A';
              } else {
                lastDonationDate = 'N/A';
                lastStatus = 'N/A';
              }
            }
            return (
              <div key={donor._id} className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                      {donor.name ? donor.name[0] : ''}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-xl font-semibold text-gray-900">
                          {donor.name}
                        </h3>
                        <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-medium">
                          {donor.bloodGroup}
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
                          <span className="text-sm">{donor.phoneNumber}</span>
                        </div>
                        <div className="flex items-center space-x-2 text-gray-600">
                          <MapPin className="w-4 h-4" />
                          <span className="text-sm">{donor.address}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500">Total Donations</p>
                          <p className="font-semibold text-blue-600">{totalDonations}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Last Donation</p>
                          <p className="font-medium">{lastDonationDate}</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Weight</p>
                          <p className="font-medium">{donor.weight} kg</p>
                        </div>
                        <div>
                          <p className="text-gray-500">Last Status</p>
                          <p className="font-medium">{lastStatus}</p>
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
          })
        )}
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2 mt-6">
          <button
            className="px-3 py-1 rounded bg-gray-200"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage(currentPage - 1)}
          >
            Previous
          </button>
          <span className="px-2">Page {currentPage} of {totalPages}</span>
          <button
            className="px-3 py-1 rounded bg-gray-200"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage(currentPage + 1)}
          >
            Next
          </button>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 text-center">
          <div className="text-2xl font-bold text-blue-600">{donorStats ? donorStats.totalDonors : '-'}</div>
          <div className="text-sm text-gray-600">Total Donors</div>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 text-center">
          <div className="text-2xl font-bold text-green-600">
            {donorStats && donationStats ? (donorStats.totalDonors - donationStats.ineligibleDonors) : '-'}
          </div>
          <div className="text-sm text-gray-600">Eligible Donors</div>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 text-center">
          <div className="text-2xl font-bold text-red-600">
            {donationStats ? donationStats.totalDonations : '-'}
          </div>
          <div className="text-sm text-gray-600">Total Donations</div>
        </div>
        <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 text-center">
          <div className="text-2xl font-bold text-purple-600">
            {/* Placeholder for Active Notifications */}
            {donorStats ? donorStats.totalDonors : '-'}
          </div>
          <div className="text-sm text-gray-600">Active Notifications</div>
        </div>
      </div>
    </div>
  );
};

export default DonorManagement;
 