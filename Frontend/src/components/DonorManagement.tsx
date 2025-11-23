import React, { useEffect, useState } from 'react';
import { Users, MapPin, Phone, Mail, Edit2, X, Save, ChevronLeft, ChevronRight } from 'lucide-react';
import type { Donor } from '../types';
import { getAllDonors, getDonorsStats, updateDonor } from '../utils/axios';

interface DonationManagementProps {
  userRole: string;
}

const DonorManagement: React.FC<DonationManagementProps> = ({ userRole }) => {
  const [donors, setDonors] = useState<Donor[]>([]);
  const [sortField, setSortField] = useState<'name' | 'bloodGroup' | ''>('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [appliedFilters, setAppliedFilters] = useState({ bloodType: 'all', eligibility: 'all', search: '' });
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10);
  const [totalPages, setTotalPages] = useState(1);
  // Stats states
  const [donorStats, setDonorStats] = useState<{ totalDonors: number; eligibleDonors: number; ineligibleDonors: number; totalSuccessDonations: number } | null>(null);
  // Sort menu popup state
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [sortModalOpen, setSortModalOpen] = useState(false);
  const [sortTempField, setSortTempField] = useState(sortField);
  const [sortTempOrder, setSortTempOrder] = useState(sortOrder);
  // Modal state for viewing/editing a donor
  const [selectedDonor, setSelectedDonor] = useState<Donor | null>(null);
  const [donorForm, setDonorForm] = useState<Partial<Donor> & { firstName?: string; lastName?: string; dateofBirth?: string }>({});
  const [saving, setSaving] = useState(false);
  const [modalErrors, setModalErrors] = useState<Record<string, string>>({});

  const openDonorModal = (donor: Donor) => {
    setSelectedDonor(donor);
    setDonorForm({
      // split name into first/last for editing
      firstName: donor.name ? donor.name.split(' ')[0] : '',
      lastName: donor.name ? donor.name.split(' ').slice(1).join(' ') : '',
      email: donor.email,
      phoneNumber: donor.phoneNumber ? String(donor.phoneNumber).replace(/\D/g, '').slice(-10) : '',
      bloodGroup: donor.bloodGroup,
      height: donor.height,
      weight: donor.weight,
      address: donor.address || '',
      diseases: donor.diseases || '',
      dateofBirth: (donor as any).dateofBirth || '',
      eligibility: donor.eligibility || '',
    });
    setModalErrors({});
  };

  const closeDonorModal = () => {
    setSelectedDonor(null);
    setDonorForm({});
    setSaving(false);
  };

  const handleDonorChange = (field: string, value: any) => {
    setDonorForm(prev => ({ ...prev, [field]: value }));
  };

  const saveDonorEdits = async () => {
    if (!selectedDonor) return;
    setSaving(true);
    try {
      // validate modal fields (firstName, email, phone, bloodGroup, dob)
      const errors: Record<string, string> = {};
      const firstName = (donorForm.firstName || '').trim();
      const lastName = (donorForm.lastName || '').trim();
      const email = (donorForm.email || '').trim();
      const phoneRaw = String(donorForm.phoneNumber || '').replace(/\D/g, '');
      const bloodGroup = (donorForm.bloodGroup || '').trim();
      const dob = donorForm.dateofBirth || '';

      if (!firstName) errors.firstName = 'First name is required.';
      const emailOk = /^[^\s@]+@[^\s@]+\.(?:co|com|in|net)$/i.test(email);
      if (!emailOk) errors.email = 'Enter a valid email with domain .co, .com, .in or .net';
      if (!/^\d{10}$/.test(phoneRaw)) errors.phoneNumber = 'Enter a valid 10-digit phone number';
      if (!bloodGroup) errors.bloodGroup = 'Please select a blood group';
      if (dob) {
        const dobDate = new Date(dob);
        const today = new Date();
        let age = today.getFullYear() - dobDate.getFullYear();
        const m = today.getMonth() - dobDate.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dobDate.getDate())) age--;
        if (age < 18) errors.dateofBirth = 'Donor must be at least 18 years old';
      }

      if (Object.keys(errors).length > 0) {
        setModalErrors(errors);
        setSaving(false);
        return;
      }

      const payload: any = {
        name: `${firstName}${lastName ? ' ' + lastName : ''}`,
        email,
        // save phoneNumber with +91 prefix
        phoneNumber: `+91${phoneRaw}`,
        bloodGroup,
        height: donorForm.height,
        weight: donorForm.weight,
        address: donorForm.address,
        diseases: donorForm.diseases,
        eligibility: donorForm.eligibility,
      };
      if (dob) payload.dateofBirth = dob;
      Object.keys(payload).forEach(k => (payload[k] === undefined || payload[k] === '') && delete payload[k]);
      const resp = await updateDonor(selectedDonor._id, payload);
  const updated: Partial<Donor> = resp.data as any;
  setDonors(prev => prev.map(d => d._id === selectedDonor._id ? { ...d, ...(updated as Partial<Donor>) } : d));
      closeDonorModal();
    } catch (e) {
      setSaving(false);
    }
  };

  useEffect(() => {
    const fetchDonors = async () => {
      try {
        // Pass page, size, sort and filters to backend
        const response = await getAllDonors(
          currentPage,
          pageSize,
          sortField || undefined,
          sortOrder || undefined,
          appliedFilters.search,
          appliedFilters.bloodType,
          appliedFilters.eligibility
        );
        const data = response.data as { donors: Donor[]; totalPages?: number };
        setDonors(data.donors);
        setTotalPages(data.totalPages || 1);
      } catch {
        setDonors([]);
      }
    };
    fetchDonors();
  }, [currentPage, pageSize, sortField, sortOrder, appliedFilters.search, appliedFilters.bloodType, appliedFilters.eligibility]);

  // Fetch donor stats and donation history stats
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const donorStatsRes = await getDonorsStats();
        setDonorStats(donorStatsRes.data as { totalDonors: number; eligibleDonors: number; ineligibleDonors: number; totalSuccessDonations: number });
      } catch {
        setDonorStats(null);
      }
      // Removed donation stats fetching as per the requirement
    };
    fetchStats();
  }, []);

  // Close sort menu when clicking outside
  React.useEffect(() => {
    if (!showSortMenu) return;
    const handleClick = (e: MouseEvent) => {
      const sortBtn = document.getElementById('sort-btn');
      if (sortBtn && !sortBtn.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showSortMenu]);


  // Use server-side filtering/sorting/pagination; donors are provided by the API
  const paginatedDonors = donors;

  // Update sort button label to reflect current sort field and order
  // Removed unused sortLabel constant

  return (
  <div className="space-y-6">
    <div className="flex items-center justify-between">
      <h1 className="text-2xl font-bold text-gray-900 flex items-center">
        <Users className="w-7 h-7 text-blue-600 mr-3" />
        Donor Management
      </h1>
    </div>

    {/* Summary Stats */}
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 text-center">
        <div className="text-2xl font-bold text-blue-600">{donorStats ? donorStats.totalDonors : '-'}</div>
        <div className="text-sm text-gray-600">Total Donors</div>
      </div>
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 text-center">
        <div className="text-2xl font-bold text-green-600">
          {donorStats ? donorStats.eligibleDonors : '-'}
        </div>
        <div className="text-sm text-gray-600">Eligible Donors</div>
      </div>
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 text-center">
        <div className="text-2xl font-bold text-red-600">
          {donorStats ? donorStats.totalSuccessDonations : '-'}
        </div>
        <div className="text-sm text-gray-600">Total Success Donations</div>
      </div>
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 text-center">
        <div className="text-2xl font-bold text-purple-600">
          {/* Placeholder for Active Notifications */}
          {donorStats ? donorStats.totalDonors : '-'}
        </div>
        <div className="text-sm text-gray-600">Active Notifications</div>
      </div>
    </div>

    {/* Filter/Sort/Search Bar */}
    <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
      <div className="flex flex-wrap items-center gap-2 w-full">
          {/* Search Input */}
          <input
            type="text"
            className="border rounded px-3 py-2 w-72"
            placeholder="Search by name or email"
            value={appliedFilters.search}
            onChange={e => { setAppliedFilters(f => ({ ...f, search: e.target.value })); setCurrentPage(1); }}
            onKeyDown={e => { if (e.key === 'Enter') setCurrentPage(1); }}
          />

          {/* Blood Type Filter */}
          <select
            className="border rounded px-3 py-2"
            value={appliedFilters.bloodType}
            onChange={e => { setAppliedFilters(f => ({ ...f, bloodType: e.target.value })); setCurrentPage(1); }}
          >
            <option value="all">All Blood Types</option>
            <option value="A+">A+</option>
            <option value="A-">A-</option>
            <option value="B+">B+</option>
            <option value="B-">B-</option>
            <option value="AB+">AB+</option>
            <option value="AB-">AB-</option>
            <option value="O+">O+</option>
            <option value="O-">O-</option>
          </select>

          {/* Eligibility Filter */}
          <select
            className="border rounded px-3 py-2"
            value={appliedFilters.eligibility}
            onChange={e => { setAppliedFilters(f => ({ ...f, eligibility: e.target.value })); setCurrentPage(1); }}
          >
            <option value="all">All Eligibility</option>
            <option value="eligible">Eligible</option>
            <option value="ineligible">Ineligible</option>
          </select>

          {/* Clear Filters Button */}
          <button
            className="px-4 py-2 bg-gray-100 rounded border hover:bg-gray-200"
            onClick={() => { setAppliedFilters({ bloodType: 'all', eligibility: 'all', search: '' }); setCurrentPage(1); }}
          >
            Clear Filters
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
                      <div className="font-medium mb-1">Name</div>
                      <label className="mr-4">
                        <input
                          type="radio"
                          name="sortName"
                          checked={sortTempField === 'name' && sortTempOrder === 'asc'}
                          onChange={() => { setSortTempField('name'); setSortTempOrder('asc'); }}
                        /> Ascending
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="sortName"
                          checked={sortTempField === 'name' && sortTempOrder === 'desc'}
                          onChange={() => { setSortTempField('name'); setSortTempOrder('desc'); }}
                        /> Descending
                      </label>
                    </div>
                    <div className="mb-4">
                      <div className="font-medium mb-1">Blood Type</div>
                      <label className="mr-4">
                        <input
                          type="radio"
                          name="sortBlood"
                          checked={sortTempField === 'bloodGroup' && sortTempOrder === 'asc'}
                          onChange={() => { setSortTempField('bloodGroup'); setSortTempOrder('asc'); }}
                        /> Ascending
                      </label>
                      <label>
                        <input
                          type="radio"
                          name="sortBlood"
                          checked={sortTempField === 'bloodGroup' && sortTempOrder === 'desc'}
                          onChange={() => { setSortTempField('bloodGroup'); setSortTempOrder('desc'); }}
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

    {/* Donors Grid */}
    <div className="grid gap-6">
      {paginatedDonors.length === 0 ? (
        <div className="text-center text-gray-500 py-8">No donors found for selected filters.</div>
      ) : (
        paginatedDonors.map((donor) => {
          const totalDonations = donor.totalDonations ?? '-';
          const lastDonationDate = donor.lastDonationDate ? new Date(donor.lastDonationDate).toLocaleDateString() : 'N/A';
          const lastStatus = donor.lastStatus ?? 'N/A';
          const eligibility = { status: donor.eligibility ?? 'N/A', message: donor.eligibility ?? 'N/A' };
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
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                      <div>
                        <p className="text-gray-500">Total Donations</p>
                        <p className="font-semibold text-blue-600">{totalDonations}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Last Donation</p>
                        <p className="font-medium">{lastDonationDate}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Height</p>
                        <p className="font-medium">{donor.height ? `${donor.height} cm` : '-'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500">Weight</p>
                        <p className="font-medium">{donor.weight ? `${donor.weight} kg` : '-'}</p>
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
                  {userRole === 'admin' && (
                    <button
                      className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 text-sm flex items-center gap-1"
                      onClick={() => openDonorModal(donor)}
                    >
                      <Edit2 className="w-4 h-4" /> Edit Profile
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>

    {selectedDonor && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white w-full max-w-2xl rounded-lg shadow-lg relative max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between border-b px-6 py-4">
            <h2 className="text-lg font-semibold">Edit Donor - {selectedDonor.name}</h2>
            <button onClick={closeDonorModal} className="text-gray-500 hover:text-gray-700">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6 space-y-6">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-700">First Name</label>
                <input
                  className="mt-1 w-full border rounded px-3 py-2"
                  value={donorForm.firstName || ''}
                  onChange={e => { handleDonorChange('firstName', e.target.value); setModalErrors(prev => ({ ...prev, firstName: '' })); }}
                />
                {modalErrors.firstName && <div className="text-sm text-red-600 mt-2">{modalErrors.firstName}</div>}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Last Name</label>
                <input
                  className="mt-1 w-full border rounded px-3 py-2"
                  value={donorForm.lastName || ''}
                  onChange={e => handleDonorChange('lastName', e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  className="mt-1 w-full border rounded px-3 py-2"
                  value={donorForm.email || ''}
                  onChange={e => { handleDonorChange('email', e.target.value); setModalErrors(prev => ({ ...prev, email: '' })); }}
                />
                {modalErrors.email && <div className="text-sm text-red-600 mt-2">{modalErrors.email}</div>}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Phone Number</label>
                <input
                  className="mt-1 w-full border rounded px-3 py-2"
                  value={donorForm.phoneNumber || ''}
                  onChange={e => { const digits = e.target.value.replace(/\D/g, '').slice(0,10); handleDonorChange('phoneNumber', digits); setModalErrors(prev => ({ ...prev, phoneNumber: '' })); }}
                />
                {modalErrors.phoneNumber && <div className="text-sm text-red-600 mt-2">{modalErrors.phoneNumber}</div>}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Blood Group</label>
                <select
                  className="mt-1 w-full border rounded px-3 py-2"
                  value={donorForm.bloodGroup || ''}
                  onChange={e => { handleDonorChange('bloodGroup', e.target.value); setModalErrors(prev => ({ ...prev, bloodGroup: '' })); }}
                >
                  <option value="">Select</option>
                  {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
                </select>
                {modalErrors.bloodGroup && <div className="text-sm text-red-600 mt-2">{modalErrors.bloodGroup}</div>}
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Height (cm)</label>
                <input
                  className="mt-1 w-full border rounded px-3 py-2"
                  value={donorForm.height || ''}
                  onChange={e => handleDonorChange('height', e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Weight (kg)</label>
                <input
                  className="mt-1 w-full border rounded px-3 py-2"
                  value={donorForm.weight || ''}
                  onChange={e => handleDonorChange('weight', e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Date of Birth</label>
                <input
                  type="date"
                  className="mt-1 w-full border rounded px-3 py-2"
                  value={donorForm.dateofBirth || ''}
                  onChange={e => { handleDonorChange('dateofBirth', e.target.value); setModalErrors(prev => ({ ...prev, dateofBirth: '' })); }}
                />
                {modalErrors.dateofBirth && <div className="text-sm text-red-600 mt-2">{modalErrors.dateofBirth}</div>}
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700">Address</label>
                <input
                  className="mt-1 w-full border rounded px-3 py-2"
                  value={donorForm.address || ''}
                  onChange={e => handleDonorChange('address', e.target.value)}
                />
              </div>
              <div className="md:col-span-2">
                <label className="text-sm font-medium text-gray-700">Diseases / Conditions</label>
                <textarea
                  className="mt-1 w-full border rounded px-3 py-2"
                  rows={3}
                  value={donorForm.diseases || ''}
                  onChange={e => handleDonorChange('diseases', e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700">Eligibility</label>
                <select
                  className="mt-1 w-full border rounded px-3 py-2"
                  value={donorForm.eligibility || ''}
                  onChange={e => handleDonorChange('eligibility', e.target.value)}
                >
                  <option value="">Unknown</option>
                  <option value="eligible">Eligible</option>
                  <option value="ineligible">Ineligible</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2 border-t">
              <button
                className="px-4 py-2 rounded border bg-gray-100 hover:bg-gray-200"
                onClick={closeDonorModal}
                type="button"
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1 disabled:opacity-60"
                onClick={saveDonorEdits}
                type="button"
                disabled={saving}
              >
                <Save className="w-4 h-4" /> {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>
    )}

    {/* Pagination Controls (arrow buttons, no 'Page' text) */}
    <div className="flex justify-center items-center mt-6 gap-4">
      <button
        className="px-3 py-2 bg-gray-100 rounded disabled:opacity-50 flex items-center"
        onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
        disabled={currentPage === 1}
        aria-label="Previous page"
      >
        <ChevronLeft className="w-5 h-5" />
      </button>

      <span className="mx-2 font-medium">{currentPage} of {totalPages}</span>

      <button
        className="px-3 py-2 bg-gray-100 rounded disabled:opacity-50 flex items-center"
        onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
        disabled={currentPage === totalPages}
        aria-label="Next page"
      >
        <ChevronRight className="w-5 h-5" />
      </button>
    </div>
  </div>
  );
}

export default DonorManagement;
