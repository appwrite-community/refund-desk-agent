import { useEffect } from 'react';

export function usePageTitle(title: string | undefined) {
  useEffect(() => {
    if (title) document.title = `${title} · Pourhaven`;
  }, [title]);
}
