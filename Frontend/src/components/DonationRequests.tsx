import React, { useState, useEffect } from 'react';
import { Activity, Plus, Search, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { parseApiError, type NormalisedError } from '../utils/apiError';
import { ErrorBanner, FieldError, focusFirstError } from './FormFeedback';
import {
  getAllDonationRequests,
  createDonationRequest,
  updateDonationRequest,
  getMatchesForRequest,
  rematchRequest,
  volunteerForDonation,
  uploadVolunteerReport,
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
  // Errors raised by the "raise a request" form, highlighted on their inputs.
  const [formError, setFormError] = useState<NormalisedError | null>(null);
  const [formFieldErrors, setFormFieldErrors] = useState<Record<string, string>>({});
  const [submittingRequest, setSubmittingRequest] = useState(false);
  // Errors raised by the volunteer dialog.
  const [volunteerError, setVolunteerError] = useState<NormalisedError | null>(null);
  const [volunteerFieldErrors, setVolunteerFieldErrors] = useState<Record<string, string>>({});
  const [submittingVolunteer, setSubmittingVolunteer] = useState(false);

  // Applied to an input whose field the server (or a local check) has flagged.
  const fieldStyle = (errors: Record<string, string>, field: string) =>
    errors[field]
      ? 'border-red-400 bg-red-50 focus:ring-red-500'
      : 'border-gray-300 focus:ring-red-500';
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

  // Id of the request whose approve/reject is in flight, so the buttons cannot be
  // double-submitted.
  const [statusUpdatingId, setStatusUpdatingId] = useState<string | null>(null);

  
  const [volunteerModalOpen, setVolunteerModalOpen] = useState<boolean>(false);
  const [volunteerForm, setVolunteerForm] = useState<any>({ expectedDonationTime: '', contact: '', message: '', fulfilled: true, file: null });
  const [currentVolunteerRequestId, setCurrentVolunteerRequestId] = useState<string | null>(null);
  const [currentRequestRequiredDate, setCurrentRequestRequiredDate] = useState<string | null>(null);
  const [dateInputType, setDateInputType] = useState<'text' | 'datetime-local'>('text');
  const [showVolunteersModal, setShowVolunteersModal] = useState<boolean>(false);
  const [selectedVolunteers, setSelectedVolunteers] = useState<any[]>([]);
  const [closeModalOpen, setCloseModalOpen] = useState<boolean>(false);
  const [closeOption, setCloseOption] = useState<'closed' | 'fulfilled'>('closed');
  const [currentCloseRequestId, setCurrentCloseRequestId] = useState<string | null>(null);
  const [currentCloseVolunteers, setCurrentCloseVolunteers] = useState<any[]>([]);
  
  // Map to track per-volunteer updates in close modal: { [donorId]: { fulfilled: boolean, file: File | null } }
  const [volunteerUpdates, setVolunteerUpdates] = useState<Record<string, { fulfilled: boolean; file: File | null; success?: boolean }>>({});
  const [closeError, setCloseError] = useState<string | null>(null);
  const [submittingClose, setSubmittingClose] = useState(false);

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
    } catch (err: any) {
      console.error('Error fetching donation requests:', err);
      // Says which of "server is down", "your session ended" or "you lack permission"
      // actually happened, instead of one flat sentence for all of them.
      setError(parseApiError(err).message);
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

  // Statuses a user can meaningfully choose. Donors never see pending or rejected
  // requests (or completed ones, which live on Donation History), so offering those
  // would only ever produce an empty list.
  const STATUS_OPTIONS = userRole === 'donor'
    ? ['approved', 'in_progress', 'closed']
    : ['pending', 'approved', 'in_progress', 'completed', 'closed', 'rejected'];

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
    setFormError(null);
    setFormFieldErrors({});
    setSubmittingRequest(true);
    try {
      const payload = {
        ...formData,
        requiredDate: formData.requiredDate ? new Date(formData.requiredDate) : new Date(),
      };
      await createDonationRequest(payload as any);
      setShowModal(false);
      setFormError(null);
      setFormFieldErrors({});
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
      toast.success('Request raised. An administrator will review it shortly.');
    } catch (err: any) {
      // The dialog stays open with the offending inputs highlighted, rather than closing
      // behind an alert that said only "Failed to create donation request".
      const parsed = parseApiError(err);
      setFormError(parsed);
      setFormFieldErrors(parsed.fieldErrors);
      focusFirstError(parsed.fieldErrors);
    } finally {
      setSubmittingRequest(false);
    }
  };

  const handleStatusUpdate = async (requestId: string, newStatus: string) => {
    // A second click before the first PUT resolves used to send the transition twice,
    // which notified the requester twice for the same approval or rejection.
    if (statusUpdatingId) return;
    setStatusUpdatingId(requestId);
    try {
      // send status in uppercase to match backend conventions
      await updateDonationRequest(requestId, { status: newStatus.toUpperCase() } as any);
      await fetchDonationRequests();
      // Approving now also runs donor matching server-side, so say what happened.
      toast.success(
        newStatus.toLowerCase() === 'approved'
          ? 'Request approved. Matching donors have been notified.'
          : `Request ${newStatus.toLowerCase()}.`
      );
    } catch (err: any) {
      const parsed = parseApiError(err);
      toast.error(parsed.message);
      setError(parsed.message);
    } finally {
      setStatusUpdatingId(null);
    }
  };

  const handleVolunteer = async (requestId: string, requiredDate: string) => {
    // Use the currentUser passed as prop instead of localStorage
    if (!currentUser) {
      toast.error('Please sign in to volunteer.');
      return;
    }

    const donorId = currentUser._id || currentUser.id || currentUser.userId || '';
    if (!donorId) {
      toast.error('Please sign in to volunteer.');
      return;
    }

    setVolunteerError(null);
    setVolunteerFieldErrors({});

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
    setVolunteerError(null);
    setVolunteerFieldErrors({});
    setSubmittingVolunteer(true);
    try {
      if (!currentVolunteerRequestId) { toast.error('No request selected.'); return; }
      if (!currentUser) { toast.error('Please sign in to volunteer.'); return; }

      const donorId = currentUser._id || currentUser.id || currentUser.userId || '';
      const donorName = currentUser.name || currentUser.fullName || currentUser.firstName || '';

      // basic validation
      // Local checks now highlight their input instead of interrupting with an alert.
      const localErrors: Record<string, string> = {};
      if (!volunteerForm.contact || volunteerForm.contact.trim() === '') {
        localErrors.contact = 'A contact number is required so the hospital can reach you';
      }
      if (!volunteerForm.expectedDonationTime) {
        localErrors.expectedDonationTime = 'Tell the hospital when you expect to donate';
      }
      if (Object.keys(localErrors).length) {
        setVolunteerFieldErrors(localErrors);
        setVolunteerError(null);
        focusFirstError(localErrors);
        return;
      }

      const expectedISO = new Date(volunteerForm.expectedDonationTime).toISOString();

      // If a file is present or fulfilled flag is used, send as FormData
      let sendPayload: any = {
        donorId,
        donorName,
        contact: volunteerForm.contact,
        expectedDonationTime: expectedISO,
        message: volunteerForm.message,
        fulfilled: volunteerForm.fulfilled === true || volunteerForm.fulfilled === 'true' ? true : false,
      };

      if (volunteerForm.file) {
        const fd = new FormData();
        Object.keys(sendPayload).forEach((k) => {
          fd.append(k, (sendPayload as any)[k]);
        });
        fd.append('file', volunteerForm.file);
        sendPayload = fd;
      }

      const response: any = await volunteerForDonation(currentVolunteerRequestId, sendPayload as any);

      setVolunteerModalOpen(false);
      setCurrentVolunteerRequestId(null);
      setVolunteerForm({ expectedDonationTime: '', contact: '', message: '', fulfilled: true, file: null });
      await fetchDonationRequests();

      // The server notifies the requester and the administrators as part of recording the
      // response. This component previously tried to send that itself, through a public
      // proxy with a hard-coded phone number and email address, which reached nobody.
      const slots = response?.data?.slotsRemaining;
      toast.success(
        'Thank you — the hospital has been notified.'
        + (typeof slots === 'number' ? ` ${slots} response slot(s) remain.` : ''),
        { duration: 6000 }
      );
    } catch (err: any) {
      // The API refuses a response for concrete reasons — an incompatible blood group,
      // an unexpired waiting period, a request that already has four responses. Those are
      // shown in the dialog, in full, instead of a generic failure alert.
      const parsed = parseApiError(err, { contact: 'contact', expectedDonationTime: 'expectedDonationTime' });

      // The eligibility refusal carries a date; fold it into the reason list.
      const nextDate = err?.response?.data?.nextEligibleDate;
      if (parsed.code === 'NOT_ELIGIBLE' && nextDate) {
        parsed.reasons = [
          ...parsed.reasons,
          `You can donate again from ${new Date(nextDate).toDateString()}.`
        ];
      }

      setVolunteerError(parsed);
      setVolunteerFieldErrors(parsed.fieldErrors);
    } finally {
      setSubmittingVolunteer(false);
    }
  };

  // --- Donor matching (synopsis 9.b.3 / 9.b.4) ------------------------------
  // Approving a request runs the matching algorithm automatically. This panel lets an
  // administrator see who it selected and why, and re-run it if the first sweep found
  // nobody (for example before any donor had saved a location).
  const [matchPanel, setMatchPanel] = useState<{ requestId: string; loading: boolean; matches: any[]; meta: any } | null>(null);

  const openMatches = async (requestId: string) => {
    setMatchPanel({ requestId, loading: true, matches: [], meta: null });
    try {
      const response: any = await getMatchesForRequest(requestId);
      setMatchPanel({ requestId, loading: false, matches: response.data.matches || [], meta: response.data.meta });
    } catch (err: any) {
      setMatchPanel(null);
      toast.error(parseApiError(err).message);
    }
  };

  const notifyMatches = async (requestId: string) => {
    try {
      const response: any = await rematchRequest(requestId);
      toast.success(response.data.message);
      await openMatches(requestId);
      await fetchDonationRequests();
    } catch (err: any) {
      toast.error(parseApiError(err).message);
    }
  };

  const openVolunteersList = (volunteers: any[]) => {
    setSelectedVolunteers(volunteers || []);
    setShowVolunteersModal(true);
  };

  const openCloseModal = (requestId: string, volunteers: any[]) => {
    setCurrentCloseRequestId(requestId);
    setCurrentCloseVolunteers(volunteers || []);
    // clear legacy selected list
    // setSelectedFulfillVolunteers([]);
    setCloseOption('closed');
    setCloseModalOpen(true);
  };

  const confirmCloseRequest = async () => {
    if (!currentCloseRequestId) { toast.error('No request selected.'); return; }
    setCloseError(null);
    setSubmittingClose(true);
    try {
      const payload: any = {};
      if (closeOption === 'closed') {
        payload.status = 'CLOSED';
        await updateDonationRequest(currentCloseRequestId, payload as any);
      } else {
        // fulfilled flow: first upload per-volunteer files/flags
        // build list of volunteers with their chosen state
        const updates = currentCloseVolunteers.map((v: any) => {
          const id = String(v.donorId || v._id || '');
          const u = volunteerUpdates[id] || { fulfilled: v.fulfilled !== false, file: null, success: v.donationSuccess === true };
          return { donorId: id, donorName: v.donorName || v.donorId || '', fulfilled: !!u.fulfilled, file: u.file, success: !!u.success };
        });

        // ensure at least one fulfilled
        const fulfilledList = updates.filter((u) => u.fulfilled);
        if (fulfilledList.length === 0) {
          setCloseError('Mark at least one volunteer as having donated before completing the request.');
          setSubmittingClose(false);
          return;
        }

        // Upload per-volunteer files and flags, sequentially.
        //
        // Failures here used to be swallowed with a console warning, and the request was
        // then marked COMPLETED and reported as "updated successfully" — so a donation
        // whose record failed to save looked saved. Confirming a donation is what writes
        // the donation history and the inventory movement, so a silent failure here loses
        // real data. Collect the failures and refuse to complete if any occurred.
        const failed: string[] = [];
        for (const u of updates) {
          try {
            if (u.file) {
              const fd = new FormData();
              fd.append('file', u.file);
              fd.append('fulfilled', String(u.fulfilled));
              fd.append('success', String(u.success));
              await uploadVolunteerReport(currentCloseRequestId, u.donorId, fd);
            } else {
              await uploadVolunteerReport(currentCloseRequestId, u.donorId, { fulfilled: String(u.fulfilled), success: String(u.success) });
            }
          } catch (e: any) {
            console.warn('Failed to save report for', u.donorId, e);
            failed.push(`${u.donorName || u.donorId}: ${parseApiError(e).message}`);
          }
        }

        if (failed.length) {
          setCloseError(
            `${failed.length} donation record(s) could not be saved, so the request has not been completed. `
            + `Fix the problem below and try again.\n\n${failed.join('\n')}`
          );
          setSubmittingClose(false);
          await fetchDonationRequests();
          return;
        }

        // Now set request as completed and store fulfilled arrays
        payload.status = 'COMPLETED';
        const fulfilledByList = fulfilledList.map((s) => s.donorId);
        const fulfilledByNames = fulfilledList.map((s) => s.donorName || s.donorId || '');
        payload.fulfilledByList = fulfilledByList;
        payload.fulfilledByNames = fulfilledByNames;
        payload.fulfilledBy = fulfilledByNames.toString();
        payload.fulfilledByName = fulfilledByNames.toString();
        payload.fulfilledAt = new Date();
        await updateDonationRequest(currentCloseRequestId, payload as any);
      }
      setCloseModalOpen(false);
      setCurrentCloseRequestId(null);
      // setSelectedFulfillVolunteers([]);
      setVolunteerUpdates({});
      await fetchDonationRequests();
      toast.success(
        closeOption === 'closed'
          ? 'Request closed.'
          : 'Request completed. Donation history, medical reports and blood stock have been updated.',
        { duration: 6000 }
      );
    } catch (err: any) {
      setCloseError(parseApiError(err).message);
    } finally {
      setSubmittingClose(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page-level failures: loading the list, or an admin action on a card. This state
          was being set but never rendered, so those failures were invisible. */}
      <ErrorBanner error={error} onDismiss={() => setError(null)} />

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

                  {/* Whatever the API rejected, with each offending input highlighted below. */}
                  <ErrorBanner error={formError} onDismiss={() => setFormError(null)} className="mb-4" />

                  <div className="flex-1 overflow-y-auto">
                    <div className="grid grid-cols-1 gap-3">
                      <div>
                        <input id="patientName" name="patientName" value={formData.patientName} onChange={handleFormChange}
                          placeholder="Patient Name *" aria-invalid={Boolean(formFieldErrors.patientName)}
                          className={`w-full border p-2 rounded focus:ring-2 focus:border-transparent ${fieldStyle(formFieldErrors, 'patientName')}`} />
                        <FieldError message={formFieldErrors.patientName} />
                      </div>
                      <div>
                        <select id="bloodGroup" name="bloodGroup" value={formData.bloodGroup} onChange={handleFormChange}
                          aria-invalid={Boolean(formFieldErrors.bloodGroup)}
                          className={`w-full border p-2 rounded focus:ring-2 focus:border-transparent ${fieldStyle(formFieldErrors, 'bloodGroup')}`}>
                          <option value="">Select blood group *</option>
                          <option value="A+">A+</option>
                          <option value="A-">A-</option>
                          <option value="B+">B+</option>
                          <option value="B-">B-</option>
                          <option value="AB+">AB+</option>
                          <option value="AB-">AB-</option>
                          <option value="O+">O+</option>
                          <option value="O-">O-</option>
                        </select>
                        <FieldError message={formFieldErrors.bloodGroup} />
                      </div>
                      <div>
                        <input id="bloodUnitsCount" name="bloodUnitsCount" type="number" min={1} value={formData.bloodUnitsCount}
                          onChange={handleFormChange} placeholder="Units Required *" aria-invalid={Boolean(formFieldErrors.bloodUnitsCount)}
                          className={`w-full border p-2 rounded focus:ring-2 focus:border-transparent ${fieldStyle(formFieldErrors, 'bloodUnitsCount')}`} />
                        <FieldError message={formFieldErrors.bloodUnitsCount} />
                      </div>
                      <div>
                        <input id="medicalCondition" name="medicalCondition" value={formData.medicalCondition} onChange={handleFormChange}
                          placeholder="Medical Condition" aria-invalid={Boolean(formFieldErrors.medicalCondition)}
                          className={`w-full border p-2 rounded focus:ring-2 focus:border-transparent ${fieldStyle(formFieldErrors, 'medicalCondition')}`} />
                        <FieldError message={formFieldErrors.medicalCondition} />
                      </div>
                      <div>
                        <select id="priority" name="priority" value={formData.priority} onChange={handleFormChange}
                          aria-invalid={Boolean(formFieldErrors.priority)}
                          className={`w-full border p-2 rounded focus:ring-2 focus:border-transparent ${fieldStyle(formFieldErrors, 'priority')}`}>
                          <option value="critical">Critical</option>
                          <option value="urgent">Urgent</option>
                          <option value="normal">Normal</option>
                        </select>
                        <FieldError message={formFieldErrors.priority} />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-500 mb-1">Needed by</label>
                        <input id="requiredDate" name="requiredDate" type="date" value={formData.requiredDate} onChange={handleFormChange}
                          aria-invalid={Boolean(formFieldErrors.requiredDate)}
                          className={`w-full border p-2 rounded focus:ring-2 focus:border-transparent ${fieldStyle(formFieldErrors, 'requiredDate')}`} />
                        <FieldError message={formFieldErrors.requiredDate} />
                      </div>
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
                    <button onClick={() => { setShowModal(false); setFormError(null); setFormFieldErrors({}); }}
                      className="px-4 py-2 rounded border">Cancel</button>
                    <button onClick={submitNewRequest} disabled={submittingRequest}
                      className="px-4 py-2 rounded bg-red-600 text-white disabled:opacity-60">
                      {submittingRequest ? 'Submitting…' : 'Submit'}
                    </button>
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

            {/* A refusal here is specific and actionable — an incompatible blood group, an
                unexpired waiting period, a request that already has four responses — so it
                is shown in full rather than as a generic failure. */}
            <ErrorBanner error={volunteerError} onDismiss={() => setVolunteerError(null)} className="mb-4" />

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label htmlFor="contact" className="text-sm font-medium block mb-1">Contact number</label>
                <input id="contact" aria-label="contact" name="contact" value={volunteerForm.contact}
                  onChange={(e) => setVolunteerForm((p:any)=>({...p, contact: e.target.value}))}
                  placeholder="e.g. +91 98470 99465" aria-invalid={Boolean(volunteerFieldErrors.contact)}
                  className={`w-full border p-2 rounded focus:ring-2 focus:border-transparent ${fieldStyle(volunteerFieldErrors, 'contact')}`} />
                <FieldError message={volunteerFieldErrors.contact} />
              </div>

              <label htmlFor="expectedDonationTime" className="text-sm font-medium">Expected donation date &amp; time</label>
              <input 
                id="expectedDonationTime"
                aria-label="expectedDonationTime" 
                name="expectedDonationTime" 
                type={dateInputType} 
                value={volunteerForm.expectedDonationTime} 
                onChange={(e) => setVolunteerForm((p:any)=>({...p, expectedDonationTime: e.target.value}))} 
                min={new Date().toISOString().slice(0, 16)}
                max={currentRequestRequiredDate ? new Date(currentRequestRequiredDate).toISOString().slice(0, 16) : undefined}
                aria-invalid={Boolean(volunteerFieldErrors.expectedDonationTime)}
                className={`border p-2 rounded focus:ring-2 focus:border-transparent ${fieldStyle(volunteerFieldErrors, 'expectedDonationTime')}`}
                placeholder="dd/mm/yyyy, --:--"
                onFocus={() => setDateInputType('datetime-local')}
                onBlur={(e) => {
                  if (!e.target.value) {
                    setDateInputType('text');
                  }
                }}
              />

              <FieldError message={volunteerFieldErrors.expectedDonationTime} />

              <label className="text-sm font-medium">Message (optional)</label>
              <textarea aria-label="message" name="message" value={volunteerForm.message} onChange={(e) => setVolunteerForm((p:any)=>({...p, message: e.target.value}))} placeholder="Any notes for the hospital (optional)" className="border p-2 rounded" />

              {userRole === 'admin' && (
                <div className="flex items-center gap-3 mt-2">
                  <label className="flex items-center cursor-pointer">
                    <span className="mr-2">Donation fulfilled?</span>
                    <input
                      type="checkbox"
                      checked={volunteerForm.fulfilled}
                      onChange={e => setVolunteerForm((p:any) => ({...p, fulfilled: e.target.checked}))}
                      className="accent-green-600"
                    />
                    <span className="ml-2 font-medium text-green-700">{volunteerForm.fulfilled ? 'Fulfilled' : 'Rejected'}</span>
                  </label>
                  <label className="flex items-center">
                    <span className="mr-2">Upload medical proof (PDF/DOC):</span>
                    <label className="ml-2 inline-flex items-center gap-2">
                      <input
                        id="volunteer-form-file"
                        type="file"
                        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        className="sr-only"
                        onChange={e => setVolunteerForm((p:any) => ({...p, file: e.target.files && e.target.files[0] ? e.target.files[0] : null}))}
                      />
                      <button
                        type="button"
                        className="px-3 py-1 bg-gray-100 border rounded hover:bg-gray-200 text-sm"
                        onClick={() => (document.getElementById('volunteer-form-file') as HTMLInputElement | null)?.click()}
                      >
                        {volunteerForm.file ? volunteerForm.file.name : 'Choose file'}
                      </button>
                      {volunteerForm.file && (
                        <button type="button" onClick={() => setVolunteerForm((p:any) => ({...p, file: null}))} className="text-sm text-red-600 hover:underline">Remove</button>
                      )}
                    </label>
                  </label>
                </div>
              )}
            </div>
            <div className="mt-4 flex justify-end space-x-2">
              <button onClick={() => { setVolunteerModalOpen(false); setVolunteerError(null); setVolunteerFieldErrors({}); }}
                className="px-4 py-2 rounded border">Cancel</button>
              <button onClick={submitVolunteer} disabled={submittingVolunteer}
                className="px-4 py-2 rounded bg-blue-600 text-white disabled:opacity-60">
                {submittingVolunteer ? 'Sending…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Matched donors — the output of the matching algorithm (synopsis 9.b.3/9.b.4). */}
      {matchPanel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full max-h-[85vh] flex flex-col">
            <div className="p-6 border-b border-gray-200 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Matching donors</h2>
                {matchPanel.meta && (
                  <p className="text-sm text-gray-600 mt-1">
                    Ranked by proximity, donation history and blood group. Searched within{' '}
                    {matchPanel.meta.radiusKm}km for donors with{' '}
                    {(matchPanel.meta.acceptableGroups || []).join(', ')} blood.
                  </p>
                )}
              </div>
              <button onClick={() => setMatchPanel(null)} className="text-gray-500 hover:text-gray-700 shrink-0">Close</button>
            </div>

            <div className="overflow-y-auto p-6 flex-1">
              {matchPanel.loading && <p className="text-gray-500 text-center py-8 animate-pulse">Finding donors…</p>}

              {!matchPanel.loading && matchPanel.matches.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-600">No donor currently matches this request.</p>
                  {matchPanel.meta && (
                    <div className="text-sm text-gray-500 mt-3 space-y-1">
                      <p>{matchPanel.meta.candidatesConsidered} donor(s) had a compatible blood group.</p>
                      {/* Saying why each group was excluded is what makes an empty result actionable. */}
                      {matchPanel.meta.excluded?.ineligible > 0 &&
                        <p>{matchPanel.meta.excluded.ineligible} were within their 90-day waiting period or medically blocked.</p>}
                      {matchPanel.meta.excluded?.tooFar > 0 &&
                        <p>{matchPanel.meta.excluded.tooFar} were further than {matchPanel.meta.radiusKm}km away.</p>}
                      {matchPanel.meta.excluded?.inactive > 0 &&
                        <p>{matchPanel.meta.excluded.inactive} had a deactivated account.</p>}
                      {/* A donor who was matched earlier and has since volunteered is no
                          longer a candidate. Without this line the panel read as an empty
                          match even though the matching had in fact worked. */}
                      {matchPanel.meta.excluded?.alreadyVolunteered > 0 &&
                        <p className="text-green-700">
                          {matchPanel.meta.excluded.alreadyVolunteered} already volunteered for this request — see Volunteers.
                        </p>}
                      {matchPanel.meta.excluded?.ownRequest > 0 &&
                        <p>{matchPanel.meta.excluded.ownRequest} raised this request themselves.</p>}
                      {matchPanel.meta.hasHospitalLocation === false &&
                        <p className="text-amber-700">
                          This request's hospital has no saved location, so donors could not be ranked by distance.
                        </p>}
                    </div>
                  )}
                </div>
              )}

              {!matchPanel.loading && matchPanel.matches.length > 0 && (
                <ul className="divide-y divide-gray-100">
                  {matchPanel.matches.map((match: any) => (
                    <li key={match.userId} className="py-3 flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-medium text-gray-900">
                          {match.name}
                          <span className="ml-2 px-2 py-0.5 rounded-full bg-red-100 text-red-800 text-xs font-semibold">
                            {match.bloodGroup}
                          </span>
                        </p>
                        <p className="text-sm text-gray-600">{match.phoneNumber} · {match.email}</p>
                        <ul className="text-xs text-gray-500 mt-1 space-y-0.5">
                          {match.reasons.map((reason: string, i: number) => <li key={i}>• {reason}</li>)}
                        </ul>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-lg font-bold text-gray-900">{match.score}</div>
                        <div className="text-xs text-gray-500">match score</div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="p-6 border-t border-gray-200 flex items-center justify-between gap-3">
              <p className="text-xs text-gray-500">
                Donors are notified automatically when a request is approved. Use this to contact them again.
              </p>
              <button
                onClick={() => notifyMatches(matchPanel.requestId)}
                disabled={matchPanel.loading}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm disabled:opacity-60 whitespace-nowrap"
              >
                Re-run and notify
              </button>
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
          <div className="bg-white rounded-lg p-6 w-full max-w-md m-4">
            <h2 className="text-xl font-semibold mb-4">Close Request</h2>

            {/* Completing a request writes donation history, medical reports and blood
                stock. If any of those fail the request is not completed and the reason is
                shown here — previously the failures were logged and success was claimed. */}
            {closeError && (
              <div role="alert" className="mb-4 bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3">
                {/* whitespace-pre-line keeps the per-volunteer failure list on its own lines */}
                <p className="text-sm whitespace-pre-line">{closeError}</p>
              </div>
            )}

            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  className="accent-red-600"
                  checked={closeOption === 'closed'}
                  onChange={() => setCloseOption('closed')}
                />
                <span>Mark as closed (no donation)</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  className="accent-green-600"
                  checked={closeOption === 'fulfilled'}
                  onChange={() => setCloseOption('fulfilled')}
                />
                <span>Mark as fulfilled (select donors below)</span>
              </label>

              {closeOption === 'fulfilled' && currentCloseVolunteers && currentCloseVolunteers.length > 0 && (
                <div className="border rounded p-2 max-h-64 overflow-auto space-y-2">
                  {currentCloseVolunteers.map((v: any) => {
                    const id = String(v.donorId || v._id || '');
                    const existing = volunteerUpdates[id] || { fulfilled: v.fulfilled !== false, file: null, success: v.donationSuccess === true };
                    return (
                      <div key={id} className="grid grid-cols-[1fr,auto] items-start gap-x-4 gap-y-1 p-2 border-b last:border-b-0">
                        <div>
                          <div className="font-medium">{(v.donorName || v.donorId || 'Anonymous')}</div>
                          <div className="text-sm text-gray-500 mt-1">{v.contact || ''}</div>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <label className="inline-flex items-center">
                            <input
                              id={`file-input-${id}`}
                              type="file"
                              accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                              className="sr-only"
                              onChange={(e) => {
                                const f = e.target.files && e.target.files[0] ? e.target.files[0] : null;
                                setVolunteerUpdates((prev) => ({
                                  ...prev,
                                  [id]: {
                                    ...(prev[id] || {}),
                                    file: f,
                                    fulfilled: prev[id]?.fulfilled ?? (v.fulfilled !== false),
                                    success: prev[id]?.success ?? (v.donationSuccess === true),
                                  },
                                }));
                              }}
                            />
                            <button
                              type="button"
                              className="px-3 py-1 bg-gray-100 border rounded hover:bg-gray-200 text-sm"
                              onClick={() => (document.getElementById(`file-input-${id}`) as HTMLInputElement | null)?.click()}
                            >
                              { (volunteerUpdates[id] && volunteerUpdates[id].file) ? volunteerUpdates[id].file.name : (v.medicalProofFile ? v.medicalProofFile.split('/').pop() : 'Choose file') }
                            </button>
                          </label>

                          <label className="inline-flex items-center">
                            <input
                              type="checkbox"
                              className="accent-green-600 mr-2"
                              checked={existing.fulfilled}
                              onChange={(e) => {
                                const val = e.target.checked;
                                setVolunteerUpdates((prev) => ({
                                  ...prev,
                                  [id]: {
                                    ...(prev[id] || {}),
                                    fulfilled: val,
                                    file: prev[id]?.file || null,
                                    success: val ? (prev[id]?.success ?? (v.donationSuccess === true)) : false,
                                  },
                                }));
                              }}
                            />
                            <span className="text-sm">Fulfilled</span>
                          </label>
                          {existing.fulfilled && (
                            <label className="inline-flex items-center mt-1">
                              <input
                                type="checkbox"
                                className="accent-blue-600 mr-2"
                                checked={!!existing.success}
                                onChange={(e) => {
                                  const val = e.target.checked;
                                  setVolunteerUpdates((prev) => ({ ...prev, [id]: { ...(prev[id] || {}), success: val, fulfilled: prev[id]?.fulfilled ?? (v.fulfilled !== false), file: prev[id]?.file || null } }));
                                }}
                              />
                              <span className="text-sm">Success</span>
                            </label>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {closeOption === 'fulfilled' && (!currentCloseVolunteers || currentCloseVolunteers.length === 0) && (
                <p className="text-sm text-gray-500">No volunteers available to mark as fulfilled.</p>
              )}
            </div>

            <div className="mt-4 flex justify-end space-x-2">
              <button
                onClick={() => {
                  setCloseModalOpen(false);
                  // legacy selected list cleared (no-op now)
                  setCurrentCloseRequestId(null);
                }}
                className="px-4 py-2 rounded border"
              >
                Cancel
              </button>
              <button onClick={confirmCloseRequest} disabled={submittingClose}
                className="px-4 py-2 rounded bg-red-600 text-white disabled:opacity-60">
                {submittingClose ? 'Saving…' : 'Confirm'}
              </button>
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

          {/* Second row with status filter, hospital filter and sort */}
          <div className="flex flex-col md:flex-row gap-4">
            {/* Status. Kept lowercase because both the client-side filter and the
                request to the API derive from this value. */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
            >
              <option value="all">All Statuses</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                </option>
              ))}
            </select>

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
                      <button
                        onClick={() => handleStatusUpdate((request as any)._id || request.requestId, 'approved')}
                        disabled={statusUpdatingId !== null}
                        className="bg-green-600 text-white px-3 py-2 rounded-lg hover:bg-green-700 text-sm disabled:opacity-60 disabled:cursor-not-allowed">
                        Approve
                      </button>
                      <button
                        onClick={() => handleStatusUpdate((request as any)._id || request.requestId, 'rejected')}
                        disabled={statusUpdatingId !== null}
                        className="bg-red-600 text-white px-3 py-2 rounded-lg hover:bg-red-700 text-sm disabled:opacity-60 disabled:cursor-not-allowed">
                        Reject
                      </button>
                      
                    </>
                  )}

                  {userRole === 'admin' && (
                    <button onClick={() => openVolunteersList((request as any).volunteers || [])} className="bg-gray-200 text-gray-800 px-3 py-2 rounded-lg hover:bg-gray-300 text-sm">
                      Volunteers ({((request as any).volunteers || []).length}/{(request as any).maxVolunteers || 4})
                    </button>
                  )}

                  {userRole === 'admin' && ['approved', 'in_progress'].includes((request.status || '').toLowerCase()) && (
                    <button
                      onClick={() => openMatches((request as any)._id || request.requestId)}
                      className="bg-blue-600 text-white px-3 py-2 rounded-lg hover:bg-blue-700 text-sm"
                      title="Re-runs the match now. The number is how many donors were notified when the request was approved."
                    >
                      Matched donors
                      {typeof (request as any).matching?.notifiedCount === 'number'
                        && ` (${(request as any).matching.notifiedCount})`}
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
 