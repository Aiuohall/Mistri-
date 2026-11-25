import { getLocales } from 'expo-localization';
import { I18n } from 'i18n-js';
export const english = {
  'app.name': 'Mistri',
  'common.retry': 'Try again',
  'home.tagline': 'Roadside assistance, when you need it.',
  'language.switchToBangla': 'বাংলায় দেখুন',
  'language.switchToEnglish': 'View in English',
  'account.signin_is_not_available_yet_please_try':
    'Sign-in is not available yet. Please try again after the app is configured.',
  'account.restoring_session': 'Restoring session…',
  'account.welcome': 'Welcome',
  'account.email': 'Email',
  'account.password': 'Password',
  'account.signin_failed_check_your_details_and_connection':
    'Sign-in failed. Check your details and connection.',
  'account.check_your_email_to_confirm_your_account': 'Check your email to confirm your account.',
  'account.sign_in': 'Sign in',
  'account.create_account': 'Create account',
  'account.sign_out': 'Sign out',
  'account.please_try_again': 'Please try again.',
  'account.checking_account': 'Checking account…',
  'account.this_app_currently_supports_customer_accounts':
    'This app currently supports customer accounts.',
  'account.unable_to_load_your_account': 'Unable to load your account.',
  'account.try_again': 'Try again',
  'customer.my_requests': 'My requests',
  'customer.add_vehicle': 'Add vehicle',
  'customer.request_help': 'Request help',
  'customer.loading': 'Loading…',
  'customer.unable_to_save_or_load_check_your':
    'Unable to save or load. Check your connection and refresh before trying again.',
  'customer.refresh': 'Refresh',
  'customer.your_vehicles': 'Your vehicles',
  'customer.add_your_first_vehicle_to_request_help': 'Add your first vehicle to request help.',
  'customer.vehicle_name': 'Vehicle name',
  'customer.save_vehicle': 'Save vehicle',
  'customer.where_do_you_need_help': 'Where do you need help?',
  'customer.add_a_vehicle_first': 'Add a vehicle first.',
  'customer.service_needed': 'Service needed',
  'customer.describe_the_problem': 'Describe the problem',
  'customer.use_my_current_location': 'Use my current location',
  'customer.location_unavailable_enable_location_permission_and_try':
    'Location unavailable. Enable location permission and try again.',
  'customer.pickup_coordinates': 'Pickup coordinates',
  'customer.review_your_location_before_sending_exact_pickup':
    'Review your location before sending. Exact pickup is shared with your assigned mechanic.',
  'customer.send_request': 'Send request',
  'customer.no_requests_yet': 'No requests yet.',
  'customer.view_details': 'View details',
  'customer.cancel_request': 'Cancel request',
  'customer.confirm_cash_paid': 'Confirm cash paid',
  'customer.confirm_this_action': 'Confirm this action?',
  'customer.confirm': 'Confirm',
  'customer.go_back': 'Go back',
  'vehicleType.car': 'car',
  'vehicleType.motorcycle': 'motorcycle',
  'vehicleType.cng': 'cng',
  'vehicleType.truck': 'truck',
  'vehicleType.other': 'other',
  'status.open': 'open',
  'status.assigned': 'assigned',
  'status.en_route': 'en route',
  'status.arrived': 'arrived',
  'status.in_progress': 'in progress',
  'status.completed': 'completed',
  'status.paid': 'paid',
  'status.cancelled': 'cancelled',
} as const;
export type TranslationKey = keyof typeof english;
export const bangla: Partial<Record<TranslationKey, string>> = {
  'app.name': 'মিস্ত্রি',
  'home.tagline': 'প্রয়োজনে সড়ক সহায়তা, আপনার পাশে।',
  'language.switchToBangla': 'বাংলায় দেখুন',
  'language.switchToEnglish': 'ইংরেজিতে দেখুন',
  'account.signin_is_not_available_yet_please_try':
    'সাইন ইন এখনও চালু হয়নি। অ্যাপ প্রস্তুত হলে আবার চেষ্টা করুন।',
  'account.restoring_session': 'সেশন লোড হচ্ছে…',
  'account.welcome': 'স্বাগতম',
  'account.email': 'ইমেইল',
  'account.password': 'পাসওয়ার্ড',
  'account.signin_failed_check_your_details_and_connection':
    'সাইন ইন হয়নি। তথ্য ও সংযোগ পরীক্ষা করুন।',
  'account.check_your_email_to_confirm_your_account': 'অ্যাকাউন্ট নিশ্চিত করতে ইমেইল দেখুন।',
  'account.sign_in': 'সাইন ইন',
  'account.create_account': 'অ্যাকাউন্ট তৈরি',
  'account.sign_out': 'সাইন আউট',
  'account.please_try_again': 'আবার চেষ্টা করুন।',
  'account.checking_account': 'অ্যাকাউন্ট যাচাই হচ্ছে…',
  'account.this_app_currently_supports_customer_accounts':
    'এই অ্যাপে বর্তমানে গ্রাহক অ্যাকাউন্ট ব্যবহার করা যায়।',
  'account.unable_to_load_your_account': 'অ্যাকাউন্ট লোড হয়নি।',
  'account.try_again': 'আবার চেষ্টা',
  'customer.my_requests': 'আমার অনুরোধ',
  'customer.add_vehicle': 'যানবাহন যোগ করুন',
  'customer.request_help': 'সহায়তা চাই',
  'customer.loading': 'লোড হচ্ছে…',
  'customer.unable_to_save_or_load_check_your':
    'সংরক্ষণ বা লোড করা যায়নি। সংযোগ পরীক্ষা করে রিফ্রেশ করুন।',
  'customer.refresh': 'রিফ্রেশ',
  'customer.your_vehicles': 'আপনার যানবাহন',
  'customer.add_your_first_vehicle_to_request_help': 'সহায়তা পেতে প্রথম যানবাহন যোগ করুন।',
  'customer.vehicle_name': 'যানবাহনের নাম',
  'customer.save_vehicle': 'যানবাহন সংরক্ষণ',
  'customer.where_do_you_need_help': 'কোথায় সহায়তা প্রয়োজন?',
  'customer.add_a_vehicle_first': 'প্রথমে যানবাহন যোগ করুন।',
  'customer.service_needed': 'কী সেবা প্রয়োজন',
  'customer.describe_the_problem': 'সমস্যার বিবরণ',
  'customer.use_my_current_location': 'আমার বর্তমান অবস্থান',
  'customer.location_unavailable_enable_location_permission_and_try':
    'অবস্থান পাওয়া যায়নি। অবস্থানের অনুমতি দিয়ে আবার চেষ্টা করুন।',
  'customer.pickup_coordinates': 'সহায়তার স্থান',
  'customer.review_your_location_before_sending_exact_pickup':
    'পাঠানোর আগে অবস্থান যাচাই করুন। নিযুক্ত মিস্ত্রি সঠিক অবস্থান দেখতে পাবেন।',
  'customer.send_request': 'অনুরোধ পাঠান',
  'customer.no_requests_yet': 'এখনও কোনো অনুরোধ নেই।',
  'customer.view_details': 'বিস্তারিত',
  'customer.cancel_request': 'অনুরোধ বাতিল',
  'customer.confirm_cash_paid': 'নগদ পরিশোধ নিশ্চিত করুন',
  'customer.confirm_this_action': 'এই কাজটি নিশ্চিত করবেন?',
  'customer.confirm': 'নিশ্চিত করুন',
  'customer.go_back': 'ফিরে যান',
  'vehicleType.car': 'গাড়ি',
  'vehicleType.motorcycle': 'মোটরসাইকেল',
  'vehicleType.cng': 'সিএনজি',
  'vehicleType.truck': 'ট্রাক',
  'vehicleType.other': 'অন্যান্য',
  'status.open': 'অপেক্ষমান',
  'status.assigned': 'মিস্ত্রি নিযুক্ত',
  'status.en_route': 'পথে আছেন',
  'status.arrived': 'পৌঁছেছেন',
  'status.in_progress': 'কাজ চলছে',
  'status.completed': 'কাজ সম্পন্ন',
  'status.paid': 'পরিশোধিত',
  'status.cancelled': 'বাতিল',
};
export type AppLanguage = 'en' | 'bn';
function nest(messages: Partial<Record<TranslationKey, string>>) {
  const result: Record<string, Record<string, string>> = {};
  for (const [key, value] of Object.entries(messages)) {
    const [section, name] = key.split('.');
    (result[section] ??= {})[name] = value;
  }
  return result;
}
const i18n = new I18n(
  { en: nest(english), bn: nest(bangla) },
  { defaultLocale: 'en', enableFallback: true },
);
export function getLanguageFromCode(languageCode: string | null | undefined): AppLanguage {
  return languageCode === 'bn' ? 'bn' : 'en';
}
export function getDeviceLanguage(): AppLanguage {
  return getLanguageFromCode(getLocales()[0]?.languageCode);
}
export function translate(language: AppLanguage, key: TranslationKey): string {
  return String(i18n.t(key, { locale: language }));
}
