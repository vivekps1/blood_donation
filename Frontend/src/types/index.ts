export  interface User {
  user_id: string;
  first_name: string;
  last_name?: string;

  email: string;
  phone_number: string;
  password: string;
  blood_group: string;
  role: 'donor' | 'admin';
  date_of_birth: string;
  created_at: string;
  is_active: boolean;
}

export interface DonationRequest {
  id: string;
  hospital_name: string;
  blood_type: string;
  units_needed: number;
  urgency: 'critical' | 'urgent' | 'routine';
  status: 'pending' | 'approved' | 'fulfilled' | 'cancelled';
  request_date: string;
  required_by: string;
  contact_person: string;
  phone: string;
  location: string;
  description?: string;
  created_by: string;
  responses: number;
}

export interface Donor {
  _id: string;
  name: string;
  email: string;
  address?: string;
  phoneNumber: string;
  bloodGroup: string;
  height?: string;
  weight?: string;
  date: string;
  diseases?: string;
  age: number;
  bloodPressure: number;
  status: number;
  // Added fields from backend
  totalDonations?: number;
  lastDonationDate?: string | null;
  lastStatus?: string | null;
  eligibility?: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: 'donation_request' | 'eligibility' | 'system';
  title: string;
  message: string;
  is_read: boolean;
  created_at: string;
  data?: any;
}
 