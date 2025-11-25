import React, { useState, useEffect } from 'react';
import { Activity, Plus, Search, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { sendSMS, sendEmail } from '../utils/api';
import {
  getAllDonationRequests,
  createDonationRequest,
  updateDonationRequest,
  volunteerForDonation,
  getAllHospitals,
} from '../utils/axios';


interface DonationRequest {
  requestId: string;
  hospitalId?: string;
  patientName: string;
  bloodGroup: string;
  bloodUnitsCount: number;
  medicalCondition?: string;
  priority: string;
  requestDate: string;
  requiredDate: string;
  status: string;
  location?: string;
  availableDonors?: number;
  approved?: boolean;
  volunteers?: Array<any>;
}

interface DonationRequestsProps {
  userRole: string;
  currentUser?: any;
}

const DonationRequests: React.FC<DonationRequestsProps> = ({ userRole,currentUser }) => {
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [requests, setRequests] = useState<DonationRequest[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [showModal, setShowModal] = useState<boolean>(false);
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [browserLat, setBrowserLat] = useState<number | null>(null);
  const [browserLng, setBrowserLng] = useState<number | null>(null);
  const [browserAccuracy, setBrowserAccuracy] = useState<number | null>(null);
  const [hospitalDropdownOpen, setHospitalDropdownOpen] = useState<boolean>(false);
  const [hospitalSearchTerm, setHospitalSearchTerm] = useState<string>('');
  const [formData, setFormData] = useState<any>({
    patientName: '',
    bloodGroup: '',
    bloodUnitsCount: 1,
    medicalCondition: '',
    priority: 'normal',
    requiredDate: '',
    location: '',
  });

  // Pagination state
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage] = useState<number>(10);
  
  // Sorting state
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  
  // Hospital filter state
  const [hospitalFilter, setHospitalFilter] = useState<string>('all');

  
  const [volunteerModalOpen, setVolunteerModalOpen] = useState<boolean>(false);
  const [volunteerForm, setVolunteerForm] = useState<any>({ expectedDonationTime: '', contact: '', message: '' });
  const [currentVolunteerRequestId, setCurrentVolunteerRequestId] = useState<string | null>(null);
  const [currentRequestRequiredDate, setCurrentRequestRequiredDate] = useState<string | null>(null);
  const [dateInputType, setDateInputType] = useState<'text' | 'datetime-local'>('text');
  const [showVolunteersModal, setShowVolunteersModal] = useState<boolean>(false);
  const [selectedVolunteers, setSelectedVolunteers] = useState<any[]>([]);
  const [closeModalOpen, setCloseModalOpen] = useState<boolean>(false);
  const [closeOption, setCloseOption] = useState<'closed' | 'fulfilled'>('closed');
  const [currentCloseRequestId, setCurrentCloseRequestId] = useState<string | null>(null);
  const [currentCloseVolunteers, setCurrentCloseVolunteers] = useState<any[]>([]);
  const [selectedFulfillVolunteers, setSelectedFulfillVolunteers] = useState<any[]>([]);

  const fetchDonationRequests = async () => {
    try {
      setLoading(true);
  // normalize status to backend convention (uppercase) when filtering
  const statusParam = statusFilter && statusFilter !== 'all' ? statusFilter.toUpperCase() : undefined;
  const filters: any = {};
  if (statusParam) filters.status = statusParam;
  // include coordinates to let backend sort by proximity ONLY when the
  // current user is a donor and browser geolocation is available.
  // Do NOT fall back to stored user coordinates here — we only send
  // browser-provided coords as requested.
  if (userRole === 'donor' && browserLat != null && browserLng != null) {
    filters.lat = browserLat;
    filters.lng = browserLng;
    if (browserAccuracy != null) filters.accuracy = browserAccuracy;
  }
  const response = await getAllDonationRequests(filters as any);
      // assume response.data is an array of DonationRequest-like objects
  // support responses that return { records, summary } or plain array
  const respData: any = response.data;
  const data = respData && respData.records ? respData.records : respData;
  setRequests((data || []) as DonationRequest[]);
      setError(null);
    } catch (err) {
      console.error('Error fetching donation requests:', err);
      setError('Failed to fetch donation requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Consolidated behavior: for donors, try to get browser geolocation on mount
    // and only fetch donation requests after position is obtained (or when
    // geolocation fails). For non-donors, fetch immediately.

    const fetchHospitals = async () => {
      try {
        // Fetch all hospitals by using a large page size
        const res:any = await getAllHospitals(1, 1000);
        // Filter to only show verified hospitals
        const allHospitals = res.data?.hospitals || res.data || [];
        const verifiedHospitals = allHospitals.filter((h: any) => h.isVerified === true);
        // Sort by hospital name in ascending order
        verifiedHospitals.sort((a: any, b: any) => 
          (a.hospitalName || '').localeCompare(b.hospitalName || '')
        );
        setHospitals(verifiedHospitals);
      } catch (err) {
        console.warn('Failed to load hospitals', err);
      }
    };

    // Helper to trigger fetch once (prevents multiple calls when position updates)
    const triggerFetch = () => fetchDonationRequests();

    if (userRole !== 'donor') {
      triggerFetch();
      fetchHospitals();
      return; // non-donor behavior complete
    }

    // If donor and we already have coords, fetch immediately
    if (browserLat != null && browserLng != null) {
      triggerFetch();
      fetchHospitals();
      return;
    }

    // For donors without coords, attempt to obtain browser geolocation now
    if (!navigator.geolocation) {
      console.warn('Geolocation not supported by browser');
      // fallback: fetch without coords
      triggerFetch();
      fetchHospitals();
      return;
    }

    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        const acc = typeof pos.coords.accuracy === 'number' ? pos.coords.accuracy : null;
        setBrowserLat(lat);
        setBrowserLng(lng);
        setBrowserAccuracy(acc);
        // fetch requests with coords
        triggerFetch();
        fetchHospitals();
      },
      (err) => {
        if (cancelled) return;
        console.warn('Geolocation error', err.message);
        // still fetch requests without coords
        triggerFetch();
        fetchHospitals();
      },
      { enableHighAccuracy: false, maximumAge: 60_000, timeout: 5000 }
    );

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, userRole]);

  useEffect(() => {
    const fetchHospitals = async () => {
      try {
        // Fetch all hospitals by using a large page size
        const res: any = await getAllHospitals(1, 1000);
        // Filter to only show verified hospitals
        const allHospitals = res.data?.hospitals || res.data || [];
        const verifiedHospitals = allHospitals.filter((h: any) => h.isVerified === true);
        // Sort by hospital name in ascending order
        verifiedHospitals.sort((a: any, b: any) => 
          (a.hospitalName || '').localeCompare(b.hospitalName || '')
        );
        setHospitals(verifiedHospitals);
      } catch (err) {
        console.error('Failed to fetch hospitals', err);
      }
    };
    fetchHospitals();
  }, []);

  

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page on search
  };

  const filteredAndSearchedRequests = requests.filter((request) => {
    const reqStatus = (request.status || '').toString().toLowerCase();
    const matchesStatus = statusFilter === 'all' || reqStatus === statusFilter;
    
    // Hospital filter
    const matchesHospital = hospitalFilter === 'all' || (request as any).hospitalId === hospitalFilter;
    
    // For donor users, only allow approved requests. Treat closed/completed as approved on the frontend
    if (userRole === 'donor') {
      const isApprovedBackend = ('approved' in request) ? Boolean((request as any).approved) : reqStatus === 'approved';
      const isClosed = reqStatus === 'closed';
      const isApprovedEffective = isApprovedBackend || isClosed || reqStatus === 'approved';

      // If user is the one who created/requested this donation, allow them to see it even if pending
      const currentUserId = currentUser ? (currentUser._id || currentUser.id || currentUser.userId) : null;
      const isRequester = currentUserId && ((request as any).requestedBy && String((request as any).requestedBy) === String(currentUserId));

      // Exclude completed requests for donors
      if (reqStatus === 'completed') return false;

      if (!isApprovedEffective && !isRequester) return false;
    }
    const lower = searchTerm.trim().toLowerCase();
    const matchesSearch =
      lower === '' ||
      request.patientName?.toLowerCase().includes(lower) ||
      request.bloodGroup?.toLowerCase().includes(lower) ||
      (request.location || '').toLowerCase().includes(lower);
    return matchesStatus && matchesSearch && matchesHospital;
  });

  // Sort by creation date
  const sortedRequests = [...filteredAndSearchedRequests].sort((a, b) => {
    const dateA = new Date((a as any).createdAt || a.requestDate).getTime();
    const dateB = new Date((b as any).createdAt || b.requestDate).getTime();
    return sortOrder === 'newest' ? dateB - dateA : dateA - dateB;
  });

  // Pagination
  const totalPages = Math.ceil(sortedRequests.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedRequests = sortedRequests.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const getStatusIcon = (status: string) => {
    const s = (status || '').toLowerCase();
    switch (s) {
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'approved':
      case 'completed':
        return <CheckCircle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch ((priority || '').toLowerCase()) {
      case 'critical':
        return 'bg-red-100 text-red-800';
      case 'urgent':
        return 'bg-orange-100 text-orange-800';
      case 'normal':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusColor = (status: string) => {
    switch ((status || '').toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const userDonorId = currentUser ? (currentUser._id || currentUser.id || currentUser.userId) : null;
  const hasUserVolunteered = (request: any) => {
    if (!userDonorId) return false;
    const volunteers = (request && request.volunteers) || [];
    return volunteers.some((v: any) => String(v.donorId) === String(userDonorId));
  };

  const isUserRequestCreator = (request: any) => {
    if (!userDonorId) return false;
    const requestedBy = request.requestedBy;
    return requestedBy && String(requestedBy) === String(userDonorId);
  };

  const handleNewRequest = async () => {
    // open modal for admin to input details
    setShowModal(true);
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev: any) => ({ ...prev, [name]: value }));
  };

  const submitNewRequest = async () => {
    try {
      const payload = {
        ...formData,
        requiredDate: formData.requiredDate ? new Date(formData.requiredDate) : new Date(),
      };
      await createDonationRequest(payload as any);
      setShowModal(false);
      setFormData({
        patientName: '',
        bloodGroup: '',
        bloodUnitsCount: 1,
        medicalCondition: '',
        priority: 'normal',
        requiredDate: '',
        location: '',
      });
      await fetchDonationRequests();
      alert('Donation request created successfully!');
    } catch (err) {
      console.error('Error creating request:', err);
      alert('Failed to create donation request');
    }
  };

  const handleStatusUpdate = async (requestId: string, newStatus: string) => {
    try {
  // send status in uppercase to match backend conventions
  await updateDonationRequest(requestId, { status: newStatus.toUpperCase() } as any);
      await fetchDonationRequests();
      alert(`Request status updated to ${newStatus}`);
    } catch (err) {
      console.error('Error updating request status:', err);
      alert('Failed to update request status');
    }
  };

  const handleVolunteer = async (requestId: string, requiredDate: string) => {
    // Use the currentUser passed as prop instead of localStorage
    if (!currentUser) {
      alert('Please log in to volunteer');
      return;
    }

    const donorId = currentUser._id || currentUser.id || currentUser.userId || '';
    if (!donorId) {
      alert('Please log in to volunteer');
      return;
    }

    // Prefer phone fields from currentUser
    const prefillContact = currentUser.phoneNumber || currentUser.phone || currentUser.contact || currentUser.mobile || '';

    setCurrentVolunteerRequestId(requestId);
    setCurrentRequestRequiredDate(requiredDate);
    setDateInputType('text');
    setVolunteerForm((prev: any) => ({
      ...prev,
      contact: prefillContact || prev.contact || '',
      expectedDonationTime: '',
      message: ''
    }));
    setVolunteerModalOpen(true);
  };

  const submitVolunteer = async () => {
    try {
      if (!currentVolunteerRequestId) return alert('No request selected');
      if (!currentUser) return alert('Please log in to volunteer');

      const donorId = currentUser._id || currentUser.id || currentUser.userId || '';
      const donorName = currentUser.name || currentUser.fullName || currentUser.firstName || '';

      // basic validation
      if (!volunteerForm.contact || volunteerForm.contact.trim() === '') {
        return alert('Please enter a contact number');
      }
      if (!volunteerForm.expectedDonationTime || volunteerForm.expectedDonationTime === '') {
        return alert('Please enter expected donation date & time');
      }

      const expectedISO = new Date(volunteerForm.expectedDonationTime).toISOString();

      const payload = {
        donorId,
        donorName,
        contact: volunteerForm.contact,
        expectedDonationTime: expectedISO,
        message: volunteerForm.message,
      };

      await volunteerForDonation(currentVolunteerRequestId, payload as any);

      // Close modal and update UI immediately (don't let optional notifications block success path)
      setVolunteerModalOpen(false);
      setCurrentVolunteerRequestId(null);
      setVolunteerForm({ expectedDonationTime: '', contact: '', message: '' });
      await fetchDonationRequests();
      alert('Thank you — your volunteer details have been recorded.');

      // Fire optional notifications but don't fail the main flow if they error
      Promise.allSettled([
        sendSMS({
          to: '+1234567890',
          message: `A donor has volunteered for your blood donation request. Please check your dashboard for details.`,
        }),
        sendEmail({
          to: 'hospital@example.com',
          subject: `Donor Response for Blood Donation Request`,
          message: `A donor has volunteered for your blood donation request. Please check your dashboard for details.`,
        })
      ]).then(results => {
        // Log any failures for debugging
        results.forEach((r, idx) => {
          if (r.status === 'rejected') console.warn('Notification failed', idx, r.reason);
        });
      });
    } catch (err) {
      console.error('Error sending volunteer response:', err);
      alert('There was an error sending your response. Please try again.');
    }
  };

  const openVolunteersList = (volunteers: any[]) => {
    setSelectedVolunteers(volunteers || []);
    setShowVolunteersModal(true);
  };

  const openCloseModal = (requestId: string, volunteers: any[]) => {
    setCurrentCloseRequestId(requestId);
    setCurrentCloseVolunteers(volunteers || []);
    setSelectedFulfillVolunteers([]);
    setCloseOption('closed');
    setCloseModalOpen(true);
  };

  const confirmCloseRequest = async () => {
    if (!currentCloseRequestId) return alert('No request selected');
    try {
      const payload: any = {};
      if (closeOption === 'closed') {
        payload.status = 'CLOSED';
      } else {
        // fulfilled
        if (!selectedFulfillVolunteers || selectedFulfillVolunteers.length === 0) return alert('Please select at least one volunteer who donated');
        payload.status = 'COMPLETED';
        // provide both array fields and a single fallback for backward compatibility
        const fulfilledByList = selectedFulfillVolunteers.map((s) => s.donorId || s.donorId);
        const fulfilledByNames = selectedFulfillVolunteers.map((s) => s.donorName || s.donorId || '');
        payload.fulfilledByList = fulfilledByList;
        payload.fulfilledByNames = fulfilledByNames;
        payload.fulfilledBy = fulfilledByNames.toString();
        payload.fulfilledByName = fulfilledByNames.toString();
      }
      await updateDonationRequest(currentCloseRequestId, payload as any);
      setCloseModalOpen(false);
      setCurrentCloseRequestId(null);
      setSelectedFulfillVolunteers([]);
      await fetchDonationRequests();
      alert('Request updated successfully');
    } catch (err) {
      console.error('Error closing request:', err);
      alert('Failed to update request');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center">
          <Activity className="w-7 h-7 text-red-600 mr-3" />
          Donation Requests
        </h1>
        {(
          <>
            <button onClick={handleNewRequest} className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 flex items-center">
              <Plus className="w-4 h-4 mr-2" />
              New Request
            </button>
            {showModal && (
              <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] flex flex-col">
                  <h2 className="text-xl font-semibold mb-4">Create Donation Request</h2>
                  <div className="flex-1 overflow-y-auto">
                    <div className="grid grid-cols-1 gap-3">
                      <input name="patientName" value={formData.patientName} onChange={handleFormChange} placeholder="Patient Name" className="border p-2 rounded" />
                      <select name="bloodGroup" value={formData.bloodGroup} onChange={handleFormChange} className="border p-2 rounded">
                        <option value="">Select blood group</option>
                        <option value="A+">A+</option>
                        <option value="A-">A-</option>
                        <option value="B+">B+</option>
                        <option value="B-">B-</option>
                        <option value="AB+">AB+</option>
                        <option value="AB-">AB-</option>
                        <option value="O+">O+</option>
                        <option value="O-">O-</option>
                      </select>
                      <input name="bloodUnitsCount" type="number" value={formData.bloodUnitsCount} onChange={handleFormChange} placeholder="Units Required" className="border p-2 rounded" />
                      <input name="medicalCondition" value={formData.medicalCondition} onChange={handleFormChange} placeholder="Medical Condition" className="border p-2 rounded" />
                      <select name="priority" value={formData.priority} onChange={handleFormChange} className="border p-2 rounded">
                        <option value="critical">Critical</option>
                        <option value="urgent">Urgent</option>
                        <option value="normal">Normal</option>
                      </select>
                      <input name="requiredDate" type="date" value={formData.requiredDate} onChange={handleFormChange} className="border p-2 rounded" />
                      {/* Custom hospital dropdown */}
                      <div className="relative">
                        <div
                          className="border p-2 rounded bg-white cursor-pointer w-full hover:border-blue-500 transition-colors"
                          onClick={() => setHospitalDropdownOpen(!hospitalDropdownOpen)}
                        >
                          {formData.hospitalId ? (
                            <div>
                              <div className="font-medium">
                                {hospitals.find(h => h._id === formData.hospitalId)?.hospitalName}
                              </div>
                              <div className="text-xs text-gray-500 truncate">
                                {hospitals.find(h => h._id === formData.hospitalId)?.address}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-500">Select hospital</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 flex justify-end space-x-2 flex-shrink-0">
                    <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded border">Cancel</button>
                    <button onClick={submitNewRequest} className="px-4 py-2 rounded bg-red-600 text-white">Submit</button>
                  </div>
                </div>
              </div>
            )}

            {/* Hospital Selection Popup - Separate from modal */}
            {hospitalDropdownOpen && (
              <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center" style={{ zIndex: 9999 }}>
                <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
                  {/* Header */}
                  <div className="p-4 border-b flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Select Hospital</h3>
                    <button
                      onClick={() => {
                        setHospitalDropdownOpen(false);
                        setHospitalSearchTerm('');
                      }}
                      className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
                    >
                      &times;
                    </button>
                  </div>

                  {/* Search bar */}
                  <div className="p-4 border-b">
                    <input
                      type="text"
                      placeholder="Search hospitals by name, address, or pincode..."
                      value={hospitalSearchTerm}
                      onChange={(e) => setHospitalSearchTerm(e.target.value)}
                      className="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                  </div>

                  {/* Hospital list */}
                  <div className="flex-1 overflow-y-auto p-2">
                    <div
                      className="p-3 hover:bg-blue-50 cursor-pointer rounded-lg transition-colors mb-1"
                      onClick={() => {
                        setFormData((prev: any) => ({
                          ...prev,
                          hospitalId: undefined,
                          location: '',
                        }));
                        setHospitalDropdownOpen(false);
                        setHospitalSearchTerm('');
                      }}
                    >
                      <span className="text-gray-500 italic">No hospital selected</span>
                    </div>
                    {hospitals
                      .filter((h) => {
                        if (!hospitalSearchTerm) return true;
                        const searchLower = hospitalSearchTerm.toLowerCase();
                        return (
                          h.hospitalName?.toLowerCase().includes(searchLower) ||
                          h.address?.toLowerCase().includes(searchLower) ||
                          h.pincode?.toLowerCase().includes(searchLower)
                        );
                      })
                      .map((h) => (
                        <div
                          key={h._id}
                          className={`p-3 hover:bg-blue-50 cursor-pointer rounded-lg border transition-colors mb-1 ${
                            formData.hospitalId === h._id ? 'bg-blue-100 border-blue-300' : 'border-gray-200'
                          }`}
                          onClick={() => {
                            setFormData((prev: any) => ({
                              ...prev,
                              hospitalId: h._id,
                              location: h.address || prev.location,
                            }));
                            setHospitalDropdownOpen(false);
                            setHospitalSearchTerm('');
                          }}
                        >
                          <div className="font-medium text-gray-900">{h.hospitalName}</div>
                          <div className="text-sm text-gray-600 mt-1">{h.address}</div>
                          {h.pincode && (
                            <div className="text-xs text-gray-500 mt-1">Pincode: {h.pincode}</div>
                          )}
                        </div>
                      ))}
                    {hospitals.filter((h) => {
                      if (!hospitalSearchTerm) return true;
                      const searchLower = hospitalSearchTerm.toLowerCase();
                      return (
                        h.hospitalName?.toLowerCase().includes(searchLower) ||
                        h.address?.toLowerCase().includes(searchLower) ||
                        h.pincode?.toLowerCase().includes(searchLower)
                      );
                    }).length === 0 && (
                      <div className="text-center py-8 text-gray-500">
                        No hospitals found matching your search.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}          </>
        )}
      </div>
      {/* Volunteer confirmation modal for donors */}
      {volunteerModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50 overflow-y-auto">
          <div className="bg-white rounded-lg p-6 w-full max-w-md m-4">
            <h2 className="text-xl font-semibold mb-4">Volunteer for Donation</h2>
            <div className="grid grid-cols-1 gap-3">
              <label className="text-sm font-medium">Contact number</label>
              <input aria-label="contact" name="contact" value={volunteerForm.contact} onChange={(e) => setVolunteerForm((p:any)=>({...p, contact: e.target.value}))} placeholder="e.g. +1 555 555 5555" className="border p-2 rounded" />

              <label className="text-sm font-medium">Expected donation date & time</label>
              <input 
                aria-label="expectedDonationTime" 
                name="expectedDonationTime" 
                type={dateInputType} 
                value={volunteerForm.expectedDonationTime} 
                onChange={(e) => setVolunteerForm((p:any)=>({...p, expectedDonationTime: e.target.value}))} 
                min={new Date().toISOString().slice(0, 16)}
                max={currentRequestRequiredDate ? new Date(currentRequestRequiredDate).toISOString().slice(0, 16) : undefined}
                className="border p-2 rounded"
                placeholder="dd/mm/yyyy, --:--"
                onFocus={() => setDateInputType('datetime-local')}
                onBlur={(e) => {
                  if (!e.target.value) {
                    setDateInputType('text');
                  }
                }}
              />

              <label className="text-sm font-medium">Message (optional)</label>
              <textarea aria-label="message" name="message" value={volunteerForm.message} onChange={(e) => setVolunteerForm((p:any)=>({...p, message: e.target.value}))} placeholder="Any notes for the hospital (optional)" className="border p-2 rounded" />
            </div>
            <div className="mt-4 flex justify-end space-x-2">
              <button onClick={() => setVolunteerModalOpen(false)} className="px-4 py-2 rounded border">Cancel</button>
              <button onClick={submitVolunteer} className="px-4 py-2 rounded bg-blue-600 text-white">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Admin volunteers list modal */}
      {showVolunteersModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <h2 className="text-xl font-semibold mb-4">Volunteers</h2>
            <div className="space-y-3 max-h-96 overflow-auto">
              {selectedVolunteers && selectedVolunteers.length > 0 ? (
                selectedVolunteers.map((v, idx) => (
                  <div key={idx} className="border rounded p-3">
                    <p className="font-semibold">{v.donorName || v.donorId || 'Anonymous'}</p>
                    <p>Contact: {v.contact || 'N/A'}</p>
                    <p>Expected Time: {v.expectedDonationTime ? new Date(v.expectedDonationTime).toLocaleString() : 'N/A'}</p>
                    {v.message && <p className="italic">Message: {v.message}</p>}
                    <p className="text-sm text-gray-500">Volunteered at: {v.volunteeredAt ? new Date(v.volunteeredAt).toLocaleString() : 'N/A'}</p>
                  </div>
                ))
              ) : (
                <p>No volunteers yet.</p>
              )}
            </div>
            <div className="mt-4 flex justify-end">
              <button onClick={() => setShowVolunteersModal(false)} className="px-4 py-2 rounded border">Close</button>
            </div>
          </div>
        </div>
      )}

      {closeModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h2 className="text-xl font-semibold mb-4">Close Donation Request</h2>
            <div className="space-y-4">
              <div>
                <label className="flex items-center space-x-2">
                  <input type="radio" checked={closeOption === 'closed'} onChange={() => setCloseOption('closed')} />
                  <span className="ml-2">Close without fulfilling</span>
                </label>
                <label className="flex items-center space-x-2 mt-2">
                  <input type="radio" checked={closeOption === 'fulfilled'} onChange={() => setCloseOption('fulfilled')} />
                  <span className="ml-2">Close and mark fulfilled (select volunteer)</span>
                </label>
              </div>

                    {closeOption === 'fulfilled' && (
                      <div className="border rounded p-3 max-h-64 overflow-auto">
                        {currentCloseVolunteers && currentCloseVolunteers.length > 0 ? (
                          currentCloseVolunteers.map((v: any, idx: number) => {
                            const checked = selectedFulfillVolunteers.some((s) => String(s.donorId) === String(v.donorId));
                            return (
                              <label key={idx} className="flex items-center space-x-3 p-2 hover:bg-gray-50 rounded">
                                <input
                                  type="checkbox"
                                  name={`fulfillVolunteer_${idx}`}
                                  checked={checked}
                                  onChange={() => {
                                    if (checked) {
                                      setSelectedFulfillVolunteers((prev) => prev.filter((p) => String(p.donorId) !== String(v.donorId)));
                                    } else {
                                      setSelectedFulfillVolunteers((prev) => [...prev, v]);
                                    }
                                  }}
                                />
                                <div>
                                  <div className="font-semibold">{v.donorName || v.donorId || 'Anonymous'}</div>
                                  <div className="text-sm text-gray-600">Contact: {v.contact || 'N/A'}</div>
                                </div>
                              </label>
                            );
                          })
                        ) : (
                          <div>No volunteers available to mark as fulfilled.</div>
                        )}
                      </div>
                    )}
            </div>
            <div className="mt-4 flex justify-end space-x-2">
              <button onClick={() => { setCloseModalOpen(false); setSelectedFulfillVolunteers([]); setCurrentCloseRequestId(null); }} className="px-4 py-2 rounded border">Cancel</button>
              <button onClick={confirmCloseRequest} className="px-4 py-2 rounded bg-yellow-600 text-white">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="w-5 h-5 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search requests..."
                  value={searchTerm}
                  onChange={handleSearch}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                />
              </div>
            </div>
            {/* Show small indicator when browser geolocation is used for donors */}
            {userRole === 'donor' && browserLat != null && browserLng != null && (
              <div className="mt-2 flex items-center space-x-2">
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">Showing nearby requests</span>
                <button
                  onClick={() => fetchDonationRequests()}
                  className="text-sm text-gray-600 underline hover:text-gray-800"
                >
                  Refresh
                </button>
              </div>
            )}
          </div>

          {/* Second row with hospital filter and sort */}
          <div className="flex flex-col md:flex-row gap-4">
            <select
              value={hospitalFilter}
              onChange={(e) => { setHospitalFilter(e.target.value); setCurrentPage(1); }}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="all">All Hospitals</option>
              {hospitals.map((hospital) => (
                <option key={hospital._id} value={hospital._id}>
                  {hospital.hospitalName}
                </option>
              ))}
            </select>

            <select
              value={sortOrder}
              onChange={(e) => { setSortOrder(e.target.value as 'newest' | 'oldest'); setCurrentPage(1); }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
            </select>
          </div>

          {/* Results count */}
          <div className="text-sm text-gray-600">
            Showing {startIndex + 1}-{Math.min(endIndex, sortedRequests.length)} of {sortedRequests.length} requests
          </div>
        </div>
      </div>

      {/* Request Cards */}
      {loading ? (
        <div className="grid gap-6">
          {[1,2,3].map(i => (
            <div key={i} className="bg-white rounded-lg p-6 shadow-sm border border-gray-200 animate-pulse">
              <div className="flex items-center space-x-3 mb-3">
                <div className="h-6 w-40 bg-gray-200 rounded" />
                <div className="h-5 w-16 bg-gray-200 rounded" />
                <div className="h-5 w-24 bg-gray-200 rounded" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <div className="h-10 bg-gray-200 rounded" />
                <div className="h-10 bg-gray-200 rounded" />
                <div className="h-10 bg-gray-200 rounded" />
                <div className="h-10 bg-gray-200 rounded" />
              </div>
              <div className="flex items-center gap-6 text-sm">
                <div className="h-4 w-48 bg-gray-200 rounded" />
                <div className="h-4 w-56 bg-gray-200 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto" />
          <p className="mt-4 text-gray-600">{error}</p>
        </div>
      ) : (
        <div className="grid gap-6">
          {paginatedRequests.length === 0 ? (
            <div className="bg-white rounded-lg shadow-sm border p-10 text-center">
              <div className="mx-auto mb-3 w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                <Activity className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-1">No donation requests found</h3>
              <p className="text-gray-600">Try adjusting filters or creating a new request.</p>
            </div>
          ) : (
          paginatedRequests.map((request) => (
            <div key={(request as any)._id || request.requestId} className="bg-white rounded-lg p-6 shadow-sm border border-gray-200">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-3">
                    <h3 className="text-lg font-semibold text-gray-900">{request.patientName}</h3>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(request.priority)}`}>
                      {request.priority}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center ${getStatusColor(request.status)}`}>
                      {getStatusIcon(request.status)}
                      <span className="ml-1">{request.status}</span>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    <div>
                      <p className="text-sm text-gray-500">Blood Type</p>
                      <p className="font-semibold text-lg text-red-600">{request.bloodGroup}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Units Required</p>
                      <p className="font-semibold text-lg">{request.bloodUnitsCount}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Request Date</p>
                      <p className="font-medium">{new Date(request.requestDate).toLocaleDateString()}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Required By</p>
                      <p className="font-medium">{new Date(request.requiredDate).toLocaleDateString()}</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-6 text-sm text-gray-600">
                    <span>Location: {request.location}</span>
                    {typeof (request as any).distanceMeters === 'number' && (
                      <span>Distance: {(((request as any).distanceMeters || 0) / 1000).toFixed(1)} km</span>
                    )}
                    {(
                      // show approved badge if backend says approved OR if request is closed/completed
                      (('approved' in request) && ((request as any).approved)) || (request.status || '').toLowerCase() === 'closed' || (request.status || '').toLowerCase() === 'completed' || (request.status || '').toLowerCase() === 'approved'
                    ) && (
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${((request as any).approved || (request.status || '').toLowerCase() === 'closed' || (request.status || '').toLowerCase() === 'completed' || (request.status || '').toLowerCase() === 'approved') ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {((request as any).approved || (request.status || '').toLowerCase() === 'closed' || (request.status || '').toLowerCase() === 'completed' || (request.status || '').toLowerCase() === 'approved') ? 'Approved by administrator' : 'Not Approved'}
                      </span>
                    )}
                    {request.medicalCondition && <span>Condition: {request.medicalCondition}</span>}
                  </div>
                </div>

                <div className="flex space-x-2 ml-4">
                  {userRole === 'admin' && (request.status || '').toLowerCase() === 'pending' && (
                    <>
                      <button onClick={() => handleStatusUpdate((request as any)._id || request.requestId, 'approved')} className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 text-sm">
                        Approve
                      </button>
                      <button onClick={() => handleStatusUpdate((request as any)._id || request.requestId, 'rejected')} className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 text-sm">
                        Reject
                      </button>
                      
                    </>
                  )}

                  {userRole === 'admin' && (
                    <button onClick={() => openVolunteersList((request as any).volunteers || [])} className="bg-gray-200 text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-300 text-sm">
                      Volunteers ({((request as any).volunteers || []).length})
                    </button>
                  )}

                  {userRole === 'admin' && ((request.status || '').toLowerCase() !== 'completed') && (
                    <button onClick={() => openCloseModal((request as any)._id || request.requestId, (request as any).volunteers || [])} className="bg-yellow-600 text-white px-3 py-2 rounded-lg hover:bg-yellow-700 text-sm">
                      Close
                    </button>
                  )}

                  {userRole === 'donor' && (
                    hasUserVolunteered(request) ? (
                      <button disabled className="bg-gray-400 text-white px-3 py-2 rounded-lg text-sm">Already volunteered</button>
                    ) : isUserRequestCreator(request) ? (
                      <button disabled className="bg-gray-400 text-white px-3 py-2 rounded-lg text-sm">Cannot volunteer for own request</button>
                    ) : (
                      <button onClick={() => handleVolunteer((request as any)._id || request.requestId, request.requiredDate)} className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-sm">
                        Volunteer
                      </button>
                    )
                  )}
                </div>
              </div>
            </div>
          )))
          }
        </div>
      )}

      {/* Pagination */}
      {!loading && !error && sortedRequests.length > 0 && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          
          <div className="flex gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
              // Show first page, last page, current page, and pages around current
              if (
                page === 1 ||
                page === totalPages ||
                (page >= currentPage - 1 && page <= currentPage + 1)
              ) {
                return (
                  <button
                    key={page}
                    onClick={() => handlePageChange(page)}
                    className={`px-4 py-2 rounded-lg ${
                      currentPage === page
                        ? 'bg-red-600 text-white'
                        : 'border border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    {page}
                  </button>
                );
              } else if (page === currentPage - 2 || page === currentPage + 2) {
                return <span key={page} className="px-2 py-2">...</span>;
              }
              return null;
            })}
          </div>

          <button
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default DonationRequests;
 