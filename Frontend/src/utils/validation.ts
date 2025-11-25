// Shared validation utilities matching backend schema requirements

// Email domains allowed: .co, .com, .in, .net (mirrors RegisterUser component)
export const emailPattern = /^[^\s@]+@[^\s@]+\.(?:co|com|in|net)$/i;
export function isValidEmail(email: string): boolean {
  return emailPattern.test(email.trim());
}

// Phone: local 10 digit (India) before adding +91 prefix
export const phonePattern = /^\d{10}$/;
export function normalizePhone(raw: string): { cleaned: string; prefixed: string } {
  const cleaned = raw.replace(/\D/g, '').slice(0, 10);
  return { cleaned, prefixed: cleaned ? `+91${cleaned}` : '' };
}
export function isValidPhone(raw: string): boolean {
  return phonePattern.test(raw);
}

// Blood group validation
export const validBloodGroups = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
export function isValidBloodGroup(bloodGroup: string): boolean {
  return validBloodGroups.includes(bloodGroup);
}

// Name validation (non-empty, alphabetic characters with spaces)
export function isValidName(name: string): boolean {
  return name.trim().length > 0 && /^[a-zA-Z\s]+$/.test(name.trim());
}

// Age validation from date of birth
export function calculateAge(dateOfBirth: string | Date): number {
  const dob = new Date(dateOfBirth);
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const m = today.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

export function isValidAge(dateOfBirth: string | Date, minAge: number = 18): boolean {
  const age = calculateAge(dateOfBirth);
  return age >= minAge;
}

// Pincode validation (6 digits for India)
export const pincodePattern = /^\d{6}$/;
export function isValidPincode(pincode: string): boolean {
  return pincodePattern.test(pincode.trim());
}

// Required field validation
export function isRequired(value: any): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'number') return !isNaN(value);
  return true;
}

// Number validation (positive numbers)
export function isPositiveNumber(value: any): boolean {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return !isNaN(num) && num > 0;
}

// Date validation (not in the past for required dates)
export function isFutureDate(date: string | Date): boolean {
  const d = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d >= today;
}

// User validation
export interface UserValidation {
  firstName: string;
  lastName?: string;
  email: string;
  phoneNumber: string;
  password: string;
  bloodGroup: string;
  dateofBirth: string;
  address?: string;
  height?: number;
  weight?: number;
}

export function validateUser(data: Partial<UserValidation>): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!isRequired(data.firstName)) {
    errors.firstName = 'First name is required';
  } else if (!isValidName(data.firstName!)) {
    errors.firstName = 'First name must contain only letters';
  }

  if (isRequired(data.lastName) && !isValidName(data.lastName!)) {
    errors.lastName = 'Last name must contain only letters';
  }

  if (!isRequired(data.email)) {
    errors.email = 'Email is required';
  } else if (!isValidEmail(data.email!)) {
    errors.email = 'Enter a valid email with domain .co, .com, .in or .net';
  }

  if (!isRequired(data.phoneNumber)) {
    errors.phoneNumber = 'Phone number is required';
  } else if (!isValidPhone(data.phoneNumber!.replace(/\D/g, ''))) {
    errors.phoneNumber = 'Enter a valid 10-digit phone number';
  }

  if (!isRequired(data.password)) {
    errors.password = 'Password is required';
  } else if (data.password!.length < 6) {
    errors.password = 'Password must be at least 6 characters';
  }

  if (!isRequired(data.bloodGroup)) {
    errors.bloodGroup = 'Blood group is required';
  } else if (!isValidBloodGroup(data.bloodGroup!)) {
    errors.bloodGroup = 'Select a valid blood group';
  }

  if (!isRequired(data.dateofBirth)) {
    errors.dateofBirth = 'Date of birth is required';
  } else if (!isValidAge(data.dateofBirth!, 18)) {
    errors.dateofBirth = 'You must be at least 18 years old';
  }

  return errors;
}

// Donor validation
export interface DonorValidation {
  name: string;
  email: string;
  phoneNumber: string;
  bloodGroup: string;
  height?: string | number;
  weight?: string | number;
  dateofBirth?: string;
  address?: string;
  diseases?: string;
}

export function validateDonor(data: Partial<DonorValidation>): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!isRequired(data.name)) {
    errors.name = 'Name is required';
  } else if (!isValidName(data.name!)) {
    errors.name = 'Name must contain only letters';
  }

  if (!isRequired(data.email)) {
    errors.email = 'Email is required';
  } else if (!isValidEmail(data.email!)) {
    errors.email = 'Enter a valid email with domain .co, .com, .in or .net';
  }

  if (!isRequired(data.phoneNumber)) {
    errors.phoneNumber = 'Phone number is required';
  } else if (!isValidPhone(data.phoneNumber!.replace(/\D/g, ''))) {
    errors.phoneNumber = 'Enter a valid 10-digit phone number';
  }

  if (!isRequired(data.bloodGroup)) {
    errors.bloodGroup = 'Blood group is required';
  } else if (!isValidBloodGroup(data.bloodGroup!)) {
    errors.bloodGroup = 'Select a valid blood group';
  }

  if (isRequired(data.height) && !isPositiveNumber(data.height!)) {
    errors.height = 'Height must be a positive number';
  }

  if (isRequired(data.weight) && !isPositiveNumber(data.weight!)) {
    errors.weight = 'Weight must be a positive number';
  }

  if (data.dateofBirth && !isValidAge(data.dateofBirth, 18)) {
    errors.dateofBirth = 'Donor must be at least 18 years old';
  }

  return errors;
}

// Hospital validation
export interface HospitalValidation {
  hospitalName: string;
  regNo: string;
  contactName: string;
  email: string;
  phoneNumber: string;
  address: string;
  pincode: string;
  location?: string;
}

export function validateHospital(data: Partial<HospitalValidation>): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!isRequired(data.hospitalName)) {
    errors.hospitalName = 'Hospital name is required';
  }

  if (!isRequired(data.regNo)) {
    errors.regNo = 'Registration number is required';
  }

  if (!isRequired(data.contactName)) {
    errors.contactName = 'Contact name is required';
  } else if (!isValidName(data.contactName!)) {
    errors.contactName = 'Contact name must contain only letters';
  }

  if (!isRequired(data.email)) {
    errors.email = 'Email is required';
  } else if (!isValidEmail(data.email!)) {
    errors.email = 'Enter a valid email with domain .co, .com, .in or .net';
  }

  if (!isRequired(data.phoneNumber)) {
    errors.phoneNumber = 'Phone number is required';
  } else if (!isValidPhone(data.phoneNumber!.replace(/\D/g, ''))) {
    errors.phoneNumber = 'Enter a valid 10-digit phone number';
  }

  if (!isRequired(data.address)) {
    errors.address = 'Address is required';
  }

  if (!isRequired(data.pincode)) {
    errors.pincode = 'Pincode is required';
  } else if (!isValidPincode(data.pincode!)) {
    errors.pincode = 'Enter a valid 6-digit pincode';
  }

  return errors;
}

// Donation Request validation
export interface DonationRequestValidation {
  patientName: string;
  bloodGroup: string;
  bloodUnitsCount: number;
  priority: string;
  requiredDate: string;
  hospitalId?: string;
  medicalCondition?: string;
}

export function validateDonationRequest(data: Partial<DonationRequestValidation>): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!isRequired(data.patientName)) {
    errors.patientName = 'Patient name is required';
  } else if (!isValidName(data.patientName!)) {
    errors.patientName = 'Patient name must contain only letters';
  }

  if (!isRequired(data.bloodGroup)) {
    errors.bloodGroup = 'Blood group is required';
  } else if (!isValidBloodGroup(data.bloodGroup!)) {
    errors.bloodGroup = 'Select a valid blood group';
  }

  if (!isRequired(data.bloodUnitsCount)) {
    errors.bloodUnitsCount = 'Blood units count is required';
  } else if (!isPositiveNumber(data.bloodUnitsCount!)) {
    errors.bloodUnitsCount = 'Blood units must be a positive number';
  }

  if (!isRequired(data.priority)) {
    errors.priority = 'Priority is required';
  } else if (!['low', 'normal', 'high', 'urgent'].includes(data.priority!.toLowerCase())) {
    errors.priority = 'Select a valid priority level';
  }

  if (!isRequired(data.requiredDate)) {
    errors.requiredDate = 'Required date is required';
  } else if (!isFutureDate(data.requiredDate!)) {
    errors.requiredDate = 'Required date must be today or in the future';
  }

  return errors;
}

// Login validation
export interface LoginValidation {
  email: string;
  password: string;
}

export function validateLogin(data: Partial<LoginValidation>): Record<string, string> {
  const errors: Record<string, string> = {};

  if (!isRequired(data.email)) {
    errors.email = 'Email is required';
  } else if (!isValidEmail(data.email!)) {
    errors.email = 'Enter a valid email';
  }

  if (!isRequired(data.password)) {
    errors.password = 'Password is required';
  }

  return errors;
}
