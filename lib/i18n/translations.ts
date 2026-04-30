export const translations = {
  en: {
    login: 'Login', register: 'Register', phone: 'Phone Number', password: 'Password', name: 'Full Name', email: 'Email', dashboard: 'Dashboard', logout: 'Logout', available: 'Available', pending: 'Pending', taken: 'Taken', submit: 'Submit', cancel: 'Cancel', uploadReceipt: 'Upload Receipt', pickNumber: 'Pick a Number', myPurchases: 'My Purchases', adminPanel: 'Admin Panel', approve: 'Approve', reject: 'Reject', clearAll: 'Clear & Start New Round', pickWinner: 'Pick Random Winner', timeLeft: 'Time left', warning: 'Less than 1 minute remaining', price: 'Ticket Price', save: 'Save'
  },
  am: {
    login: 'ግባ', register: 'መዝግብ', phone: 'ስልክ ቁጥር', password: 'የይለፍ ቃል', name: 'ሙሉ ስም', email: 'ኢሜይል', dashboard: 'ዳሽቦርድ', logout: 'ውጣ', available: 'ክፍት', pending: 'በመጠባበቅ ላይ', taken: 'ተይዟል', submit: 'አስገባ', cancel: 'ሰርዝ', uploadReceipt: 'ደረሰኝ አስገባ', pickNumber: 'ቁጥር ምረጥ', myPurchases: 'የእኔ ግዢዎች', adminPanel: 'የአስተዳዳሪ ፓነል', approve: 'አጽድቅ', reject: 'ውድቅ አድርግ', clearAll: 'አጽዳና አዲስ ዙር ጀምር', pickWinner: 'አሸናፊ ምረጥ', timeLeft: 'የቀረ ጊዜ', warning: 'ከ1 ደቂቃ በታች ቀርቷል', price: 'የቲኬት ዋጋ', save: 'አስቀምጥ'
  }
} as const;
export type Lang = keyof typeof translations;
