// =============================================================================
// TYPES: Hostel Accommodation Registration System
// =============================================================================

export type PaymentStatus = 
  | 'pending'
  | 'paid'
  | 'failed'
  | 'expired'
  | 'under_review'
  | 'refunded'
  | 'paid_at_desk';

export type UserRole = 'admin' | 'volunteer';

export interface Profile {
  id: string;
  full_name: string;
  role: UserRole;
  created_at: string;
  email?: string;
}

export interface Settings {
  id: number;
  per_night_fee: number;
  flat_fee: number;
  payments_enabled: boolean;
  expiry_minutes: number;
  refund_policy_text: string;
  updated_at: string;
}

export interface PublicSettings {
  per_night_fee: number;
  flat_fee: number;
  payments_enabled: boolean;
  expiry_minutes: number;
  refund_policy_text: string;
}

export interface Registration {
  id: string;
  reference_id: string;
  scan_token: string;
  full_name: string;
  phone: string;
  email: string;
  gender?: string;
  college_or_organisation?: string;
  emergency_contact?: string;
  check_in_date: string;
  check_out_date: string;
  nights: number;
  rate_per_night: number;
  flat_fee: number;
  amount: number;
  payment_status: PaymentStatus;
  payment_method?: string | null;
  transaction_id?: string | null;
  gateway_order_id?: string | null;
  paid_at?: string | null;
  admin_note?: string | null;
  refund_reason?: string | null;
  screenshot_path?: string | null;
  screenshot_review_reason?: string | null;
  checked_in_at?: string | null;
  checked_in_by?: string | null;
  created_at: string;
  expires_at: string;
}

export interface PublicRegistration {
  id?: string;
  referenceId: string;
  scanToken: string;
  fullName: string;
  email: string;
  phone: string;
  gender?: string;
  emergencyContact?: string;
  collegeOrOrganisation?: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  ratePerNight: number;
  flatFee: number;
  amount: number;
  paymentStatus: PaymentStatus;
  paymentMethod?: string | null;
  transactionId?: string | null;
  paidAt?: string | null;
  createdAt: string;
  expiresAt: string;
  checkedInAt?: string | null;
  checkedInByName?: string | null;
  screenshotPath?: string | null;
  screenshotReviewReason?: string | null;
  refundPolicyText?: string;
  isPaid: boolean;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface EmailOutboxItem {
  id: string;
  registration_id: string;
  to_email: string;
  subject: string;
  body_html: string;
  type: 'confirmation' | 'refund' | 'other';
  status: 'queued' | 'sent' | 'failed';
  created_at: string;
}

export interface DashboardStats {
  total_collected: number;
  paid_count: number;
  unpaid_count: number;
  under_review_count: number;
  refunded_count: number;
}
