// src/components/BottomTabs.tsx
import { NavLink } from 'react-router-dom';
import { Home, LineChart, Wallet2, User, Plus } from 'lucide-react';

const Item = ({
  to,
  label,
  Icon,
}: { to: string; label: string; Icon: React.ComponentType<any> }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      `flex flex-col items-center justify-center text-xs font-medium
       ${isActive ? 'text-white' : 'text-gray-400 hover:text-white'}`
    }
  >
    <Icon className="w-5 h-5 mb-1" />
    <span>{label}</span>
  </NavLink>
);

export default function BottomTabs() {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-50 md:hidden">
      {/* base bar */}
      <div className="relative bg-gray-900/95 backdrop-blur border-t border-gray-800 h-16">
        <div className="grid grid-cols-5 h-full px-2">
          <div className="flex items-center justify-center">
            <Item to="/" label="Home" Icon={Home} />
          </div>
          <div className="flex items-center justify-center">
            <Item to="/market" label="Market" Icon={LineChart} />
          </div>

        {/* center slot (label under the floating button) */}
          <div className="flex items-end justify-center pb-1">
            <span className="text-[10px] text-gray-400">Trade</span>
          </div>

          <div className="flex items-center justify-center">
            <Item to="/assets" label="Assets" Icon={Wallet2} />
          </div>
          <div className="flex items-center justify-center">
            <Item to="/profile" label="Profile" Icon={User} />
          </div>
        </div>

        {/* floating “Trade” button */}
        <NavLink
          to="/trade"
          className="absolute -top-6 left-1/2 -translate-x-1/2"
        >
          <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-blue-600 to-purple-600
                          flex items-center justify-center shadow-xl ring-4 ring-gray-900">
            <Plus className="w-7 h-7 text-white" />
          </div>
        </NavLink>
      </div>

      {/* iOS safe-area padding */}
      <div className="h-[env(safe-area-inset-bottom,0px)] bg-gray-900 md:hidden" />
    </nav>
  );
}
