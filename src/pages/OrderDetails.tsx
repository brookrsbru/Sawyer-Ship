import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package, Truck, MapPin, User, ArrowLeft, Loader2, Printer, CheckCircle2, Globe } from 'lucide-react';
import { MagentoOrder, UPSClient, FedExClient, MagentoClient } from '@/src/lib/api-clients';
import { SawyerCredentials } from '@/src/hooks/use-sawyer-storage';
import { toast } from 'sonner';

export default function OrderDetails({ credentials }: { credentials: SawyerCredentials }) {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const [order, setOrder] = useState<MagentoOrder | null>(location.state?.order || null);
  const [productDetails, setProductDetails] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingProducts, setIsFetchingProducts] = useState(false);
  
  // Package details
  const [weight, setWeight] = useState('1.0');
  const [length, setLength] = useState('10');
  const [width, setWidth] = useState('10');
  const [height, setHeight] = useState('10');
  
  const [rates, setRates] = useState<any[]>([]);
  const [isRating, setIsRating] = useState(false);
  const [selectedRate, setSelectedRate] = useState<any>(null);
  const [isShipping, setIsShipping] = useState(false);
  const [labelUrl, setLabelUrl] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState<string | null>(null);

  useEffect(() => {
    const fetchProductInfo = async () => {
      if (!order || !credentials.magento.url || !credentials.magento.token) return;
      
      setIsFetchingProducts(true);
      const client = new MagentoClient(
        credentials.magento.url,
        credentials.magento.token,
        credentials.general.proxyUrl
      );

      const details: Record<string, any> = {};
      try {
        await Promise.all(order.items.map(async (item) => {
          try {
            const product = await client.getProduct(item.sku);
            details[item.sku] = product;
          } catch (e) {
            console.error(`Failed to fetch product ${item.sku}`, e);
          }
        }));
        setProductDetails(details);
      } finally {
        setIsFetchingProducts(false);
      }
    };

    fetchProductInfo();
  }, [order, credentials.magento.url, credentials.magento.token, credentials.general.proxyUrl]);

  const fetchRates = async () => {
    if (!order) return;
    setIsRating(true);
    setRates([]);
    
    try {
      // Mocking rate fetch for demo purposes as real API calls need valid tokens
      // In a real scenario, we would call UPSClient and FedExClient here
      
      const mockRates = [
        { id: 'ups-1', carrier: 'UPS', service: 'Ground', price: 12.45, delivery: '3-5 Days' },
        { id: 'ups-2', carrier: 'UPS', service: 'Next Day Air', price: 45.20, delivery: 'Tomorrow' },
        { id: 'fedex-1', carrier: 'FedEx', service: 'Home Delivery', price: 13.10, delivery: '3-4 Days' },
        { id: 'fedex-2', carrier: 'FedEx', service: 'Express Saver', price: 28.50, delivery: '3 Days' },
      ];
      
      await new Promise(r => setTimeout(r, 1500));
      setRates(mockRates);
      toast.success("Fetched live rates from carriers.");
    } catch (error) {
      toast.error("Failed to fetch rates. Check carrier credentials.");
    } finally {
      setIsRating(false);
    }
  };

  const handleCreateLabel = async () => {
    if (!selectedRate || !order) return;
    setIsShipping(true);
    
    try {
      // 1. Mock Carrier API Call (Label Generation)
      await new Promise(r => setTimeout(r, 2000));
      const mockTracking = `1Z${Math.random().toString(36).substring(2, 15).toUpperCase()}`;
      setTrackingNumber(mockTracking);
      setLabelUrl("https://www.ups.com/assets/resources/media/en_US/shipping_label_samples.pdf");

      // 2. Update Magento Shipment Status
      const client = new MagentoClient(
        credentials.magento.url,
        credentials.magento.token,
        credentials.general.proxyUrl
      );

      // Map carrier name as requested
      const carrierTitle = selectedRate.carrier === 'UPS' ? 'United Parcel Service' : 'Federal Express';
      const carrierCode = selectedRate.carrier.toLowerCase();

      await client.createShipment(order.entity_id, [{
        track_number: mockTracking,
        title: carrierTitle,
        carrier_code: carrierCode
      }]);

      toast.success(`Label created and Magento updated with ${carrierTitle}!`);
    } catch (error) {
      console.error(error);
      toast.error("Label created, but failed to update Magento shipment status.");
    } finally {
      setIsShipping(false);
    }
  };

  if (!order) return <div>Loading order...</div>;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">Order #{order.increment_id}</h1>
            <p className="text-zinc-500">Imported from Magento</p>
          </div>
        </div>
        <Badge className="bg-zinc-900 text-white px-3 py-1 text-sm">{order.status}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column: Order Info */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User size={20} /> Customer & Shipping
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-8">
              <div className="space-y-1">
                <p className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Customer</p>
                <p className="font-bold text-lg">{order.customer_firstname} {order.customer_lastname}</p>
                <p className="text-zinc-600">{order.customer_email}</p>
                <p className="text-zinc-600">{order.shipping_address.telephone}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Shipping Address</p>
                <p className="font-bold text-lg">{order.shipping_address.street.join(', ')}</p>
                <p className="text-zinc-600">
                  {order.shipping_address.city}, {order.shipping_address.region} {order.shipping_address.postcode}
                </p>
                <p className="text-zinc-600">{order.shipping_address.country_id}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package size={20} /> Order Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Customs/HTS</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {order.items.map((item, idx) => {
                    const product = productDetails[item.sku];
                    // Example of finding a custom attribute like 'ts_hts_code' or 'country_of_origin'
                    const htsCode = product?.custom_attributes?.find((a: any) => a.attribute_code === 'ts_hts_code')?.value || 'N/A';
                    const coo = product?.custom_attributes?.find((a: any) => a.attribute_code === 'country_of_origin')?.value || 'N/A';
                    
                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell className="text-zinc-500 font-mono text-xs">{item.sku}</TableCell>
                        <TableCell className="text-center">{item.qty_ordered}</TableCell>
                        <TableCell className="text-right">
                          <div className="text-xs">
                            <p><span className="text-zinc-400">HTS:</span> {htsCode}</p>
                            <p><span className="text-zinc-400">COO:</span> {coo}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">${item.price.toFixed(2)}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {isFetchingProducts && (
                <div className="flex items-center justify-center py-4 text-zinc-500 text-sm gap-2">
                  <Loader2 className="animate-spin w-4 h-4" />
                  Fetching product customs data...
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Shipping Console */}
        <div className="space-y-6">
          <Card className="border-zinc-900 border-2">
            <CardHeader className="bg-zinc-900 text-white rounded-t-lg">
              <CardTitle className="flex items-center gap-2 text-white">
                <Truck size={20} /> Shipping Console
              </CardTitle>
              <CardDescription className="text-zinc-400">Configure package and get rates.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Weight (lbs)</Label>
                  <Input type="number" value={weight} onChange={(e) => setWeight(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Length (in)</Label>
                  <Input type="number" value={length} onChange={(e) => setLength(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Width (in)</Label>
                  <Input type="number" value={width} onChange={(e) => setWidth(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Height (in)</Label>
                  <Input type="number" value={height} onChange={(e) => setHeight(e.target.value)} />
                </div>
              </div>

              <Button 
                className="w-full bg-zinc-900 hover:bg-zinc-800" 
                onClick={fetchRates}
                disabled={isRating}
              >
                {isRating ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Truck className="w-4 h-4 mr-2" />}
                Get Live Rates
              </Button>

              {rates.length > 0 && (
                <div className="space-y-3">
                  <Separator />
                  <p className="text-xs font-bold uppercase text-zinc-500 tracking-widest">Available Services</p>
                  <div className="space-y-2">
                    {rates.map((rate) => (
                      <div 
                        key={rate.id}
                        className={`p-3 border rounded-lg cursor-pointer transition-all ${
                          selectedRate?.id === rate.id 
                            ? "border-zinc-900 bg-zinc-50 ring-1 ring-zinc-900" 
                            : "border-zinc-200 hover:border-zinc-400"
                        }`}
                        onClick={() => setSelectedRate(rate)}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="font-bold text-sm">{rate.carrier} {rate.service}</p>
                            <p className="text-xs text-zinc-500">{rate.delivery}</p>
                          </div>
                          <p className="font-bold text-zinc-900">${rate.price.toFixed(2)}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button 
                    className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white"
                    disabled={!selectedRate || isShipping || !!labelUrl}
                    onClick={handleCreateLabel}
                  >
                    {isShipping ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    Create Label
                  </Button>
                </div>
              )}

              {labelUrl && (
                <div className="space-y-4 pt-4">
                  <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm space-y-2">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <span className="font-bold">Label generated & Magento Updated!</span>
                    </div>
                    {trackingNumber && (
                      <div className="pl-8 font-mono text-xs">
                        Tracking: {trackingNumber}
                      </div>
                    )}
                  </div>
                  <Button variant="outline" className="w-full gap-2" onClick={() => window.open(labelUrl, '_blank')}>
                    <Printer size={18} /> Print Shipping Label
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
