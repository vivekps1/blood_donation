// Shared domain types.
//
// These now follow the API's actual field names (camelCase, matching the Mongoose
// models) rather than the snake_case of the synopsis's table design. The previous
// definitions described neither: `User.role` and `DonationRequest.units_needed` did not
// exist on any response, so anything typed against them was typed against nothing.

export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';
export type UserRole = 'donor' | 'admin' | 'hospital';

export const BLOOD_GROUPS: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export interface RolePermissions {
  roleId: number;
  userRole: UserRole;
  manageUsers: boolean;
  manageHospitals: boolean;
  manageDonationRequests: boolean;
  viewMedicalReports: boolean;
  viewReports: boolean;
  generateNotifications: boolean;
  accessLevel?: string;
  description?: string;
}

export interface User {
  _id: string;
  firstName: string;
  lastName?: string;
  email: string;
  phoneNumber: string;
  bloodGroup: BloodGroup | string;
  dateofBirth?: string;
  address?: string;
  photo?: string;
  roleId: number;
  userRole?: UserRole;
  permissions?: RolePermissions | null;
  /** Gates sign-in; controlled by an administrator. */
  isActive: boolean;
  /** Set once the code sent at registration has been entered. */
  isVerified: boolean;
  referralCode?: string;
  referralCount?: number;
  notificationPreferences?: { email?: boolean; sms?: boolean; app?: boolean };
  totalDonations?: number;
  createdAt?: string;
}

export type RequestStatus = 'PENDING' | 'APPROVED' | 'IN_PROGRESS' | 'COMPLETED' | 'CLOSED' | 'REJECTED';
export type Priority = 'Normal' | 'Urgent' | 'Critical';

export interface Volunteer {
  donorId: string;
  donorName?: string;
  contact?: string;
  expectedDonationTime?: string;
  message?: string;
  volunteeredAt?: string;
  fulfilled?: boolean;
  donationSuccess?: boolean;
  medicalProofFile?: string;
  /** Present once the donation was confirmed and its permanent records written. */
  medicalReportId?: string;
  donationHistoryId?: string;
  unitsDonated?: number;
  confirmedAt?: string;
}

export interface DonationRequest {
  _id: string;
  requestId?: string;
  patientName?: string;
  bloodGroup: BloodGroup | string;
  bloodUnitsCount: number;
  /** Units actually collected, as opposed to requested. */
  unitsFulfilled?: number;
  medicalCondition?: string;
  priority?: Priority | string;
  status: RequestStatus | string;
  approved?: boolean;
  requestDate?: string;
  requiredDate?: string;
  requestedBy?: string;
  hospitalId?: string;
  hospitalName?: string;
  hospitalAddress?: string;
  hospitalPhone?: string;
  volunteers?: Volunteer[];
  availableDonors?: number;
  /** The response cap: a request stops accepting volunteers past this (synopsis 9.b.3). */
  maxVolunteers?: number;
  rejectedReason?: string;
  /** Outcome of the automatic matching run triggered on approval. */
  matching?: { lastRunAt?: string; notifiedCount?: number; notifiedUserIds?: string[]; radiusKm?: number };
  distanceMeters?: number | null;
}

export interface Donor {
  _id: string;
  userId?: string;
  name: string;
  email: string;
  phoneNumber: string;
  bloodGroup: BloodGroup | string;
  address?: string;
  height?: string;
  weight?: string;
  age: number;
  diseases?: string;
  /** Stored medical flag; the computed verdict below is authoritative for matching. */
  eligibility?: 'eligible' | 'ineligible';
  eligibilityReasons?: string[];
  nextEligibleDate?: string | null;
  daysUntilEligible?: number;
  totalDonations?: number;
  lastDonationDate?: string | null;
  lastStatus?: string | null;
}

/** The output of utils/eligibility.evaluateDonor on the server. */
export interface EligibilityVerdict {
  eligible: boolean;
  status: 'eligible' | 'ineligible';
  reasons: string[];
  lastDonationDate: string | null;
  nextEligibleDate: string | null;
  daysUntilEligible: number;
}

/** One entry from the matching algorithm, with the reasons it was selected. */
export interface DonorMatch {
  userId: string;
  donorId: string;
  name: string;
  email: string;
  phoneNumber: string;
  bloodGroup: string;
  exactGroupMatch: boolean;
  distanceKm: number | null;
  donationCount: number;
  score: number;
  reasons: string[];
}

export interface MedicalReport {
  _id: string;
  reportId: string;
  userId: string;
  hospitalId?: string;
  requestId?: string;
  reportDate: string;
  reportType: 'Screening' | 'Post-Donation' | 'General';
  filePath?: string;
  hemoglobinLevel?: string;
  bloodPressure?: string;
  sugarLevel?: string;
  /** tb_medical_report.is_fit_to_donate — drives donor eligibility. */
  isEligible: boolean;
  testResult?: string;
  medicalCondition?: string;
  doctorName?: string;
  donor?: Pick<User, 'firstName' | 'lastName' | 'email' | 'bloodGroup'> | null;
  hospital?: { hospitalName: string } | null;
}

export interface DonationHistoryEntry {
  _id: string;
  donationId: string;
  userId: string;
  hospitalId?: string;
  requestId?: string;
  reportId?: string;
  donationDate: string;
  donatedUnits: number;
  donationType: string;
  status: 'Success' | 'Failed' | string;
  remarks?: string;
}

export interface BloodInventoryLine {
  _id: string;
  hospitalId: string | { _id: string; hospitalName: string; city?: string };
  bloodGroup: BloodGroup | string;
  unitsAvailable: number;
  unitsReserved: number;
  /** Available minus reserved: what can genuinely be promised. */
  unitsFree: number;
  reorderThreshold: number;
  lastRestockedAt?: string;
  lastIssuedAt?: string;
}

export type InventoryMovement = 'IN' | 'OUT' | 'RESERVE' | 'RELEASE' | 'EXPIRED' | 'ADJUST';

export interface InventoryTransaction {
  _id: string;
  hospitalId: string | { hospitalName: string };
  bloodGroup: string;
  type: InventoryMovement;
  units: number;
  balanceAfter?: number;
  expiryDate?: string;
  note?: string;
  createdAt: string;
}

/** Domain events that raise a notification (see Backend/utils/notify.js). */
export type NotificationCategory =
  | 'REQUEST_CREATED' | 'REQUEST_APPROVED' | 'REQUEST_REJECTED' | 'REQUEST_COMPLETED'
  | 'DONOR_MATCHED' | 'DONOR_VOLUNTEERED' | 'DONATION_RECORDED' | 'DONOR_ELIGIBLE'
  | 'ACCOUNT_VERIFICATION' | 'ACCOUNT_STATUS' | 'PASSWORD_RESET' | 'PASSWORD_CHANGED'
  | 'REFERRAL_JOINED' | 'LOW_INVENTORY' | 'ADMIN_BROADCAST';

export interface Notification {
  _id: string;
  userId: string;
  category?: NotificationCategory | string;
  title?: string;
  message: string;
  channels?: ('app' | 'email' | 'sms')[];
  delivery?: {
    email?: { status: 'pending' | 'sent' | 'failed' | 'skipped'; sentAt?: string; error?: string };
    sms?: { status: 'pending' | 'sent' | 'failed' | 'skipped'; sentAt?: string; error?: string };
  };
  requestId?: string;
  meta?: Record<string, any>;
  isRead: boolean;
  readAt?: string;
  sentAt: string;
}

export interface Hospital {
  _id: string;
  hospitalName: string;
  regNo: string;
  contactName: string;
  email: string;
  phoneNumber: string;
  address: string;
  city?: string;
  state?: string;
  pincode: string;
  isVerified: boolean;
  hospitalLocationGeo?: { type: 'Point'; coordinates: [number, number] };
}
