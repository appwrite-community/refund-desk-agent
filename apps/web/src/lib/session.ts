import type { QueryClient } from '@tanstack/react-query';
import { account, realtime } from './appwrite';
import { fetchViewer, viewerQuery } from './queries';

export async function signIn(queryClient: QueryClient, email: string, password: string) {
  await account.createEmailPasswordSession({ email, password });
  const viewer = await fetchViewer();
  queryClient.setQueryData(viewerQuery.queryKey, viewer);
  return viewer;
}

export async function signOut(queryClient: QueryClient) {
  await account.deleteSession({ sessionId: 'current' });
  // The Realtime socket authenticated as this user. Close it before someone else signs in.
  await realtime.disconnect();
  queryClient.clear();
}

/** Where a user lands after signing in: staff on the desk, customers on their orders. */
export const homeFor = (isStaff: boolean) => (isStaff ? '/desk' : '/orders');
