// User Profile APIs
export const getUserProfile = (userId: string | number) => api.get(`/user-profile/${userId}`);
export const updateUserProfile = (userId: string | number, profileData: any) => api.put(`/user-profile/${userId}`, profileData);

// Upload a user's profile photo
export const uploadProfilePhoto = (userId: string | number, file: File) => {
  const fd = new FormData();
  fd.append('photo', file);
  // Let axios set multipart boundary header automatically. Also ensure token is sent explicitly in case interceptors not set.
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = token;
  return api.post(`/user-profile/${userId}/photo`, fd, { headers });
};
export const createUserProfile = (profileData: any) => api.post('/user-profile', profileData);
// Hospital Management APIs
export const getAllHospitals = () => api.get('/hospitals');
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

export const volunteerForDonation = (requestId: string, payload: { donorId: string; donorName?: string; contact?: string; expectedDonationTime?: string | Date; message?: string; }) =>
  api.post(`/donation-requests/${requestId}/volunteer`, payload);

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

export default api;