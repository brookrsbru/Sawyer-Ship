import { createHashRouter, RouterProvider, Routes, Route, Navigate, Link, Outlet } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { useSawyerStorage } from '@/src/hooks/use-sawyer-storage';
import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Lock, Book, Settings as SettingsIcon, LayoutDashboard, LogOut, AlertTriangle, ExternalLink, Package } from 'lucide-react';
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

function LockScreen({ onUnlock, onReset, hasStoredData }: { onUnlock: (pw: string) => Promise<boolean>, onReset: () => void, hasStoredData: boolean }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const success = await onUnlock(password);
    if (!success) setError(true);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-12 h-12 bg-zinc-900 rounded-xl flex items-center justify-center mb-4">
            <Lock className="text-white w-6 h-6" />
          </div>
          <CardTitle className="text-2xl font-bold">Sawyer-Ship</CardTitle>
          <CardDescription>
            {hasStoredData 
              ? "Enter your master password to unlock your credentials." 
              : "Create a master password to secure your shipping tokens."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Input
                type="password"
                placeholder="Master Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={error ? "border-red-500" : ""}
              />
              {error && <p className="text-xs text-red-500">Invalid password. Please try again.</p>}
            </div>
            <Button type="submit" className="w-full bg-zinc-900 hover:bg-zinc-800">
              {hasStoredData ? "Unlock" : "Setup Sawyer-Ship"}
            </Button>
          </form>

          {hasStoredData && (
            <div className="mt-6 pt-6 border-t border-zinc-100 text-center">
              <AlertDialog>
                <AlertDialogTrigger className="text-xs text-zinc-500 hover:text-red-600 underline bg-transparent border-none p-0 h-auto font-normal cursor-pointer">
                  Forgotten password? Reset application
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center gap-2 text-red-600">
                      <AlertTriangle size={20} />
                      Warning: Data Loss
                    </AlertDialogTitle>
                    <AlertDialogDescription>
                      Resetting the application will permanently delete all your stored API tokens and settings from this browser's local storage. This action cannot be undone.
                      <br /><br />
                      Are you sure you want to proceed?
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel variant="outline" size="default">Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={onReset} className="bg-red-600 hover:bg-red-700">
                      Yes, Reset Data
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Layout({ onLogout }: { onLogout: () => void }) {
  return (
    <div className="min-h-screen bg-zinc-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-zinc-200 flex flex-col h-screen sticky top-0 shrink-0">
        <div className="p-6">
          <div className="flex items-center gap-2 font-bold text-xl">
            <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center">
              <Package className="text-white w-5 h-5" />
            </div>
            <span>Sawyer-Ship</span>
          </div>
        </div>
        
        <nav className="flex-1 px-4 space-y-1">
          <Link to="/" className="flex items-center gap-3 px-3 py-2 text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors">
            <LayoutDashboard size={20} />
            <span>Dashboard</span>
          </Link>
          <Link to="/address-book" className="flex items-center gap-3 px-3 py-2 text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors">
            <Book size={20} />
            <span>Address Book</span>
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
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export default function App() {
  const { isLocked, credentials, unlock, logout, hasStoredData, save, exportData, importData, resetData } = useSawyerStorage();

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
          element: <OrderDetails credentials={credentials} />,
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
        <LockScreen onUnlock={unlock} onReset={resetData} hasStoredData={hasStoredData} />
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
