export type Lang = 'en' | 'am';

export const toastMessages = {
  en: {
    loginLoading: 'Logging in...', loginSuccess: 'Login successful.', loginFailed: 'Login failed.', invalidCredentials: 'Invalid phone number or password.', phonePasswordRequired: 'Phone number and password are required.', networkError: 'Network error. Please try again.',
    registerLoading: 'Creating account...', registerSuccess: 'Registration successful. Please login.', registerFailed: 'Registration failed.', passwordMismatch: 'Passwords do not match.', logoutSuccess: 'Logged out successfully.',
    uploadLoading: 'Uploading receipt...', uploadSuccess: 'Receipt uploaded successfully.', uploadFailed: 'Receipt upload failed. Please try again.', uploadNoUrl: 'Upload completed, but no image URL was returned.', imageOnly: 'Please upload an image file only.', imageTooLarge: 'Image must be less than 4MB.', receiptRemoved: 'Receipt removed. You can upload another one.',
    submitLoading: 'Submitting number...', submitSuccess: 'Submission sent for admin approval.', submitFailed: 'Submission failed.', receiptRequired: 'Please upload receipt first.', invalidReceipt: 'Invalid receipt. Please upload again.',
    approveLoading: 'Approving submission...', approveSuccess: 'Submission approved successfully.', approveFailed: 'Approve failed.', rejectLoading: 'Rejecting submission...', rejectSuccess: 'Submission rejected successfully.', rejectFailed: 'Reject failed.',
    clearLoading: 'Clearing submissions...', clearSuccess: 'All submissions cleared.', clearFailed: 'Clear failed.', drawLoading: 'Picking winner...', drawFailed: 'Draw failed.', receiptLoading: 'Loading receipt...', receiptLoaded: 'Receipt loaded.', receiptLoadFailed: 'Failed to load receipt.',
    settingsLoading: 'Loading settings...', settingsSaved: 'Lottery settings updated successfully.', settingsSaveFailed: 'Failed to save settings.', settingsLoadFailed: 'Failed to load settings.', winnerPicked: 'Winner picked!', winnerPickFailed: 'Failed to pick winner.',
  },
  am: {
    loginLoading: 'በመግባት ላይ...', loginSuccess: 'መግባት ተሳክቷል።', loginFailed: 'መግባት አልተሳካም።', invalidCredentials: 'የስልክ ቁጥር ወይም የይለፍ ቃል ትክክል አይደለም።', phonePasswordRequired: 'ስልክ ቁጥር እና የይለፍ ቃል ያስፈልጋሉ።', networkError: 'የኔትወርክ ችግር ተፈጥሯል። እባክዎ እንደገና ይሞክሩ።',
    registerLoading: 'መለያ በመፍጠር ላይ...', registerSuccess: 'ምዝገባው ተሳክቷል። እባክዎ ይግቡ።', registerFailed: 'ምዝገባው አልተሳካም።', passwordMismatch: 'የይለፍ ቃሎቹ አይዛመዱም።', logoutSuccess: 'በተሳካ ሁኔታ ወጥተዋል።',
    uploadLoading: 'ደረሰኝ በመስቀል ላይ...', uploadSuccess: 'ደረሰኝ በተሳካ ሁኔታ ተሰቅሏል።', uploadFailed: 'ደረሰኝ መስቀል አልተሳካም። እባክዎ እንደገና ይሞክሩ።', uploadNoUrl: 'መስቀሉ ተጠናቋል፣ ግን የምስሉ URL አልተመለሰም።', imageOnly: 'እባክዎ የምስል ፋይል ብቻ ይስቀሉ።', imageTooLarge: 'ምስሉ ከ4MB በታች መሆን አለበት።', receiptRemoved: 'ደረሰኙ ተወግዷል። ሌላ መስቀል ይችላሉ።',
    submitLoading: 'ቁጥር በማስገባት ላይ...', submitSuccess: 'ግቤቱ ለአስተዳዳሪ ማጽደቅ ተልኳል።', submitFailed: 'ግቤቱ አልተሳካም።', receiptRequired: 'እባክዎ መጀመሪያ ደረሰኝ ይስቀሉ።', invalidReceipt: 'ደረሰኙ ትክክል አይደለም። እባክዎ እንደገና ይስቀሉ።',
    approveLoading: 'ግቤቱን በማጽደቅ ላይ...', approveSuccess: 'ግቤቱ በተሳካ ሁኔታ ጸድቋል።', approveFailed: 'ማጽደቅ አልተሳካም።', rejectLoading: 'ግቤቱን ውድቅ በማድረግ ላይ...', rejectSuccess: 'ግቤቱ በተሳካ ሁኔታ ውድቅ ተደርጓል።', rejectFailed: 'ውድቅ ማድረግ አልተሳካም።',
    clearLoading: 'ግቤቶችን በማጽዳት ላይ...', clearSuccess: 'ሁሉም ግቤቶች ተጠርገዋል።', clearFailed: 'ማጽዳት አልተሳካም።', drawLoading: 'አሸናፊ በመምረጥ ላይ...', drawFailed: 'ዕጣ ማውጣት አልተሳካም።', receiptLoading: 'ደረሰኝ በመጫን ላይ...', receiptLoaded: 'ደረሰኝ ተጭኗል።', receiptLoadFailed: 'ደረሰኝ መጫን አልተሳካም።',
    settingsLoading: 'ቅንብሮችን በመጫን ላይ...', settingsSaved: 'የሎተሪ ቅንብሮች በተሳካ ሁኔታ ተዘምነዋል።', settingsSaveFailed: 'ቅንብሮችን ማስቀመጥ አልተሳካም።', settingsLoadFailed: 'ቅንብሮችን መጫን አልተሳካም።', winnerPicked: 'አሸናፊ ተመርጧል!', winnerPickFailed: 'አሸናፊ መምረጥ አልተሳካም።',
  },
} as const;

export type ToastKey = keyof typeof toastMessages.en;

export function tm(lang: Lang, key: ToastKey) {
  return toastMessages[lang]?.[key] || toastMessages.en[key];
}
