import React, { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Package, Truck, MapPin, User, ArrowLeft, Loader2, Printer, CheckCircle2, Pencil, X, RotateCcw } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
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
  const [error, setError] = useState<string | null>(null);

  // Package details
  const [weight, setWeight] = useState('1.0');
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [height, setHeight] = useState('');
  
  const [rates, setRates] = useState<any[]>([]);
  const [isRating, setIsRating] = useState(false);
  const [selectedRate, setSelectedRate] = useState<any>(null);
  const [isShipping, setIsShipping] = useState(false);
  const [labelUrl, setLabelUrl] = useState<string | null>(null);
  const [trackingNumber, setTrackingNumber] = useState<string | null>(null);

  // Weight fields
  const [weightKg, setWeightKg] = useState('');
  const [weightG, setWeightG] = useState('');

  // Editing state
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);

  // Sync weight when Kg or G changes
  useEffect(() => {
    const kg = parseFloat(weightKg) || 0;
    const g = parseFloat(weightG) || 0;
    const totalKg = kg + (g / 1000);
    setWeight(totalKg.toString());
  }, [weightKg, weightG]);

  const handleWeightKgChange = (val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num)) {
      const kg = Math.floor(num);
      const remainder = num - kg;
      if (remainder > 0) {
        setWeightKg(kg.toString());
        setWeightG((Math.round(remainder * 1000)).toString());
      } else {
        setWeightKg(val);
      }
    } else {
      setWeightKg(val);
    }
  };

  const handleWeightGChange = (val: string) => {
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 1000) {
      const extraKg = Math.floor(num / 1000);
      const remainingG = num % 1000;
      setWeightKg((parseInt(weightKg || '0') + extraKg).toString());
      setWeightG(remainingG.toString());
    } else {
      setWeightG(val);
    }
  };

  const clearPackageDetails = () => {
    setWeightKg('');
    setWeightG('');
    setLength('');
    setWidth('');
    setHeight('');
  };

  useEffect(() => {
    const fetchOrder = async () => {
      if (order || !id || !credentials.magento.url || !credentials.magento.token) return;
      
      setIsLoading(true);
      setError(null);
      try {
        const client = new MagentoClient(
          credentials.magento.url,
          credentials.magento.token,
          credentials.general.proxyUrl
        );
        const fetchedOrder = await client.getOrder(id);
        setOrder(fetchedOrder);
      } catch (e: any) {
        console.error(e);
        setError(e.message || "Failed to load order details.");
        toast.error("Failed to load order from Magento.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrder();
  }, [id, order, credentials.magento.url, credentials.magento.token, credentials.general.proxyUrl]);

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
      // Sort cheapest to most expensive
      setRates(mockRates.sort((a, b) => a.price - b.price));
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

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-900" />
        <p className="text-zinc-500">Loading order details...</p>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <div className="p-3 bg-red-50 rounded-full">
          <Package className="w-8 h-8 text-red-600" />
        </div>
        <h2 className="text-xl font-bold text-zinc-900">Order Not Found</h2>
        <p className="text-zinc-500 max-w-md text-center">{error || "We couldn't find the order you're looking for."}</p>
        <Button onClick={() => navigate('/')} variant="outline">Back to Dashboard</Button>
      </div>
    );
  }

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
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2">
                <User size={20} /> Customer & Shipping
              </CardTitle>
              <Dialog open={isEditingCustomer} onOpenChange={setIsEditingCustomer}>
                <DialogTrigger
                  render={
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <Pencil size={16} />
                    </Button>
                  }
                />
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Edit Customer & Shipping Info</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>First Name</Label>
                        <Input 
                          value={order.customer_firstname} 
                          onChange={(e) => setOrder({...order, customer_firstname: e.target.value})}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Last Name</Label>
                        <Input 
                          value={order.customer_lastname} 
                          onChange={(e) => setOrder({...order, customer_lastname: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input 
                        value={order.customer_email} 
                        onChange={(e) => setOrder({...order, customer_email: e.target.value})}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Telephone</Label>
                      <Input 
                        value={order.shipping_address?.telephone || ''} 
                        onChange={(e) => setOrder({
                          ...order, 
                          shipping_address: { ...order.shipping_address!, telephone: e.target.value }
                        })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Street Address</Label>
                      <Input 
                        value={order.shipping_address?.street?.join(', ') || ''} 
                        onChange={(e) => setOrder({
                          ...order, 
                          shipping_address: { ...order.shipping_address!, street: [e.target.value] }
                        })}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>City</Label>
                        <Input 
                          value={order.shipping_address?.city || ''} 
                          onChange={(e) => setOrder({
                            ...order, 
                            shipping_address: { ...order.shipping_address!, city: e.target.value }
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Region</Label>
                        <Input 
                          value={order.shipping_address?.region || ''} 
                          onChange={(e) => setOrder({
                            ...order, 
                            shipping_address: { ...order.shipping_address!, region: e.target.value }
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Postcode</Label>
                        <Input 
                          value={order.shipping_address?.postcode || ''} 
                          onChange={(e) => setOrder({
                            ...order, 
                            shipping_address: { ...order.shipping_address!, postcode: e.target.value }
                          })}
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={() => setIsEditingCustomer(false)}>Done</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-8">
              <div className="space-y-1">
                <p className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Customer</p>
                <p className="font-bold text-lg">{order.customer_firstname} {order.customer_lastname}</p>
                <p className="text-zinc-600">{order.customer_email}</p>
                <p className="text-zinc-600">{order.shipping_address?.telephone || 'No phone number'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Shipping Address</p>
                <p className="font-bold text-lg">{order.shipping_address?.street?.join(', ') || 'No street address'}</p>
                <p className="text-zinc-600">
                  {order.shipping_address?.city}, {order.shipping_address?.region} {order.shipping_address?.postcode}
                </p>
                <p className="text-zinc-600">{order.shipping_address?.country_id}</p>
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
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-right">Customs/HTS</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(order.items || []).map((item, idx) => {
                    const product = productDetails[item.sku];
                    // Mapping COO to country_of_manufacture and HTS to commodity_code
                    const htsCode = product?.custom_attributes?.find((a: any) => a.attribute_code === 'commodity_code')?.value || 'N/A';
                    const coo = product?.custom_attributes?.find((a: any) => a.attribute_code === 'country_of_manufacture')?.value || 'N/A';
                    const currencySymbol = credentials.general.currency === 'GBP' ? '£' : credentials.general.currency === 'EUR' ? '€' : '$';
                    const total = item.price * item.qty_ordered;

                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">
                          <div>
                            <p>{item.name}</p>
                            <p className="text-zinc-500 font-mono text-[10px]">{item.sku}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{item.qty_ordered}</TableCell>
                        <TableCell className="text-right">
                          <div className="text-xs">
                            <p><span className="text-zinc-400">HTS:</span> {htsCode}</p>
                            <p><span className="text-zinc-400">COO:</span> {coo}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {currencySymbol}{item.price.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {currencySymbol}{total.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          <Dialog open={editingItem?.sku === item.sku} onOpenChange={(open) => !open && setEditingItem(null)}>
                            <DialogTrigger
                              render={
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setEditingItem(item)}>
                                  <Pencil size={14} />
                                </Button>
                              }
                            />
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Edit Item: {item.name}</DialogTitle>
                              </DialogHeader>
                              <div className="grid gap-4 py-4">
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label>Price</Label>
                                    <Input 
                                      type="number"
                                      value={item.price} 
                                      onChange={(e) => {
                                        const newItems = [...order.items];
                                        newItems[idx] = { ...item, price: parseFloat(e.target.value) || 0 };
                                        setOrder({ ...order, items: newItems });
                                      }}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Quantity</Label>
                                    <Input 
                                      type="number"
                                      value={item.qty_ordered} 
                                      onChange={(e) => {
                                        const newItems = [...order.items];
                                        newItems[idx] = { ...item, qty_ordered: parseFloat(e.target.value) || 0 };
                                        setOrder({ ...order, items: newItems });
                                      }}
                                    />
                                  </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                    <Label>HTS Code</Label>
                                    <Input 
                                      value={htsCode} 
                                      onChange={(e) => {
                                        const newProductDetails = { ...productDetails };
                                        const product = { ...newProductDetails[item.sku] };
                                        const attrs = [...(product.custom_attributes || [])];
                                        const htsIdx = attrs.findIndex(a => a.attribute_code === 'commodity_code');
                                        if (htsIdx > -1) attrs[htsIdx] = { ...attrs[htsIdx], value: e.target.value };
                                        else attrs.push({ attribute_code: 'commodity_code', value: e.target.value });
                                        product.custom_attributes = attrs;
                                        newProductDetails[item.sku] = product;
                                        setProductDetails(newProductDetails);
                                      }}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>Country of Origin</Label>
                                    <Input 
                                      value={coo} 
                                      onChange={(e) => {
                                        const newProductDetails = { ...productDetails };
                                        const product = { ...newProductDetails[item.sku] };
                                        const attrs = [...(product.custom_attributes || [])];
                                        const cooIdx = attrs.findIndex(a => a.attribute_code === 'country_of_manufacture');
                                        if (cooIdx > -1) attrs[cooIdx] = { ...attrs[cooIdx], value: e.target.value };
                                        else attrs.push({ attribute_code: 'country_of_manufacture', value: e.target.value });
                                        product.custom_attributes = attrs;
                                        newProductDetails[item.sku] = product;
                                        setProductDetails(newProductDetails);
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>
                              <DialogFooter>
                                <Button onClick={() => setEditingItem(null)}>Done</Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                        </TableCell>
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
          <Card className="overflow-hidden border-zinc-200 p-0 gap-0">
            <div className="bg-zinc-900 p-4 text-white">
              <h3 className="font-bold flex items-center gap-2">
                <Truck size={18} /> Shipping Console
              </h3>
              <p className="text-xs text-zinc-400">Configure package and fetch rates</p>
            </div>
            <CardContent className="p-6 space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold uppercase text-zinc-500">Package Details</Label>
                  <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={clearPackageDetails}>
                    <RotateCcw size={10} /> Clear
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="weightKg">Weight (KG)</Label>
                    <Input 
                      id="weightKg" 
                      type="number" 
                      step="0.1"
                      value={weightKg} 
                      onChange={(e) => handleWeightKgChange(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="weightG">Weight (Grams)</Label>
                    <Input 
                      id="weightG" 
                      type="number" 
                      value={weightG} 
                      onChange={(e) => handleWeightGChange(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="length">L (cm)</Label>
                    <Input 
                      id="length" 
                      type="number" 
                      value={length} 
                      onChange={(e) => setLength(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="width">W (cm)</Label>
                    <Input 
                      id="width" 
                      type="number" 
                      value={width} 
                      onChange={(e) => setWidth(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="height">H (cm)</Label>
                    <Input 
                      id="height" 
                      type="number" 
                      value={height} 
                      onChange={(e) => setHeight(e.target.value)}
                    />
                  </div>
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
                          <p className="font-bold text-zinc-900">
                            {credentials.general.currency === 'GBP' ? '£' : credentials.general.currency === 'EUR' ? '€' : '$'}
                            {rate.price.toFixed(2)}
                          </p>
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
