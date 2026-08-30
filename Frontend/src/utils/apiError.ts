/**
 * Normalises everything the API can return into one shape the UI can render.
 *
 * The backend answers with several different envelopes depending on which layer rejected
 * the request:
 *
 *   400  { message: 'Validation failed', errors: { email: 'email must be...' } }  ← validateBody
 *   409  { code: 'DUPLICATE', msg: '...', fields: { email: true } }               ← auth register
 *   401  { msg: '...' }                                                          ← auth controllers
 *   403  { code: 'NOT_ELIGIBLE', message: '...', reasons: [...] }                ← donation requests
 *   4xx  { message: '...' }                                                      ← most controllers
 *
 * Every component previously had to know all of these, so most of them showed nothing at
 * all, or a bare `alert('There was an error')`. This turns any of them — plus network
 * failures and non-JSON responses — into { message, fieldErrors, ... }.
 */

export interface NormalisedError {
  /** Human-readable sentence, always populated. */
  message: string;
  /** Per-input messages, keyed by the *frontend* field name. */
  fieldErrors: Record<string, string>;
  /** Machine-readable code, when the API sent one (DUPLICATE, NOT_ELIGIBLE, ...). */
  code?: string;
  /** Supporting bullet points, e.g. why a donor is not eligible. */
  reasons: string[];
  status?: number;
  /** True when the request never reached the server. */
  isNetworkError: boolean;
}

/**
 * Backend field names mapped to the input names the forms actually use.
 *
 * The registration form calls its inputs `phone`, `bloodType` and `dateOfBirth` while the
 * API validates `phoneNumber`, `bloodGroup` and `dateofBirth`. Without this mapping the
 * error would arrive for a field the form does not have, and nothing would highlight.
 */
const FIELD_ALIASES: Record<string, string> = {
  phoneNumber: 'phone',
  bloodGroup: 'bloodType',
  dateofBirth: 'dateOfBirth',
  bloodUnitsCount: 'unitsNeeded',
  requiredDate: 'requiredBy',
  hospitalName: 'name',
  contactName: 'contactPerson'
};

/** Turn "email must be a valid email address" into "Must be a valid email address". */
const tidy = (field: string, message: string): string => {
  const withoutField = message.startsWith(field) ? message.slice(field.length).trim() : message;
  const text = withoutField || message;
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/**
 * @param error   The thrown value from an axios call.
 * @param aliases Extra per-form field mappings, merged over the defaults.
 */
export const parseApiError = (error: any, aliases: Record<string, string> = {}): NormalisedError => {
  const result: NormalisedError = {
    message: 'Something went wrong. Please try again.',
    fieldErrors: {},
    reasons: [],
    isNetworkError: false
  };

  // The request never got a response: server down, wrong port, CORS, offline.
  if (error && !error.response) {
    result.isNetworkError = true;
    result.message = navigator.onLine
      ? 'Could not reach the server. Check that the API is running and try again.'
      : 'You appear to be offline. Check your connection and try again.';
    return result;
  }

  const { status, data } = error.response;
  result.status = status;

  // A blob response (a failed CSV download) carries its JSON inside the blob, which we
  // cannot read synchronously — fall back to the status.
  if (data instanceof Blob) {
    result.message = 'The download failed. Please try again.';
    return result;
  }

  if (typeof data === 'string' && data.trim()) {
    result.message = data;
  } else if (data && typeof data === 'object') {
    result.code = data.code;
    result.message = data.message || data.msg || data.error || result.message;
    if (Array.isArray(data.reasons)) result.reasons = data.reasons;

    const map = { ...FIELD_ALIASES, ...aliases };

    // validateBody: { errors: { field: 'field must be ...' } }
    if (data.errors && typeof data.errors === 'object') {
      Object.entries(data.errors).forEach(([field, text]) => {
        result.fieldErrors[map[field] || field] = tidy(field, String(text));
      });
    }

    // Duplicate email / phone on register: { fields: { email: true } }
    if (data.fields && typeof data.fields === 'object') {
      Object.entries(data.fields).forEach(([field, flagged]) => {
        if (!flagged) return;
        const label = field === 'phoneNumber' ? 'This phone number' : 'This email address';
        result.fieldErrors[map[field] || field] = `${label} is already registered`;
      });
    }

    // Weak password is reported as a list; attach it to the password input.
    if (data.code === 'WEAK_PASSWORD' && Array.isArray(data.errors)) {
      result.fieldErrors.password = data.errors[0];
    }
  }

  // Status-specific wording where the server's message is missing or unhelpful.
  if (!result.message || result.message === 'Something went wrong. Please try again.') {
    const byStatus: Record<number, string> = {
      401: 'Your session has expired. Please sign in again.',
      403: 'You do not have permission to do that.',
      404: 'That record could not be found.',
      409: 'That conflicts with an existing record.',
      413: 'That file is too large.',
      415: 'That file type is not accepted.',
      429: 'Too many attempts. Please wait a moment and try again.',
      500: 'The server hit an unexpected error. Please try again.'
    };
    if (byStatus[status]) result.message = byStatus[status];
  }

  // Rate limiting tells us exactly how long to wait, so say it.
  if (status === 429 && data?.retryAfterSeconds) {
    result.message = `Too many attempts. Please try again in ${data.retryAfterSeconds} second(s).`;
  }

  if (Object.keys(result.fieldErrors).length && result.message === 'Validation failed') {
    const count = Object.keys(result.fieldErrors).length;
    result.message = count === 1
      ? 'Please correct the highlighted field.'
      : `Please correct the ${count} highlighted fields.`;
  }

  return result;
};

/** Convenience for callers that only need a sentence. */
export const errorMessage = (error: any): string => parseApiError(error).message;
