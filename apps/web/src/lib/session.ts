import type { QueryClient } from '@tanstack/react-query';
import { account, realtime } from './appwrite';
import { fetchViewer, viewerQuery } from './queries';
import { setSessionHint } from './session-hint';

export async function signIn(queryClient: QueryClient, email: string, password: string) {
  await account.createEmailPasswordSession({ email, password });
  setSessionHint(true);
  const viewer = await fetchViewer();
  queryClient.setQueryData(viewerQuery.queryKey, viewer);
  return viewer;
}

export async function signOut(queryClient: QueryClient) {
  try {
    await account.deleteSession({ sessionId: 'current' });
  } finally {
    setSessionHint(false);
    // The Realtime socket authenticated as this user. Close it before someone else signs in.
    await realtime.disconnect();
    queryClient.clear();
  }
}

/** Where a user lands after signing in: staff on the desk, customers on their orders. */
export const homeFor = (isStaff: boolean) => (isStaff ? '/desk' : '/orders');
