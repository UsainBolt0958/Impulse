import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, BookOpen, ClipboardList, BarChart3, Bookmark, Calendar, FileText } from 'lucide-react';
import ColoredIcon from './ColoredIcon';

function Sidebar() {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/pyq-practice', icon: BookOpen, label: 'PYQ Practice' },
    { path: '/previous-papers', icon: FileText, label: 'Previous Papers' },
    { path: '/test-series', icon: ClipboardList, label: 'Test Series' },
    { path: '/analysis', icon: BarChart3, label: 'Analysis' },
    { path: '/notebook', icon: Bookmark, label: 'Notebook' },
    { path: '/calendar', icon: Calendar, label: 'Calendar' }
  ];

  const isActive = (path) => {
    if (path === '/pyq-practice' && location.pathname === '/practice') return true;
    if (path === '/test-series' && location.pathname === '/tests') return true;
    if (path === '/') return location.pathname === '/';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

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
    <aside className="h-full border-r border-border bg-sidebar-background transition-all duration-[var(--sidebar-transition-duration)] w-[var(--sidebar-width-mobile)] md:w-[var(--sidebar-width)] flex flex-col items-center py-4 z-40 shrink-0">
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
  );
}

export default Sidebar;
