import { useEffect, useState } from 'react';

export const FREE_ACCESS_END = new Date('2027-01-02T00:00:00+05:30');
export const FREE_ACCESS_END_LABEL = 'January 1, 2027';

export function isFreeAccessActive(now = new Date()) {
  return now < FREE_ACCESS_END;
}

export function useFreeAccessActive() {
  const [active, setActive] = useState(isFreeAccessActive);

  useEffect(() => {
    let timeoutId;
    const updateStatus = () => {
      const activeNow = isFreeAccessActive();
      setActive(activeNow);
      if (activeNow) {
        timeoutId = setTimeout(
          updateStatus,
          Math.min(FREE_ACCESS_END.getTime() - Date.now(), 2_147_000_000)
        );
      }
    };

    updateStatus();
    return () => clearTimeout(timeoutId);
  }, []);

  return active;
}
