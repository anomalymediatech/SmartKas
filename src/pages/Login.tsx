import { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Wrench } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-industrial-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-industrial-200 shadow-sm w-full max-w-sm p-8">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-10 h-10 bg-accent-500 rounded-lg flex items-center justify-center">
            <Wrench className="h-6 w-6 text-white" />
          </div>
          <span className="text-2xl font-bold text-industrial-900">SmartKas</span>
        </div>
        <h1 className="text-lg font-semibold text-industrial-900 text-center mb-6">Masuk ke Akun</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-industrial-700 mb-1">Username</label>
            <input
              className="w-full px-4 py-2.5 rounded-lg border border-industrial-300 focus:outline-none focus:ring-2 focus:ring-accent-500"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-industrial-700 mb-1">Password</label>
            <input
              type="password"
              className="w-full px-4 py-2.5 rounded-lg border border-industrial-300 focus:outline-none focus:ring-2 focus:ring-accent-500"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-sm text-danger-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-accent-600 text-white font-semibold hover:bg-accent-700 disabled:opacity-60 transition-colors"
          >
            {loading ? 'Memproses…' : 'Masuk'}
          </button>
        </form>
        <p className="text-xs text-industrial-400 text-center mt-6">SmartKas v1.0.0 — Bengkel POS</p>
      </div>
    </div>
  );
}
