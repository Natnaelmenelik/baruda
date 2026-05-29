import { translations, Lang } from "@/lib/i18n/translations";

function fill(template: string, values: Record<string, string | number>) {
  return Object.entries(values).reduce(
    (acc, [key, value]) => acc.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

function getTxt(lang: Lang) {
  return ((translations as any)[lang] || (translations as any).en) as Record<string, string>;
}

function label(lang: Lang, key: string, fallback: string, values?: Record<string, string | number>) {
  const txt = getTxt(lang);
  const template = txt[key] || (translations as any).en?.[key] || fallback;
  return values ? fill(template, values) : template;
}

function getMessage(error: any): string {
  if (!error) return "";
  if (typeof error === "string") return error;
  if (typeof error?.message === "string") return error.message;
  if (typeof error?.error === "string") return error.error;

  if (Array.isArray(error?.errors) && error.errors.length > 0) {
    const first = error.errors[0];
    if (typeof first === "string") return first;
    if (typeof first?.message === "string") {
      if (first?.number) return `Number ${first.number}: ${first.message}`;
      return first.message;
    }
  }

  return "";
}

export function translateApiError(error: any, lang: Lang) {
  const code = typeof error?.code === "string" ? error.code : "";

  if (code) {
    const codeMap: Record<string, string> = {
      PHONE_PASSWORD_REQUIRED: "phonePasswordRequired",
      PHONE_NAME_PASSWORD_REQUIRED: "phoneNamePasswordRequired",
      INVALID_CREDENTIALS: "invalidCredentials",
      PHONE_ALREADY_REGISTERED: "phoneAlreadyRegistered",
      TOO_MANY_LOGIN_ATTEMPTS: "tooManyLoginAttempts",
      TOO_MANY_REGISTRATION_ATTEMPTS: "tooManyRegistrationAttempts",
      TOO_MANY_PASSWORD_RESET_REQUESTS: "tooManyPasswordResetRequests",
      INVALID_USER_PASSWORD_SETUP: "invalidUserPasswordSetup",
      LOGIN_FAILED: "loginFailed",
      REGISTRATION_FAILED: "registerFailed",
      EMAIL_REQUIRED: "emailRequired",
      UNAUTHORIZED: "unauthorized",
      REQUEST_FAILED: "requestFailed",
    };

    const key = codeMap[code];
    if (key) return label(lang, key, getMessage(error) || code);
  }

  const raw = getMessage(error).trim();
  if (!raw) return "";

  let match: RegExpMatchArray | null;

  // Submit limit / rate-limit errors
  if (/maximum submission limit of 6 receipts in 12 hours/i.test(raw)) {
    return label(lang, "submitLimitReached", raw);
  }
  if (/too many login attempts/i.test(raw)) {
    return label(lang, "tooManyLoginAttempts", raw);
  }
  if (/too many registration attempts/i.test(raw)) {
    return label(lang, "tooManyRegistrationAttempts", raw);
  }
  if (/too many password reset requests/i.test(raw)) {
    return label(lang, "tooManyPasswordResetRequests", raw);
  }

  // Auth/register/forgot-password errors
  if (/invalid credentials/i.test(raw)) return label(lang, "invalidCredentials", raw);
  if (/phone and password are required/i.test(raw)) return label(lang, "phonePasswordRequired", raw);
  if (/phone, name, and password are required/i.test(raw)) return label(lang, "phoneNamePasswordRequired", raw);
  if (/phone already registered/i.test(raw)) return label(lang, "phoneAlreadyRegistered", raw);
  if (/invalid user password setup/i.test(raw)) return label(lang, "invalidUserPasswordSetup", raw);
  if (/login failed/i.test(raw)) return label(lang, "loginFailed", raw);
  if (/registration failed/i.test(raw)) return label(lang, "registerFailed", raw);
  if (/email is required/i.test(raw)) return label(lang, "emailRequired", raw);
  if (/unauthorized/i.test(raw)) return label(lang, "unauthorized", raw);

  // Number/pool dynamic validation errors
  match = raw.match(/Number\s+(\d+)\s+only\s+has\s+([0-9.,]+)\s+Birr\s+remaining/i);
  if (match) {
    return label(lang, "numberOnlyHasRemaining", raw, {
      number: match[1],
      amount: match[2],
    });
  }

  match = raw.match(/Number\s+(\d+)\s+pool\s+not\s+found/i);
  if (match) {
    return label(lang, "numberPoolNotFoundWithNumber", raw, { number: match[1] });
  }

  match = raw.match(/Number\s+(\d+)\s+is\s+already\s+closed/i);
  if (match) {
    return label(lang, "numberAlreadyClosed", raw, { number: match[1] });
  }

  match = raw.match(/Number\s+(\d+).*already\s+(reserved|reached|closed)/i);
  if (match) {
    return label(lang, "numberTargetReserved", raw, { number: match[1] });
  }

  match = raw.match(/Amount exceeds remaining balance\s*\(([^)]+)\)/i);
  if (match) {
    return label(lang, "amountExceedsRemainingWithAmount", raw, { amount: match[1] });
  }

  match = raw.match(/Amount exceeds remaining for number\s+(\d+)/i);
  if (match) {
    return label(lang, "amountExceedsRemainingForNumber", raw, { number: match[1] });
  }


  // Admin manual close dynamic validation errors
  match = raw.match(/Number\s+(\d+)\s+is\s+not\s+available\.?/i);
  if (match) {
    return label(lang, "numberNotAvailableWithNumber", raw, { number: match[1] });
  }

  match = raw.match(/Number\s+(\d+)\s+is\s+already\s+closed\.?/i);
  if (match) {
    return label(lang, "numberAlreadyClosedWithNumber", raw, { number: match[1] });
  }

  if (/client name is required/i.test(raw)) return label(lang, "clientNameRequired", raw);
  if (/client name is too long/i.test(raw)) return label(lang, "clientNameTooLong", raw);
  if (/at least one valid number and amount is required/i.test(raw)) {
    return label(lang, "atLeastOneValidNumberAmountRequired", raw);
  }
  if (/you can close up to 20 numbers at once/i.test(raw)) {
    return label(lang, "manualCloseMaxNumbers", raw);
  }
  if (/failed to load manual entries/i.test(raw)) return label(lang, "failedToLoadManualEntries", raw);
  if (/failed to close number for client/i.test(raw)) return label(lang, "manualCloseFailed", raw);

  // Static validation/API errors
  if (/amount exceeds remaining balance/i.test(raw)) return label(lang, "amountExceedsRemaining", raw);
  if (/failed to reserve selected amount/i.test(raw)) return label(lang, "failedToReserveSelectedAmount", raw);
  if (/failed to create payment hold/i.test(raw)) return label(lang, "failedToCreatePaymentHold", raw);
  if (/invalid hold amount/i.test(raw)) return label(lang, "invalidHoldAmount", raw);
  if (/number target already reserved\/reached/i.test(raw)) return label(lang, "numberTargetReserved", raw, { number: "" }).trim();
  if (/invalid amount/i.test(raw)) return label(lang, "invalidAmount", raw);
  if (/invalid number/i.test(raw)) return label(lang, "invalidNumber", raw);
  if (/number pool not found/i.test(raw)) return label(lang, "numberPoolNotFound", raw);
  if (/no numbers selected/i.test(raw)) return label(lang, "noNumbersSelected", raw);
  if (/please enter at least one valid contribution amount/i.test(raw)) return label(lang, "pleaseEnterValidContribution", raw);
  if (/validation failed/i.test(raw)) return label(lang, "validationFailed", raw);
  if (/failed to return submission to pending/i.test(raw)) return label(lang, "failedToReturnPending", raw);
  if (/submission returned to pending/i.test(raw)) return label(lang, "returnedToPending", raw);
  if (/request failed/i.test(raw)) return label(lang, "requestFailed", raw);

  return raw;
}
