import { ERROR_CODES } from '../constants/enums';
import { errorMessage } from '../constants/error-messages';

/**
 * Amplop respons API — DS-12. Bentuk respons mengikuti 04-BRIEF-BE.md §6.
 */

export interface ApiMeta {
  [key: string]: unknown;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: ApiMeta;
}

export interface ApiFailure {
  success: false;
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

export function ok<T>(data: T, meta?: ApiMeta): ApiSuccess<T> {
  return meta === undefined ? { success: true, data } : { success: true, data, meta };
}

export function fail(
  code: keyof typeof ERROR_CODES,
  message?: string,
  fields?: Record<string, string>,
): ApiFailure {
  return {
    success: false,
    error: {
      code: ERROR_CODES[code],
      message: message ?? errorMessage(code),
      ...(fields === undefined ? {} : { fields }),
    },
  };
}

/** Pemetaan kode error ke status HTTP. */
export function httpStatus(code: keyof typeof ERROR_CODES): number {
  const map: Record<keyof typeof ERROR_CODES, number> = {
    BAD_REQUEST: 400,
    VALIDATION_ERROR: 422,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    RATE_LIMITED: 429,
    STAGE_UNDERFLOW: 422,
    INTERNAL_ERROR: 500,
  };
  return map[code];
}
