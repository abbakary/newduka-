import { isNetworkFailure } from '@/lib/authBridge';

export function formatApiError(error: unknown, isSw = false): string {
  if (isNetworkFailure(error)) {
    return isSw
      ? 'Hakuna mtandao au seva haipatikani. Angalia muunganisho wako wa intaneti.'
      : 'Network error — check your internet connection and try again.';
  }

  const msg = error instanceof Error ? error.message : String(error);
  const lower = msg.toLowerCase();

  if (lower.includes('invalid email or password')) {
    return isSw
      ? 'Barua pepe au nenosiri si sahihi. Jaribu tena.'
      : 'Invalid email or password.';
  }

  if (lower.includes('password must be at least 6') || lower.includes('string_too_short')) {
    return isSw
      ? 'Nenosiri lazima liwe na angalau herufi 6.'
      : 'Password must be at least 6 characters.';
  }

  if (lower.includes('invalid input value for enum') || lower.includes('saasplantier')) {
    return isSw
      ? 'Hitilafu ya mpango wa usajili kwenye seva. Jaribu tena baada ya dakika chache au wasiliana na msaada.'
      : 'Server plan configuration error during signup. Please retry shortly or contact support.';
  }

  if (lower.includes('email already registered')) {
    return isSw
      ? 'Barua pepe hii tayari imesajiliwa. Ingia badala yake.'
      : 'This email is already registered. Try signing in instead.';
  }

  if (lower.includes('cors') || lower.includes('failed to fetch')) {
    return isSw
      ? 'Imeshindikana kuunganisha na seva. Wasiliana na msimamizi wa mfumo.'
      : 'Could not reach the server. The app URL may need to be added to backend CORS settings.';
  }

  return msg || (isSw ? 'Ombi limeshindikana.' : 'Request failed.');
}
