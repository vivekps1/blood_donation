// User Profile APIs
export const getUserProfile = (userId: string | number) => api.get(`/user-profile/${userId}`);
export const updateUserProfile = (userId: string | number, profileData: any) => api.put(`/user-profile/${userId}`, profileData);

// Upload a user's profile photo
export const uploadProfilePhoto = (userId: string | number, file: File) => {
  const fd = new FormData();
  fd.append('photo', file);
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = token;
  // The Content-Type must be overridden per request. This instance defaults to
  // 'application/json', and axios's transformRequest converts a FormData body to a JSON
  // object whenever the content type says JSON — so the file was silently dropped and
  // multer answered "No file uploaded". Axios replaces this value with the real
  // multipart type and boundary before sending, as it does for the other uploads below.
  headers['Content-Type'] = 'multipart/form-data';
  return api.post(`/user-profile/${userId}/photo`, fd, { headers });
};
export const createUserProfile = (profileData: any) => api.post('/user-profile', profileData);
// Hospital Management APIs
export const getAllHospitals = (
  page = 1,
  size = 10,
  sortField?: string,
  sortOrder?: string,
  search?: string,
  isVerified?: boolean
) => {
  const params = new URLSearchParams();
  params.append('page', String(page));
  params.append('size', String(size));
  if (sortField) params.append('sortField', sortField);
  if (sortOrder) params.append('sortOrder', sortOrder);
  if (search) params.append('search', search);
  if (typeof isVerified === 'boolean') params.append('isVerified', String(isVerified));
  return api.get(`/hospitals?${params.toString()}`);
};
export const createHospital = (hospitalData: any) => api.post('/hospitals', hospitalData);
export const updateHospital = (id: string, hospitalData: any) => api.put(`/hospitals/${id}`, hospitalData);
export const deleteHospital = (id: string) => api.delete(`/hospitals/${id}`);
export const getNearbyHospitals = (lat: number, lng: number, radiusMeters = 5000) => api.get(`/hospitals/nearby?lat=${lat}&lng=${lng}&radius=${radiusMeters}`);
import axios from 'axios';

// Create an Axios instance with base URL
const api = axios.create({
  baseURL: 'http://localhost:8000/api/v1', // Change this if your backend runs elsewhere
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to set the latest token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (!config.headers) {
    config.headers = {};
  }
  if (token) {
    config.headers['Authorization'] = token;
  } else {
    delete config.headers['Authorization'];
  }
  return config;
});

/**
 * Fired when the server rejects a request with 401 while a token was present, i.e. the
 * session expired or the account was deactivated mid-session. App listens for it and
 * signs the user out, rather than leaving them on a screen where every call fails.
 */
export const SESSION_EXPIRED_EVENT = 'bdms:session-expired';

// Endpoints where a 401 means "wrong credentials", not "your session ended".
const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/forgot-password', '/auth/reset-password', '/auth/verify'];

// Response interceptor.
//
// Errors that a form is going to render inline are passed straight through for the caller
// to handle. The two categories no form can sensibly own are handled here: an expired
// session, and failures the user would otherwise never see at all.
api.interceptors.response.use(
  response => response,
  error => {
    const status = error?.response?.status;
    const url: string = error?.config?.url || '';
    const isAuthCall = AUTH_PATHS.some(path => url.startsWith(path));

    if (status === 401 && !isAuthCall && localStorage.getItem('token')) {
      localStorage.removeItem('token');
      window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
    }

    // Server faults and network failures are logged; without this they vanish silently
    // when a caller only renders `error.response.data.message`, which does not exist.
    if (!error.response) {
      console.error('[api] network error:', url, error.message);
    } else if (status >= 500) {
      console.error('[api] server error:', status, url, error.response.data);
    }

    return Promise.reject(error);
  }
);



// Example: GET all donors
export const getAllDonors = (
  page = 1,
  size = 10,
  sortField?: string,
  sortOrder?: string,
  search?: string,
  bloodType?: string,
  eligibility?: string
) => {
  const params = new URLSearchParams();
  params.append('page', String(page));
  params.append('size', String(size));
  if (sortField) params.append('sortField', sortField);
  if (sortOrder) params.append('sortOrder', sortOrder);
  if (search) params.append('search', search);
  if (bloodType && bloodType !== 'all') params.append('bloodType', bloodType);
  if (eligibility && eligibility !== 'all') params.append('eligibility', eligibility);
  return api.get(`/donors?${params.toString()}`);
};

// Example: GET one donor by ID
export const getDonorById = (id: string) => api.get(`/donors/${id}`);

// Example: CREATE a donor
export const createDonor = (donorData: any) => api.post('/donors', donorData);

// Example: UPDATE a donor
export const updateDonor = (id: any, donorData: any) => api.put(`/donors/${id}`, donorData);

// Example: DELETE a donor
export const deleteDonor = (id: any) => api.delete(`/donors/${id}`);

// Donation Request APIs
export const getAllDonationRequests = (filters?: { status?: string; lat?: number; lng?: number; radius?: number; accuracy?: number }) => {
  const params = new URLSearchParams();
  if (filters?.status && filters.status !== 'all') params.append('status', String(filters.status));
  if (typeof filters?.lat !== 'undefined' && typeof filters?.lng !== 'undefined') {
    params.append('lat', String(filters.lat));
    params.append('lng', String(filters.lng));
    if (typeof filters?.accuracy !== 'undefined') {
      params.append('accuracy', String(filters.accuracy));
    }
  }
  if (filters?.radius) params.append('radius', String(filters.radius));
  const qs = params.toString();
  console.log('Fetching donation requests with query string:', qs);
  return api.get(`/donation-requests${qs ? `?${qs}` : ''}`);
};

export const getDonationRequestById = (id: string) => api.get(`/donation-requests/${id}`);

export const createDonationRequest = (requestData: any) => api.post('/donation-requests', requestData);

export const updateDonationRequest = (id: string, requestData: {
  status?: string;
  availableDonors?: number;
  [key: string]: any;
}) => api.put(`/donation-requests/${id}`, requestData);

export const deleteDonationRequest = (id: string) => api.delete(`/donation-requests/${id}`);

export const volunteerForDonation = (requestId: string, payload: any) => {
  // If payload is FormData (for file upload), set headers accordingly
  if (payload instanceof FormData) {
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = token;
    return api.post(`/donation-requests/${requestId}/volunteer`, payload, { headers: { ...headers, 'Content-Type': 'multipart/form-data' } });
  }
  return api.post(`/donation-requests/${requestId}/volunteer`, payload);
};

// Upload or update a volunteer's report (admin)
export const uploadVolunteerReport = (requestId: string, volunteerId: string, payload: any) => {
  // payload expected to be FormData if file included
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = token;
  if (payload instanceof FormData) {
    return api.post(`/donation-requests/${requestId}/volunteer/${volunteerId}/report`, payload, { headers: { ...headers, 'Content-Type': 'multipart/form-data' } });
  }
  return api.post(`/donation-requests/${requestId}/volunteer/${volunteerId}/report`, payload, { headers });
};

// Login API
export const loginUser = (credentials: any) => api.post('/auth/login', credentials);

// Register API
export const registerUser = (userData: any) => api.post('/auth/register', userData);

// Example: GET donation history by user ID

// Get donor stats
export const getDonorsStats = () => api.get('/donors/stats');

// System-wide stats
export const getSystemStats = () => api.get('/stats');

// Get donation history stats
export const getDonationEntriesStats = () => api.get('/donation/history/stats');

export const getDonationHistoryByUser = (userId: string) => api.get(`/donation/history/user/${userId}/ids`);

// Donation history aggregation
export const getDonationHistoryAggregate = (params: Record<string, any>) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') search.append(k, String(v));
  });
  const qs = search.toString();
  return api.get(`/donation/history/aggregate${qs ? `?${qs}` : ''}`);
};
// Notifications
export const getNotifications = (params: any) => api.get('/notifications', { params });
export const markNotificationAsRead = (id: string) => api.put(`/notifications/${id}/read`);
export const markAllNotificationsAsReadForUser = (userId: string) => api.put(`/notifications/user/${userId}/read-all`);
export const createNotificationApi = (payload: any) => api.post('/notifications', payload);

// ---------------------------------------------------------------------------
// Account verification, password management and referrals
// (synopsis 9.b.1 and section 10)
// ---------------------------------------------------------------------------

export const verifyAccount = (payload: { code: string; email?: string }) =>
  api.post('/auth/verify', payload);
export const resendVerificationCode = (payload: { email?: string }) =>
  api.post('/auth/resend-verification', payload);

export const changePassword = (payload: { currentPassword: string; newPassword: string }) =>
  api.post('/auth/change-password', payload);
export const forgotPassword = (email: string) =>
  api.post('/auth/forgot-password', { email });
export const resetPassword = (payload: { email: string; token: string; newPassword: string }) =>
  api.post('/auth/reset-password', payload);

export const getMyReferral = () => api.get('/auth/referral');
export const validateReferralCode = (code: string) => api.get(`/auth/referral/${code}`);

// ---------------------------------------------------------------------------
// User management (Admin Dashboard module)
// ---------------------------------------------------------------------------

const toQuery = (params: Record<string, any> = {}, skipAll = false) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    if (skipAll && v === 'all') return;
    search.append(k, String(v));
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
};

export const getUsers = (params: {
  search?: string; role?: string; status?: string; verified?: string;
  page?: number; size?: number; sortField?: string; sortOrder?: string;
} = {}) => api.get(`/users${toQuery(params, true)}`);

export const getPendingUsers = () => api.get('/users/pending');
export const getUserById = (id: string) => api.get(`/users/${id}`);
export const createUserAccount = (payload: any) => api.post('/users', payload);
export const updateUserAccount = (id: string, payload: any) => api.put(`/users/${id}`, payload);
export const setUserStatus = (id: string, isActive: boolean) =>
  api.patch(`/users/${id}/status`, { isActive });
export const setUserRole = (id: string, roleId: number) =>
  api.patch(`/users/${id}/role`, { roleId });
export const deleteUserAccount = (id: string) => api.delete(`/users/${id}`);
export const getMe = () => api.get('/users/me');
export const updateNotificationPreferences = (prefs: { email?: boolean; sms?: boolean; app?: boolean }) =>
  api.put('/users/me/preferences', prefs);

export const getRoles = () => api.get('/roles');

// ---------------------------------------------------------------------------
// Donor matching (synopsis 9.b.3 / 9.b.4)
// ---------------------------------------------------------------------------

// Requests this donor is blood-group compatible with and currently eligible for.
export const getRequestsOpenForMe = () => api.get('/donation-requests/open-for-me');

// Admin: preview which donors the matching algorithm selects for a request.
export const getMatchesForRequest = (requestId: string, params?: { radiusKm?: number; limit?: number }) =>
  api.get(`/donation-requests/${requestId}/matches${toQuery(params || {})}`);

// Admin: re-run matching and notify the selected donors.
export const rematchRequest = (requestId: string, payload?: { radiusKm?: number; limit?: number }) =>
  api.post(`/donation-requests/${requestId}/rematch`, payload || {});

export const getDonorEligibility = (userId: string) => api.get(`/donors/eligibility/${userId}`);

// ---------------------------------------------------------------------------
// Medical reports (tb_medical_report)
// ---------------------------------------------------------------------------

export const getMedicalReports = (params: Record<string, any> = {}) =>
  api.get(`/medical-reports${toQuery(params, true)}`);
export const getMedicalReportById = (id: string) => api.get(`/medical-reports/${id}`);
export const getLatestMedicalReport = (userId: string) => api.get(`/medical-reports/user/${userId}/latest`);

export const createMedicalReport = (payload: any) => {
  // FormData when a scanned report is attached; JSON otherwise.
  if (payload instanceof FormData) {
    return api.post('/medical-reports', payload, { headers: { 'Content-Type': 'multipart/form-data' } });
  }
  return api.post('/medical-reports', payload);
};
export const updateMedicalReport = (id: string, payload: any) => {
  if (payload instanceof FormData) {
    return api.put(`/medical-reports/${id}`, payload, { headers: { 'Content-Type': 'multipart/form-data' } });
  }
  return api.put(`/medical-reports/${id}`, payload);
};
export const deleteMedicalReport = (id: string) => api.delete(`/medical-reports/${id}`);

// ---------------------------------------------------------------------------
// Blood inventory
// ---------------------------------------------------------------------------

export const getInventory = (params: { hospitalId?: string; bloodGroup?: string; lowStockOnly?: boolean } = {}) =>
  api.get(`/inventory${toQuery(params, true)}`);

// What can actually be transfused into a patient of this group, across all compatible stock.
export const getInventoryAvailability = (bloodGroup: string, hospitalId?: string) =>
  api.get(`/inventory/availability${toQuery({ bloodGroup, hospitalId })}`);

export const stockIn = (payload: { hospitalId: string; bloodGroup: string; units: number; note?: string }) =>
  api.post('/inventory/stock-in', payload);
export const stockOut = (payload: { hospitalId: string; bloodGroup: string; units: number; note?: string; requestId?: string }) =>
  api.post('/inventory/stock-out', payload);
export const reserveStock = (payload: { hospitalId: string; bloodGroup: string; units: number; requestId?: string }) =>
  api.post('/inventory/reserve', payload);
export const releaseStock = (payload: { hospitalId: string; bloodGroup: string; units: number; requestId?: string }) =>
  api.post('/inventory/release', payload);
export const updateStockThreshold = (id: string, reorderThreshold: number) =>
  api.put(`/inventory/${id}/threshold`, { reorderThreshold });
export const getInventoryTransactions = (params: Record<string, any> = {}) =>
  api.get(`/inventory/transactions${toQuery(params, true)}`);
export const runInventoryExpiry = () => api.post('/inventory/expire', {});

// ---------------------------------------------------------------------------
// Reports module
// ---------------------------------------------------------------------------

export type ReportName = 'summary' | 'donations' | 'donors' | 'requests' | 'inventory';

export const getReport = (name: ReportName, params: Record<string, any> = {}) =>
  api.get(`/reports/${name}${toQuery(params, true)}`);

// Download a report as CSV. Fetched as a blob so the Authorization header is sent —
// a plain anchor to the endpoint would arrive unauthenticated and be rejected.
export const downloadReportCsv = async (name: ReportName, params: Record<string, any> = {}) => {
  const response = await api.get(
    `/reports/${name}${toQuery({ ...params, format: 'csv' }, true)}`,
    { responseType: 'blob' }
  );

  const url = window.URL.createObjectURL(new Blob([response.data as BlobPart], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${name}-report-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

// ---------------------------------------------------------------------------
// Notification extras
// ---------------------------------------------------------------------------

export const previewNotificationAudience = (payload: any) =>
  api.post('/notifications/audience-preview', payload);
export const getNotificationStats = (params: Record<string, any> = {}) =>
  api.get(`/notifications/stats${toQuery(params)}`);
export const runEligibilitySweep = (windowDays = 7) =>
  api.post('/notifications/eligibility-sweep', { windowDays });

export default api;
