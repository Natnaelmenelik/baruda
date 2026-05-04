#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-.}"
cd "$ROOT"

if [ ! -f "package.json" ] || [ ! -d "lib/i18n" ]; then
  echo "Error: run this script from the project root, or pass the project root as the first argument."
  echo "Example: bash apply-i18n-centralization.sh /path/to/lottery-system-fixed"
  exit 1
fi

echo "Creating backups..."
BACKUP_DIR="backups-i18n-centralization-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
for f in \
  lib/i18n/translations.ts \
  lib/i18n/toastMessages.ts \
  app/'(auth)'/login/page.tsx \
  app/'(auth)'/register/page.tsx \
  app/'(auth)'/forgot-password/page.tsx \
  app/'(auth)'/reset-password/page.tsx \
  app/'(protected)'/dashboard/page.tsx \
  app/'(protected)'/admin/page.tsx \
  components/AdminSettingsPanel.tsx \
  components/ConfirmSelectionModal.tsx \
  components/MyPurchasesModal.tsx \
  components/NumberGrid.tsx \
  components/PickWinnerModal.tsx \
  components/ReceiptUploader.tsx \
  components/RoleBadge.tsx \
  components/SelectedNumbersPanel.tsx \
  components/SubmitNumberModal.tsx \
  components/ThemeToggle.tsx \
  components/WinnerAnnouncement.tsx
  do
    [ -f "$f" ] && mkdir -p "$BACKUP_DIR/$(dirname "$f")" && cp "$f" "$BACKUP_DIR/$f"
  done

echo "Updating lib/i18n/translations.ts and lib/i18n/toastMessages.ts..."
cat > lib/i18n/translations.ts <<'EOF'
export const translations = {
  en: {
    login: 'Login', register: 'Register', phone: 'Phone Number', password: 'Password', name: 'Full Name', email: 'Email', dashboard: 'Dashboard', logout: 'Logout', available: 'Available', pending: 'Pending', taken: 'Taken', submit: 'Submit', cancel: 'Cancel', uploadReceipt: 'Upload Receipt', pickNumber: 'Pick a Number', myPurchases: 'My Purchases', adminPanel: 'Admin Panel', approve: 'Approve', reject: 'Reject', clearAll: 'Clear & Start New Round', pickWinner: 'Pick Random Winner', timeLeft: 'Time left', warning: 'Less than 1 minute remaining', price: 'Ticket Price', save: 'Save',
    switchToAmharic: 'አማርኛ', switchToEnglish: 'English', amharic: 'አማርኛ', english: 'English', ok: 'OK', loading: 'Loading...',
    forgotPassword: 'Forgot Password', yourEmail: 'Your email', requestReset: 'Request reset', welcomeBack: 'Welcome Back', loginSubtitle: 'Login to access your lottery', phoneNumber: 'Phone Number', enterPassword: 'Enter your password', loggingIn: 'Logging in...', dontHaveAccount: "Don't have an account?", signUp: 'Sign up', createAccount: 'Create Account', registerSubtitle: 'Enter your details to get started', fullName: 'Full Name', enterFullName: 'Enter your full name', enterPhoneStartingZero: 'Enter your phone number starting with 0', enterEmail: 'Enter your email', confirmPassword: 'Confirm Password', confirmYourPassword: 'Confirm your password', creatingAccount: 'Creating account...', alreadyHaveAccount: 'Already have an account?', newPassword: 'New password', reset: 'Reset', invalidCredentials: 'Invalid phone number or password.',
    admin: 'Admin', welcome: 'Welcome', users: 'Users', sold: 'Sold', revenue: 'Revenue', left: 'Left', submissions: 'Submissions', total: 'Total', user: 'User', numbers: 'Numbers', amount: 'Amount', receipt: 'Receipt', status: 'Status', submitted: 'Submitted', action: 'Action', picking: 'Picking...', previousWinners: 'Previous Winners', clearAllShort: 'Clear All', noSubmissions: 'No submissions found.', viewReceipt: 'View Receipt', noReceipt: 'No receipt', approving: 'Approving...', rejecting: 'Rejecting...', processed: 'Processed', unknown: 'Unknown', paymentReceipt: 'Payment Receipt', paymentReceiptAlt: 'Payment receipt', approved: 'Approved', rejected: 'Rejected', clearAllSubmissionsTitle: 'Clear All Submissions?', clearAllSubmissionsMessage: 'This will remove all current submissions and reset the round. This action cannot be undone.', yesClearAll: 'Yes, Clear All', clearing: 'Clearing...', logoutConfirmTitle: 'Are you sure you want to logout?', adminLogoutConfirmMessage: 'You will be signed out of the admin panel.', userLogoutConfirmMessage: 'You will be signed out of your account.', close: 'Close', winner: 'Winner', round: 'Round', date: 'Date', noPreviousWinners: 'No previous winners found.', loadingWinners: 'Loading winners...', qty: 'Qty', ticket: 'Ticket', failedToLoadWinners: 'Failed to load winners', birr: 'Birr',
    prizeCar: 'Prize car', gameRules: 'Game Rules', chooseNumbersRule: 'Choose one or multiple numbers', uploadReceiptRule: 'Upload payment receipt', waitApprovalRule: 'Wait for admin approval', winnerRandomRule: 'Winner is selected randomly', unapprovedNotCountedRule: 'Unapproved entries are not counted', lotterySystem: 'Lottery System', appDescription: 'Pick your lucky number and win!',
    lotterySettings: 'Lottery Settings', settingsDescription: 'Set ticket price and numbers grid size from the admin panel.', loadingSettings: 'Loading settings...', ticketPrice: 'Ticket Price', numbersGridSize: 'Numbers Grid Size', saveSettings: 'Save Settings', saving: 'Saving...', ticketPricePositive: 'Ticket price must be a positive number', gridSizeRange: 'Grid size must be between 1 and 20000', failedLoadSettings: 'Failed to load settings', failedSaveSettings: 'Failed to save settings', settingsUpdated: 'Lottery settings updated successfully',
    confirmSelection: 'Confirm Selection', confirmSelectionMessage: 'Do you want to proceed with these selected numbers?', quantity: 'Quantity', yesProceed: 'Yes, Proceed', noPurchases: 'No purchases found.', approvedLower: 'approved', pendingLower: 'pending', rejectedLower: 'rejected',
    requestFailed: 'Request failed', numberLockedByAnotherUser: 'Number is currently locked by another user.', numberTakenOrPending: 'Number is already taken or pending approval.', failedToLockNumber: 'Failed to lock number', selectAtLeastOneNumber: 'Please select at least one number.', someNumbersNotAvailable: 'Some numbers are not available', validationFailed: 'Validation failed', enterValidNumberBetween: 'Enter a valid number between 1 and', enterValidNumberBetweenFull: 'Enter a valid number between 1 and {gridSize}', numberNotFound: 'Number not found', loadingNumbers: 'Loading numbers...', failedLoadNumbers: 'Failed to load numbers.', searchNumber: 'Search number', enter: 'Enter', enterRange: 'Enter 1 - {gridSize}', search: 'Search', ticketPriceColon: 'Ticket price:', selectedByYou: 'Selected by you', beingSelected: 'Being selected', page: 'Page', previous: 'Previous', next: 'Next',
    enterValidNumbersOnly: 'Enter valid numbers only.', duplicateNumbersNotAllowed: 'Duplicate numbers are not allowed.', failedPickWinner: 'Failed to pick winner', winnerPicked: 'Winner picked!', pickWinnerTitle: 'Pick Winner', pickWinnerDescription: 'Enter up to 8 numbers. Empty fields are optional. Winner is selected only from approved numbers.',
    uploadPaymentReceipt: 'Upload Payment Receipt', receiptUploaderHelp: 'Take a clear photo or choose from your gallery.', receiptFileHint: 'JPG/PNG, max 4MB.', uploading: 'Uploading...', chooseFile: 'Choose File', receiptUploadedSuccessfully: 'Receipt uploaded successfully', receiptPreview: 'Receipt preview', removeUploadAgain: 'Remove / Upload Again', roleAdmin: 'Admin', roleUser: 'User',
    selectedNumbers: 'Selected Numbers', numbersLockedImmediately: 'Numbers are locked immediately when selected.', noNumbersSelectedYet: 'No numbers selected yet.', clickToRemove: 'Click to remove', ticketPriceLower: 'Ticket price', clear: 'Clear', proceed: 'Proceed', selectedNumbersColon: 'Selected numbers:', paymentDetails: 'Payment Details', cbe: 'CBE', telebirr: 'Telebirr', totalAmount: 'Total Amount', afterPaymentUploadReceipt: 'After payment, upload your receipt screenshot/image.', submitting: 'Submitting...', lightMode: 'Light mode', darkMode: 'Dark mode', light: 'Light', dark: 'Dark', closeWinnerAnnouncement: 'Close winner announcement', winnerAnnounced: 'Winner Announced',
  },
  am: {
    login: 'ግባ', register: 'ይመዝገቡ', phone: 'ስልክ ቁጥር', password: 'የይለፍ ቃል', name: 'ሙሉ ስም', email: 'ኢሜይል', dashboard: 'ዳሽቦርድ', logout: 'ውጣ', available: 'ይገኛል', pending: 'በመጠባበቅ ላይ', taken: 'ተይዟል', submit: 'አስገባ', cancel: 'ሰርዝ', uploadReceipt: 'ደረሰኝ ይስቀሉ', pickNumber: 'ቁጥር ይምረጡ', myPurchases: 'የእኔ ግዢዎች', adminPanel: 'የአስተዳዳሪ ፓነል', approve: 'አጽድቅ', reject: 'ውድቅ አድርግ', clearAll: 'አጽዳ እና አዲስ ዙር ጀምር', pickWinner: 'በዘፈቀደ አሸናፊ ምረጥ', timeLeft: 'የቀረው ጊዜ', warning: 'ከ1 ደቂቃ በታች ቀርቷል', price: 'የቲኬት ዋጋ', save: 'አስቀምጥ',
    switchToAmharic: 'አማርኛ', switchToEnglish: 'English', amharic: 'አማርኛ', english: 'English', ok: 'እሺ', loading: 'በመጫን ላይ...',
    forgotPassword: 'የይለፍ ቃል ረሱ?', yourEmail: 'የእርስዎ ኢሜይል', requestReset: 'የይለፍ ቃል ማደሻ ጠይቅ', welcomeBack: 'እንኳን ደህና መጡ', loginSubtitle: 'ወደ ሎተሪዎ ለመግባት ይግቡ', phoneNumber: 'ስልክ ቁጥር', enterPassword: 'የይለፍ ቃልዎን ያስገቡ', loggingIn: 'በመግባት ላይ...', dontHaveAccount: 'መለያ የለዎትም?', signUp: 'ይመዝገቡ', createAccount: 'መለያ ፍጠር', registerSubtitle: 'ለመጀመር መረጃዎን ያስገቡ', fullName: 'ሙሉ ስም', enterFullName: 'ሙሉ ስምዎን ያስገቡ', enterPhoneStartingZero: 'በ0 የሚጀምረውን ስልክ ቁጥርዎን ያስገቡ', enterEmail: 'ኢሜይልዎን ያስገቡ', confirmPassword: 'የይለፍ ቃል ያረጋግጡ', confirmYourPassword: 'የይለፍ ቃልዎን ያረጋግጡ', creatingAccount: 'መለያ በመፍጠር ላይ...', alreadyHaveAccount: 'ከዚህ በፊት መለያ አለዎት?', newPassword: 'አዲስ የይለፍ ቃል', reset: 'አድስ', invalidCredentials: 'የስልክ ቁጥር ወይም የይለፍ ቃል ትክክል አይደለም።',
    admin: 'አስተዳዳሪ', welcome: 'እንኳን ደህና መጡ', users: 'ተጠቃሚዎች', sold: 'የተሸጡ', revenue: 'ገቢ', left: 'የቀሩ', submissions: 'ግቤቶች', total: 'ጠቅላላ', user: 'ተጠቃሚ', numbers: 'ቁጥሮች', amount: 'መጠን', receipt: 'ደረሰኝ', status: 'ሁኔታ', submitted: 'የቀረበበት', action: 'እርምጃ', picking: 'በመምረጥ ላይ...', previousWinners: 'የቀድሞ አሸናፊዎች', clearAllShort: 'ሁሉንም አጽዳ', noSubmissions: 'ምንም ግቤት አልተገኘም።', viewReceipt: 'ደረሰኝ ተመልከት', noReceipt: 'ደረሰኝ የለም', approving: 'በማጽደቅ ላይ...', rejecting: 'ውድቅ በማድረግ ላይ...', processed: 'ተካሂዷል', unknown: 'ያልታወቀ', paymentReceipt: 'የክፍያ ደረሰኝ', paymentReceiptAlt: 'የክፍያ ደረሰኝ', approved: 'ጸድቋል', rejected: 'ውድቅ ተደርጓል', clearAllSubmissionsTitle: 'ሁሉንም ግቤቶች ማጽዳት?', clearAllSubmissionsMessage: 'ይህ ሁሉንም የአሁኑን ግቤቶች ያስወግዳል እና ዙሩን ዳግም ያስጀምራል። ይህ እርምጃ መመለስ አይቻልም።', yesClearAll: 'አዎ፣ ሁሉንም አጽዳ', clearing: 'በማጽዳት ላይ...', logoutConfirmTitle: 'መውጣት እንደሚፈልጉ እርግጠኛ ነዎት?', adminLogoutConfirmMessage: 'ከአስተዳዳሪ ፓነሉ ይወጣሉ።', userLogoutConfirmMessage: 'ከመለያዎ ይወጣሉ።', close: 'ዝጋ', winner: 'አሸናፊ', round: 'ዙር', date: 'ቀን', noPreviousWinners: 'የቀድሞ አሸናፊዎች አልተገኙም።', loadingWinners: 'አሸናፊዎችን በመጫን ላይ...', qty: 'ብዛት', ticket: 'ቲኬት', failedToLoadWinners: 'አሸናፊዎችን መጫን አልተሳካም', birr: 'ብር',
    prizeCar: 'የሽልማት መኪና', gameRules: 'የጨዋታ ህጎች', chooseNumbersRule: 'አንድ ወይም ብዙ ቁጥሮችን ይምረጡ', uploadReceiptRule: 'የክፍያ ደረሰኝ ይስቀሉ', waitApprovalRule: 'የአስተዳዳሪ ማጽደቅን ይጠብቁ', winnerRandomRule: 'አሸናፊው በዘፈቀደ ይመረጣል', unapprovedNotCountedRule: 'ያልጸደቁ ግቤቶች አይቆጠሩም', lotterySystem: 'የሎተሪ ስርዓት', appDescription: 'የእድል ቁጥርዎን ይምረጡ እና ያሸንፉ!',
    lotterySettings: 'የሎተሪ ቅንብሮች', settingsDescription: 'የቲኬት ዋጋን እና የቁጥሮች መጠንን ከአስተዳዳሪ ፓነል ያስተካክሉ።', loadingSettings: 'ቅንብሮችን በመጫን ላይ...', ticketPrice: 'የቲኬት ዋጋ', numbersGridSize: 'የቁጥሮች መደብ መጠን', saveSettings: 'ቅንብሮችን አስቀምጥ', saving: 'በማስቀመጥ ላይ...', ticketPricePositive: 'የቲኬት ዋጋ ከዜሮ በላይ መሆን አለበት', gridSizeRange: 'የቁጥሮች መደብ መጠን ከ1 እስከ 20000 መሆን አለበት', failedLoadSettings: 'ቅንብሮችን መጫን አልተሳካም', failedSaveSettings: 'ቅንብሮችን ማስቀመጥ አልተሳካም', settingsUpdated: 'የሎተሪ ቅንብሮች በተሳካ ሁኔታ ተዘምነዋል',
    confirmSelection: 'ምርጫዎን ያረጋግጡ', confirmSelectionMessage: 'በእነዚህ የተመረጡ ቁጥሮች መቀጠል ይፈልጋሉ?', quantity: 'ብዛት', yesProceed: 'አዎ፣ ቀጥል', noPurchases: 'ምንም ግዢ አልተገኘም።', approvedLower: 'ጸድቋል', pendingLower: 'በመጠባበቅ ላይ', rejectedLower: 'ውድቅ ተደርጓል',
    requestFailed: 'ጥያቄው አልተሳካም', numberLockedByAnotherUser: 'ቁጥሩ በሌላ ተጠቃሚ በጊዜያዊነት ተይዟል።', numberTakenOrPending: 'ቁጥሩ ቀድሞ ተይዟል ወይም ለማጽደቅ በመጠባበቅ ላይ ነው።', failedToLockNumber: 'ቁጥሩን መያዝ አልተሳካም', selectAtLeastOneNumber: 'እባክዎ ቢያንስ አንድ ቁጥር ይምረጡ።', someNumbersNotAvailable: 'አንዳንድ ቁጥሮች አይገኙም', validationFailed: 'ማረጋገጫው አልተሳካም', enterValidNumberBetween: 'ከ1 እስከ', enterValidNumberBetweenFull: 'ከ1 እስከ {gridSize} መካከል ያለ ትክክለኛ ቁጥር ያስገቡ', numberNotFound: 'ቁጥሩ አልተገኘም', loadingNumbers: 'ቁጥሮችን በመጫን ላይ...', failedLoadNumbers: 'ቁጥሮችን መጫን አልተሳካም።', searchNumber: 'ቁጥር ይፈልጉ', enter: 'አስገባ', enterRange: '1 - {gridSize}', search: 'ፈልግ', ticketPriceColon: 'የቲኬት ዋጋ፦', selectedByYou: 'በእርስዎ የተመረጠ', beingSelected: 'በመመረጥ ላይ', page: 'ገጽ', previous: 'ቀዳሚ', next: 'ቀጣይ',
    enterValidNumbersOnly: 'ትክክለኛ ቁጥሮችን ብቻ ያስገቡ።', duplicateNumbersNotAllowed: 'የተደጋገሙ ቁጥሮች አይፈቀዱም።', failedPickWinner: 'አሸናፊ መምረጥ አልተሳካም', winnerPicked: 'አሸናፊ ተመርጧል!', pickWinnerTitle: 'አሸናፊ ምረጥ', pickWinnerDescription: 'እስከ 8 ቁጥሮች ያስገቡ። ባዶ ቦታዎች አማራጭ ናቸው። አሸናፊው የሚመረጠው ከጸደቁ ቁጥሮች ብቻ ነው።',
    uploadPaymentReceipt: 'የክፍያ ደረሰኝ ይስቀሉ', receiptUploaderHelp: 'ግልጽ ፎቶ ያንሱ ወይም ከጋለሪዎ ይምረጡ።', receiptFileHint: 'JPG/PNG፣ ከፍተኛው 4MB።', uploading: 'በመስቀል ላይ...', chooseFile: 'ፋይል ይምረጡ', receiptUploadedSuccessfully: 'ደረሰኙ በተሳካ ሁኔታ ተሰቅሏል', receiptPreview: 'የደረሰኝ ቅድመ እይታ', removeUploadAgain: 'አስወግድ / እንደገና ስቀል', roleAdmin: 'አስተዳዳሪ', roleUser: 'ተጠቃሚ',
    selectedNumbers: 'የተመረጡ ቁጥሮች', numbersLockedImmediately: 'ቁጥሮች ሲመረጡ ወዲያውኑ በጊዜያዊነት ይያዛሉ።', noNumbersSelectedYet: 'እስካሁን ምንም ቁጥር አልተመረጠም።', clickToRemove: 'ለማስወገድ ይጫኑ', ticketPriceLower: 'የቲኬት ዋጋ', clear: 'አጽዳ', proceed: 'ቀጥል', selectedNumbersColon: 'የተመረጡ ቁጥሮች፦', paymentDetails: 'የክፍያ መረጃ', cbe: 'ንግድ ባንክ', telebirr: 'ቴሌብር', totalAmount: 'ጠቅላላ መጠን', afterPaymentUploadReceipt: 'ከከፈሉ በኋላ የደረሰኝ ስክሪንሾት/ምስል ይስቀሉ።', submitting: 'በማስገባት ላይ...', lightMode: 'የብርሃን ሁነታ', darkMode: 'የጨለማ ሁነታ', light: 'ብርሃን', dark: 'ጨለማ', closeWinnerAnnouncement: 'የአሸናፊ ማሳወቂያን ዝጋ', winnerAnnounced: 'አሸናፊ ታውቋል',
  },
} as const;

export type Lang = keyof typeof translations;
export type TranslationKey = keyof typeof translations.en;

export function t(lang: Lang, key: TranslationKey) {
  return translations[lang]?.[key] || translations.en[key];
}
EOF

cat > lib/i18n/toastMessages.ts <<'EOF'
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
EOF

echo "Patching UI files to use centralized translations..."
python3 <<'PY'
from pathlib import Path

def write(path, content):
    Path(path).write_text(content, encoding='utf-8')

def patch(path, old, new):
    p=Path(path)
    s=p.read_text(encoding='utf-8')
    if old not in s:
        print(f"WARN: pattern not found in {path}: {old[:80]!r}")
    else:
        s=s.replace(old,new)
        p.write_text(s,encoding='utf-8')

# Small full rewrites for compact components/pages
write("app/(auth)/forgot-password/page.tsx", """'use client';

import { useState } from 'react';
import { useLang } from '@/hooks/useLang';

export default function ForgotPasswordPage() {
  const { t, lang, setLang } = useLang();
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState('');

  function submit(e: any) {
    e.preventDefault();
    setMsg(t.ok);
  }

  return (
    <div className=\"min-h-screen flex items-center justify-center p-4\">
      <form onSubmit={submit} className=\"bg-white p-6 rounded-2xl shadow max-w-md w-full space-y-4\">
        <button type=\"button\" onClick={() => setLang(lang === 'en' ? 'am' : 'en')} className=\"rounded border px-3 py-2\">
          {lang === 'en' ? t.switchToAmharic : t.switchToEnglish}
        </button>
        <h1 className=\"text-xl font-bold\">{t.forgotPassword}</h1>
        <input className=\"w-full border rounded-xl px-4 py-3\" type=\"email\" placeholder={t.yourEmail} value={email} onChange={(e)=>setEmail(e.target.value)} required />
        <button className=\"w-full bg-blue-600 text-white rounded-xl py-3\">{t.requestReset}</button>
        {msg && <p className=\"text-sm\">{msg}</p>}
      </form>
    </div>
  );
}
""")

write("app/(auth)/reset-password/page.tsx", """'use client';

import { Suspense, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useLang } from '@/hooks/useLang';

function ResetPasswordPageContent() {
  const token = useSearchParams().get('token') || '';
  const router = useRouter();
  const { t } = useLang();
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const r = await fetch('/api/auth/reset-password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ token, password }) });
    const d = await r.json();
    if (r.ok) router.push('/login'); else setMsg(d.error);
  }

  return (
    <div className=\"min-h-screen flex items-center justify-center p-4\">
      <form onSubmit={submit} className=\"bg-white p-6 rounded-2xl shadow max-w-md w-full space-y-4\">
        <h1 className=\"text-xl font-bold\">{t.reset} {t.password}</h1>
        <input className=\"w-full border rounded-xl px-4 py-3\" type=\"password\" placeholder={t.newPassword} value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button className=\"w-full bg-blue-600 text-white rounded-xl py-3\">{t.reset}</button>
        {msg && <p className=\"text-red-600 text-sm\">{msg}</p>}
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  const { t } = useLang();
  return <Suspense fallback={<div className=\"p-8 text-center\">{t.loading}</div>}><ResetPasswordPageContent /></Suspense>;
}
""")

write("components/ConfirmSelectionModal.tsx", """'use client';

import { translations, Lang } from '@/lib/i18n/translations';

type Props = { open: boolean; selectedNumbers: number[]; ticketPrice: number; onCancel: () => void; onConfirm: () => void; lang: Lang; };

export default function ConfirmSelectionModal({ open, selectedNumbers, ticketPrice, onCancel, onConfirm, lang }: Props) {
  if (!open) return null;
  const txt = translations[lang];
  const totalAmount = ticketPrice * selectedNumbers.length;
  return (
    <div className=\"fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4\">
      <div className=\"w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl\">
        <h2 className=\"text-xl font-bold\">{txt.confirmSelection}</h2>
        <p className=\"mt-3 text-sm text-gray-600\">{txt.confirmSelectionMessage}</p>
        <div className=\"mt-4 flex flex-wrap gap-2\">{selectedNumbers.map((num) => <span key={num} className=\"rounded-full bg-blue-100 px-3 py-1 text-sm font-bold text-blue-700\">{num}</span>)}</div>
        <div className=\"mt-4 rounded-xl bg-gray-50 p-3 text-sm\">
          <div className=\"flex justify-between\"><span>{txt.ticketPrice}</span><b>{ticketPrice.toLocaleString()} {txt.birr}</b></div>
          <div className=\"flex justify-between\"><span>{txt.quantity}</span><b>{selectedNumbers.length}</b></div>
          <div className=\"mt-2 flex justify-between border-t pt-2\"><span>{txt.total}</span><b>{totalAmount.toLocaleString()} {txt.birr}</b></div>
        </div>
        <div className=\"mt-6 flex gap-3\"><button onClick={onCancel} className=\"flex-1 rounded-xl border px-4 py-3 font-semibold\">{txt.cancel}</button><button onClick={onConfirm} className=\"flex-1 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white\">{txt.yesProceed}</button></div>
      </div>
    </div>
  );
}
""")

write("components/SelectedNumbersPanel.tsx", """'use client';

import { translations, Lang } from '@/lib/i18n/translations';

type Props = { selectedNumbers: number[]; ticketPrice: number; onProceed: () => void; onClear: () => void; onRemove: (num: number) => void; lang: Lang; };

export default function SelectedNumbersPanel({ selectedNumbers, ticketPrice, onProceed, onClear, onRemove, lang }: Props) {
  const txt = translations[lang];
  const totalAmount = ticketPrice * selectedNumbers.length;
  return (
    <aside className=\"sticky top-4 h-fit self-start rounded-2xl border border-blue-100 bg-white p-4 shadow-lg\">
      <div className=\"border-b pb-3\"><h3 className=\"text-lg font-bold text-gray-900\">{txt.selectedNumbers}</h3><p className=\"text-sm text-gray-500\">{txt.numbersLockedImmediately}</p></div>
      {selectedNumbers.length === 0 ? <div className=\"py-8 text-center text-sm text-gray-500\">{txt.noNumbersSelectedYet}</div> : <>
        <div className=\"my-4 flex max-h-56 flex-wrap gap-2 overflow-auto pr-1\">{selectedNumbers.map((num) => <button key={num} type=\"button\" onClick={() => onRemove(num)} className=\"rounded-full bg-blue-600 px-3 py-1 text-sm font-bold text-white hover:bg-blue-700\" title={txt.clickToRemove}>{num}</button>)}</div>
        <div className=\"space-y-2 rounded-xl bg-blue-50 p-3 text-sm text-blue-950\"><div className=\"flex justify-between\"><span>{txt.ticketPriceLower}</span><b>{ticketPrice.toLocaleString()} {txt.birr}</b></div><div className=\"flex justify-between\"><span>{txt.quantity}</span><b>{selectedNumbers.length}</b></div><div className=\"flex justify-between border-t border-blue-200 pt-2 text-base\"><span>{txt.total}</span><b>{totalAmount.toLocaleString()} {txt.birr}</b></div></div>
        <div className=\"mt-4 grid grid-cols-2 gap-2\"><button type=\"button\" onClick={onClear} className=\"rounded-xl border px-4 py-3 text-sm font-semibold text-gray-700\">{txt.clear}</button><button type=\"button\" onClick={onProceed} className=\"rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white\">{txt.proceed}</button></div>
      </>}
    </aside>
  );
}
""")

write("components/ThemeToggle.tsx", """'use client';

import { useTheme } from '@/hooks/useTheme';
import { useLang } from '@/hooks/useLang';

function SunIcon() { return <svg className=\"h-5 w-5\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"1.8\" viewBox=\"0 0 24 24\"><path strokeLinecap=\"round\" strokeLinejoin=\"round\" d=\"M12 3v2.2M12 18.8V21M4.22 4.22l1.56 1.56M18.22 18.22l1.56 1.56M3 12h2.2M18.8 12H21M4.22 19.78l1.56-1.56M18.22 5.78l1.56-1.56\" /><circle cx=\"12\" cy=\"12\" r=\"4\" /></svg>; }
function MoonIcon() { return <svg className=\"h-5 w-5\" fill=\"none\" stroke=\"currentColor\" strokeWidth=\"1.8\" viewBox=\"0 0 24 24\"><path strokeLinecap=\"round\" strokeLinejoin=\"round\" d=\"M21 14.6A8.5 8.5 0 019.4 3 7.6 7.6 0 1012 21a8.5 8.5 0 009-6.4z\" /></svg>; }

export default function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const { t } = useLang();
  const isDark = theme === 'dark';
  return <button type=\"button\" onClick={toggleTheme} className=\"inline-flex items-center justify-center gap-2 rounded-xl bg-white px-3 py-2 font-semibold text-gray-800 shadow transition hover:bg-gray-50 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700\" title={isDark ? t.lightMode : t.darkMode}>{isDark ? <SunIcon /> : <MoonIcon />}<span className=\"hidden sm:inline\">{isDark ? t.light : t.dark}</span></button>;
}
""")

write("components/RoleBadge.tsx", """'use client';

import { getClientUser } from '@/lib/auth/client';
import { useLang } from '@/hooks/useLang';

export default function RoleBadge() {
  const user = getClientUser();
  const { t } = useLang();
  if (!user) return null;
  return <span className={`rounded-full px-3 py-1 text-xs font-bold ${user.isAdmin ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>{user.isAdmin ? t.roleAdmin : t.roleUser}</span>;
}
""")
PY

# Targeted safe replacements in larger files
python3 <<'PY'
from pathlib import Path

def replace(path, old, new):
    p = Path(path); s = p.read_text(encoding='utf-8')
    if old not in s: print('WARN missing', path, old[:60])
    s = s.replace(old, new)
    p.write_text(s, encoding='utf-8')

# Login
replace("app/(auth)/login/page.tsx", "const { lang, setLang } = useLang();", "const { t, lang, setLang } = useLang();")
replace("app/(auth)/login/page.tsx", "const msg = data.error || tm(lang, 'loginFailed');\n        setError(msg);\n        toast.error(msg, { id: 'login' });\n        return;", "let msg = tm(lang, 'loginFailed');\n        if (data.error === 'Invalid credentials') {\n          msg = tm(lang, 'invalidCredentials');\n        } else if (data.error === 'Phone and password are required') {\n          msg = tm(lang, 'phonePasswordRequired');\n        } else if (data.error) {\n          msg = lang === 'am' ? tm(lang, 'loginFailed') : data.error;\n        }\n        setError(msg);\n        toast.error(msg, { id: 'login' });\n        return;")
replace("app/(auth)/login/page.tsx", "{lang === 'en' ? 'አማርኛ' : 'English'}", "{lang === 'en' ? t.switchToAmharic : t.switchToEnglish}")
replace("app/(auth)/login/page.tsx", "{lang === 'am' ? 'እንኳን ደህና መጡ' : 'Welcome Back'}", "{t.welcomeBack}")
replace("app/(auth)/login/page.tsx", "{lang === 'am'\n              ? 'ወደ ሎተሪዎ ለመግባት ይግቡ'\n              : 'Login to access your lottery'}", "{t.loginSubtitle}")
replace("app/(auth)/login/page.tsx", "{lang === 'am' ? 'ስልክ ቁጥር' : 'Phone Number'}", "{t.phoneNumber}")
replace("app/(auth)/login/page.tsx", "{lang === 'am' ? 'የይለፍ ቃል' : 'Password'}", "{t.password}")
replace("app/(auth)/login/page.tsx", "placeholder={lang === 'am' ? 'የይለፍ ቃልዎን ያስገቡ' : 'Enter your password'}", "placeholder={t.enterPassword}")
replace("app/(auth)/login/page.tsx", "{loading\n              ? lang === 'am'\n                ? 'በመግባት ላይ...'\n                : 'Logging in...'\n              : lang === 'am'\n              ? 'ግባ'\n              : 'Login'}", "{loading ? t.loggingIn : t.login}")
replace("app/(auth)/login/page.tsx", "{lang === 'am' ? 'አካውንት የለዎትም?' : \"Don't have an account?\"}", "{t.dontHaveAccount}")
replace("app/(auth)/login/page.tsx", "{lang === 'am' ? 'ይመዝገቡ' : 'Sign up'}", "{t.signUp}")
replace("app/(auth)/login/page.tsx", "<Suspense fallback={<div className=\"p-8 text-center\">Loading...</div>}>", "<Suspense fallback={<div className=\"p-8 text-center\">Loading...</div>}>")

# Register
replace("app/(auth)/register/page.tsx", "const { lang, setLang } = useLang();", "const { t, lang, setLang } = useLang();")
replace("app/(auth)/register/page.tsx", "{lang === 'en' ? 'አማርኛ' : 'English'}", "{lang === 'en' ? t.switchToAmharic : t.switchToEnglish}")
replace("app/(auth)/register/page.tsx", "{lang === 'am' ? 'አካውንት ይፍጠሩ' : 'Create Account'}", "{t.createAccount}")
replace("app/(auth)/register/page.tsx", "{lang === 'am'\n              ? 'ለመጀመር መረጃዎን ያስገቡ'\n              : 'Enter your details to get started'}", "{t.registerSubtitle}")
for old,new in [("{lang === 'am' ? 'ሙሉ ስም' : 'Full Name'}","{t.fullName}"),("placeholder={lang === 'am' ? 'ሙሉ ስምዎን ያስገቡ' : 'Enter your full name'}","placeholder={t.enterFullName}"),("{lang === 'am' ? 'ስልክ ቁጥር' : 'Phone Number'}","{t.phoneNumber}"),("{lang === 'am'\n                ? 'በ0 የሚጀምር ስልክ ቁጥርዎን ያስገቡ'\n                : 'Enter your phone number starting with 0'}","{t.enterPhoneStartingZero}"),("{lang === 'am' ? 'ኢሜይል' : 'Email'}","{t.email}"),("placeholder={lang === 'am' ? 'ኢሜይልዎን ያስገቡ' : 'Enter your email'}","placeholder={t.enterEmail}"),("{lang === 'am' ? 'የይለፍ ቃል' : 'Password'}","{t.password}"),("placeholder={lang === 'am' ? 'የይለፍ ቃል ያስገቡ' : 'Enter your password'}","placeholder={t.enterPassword}"),("{lang === 'am' ? 'የይለፍ ቃል ያረጋግጡ' : 'Confirm Password'}","{t.confirmPassword}"),("placeholder={lang === 'am' ? 'የይለፍ ቃልዎን ያረጋግጡ' : 'Confirm your password'}","placeholder={t.confirmYourPassword}"),("{lang === 'am' ? 'አካውንት አለዎት?' : 'Already have an account?'}","{t.alreadyHaveAccount}"),("{lang === 'am' ? 'ይግቡ' : 'Login'}","{t.login}")]: replace("app/(auth)/register/page.tsx", old, new)
replace("app/(auth)/register/page.tsx", "{loading\n              ? lang === 'am'\n                ? 'አካውንት በመፍጠር ላይ...'\n                : 'Creating account...'\n              : lang === 'am'\n              ? 'ይመዝገቡ'\n              : 'Register'}", "{loading ? t.creatingAccount : t.register}")

# Dashboard
replace("app/(protected)/dashboard/page.tsx", "{lang === 'en' ? 'አማርኛ' : 'English'}", "{lang === 'en' ? t.switchToAmharic : t.switchToEnglish}")
replace("app/(protected)/dashboard/page.tsx", "alt={lang === 'am' ? 'የሽልማት መኪና' : 'Prize car'}", "alt={t.prizeCar}")
replace("app/(protected)/dashboard/page.tsx", "{lang === 'am' ? 'የጨዋታ ህጎች' : 'Game Rules'}", "{t.gameRules}")
replace("app/(protected)/dashboard/page.tsx", "{lang === 'am' ? (\n                  <>\n                    <li>• አንድ ወይም ብዙ ቁጥሮችን ይምረጡ</li>\n                    <li>• የክፍያ ደረሰኝ ይጫኑ</li>\n                    <li>• አድሚን እስኪያጽድቅ ይጠብቁ</li>\n                    <li>• አሸናፊው በዘፈቀደ ይመረጣል</li>\n                    <li>• ያልተጸደቀ ግቤት አይቆጠርም</li>\n                  </>\n                ) : (\n                  <>\n                    <li>• Choose one or multiple numbers</li>\n                    <li>• Upload payment receipt</li>\n                    <li>• Wait for admin approval</li>\n                    <li>• Winner is selected randomly</li>\n                    <li>• Unapproved entries are not counted</li>\n                  </>\n                )}", "<>\n                  <li>• {t.chooseNumbersRule}</li>\n                  <li>• {t.uploadReceiptRule}</li>\n                  <li>• {t.waitApprovalRule}</li>\n                  <li>• {t.winnerRandomRule}</li>\n                  <li>• {t.unapprovedNotCountedRule}</li>\n                </>")
replace("app/(protected)/dashboard/page.tsx", "{lang === 'am' ? 'መውጣት ይፈልጋሉ?' : 'Are you sure you want to logout?'}", "{t.logoutConfirmTitle}")
replace("app/(protected)/dashboard/page.tsx", "{lang === 'am'\n                ? 'ከአካውንትዎ ይወጣሉ።'\n                : 'You will be signed out of your account.'}", "{t.userLogoutConfirmMessage}")
replace("app/(protected)/dashboard/page.tsx", "{lang === 'am' ? 'ይቅር' : 'Cancel'}", "{t.cancel}")
replace("app/(protected)/dashboard/page.tsx", "{lang === 'am' ? 'ውጣ' : 'Logout'}", "{t.logout}")

# Admin page: remove local txt object by using centralized translations.
s=Path("app/(protected)/admin/page.tsx").read_text(encoding='utf-8')
s=s.replace("const { lang, setLang } = useLang();", "const { t: txt, lang, setLang } = useLang();")
start=s.find("  const txt = {\n    en: {")
if start!=-1:
    end=s.find("\n\n\n  const getSubmissionNumbers", start)
    if end!=-1:
        s=s[:start]+""+s[end+3:]
s=s.replace("txt.clearTitle", "txt.clearAllSubmissionsTitle").replace("txt.clearMsg", "txt.clearAllSubmissionsMessage").replace("txt.yesClear", "txt.yesClearAll").replace("txt.logoutTitle", "txt.logoutConfirmTitle").replace("txt.logoutMsg", "txt.adminLogoutConfirmMessage").replace("txt.noWinners", "txt.noPreviousWinners").replace("txt.quantity", "txt.qty").replace("txt.ticketPrice", "txt.ticket")
s=s.replace("toast.error(err.message || 'Failed to load winners');", "toast.error(err.message || txt.failedToLoadWinners);")
s=s.replace("{lang === 'en' ? 'አማርኛ' : 'English'}", "{lang === 'en' ? txt.switchToAmharic : txt.switchToEnglish}")
Path("app/(protected)/admin/page.tsx").write_text(s, encoding='utf-8')

PY

echo "Checking for mixed Arabic reject strings..."
if grep -R "رفض\|ترفض" -n lib app components --exclude='*.bak*'; then
  echo "Error: mixed Arabic reject text still exists."
  exit 1
fi

echo "Done. Backups saved in: $BACKUP_DIR"
echo "Now run: npm run build"
