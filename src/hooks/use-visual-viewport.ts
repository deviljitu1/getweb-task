import { useEffect, useState } from 'react';

// visualViewport also resizes for the on-screen keyboard in mobile browsers.
export function useVisualViewport() {
  const read = () => ({ height: window.visualViewport?.height ?? window.innerHeight, top: window.visualViewport?.offsetTop ?? 0 });
  const [viewport, setViewport] = useState(read);
  useEffect(() => {
    const update = () => setViewport(read());
    const visual = window.visualViewport;
    visual?.addEventListener('resize', update);
    visual?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      visual?.removeEventListener('resize', update);
      visual?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  return viewport;
}
