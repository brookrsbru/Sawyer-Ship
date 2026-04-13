import React, { useState, useEffect } from "react";
import { 
  LayoutDashboard, 
  Package, 
  Settings as SettingsIcon, 
  Truck, 
  RefreshCw, 
  Search,
  CheckCircle2,
  AlertCircle,
  FileText,
  ChevronRight,
  LogOut,
  LogIn,
  Mail,
  Lock,
  UserPlus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { 
  auth, 
  googleProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword,
  updateProfile,
  db
} from "./firebase";
import { doc, setDoc } from "firebase/firestore";
import { signInWithPopup, signOut, onAuthStateChanged, User } from "firebase/auth";

// --- Types ---
interface Order {
  entity_id: number;
  increment_id: string;
  customer_firstname: string;
  customer_lastname: string;
  grand_total: number;
  status: string;
  created_at: string;
  shipping_address?: {
    city: string;
    region: string;
    postcode: string;
    country_id: string;
  };
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [activeTab, setActiveTab] = useState("orders");
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Login Form State
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegistering, setIsRegistering] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  
  // Profile State
  const [profileName, setProfileName] = useState("");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState("");
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setProfileName(currentUser.displayName || "");
        setProfilePhotoUrl(currentUser.photoURL || "");
      }
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setProfileLoading(true);
    try {
      await updateProfile(user, { 
        displayName: profileName,
        photoURL: profilePhotoUrl
      });
      
      // Also update Firestore document
      const userRef = doc(db, "users", user.uid);
      await setDoc(userRef, {
        displayName: profileName,
        photoURL: profilePhotoUrl,
        email: user.email,
        uid: user.uid,
        role: user.email === "brookrsbru@gmail.com" ? "admin" : "user"
      }, { merge: true });

      toast.success("Profile updated successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    } finally {
      setProfileLoading(false);
    }
  };

  const fetchOrders = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const idToken = await user.getIdToken();
      const response = await fetch("/api/magento/orders", {
        headers: {
          Authorization: `Bearer ${idToken}`
        }
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch orders");
      }
      const data = await response.json();
      setOrders(data.items || []);
      toast.success("Orders synced successfully");
    } catch (error: any) {
      toast.error(error.message || "Could not sync orders. Check your Magento settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchOrders();
    } else {
      setOrders([]);
    }
  }, [user]);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      toast.success("Logged in successfully");
    } catch (error) {
      toast.error("Login failed");
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthLoading(true);
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, email, password);
        toast.success("Account created successfully");
      } else {
        await signInWithEmailAndPassword(auth, email, password);
        toast.success("Logged in successfully");
      }
    } catch (error: any) {
      console.error("Auth Error:", error);
      toast.error(error.message || "Authentication failed");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      toast.success("Logged out successfully");
    } catch (error) {
      toast.error("Logout failed");
    }
  };

  if (!isAuthReady) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <RefreshCw className="w-8 h-8 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md bg-white shadow-xl border-zinc-200">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto w-12 h-12 bg-blue-50 rounded-full flex items-center justify-center mb-2">
              <Truck className="w-6 h-6 text-blue-600" />
            </div>
            <CardTitle className="text-2xl font-bold">Sawyer-Ship Manager</CardTitle>
            <CardDescription>
              {isRegistering ? "Create your account." : "Secure access to your Magento shipping interface."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleEmailAuth} className="space-y-4">
              <div className="space-y-2">
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                  <Input 
                    type="email" 
                    placeholder="Email address" 
                    className="pl-10" 
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-zinc-400" />
                  <Input 
                    type="password" 
                    placeholder="Password" 
                    className="pl-10" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <Button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 h-11" disabled={authLoading}>
                {authLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : isRegistering ? (
                  "Create Account"
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-zinc-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-zinc-500">Or continue with</span>
              </div>
            </div>

            <Button variant="outline" className="w-full gap-2 h-11" onClick={handleGoogleLogin} disabled={authLoading}>
              <LogIn className="w-4 h-4" />
              Google Account
            </Button>

            <div className="text-center">
              <button 
                type="button"
                className="text-sm text-blue-600 hover:underline font-medium"
                onClick={() => setIsRegistering(!isRegistering)}
              >
                {isRegistering ? "Already have an account? Sign in" : "Need an account? Create one"}
              </button>
            </div>

          </CardContent>
        </Card>
      </div>
    );
  }

  const filteredOrders = orders.filter(order => 
    order.increment_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
    `${order.customer_firstname} ${order.customer_lastname}`.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-zinc-50 flex">
      <Toaster position="top-right" />
      
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-zinc-200 flex flex-col">
        <div className="p-6 border-b border-zinc-200">
          <div className="flex items-center gap-2 font-bold text-xl text-zinc-900">
            <Truck className="w-6 h-6 text-blue-600" />
            <span>Sawyer-Ship</span>
          </div>
          <p className="text-xs text-zinc-500 mt-1 font-medium uppercase tracking-wider">Shipping Interface</p>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <Button 
            variant={activeTab === "orders" ? "secondary" : "ghost"} 
            className="w-full justify-start gap-3"
            onClick={() => setActiveTab("orders")}
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </Button>
          <Button 
            variant={activeTab === "shipping" ? "secondary" : "ghost"} 
            className="w-full justify-start gap-3"
            onClick={() => setActiveTab("shipping")}
          >
            <Package className="w-4 h-4" />
            Shipping
          </Button>
          <Button 
            variant={activeTab === "history" ? "secondary" : "ghost"} 
            className="w-full justify-start gap-3"
            onClick={() => setActiveTab("history")}
          >
            <FileText className="w-4 h-4" />
            History
          </Button>
        </nav>
        
        <div className="p-4 border-t border-zinc-200 space-y-2">
          <div className="px-3 py-2 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-xs overflow-hidden">
              {user.photoURL ? (
                <img src={user.photoURL} alt="Avatar" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                user.displayName?.charAt(0) || user.email?.charAt(0)
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-zinc-900 truncate">{user.displayName || "Admin"}</p>
              <p className="text-[10px] text-zinc-500 truncate">{user.email}</p>
            </div>
          </div>
          <Button 
            variant={activeTab === "settings" ? "secondary" : "ghost"} 
            className="w-full justify-start gap-3"
            onClick={() => setActiveTab("settings")}
          >
            <SettingsIcon className="w-4 h-4" />
            Settings
          </Button>
          <Button 
            variant="ghost" 
            className="w-full justify-start gap-3 text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={handleLogout}
          >
            <LogOut className="w-4 h-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-8 shrink-0">
          <h1 className="text-lg font-semibold text-zinc-900 capitalize">
            {activeTab === "orders" ? "Order Management" : activeTab}
          </h1>
          <div className="flex items-center gap-4">
            <div className="relative w-64">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-500" />
              <Input 
                placeholder="Search orders..." 
                className="pl-9 bg-zinc-50 border-zinc-200"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <Button variant="outline" size="icon" onClick={fetchOrders} disabled={loading}>
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </header>

        {/* Content Area */}
        <ScrollArea className="flex-1 p-8">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsContent value="orders" className="mt-0 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-white shadow-sm border-zinc-200">
                  <CardHeader className="pb-2">
                    <CardDescription>Pending Orders</CardDescription>
                    <CardTitle className="text-3xl font-bold">{orders.length}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-1 text-xs text-zinc-500">
                      <RefreshCw className="w-3 h-3" />
                      Last updated just now
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-white shadow-sm border-zinc-200">
                  <CardHeader className="pb-2">
                    <CardDescription>Ready to Ship</CardDescription>
                    <CardTitle className="text-3xl font-bold">0</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-1 text-xs text-green-600">
                      <CheckCircle2 className="w-3 h-3" />
                      All systems operational
                    </div>
                  </CardContent>
                </Card>
                <Card className="bg-white shadow-sm border-zinc-200">
                  <CardHeader className="pb-2">
                    <CardDescription>Carrier Alerts</CardDescription>
                    <CardTitle className="text-3xl font-bold">0</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-1 text-xs text-zinc-500">
                      <AlertCircle className="w-3 h-3" />
                      No active service alerts
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="bg-white shadow-sm border-zinc-200">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Magento Orders</CardTitle>
                      <CardDescription>Manage and process your incoming store orders.</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchOrders}>
                      Sync with Magento
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Order ID</TableHead>
                        <TableHead>Customer</TableHead>
                        <TableHead>Date</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredOrders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-12 text-zinc-500">
                            {loading ? "Fetching orders..." : "No orders found. Check your Magento connection."}
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredOrders.map((order) => (
                          <TableRow key={order.entity_id}>
                            <TableCell className="font-medium">#{order.increment_id}</TableCell>
                            <TableCell>{order.customer_firstname} {order.customer_lastname}</TableCell>
                            <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                            <TableCell>${order.grand_total.toFixed(2)}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize bg-blue-50 text-blue-700 border-blue-200">
                                {order.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="sm" className="gap-1">
                                Ship <ChevronRight className="w-3 h-3" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="settings" className="mt-0 space-y-6">
              <Card className="bg-white shadow-sm border-zinc-200">
                <CardHeader>
                  <CardTitle>Profile Settings</CardTitle>
                  <CardDescription>Update your personal information.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-16 h-16 rounded-full bg-zinc-100 border border-zinc-200 overflow-hidden flex items-center justify-center">
                      {profilePhotoUrl ? (
                        <img src={profilePhotoUrl} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                      ) : (
                        <Truck className="w-8 h-8 text-zinc-400" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold">{profileName || "No Name Set"}</h4>
                      <p className="text-xs text-zinc-500">{user.email}</p>
                    </div>
                  </div>

                  <form onSubmit={handleUpdateProfile} className="space-y-4 max-w-md">
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Display Name</label>
                      <Input 
                        value={profileName} 
                        onChange={(e) => setProfileName(e.target.value)} 
                        placeholder="Your Name"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Profile Image URL</label>
                      <Input 
                        value={profilePhotoUrl} 
                        onChange={(e) => setProfilePhotoUrl(e.target.value)} 
                        placeholder="https://example.com/photo.jpg"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium">Email Address</label>
                      <Input value={user.email || ""} disabled className="bg-zinc-50" />
                      <p className="text-[10px] text-zinc-500 italic">Email cannot be changed.</p>
                    </div>
                    <Button type="submit" disabled={profileLoading} className="bg-blue-600 hover:bg-blue-700">
                      {profileLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : "Update Profile"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              <Card className="bg-white shadow-sm border-zinc-200">
                <CardHeader>
                  <CardTitle>Integration Settings</CardTitle>
                  <CardDescription>Configure your API connections for Magento, UPS, and FedEx.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Magento Store</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium">Store URL</label>
                        <Input placeholder="https://your-magento-store.com" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium">Access Token</label>
                        <Input type="password" placeholder="••••••••••••••••" />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">UPS API</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium">Client ID</label>
                        <Input placeholder="UPS Client ID" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium">Client Secret</label>
                        <Input type="password" placeholder="••••••••••••••••" />
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-4">
                    <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500">FedEx API</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-xs font-medium">API Key</label>
                        <Input placeholder="FedEx API Key" />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-medium">Secret Key</label>
                        <Input type="password" placeholder="••••••••••••••••" />
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-4 flex justify-end">
                    <Button className="bg-blue-600 hover:bg-blue-700">Save Configuration</Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </ScrollArea>
      </main>
    </div>
  );
}
