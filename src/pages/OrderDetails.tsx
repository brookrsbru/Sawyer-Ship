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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MagentoOrder, UPSClient, FedExClient, MagentoClient } from '@/src/lib/api-clients';
import { SawyerCredentials } from '@/src/hooks/use-sawyer-storage';
import { COUNTRY_NAMES } from '@/src/lib/countries';
import { toast } from 'sonner';

export default function OrderDetails({ credentials }: { credentials: SawyerCredentials }) {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  const createBlankOrder = (): MagentoOrder => ({
    entity_id: 0,
    increment_id: 'MANUAL',
    customer_email: '',
    customer_firstname: '',
    customer_lastname: '',
    grand_total: 0,
    status: 'manual',
    created_at: new Date().toISOString(),
    shipping_address: {
      firstname: '',
      lastname: '',
      company: '',
      street: ['', '', ''],
      city: '',
      region: '',
      postcode: '',
      country_id: 'GB',
      telephone: '',
      is_residential: false
    },
    items: []
  });

  const [order, setOrder] = useState<MagentoOrder | null>(() => {
    if (id === 'manual') return createBlankOrder();
    return location.state?.order || null;
  });
  const [productDetails, setProductDetails] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingProducts, setIsFetchingProducts] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attributeOptions, setAttributeOptions] = useState<Record<string, any[]>>({});

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
  const [isLabelViewerOpen, setIsLabelViewerOpen] = useState(false);
  const [fullNameInput, setFullNameInput] = useState("");

  // Address Validation State
  const [isFedExValid, setIsFedExValid] = useState<'none' | 'loading' | 'valid' | 'invalid'>('none');
  const [isValidatingFedEx, setIsValidatingFedEx] = useState(false);
  const [recommendedResidential, setRecommendedResidential] = useState<boolean | null>(null);
  const [isUPSValid, setIsUPSValid] = useState<'none' | 'loading' | 'valid' | 'invalid'>('none');

  // Weight fields
  const [weightKg, setWeightKg] = useState('');
  const [weightG, setWeightG] = useState('');
  const [billShippingTo, setBillShippingTo] = useState('shipper');
  const [billDutiesTo, setBillDutiesTo] = useState('shipper');

  const getCarrierCountryCode = (code: string) => code === 'XI' ? 'GB' : code;

  useEffect(() => {
    if (order && !fullNameInput) {
      setFullNameInput(`${order.customer_firstname} ${order.customer_lastname}`.trim());
    }
  }, [order, fullNameInput]);

  useEffect(() => {
    if (order && order.items && order.items.length > 0) {
      const fetchOptions = async () => {
        try {
          const client = new MagentoClient(
            credentials.magento.url,
            credentials.magento.token,
            credentials.general.proxyUrl
          );
          // Fetch options for attributes that might be dropdowns
          const codes = ['commodity_code', 'harmonized_system_code'];
          const optionsMap: Record<string, any[]> = {};
          
          for (const code of codes) {
            const options = await client.getAttributeOptions(code);
            optionsMap[code] = options;
          }
          
          setAttributeOptions(optionsMap);
        } catch (e) {
          console.error("Failed to fetch attribute options:", e);
        }
      };
      fetchOptions();
    }
  }, [order?.increment_id]);

  // Apply defaults
  useEffect(() => {
    if (order && credentials.shippingDefaults) {
      const destCountry = order.shipping_address?.country_id;
      const countryDefaults = credentials.countryDefaults?.[destCountry || ''];
      const defaults = countryDefaults || credentials.shippingDefaults;
      
      // Check if we should apply based on per-field overwrite or if empty
      const applyWeightKg = defaults.overwriteWeightKg || !weightKg;
      const applyWeightG = defaults.overwriteWeightG || !weightG;
      const applyLength = defaults.overwriteLength || !length;
      const applyWidth = defaults.overwriteWidth || !width;
      const applyHeight = defaults.overwriteHeight || !height;
      const applyBillShip = defaults.overwriteBillShippingTo || !billShippingTo;
      const applyBillDuty = defaults.overwriteBillDutiesTo || !billDutiesTo;

      if (applyWeightKg && defaults.weightKg) setWeightKg(defaults.weightKg);
      if (applyWeightG && defaults.weightG) setWeightG(defaults.weightG);
      if (applyLength && defaults.length) setLength(defaults.length);
      if (applyWidth && defaults.width) setWidth(defaults.width);
      if (applyHeight && defaults.height) setHeight(defaults.height);
      if (applyBillShip && defaults.billShippingTo) setBillShippingTo(defaults.billShippingTo);
      if (applyBillDuty && defaults.billDutiesTo) setBillDutiesTo(defaults.billDutiesTo);
    }
  }, [order, credentials.shippingDefaults, credentials.countryDefaults]);

  // Editing state
  const [isEditingCustomer, setIsEditingCustomer] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [isManualReady, setIsManualReady] = useState(false);

  // Sync weight when Kg or G changes
  useEffect(() => {
    const kg = parseFloat(weightKg) || 0;
    const g = parseFloat(weightG) || 0;
    const totalKg = kg + (g / 1000);
    setWeight(totalKg.toString());
  }, [weightKg, weightG]);

  const handleWeightKgChange = (val: string) => {
    setWeightKg(val);
  };

  const handleWeightKgBlur = () => {
    const mode = credentials.general.weightDisplayMode || 'both';
    const num = parseFloat(weightKg);
    if (!isNaN(num) && mode === 'both') {
      const kg = Math.floor(num);
      const remainder = num - kg;
      if (remainder > 0) {
        setWeightKg(kg.toString());
        setWeightG((Math.round(remainder * 1000)).toString());
      }
    }
  };

  const handleWeightGChange = (val: string) => {
    setWeightG(val);
  };

  const handleWeightGBlur = () => {
    const mode = credentials.general.weightDisplayMode || 'both';
    const num = parseFloat(weightG);
    if (!isNaN(num) && num >= 1000 && mode === 'both') {
      const extraKg = Math.floor(num / 1000);
      const remainingG = num % 1000;
      setWeightKg(extraKg.toString());
      setWeightG(isNaN(remainingG) ? '0' : Math.round(remainingG).toString());
    }
  };

  const handleValidateAddress = async () => {
    if (!order?.shipping_address || !credentials.fedex.enabled) return;
    
    setIsValidatingFedEx(true);
    setIsFedExValid('loading');
    
    try {
      const isDomestic = order.shipping_address.country_id === credentials.general.originCountry;
      const accountNumber = isDomestic 
        ? (credentials.fedex.domesticAccountNumber || credentials.fedex.accountNumber)
        : (credentials.fedex.globalAccountNumber || credentials.fedex.accountNumber);

      const fedex = new FedExClient(
        credentials.fedex.apiKey,
        credentials.fedex.secretKey,
        accountNumber,
        credentials.fedex.isSandbox,
        credentials.general.proxyUrl
      );

      const params = {
        addressesToValidate: [
          {
            address: {
              streetLines: order.shipping_address.street.filter(Boolean),
              city: order.shipping_address.city,
              stateOrProvinceCode: order.shipping_address.region,
              postalCode: order.shipping_address.postcode,
              countryCode: getCarrierCountryCode(order.shipping_address.country_id)
            }
          }
        ]
      };

      const result = await fedex.validateAddress(params);
      const addressResult = result?.output?.resolvedAddresses?.[0];
      
      if (addressResult && addressResult.classification !== 'UNDETERMINED' && !addressResult.attributes?.Resolved) {
         // Some rudimentary check or based on state
      }

      // FedEx resolve API returns results. If it found a match, it's usually valid.
      // Typical check is addressResult.attributes.Resolved === "true" or similar.
      // Let's check status.
      const isValid = addressResult && (addressResult.customerMessage?.toLowerCase().includes('success') || (addressResult.attributes && Object.keys(addressResult.attributes).length > 0));
      
      // More specifically, if addressResult.attributes.Resolved is true or similar.
      // For now, let's look at alerts.
      const hasAlerts = addressResult?.alerts?.some((a: any) => a.alertType === 'FAILURE' || a.alertType === 'ERROR');
      
      if (addressResult && !hasAlerts) {
        setIsFedExValid('valid');
        const isResidential = addressResult.classification === 'RESIDENTIAL';
        setRecommendedResidential(isResidential);
        if (order) {
          setOrder({
            ...order,
            shipping_address: {
              ...order.shipping_address,
              is_residential: isResidential
            }
          });
        }
      } else {
        setIsFedExValid('invalid');
      }
    } catch (e) {
      console.error("[FedEx Address Validation] Error:", e);
      setIsFedExValid('invalid');
    } finally {
      setIsValidatingFedEx(false);
    }
  };

  // Trigger validation when relevant address fields change
  useEffect(() => {
    if (order?.shipping_address) {
      const addr = order.shipping_address;
      if (addr.street.some(s => s.length > 5) && addr.city && addr.postcode && addr.country_id) {
        const timer = setTimeout(() => {
          handleValidateAddress();
        }, 1500);
        return () => clearTimeout(timer);
      }
    }
  }, [
    order?.shipping_address?.street,
    order?.shipping_address?.city,
    order?.shipping_address?.region,
    order?.shipping_address?.postcode,
    order?.shipping_address?.country_id
  ]);

  const ValidationIcon = ({ status }: { status: 'none' | 'loading' | 'valid' | 'invalid' }) => {
    if (status === 'loading') return <Loader2 className="animate-spin w-4 h-4 text-zinc-400" />;
    if (status === 'valid') return <CheckCircle2 className="w-4 h-4 text-green-600" />;
    if (status === 'invalid') return <X className="w-4 h-4 text-red-600" />;
    return <span className="text-zinc-400 font-bold">-</span>;
  };

  const clearPackageDetails = () => {
    setWeightKg('');
    setWeightG('');
    setLength('');
    setWidth('');
    setHeight('');
  };

  useEffect(() => {
    console.log(`[OrderDetails] Loading order ID: ${id}`);
    const fetchOrder = async () => {
      if (order || !id || id === 'manual') return;
      if (!credentials.magento.url || !credentials.magento.token) return;
      
      setIsLoading(true);
      setError(null);
      try {
        console.log(`[OrderDetails] Fetching order from Magento: ${credentials.magento.url}`);
        const client = new MagentoClient(
          credentials.magento.url,
          credentials.magento.token,
          credentials.general.proxyUrl
        );
        const fetchedOrder = await client.getOrder(id);
        console.log(`[OrderDetails] Order fetched successfully:`, fetchedOrder);
        setOrder(fetchedOrder);
      } catch (e: any) {
        console.error(`[OrderDetails] Error fetching order:`, e);
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
      if (!order || id === 'manual') return;
      
      // If order already has product details (from search or getOrder), use them
      if (order.product_details && Object.keys(order.product_details).length > 0) {
        console.log(`[OrderDetails] Using pre-loaded product details`);
        setProductDetails(order.product_details);
        return;
      }

      if (!credentials.magento.url || !credentials.magento.token) return;
      
      console.log(`[OrderDetails] Fetching product details for ${order.items.length} items`);
      setIsFetchingProducts(true);
      const client = new MagentoClient(
        credentials.magento.url,
        credentials.magento.token,
        credentials.general.proxyUrl
      );

      const details: Record<string, any> = {};
      try {
        const skus = order.items.map(item => item.sku);
        const products = await client.getProducts(skus);
        
        products.forEach(product => {
          details[product.sku] = product;
        });

        console.log(`[OrderDetails] Loaded details for ${products.length} products`);
        setProductDetails(details);
      } catch (e) {
        console.error("[OrderDetails] Failed to fetch product details:", e);
      } finally {
        setIsFetchingProducts(false);
      }
    };

    fetchProductInfo();
  }, [order, id, credentials.magento.url, credentials.magento.token, credentials.general.proxyUrl]);

  const fetchRates = async () => {
    if (!order) return;

    // Validation
    const errors = [];
    if (!order.customer_firstname && !order.customer_lastname) errors.push("Customer Name");
    if (!order.shipping_address?.street?.[0]) errors.push("Address Line 1");
    if (!order.shipping_address?.city) errors.push("City");
    if (!order.shipping_address?.postcode) errors.push("Postcode");
    if (!order.shipping_address?.country_id) errors.push("Country");
    
    const hasWeight = (weightKg && parseFloat(weightKg) > 0) || (weightG && parseFloat(weightG) > 0);
    if (!hasWeight) errors.push("Weight (KG or Grams)");
    
    if (!length || parseFloat(length) <= 0) errors.push("Length");
    if (!width || parseFloat(width) <= 0) errors.push("Width");
    if (!height || parseFloat(height) <= 0) errors.push("Height");

    if (errors.length > 0) {
      toast.error("Missing required fields", {
        description: `Please fill in: ${errors.join(", ")}`
      });
      return;
    }

    console.log(`[OrderDetails] Fetching live rates...`);
    setIsRating(true);
    setRates([]);
    
    try {
      const allRates: any[] = [];
      const weightVal = parseFloat(weight) || 0.1;
      const l = parseFloat(length) || 1;
      const w = parseFloat(width) || 1;
      const h = parseFloat(height) || 1;

      console.log(`[OrderDetails] Package: ${weightVal}kg, ${l}x${w}x${h}cm`);

      // 1. Fetch UPS Rates if credentials exist and enabled
      if (credentials.ups.enabled && credentials.ups.clientId && credentials.ups.clientSecret) {
        try {
          const destCountry = order.shipping_address?.country_id;
          const isDomestic = destCountry === credentials.general.originCountry;
          const accountNumber = isDomestic 
            ? (credentials.ups.domesticAccountNumber || credentials.ups.accountNumber)
            : (credentials.ups.globalAccountNumber || credentials.ups.accountNumber);

          console.log(`[OrderDetails] Calling UPS API (${isDomestic ? 'Domestic' : 'Global'})...`);
          const ups = new UPSClient(
            credentials.ups.clientId,
            credentials.ups.clientSecret,
            accountNumber,
            credentials.ups.isSandbox,
            credentials.general.proxyUrl
          );

          // Simplified UPS Rating Request
          const upsParams = {
            RateRequest: {
              Request: { 
                RequestOption: "Shop",
                TransactionReference: { CustomerContext: "Rating and Service" }
              },
              Shipment: {
                Shipper: {
                  Address: {
                    PostalCode: credentials.general.originPostalCode,
                    CountryCode: getCarrierCountryCode(credentials.general.originCountry)
                  }
                },
                ShipTo: {
                  Address: {
                    PostalCode: order.shipping_address.postcode,
                    CountryCode: getCarrierCountryCode(order.shipping_address.country_id),
                    ResidentialAddressIndicator: order.shipping_address.is_residential ? "" : undefined
                  }
                },
                PickupType: { Code: credentials.general.upsPickupType || "01" },
                DeliveryTimeInformation: { PackageBillType: "03" },
                ShipmentRatingOptions: { UserLevelDiscountIndicator: "TRUE" },
                Package: {
                  PackagingType: { Code: "02" },
                  Dimensions: {
                    UnitOfMeasurement: { Code: "CM" },
                    Length: Math.max(1, l).toString(),
                    Width: Math.max(1, w).toString(),
                    Height: Math.max(1, h).toString()
                  },
                  PackageWeight: {
                    UnitOfMeasurement: { Code: "KGS" },
                    Weight: weightVal.toString()
                  }
                }
              }
            }
          };

          const upsData = await ups.getRates(upsParams);
          if (upsData?.RateResponse?.RatedShipment) {
            const shipments = Array.isArray(upsData.RateResponse.RatedShipment) 
              ? upsData.RateResponse.RatedShipment 
              : [upsData.RateResponse.RatedShipment];
            
            shipments.forEach((s: any) => {
              let deliveryInfo = 'Live Rate';
              const arrivalDate = s.TimeInTransit?.ServiceSummary?.EstimatedArrival?.Arrival?.Date;
              const arrivalTime = s.TimeInTransit?.ServiceSummary?.EstimatedArrival?.Arrival?.Time;
              
              if (arrivalDate) {
                try {
                  // UPS date format is YYYYMMDD
                  const year = parseInt(arrivalDate.substring(0, 4));
                  const month = parseInt(arrivalDate.substring(4, 6)) - 1;
                  const day = parseInt(arrivalDate.substring(6, 8));
                  const date = new Date(year, month, day);
                  
                  if (arrivalTime) {
                    const hours = parseInt(arrivalTime.substring(0, 2));
                    const mins = parseInt(arrivalTime.substring(2, 4));
                    date.setHours(hours, mins);
                  }

                  const now = new Date();
                  const tomorrow = new Date();
                  tomorrow.setDate(now.getDate() + 1);
                  
                  if (date.toDateString() === tomorrow.toDateString()) {
                    const time = arrivalTime ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
                    deliveryInfo = `Tomorrow${time ? ` at ${time}` : ''}`;
                  } else if (date.toDateString() === now.toDateString()) {
                    deliveryInfo = 'Today';
                  } else {
                    deliveryInfo = date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
                  }
                } catch (e) {
                  deliveryInfo = arrivalDate;
                }
              }

              allRates.push({
                id: `ups-${s.Service.Code}`,
                carrier: 'UPS',
                service: `Service ${s.Service.Code}`,
                price: parseFloat(s.TotalCharges.MonetaryValue),
                delivery: deliveryInfo
              });
            });
          }
        } catch (e) {
          console.error("UPS Rate Error:", e);
        }
      }

      // 2. Fetch FedEx Rates if credentials exist and enabled
      if (credentials.fedex.enabled && credentials.fedex.apiKey && credentials.fedex.secretKey) {
        try {
          const destCountry = order.shipping_address.country_id;
          const isDomestic = destCountry === credentials.general.originCountry || 
                            (credentials.general.originCountry === 'GB' && destCountry === 'XI') ||
                            (credentials.general.originCountry === 'XI' && destCountry === 'GB');
          const accountNumber = isDomestic 
            ? (credentials.fedex.domesticAccountNumber || credentials.fedex.accountNumber)
            : (credentials.fedex.globalAccountNumber || credentials.fedex.accountNumber);
          
          console.log(`[OrderDetails] Calling FedEx API (${isDomestic ? 'Domestic' : 'Global'})...`);
          const fedex = new FedExClient(
            credentials.fedex.apiKey,
            credentials.fedex.secretKey,
            accountNumber,
            credentials.fedex.isSandbox,
            credentials.general.proxyUrl
          );

          const isInternational = credentials.general.originCountry !== order.shipping_address.country_id;

          const fedexParams: any = {
            accountNumber: { value: credentials.fedex.paymentAccountNumber || accountNumber },
            requestedShipment: {
              shipper: {
                address: {
                  streetLines: [
                    credentials.general.originStreet1,
                    credentials.general.originStreet2
                  ].filter(Boolean),
                  city: credentials.general.originCity,
                  stateOrProvinceCode: (credentials.general.originCountry === 'US' || credentials.general.originCountry === 'CA') ? credentials.general.originState : undefined,
                  postalCode: credentials.general.originPostalCode,
                  countryCode: getCarrierCountryCode(credentials.general.originCountry)
                },
                contact: {
                  personName: credentials.general.originContactName,
                  emailAddress: credentials.general.originEmail,
                  phoneNumber: credentials.general.originPhone,
                  companyName: credentials.general.originCompanyName
                }
              },
              recipient: {
                address: {
                  streetLines: order.shipping_address.street,
                  city: order.shipping_address.city,
                  stateOrProvinceCode: (order.shipping_address.country_id === 'US' || order.shipping_address.country_id === 'CA') ? order.shipping_address.region : undefined,
                  postalCode: order.shipping_address.postcode,
                  countryCode: getCarrierCountryCode(order.shipping_address.country_id),
                  residential: !!order.shipping_address.is_residential
                },
                contact: {
                  personName: `${order.shipping_address.firstname} ${order.shipping_address.lastname}`,
                  emailAddress: order.customer_email,
                  phoneNumber: order.shipping_address.telephone,
                  companyName: order.shipping_address.company || ''
                }
              },
              pickupType: credentials.general.fedexPickupType || "DROPOFF_AT_FEDEX_LOCATION",
              packagingType: "YOUR_PACKAGING",
              rateRequestType: ["ACCOUNT", "LIST"],
              shippingChargesPayment: {
                paymentType: "SENDER",
                payor: {
                  responsibleParty: {
                    accountNumber: { value: credentials.fedex.paymentAccountNumber || accountNumber }
                  }
                }
              },
              requestedPackageLineItems: [{
                weight: { units: "KG", value: weightVal },
                dimensions: { length: Math.max(1, l), width: Math.max(1, w), height: Math.max(1, h), units: "CM" },
                customerReferences: [
                  {
                    customerReferenceType: "CUSTOMER_REFERENCE",
                    value: order.increment_id
                  }
                ]
              }]
            }
          };

          if (isInternational) {
            const commodities = order.items.length > 0 
              ? order.items.map(item => ({
                  description: item.name,
                  countryOfManufacture: credentials.general.originCountry,
                  quantity: item.qty_ordered,
                  quantityUnits: "PCS",
                  unitPrice: {
                    amount: item.price,
                    currency: credentials.general.currency || "GBP"
                  },
                  customsValue: {
                    amount: item.price * item.qty_ordered,
                    currency: credentials.general.currency || "GBP"
                  },
                  weight: {
                    units: "KG",
                    value: item.weight || 0.1
                  }
                }))
              : [{
                  description: "Shipping Package",
                  countryOfManufacture: credentials.general.originCountry,
                  quantity: 1,
                  quantityUnits: "PCS",
                  unitPrice: {
                    amount: 1,
                    currency: credentials.general.currency || "GBP"
                  },
                  customsValue: {
                    amount: 1,
                    currency: credentials.general.currency || "GBP"
                  },
                  weight: {
                    units: "KG",
                    value: weightVal
                  }
                }];

            fedexParams.requestedShipment.customsClearanceDetail = {
              dutiesPayment: {
                paymentType: "SENDER",
                payor: {
                  responsibleParty: {
                    accountNumber: { value: credentials.fedex.paymentAccountNumber || accountNumber }
                  }
                }
              },
              commodities
            };
          }

          console.log("[FedExClient] Fetching rates", fedexParams);
          const fedexData = await fedex.getRates(fedexParams);
          
          if (fedexData?.errors && fedexData.errors.length > 0) {
            fedexData.errors.forEach((err: any) => {
              let description = err.message || "Service type not allowed or invalid package combination.";
              
              if (err.code === 'ACCOUNT.NUMBER.MISMATCH' || err.code === 'RATE.ACCOUNTNUMBER.MISMATCH') {
                const attemptedAccount = credentials.fedex.paymentAccountNumber || accountNumber;
                description = `Account Mismatch: The API Key (starting with ${credentials.fedex.apiKey.substring(0, 4)}) is not authorized for account ${attemptedAccount}. Please ensure your 'Domestic/Global Account Number' matches the one in your FedEx Developer Portal for this API Key.`;
              }

              toast.error(`FedEx Error: ${err.code}`, {
                description: description,
                duration: 10000,
              });
            });
          }

          if (fedexData?.output?.rateReplyDetails) {
            // Filter for UK/EU region services
            const allowedServices = [
              'FEDEX_INTERNATIONAL_PRIORITY_EXPRESS',
              'INTERNATIONAL_PRIORITY_FREIGHT',
              'FEDEX_INTERNATIONAL_PRIORITY',
              'FEDEX_INTERNATIONAL_CONNECT_PLUS',
              'INTERNATIONAL_ECONOMY',
              'INTERNATIONAL_ECONOMY_FREIGHT',
              'FEDEX_INTERNATIONAL_DEFERRED_FREIGHT',
              'INTERNATIONAL_FIRST',
              'INTERNATIONAL_PRIORITY_DISTRIBUTION',
              'INTERNATIONAL_DISTRIBUTION_FREIGHT',
              'INTERNATIONAL_ECONOMY_DISTRIBUTION',
              'FEDEX_REGIONAL_ECONOMY',
              'FEDEX_REGIONAL_ECONOMY_FREIGHT',
              'PRIORITY_OVERNIGHT',
              'FEDEX_FIRST',
              'FEDEX_PRIORITY_EXPRESS',
              'FEDEX_PRIORITY',
              'FEDEX_PRIORITY_EXPRESS_FREIGHT',
              'FEDEX_PRIORITY_FREIGHT',
              'FEDEX_ECONOMY_SELECT'
            ];
            
            fedexData.output.rateReplyDetails.forEach((r: any) => {
              const serviceCode = r.serviceType;
              const isAllowed = allowedServices.some(s => serviceCode.includes(s));
              
              if (isAllowed) {
                // Try to extract delivery date
                let deliveryInfo = 'Live Rate';
                const commitDate = r.commit?.dateDetail?.dayFormat;
                if (commitDate) {
                  try {
                    const date = new Date(commitDate);
                    const now = new Date();
                    const tomorrow = new Date();
                    tomorrow.setDate(now.getDate() + 1);
                    
                    if (date.toDateString() === tomorrow.toDateString()) {
                      const time = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                      deliveryInfo = `Tomorrow at ${time}`;
                    } else if (date.toDateString() === now.toDateString()) {
                      deliveryInfo = 'Today';
                    } else {
                      deliveryInfo = date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
                    }
                  } catch (e) {
                    deliveryInfo = commitDate;
                  }
                }

                allRates.push({
                  id: `fedex-${r.serviceType}`,
                  carrier: 'FedEx',
                  service: r.serviceName || r.serviceType,
                  price: r.ratedShipmentDetails?.[0]?.totalNetCharge || 0,
                  delivery: deliveryInfo
                });
              }
            });
          }
        } catch (e) {
          console.error("FedEx Rate Error:", e);
        }
      }

      // Update rates state
      setRates(allRates.sort((a, b) => a.price - b.price));
      
      if (allRates.length > 0) {
        toast.success("Fetched live rates from carriers.");
      } else {
        toast.error("No live rates returned from carriers.");
      }
    } catch (error) {
      toast.error("Failed to fetch rates. Check carrier credentials.");
    } finally {
      setIsRating(false);
    }
  };

  const handleCreateLabel = async () => {
    if (!selectedRate || !order) return;

    // Check address line lengths
    const street = order.shipping_address?.street || [];
    const tooLong = street.some(line => line.length > 35);
    if (tooLong) {
      const confirm = window.confirm("Warning: One or more address lines exceed 35 characters. This may cause issues with the carrier. Do you want to continue?");
      if (!confirm) return;
    }

    console.log(`[OrderDetails] Creating label for ${selectedRate.carrier} ${selectedRate.service}`);
    setIsShipping(true);
    
    try {
      let tracking = "";
      let labelBase64 = "";
      let labelUrl = ""; // Local variable to track URL before state update
      let labelType = "application/pdf";

      const weightVal = parseFloat(weightKg || "0") + (parseFloat(weightG || "0") / 1000);
      const isDomestic = order.shipping_address?.country_id === credentials.general.originCountry || 
                        (credentials.general.originCountry === 'GB' && order.shipping_address?.country_id === 'XI') ||
                        (credentials.general.originCountry === 'XI' && order.shipping_address?.country_id === 'GB');

      if (selectedRate.carrier === 'UPS') {
        const ups = new UPSClient(
          credentials.ups.clientId,
          credentials.ups.clientSecret,
          (isDomestic ? credentials.ups.domesticAccountNumber : credentials.ups.globalAccountNumber) || credentials.ups.accountNumber,
          credentials.ups.isSandbox,
          credentials.general.proxyUrl
        );

        // Map service name to code (simplified mapping)
        const serviceMap: Record<string, string> = {
          'Ground': '03',
          'Next Day Air': '01',
          '2nd Day Air': '02',
          'Standard': '11',
          'Worldwide Express': '07',
          'Worldwide Expedited': '08',
          'Worldwide Saver': '65',
        };
        const serviceCode = serviceMap[selectedRate.service] || '03';

        const upsParams: any = {
          ShipmentRequest: {
            Shipment: {
              Description: `Order #${order.increment_id}`,
              Shipper: {
                Name: credentials.general.originContactName,
                AttentionName: credentials.general.originContactName,
                Phone: { Number: credentials.general.originPhone },
                ShipperNumber: (isDomestic ? credentials.ups.domesticAccountNumber : credentials.ups.globalAccountNumber) || credentials.ups.accountNumber,
                Address: {
                  AddressLine: [credentials.general.originStreet1, credentials.general.originStreet2].filter(Boolean),
                  City: credentials.general.originCity,
                  StateProvinceCode: credentials.general.originState,
                  PostalCode: credentials.general.originPostalCode,
                  CountryCode: credentials.general.originCountry
                }
              },
              ShipTo: {
                Name: `${order.shipping_address?.firstname} ${order.shipping_address?.lastname}`,
                AttentionName: `${order.shipping_address?.firstname} ${order.shipping_address?.lastname}`,
                Phone: { Number: order.shipping_address?.telephone },
                Address: {
                  AddressLine: order.shipping_address?.street,
                  City: order.shipping_address?.city,
                  StateProvinceCode: order.shipping_address?.region,
                  PostalCode: order.shipping_address?.postcode,
                  CountryCode: order.shipping_address?.country_id,
                  ResidentialAddressIndicator: order.shipping_address?.is_residential ? "" : undefined
                }
              },
              PaymentInformation: {
                ShipmentCharge: {
                  Type: "01",
                  BillShipper: { AccountNumber: (isDomestic ? credentials.ups.domesticAccountNumber : credentials.ups.globalAccountNumber) || credentials.ups.accountNumber }
                }
              },
              Service: { Code: serviceCode },
              Package: [{
                Description: "Package",
                Packaging: { Code: "02" },
                Dimensions: {
                  UnitOfMeasurement: { Code: "CM" },
                  Length: length || "10",
                  Width: width || "10",
                  Height: height || "10"
                },
                PackageWeight: {
                  UnitOfMeasurement: { Code: "KGS" },
                  Weight: weightVal.toFixed(2)
                }
              }]
            },
            LabelSpecification: {
              LabelImageFormat: { Code: credentials.general.labelFormat || "PDF" },
              LabelStockSize: {
                Height: credentials.general.labelSize === '8.5x11' ? "11" : "6",
                Width: credentials.general.labelSize === '8.5x11' ? "8.5" : "4"
              },
              HTTPUserAgent: "Mozilla/4.5"
            }
          }
        };

        // Add International Forms if needed
        if (!isDomestic) {
          const totalValue = order.items.reduce((sum, item) => sum + (item.price * item.qty_ordered), 0);
          upsParams.ShipmentRequest.Shipment.ShipmentServiceOptions = {
            InternationalForms: {
              FormType: ["01"], // Commercial Invoice
              InvoiceNumber: order.increment_id,
              InvoiceDate: new Date().toISOString().split('T')[0].replace(/-/g, ''),
              ReasonForExport: "SALE",
              CurrencyCode: credentials.general.currency || "GBP",
              Product: order.items.map(item => {
                const product = productDetails[item.sku];
                const getAttr = (code: string) => {
                  const attr = product?.custom_attributes?.find((a: any) => a.attribute_code === code);
                  let val = attr?.value;
                  if (val === undefined && code === 'commodity_code') {
                    const htsAttr = product?.custom_attributes?.find((a: any) => 
                      ['hts_code', 'ts_hts_code', 'ts_commodity_code', 'hs_code', 'commodity_code'].includes(a.attribute_code)
                    );
                    val = htsAttr?.value;
                  }
                  return val || '';
                };
                
                return {
                  Description: item.name,
                  Unit: {
                    Number: item.qty_ordered.toString(),
                    Value: item.price.toString(),
                    UnitOfMeasurement: { Code: "PCS" }
                  },
                  CommodityCode: getAttr('commodity_code'),
                  OriginCountryCode: getAttr('country_of_manufacture') || credentials.general.originCountry
                };
              })
            }
          };
        }

        const upsData = await ups.createShipment(upsParams);
        if (upsData.ShipmentResponse?.Response?.ResponseStatus?.Code === "1") {
          tracking = upsData.ShipmentResponse.ShipmentResults.ShipmentIdentificationNumber;
          labelBase64 = upsData.ShipmentResponse.ShipmentResults.PackageResults[0].ShippingLabel.GraphicImage;
          labelType = credentials.general.labelFormat === 'ZPL' ? 'text/plain' : 'application/pdf';
        } else {
          const error = upsData.response?.errors?.[0] || upsData.ShipmentResponse?.Response?.Error || { Description: "Unknown UPS Error" };
          throw new Error(error.Description || error.message || "UPS Shipment Failed");
        }
      } else if (selectedRate.carrier === 'FedEx') {
        const accountNumber = isDomestic 
          ? (credentials.fedex.domesticAccountNumber || credentials.fedex.accountNumber)
          : (credentials.fedex.globalAccountNumber || credentials.fedex.accountNumber);

        const fedex = new FedExClient(
          credentials.fedex.apiKey,
          credentials.fedex.secretKey,
          accountNumber,
          credentials.fedex.isSandbox,
          credentials.general.proxyUrl
        );

        const fedexParams: any = {
          labelResponseOptions: "LABEL",
          accountNumber: { value: credentials.fedex.paymentAccountNumber || accountNumber },
          requestedShipment: {
            shipper: {
              contact: {
                personName: credentials.general.originContactName,
                phoneNumber: credentials.general.originPhone,
                companyName: credentials.general.originCompanyName
              },
              address: {
                streetLines: [credentials.general.originStreet1, credentials.general.originStreet2].filter(Boolean),
                city: credentials.general.originCity,
                stateOrProvinceCode: credentials.general.originState,
                postalCode: credentials.general.originPostalCode,
                countryCode: getCarrierCountryCode(credentials.general.originCountry)
              }
            },
            recipients: [{
              contact: {
                personName: `${order.shipping_address?.firstname} ${order.shipping_address?.lastname}`,
                phoneNumber: order.shipping_address?.telephone,
                companyName: order.shipping_address?.company
              },
              address: {
                streetLines: order.shipping_address?.street,
                city: order.shipping_address?.city,
                stateOrProvinceCode: order.shipping_address?.region,
                postalCode: order.shipping_address?.postcode,
                countryCode: getCarrierCountryCode(order.shipping_address?.country_id),
                residential: !!order.shipping_address?.is_residential
              }
            }],
            shipDatestamp: new Date().toISOString().split('T')[0],
            serviceType: selectedRate.id.replace('fedex-', ''),
            packagingType: "YOUR_PACKAGING",
            pickupType: credentials.general.fedexPickupType || "USE_SCHEDULED_PICKUP",
            shippingChargesPayment: {
              paymentType: "SENDER",
              payor: {
                responsibleParty: {
                  accountNumber: { value: credentials.fedex.paymentAccountNumber || accountNumber }
                }
              }
            },
            labelSpecification: {
              labelFormatType: "COMMON2D",
              imageType: credentials.general.labelFormat === 'ZPL' ? 'ZPLII' : (credentials.general.labelFormat || "PDF"),
              labelStockType: credentials.general.labelSize === '8.5x11' ? "PAPER_LETTER" : "STOCK_4X6",
              labelPrintingOrientation: "TOP_EDGE_OF_TEXT_FIRST",
              labelRotation: "NONE"
            },
            requestedPackageLineItems: [{
              weight: { units: "KG", value: weightVal },
              dimensions: { length: length || 10, width: width || 10, height: height || 10, units: "CM" }
            }]
          }
        };

        // Add International Customs if needed
        if (!isDomestic) {
          fedexParams.requestedShipment.customsClearanceDetail = {
            dutiesPayment: {
              paymentType: billDutiesTo === 'recipient' ? "RECIPIENT" : "SENDER",
              payor: {
                responsibleParty: {
                  accountNumber: { value: credentials.fedex.paymentAccountNumber || accountNumber }
                }
              }
            },
            commodities: order.items.map(item => {
              const product = productDetails[item.sku];
              const getAttr = (code: string) => {
                const attr = product?.custom_attributes?.find((a: any) => a.attribute_code === code);
                let val = attr?.value;
                if (val === undefined && code === 'commodity_code') {
                  const htsAttr = product?.custom_attributes?.find((a: any) => 
                    ['hts_code', 'ts_hts_code', 'ts_commodity_code', 'hs_code', 'commodity_code'].includes(a.attribute_code)
                  );
                  val = htsAttr?.value;
                }
                return val || '';
              };
              
              return {
                description: item.name,
                countryOfManufacture: getAttr('country_of_manufacture') || credentials.general.originCountry,
                harmonizedCode: getAttr('commodity_code'),
                quantity: item.qty_ordered,
                quantityUnits: "PCS",
                unitPrice: { amount: item.price, currency: credentials.general.currency || "GBP" },
                customsValue: { amount: item.price * item.qty_ordered, currency: credentials.general.currency || "GBP" },
                weight: { units: "KG", value: item.weight || 0.1 }
              };
            })
          };
        }

        console.log("[FedExClient] Creating shipment", fedexParams);
        const fedexData = await fedex.createShipment(fedexParams);
        labelType = credentials.general.labelFormat === 'ZPL' ? 'text/plain' : 'application/pdf';
        
        if (fedexData.output?.transactionShipments?.[0]) {
          const ship = fedexData.output.transactionShipments[0];
          tracking = ship.masterTrackingNumber;
          
          // Check multiple locations for the label
          const doc = ship.pieceResponses?.[0]?.packageDocuments?.[0] || ship.shipmentDocuments?.[0];
          
          if (doc?.encodedLabel) {
            labelBase64 = doc.encodedLabel;
          } else if (doc?.url) {
            labelUrl = doc.url;
            setLabelUrl(doc.url);
          }
        } else {
          const error = fedexData.errors?.[0] || { message: "FedEx Shipment Failed" };
          throw new Error(error.message);
        }
      }

      if (tracking) {
        setTrackingNumber(tracking);
        
        // Helper to convert base64 to blob
        const b64ToBlob = (b64: string, type: string) => {
          const binStr = atob(b64);
          const len = binStr.length;
          const arr = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            arr[i] = binStr.charCodeAt(i);
          }
          return new Blob([arr], { type });
        };

        if (labelBase64) {
          try {
            console.log(`[OrderDetails] Creating blob from base64 label (${labelType})`);
            const blob = b64ToBlob(labelBase64, labelType);
            setLabelUrl(URL.createObjectURL(blob));
          } catch (e) {
            console.error("[OrderDetails] Error creating label blob:", e);
            toast.error("Label generated but failed to display. You can still find it in your carrier portal.");
          }
        } else if (labelUrl) {
          // If we only have a URL and it's FedEx (which often blocks iframes), try to fetch it via proxy
          if (selectedRate.carrier === 'FedEx') {
            try {
              console.log(`[OrderDetails] Fetching FedEx label via proxy: ${labelUrl}`);
              const cleanProxyUrl = credentials.general.proxyUrl ? (credentials.general.proxyUrl.endsWith('/') ? credentials.general.proxyUrl : `${credentials.general.proxyUrl}/`) : '';
              const response = await fetch(`${cleanProxyUrl}${labelUrl}`);
              if (response.ok) {
                const blob = await response.blob();
                // Ensure the blob has the correct type
                const typedBlob = new Blob([blob], { type: labelType });
                setLabelUrl(URL.createObjectURL(typedBlob));
                console.log(`[OrderDetails] FedEx label fetched and blob created`);
              }
            } catch (e) {
              console.error("[OrderDetails] Failed to fetch FedEx label via proxy:", e);
              // Fallback to the original URL (though it might be blocked by X-Frame-Options)
            }
          }
        }

        // 2. Update Magento Shipment Status (if enabled)
        if (credentials.general.markAsShipped && id !== 'manual') {
          try {
            console.log(`[OrderDetails] Updating Magento shipment status...`);
            const client = new MagentoClient(
              credentials.magento.url,
              credentials.magento.token,
              credentials.general.proxyUrl
            );

            const carrierTitle = selectedRate.carrier === 'UPS' ? 'United Parcel Service' : 'Federal Express';
            const carrierCode = selectedRate.carrier.toLowerCase();

            await client.createShipment(order.entity_id, [{
              track_number: tracking,
              title: carrierTitle,
              carrier_code: carrierCode
            }]);
            console.log(`[OrderDetails] Magento updated successfully`);
          } catch (magentoError: any) {
            console.error(`[OrderDetails] Magento update failed:`, magentoError);
            toast.warning("Label created, but failed to update Magento status. You may need to mark it as shipped manually.", {
              description: magentoError.message,
              duration: 8000
            });
          }
        }
        
        toast.success(`Label created! Tracking: ${tracking}`);

        // Auto-open label viewer if enabled
        if (credentials.general.autoOpenLabel) {
          setIsLabelViewerOpen(true);
        }
      }
    } catch (error: any) {
      console.error(`[OrderDetails] Error in handleCreateLabel:`, error);
      toast.error(error.message || "Failed to create label. Check carrier logs.");
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

  const isManual = id === 'manual';
  if (isManual && !isManualReady) {
    const isComplete = !!(
      (order.customer_firstname || order.customer_lastname) && 
      order.shipping_address?.street?.[0] && 
      order.shipping_address?.city && 
      order.shipping_address?.postcode
    );

    return (
      <div className="max-w-[630px] mx-auto space-y-8">
        <header className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft size={20} />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-zinc-900">Manual Shipment</h1>
            <p className="text-zinc-500">Please provide the recipient's information to continue.</p>
          </div>
        </header>

        <Card>
          <CardHeader>
            <CardTitle>Customer & Shipping Information</CardTitle>
            <CardDescription>All fields marked with * are required.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Full Name <span className="text-red-500">*</span></Label>
              <Input 
                value={fullNameInput} 
                onChange={(e) => {
                  const val = e.target.value;
                  setFullNameInput(val);
                  const parts = val.trim().split(' ');
                  const first = parts[0] || '';
                  const last = parts.slice(1).join(' ') || '';
                  setOrder({
                    ...order, 
                    customer_firstname: first,
                    customer_lastname: last,
                    shipping_address: { ...order.shipping_address!, firstname: first, lastname: last }
                  });
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
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
            </div>
            <div className="space-y-2">
              <Label>Company</Label>
              <Input 
                value={order.shipping_address?.company || ''} 
                onChange={(e) => setOrder({
                  ...order, 
                  shipping_address: { ...order.shipping_address!, company: e.target.value }
                })}
              />
            </div>
            <div className="space-y-2">
              <Label className="flex justify-between">
                Address Line 1 <span className="text-red-500">*</span>
                {(order.shipping_address?.street?.[0]?.length || 0) > 35 && (
                  <span className="text-[10px] text-red-500 font-bold">EXCEEDS 35 CHARS</span>
                )}
              </Label>
              <Input 
                value={order.shipping_address?.street?.[0] || ''} 
                onChange={(e) => {
                  const street = [...(order.shipping_address?.street || [])];
                  street[0] = e.target.value;
                  setOrder({ ...order, shipping_address: { ...order.shipping_address!, street } });
                }}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex justify-between">
                  Address Line 2
                  {(order.shipping_address?.street?.[1]?.length || 0) > 35 && (
                    <span className="text-[10px] text-red-500 font-bold">EXCEEDS 35 CHARS</span>
                  )}
                </Label>
                <Input 
                  value={order.shipping_address?.street?.[1] || ''} 
                  onChange={(e) => {
                    const street = [...(order.shipping_address?.street || [])];
                    street[1] = e.target.value;
                    setOrder({ ...order, shipping_address: { ...order.shipping_address!, street } });
                  }}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex justify-between">
                  Address Line 3
                  {(order.shipping_address?.street?.[2]?.length || 0) > 35 && (
                    <span className="text-[10px] text-red-500 font-bold">EXCEEDS 35 CHARS</span>
                  )}
                </Label>
                <Input 
                  value={order.shipping_address?.street?.[2] || ''} 
                  onChange={(e) => {
                    const street = [...(order.shipping_address?.street || [])];
                    street[2] = e.target.value;
                    setOrder({ ...order, shipping_address: { ...order.shipping_address!, street } });
                  }}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>City <span className="text-red-500">*</span></Label>
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
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Postcode <span className="text-red-500">*</span></Label>
                <Input 
                  value={order.shipping_address?.postcode || ''} 
                  onChange={(e) => setOrder({
                    ...order, 
                    shipping_address: { ...order.shipping_address!, postcode: e.target.value }
                  })}
                />
              </div>
              <div className="space-y-2">
                <Label>Country <span className="text-red-500">*</span></Label>
                <Select 
                  value={order.shipping_address?.country_id}
                  onValueChange={(v) => setOrder({
                    ...order,
                    shipping_address: { ...order.shipping_address!, country_id: v }
                  })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select country">
                      {COUNTRY_NAMES[order.shipping_address?.country_id || ''] || order.shipping_address?.country_id}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(COUNTRY_NAMES).map(([code, name]) => (
                      <SelectItem key={code} value={code}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex gap-4 p-4 bg-zinc-50 border rounded-lg items-center h-[58px]">
              <div className="flex-1 flex items-center relative">
                <Button
                  type="button"
                  variant={order.shipping_address?.is_residential ? "default" : "outline"}
                  size="sm"
                  className={`h-7 w-full text-[9px] font-bold uppercase tracking-wider transition-all rounded-md ${
                    order.shipping_address?.is_residential 
                      ? "bg-zinc-900 text-white shadow-inner" 
                      : "bg-white text-zinc-500 border-zinc-200"
                  }`}
                  onClick={() => setOrder({
                    ...order,
                    shipping_address: { ...order.shipping_address!, is_residential: !order.shipping_address?.is_residential }
                  })}
                >
                  {order.shipping_address?.is_residential ? 'Residential' : 'Business'}
                </Button>
                {recommendedResidential !== null && order.shipping_address?.is_residential !== recommendedResidential && (
                  <div className="absolute top-[110%] left-0 right-0 flex justify-center">
                    <p className="text-[9px] text-zinc-400 whitespace-nowrap italic leading-none">
                      Changed From Suggested
                    </p>
                  </div>
                )}
              </div>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex-1 flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-600">FedEx Validation</span>
                <div className="w-6 h-6 flex items-center justify-center border rounded bg-white">
                  <ValidationIcon status={isFedExValid} />
                </div>
              </div>
              <Separator orientation="vertical" className="h-6" />
              <div className="flex-1 flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-600">UPS Validation</span>
                <div className="w-6 h-6 flex items-center justify-center border rounded bg-white">
                  <ValidationIcon status={isUPSValid} />
                </div>
              </div>
            </div>

            <Button 
              className="w-full bg-zinc-900 hover:bg-zinc-800" 
              disabled={!isComplete}
              onClick={() => setIsManualReady(true)}
            >
              Continue to Shipping
            </Button>
          </CardContent>
        </Card>
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
                <h1 className="text-3xl font-bold text-zinc-900">
                  {id === 'manual' ? 'Manual Shipment' : `Order #${order.increment_id}`}
                </h1>
                <p className="text-zinc-500">
                  {id === 'manual' ? 'Create a shipment manually' : 'Imported from Magento'}
                </p>
              </div>
            </div>
            <Badge className="bg-zinc-900 text-white px-3 py-1 text-sm">
              {id === 'manual' ? 'Draft' : order.status}
            </Badge>
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
                <DialogContent className="max-w-[630px]">
                  <DialogHeader>
                    <DialogTitle>Edit Customer & Shipping Info</DialogTitle>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="space-y-2">
                      <Label>Full Name <span className="text-red-500">*</span></Label>
                      <Input 
                        value={fullNameInput} 
                        onChange={(e) => {
                          const val = e.target.value;
                          setFullNameInput(val);
                          const parts = val.trim().split(' ');
                          const first = parts[0] || '';
                          const last = parts.slice(1).join(' ') || '';
                          setOrder({
                            ...order, 
                            customer_firstname: first, 
                            customer_lastname: last,
                            shipping_address: {
                              ...order.shipping_address!,
                              firstname: first,
                              lastname: last
                            }
                          });
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Company</Label>
                      <Input 
                        value={order.shipping_address?.company || ''} 
                        onChange={(e) => setOrder({
                          ...order, 
                          shipping_address: { ...order.shipping_address!, company: e.target.value }
                        })}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
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
                    </div>
                    <div className="space-y-2">
                      <Label className="flex justify-between">
                        Address Line 1 <span className="text-red-500">*</span>
                        {(order.shipping_address?.street?.[0]?.length || 0) > 35 && (
                          <span className="text-[10px] text-red-500 font-bold">EXCEEDS 35 CHARS</span>
                        )}
                      </Label>
                      <Input 
                        value={order.shipping_address?.street?.[0] || ''} 
                        onChange={(e) => {
                          const street = [...(order.shipping_address?.street || [])];
                          street[0] = e.target.value;
                          setOrder({ ...order, shipping_address: { ...order.shipping_address!, street } });
                        }}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="flex justify-between">
                          Address Line 2
                          {(order.shipping_address?.street?.[1]?.length || 0) > 35 && (
                            <span className="text-[10px] text-red-500 font-bold">EXCEEDS 35 CHARS</span>
                          )}
                        </Label>
                        <Input 
                          value={order.shipping_address?.street?.[1] || ''} 
                          onChange={(e) => {
                            const street = [...(order.shipping_address?.street || [])];
                            street[1] = e.target.value;
                            setOrder({ ...order, shipping_address: { ...order.shipping_address!, street } });
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="flex justify-between">
                          Address Line 3
                          {(order.shipping_address?.street?.[2]?.length || 0) > 35 && (
                            <span className="text-[10px] text-red-500 font-bold">EXCEEDS 35 CHARS</span>
                          )}
                        </Label>
                        <Input 
                          value={order.shipping_address?.street?.[2] || ''} 
                          onChange={(e) => {
                            const street = [...(order.shipping_address?.street || [])];
                            street[2] = e.target.value;
                            setOrder({ ...order, shipping_address: { ...order.shipping_address!, street } });
                          }}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>City <span className="text-red-500">*</span></Label>
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
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Postcode <span className="text-red-500">*</span></Label>
                        <Input 
                          value={order.shipping_address?.postcode || ''} 
                          onChange={(e) => setOrder({
                            ...order, 
                            shipping_address: { ...order.shipping_address!, postcode: e.target.value }
                          })}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Country <span className="text-red-500">*</span></Label>
                        <Select 
                          value={order.shipping_address?.country_id}
                          onValueChange={(v) => setOrder({
                            ...order,
                            shipping_address: { ...order.shipping_address!, country_id: v }
                          })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select country">
                              {COUNTRY_NAMES[order.shipping_address?.country_id || ''] || order.shipping_address?.country_id}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(COUNTRY_NAMES).map(([code, name]) => (
                              <SelectItem key={code} value={code}>{name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="flex gap-4 p-4 bg-zinc-50 border rounded-lg mt-4 items-center h-[58px]">
                      <div className="flex-1 flex items-center gap-2">
                        <Button
                          type="button"
                          variant={order.shipping_address?.is_residential ? "default" : "outline"}
                          size="sm"
                          className={`h-7 w-full text-[9px] font-bold uppercase tracking-wider transition-all rounded-md ${
                            order.shipping_address?.is_residential 
                              ? "bg-zinc-900 text-white shadow-inner" 
                              : "bg-white text-zinc-500 border-zinc-200"
                          }`}
                          onClick={() => setOrder({
                            ...order,
                            shipping_address: { ...order.shipping_address!, is_residential: !order.shipping_address?.is_residential }
                          })}
                        >
                          {order.shipping_address?.is_residential ? 'Residential' : 'Business'}
                        </Button>
                      </div>
                      <Separator orientation="vertical" className="h-6" />
                      <div className="flex-1 flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-600">FedEx Valid</span>
                        <div className="w-6 h-6 flex items-center justify-center border rounded bg-white">
                          <ValidationIcon status={isFedExValid} />
                        </div>
                      </div>
                      <Separator orientation="vertical" className="h-6" />
                      <div className="flex-1 flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-600">UPS Valid</span>
                        <div className="w-6 h-6 flex items-center justify-center border rounded bg-white">
                          <ValidationIcon status={isUPSValid} />
                        </div>
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
                {order.shipping_address?.company && <p className="text-zinc-700 font-medium">{order.shipping_address.company}</p>}
                <p className="text-zinc-600">{order.customer_email}</p>
                <p className="text-zinc-600">{order.shipping_address?.telephone || 'No phone number'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-zinc-500 uppercase tracking-wider">Shipping Address</p>
                <p className="font-bold text-lg">{order.shipping_address?.street?.join(', ') || 'No street address'}</p>
                <p className="text-zinc-600">
                  {order.shipping_address?.city}, {order.shipping_address?.region} {order.shipping_address?.postcode}
                </p>
                <p className="text-zinc-600">
                  {COUNTRY_NAMES[order.shipping_address?.country_id || ''] || order.shipping_address?.country_id}
                </p>
              </div>

              <div className="col-span-2 flex gap-4 p-4 bg-zinc-50 border rounded-lg items-center h-[58px]">
                <div className="flex-1 flex items-center gap-2">
                  <Button
                    type="button"
                    variant={order.shipping_address?.is_residential ? "default" : "outline"}
                    size="sm"
                    className={`h-7 w-full text-[9px] font-bold uppercase tracking-wider transition-all rounded-md ${
                      order.shipping_address?.is_residential 
                        ? "bg-zinc-900 text-white shadow-inner" 
                        : "bg-white text-zinc-500 border-zinc-200"
                    }`}
                    onClick={() => setOrder({
                      ...order,
                      shipping_address: { ...order.shipping_address!, is_residential: !order.shipping_address?.is_residential }
                    })}
                  >
                    {order.shipping_address?.is_residential ? 'Residential' : 'Business'}
                  </Button>
                </div>
                <Separator orientation="vertical" className="h-6" />
                <div className="flex-1 flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-600">FedEx Valid</span>
                  <div className="w-6 h-6 flex items-center justify-center border rounded bg-white">
                    <ValidationIcon status={isFedExValid} />
                  </div>
                </div>
                <Separator orientation="vertical" className="h-6" />
                <div className="flex-1 flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-600">UPS Valid</span>
                  <div className="w-6 h-6 flex items-center justify-center border rounded bg-white">
                    <ValidationIcon status={isUPSValid} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Package size={20} /> Order Items
              </CardTitle>
              {id === 'manual' && (
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => {
                    const newItem = {
                      name: 'Manual Item',
                      sku: `MAN-${Date.now()}`,
                      qty_ordered: 1,
                      price: 0,
                      weight: 0.1
                    };
                    setOrder({ ...order, items: [...order.items, newItem] });
                  }}
                >
                  Add Item
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-center">Qty</TableHead>
                    <TableHead className="text-left">Customs</TableHead>
                    <TableHead className="text-right">Price</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(() => {
                    const currencySymbol = credentials.general.currency === 'GBP' ? '£' : credentials.general.currency === 'EUR' ? '€' : '$';
                    const items = order.items || [];
                    const orderTotal = items.reduce((sum, item) => sum + (item.price * item.qty_ordered), 0);
                    
                    return (
                      <>
                        {items.map((item, idx) => {
                          const product = productDetails[item.sku];
                    
                    // Helper to get attribute value or label
                    const getAttr = (code: string) => {
                      if (!product) return 'N/A';
                      
                      // Try custom_attributes first
                      const attr = product.custom_attributes?.find((a: any) => a.attribute_code === code);
                      let val = attr?.value;
                      
                      // Fallback for HTS/Commodity codes
                      if (val === undefined && code === 'commodity_code') {
                        const htsAttr = product.custom_attributes?.find((a: any) => 
                          ['hts_code', 'ts_hts_code', 'ts_commodity_code', 'hs_code', 'commodity_code', 'harmonized_system_code'].includes(a.attribute_code)
                        );
                        val = htsAttr?.value;
                      }
                      
                      // Fallback to top-level property
                      if (val === undefined && product[code] !== undefined) {
                        val = product[code];
                      }
                      
                      if (val === undefined || val === null) return 'N/A';
                      
                      // If it's a dropdown/select, try to find the label
                      const options = attributeOptions[code] || [];
                      if (options.length > 0) {
                        const option = options.find(o => String(o.value) === String(val));
                        if (option && option.label) {
                          return option.label;
                        }
                      }
                      
                      // If it's a country code, try to map to full name
                      if (code === 'country_of_manufacture' && String(val).length === 2) {
                        return COUNTRY_NAMES[String(val)] || String(val);
                      }
                      
                      return String(val);
                    };

                    const htsCode = getAttr('commodity_code');
                    const hscCode = getAttr('harmonized_system_code');
                    const coo = getAttr('country_of_manufacture');
                    const itemTotal = item.price * item.qty_ordered;

                    const truncatedName = item.name.length > 25 ? item.name.substring(0, 25) + '...' : item.name;

                    return (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">
                          <div title={item.name}>
                            <p>{truncatedName}</p>
                            <p className="text-zinc-500 font-mono text-[10px]">{item.sku}</p>
                            <p className="text-zinc-400 text-[9px] mt-1">Weight: {product?.weight || item.weight || '0.00'} kg</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">{item.qty_ordered}</TableCell>
                        <TableCell className="text-left">
                          <div className="text-xs">
                            <p><span className="text-zinc-400">HTS:</span> {htsCode}</p>
                            {hscCode !== 'N/A' && <p><span className="text-zinc-400">HSC:</span> {hscCode}</p>}
                            <p><span className="text-zinc-400">COO:</span> {coo}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          {currencySymbol}{item.price.toFixed(2)}
                        </TableCell>
                        <TableCell className="text-right font-bold">
                          {currencySymbol}{itemTotal.toFixed(2)}
                        </TableCell>
                        <TableCell className="flex gap-1">
                          <Dialog open={editingItem?.sku === item.sku} onOpenChange={(open) => !open && setEditingItem(null)}>
                            <DialogTrigger
                              render={
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setEditingItem(item)}>
                                  <Pencil size={14} />
                                </Button>
                              }
                            />
                            <DialogContent className="max-w-[630px]">
                              <DialogHeader>
                                <DialogTitle>Edit Item: {item.name}</DialogTitle>
                              </DialogHeader>
                              <div className="grid gap-4 py-4">
                                <div className="space-y-2">
                                  <Label>Item Name</Label>
                                  <Input 
                                    value={item.name} 
                                    onChange={(e) => {
                                      const newItems = [...order.items];
                                      newItems[idx] = { ...item, name: e.target.value };
                                      setOrder({ ...order, items: newItems });
                                    }}
                                  />
                                </div>
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
                                    <Label>Commodity Code</Label>
                                    <Input 
                                      value={htsCode} 
                                      onChange={(e) => {
                                        const newProductDetails = { ...productDetails };
                                        const product = { ...newProductDetails[item.sku] };
                                        if (!product.sku) product.sku = item.sku;
                                        const attrs = [...(product.custom_attributes || [])];
                                        
                                        // Find any existing HTS-related attribute
                                        const htsCodes = ['commodity_code', 'hts_code', 'ts_hts_code', 'ts_commodity_code', 'hs_code'];
                                        const htsIdx = attrs.findIndex(a => htsCodes.includes(a.attribute_code));
                                        
                                        if (htsIdx > -1) {
                                          attrs[htsIdx] = { ...attrs[htsIdx], value: e.target.value };
                                        } else {
                                          attrs.push({ attribute_code: 'commodity_code', value: e.target.value });
                                        }
                                        
                                        product.custom_attributes = attrs;
                                        newProductDetails[item.sku] = product;
                                        setProductDetails(newProductDetails);
                                      }}
                                    />
                                  </div>
                                  <div className="space-y-2">
                                    <Label>HSC</Label>
                                    <Input 
                                      value={hscCode} 
                                      onChange={(e) => {
                                        const newProductDetails = { ...productDetails };
                                        const product = { ...newProductDetails[item.sku] };
                                        if (!product.sku) product.sku = item.sku;
                                        const attrs = [...(product.custom_attributes || [])];
                                        const hscIdx = attrs.findIndex(a => a.attribute_code === 'harmonized_system_code');
                                        if (hscIdx > -1) attrs[hscIdx] = { ...attrs[hscIdx], value: e.target.value };
                                        else attrs.push({ attribute_code: 'harmonized_system_code', value: e.target.value });
                                        product.custom_attributes = attrs;
                                        newProductDetails[item.sku] = product;
                                        setProductDetails(newProductDetails);
                                      }}
                                    />
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  <Label>Country of Origin</Label>
                                  <Input 
                                    value={coo} 
                                    onChange={(e) => {
                                      const newProductDetails = { ...productDetails };
                                      const product = { ...newProductDetails[item.sku] };
                                      if (!product.sku) product.sku = item.sku;
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
                                <div className="space-y-2">
                                  <Label>Weight (kg)</Label>
                                  <Input 
                                    type="number"
                                    step="0.01"
                                    value={product?.weight || item.weight || ''} 
                                    onChange={(e) => {
                                      const newWeight = parseFloat(e.target.value) || 0;
                                      const newProductDetails = { ...productDetails };
                                      const product = { ...newProductDetails[item.sku] };
                                      if (!product.sku) product.sku = item.sku;
                                      product.weight = newWeight;
                                      newProductDetails[item.sku] = product;
                                      setProductDetails(newProductDetails);
                                      
                                      // Also update the item weight in the order if it's a manual order or for consistency
                                      const newItems = [...order.items];
                                      newItems[idx] = { ...item, weight: newWeight };
                                      setOrder({ ...order, items: newItems });
                                    }}
                                  />
                                </div>
                              </div>
                              <DialogFooter>
                                <Button onClick={() => setEditingItem(null)}>Done</Button>
                              </DialogFooter>
                            </DialogContent>
                          </Dialog>
                          {id === 'manual' && (
                            <Button 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50" 
                              onClick={() => {
                                const newItems = order.items.filter((_, i) => i !== idx);
                                setOrder({ ...order, items: newItems });
                              }}
                            >
                              <X size={14} />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  <TableRow className="bg-zinc-50/50">
                    <TableCell colSpan={4} className="text-right font-medium text-zinc-500 py-4">
                      Order Total
                    </TableCell>
                    <TableCell className="text-right font-bold text-lg text-zinc-900 py-4">
                      {credentials.general.currency === 'GBP' ? '£' : credentials.general.currency === 'EUR' ? '€' : '$'}{(order.items || []).reduce((sum, item) => sum + (item.price * item.qty_ordered), 0).toFixed(2)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </>
              );
            })()}
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
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase text-zinc-500">Weight <span className="text-red-500">*</span></Label>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={() => { setWeightKg(''); setWeightG(''); }}>
                      <RotateCcw size={10} /> Clear Weight
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {(credentials.general.weightDisplayMode === 'both' || credentials.general.weightDisplayMode === 'kg') && (
                      <div className="space-y-2">

                        <Label htmlFor="weightKg">Kilograms</Label>
                        <Input 
                          id="weightKg" 
                          type="number" 
                          step="0.1"
                          placeholder="0"
                          value={weightKg} 
                          onChange={(e) => handleWeightKgChange(e.target.value)}
                          onBlur={handleWeightKgBlur}
                        />
                      </div>
                    )}
                    {(credentials.general.weightDisplayMode === 'both' || credentials.general.weightDisplayMode === 'grams') && (
                      <div className="space-y-2">
                        <Label htmlFor="weightG">Grams</Label>
                        <Input 
                          id="weightG" 
                          type="number" 
                          placeholder="0"
                          value={weightG} 
                          onChange={(e) => handleWeightGChange(e.target.value)}
                          onBlur={handleWeightGBlur}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold uppercase text-zinc-500">Dimensions (cm) <span className="text-red-500">*</span></Label>
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] gap-1" onClick={() => { setLength(''); setWidth(''); setHeight(''); }}>
                      <RotateCcw size={10} /> Clear Dims
                    </Button>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="length">Length</Label>
                      <Input 
                        id="length" 
                        type="number" 
                        placeholder="0"
                        value={length} 
                        onChange={(e) => setLength(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="width">Width</Label>
                      <Input 
                        id="width" 
                        type="number" 
                        placeholder="0"
                        value={width} 
                        onChange={(e) => setWidth(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="height">Height</Label>
                      <Input 
                        id="height" 
                        type="number" 
                        placeholder="0"
                        value={height} 
                        onChange={(e) => setHeight(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <Label className="text-xs font-bold uppercase text-zinc-500">Billing Options</Label>
                  <div className="grid grid-cols-1 gap-4">
                    <div className="space-y-2">
                      <Label>Bill Shipping Charges To</Label>
                      <Select value={billShippingTo} onValueChange={setBillShippingTo}>
                        <SelectTrigger className="text-xs h-8">
                          <SelectValue placeholder="Select billing">
                            {billShippingTo === 'shipper' ? 'Shipper' : billShippingTo === 'recipient' ? 'Recipient' : 'Third Party'}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="shipper">Shipper</SelectItem>
                          <SelectItem value="recipient">Recipient</SelectItem>
                          <SelectItem value="third_party">Third Party</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {(credentials.general.alwaysShowDuties || credentials.general.originCountry !== order.shipping_address?.country_id) && (
                      <div className="space-y-2">
                        <Label>Bill Duties/Taxes To</Label>
                        <Select value={billDutiesTo} onValueChange={setBillDutiesTo}>
                          <SelectTrigger className="text-xs h-8">
                            <SelectValue placeholder="Select billing">
                              {billDutiesTo === 'shipper' ? 'Shipper (DDP)' : billDutiesTo === 'recipient' ? 'Recipient (DAP)' : 'Third Party'}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="shipper">Shipper (DDP)</SelectItem>
                            <SelectItem value="recipient">Recipient (DAP)</SelectItem>
                            <SelectItem value="third_party">Third Party</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
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

              <div className="space-y-4">
                {selectedRate && !labelUrl && (
                  <Button 
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    disabled={isShipping}
                    onClick={handleCreateLabel}
                  >
                    {isShipping ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                    Create Label
                  </Button>
                )}

                {labelUrl && (
                  <div className="space-y-4">
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-800 text-sm space-y-2">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        <span className="font-bold">
                          {credentials.general.markAsShipped && id !== 'manual' 
                            ? "Label generated & Magento Updated!" 
                            : "Label generated successfully!"}
                        </span>
                      </div>
                      {trackingNumber && (
                        <div className="pl-8 font-mono text-xs">
                          Tracking: {trackingNumber}
                        </div>
                      )}
                    </div>
                    <Dialog open={isLabelViewerOpen} onOpenChange={setIsLabelViewerOpen}>
                      <DialogTrigger
                        render={
                          <Button variant="outline" className="w-full gap-2">
                            <Printer size={18} /> View & Print Label
                          </Button>
                        }
                      />
                      <DialogContent className="max-w-[630px] w-full h-[95vh] flex flex-col p-0 overflow-hidden">
                        <DialogHeader className="p-4 border-b">
                          <DialogTitle className="flex items-center gap-2">
                            <Printer className="w-5 h-5" /> Shipping Label Viewer
                          </DialogTitle>
                        </DialogHeader>
                        <div className="flex-1 bg-zinc-100 relative">
                          {credentials.general.labelFormat === 'PDF' ? (
                            <iframe 
                              src={`${labelUrl}#toolbar=1&navpanes=0&scrollbar=1&view=Fit`} 
                              className="w-full h-full border-none"
                              title="Shipping Label"
                              onLoad={(e) => {
                                if (credentials.general.autoPrintLabel) {
                                  const iframe = e.currentTarget;
                                  if (iframe && iframe.contentWindow) {
                                    try {
                                      iframe.contentWindow.print();
                                    } catch (err) {
                                      console.error("[OrderDetails] Auto-print failed:", err);
                                    }
                                  }
                                }
                              }}
                            />
                          ) : (
                            <div className="p-8 flex items-center justify-center h-full">
                              <div className="bg-white p-6 rounded-lg shadow-sm border max-w-md w-full text-center space-y-4">
                                <Package className="w-12 h-12 mx-auto text-zinc-400" />
                                <h3 className="font-bold text-lg">ZPL Label Generated</h3>
                                <p className="text-sm text-zinc-500">
                                  ZPL labels are raw printer commands and cannot be previewed directly in the browser. 
                                  Please use a ZPL-compatible printer or utility to print this label.
                                </p>
                                <Button variant="outline" className="w-full" onClick={() => window.open(labelUrl!, '_blank')}>
                                  Download ZPL File
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                        <DialogFooter className="p-4 border-t bg-zinc-50 flex justify-between items-center">
                          <div className="flex gap-2">
                            <Button variant="ghost" onClick={() => setIsLabelViewerOpen(false)}>Close</Button>
                            {labelUrl && (
                              <Button variant="outline" onClick={() => {
                                const link = document.createElement('a');
                                link.href = labelUrl;
                                link.download = `label-${trackingNumber || 'shipment'}.pdf`;
                                link.click();
                              }}>
                                Download PDF
                              </Button>
                            )}
                          </div>
                          {credentials.general.labelFormat === 'PDF' && (
                            <Button onClick={() => {
                              const iframe = document.querySelector('iframe[title="Shipping Label"]') as HTMLIFrameElement;
                              if (iframe && iframe.contentWindow) {
                                iframe.contentWindow.print();
                              }
                            }}>
                              Print Label
                            </Button>
                          )}
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                )}
              </div>

              {rates.length > 0 && !labelUrl && !isShipping && (
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
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
