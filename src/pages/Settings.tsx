import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { SawyerCredentials } from '@/src/hooks/use-sawyer-storage';
import { Save, Download, Upload, Shield, Globe, Truck, Info } from 'lucide-react';
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
      navigator.clipboard.writeText(data);
      toast.success("Encrypted data copied to clipboard!");
    }
  };

  const handleImport = () => {
    if (!importText) return;
    try {
      onImport(importText);
      toast.success("Data imported. Please refresh and unlock with the original master password.");
      setTimeout(() => window.location.reload(), 2000);
    } catch (e) {
      toast.error("Invalid import data.");
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-zinc-900">Settings</h1>
        <p className="text-zinc-500">Manage your API credentials and application preferences.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="magento" className="w-full">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="magento">Magento</TabsTrigger>
              <TabsTrigger value="ups">UPS</TabsTrigger>
              <TabsTrigger value="fedex">FedEx</TabsTrigger>
              <TabsTrigger value="general">General</TabsTrigger>
            </TabsList>

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
                      type="password"
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
                        type="password"
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
                          <SelectValue />
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
                        type="password"
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
                          <SelectValue />
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
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PDF">PDF (Standard)</SelectItem>
                        <SelectItem value="ZPL">ZPL (Thermal)</SelectItem>
                      </SelectContent>
                    </Select>
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
                <Label>Export Encrypted Data</Label>
                <Button variant="outline" className="w-full gap-2" onClick={handleExport}>
                  <Download size={18} /> Copy to Clipboard
                </Button>
              </div>
              
              <Separator />
              
              <div className="space-y-2">
                <Label htmlFor="import">Import Encrypted Data</Label>
                <textarea 
                  id="import"
                  className="w-full h-24 p-2 text-xs border rounded-md bg-zinc-50 font-mono"
                  placeholder="Paste encrypted string here..."
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                />
                <Button variant="outline" className="w-full gap-2" onClick={handleImport}>
                  <Upload size={18} /> Import & Reload
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
