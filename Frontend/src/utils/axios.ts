import axios from 'axios';

// Create an Axios instance with base URL
const api = axios.create({
  baseURL: 'http://localhost:8000/api/v1', // Change this if your backend runs elsewhere
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `${localStorage.getItem('token') || ''}`, // Example for auth token
  },
});

// Example: GET all donors
export const getAllDonors = (page = 1, size = 10) => api.get(`/donors?page=${page}&size=${size}`);

// Example: GET one donor by ID
export const getDonorById = (id: string) => api.get(`/donors/${id}`);

// Example: CREATE a donor
export const createDonor = (donorData: any) => api.post('/donors', donorData);

// Example: UPDATE a donor
export const updateDonor = (id: any, donorData: any) => api.put(`/donors/${id}`, donorData);

// Example: DELETE a donor
export const deleteDonor = (id: any) => api.delete(`/donors/${id}`);

// Login API
export const loginUser = (credentials: any) => api.post('/auth/login', credentials);

// Register API
export const registerUser = (userData: any) => api.post('/auth/register', userData);

// Example: GET donation history by user ID

// Get donor stats
export const getDonorsStats = () => api.get('/donors/stats');

// Get donation history stats
export const getDonationEntriesStats = () => api.get('/donation/history/stats');

export const getDonationHistoryByUser = (userId: string) => api.get(`/donation/history/user/${userId}/ids`);

export default api;