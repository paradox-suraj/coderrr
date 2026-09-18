import { useState, useEffect } from 'react';
import { getDueReviews } from '@/lib/db';

export function useDueCount() {
  const [count, setCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let mounted = true;

    async function fetchDueCount() {
      try {
        setIsLoading(true);
        const dueReviews = await getDueReviews();
        if (mounted) {
          setCount(dueReviews.length);
        }
      } catch (error) {
        console.error('Failed to fetch due count:', error);
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    fetchDueCount();

    const handleFocus = () => {
      fetchDueCount();
    };

    window.addEventListener('focus', handleFocus);
    return () => {
      mounted = false;
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  return { count, isLoading };
}
