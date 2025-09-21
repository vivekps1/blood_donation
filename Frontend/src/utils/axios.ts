import axios from 'axios';

// Create an Axios instance with base URL
const api = axios.create({
  baseURL: 'http://localhost:8000/api/v1', // Change this if your backend runs elsewhere
  headers: {
    'Content-Type': 'application/json',
  },
});

// Example: GET all donors
export const getAllDonors = () => api.get('/donors');

// Example: GET one donor by ID
export const getDonorById = (id: any) => api.get(`/donors/${id}`);

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

export default api;