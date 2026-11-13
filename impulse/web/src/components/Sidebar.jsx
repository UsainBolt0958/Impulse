import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, BookOpen, ClipboardList, BarChart3, Bookmark, Calendar, FileText, FilePlus2, UsersRound, Crown, Menu } from 'lucide-react';
import ColoredIcon from './ColoredIcon';

function Sidebar() {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = React.useState(false);

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/pyq-practice', icon: BookOpen, label: 'PYQ Practice' },
    { path: '/previous-papers', icon: FileText, label: 'Previous Papers' },
    { path: '/test-series', icon: ClipboardList, label: 'Test Series' },
    { path: '/custom-test', icon: FilePlus2, label: 'Custom Test' },
    { path: '/analysis', icon: BarChart3, label: 'Analysis' },
    { path: '/friends', icon: UsersRound, label: 'Friends' },
    { path: '/premium', icon: Crown, label: 'Premium' },
    { path: '/notebook', icon: Bookmark, label: 'Notebook' },
    { path: '/calendar', icon: Calendar, label: 'Calendar' }
  ];

  const isActive = (path) => {
    if (path === '/pyq-practice' && location.pathname === '/practice') return true;
    if (path === '/test-series' && location.pathname === '/tests') return true;
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  React.useEffect(() => {
    setMoreOpen(false);
  }, [location.pathname]);

  React.useEffect(() => {
    if (!moreOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === 'Escape') setMoreOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [moreOpen]);

  const [isDark, setIsDark] = React.useState(() => {
    try {
      return document?.documentElement?.classList?.contains('dark');
    } catch (e) {
      return false;
    }
  });

  React.useEffect(() => {
    if (typeof document === 'undefined') return;
    const el = document.documentElement;
    const obs = new MutationObserver(() => setIsDark(el.classList.contains('dark')));
    obs.observe(el, { attributes: true, attributeFilter: ['class'] });
    return () => obs.disconnect();
  }, []);

  return (
    <aside className="app-sidebar h-full border-r border-border bg-sidebar-background transition-all duration-[var(--sidebar-transition-duration)] w-[var(--sidebar-width-mobile)] md:w-[var(--sidebar-width)] flex flex-col items-center py-4 z-40 shrink-0">
      <Link to="/" className="app-sidebar-brand w-full px-2 md:px-3 mt-1 mb-6 flex items-center justify-center">
        <img
          src={isDark ? '/logo.png' : '/logo2.png'}
          alt="Impulse logo"
          className="h-[40px] w-[40px] md:h-[52px] md:w-[52px] object-contain"
        />
      </Link>

      <nav className="app-sidebar-nav flex-1 w-full px-2 md:px-3 flex flex-col gap-3 overflow-y-auto hide-scrollbar pt-1" aria-label="Main navigation">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`app-sidebar-link flex flex-col items-center justify-center gap-1.5 w-full aspect-square rounded-2xl transition-all duration-300 ${
                active
                  ? 'bg-foreground text-background shadow-lg scale-[0.98]'
                  : 'bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground hover:scale-95'
              }`}
              title={item.label}
            >
              <ColoredIcon icon={Icon} name={item.label} size={5} />
              <span className={`app-sidebar-label hidden md:block text-[10px] font-black uppercase tracking-widest text-center px-1 leading-tight ${active ? 'text-background' : ''}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
        <button
          type="button"
          className={`app-sidebar-more flex flex-col items-center justify-center gap-1.5 w-full rounded-2xl transition-colors ${
            moreOpen || navItems.slice(4).some((item) => isActive(item.path))
              ? 'bg-foreground text-background shadow-lg'
              : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
          }`}
          aria-expanded={moreOpen}
          aria-controls="app-sidebar-more-menu"
          aria-label={moreOpen ? 'Close more navigation' : 'More navigation'}
          onClick={() => setMoreOpen((open) => !open)}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
          <span className="app-sidebar-more-label">More</span>
        </button>
      </nav>
      {moreOpen && (
        <nav id="app-sidebar-more-menu" className="app-sidebar-more-menu" aria-label="More navigation">
          {navItems.slice(4).map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`app-sidebar-more-link ${active ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'}`}
                aria-current={active ? 'page' : undefined}
                onClick={() => setMoreOpen(false)}
              >
                <ColoredIcon icon={Icon} name={item.label} size={4} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      )}
    </aside>
  );
}

export default Sidebar;
