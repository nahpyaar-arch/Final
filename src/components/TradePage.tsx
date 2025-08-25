// src/components/TradePage.tsx
import { useState, useMemo } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useApp } from '../contexts/AppContext';

type TxResp = { ok: boolean; id?: string; to_amount?: number; fee?: number; message?: string };

async function postJson<T = any>(url: string, body: any): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let msg = `${url} -> ${res.status}`;
    try {
      const j = await res.json();
      if (j?.message) msg += `: ${j.message}`;
    } catch {}
    throw new Error(msg);
  }
  try {
    return (await res.json()) as T;
  } catch {
    return {} as T;
  }
}

export default function TradePage() {
  const { coins, user, refreshData } = useApp();

  const [selectedCoin, setSelectedCoin] = useState('BTC');
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [amount, setAmount] = useState('');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [limitPrice, setLimitPrice] = useState('');
  const [showPreview, setShowPreview] = useState(false);

  // helpers
  const sym = (s: string) => String(s || '').toUpperCase();

  // coin & balances (uppercase-safe)
  const selectedCoinData = useMemo(
    () => coins.find((coin) => sym(coin.symbol) === sym(selectedCoin)),
    [coins, selectedCoin]
  );
  const userBalance = Number(user?.balances?.[sym(selectedCoin)] ?? 0);
  const usdtBalance = Number(user?.balances?.['USDT'] ?? 0);

  const effectivePrice =
    orderType === 'limit' && limitPrice
      ? Number(limitPrice)
      : Number(selectedCoinData?.price ?? 0);

  const changePct = Number(
    (selectedCoinData as any)?.change24h ?? (selectedCoinData as any)?.change_24h ?? 0
  );

  const calculateTotal = () => {
    const amt = Number(amount || 0);
    if (!amt || !effectivePrice) return 0;
    return amt * effectivePrice; // total in USDT
    // (server still executes at current price; limit is only a UI hint)
  };

  const handleTrade = async () => {
    if (!user?.id) {
      alert('Please log in again.');
      return;
    }
    const tradeAmount = Number(amount || 0);
    if (!selectedCoinData || !tradeAmount || tradeAmount <= 0 || !effectivePrice) {
      alert('Enter a valid amount/price.');
      return;
    }

    const totalUSDT = tradeAmount * effectivePrice;

    let from_symbol: string;
    let to_symbol: string;
    let from_amount: number;

    if (tradeType === 'buy') {
      // BUY selectedCoin using USDT
      if (usdtBalance < totalUSDT) {
        alert(`Insufficient USDT balance. Need ${totalUSDT.toFixed(2)} USDT, have ${usdtBalance.toFixed(2)} USDT.`);
        return;
      }
      from_symbol = 'USDT';
      to_symbol = sym(selectedCoin);
      from_amount = totalUSDT; // FROM units
    } else {
      // SELL selectedCoin for USDT
      if (userBalance < tradeAmount) {
        alert(`Insufficient ${sym(selectedCoin)} balance. Need ${tradeAmount}, have ${userBalance.toFixed(6)}.`);
        return;
      }
      from_symbol = sym(selectedCoin);
      to_symbol = 'USDT';
      from_amount = tradeAmount; // FROM units
    }

    try {
      const resp = await postJson<TxResp>('/.netlify/functions/exchange', {
        user_id: user.id,
        from_symbol: sym(from_symbol),
        to_symbol: sym(to_symbol),
        amount: Number(from_amount),
      });

      if (!resp?.ok) {
        alert(resp?.message || 'Trade failed.');
        return;
      }

      setAmount('');
      setLimitPrice('');
      setShowPreview(false);
      await refreshData?.();

      alert(
        tradeType === 'buy'
          ? `Bought ${tradeAmount} ${sym(selectedCoin)} successfully!`
          : `Sold ${tradeAmount} ${sym(selectedCoin)} successfully!`
      );
    } catch (e: any) {
      console.error('trade error:', e);
      alert(e?.message || 'Trade failed.');
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Please log in to trade</h2>
          <p className="text-gray-400">You need to be logged in to access the trading platform.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-4">Spot Trading</h1>
          <p className="text-gray-400">Trade cryptocurrencies with real-time market prices</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Trading Form */}
          <div className="lg:col-span-1">
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              {/* Coin Selection */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">Select Cryptocurrency</label>
                <select
                  value={selectedCoin}
                  onChange={(e) => setSelectedCoin(e.target.value)}
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {coins.map((coin) => (
                    <option key={coin.symbol} value={coin.symbol}>
                      {coin.name} ({coin.symbol})
                    </option>
                  ))}
                </select>
              </div>

              {/* Current Price */}
              {selectedCoinData && (
                <div className="mb-6 p-4 bg-gray-700 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-400">Current Price</p>
                      <p className="text-xl font-bold text-white">
                        $
                        {Number(selectedCoinData.price).toLocaleString(undefined, {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: Number(selectedCoinData.price) < 1 ? 6 : 2,
                        })}
                      </p>
                    </div>
                    <div
                      className={`flex items-center space-x-1 ${changePct >= 0 ? 'text-green-400' : 'text-red-400'}`}
                    >
                      {changePct >= 0 ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                      <span className="font-semibold">{changePct.toFixed(2)}%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Trade Type Toggle */}
              <div className="mb-6">
                <div className="flex bg-gray-700 rounded-lg p-1">
                  <button
                    onClick={() => setTradeType('buy')}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                      tradeType === 'buy' ? 'bg-green-600 text-white' : 'text-gray-300 hover:text-white'
                    }`}
                  >
                    Buy
                  </button>
                  <button
                    onClick={() => setTradeType('sell')}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                      tradeType === 'sell' ? 'bg-red-600 text-white' : 'text-gray-300 hover:text-white'
                    }`}
                  >
                    Sell
                  </button>
                </div>
              </div>

              {/* Order Type */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">Order Type</label>
                <div className="flex bg-gray-700 rounded-lg p-1">
                  <button
                    onClick={() => setOrderType('market')}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                      orderType === 'market' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:text-white'
                    }`}
                  >
                    Market
                  </button>
                  <button
                    onClick={() => setOrderType('limit')}
                    className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors ${
                      orderType === 'limit' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:text-white'
                    }`}
                  >
                    Limit
                  </button>
                </div>
              </div>

              {/* Limit Price */}
              {orderType === 'limit' && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-300 mb-2">Limit Price (USDT)</label>
                  <input
                    type="number"
                    value={limitPrice}
                    onChange={(e) => setLimitPrice(e.target.value)}
                    placeholder="Enter limit price"
                    className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}

              {/* Amount */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Amount ({sym(selectedCoin)})
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="mt-2 text-sm text-gray-400">
                  Available:{' '}
                  {tradeType === 'buy'
                    ? `${usdtBalance.toFixed(2)} USDT`
                    : `${userBalance.toFixed(6)} ${sym(selectedCoin)}`}
                </div>
              </div>

              {/* Total */}
              {amount && (
                <div className="mb-6 p-4 bg-gray-700 rounded-lg">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Total (USDT)</span>
                    <span className="text-white font-semibold">{calculateTotal().toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="space-y-3">
                <button
                  onClick={() => setShowPreview(true)}
                  disabled={!amount || (orderType === 'limit' && !limitPrice)}
                  className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                    tradeType === 'buy'
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-red-600 hover:bg-red-700 text-white'
                  } disabled:bg-gray-600 disabled:cursor-not-allowed`}
                >
                  Preview {tradeType === 'buy' ? 'Buy' : 'Sell'} Order
                </button>
              </div>
            </div>
          </div>

          {/* Market Data */}
          <div className="lg:col-span-2">
            <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
              <h2 className="text-xl font-bold text-white mb-6">Market Overview</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Coin
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Price
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        24h Change
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {coins.slice(0, 10).map((coin) => {
                      const pct = Number((coin as any).change24h ?? (coin as any).change_24h ?? 0);
                      return (
                        <tr key={coin.symbol} className="hover:bg-gray-700 transition-colors">
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className="flex items-center space-x-2">
                              <div>
                                <div className="text-sm font-medium text-white">{coin.name}</div>
                                <div className="text-sm text-gray-400">{sym(coin.symbol)}</div>
                              </div>
                              {coin.isCustom && (
                                <span className="bg-purple-600 text-xs px-2 py-1 rounded-full">NOVA</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-white font-semibold">
                            $
                            {Number(coin.price).toLocaleString(undefined, {
                              minimumFractionDigits: 2,
                              maximumFractionDigits: Number(coin.price) < 1 ? 6 : 2,
                            })}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <div className={`flex items-center space-x-1 ${pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                              {pct >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                              <span className="text-sm font-semibold">{pct.toFixed(2)}%</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap">
                            <button
                              onClick={() => setSelectedCoin(sym(coin.symbol))}
                              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded text-sm transition-colors"
                            >
                              Select
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Preview Modal */}
        {showPreview && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-gray-800 rounded-lg w-full max-w-md border border-gray-700">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-white mb-4">Order Preview</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400">Type</span>
                    <span className={`font-semibold ${tradeType === 'buy' ? 'text-green-400' : 'text-red-400'}`}>
                      {tradeType.toUpperCase()} {sym(selectedCoin)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Amount</span>
                    <span className="text-white">
                      {amount} {sym(selectedCoin)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Price</span>
                    <span className="text-white">${effectivePrice.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Total</span>
                    <span className="text-white font-semibold">{calculateTotal().toFixed(2)} USDT</span>
                  </div>
                </div>
                <div className="flex space-x-3 mt-6">
                  <button
                    onClick={() => setShowPreview(false)}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white py-2 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleTrade}
                    className={`flex-1 py-2 rounded-lg font-semibold transition-colors ${
                      tradeType === 'buy'
                        ? 'bg-green-600 hover:bg-green-700 text-white'
                        : 'bg-red-600 hover:bg-red-700 text-white'
                    }`}
                  >
                    Confirm {tradeType === 'buy' ? 'Buy' : 'Sell'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
