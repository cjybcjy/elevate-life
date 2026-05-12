import { useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const slides = [
  '/net-worth',
  '/asset-allocation',
  '/debt-overview',
  '/scissor-chart',
  '/forecast',
];

export function useKeyboardNavigation() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      const currentIndex = slides.indexOf(location.pathname);

      if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
        const nextIndex = (currentIndex + 1) % slides.length;
        navigate(slides[nextIndex]);
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
        const prevIndex = (currentIndex - 1 + slides.length) % slides.length;
        navigate(slides[prevIndex]);
      }
    },
    [navigate, location.pathname]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
}
