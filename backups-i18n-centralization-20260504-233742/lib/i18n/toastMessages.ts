export type Lang = 'en' | 'am';

export const toastMessages = {
  en: {
    loginLoading: 'Logging in...',
    loginSuccess: 'Login successful.',
    loginFailed: 'Login failed.',
    networkError: 'Network error. Please try again.',

    registerLoading: 'Creating account...',
    registerSuccess: 'Registration successful. Please login.',
    registerFailed: 'Registration failed.',
    passwordMismatch: 'Passwords do not match.',

    logoutSuccess: 'Logged out successfully.',

    uploadLoading: 'Uploading receipt...',
    uploadSuccess: 'Receipt uploaded successfully.',
    uploadFailed: 'Receipt upload failed. Please try again.',
    uploadNoUrl: 'Upload completed, but no image URL was returned.',
    imageOnly: 'Please upload an image file only.',
    imageTooLarge: 'Image must be less than 4MB.',
    receiptRemoved: 'Receipt removed. You can upload another one.',

    submitLoading: 'Submitting number...',
    submitSuccess: 'Submission sent for admin approval.',
    submitFailed: 'Submission failed.',
    receiptRequired: 'Please upload receipt first.',
    invalidReceipt: 'Invalid receipt. Please upload again.',

    approveLoading: 'Approving submission...',
    approveSuccess: 'Submission approved successfully.',
    approveFailed: 'Approve failed.',

    rejectLoading: 'Rejecting submission...',
    rejectSuccess: 'Submission rejected successfully.',
    rejectFailed: 'Reject failed.',

    clearLoading: 'Clearing submissions...',
    clearSuccess: 'All submissions cleared.',
    clearFailed: 'Clear failed.',

    drawLoading: 'Picking winner...',
    drawFailed: 'Draw failed.',

    receiptLoading: 'Loading receipt...',
    receiptLoaded: 'Receipt loaded.',
    receiptLoadFailed: 'Failed to load receipt.',
  },

  am: {
    loginLoading: 'በመግባት ላይ...',
    loginSuccess: 'መግባት ተሳክቷል።',
    loginFailed: 'መግባት አልተሳካም።',
    networkError: 'የኔትወርክ ችግኝ አጋጥሟል። እባክዎ እንደገና ይሞክሩ።',

    registerLoading: 'አካውንት በመፍጠር ላይ...',
    registerSuccess: 'መመዝገብ ተሳክቷል። እባክዎ ይግቡ።',
    registerFailed: 'መመዝገብ አልተሳካም።',
    passwordMismatch: 'የይለፍ ቃሎቹ አይመሳሰሉም።',

    logoutSuccess: 'በተሳካ ሁኔታ ወጥተዋል።',

    uploadLoading: 'ደረሰኝ በመጫን ላይ...',
    uploadSuccess: 'ደረሰኙ በተሳካ ሁኔታ ተጫኗል።',
    uploadFailed: 'ደረሰኝ መጫን አልተሳካም። እባክዎ እንደገና ይሞክሩ።',
    uploadNoUrl: 'ፋይሉ ተጫኗል፣ ግን የምስል URL አልተመለሰም።',
    imageOnly: 'እባክዎ የምስል ፋይል ብቻ ይጫኑ።',
    imageTooLarge: 'ምስሉ ከ4MB በታች መሆን አለበት።',
    receiptRemoved: 'ደረሰኙ ተወግዷል። ሌላ መጫን ይችላሉ።',

    submitLoading: 'ቁጥር በመላክ ላይ...',
    submitSuccess: 'ጥያቄዎ ለአድሚን ማረጋገጫ ተልኳል።',
    submitFailed: 'ማስገባት አልተሳካም።',
    receiptRequired: 'እባክዎ መጀመሪያ ደረሰኝ ይጫኑ።',
    invalidReceipt: 'ደረሰኙ ትክክል አይደለም። እባክዎ እንደገና ይጫኑ።',

    approveLoading: 'በማጽደቅ ላይ...',
    approveSuccess: 'ጥያቄው በተሳካ ሁኔታ ጸድቋል።',
    approveFailed: 'ማጽደቅ አልተሳካም።',

    rejectLoading: 'በመ رفض ላይ...',
    rejectSuccess: 'ጥያቄው በተሳካ ሁኔታ ተرفض ተደርጓል።',
    rejectFailed: 'መ رفض አልተሳካም።',

    clearLoading: 'ጥያቄዎችን በማጽዳት ላይ...',
    clearSuccess: 'ሁሉም ጥያቄዎች ተጠርገዋል።',
    clearFailed: 'ማጽዳት አልተሳካም።',

    drawLoading: 'አሸናፊ በመምረጥ ላይ...',
    drawFailed: 'አሸናፊ መምረጥ አልተሳካም።',

    receiptLoading: 'ደረሰኝ በመጫን ላይ...',
    receiptLoaded: 'ደረሰኝ ተጫኗል።',
    receiptLoadFailed: 'ደረሰኝ መጫን አልተሳካም።',
  },
} as const;

export function tm(lang: Lang, key: keyof typeof toastMessages.en) {
  return toastMessages[lang]?.[key] || toastMessages.en[key];
}
