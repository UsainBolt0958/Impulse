import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, BookOpen, ClipboardList, BarChart3, Bookmark, Calendar, FileText, FilePlus2, UsersRound, Crown, MoreHorizontal } from 'lucide-react';
import ColoredIcon from './ColoredIcon';

function Sidebar() {
  const location = useLocation();
  const [isMoreOpen, setIsMoreOpen] = React.useState(false);

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
    setIsMoreOpen(false);
  }, [location.pathname]);

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
    <>
    <aside className="hidden h-full border-r border-border bg-sidebar-background transition-all duration-[var(--sidebar-transition-duration)] w-[var(--sidebar-width-mobile)] lg:w-[var(--sidebar-width)] lg:flex flex-col items-center py-4 z-40 shrink-0">
      <Link to="/" className="w-full px-2 md:px-3 mt-1 mb-6 flex items-center justify-center">
        <img
          src={isDark ? '/logo.png' : '/logo2.png'}
          alt="Impulse logo"
          className="h-[40px] w-[40px] md:h-[52px] md:w-[52px] object-contain"
        />
      </Link>

      <nav className="flex-1 w-full px-2 md:px-3 flex flex-col gap-3 overflow-y-auto hide-scrollbar pt-1">
        {navItems.map(item => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex flex-col items-center justify-center gap-1.5 w-full aspect-square rounded-2xl transition-all duration-300 ${
                active
                  ? 'bg-foreground text-background shadow-lg scale-[0.98]'
                  : 'bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground hover:scale-95'
              }`}
              title={item.label}
            >
              <ColoredIcon icon={Icon} name={item.label} size={5} />
              <span className={`hidden md:block text-[10px] font-black uppercase tracking-widest text-center px-1 leading-tight ${active ? 'text-background' : ''}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>
    </aside>
    <nav className="fixed inset-x-0 bottom-0 z-[60] border-t border-border bg-background/95 px-2 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(0,0,0,0.12)] backdrop-blur lg:hidden" aria-label="Primary navigation">
      {isMoreOpen && (
        <div className="absolute bottom-full right-2 mb-2 w-56 rounded-2xl border border-border bg-background p-2 shadow-xl">
          {navItems.slice(4).map((item) => {
            const Icon = item.icon;
            const active = isActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={() => setIsMoreOpen(false)}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-bold transition-colors ${
                  active ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                }`}
              >
                <ColoredIcon icon={Icon} name={item.label} size={4} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      )}
      <div className="grid grid-cols-5 gap-1">
        {navItems.slice(0, 4).map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          return (
            <Link
              key={item.path}
              to={item.path}
              aria-current={active ? 'page' : undefined}
              className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl py-1 text-[9px] font-semibold leading-none transition-colors ${
                active ? 'text-foreground' : 'text-muted-foreground'
              }`}
            >
              <ColoredIcon icon={Icon} name={item.label} size={4} />
              <span className="max-w-full truncate">{item.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          aria-expanded={isMoreOpen}
          aria-label={isMoreOpen ? 'Close more navigation' : 'More navigation'}
          onClick={() => setIsMoreOpen((open) => !open)}
          className={`flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl py-1 text-[9px] font-semibold leading-none transition-colors ${
            isMoreOpen || navItems.slice(4).some((item) => isActive(item.path))
              ? 'text-foreground'
              : 'text-muted-foreground'
          }`}
        >
          <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
          <span>More</span>
        </button>
      </div>
    </nav>
    </>
  );
}

export default Sidebar;
