import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Truck, Search, ExternalLink, RotateCcw, ChevronLeft, ChevronRight, Loader2, Calendar, AlertCircle } from 'lucide-react';
import { SawyerCredentials, SawyerShipment } from '@/src/hooks/use-sawyer-storage';
import { UPSClient, FedExClient } from '@/src/lib/api-clients';
import { toast } from 'sonner';

export default function Tracking({ credentials, onSave }: { credentials: SawyerCredentials, onSave: (creds: SawyerCredentials) => Promise<void> }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshingIds, setRefreshingIds] = useState<Set<string>>(new Set());
  const PAGE_SIZE = 20;

  const filteredShipments = useMemo(() => {
    const shipments = credentials.shipments || [];
    if (!searchQuery) return shipments;
    
    const query = searchQuery.toLowerCase();
    return shipments.filter(s => 
      s.orderIncrementId.toLowerCase().includes(query) ||
      s.trackingNumber.toLowerCase().includes(query) ||
      s.customerName.toLowerCase().includes(query) ||
      s.company.toLowerCase().includes(query) ||
      s.carrier.toLowerCase().includes(query) ||
      s.service.toLowerCase().includes(query)
    );
  }, [credentials.shipments, searchQuery]);

  const totalPages = Math.ceil(filteredShipments.length / PAGE_SIZE);
  const paginatedShipments = filteredShipments.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const getTrackingUrl = (carrier: string, trackingNumber: string) => {
    if (carrier === 'UPS') {
      return `https://www.ups.com/track?loc=en_US&tracknum=${trackingNumber}&requester=ST/`;
    }
    return `https://www.fedex.com/fedextrack/?trknbr=${trackingNumber}`;
  };

  const updateShipmentStatus = async (shipment: SawyerShipment) => {
    setRefreshingIds(prev => new Set(prev).add(shipment.id));
    
    try {
      let newStatus = shipment.status || 'Unknown';
      
      if (shipment.carrier === 'UPS') {
        const accountNumber = credentials.ups.isSandbox
          ? (credentials.ups.domesticAccountNumber || credentials.ups.accountNumber)
          : (credentials.ups.productionAccountNumber || credentials.ups.accountNumber);

        const clientId = credentials.ups.isSandbox ? credentials.ups.sandboxClientId : credentials.ups.productionClientId;
        const clientSecret = credentials.ups.isSandbox ? credentials.ups.sandboxClientSecret : credentials.ups.productionClientSecret;

        if (!clientId || !clientSecret) throw new Error('Missing UPS credentials');

        const client = new UPSClient(
          clientId,
          clientSecret,
          accountNumber,
          credentials.ups.isSandbox,
          credentials.general.proxyUrl
        );
        const data = await client.trackShipment(shipment.trackingNumber);
        newStatus = data?.trackResponse?.shipment?.[0]?.package?.[0]?.activity?.[0]?.status?.description || 'Active';
      } else if (shipment.carrier === 'FedEx') {
        const accountNumber = credentials.fedex.isSandbox
          ? (credentials.fedex.domesticAccountNumber || credentials.fedex.accountNumber)
          : (credentials.fedex.productionAccountNumber || credentials.fedex.accountNumber);

        const apiKey = credentials.fedex.isSandbox ? credentials.fedex.sandboxApiKey : credentials.fedex.productionApiKey;
        const secretKey = credentials.fedex.isSandbox ? credentials.fedex.sandboxSecretKey : credentials.fedex.productionSecretKey;

        if (!apiKey || !secretKey) throw new Error('Missing FedEx credentials');

        const client = new FedExClient(
          apiKey,
          secretKey,
          accountNumber,
          credentials.fedex.isSandbox,
          credentials.general.proxyUrl
        );
        const data = await client.trackShipment(shipment.trackingNumber);
        newStatus = data?.output?.completeTrackResults?.[0]?.trackResults?.[0]?.latestStatusDetail?.description || 'Active';
      }

      // Update local storage on SUCCESS
      const updatedShipments = credentials.shipments.map(s => 
        s.id === shipment.id ? { ...s, status: newStatus, hasError: false, lastUpdated: new Date().toISOString() } : s
      );

      await onSave({
        ...credentials,
        shipments: updatedShipments
      });
      
    } catch (e) {
      console.error(`Failed to refresh tracking for ${shipment.trackingNumber}:`, e);
      
      // Update local storage on FAILURE - mark as error but preserve old status
      const updatedShipments = credentials.shipments.map(s => 
        s.id === shipment.id ? { ...s, hasError: true, lastUpdated: new Date().toISOString() } : s
      );

      await onSave({
        ...credentials,
        shipments: updatedShipments
      });
      
      // Only show error toast for manual refreshes of one item
      if (refreshingIds.size === 1) {
        toast.error(`Could not refresh tracking for ${shipment.trackingNumber}`);
      }
    } finally {
      setRefreshingIds(prev => {
        const next = new Set(prev);
        next.delete(shipment.id);
        return next;
      });
    }
  };

  const refreshPageStatuses = async () => {
    setIsRefreshing(true);
    toast.info(`Refreshing statuses for ${paginatedShipments.length} shipments...`);
    
    const promises = paginatedShipments.map(s => updateShipmentStatus(s));
    await Promise.all(promises);
    
    setIsRefreshing(false);
    toast.success("Tracking statuses updated.");
  };

  // Initial refresh of current page on mount? Maybe not auto-refresh all to avoid rate limits
  // but let's do it if they haven't been updated recently.
  useEffect(() => {
    const now = new Date();
    const needsRefresh = paginatedShipments.filter(s => {
      if (!s.lastUpdated) return true;
      const last = new Date(s.lastUpdated);
      const diffMs = now.getTime() - last.getTime();
      return diffMs > 1000 * 60 * 30; // 30 minutes
    });

    if (needsRefresh.length > 0 && !isRefreshing) {
      // Don't auto-refresh automatically to be safe with rate limits, 
      // but maybe if only a few items
      if (needsRefresh.length <= 5) {
        needsRefresh.forEach(s => updateShipmentStatus(s));
      }
    }
  }, [currentPage]);

  // Cleanup old shipments ( > 100 days)
  useEffect(() => {
    if (!credentials.shipments || credentials.shipments.length === 0) return;

    const hundredDaysAgo = new Date();
    hundredDaysAgo.setDate(hundredDaysAgo.getDate() - 100);

    const validShipments = credentials.shipments.filter(s => {
      const shipDate = new Date(s.shipDate);
      return shipDate >= hundredDaysAgo;
    });

    if (validShipments.length !== credentials.shipments.length) {
      console.log(`[Tracking] Cleaning up ${credentials.shipments.length - validShipments.length} old shipments (>100 days)`);
      onSave({
        ...credentials,
        shipments: validShipments
      });
    }
  }, []);

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Tracking</h1>
          <p className="text-zinc-500">Monitor shipments and pull live status updates.</p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            className="gap-2" 
            onClick={refreshPageStatuses}
            disabled={isRefreshing || paginatedShipments.length === 0}
          >
            {isRefreshing ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
            Refresh Page Statuses
          </Button>
        </div>
      </header>

      <Card className="border-zinc-200">
        <CardHeader className="pb-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 w-4 h-4" />
              <Input
                placeholder="Search order #, tracking, name..."
                className="pl-10"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
              />
            </div>
            <div className="text-xs text-zinc-400 font-medium uppercase tracking-wider">
              {filteredShipments.length} total shipments
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
            <Table>
              <TableHeader className="bg-zinc-50/50">
                <TableRow>
                  <TableHead className="w-[150px]">Date of Ship</TableHead>
                  <TableHead>Order / Name</TableHead>
                  <TableHead>Company</TableHead>
                  <TableHead>Service</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedShipments.length > 0 ? (
                  paginatedShipments.map((shipment) => (
                    <TableRow key={shipment.id} className="hover:bg-zinc-50/50 transition-colors group">
                      <TableCell className="font-mono text-xs text-zinc-500">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-zinc-400" />
                          {new Date(shipment.shipDate).toLocaleDateString([], { 
                            month: 'short', 
                            day: 'numeric',
                            year: 'numeric'
                          })}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-0.5">
                          <p className="font-bold text-zinc-900 leading-none">#{shipment.orderIncrementId}</p>
                          <p className="text-xs text-zinc-500 font-medium">{shipment.customerName}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-zinc-600 font-medium">
                          {shipment.company || '-'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className={`text-[9px] font-black uppercase tracking-tighter h-4 px-1 ${
                              shipment.carrier === 'UPS' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                            }`}>
                              {shipment.carrier}
                            </Badge>
                            <span className="text-xs font-mono text-zinc-400 group-hover:text-zinc-900 transition-colors">
                              {shipment.trackingNumber}
                            </span>
                          </div>
                          <p className="text-[10px] text-zinc-500 leading-tight font-medium">
                             {shipment.service}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge className={`shadow-none ${
                            shipment.status?.toLowerCase().includes('delivered') ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-100' :
                            shipment.status?.toLowerCase().includes('pick') || shipment.status?.toLowerCase().includes('in transit') ? 'bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-100' :
                            'bg-zinc-100 text-zinc-700 border-zinc-200 hover:bg-zinc-100'
                          }`}>
                            {refreshingIds.has(shipment.id) ? (
                              <Loader2 size={10} className="animate-spin mr-1" />
                            ) : null}
                            {shipment.status || 'Active'}
                          </Badge>
                          
                          {shipment.hasError && !refreshingIds.has(shipment.id) && (
                            <AlertCircle size={14} className="text-red-500" title="Last update attempt failed" />
                          )}

                          {shipment.lastUpdated && !refreshingIds.has(shipment.id) && (
                            <button 
                              onClick={() => updateShipmentStatus(shipment)}
                              className={`w-5 h-5 flex items-center justify-center transition-colors ${shipment.hasError ? 'text-red-400 hover:text-red-600' : 'text-zinc-400 hover:text-zinc-900'}`}
                              title={shipment.hasError ? `Update failed. Last checked: ${new Date(shipment.lastUpdated).toLocaleTimeString()}` : `Last updated: ${new Date(shipment.lastUpdated).toLocaleTimeString()}`}
                            >
                              <RotateCcw size={10} className={shipment.hasError ? "animate-pulse" : ""} />
                            </button>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-8 gap-2 text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100"
                          onClick={() => window.open(getTrackingUrl(shipment.carrier, shipment.trackingNumber), '_blank')}
                        >
                          Go to tracking
                          <ExternalLink size={12} />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="h-64 text-center">
                      <div className="flex flex-col items-center justify-center space-y-3">
                         <div className="p-4 bg-zinc-50 rounded-full">
                           <Truck className="w-8 h-8 text-zinc-300" />
                         </div>
                         <div className="space-y-1">
                           <p className="font-bold text-zinc-900">No shipments found</p>
                           <p className="text-sm text-zinc-500">Created labels will appear here for tracking.</p>
                         </div>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">
                Page {currentPage} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => prev - 1)}
                >
                  <ChevronLeft size={14} />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage(prev => prev + 1)}
                >
                  Next
                  <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
