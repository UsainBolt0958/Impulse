import { useLocation } from 'react-router-dom';
import { useLayoutEffect } from 'react';

const ScrollToTop = () => {
    const { pathname } = useLocation();

    useLayoutEffect(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
        const scrollContainer = document.querySelector('.main-content');
        if (scrollContainer) {
            scrollContainer.scrollTop = 0;
        }
    }, [pathname]);

    return null;
}

export default ScrollToTop;