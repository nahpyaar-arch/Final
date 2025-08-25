// src/contexts/AppContext.tsx
import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
  useRef,
} from 'react';

import {
  NeonDB,                 // still used for some writes / coin helpers
  initializeDatabase,     // no-op on client stub
  type Profile,
  type Coin,
  type Transaction,
  pingDB,                  // client stub returns { ok:false }
} from '../lib/neon';

// Supabase helpers
import { supabase, getProfileByEmail, createProfile } from '../lib/supabase';

/* ──────────────────────────────────────────────────────────────────────────
   Translations
   ────────────────────────────────────────────────────────────────────────── */
const TR: Record<string, Record<string, string>> = {
  en: {
    'nav.home': 'Home',
    'nav.market': 'Market',
    'nav.trade': 'Trade',
    'nav.assets': 'Assets',
    'nav.profile': 'Profile',
    'nav.admin': 'Admin',
    'profile.title': 'Profile Settings',
    'profile.accountInfo': 'Account Information',
    'profile.fullName': 'Full Name',
    'profile.email': 'Email Address',
    'profile.accountType': 'Account Type',
    'profile.admin': 'Administrator',
    'profile.standard': 'Standard User',
    'profile.languageRegion': 'Language & Region',
    'profile.preferredLanguage': 'Preferred Language',
    'profile.signOut': 'Sign Out',
    'admin.accessDenied.title': 'Access Denied',
    'admin.accessDenied.text':
      'You need administrator privileges to access this page.',
    'admin.accessDenied.recheck': 'Recheck Admin Status',
  },
  es: {
    'nav.home': 'Inicio',
    'nav.market': 'Mercado',
    'nav.trade': 'Operar',
    'nav.assets': 'Activos',
    'nav.profile': 'Perfil',
    'nav.admin': 'Admin',
    'profile.title': 'Configuración de Perfil',
    'profile.accountInfo': 'Información de la cuenta',
    'profile.fullName': 'Nombre completo',
    'profile.email': 'Correo electrónico',
    'profile.accountType': 'Tipo de cuenta',
    'profile.admin': 'Administrador',
    'profile.standard': 'Usuario estándar',
    'profile.languageRegion': 'Idioma y región',
    'profile.preferredLanguage': 'Idioma preferido',
    'profile.signOut': 'Cerrar sesión',
    'admin.accessDenied.title': 'Acceso denegado',
    'admin.accessDenied.text':
      'Necesitas privilegios de administrador para acceder.',
    'admin.accessDenied.recheck': 'Volver a comprobar',
  },
  fr: {
    'nav.home': 'Accueil',
    'nav.market': 'Marché',
    'nav.trade': 'Échanger',
    'nav.assets': 'Actifs',
    'nav.profile': 'Profil',
    'nav.admin': 'Admin',
    'profile.title': 'Paramètres du profil',
    'profile.accountInfo': 'Informations du compte',
    'profile.fullName': 'Nom complet',
    'profile.email': 'Adresse e-mail',
    'profile.accountType': 'Type de compte',
    'profile.admin': 'Administrateur',
    'profile.standard': 'Utilisateur standard',
    'profile.languageRegion': 'Langue et région',
    'profile.preferredLanguage': 'Langue préférée',
    'profile.signOut': 'Se déconnecter',
    'admin.accessDenied.title': 'Accès refusé',
    'admin.accessDenied.text':
      "Vous avez besoin des privilèges d'administrateur.",
    'admin.accessDenied.recheck': 'Revérifier',
  },
  de: {
    'nav.home': 'Start',
    'nav.market': 'Markt',
    'nav.trade': 'Handel',
    'nav.assets': 'Vermögen',
    'nav.profile': 'Profil',
    'nav.admin': 'Admin',
    'profile.title': 'Profileinstellungen',
    'profile.accountInfo': 'Kontoinformationen',
    'profile.fullName': 'Vollständiger Name',
    'profile.email': 'E-Mail-Adresse',
    'profile.accountType': 'Kontotyp',
    'profile.admin': 'Administrator',
    'profile.standard': 'Standardbenutzer',
    'profile.languageRegion': 'Sprache & Region',
    'profile.preferredLanguage': 'Bevorzugte Sprache',
    'profile.signOut': 'Abmelden',
    'admin.accessDenied.title': 'Zugriff verweigert',
    'admin.accessDenied.text': 'Administratorrechte sind erforderlich.',
    'admin.accessDenied.recheck': 'Status erneut prüfen',
  },
  it: {
    'nav.home': 'Home',
    'nav.market': 'Mercato',
    'nav.trade': 'Scambia',
    'nav.assets': 'Asset',
    'nav.profile': 'Profilo',
    'nav.admin': 'Admin',
    'profile.title': 'Impostazioni profilo',
    'profile.accountInfo': 'Informazioni account',
    'profile.fullName': 'Nome completo',
    'profile.email': 'Indirizzo e-mail',
    'profile.accountType': 'Tipo di account',
    'profile.admin': 'Amministratore',
    'profile.standard': 'Utente standard',
    'profile.languageRegion': 'Lingua e regione',
    'profile.preferredLanguage': 'Lingua preferita',
    'profile.signOut': 'Esci',
    'admin.accessDenied.title': 'Accesso negato',
    'admin.accessDenied.text':
      "Sono necessari i privilegi d'amministratore.",
    'admin.accessDenied.recheck': 'Ricontrolla stato',
  },
  pt: {
    'nav.home': 'Início',
    'nav.market': 'Mercado',
    'nav.trade': 'Negociar',
    'nav.assets': 'Ativos',
    'nav.profile': 'Perfil',
    'nav.admin': 'Admin',
    'profile.title': 'Configurações do Perfil',
    'profile.accountInfo': 'Informações da conta',
    'profile.fullName': 'Nome completo',
    'profile.email': 'Endereço de e-mail',
    'profile.accountType': 'Tipo de conta',
    'profile.admin': 'Administrador',
    'profile.standard': 'Usuário padrão',
    'profile.languageRegion': 'Idioma e região',
    'profile.preferredLanguage': 'Idioma preferido',
    'profile.signOut': 'Sair',
    'admin.accessDenied.title': 'Acesso negado',
    'admin.accessDenied.text': 'Você precisa de privilégios de administrador.',
    'admin.accessDenied.recheck': 'Verificar novamente',
  },
  ru: {
    'nav.home': 'Главная',
    'nav.market': 'Рынок',
    'nav.trade': 'Торговля',
    'nav.assets': 'Активы',
    'nav.profile': 'Профиль',
    'nav.admin': 'Админ',
    'profile.title': 'Настройки профиля',
    'profile.accountInfo': 'Информация аккаунта',
    'profile.fullName': 'Полное имя',
    'profile.email': 'Электронная почта',
    'profile.accountType': 'Тип аккаунта',
    'profile.admin': 'Администратор',
    'profile.standard': 'Обычный пользователь',
    'profile.languageRegion': 'Язык и регион',
    'profile.preferredLanguage': 'Предпочитаемый язык',
    'profile.signOut': 'Выйти',
    'admin.accessDenied.title': 'Доступ запрещён',
    'admin.accessDenied.text': 'Нужны права администратора.',
    'admin.accessDenied.recheck': 'Проверить снова',
  },
  ja: {
    'nav.home': 'ホーム',
    'nav.market': 'マーケット',
    'nav.trade': '取引',
    'nav.assets': '資産',
    'nav.profile': 'プロフィール',
    'nav.admin': '管理',
    'profile.title': 'プロフィール設定',
    'profile.accountInfo': 'アカウント情報',
    'profile.fullName': '氏名',
    'profile.email': 'メールアドレス',
    'profile.accountType': 'アカウント種別',
    'profile.admin': '管理者',
    'profile.standard': '一般ユーザー',
    'profile.languageRegion': '言語と地域',
    'profile.preferredLanguage': '優先言語',
    'profile.signOut': 'サインアウト',
    'admin.accessDenied.title': 'アクセス拒否',
    'admin.accessDenied.text': '管理者権限が必要です。',
    'admin.accessDenied.recheck': '再チェック',
  },
  ko: {
    'nav.home': '홈',
    'nav.market': '마켓',
    'nav.trade': '거래',
    'nav.assets': '자산',
    'nav.profile': '프로필',
    'nav.admin': '관리',
    'profile.title': '프로필 설정',
    'profile.accountInfo': '계정 정보',
    'profile.fullName': '이름',
    'profile.email': '이메일 주소',
    'profile.accountType': '계정 유형',
    'profile.admin': '관리자',
    'profile.standard': '일반 사용자',
    'profile.languageRegion': '언어 및 지역',
    'profile.preferredLanguage': '기본 언어',
    'profile.signOut': '로그아웃',
    'admin.accessDenied.title': '접근 거부',
    'admin.accessDenied.text': '관리자 권한이 필요합니다.',
    'admin.accessDenied.recheck': '다시 확인',
  },
  zh: {
    'nav.home': '首页',
    'nav.market': '行情',
    'nav.trade': '交易',
    'nav.assets': '资产',
    'nav.profile': '个人',
    'nav.admin': '后台',
    'profile.title': '个人设置',
    'profile.accountInfo': '账户信息',
    'profile.fullName': '姓名',
    'profile.email': '邮箱地址',
    'profile.accountType': '账户类型',
    'profile.admin': '管理员',
    'profile.standard': '普通用户',
    'profile.languageRegion': '语言与地区',
    'profile.preferredLanguage': '首选语言',
    'profile.signOut': '退出登录',
    'admin.accessDenied.title': '无权访问',
    'admin.accessDenied.text': '需要管理员权限。',
    'admin.accessDenied.recheck': '重新检查',
  },
};

function translate(lang: string, key: string): string {
  const L = TR[lang] || TR.en;
  return L[key] || TR.en[key] || key;
}

/* ──────────────────────────────────────────────────────────────────────────
   Binance polling
   ────────────────────────────────────────────────────────────────────────── */
type BinanceTicker = {
  symbol: string;
  lastPrice: string;
  priceChangePercent: string;
  volume: string;
  quoteVolume: string;
};

const BINANCE_MAP: Record<string, string> = {
  BTC: 'BTCUSDT',
  ETH: 'ETHUSDT',
  BNB: 'BNBUSDT',
  SOL: 'SOLUSDT',
  ADA: 'ADAUSDT',
  AVAX: 'AVAXUSDT',
  DOT: 'DOTUSDT',
  MATIC: 'MATICUSDT',
};

const BINANCE_TO_LOCAL: Record<string, string> = Object.fromEntries(
  Object.entries(BINANCE_MAP).map(([k, v]) => [v, k]),
);

/* ────────────────────────────────────────────────────────────────────────── */

interface AppUser extends Profile {
  balances: Record<string, number>;
}

interface AppContextType {
  user: AppUser | null;
  coins: Coin[];
  transactions: Transaction[];
  language: string;
  loading: boolean;
  t: (key: string) => string;

  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<boolean>;
  setLanguage: (lang: string) => void;

  updateBalance: (coin: string, amount: number) => Promise<void>;
  addTransaction: (
    t: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>
  ) => Promise<void>;
  updateCoinPrice: (symbol: string, price: number) => Promise<void>;
  refreshData: () => Promise<void>;

  refreshUserData?: (userId?: string) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const toNum = (v: any, d = 0) =>
  v === null || v === undefined || v === '' ? d : Number(v);
const normalizeCoin = (c: any) => ({
  ...c,
  price: toNum(c.price),
  change24h: toNum((c as any).change24h ?? (c as any).change_24h),
  volume: toNum(c.volume),
  market_cap: toNum((c as any).market_cap ?? (c as any).marketCap),
});

// ⭐ helper: normalize balances to UPPERCASE keys
function toUpperBalances(rows: Array<{ coin_symbol: string; balance: number }>) {
  const map: Record<string, number> = {};
  (rows || []).forEach((r) => {
    const key = String(r.coin_symbol || '').toUpperCase();
    map[key] = Number(r.balance ?? 0);
  });
  return map;
}

/* ──────────────────────────────────────────────────────────────────────────
   Helper: call server to get profile+balances+transactions
   ────────────────────────────────────────────────────────────────────────── */
async function fetchUserDataFromServer(opts: {
  email?: string;
  id?: string;
}): Promise<{
  profile: Profile;
  balances: Array<{ coin_symbol: string; balance: number }>;
  transactions: Transaction[];
}> {
  const qs = opts.id
    ? `id=${encodeURIComponent(opts.id)}`
    : `email=${encodeURIComponent(opts.email || '')}`;
  const res = await fetch(`/.netlify/functions/get-user-data?${qs}`);
  const json = await res.json();
  if (!res.ok || json?.ok === false) {
    throw new Error(json?.error || res.statusText);
  }
  return json;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [coins, setCoins] = useState<Coin[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [language, setLanguageState] = useState<string>(
    localStorage.getItem('nova_lang') || 'en'
  );
  const [loading, setLoading] = useState(true);

  const t = (key: string) => translate(language, key);

  // ── App init
  useEffect(() => {
    const initApp = async () => {
      try {
        await initializeDatabase(); // no-op on client stub
        const res = await pingDB(); // { ok:false } on client stub
        console.log('Neon ping:', res);
        await loadCoins();
      } catch (error) {
        console.error('Error initializing app:', error);
      } finally {
        setLoading(false);
      }
    };
    initApp();
  }, []);

  // Restore user & transactions via server function
  useEffect(() => {
    const savedEmail = localStorage.getItem('nova_user_email');
    if (!savedEmail) return;
    (async () => {
      try {
        const j = await fetchUserDataFromServer({ email: savedEmail });

        const balMap = toUpperBalances(j.balances || []);

        const profile = j.profile as Profile;
        setUser({ ...profile, balances: balMap });
        setTransactions((j.transactions || []) as Transaction[]);

        if (profile.language && profile.language !== language) {
          setLanguage(profile.language);
        }
      } catch (e) {
        console.warn('Could not restore user:', e);
        localStorage.removeItem('nova_user_email');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // keep language in localStorage
  useEffect(() => {
    localStorage.setItem('nova_lang', language);
  }, [language]);

  // Replace your current loadCoins with this:
  const loadCoins = async () => {
    try {
      // 1) Try server (Neon) via Netlify Function
      const res = await fetch('/.netlify/functions/get-coins', { cache: 'no-store' });
      if (res.ok) {
        const { coins } = await res.json();
        setCoins(coins.map(normalizeCoin) as any);
        return;
      } else {
        console.warn('get-coins non-200:', res.status, await res.text());
      }
    } catch (e) {
      console.warn('get-coins failed, falling back to stub:', e);
    }

    // 2) Fallback to client stub (mock list) if server isn’t available
    try {
      const coinsData = await NeonDB.getCoins();
      setCoins(coinsData.map(normalizeCoin) as any);
    } catch (error) {
      console.error('Error loading coins:', error);
    }
  };

  const loadUserData = async (userId: string) => {
    try {
      const j = await fetchUserDataFromServer({ id: userId });
      const balMap = toUpperBalances(j.balances || []);
      setUser((prev) => (prev ? { ...prev, balances: balMap } : prev));
      setTransactions((j.transactions || []) as Transaction[]);
    } catch (error) {
      console.error('Error loading user data:', error);
    }
  };

  const refreshUserData = async (targetUserId?: string): Promise<void> => {
    try {
      const uid = targetUserId ?? user?.id;
      if (!uid) return;
      await loadUserData(uid);
    } catch (e) {
      console.error('refreshUserData failed:', e);
    }
  };

  const refreshProfileFromDB = async () => {
    if (!user) return;
    const { profile: fresh } = await getProfileByEmail(user.email);
    if (fresh) {
      const now = new Date().toISOString();
      const merged: Profile = {
        id: (fresh as any).id ?? user.id,
        email: user.email,
        name: fresh.name ?? user.name,
        is_admin: !!fresh.is_admin,
        language: (fresh as any).language ?? user.language ?? 'en',
        created_at: user.created_at ?? now,
        updated_at: now,
      };
      setUser((prev) => (prev ? { ...prev, ...merged } : prev));
      if (merged.language && merged.language !== language) {
        setLanguage(merged.language);
      }
    }
  };

  /* ────────────── Auth: Supabase + server upsert + server read ────────────── */
  const login = async (email: string, password: string): Promise<boolean> => {
    try {
      // Quick sanity check for env — saves you from silent failures
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        alert('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
        return false;
      }

      // 1) Supabase auth
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        alert(`Sign in failed: ${error.message}`);
        console.error('Auth signIn failed:', error);
        return false;
      }
      if (!data?.user) {
        alert('Sign in failed: no user returned from Supabase.');
        return false;
      }

      // 2) Upsert profile on the server (Netlify Function → Neon)
      try {
        const u = data.user!;
        await fetch('/.netlify/functions/upsert-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: u.id,
            email: u.email,
            name:
              (u.user_metadata as any)?.name ??
              (u.user_metadata as any)?.full_name ??
              (u.email ? u.email.split('@')[0] : 'user'),
          }),
        });
      } catch (err) {
        console.error('Profile sync failed:', err);
        // non-fatal; continue
      }

      // 3) Pull profile + balances + txs from the server
      const j = await fetchUserDataFromServer({ email });

      const balMap = toUpperBalances(j.balances || []);

      const profile = j.profile as Profile;
      setUser({ ...profile, balances: balMap });
      setTransactions((j.transactions || []) as Transaction[]);
      if (profile.language && profile.language !== language) {
        setLanguage(profile.language);
      }

      localStorage.setItem('nova_user_email', profile.email);
      await refreshData();

      return true;
    } catch (e: any) {
      alert(`Login error: ${e?.message || String(e)}`);
      console.error('Login error:', e);
      return false;
    }
  };

  const register = async (
    email: string,
    password: string,
    name: string
  ): Promise<boolean> => {
    try {
      if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
        alert('Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
        return false;
      }

      // 1) Create auth user in Supabase
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin + '/profile' },
      });
      console.log('supabase.auth.signUp →', { authData, authError });
      if (authError) {
        alert(`Sign up failed: ${authError.message}`);
        return false;
      }
      if (!authData?.user) {
        alert('Sign up failed: no user returned from Supabase.');
        return false;
      }

      // 2) Create a Supabase profiles row (public table)
      const isAdmin = email === 'admin52980@gmail.com';
      const { profile, error } = await createProfile(email, name, isAdmin);
      console.log('createProfile →', { profile, error });
      if (error) {
        // Not fatal; still proceed. Show warning so you know to check.
        console.warn('createProfile warning:', error);
      }

      // 3) Upsert Neon profile via Netlify Function (server-side)
      try {
        await fetch('/.netlify/functions/upsert-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: authData.user.id,
            email,
            name,
            is_admin: isAdmin,
          }),
        });
      } catch (e) {
        console.warn('Server profile upsert failed (non-fatal):', e);
      }

      // 4) Pull fresh data from server and set context
      const j = await fetchUserDataFromServer({ email });

      const balMap = toUpperBalances(j.balances || []);

      const serverProfile = j.profile as Profile;
      setUser({ ...serverProfile, balances: balMap });
      setTransactions((j.transactions || []) as Transaction[]);
      localStorage.setItem('nova_user_email', serverProfile.email);

      return true;
    } catch (e: any) {
      alert(`Registration error: ${e?.message || String(e)}`);
      console.error('Registration error:', e);
      return false;
    }
  };

  const logout = async (): Promise<void> => {
    try {
      await supabase.auth.signOut();
    } catch {
      // ignore
    }
    setUser(null);
    setTransactions([]);
    localStorage.removeItem('nova_user_email');
  };

  /* ────────────── Data mutations ──────────────
     NOTE: These still call NeonDB.*; if you want to harden further,
     move them behind Netlify Functions just like get-user-data. */
  const updateBalance = async (
    coinSymbol: string,
    amount: number
  ): Promise<void> => {
    if (!user) return;
    try {
      await NeonDB.updateUserBalance(user.id, coinSymbol, amount);
      await refreshUserData(user.id);
    } catch (error) {
      console.error('Error updating balance:', error);
      throw error;
    }
  };

  const addTransaction = async (
    t: Omit<Transaction, 'id' | 'created_at' | 'updated_at'>
  ): Promise<void> => {
    try {
      await NeonDB.addTransaction(t);
      if (user) {
        await refreshUserData(user.id);
      }
    } catch (error) {
      console.error('Error adding transaction:', error);
      throw error;
    }
  };

  const updateCoinPrice = async (symbol: string, price: number): Promise<void> => {
    try {
      await NeonDB.updateCoinPrice(symbol, price);
      setCoins((prev) =>
        prev.map((coin) =>
          coin.symbol === symbol
            ? ({
                ...coin,
                price: toNum(price),
                updated_at: new Date().toISOString(),
              } as any)
            : coin
        )
      );
    } catch (error) {
      console.error('Error updating coin price:', error);
      throw error;
    }
  };

  // change UI language + persist to DB if logged in
  const setLanguage = (lang: string) => {
    setLanguageState(lang);
    localStorage.setItem('nova_lang', lang);
    const maybeSetLang = (NeonDB as unknown as {
      setUserLanguage?: (id: string, l: string) => Promise<void>;
    }).setUserLanguage;
    if (user?.id && typeof maybeSetLang === 'function') {
      maybeSetLang(user.id, lang).catch(() => {});
    }
  };

  const refreshData = async (): Promise<void> => {
    await loadCoins();
    if (user) {
      await refreshProfileFromDB();
      await refreshUserData(user.id);
    }
  };

  /* ────────────── Live price polling ────────────── */
  const pollMs = Number(import.meta.env.VITE_PRICE_POLL_MS ?? 15000);
  const persistMs = Number(import.meta.env.VITE_PRICE_PERSIST_MS ?? 60000);
  const lastPersistRef = useRef(0);

  useEffect(() => {
    const localSymbols = coins
      .map((c) => c.symbol)
      .filter((s) => !!BINANCE_MAP[s]);
    if (localSymbols.length === 0) return;

    const binanceSymbols = localSymbols.map((s) => BINANCE_MAP[s]);
    const url =
      'https://api.binance.com/api/v3/ticker/24hr?symbols=' +
      encodeURIComponent(JSON.stringify(binanceSymbols));

    let timer: number | undefined;

    const pull = async () => {
      try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) throw new Error(`Binance ${res.status}`);
        const data: BinanceTicker[] = await res.json();

        const map: Record<string, BinanceTicker> = {};
        for (const r of data) map[r.symbol] = r;

        const nowIso = new Date().toISOString();
        setCoins((prev) =>
          prev.map((c) => {
            const mapped = BINANCE_MAP[c.symbol];
            if (!mapped) return c;
            const tkr = map[mapped];
            if (!tkr) return c;
            const price = Number(tkr.lastPrice);
            const change24h = Number(tkr.priceChangePercent);
            const volume = toNum(tkr.quoteVolume || tkr.volume, (c as any).volume ?? 0);
            return { ...c, price, change24h, volume, updated_at: nowIso } as any;
          })
        );

        const now = Date.now();
        if (now - lastPersistRef.current >= persistMs) {
          lastPersistRef.current = now;
          data.forEach((tkr) => {
            const local = BINANCE_TO_LOCAL[tkr.symbol];
            if (!local) return;
            const p = Number(tkr.lastPrice);
            if (isFinite(p) && p > 0) {
              NeonDB.updateCoinPrice(local, p).catch(() => {});
            }
          });
        }
      } catch (e) {
        console.warn('Live price poll failed:', e);
      }
    };

    pull();
    timer = window.setInterval(pull, pollMs);
    return () => {
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [coins.length, persistMs, pollMs]);

  return (
    <AppContext.Provider
      value={{
        user,
        coins,
        transactions,
        language,
        loading,
        t,
        login,
        logout,
        register,
        setLanguage,
        updateBalance,
        addTransaction,
        updateCoinPrice,
        refreshData,
        refreshUserData,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within an AppProvider');
  return ctx;
}
