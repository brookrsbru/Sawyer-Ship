import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { SawyerCredentials } from '@/src/hooks/use-sawyer-storage';
import { COUNTRY_NAMES } from '@/src/lib/countries';
import { Save, Download, Upload, Shield, Globe, Truck, Info, FileJson } from 'lucide-react';
import { toast } from 'sonner';

export default function Settings({ 
  credentials, 
  onSave, 
  onExport, 
  onImport 
}: { 
  credentials: SawyerCredentials, 
  onSave: (data: SawyerCredentials) => Promise<void>,
  onExport: () => string | null,
  onImport: (data: string) => void
}) {
  const [formData, setFormData] = useState<SawyerCredentials>(credentials);
  const [importText, setImportText] = useState('');

  // Sync state if credentials change (e.g. after a save or import)
  useEffect(() => {
    setFormData(credentials);
  }, [credentials]);

  const handleSave = async () => {
    try {
      await onSave(formData);
      toast.success("Settings saved successfully.");
    } catch (e) {
      toast.error("Failed to save settings.");
    }
  };

  const handleExport = () => {
    const data = onExport();
    if (data) {
      const blob = new Blob([JSON.stringify({ encryptedData: data }, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sawyer-ship-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Settings exported as JSON file.");
    }
  };

  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        if (json.encryptedData) {
          onImport(json.encryptedData);
          toast.success("Data imported. Please refresh and unlock with the original master password.");
          setTimeout(() => window.location.reload(), 2000);
        } else {
          toast.error("Invalid backup file format.");
        }
      } catch (err) {
        toast.error("Failed to parse JSON file.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-zinc-900">Settings</h1>
        <p className="text-zinc-500">Manage your API credentials and application preferences.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="general" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="shipping">Shipping Defaults</TabsTrigger>
              <TabsTrigger value="magento">Magento</TabsTrigger>
              <TabsTrigger value="ups">UPS</TabsTrigger>
              <TabsTrigger value="fedex">FedEx</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Application Preferences</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="proxy">CORS Proxy URL</Label>
                    <Input 
                      id="proxy" 
                      placeholder="https://cors-anywhere.herokuapp.com/" 
                      value={formData.general.proxyUrl}
                      onChange={(e) => setFormData({ ...formData, general: { ...formData.general, proxyUrl: e.target.value } })}
                    />
                    <p className="text-xs text-zinc-500">Required for browser-based API calls if the server doesn't support CORS.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="format">Default Label Format</Label>
                    <Select 
                      value={formData.general.labelFormat}
                      onValueChange={(v: 'PDF' | 'ZPL') => setFormData({ ...formData, general: { ...formData.general, labelFormat: v } })}
                    >
                      <SelectTrigger id="format">
                        <SelectValue placeholder="Select format" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PDF">PDF (Standard)</SelectItem>
                        <SelectItem value="ZPL">ZPL (Thermal)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="currency">Display Currency</Label>
                    <Select 
                      value={formData.general.currency}
                      onValueChange={(v) => setFormData({ ...formData, general: { ...formData.general, currency: v } })}
                    >
                      <SelectTrigger id="currency">
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="GBP">GBP (£)</SelectItem>
                        <SelectItem value="USD">USD ($)</SelectItem>
                        <SelectItem value="EUR">EUR (€)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="autolock">Auto-Lock Timer</Label>
                    <Select 
                      value={(formData.general.autoLockMinutes ?? 0).toString()}
                      onValueChange={(v) => setFormData({ ...formData, general: { ...formData.general, autoLockMinutes: parseInt(v) } })}
                    >
                      <SelectTrigger id="autolock">
                        <SelectValue placeholder="Select time" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Never Lock</SelectItem>
                        <SelectItem value="1">1 Minute</SelectItem>
                        <SelectItem value="5">5 Minutes</SelectItem>
                        <SelectItem value="15">15 Minutes</SelectItem>
                        <SelectItem value="30">30 Minutes</SelectItem>
                        <SelectItem value="60">1 Hour</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-zinc-500">Automatically lock the app after a period of inactivity.</p>
                  </div>

                  <Separator />

                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label htmlFor="origin-country">Origin Country</Label>
                      <Select 
                        value={formData.general.originCountry}
                        onValueChange={(v) => setFormData({ ...formData, general: { ...formData.general, originCountry: v } })}
                      >
                        <SelectTrigger id="origin-country">
                          <SelectValue placeholder="Select country" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.entries(COUNTRY_NAMES).map(([code, name]) => (
                            <SelectItem key={code} value={code}>{name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-zinc-500">Your shipping origin country. Used to determine if duties/taxes options are shown.</p>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Always show Duties/Taxes</Label>
                        <p className="text-[10px] text-zinc-500">Show duties billing even for domestic shipments.</p>
                      </div>
                      <Select 
                        value={formData.general.alwaysShowDuties ? "yes" : "no"}
                        onValueChange={(v) => setFormData({ ...formData, general: { ...formData.general, alwaysShowDuties: v === "yes" } })}
                      >
                        <SelectTrigger className="w-[100px]">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">Yes</SelectItem>
                          <SelectItem value="no">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="space-y-0.5">
                        <Label>Mark as Shipped in Magento</Label>
                        <p className="text-[10px] text-zinc-500">Automatically create shipment in Magento after creating label.</p>
                      </div>
                      <Select 
                        value={formData.general.markAsShipped ? "yes" : "no"}
                        onValueChange={(v) => setFormData({ ...formData, general: { ...formData.general, markAsShipped: v === "yes" } })}
                      >
                        <SelectTrigger className="w-[100px]">
                          <SelectValue placeholder="Select" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="yes">Yes</SelectItem>
                          <SelectItem value="no">No</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Separator />

                    <div className="space-y-2">
                      <Label>UPS Pickup Type</Label>
                      <Select 
                        value={formData.general.upsPickupType}
                        onValueChange={(v) => setFormData({ ...formData, general: { ...formData.general, upsPickupType: v } })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select pickup type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="01">Daily Pickup</SelectItem>
                          <SelectItem value="03">Customer Counter</SelectItem>
                          <SelectItem value="06">One Time Pickup</SelectItem>
                          <SelectItem value="07">On Call Air</SelectItem>
                          <SelectItem value="19">Letter Center</SelectItem>
                          <SelectItem value="20">Air Service Center</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>FedEx Pickup Type</Label>
                      <Select 
                        value={formData.general.fedexPickupType}
                        onValueChange={(v) => setFormData({ ...formData, general: { ...formData.general, fedexPickupType: v } })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select pickup type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CONTACT_FEDEX_TO_SCHEDULE">Contact FedEx to Schedule</SelectItem>
                          <SelectItem value="DROPOFF_AT_FEDEX_LOCATION">Dropoff at FedEx Location</SelectItem>
                          <SelectItem value="USE_SCHEDULED_PICKUP">Use Scheduled Pickup</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="shipping" className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck size={20} /> Shipping Defaults
                  </CardTitle>
                  <CardDescription>Set default values for new shipments.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Default Weight (KG)</Label>
                      <Input 
                        type="number" 
                        step="0.1"
                        value={formData.shippingDefaults.weightKg}
                        onChange={(e) => setFormData({ ...formData, shippingDefaults: { ...formData.shippingDefaults, weightKg: e.target.value } })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Default Weight (Grams)</Label>
                      <Input 
                        type="number"
                        value={formData.shippingDefaults.weightG}
                        onChange={(e) => setFormData({ ...formData, shippingDefaults: { ...formData.shippingDefaults, weightG: e.target.value } })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Length (cm)</Label>
                      <Input 
                        type="number"
                        value={formData.shippingDefaults.length}
                        onChange={(e) => setFormData({ ...formData, shippingDefaults: { ...formData.shippingDefaults, length: e.target.value } })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Width (cm)</Label>
                      <Input 
                        type="number"
                        value={formData.shippingDefaults.width}
                        onChange={(e) => setFormData({ ...formData, shippingDefaults: { ...formData.shippingDefaults, width: e.target.value } })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Height (cm)</Label>
                      <Input 
                        type="number"
                        value={formData.shippingDefaults.height}
                        onChange={(e) => setFormData({ ...formData, shippingDefaults: { ...formData.shippingDefaults, height: e.target.value } })}
                      />
                    </div>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Bill Shipping To</Label>
                      <Select 
                        value={formData.shippingDefaults.billShippingTo}
                        onValueChange={(v) => setFormData({ ...formData, shippingDefaults: { ...formData.shippingDefaults, billShippingTo: v } })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select billing" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="shipper">Shipper (Prepaid)</SelectItem>
                          <SelectItem value="recipient">Recipient (Collect)</SelectItem>
                          <SelectItem value="third_party">Third Party</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Bill Duties/Taxes To</Label>
                      <Select 
                        value={formData.shippingDefaults.billDutiesTo}
                        onValueChange={(v) => setFormData({ ...formData, shippingDefaults: { ...formData.shippingDefaults, billDutiesTo: v } })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select billing" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="shipper">Shipper (DDP)</SelectItem>
                          <SelectItem value="recipient">Recipient (DDU/DAP)</SelectItem>
                          <SelectItem value="third_party">Third Party</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <Label htmlFor="overwrite" className="text-sm font-medium">
                      Overwrite existing order information with these defaults
                    </Label>
                    <Select 
                      value={formData.shippingDefaults.overwriteExisting ? "yes" : "no"}
                      onValueChange={(v) => setFormData({ ...formData, shippingDefaults: { ...formData.shippingDefaults, overwriteExisting: v === "yes" } })}
                    >
                      <SelectTrigger id="overwrite" className="w-[100px]">
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="yes">Yes</SelectItem>
                        <SelectItem value="no">No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="magento" className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Globe size={20} /> Magento API
                  </CardTitle>
                  <CardDescription>Configure your Magento 2 REST API connection.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="magento-url">Store Base URL</Label>
                    <Input 
                      id="magento-url" 
                      placeholder="https://yourstore.com" 
                      value={formData.magento.url}
                      onChange={(e) => setFormData({ ...formData, magento: { ...formData.magento, url: e.target.value } })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="magento-token">Integration Access Token</Label>
                    <Input 
                      id="magento-token" 
                      autoComplete="off"
                      placeholder="Bearer Token" 
                      value={formData.magento.token}
                      onChange={(e) => setFormData({ ...formData, magento: { ...formData.magento, token: e.target.value } })}
                    />
                    <p className="text-xs text-zinc-500">Create this in System {'>'} Extensions {'>'} Integrations in your Magento Admin.</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ups" className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck size={20} /> UPS API (OAuth 2.0)
                  </CardTitle>
                  <CardDescription>Modern UPS REST API credentials.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="ups-client-id">Client ID</Label>
                      <Input 
                        id="ups-client-id" 
                        value={formData.ups.clientId}
                        onChange={(e) => setFormData({ ...formData, ups: { ...formData.ups, clientId: e.target.value } })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ups-client-secret">Client Secret</Label>
                      <Input 
                        id="ups-client-secret" 
                        autoComplete="off"
                        value={formData.ups.clientSecret}
                        onChange={(e) => setFormData({ ...formData, ups: { ...formData.ups, clientSecret: e.target.value } })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="ups-account">Account Number</Label>
                      <Input 
                        id="ups-account" 
                        value={formData.ups.accountNumber}
                        onChange={(e) => setFormData({ ...formData, ups: { ...formData.ups, accountNumber: e.target.value } })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="ups-env">Environment</Label>
                      <Select 
                        value={formData.ups.isSandbox ? "sandbox" : "production"}
                        onValueChange={(v) => setFormData({ ...formData, ups: { ...formData.ups, isSandbox: v === "sandbox" } })}
                      >
                        <SelectTrigger id="ups-env">
                          <SelectValue placeholder="Select environment" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
                          <SelectItem value="production">Production (Live)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="fedex" className="space-y-4 mt-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Truck size={20} /> FedEx API
                  </CardTitle>
                  <CardDescription>FedEx REST API credentials.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fedex-key">API Key</Label>
                      <Input 
                        id="fedex-key" 
                        value={formData.fedex.apiKey}
                        onChange={(e) => setFormData({ ...formData, fedex: { ...formData.fedex, apiKey: e.target.value } })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fedex-secret">Secret Key</Label>
                      <Input 
                        id="fedex-secret" 
                        autoComplete="off"
                        value={formData.fedex.secretKey}
                        onChange={(e) => setFormData({ ...formData, fedex: { ...formData.fedex, secretKey: e.target.value } })}
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="fedex-account">Account Number</Label>
                      <Input 
                        id="fedex-account" 
                        value={formData.fedex.accountNumber}
                        onChange={(e) => setFormData({ ...formData, fedex: { ...formData.fedex, accountNumber: e.target.value } })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fedex-env">Environment</Label>
                      <Select 
                        value={formData.fedex.isSandbox ? "sandbox" : "production"}
                        onValueChange={(v) => setFormData({ ...formData, fedex: { ...formData.fedex, isSandbox: v === "sandbox" } })}
                      >
                        <SelectTrigger id="fedex-env">
                          <SelectValue placeholder="Select environment" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sandbox">Sandbox (Testing)</SelectItem>
                          <SelectItem value="production">Production (Live)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end">
            <Button onClick={handleSave} className="bg-zinc-900 hover:bg-zinc-800 gap-2">
              <Save size={18} /> Save All Settings
            </Button>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield size={20} /> Security & Backup
              </CardTitle>
              <CardDescription>Export or import your encrypted credentials.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Export Settings & Tokens</Label>
                <Button variant="outline" className="w-full gap-2" onClick={handleExport}>
                  <FileJson size={18} /> Download JSON Backup
                </Button>
                <p className="text-[10px] text-zinc-500">This file contains your encrypted credentials. Keep it safe.</p>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <Label htmlFor="import-file">Import from JSON Backup</Label>
                <div className="flex flex-col gap-2">
                  <Input 
                    id="import-file"
                    type="file"
                    accept=".json"
                    onChange={handleFileImport}
                    className="text-xs"
                  />
                  <p className="text-[10px] text-zinc-500">Importing will overwrite your current settings.</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <Label htmlFor="import">Manual Import (Encrypted String)</Label>
                <textarea 
                  id="import"
                  className="w-full h-20 p-2 text-[10px] border rounded-md bg-zinc-50 font-mono"
                  placeholder="Paste encrypted string here..."
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                />
                <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => {
                  if (!importText) return;
                  onImport(importText);
                  toast.success("Data imported. Reloading...");
                  setTimeout(() => window.location.reload(), 2000);
                }}>
                  <Upload size={14} /> Import String
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-zinc-900 text-white border-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Info size={20} /> Help Desk
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-4 opacity-90">
              <p>
                <strong>UPS Credentials:</strong> Get them at the <a href="https://developer.ups.com/" target="_blank" className="underline">UPS Developer Portal</a>. Create an "App" to get your Client ID and Secret.
              </p>
              <p>
                <strong>FedEx Credentials:</strong> Get them at the <a href="https://developer.fedex.com/" target="_blank" className="underline">FedEx Developer Portal</a>.
              </p>
              <p>
                <strong>CORS Proxy:</strong> Since this app runs in your browser, some APIs might block requests. Using a proxy helps bypass these restrictions.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
