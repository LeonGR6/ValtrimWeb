// WATERMARK_AUTHOR: Hecho por Gerardo Esparza
import { useEffect, useMemo, useState } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import './App.css';
import BottomNav from './components/layout/BottomNav.jsx';
import ProtectedRoute from './components/layout/ProtectedRoute.jsx';
import Sidebar from './components/layout/Sidebar.jsx';
import TopBar from './components/layout/TopBar.jsx';
import Button from './components/ui/Button.jsx';
import BrandLogo from './components/ui/BrandLogo.jsx';
import Card from './components/ui/Card.jsx';
import Icon from './components/ui/Icon.jsx';
import ThemeToggle from './components/ui/ThemeToggle.jsx';
import Login from './components/pages/Login.jsx';
import Register from './components/pages/Register.jsx';
import ModulePlaceholder from './features/platform/ModulePlaceholder.jsx';
import PlatformHome from './features/platform/PlatformHome.jsx';

import OrderComparisonPage from './features/platform/order-comparision/pages/OrderComparisonPage.jsx';
import PODetailPage from './features/platform/order-comparision/pages/PODetailPage.jsx';

import { useAuth } from './contexts/AuthContext.jsx';

// App root: defines the application shell, routes, and cross-module UI wiring.
const THEME_STORAGE_KEY = 'valtrim-ui-theme';
const DEFAULT_THEME = 'dark';

function getNavItems(t, isAdmin) {
  const items = [
    { id: 'dashboard', to: '/dashboard', label: t('navigation.dashboard'), shortLabel: t('navigation.home'), icon: 'home' },
    {
      id: 'order-comparison',
      to: '/order-comparison',
      label: t('navigation.orderComparison'),
      shortLabel: t('navigation.compare'),
      icon: 'results',
    },
    // {
    //   id: 'material-extraction',
    //   to: '/material-extraction',
    //   label: t('navigation.materialExtraction'),
    //   shortLabel: t('navigation.materials'),
    //   icon: 'layers',
    // },
    // { id: 'takeoff', to: '/takeoff', label: t('navigation.takeoff'), shortLabel: t('navigation.takeoff'), icon: 'workspace' },
  ];

  if (isAdmin) {
    items.push({
      id: 'user-admin',
      to: '/admin/users',
      label: t('navigation.userAdministration'),
      shortLabel: t('navigation.admin'),
      icon: 'team',
    });
  }

  return items;
}

function getInitialTheme() {
  if (typeof window === 'undefined') {
    return DEFAULT_THEME;
  }

  const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme;
  }

  return window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : DEFAULT_THEME;
}

function getRouteMeta(pathname, t) {
  const routeMeta = {
    '/dashboard': {
      eyebrow: t('routes.dashboard.eyebrow'),
      title: t('routes.dashboard.title'),
      description: t('routes.dashboard.description'),
    },
    '/takeoff': {
      eyebrow: t('routes.takeoff.eyebrow'),
      title: t('routes.takeoff.title'),
      description: t('routes.takeoff.description'),
    },
    '/material-extraction': {
      eyebrow: t('routes.materials.eyebrow'),
      title: t('routes.materials.title'),
      description: t('routes.materials.description'),
    },
    '/order-comparison': {
      eyebrow: t('routes.orderComparison.eyebrow'),
      title: t('routes.orderComparison.title'),
      description: t('routes.orderComparison.description'),
    },
    '/profile': {
      eyebrow: t('routes.profile.eyebrow'),
      title: t('routes.profile.title'),
      description: t('routes.profile.description'),
    },
    '/admin/users': {
      eyebrow: t('routes.userAdmin.eyebrow'),
      title: t('routes.userAdmin.title'),
      description: t('routes.userAdmin.description'),
    },
  };

  if (pathname.startsWith('/takeoff')) {
    return routeMeta['/takeoff'];
  }

  if (pathname.startsWith('/order-comparison')) {
    return routeMeta['/order-comparison'];
  }

  return routeMeta[pathname] || routeMeta['/dashboard'];
}

export default function App() {
  const location = useLocation();
  const { t, i18n } = useTranslation();
  const [theme, setTheme] = useState(getInitialTheme);
  const { isAuthenticated, user } = useAuth();
  const isAdmin = Array.isArray(user?.roles) && user.roles.includes('admin');
  const navItems = useMemo(() => getNavItems(t, isAdmin), [isAdmin, t]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);

    const themeColorMeta = document.querySelector('meta[name="theme-color"]');
    if (themeColorMeta) {
      themeColorMeta.setAttribute('content', theme === 'dark' ? '#08101d' : '#f4efe7');
    }
  }, [theme]);

  const routeMeta = getRouteMeta(location.pathname, t);

  // Show auth pages without shell
  const isAuthPage =
    location.pathname === '/login' ||
    location.pathname === '/register';

  if (isAuthPage) {
    if (isAuthenticated) {
      return <Navigate to="/dashboard" replace />;
    }

    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <div className="shell">
      <Sidebar navItems={navItems} brand={<BrandPanel />}>
        <Card className="control-panel" surface="subtle" density="compact">
          <p className="eyebrow">{t('common.theme')}</p>
          <ThemeToggle theme={theme} onChange={setTheme} />
        </Card>
      </Sidebar>

      <div className="shell-main">
        <TopBar
          breadcrumbItems={[]}
          title={routeMeta.title}
          actions={
            <>
              {/* <div className="segmented-control language-switch" role="group" aria-label={t('common.language')}>
                <Button
                  appearance="segment"
                  size="sm"
                  active={i18n.resolvedLanguage === 'es'}
                  onClick={() => i18n.changeLanguage('es')}
                >
                  ES
                </Button>
                <Button
                  appearance="segment"
                  size="sm"
                  active={i18n.resolvedLanguage === 'en'}
                  onClick={() => i18n.changeLanguage('en')}
                >
                  EN
                </Button>
              </div> */}
              <Button
                className="theme-switch-button"
                appearance="ghost"
                tone="accent"
                aria-label={theme === 'dark' ? t('common.switchToLight') : t('common.switchToDark')}
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              >
                <Icon name={theme === 'dark' ? 'sun' : 'moon'} className="button-icon" />
                <span className="theme-switch-label">{theme === 'dark' ? t('common.lightMode') : t('common.darkMode')}</span>
              </Button>
            </>
          }
        />

        <main className="shell-content">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <PlatformHome />
                </ProtectedRoute>
              }
            />
            <Route
              path="/takeoff"
              element={
                <ProtectedRoute>
                  <ModulePlaceholder
                    eyebrow={t('routes.takeoff.eyebrow')}
                    title={t('routes.takeoff.title')}
                    description={t('routes.takeoff.description')}
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/material-extraction"
              element={
                <ProtectedRoute>
                  <ModulePlaceholder
                    eyebrow={t('routes.materials.eyebrow')}
                    title={t('routes.materials.title')}
                    description={t('routes.materials.description')}
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/order-comparison"
              element={
                <ProtectedRoute>
                  {/* <ModulePlaceholder
                    eyebrow={t('routes.orderComparison.eyebrow')}
                    title={t('routes.orderComparison.title')}
                    description={t('routes.orderComparison.description')}
                  /> */}
                  <OrderComparisonPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/order-comparison/:poId"
              element={
                <ProtectedRoute>
                  <PODetailPage />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <ModulePlaceholder
                    eyebrow={t('routes.profile.eyebrow')}
                    title={t('routes.profile.title')}
                    description={t('routes.profile.description')}
                  />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute requiredRoles={['admin']}>
                  <ModulePlaceholder
                    eyebrow={t('routes.userAdmin.eyebrow')}
                    title={t('routes.userAdmin.title')}
                    description={t('routes.userAdmin.description')}
                  />
                </ProtectedRoute>
              }
            />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <BottomNav
          items={navItems.map((item) => ({
            id: item.id,
            to: item.to,
            label: item.shortLabel,
            icon: item.icon,
          }))}
        />
      </div>
    </div>
  );
}

function BrandPanel() {
  const { t } = useTranslation();

  return (
    <Card className="brand-panel" surface="elevated">
      <div className="brand-mark" aria-hidden="true">
        <BrandLogo />
      </div>
      <div>
        <p className="eyebrow">{t('brand.name')}</p>
        <h1>{t('brand.product')}</h1>
      </div>
    </Card>
  );
}
