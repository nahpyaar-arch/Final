// src/components/Layout.tsx
import { useEffect, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  Home,
  TrendingUp,
  BarChart3,
  Wallet,
  User,
  MessageCircle,
  Globe,
  Menu,
  X,
  Shield,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';

declare global {
  interface Window {
    $crisp?: any[];
    CRISP_WEBSITE_ID?: string;
  }
}

const LANGUAGES = [
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'es', name: 'Español', flag: '🇪🇸' },
  { code: 'fr', name: 'Français', flag: '🇫🇷' },
  { code: 'de', name: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', name: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', name: 'Português', flag: '🇵🇹' },
  { code: 'ru', name: 'Русский', flag: '🇷🇺' },
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
  { code: 'zh', name: '中文', flag: '🇨🇳' },
];

export default function Layout() {
  const { user, language, setLanguage, t } = useApp();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLanguageOpen, setIsLanguageOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false); // fallback modal

  // Build navigation with translated labels on every render (reactive to language)
  const navigation = [
    { key: 'home', name: t('nav.home'), href: '/', icon: Home },
    { key: 'market', name: t('nav.market'), href: '/market', icon: TrendingUp },
    { key: 'trade', name: t('nav.trade'), href: '/trade', icon: BarChart3 },
    { key: 'assets', name: t('nav.assets'), href: '/assets', icon: Wallet },
    { key: 'profile', name: t('nav.profile'), href: '/profile', icon: User },
  ] as Array<{ key: string; name: string; href: string; icon: any }>;

  if (user?.is_admin) {
    navigation.push({
      key: 'admin',
      name: t('nav.admin'),
      href: '/admin',
      icon: Shield,
    });
  }

  const currentLanguage =
    LANGUAGES.find((lang) => lang.code === language) || LANGUAGES[0];

  const isActive = (href: string) => {
    if (href === '/') return location.pathname === '/';
    return location.pathname.startsWith(href);
  };

  // --- CRISP: attach user info when available
  useEffect(() => {
    if (!window.$crisp) return;
    try {
      if (user?.name) window.$crisp.push(['set', 'user:nickname', user.name]);
      if (user?.email) window.$crisp.push(['set', 'user:email', user.email]);
      if (user?.id) window.$crisp.push(['set', 'session:data', [['user_id', String(user.id)]]]);
    } catch {
      // ignore
    }
  }, [user]);

  // Open Crisp chat or fallback to local modal
  const openChat = () => {
    if (window.$crisp) {
      try {
        window.$crisp.push(['do', 'chat:show']);
        window.$crisp.push(['do', 'chat:open']);
        return;
      } catch {
        // if something goes wrong, use fallback modal
      }
    }
    setIsChatOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link to="/" className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">N</span>
                </div>
                <span className="text-xl font-bold text-white">Nova</span>
              </Link>
            </div>

            {/* Desktop Navigation */}
            <nav className="hidden md:flex space-x-8">
              {navigation.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.key}
                    to={item.href}
                    className={`flex items-center space-x-1 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                      active
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:text-white hover:bg-gray-700'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Right side controls */}
            <div className="flex items-center space-x-4">
              {/* Live Chat (Crisp) */}
              <button
                onClick={openChat}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
                title="Live Chat"
              >
                <MessageCircle className="w-5 h-5" />
              </button>

              {/* Language Selector */}
              <div className="relative">
                <button
                  onClick={() => setIsLanguageOpen(!isLanguageOpen)}
                  className="flex items-center space-x-1 p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
                >
                  <Globe className="w-5 h-5" />
                  <span className="text-sm">{currentLanguage.flag}</span>
                </button>

                {isLanguageOpen && (
                  <div className="absolute right-0 mt-2 w-48 bg-gray-800 rounded-md shadow-lg border border-gray-700 z-50">
                    <div className="py-1">
                      {LANGUAGES.map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => {
                            setLanguage(lang.code);
                            setIsLanguageOpen(false);
                          }}
                          className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-700 flex items-center space-x-2 ${
                            language === lang.code
                              ? 'bg-gray-700 text-white'
                              : 'text-gray-300'
                          }`}
                        >
                          <span>{lang.flag}</span>
                          <span>{lang.name}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Mobile menu button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-md"
              >
                {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-gray-800 border-t border-gray-700">
            <div className="px-2 pt-2 pb-3 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.key}
                    to={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-md text-base font-medium ${
                      active
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:text-white hover:bg-gray-700'
                    }`}
                  >
                    <Icon className="w-5 h-5" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </header>

      {/* Live Chat Modal (fallback if Crisp hasn't loaded) */}
      {isChatOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg w-full max-w-md h-96 flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold text-white">Live Chat</h3>
              <button onClick={() => setIsChatOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 p-4 overflow-y-auto">
              <div className="space-y-4">
                <div className="bg-gray-700 p-3 rounded-lg">
                  <p className="text-sm text-gray-300">
                    Chat is loading… If the widget doesn’t appear, please try again later.
                  </p>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-gray-700">
              <div className="flex space-x-2">
                <input
                  type="text"
                  placeholder="Type your message..."
                  className="flex-1 bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md transition-colors">
                  Send
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content (extra bottom padding for mobile tab bar) */}
      <main className="flex-1 pb-24 md:pb-0">
        <Outlet />
      </main>

      {/* Bottom Tab Bar – mobile only */}
      <nav className="fixed bottom-0 inset-x-0 z-40 md:hidden">
        <div className="relative bg-gray-900/95 backdrop-blur border-t border-gray-800 h-16">
          <div className="grid grid-cols-5 h-full px-2">
            {/* Home */}
            <Link
              to="/"
              className={`flex flex-col items-center justify-center text-xs font-medium ${
                isActive('/') ? 'text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Home className="w-5 h-5 mb-1" />
              <span>{t('nav.home')}</span>
            </Link>

            {/* Market */}
            <Link
              to="/market"
              className={`flex flex-col items-center justify-center text-xs font-medium ${
                isActive('/market') ? 'text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <TrendingUp className="w-5 h-5 mb-1" />
              <span>{t('nav.market')}</span>
            </Link>

            {/* Center label (under floating Trade button) */}
            <div className="flex items-end justify-center pb-1">
              <span className="text-[10px] text-gray-400">{t('nav.trade')}</span>
            </div>

            {/* Assets */}
            <Link
              to="/assets"
              className={`flex flex-col items-center justify-center text-xs font-medium ${
                isActive('/assets') ? 'text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Wallet className="w-5 h-5 mb-1" />
              <span>{t('nav.assets')}</span>
            </Link>

            {/* Profile */}
            <Link
              to="/profile"
              className={`flex flex-col items-center justify-center text-xs font-medium ${
                isActive('/profile') ? 'text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              <User className="w-5 h-5 mb-1" />
              <span>{t('nav.profile')}</span>
            </Link>
          </div>

          {/* Floating Trade button */}
          <Link to="/trade" className="absolute -top-6 left-1/2 -translate-x-1/2">
            <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center shadow-xl ring-4 ring-gray-900">
              <BarChart3 className="w-6 h-6 text-white" />
            </div>
          </Link>
        </div>
        {/* iOS safe-area padding */}
        <div className="h-[env(safe-area-inset-bottom,0px)] bg-gray-900" />
      </nav>
    </div>
  );
}
