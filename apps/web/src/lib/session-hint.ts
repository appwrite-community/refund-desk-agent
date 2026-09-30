const KEY = 'pourhaven.signedIn';

/** Whether this browser signed in before. Saves a request that can only fail for signed-out visitors. */
export const hasSessionHint = () => localStorage.getItem(KEY) === '1';

export function setSessionHint(signedIn: boolean) {
  if (signedIn) localStorage.setItem(KEY, '1');
  else localStorage.removeItem(KEY);
}
