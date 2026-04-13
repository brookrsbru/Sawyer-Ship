import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Search, Package, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { MagentoClient, MagentoOrder } from '@/src/lib/api-clients';
import { SawyerCredentials } from '@/src/hooks/use-sawyer-storage';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function Dashboard({ credentials }: { credentials: SawyerCredentials }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [orders, setOrders] = useState<MagentoOrder[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!credentials.magento.url || !credentials.magento.token) {
      toast.error("Magento credentials not configured. Please go to Settings.");
      return;
    }

    setIsLoading(true);
    try {
      const client = new MagentoClient(
        credentials.magento.url, 
        credentials.magento.token, 
        credentials.general.proxyUrl
      );
      const results = await client.searchOrders(searchQuery);
      setOrders(results);
      if (results.length === 0) {
        toast.info("No orders found matching your search.");
      }
    } catch (error) {
      console.error(error);
      toast.error("Failed to fetch orders. Check your Magento settings and CORS proxy.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-zinc-900">Shipping Dashboard</h1>
        <p className="text-zinc-500">Search and import orders from your Magento store.</p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Import Orders</CardTitle>
          <CardDescription>Search by Order ID, Customer Name, or Email.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" />
              <Input
                placeholder="Order # (e.g. 000000001)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit" disabled={isLoading} className="bg-zinc-900 hover:bg-zinc-800">
              {isLoading ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Search className="w-4 h-4 mr-2" />}
              Search Magento
            </Button>
          </form>
        </CardContent>
      </Card>

      {orders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Search Results</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Order #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map((order) => (
                  <TableRow key={order.entity_id}>
                    <TableCell className="font-medium">{order.increment_id}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p className="font-medium">{order.customer_firstname} {order.customer_lastname}</p>
                        <p className="text-zinc-500 text-xs">{order.customer_email}</p>
                      </div>
                    </TableCell>
                    <TableCell>{new Date(order.created_at).toLocaleDateString()}</TableCell>
                    <TableCell>${order.grand_total.toFixed(2)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">{order.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="gap-2"
                        onClick={() => navigate(`/order/${order.entity_id}`, { state: { order } })}
                      >
                        Ship Order <ArrowRight size={16} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {!isLoading && orders.length === 0 && searchQuery && (
        <div className="text-center py-12 bg-zinc-100 rounded-xl border-2 border-dashed border-zinc-200">
          <Package className="mx-auto w-12 h-12 text-zinc-300 mb-4" />
          <h3 className="text-lg font-medium text-zinc-900">No orders found</h3>
          <p className="text-zinc-500">Try searching for a different order number or email.</p>
        </div>
      )}

      {(!credentials.magento.url || !credentials.magento.token) && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-lg flex gap-3 items-start">
          <AlertCircle className="text-amber-600 w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <h4 className="font-medium text-amber-900">Configuration Required</h4>
            <p className="text-sm text-amber-700">
              You haven't set up your Magento API credentials yet. 
              Please head over to the <Link to="/settings" className="underline font-bold">Settings</Link> page to get started.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
