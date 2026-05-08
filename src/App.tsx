import { createHashRouter, RouterProvider, Routes, Route, Navigate, Link, Outlet } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { useSawyerStorage } from '@/src/hooks/use-sawyer-storage';
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Lock, Book, Settings as SettingsIcon, LayoutDashboard, LogOut, AlertTriangle, ExternalLink, Package, Truck, ShieldAlert } from 'lucide-react';
import { 
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import Dashboard from '@/src/pages/Dashboard';
import Settings from '@/src/pages/Settings';
import OrderDetails from '@/src/pages/OrderDetails';
import AddressBook from '@/src/pages/AddressBook';
import Tracking from '@/src/pages/Tracking';
import { APP_VERSION } from '@/src/constants';

function LockScreen({ onUnlock, onReset, hasStoredData, initialServerUrl }: { 
  onUnlock: (pw: string, serverUrl?: string) => Promise<boolean>, 
  onReset: () => void, 
  hasStoredData: boolean,
  initialServerUrl: string
}) {
  const [password, setPassword] = useState('');
  const [serverUrl, setServerUrl] = useState(initialServerUrl);
  const [error, setError] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSyncing(true);
    setError(false);
    const success = await onUnlock(password, serverUrl);
    setIsSyncing(false);
    if (!success) setError(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
      <Card className="w-full max-w-md shadow-xl border-zinc-200">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-zinc-900 rounded-xl flex items-center justify-center mb-4">
            <Lock className="text-white w-6 h-6" />
          </div>
          <CardTitle className="text-2xl font-bold">Sawyer-Ship</CardTitle>
          <CardDescription>
            {hasStoredData 
              ? "Access your shipping control center." 
              : "Initialize your standalone shipping vault."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Server Base URL</label>
                <Input 
                  value={serverUrl} 
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="http://localhost:3000"
                  className="h-10 text-sm font-mono bg-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Vault Password</label>
                <Input
                  type="password"
                  placeholder="Enter master password..."
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={error ? "border-red-500 bg-red-50 focus-visible:ring-red-500" : "bg-white"}
                  autoFocus
                />
                {error && <p className="text-xs text-red-500 font-medium">Authentication failed. Check password and server status.</p>}
              </div>
            </div>

            <Button 
              type="submit" 
              disabled={isSyncing}
              className="w-full bg-zinc-900 hover:bg-zinc-800 h-10 font-bold uppercase tracking-widest text-[11px]"
            >
              {isSyncing ? "Connecting..." : (hasStoredData ? "Unlock" : "Begin Setup")}
            </Button>
          </form>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button className="w-full mt-8 text-[10px] text-zinc-400 hover:text-zinc-600 uppercase font-medium tracking-tight h-8 transition-colors border-none bg-transparent cursor-pointer">
                Clear Session Configuration
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                  <AlertTriangle size={20} />
                  Reset Session
                </AlertDialogTitle>
                <AlertDialogDescription>
                  This will forget the server URL from this browser. 
                  Your data remains safe on your standalone server.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel variant="outline" size="default">Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onReset} className="bg-red-600 hover:bg-red-700">
                  Reset local session
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
      <footer className="fixed bottom-4 right-4 text-sm font-mono text-zinc-300">
        Sawyer-Ship v{APP_VERSION}
      </footer>
    </div>
  );
}

function Layout({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="h-screen bg-zinc-50 flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-zinc-200 flex flex-col h-full shrink-0">
        <div className="p-6">
          <div className="flex items-center gap-2 font-bold text-xl">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
              <Package className="text-white w-5 h-5" />
            </div>
            <span>Sawyer-Ship</span>
          </div>
        </div>
        
        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          <Link to="/" className="flex items-center gap-3 px-3 py-2 text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors">
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </Link>
          <Link to="/address-book" className="flex items-center gap-3 px-3 py-2 text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors">
            <Book size={20} />
            <span>Address Book</span>
          </Link>
          <Link to="/tracking" className="flex items-center gap-3 px-3 py-2 text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors">
            <Truck size={20} />
            <span>Tracking</span>
          </Link>
          <Link to="/settings" className="flex items-center gap-3 px-3 py-2 text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors">
            <SettingsIcon size={20} />
            <span>Settings</span>
          </Link>
        </nav>

        <div className="p-4 border-t border-zinc-200">
          <Button variant="ghost" className="w-full justify-start gap-3 text-zinc-600" onClick={onLogout}>
            <LogOut size={20} />
            <span>Lock App</span>
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto w-full">
        <div className="max-w-7xl mx-auto p-8 min-h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const { 
    isLocked, 
    credentials, 
    unlock, 
    logout, 
    hasStoredData, 
    save, 
    exportData, 
    importData, 
    resetData,
    serverUrl
  } = useSawyerStorage();

  // Auto-lock logic
  React.useEffect(() => {
    if (isLocked || !credentials.general.autoLockMinutes || credentials.general.autoLockMinutes <= 0) {
      return;
    }

    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        logout();
      }, credentials.general.autoLockMinutes * 60 * 1000);
    };

    // Events to track activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => document.addEventListener(event, resetTimer));

    // Initial timer start
    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      events.forEach(event => document.removeEventListener(event, resetTimer));
    };
  }, [isLocked, credentials.general.autoLockMinutes, logout]);

  const router = useMemo(() => createHashRouter([
    {
      path: "/",
      element: <Layout onLogout={logout} />,
      children: [
        {
          index: true,
          element: <Dashboard credentials={credentials} />,
        },
        {
          path: "address-book",
          element: <AddressBook credentials={credentials} onSave={save} />,
        },
        {
          path: "order/:id",
          element: <OrderDetails credentials={credentials} onSave={save} />,
        },
        {
          path: "tracking",
          element: <Tracking credentials={credentials} onSave={save} />,
        },
        {
          path: "settings",
          element: (
            <Settings 
              credentials={credentials} 
              onSave={save} 
              onExport={exportData} 
              onImport={importData} 
            />
          ),
        },
        {
          path: "*",
          element: <Navigate to="/" replace />,
        },
      ],
    },
  ]), [credentials, logout, save, exportData, importData]);

  if (isLocked) {
    return (
      <>
        <LockScreen 
          onUnlock={unlock} 
          onReset={resetData} 
          hasStoredData={hasStoredData} 
          initialServerUrl={serverUrl}
        />
        <Toaster position="top-right" richColors expand={true} />
      </>
    );
  }

  return (
    <>
      <RouterProvider router={router} />
      <Toaster position="top-right" richColors expand={true} />
    </>
  );
}
