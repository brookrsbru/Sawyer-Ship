import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";
import { saveCredentials, loadCredentials, saveAppData, loadAppData } from "./src/lib/server-storage.js";
import { ServerUPSClient } from "./src/lib/server-ups-client.js";
import { ServerFedExClient } from "./src/lib/server-fedex-client.js";
import { ServerMagentoClient } from "./src/lib/server-magento-client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware for parsing JSON
  app.use(express.json());

  // API Health check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", version: "3.0.0-server" });
  });

  // Settings: Credentials management
  app.post("/api/settings/credentials", async (req, res) => {
    try {
      const { credentials } = req.body;
      if (!credentials) return res.status(400).json({ error: "Missing credentials" });
      
      await saveCredentials(credentials);
      console.log(`[Server] Credentials saved securely`);
      res.json({ success: true });
    } catch (error: any) {
      console.error(`[Server] Error saving credentials:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/settings/credentials", async (req, res) => {
    try {
      const creds = await loadCredentials();
      if (!creds) return res.json({ credentials: null });
      res.json({ credentials: creds });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // App Data Storage
  app.post("/api/data/save", async (req, res) => {
    try {
      const { data, password } = req.body;
      await saveAppData(data, password);
      res.json({ success: true });
    } catch (error: any) {
      console.error(`[Server] Error saving app data:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/data/load", async (req, res) => {
    try {
      const { password } = req.body;
      const data = await loadAppData(password);
      res.json({ data });
    } catch (error: any) {
      console.error(`[Server] Error loading app data:`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Magento Proxy Routes
  app.post("/api/magento/:action", async (req, res) => {
    try {
      const { action } = req.params;
      const { params } = req.body;
      const creds = await loadCredentials();

      if (!creds?.magento?.enabled && !creds?.magento?.token) {
        return res.status(400).json({ error: "Server-side Magento is not configured or credentials missing" });
      }

      const magento = new ServerMagentoClient(
        creds.magento.url || creds.magento.baseUrl,
        creds.magento.token
      );

      let result;
      switch (action) {
        case "orders":
          result = await magento.searchOrders(params.query);
          break;
        case "order":
          result = await magento.getOrder(params.id);
          break;
        case "products":
          result = await magento.getProducts(params.skus);
          break;
        case "attribute-options":
          result = await magento.getAttributeOptions(params.attributeCode);
          break;
        case "ship":
          result = await magento.createShipment(params.orderId, params.tracks);
          break;
        default:
          return res.status(404).json({ error: `Unknown action: ${action}` });
      }

      res.json(result);
    } catch (error: any) {
      console.error(`[Server] Magento Error (${req.params.action}):`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // UPS Proxy Routes
  app.post("/api/ups/:action", async (req, res) => {
    try {
      const { action } = req.params;
      const { params } = req.body;
      const creds = await loadCredentials();

      if (!creds?.ups?.enabled) {
        return res.status(400).json({ error: "Server-side UPS is not configured or credentials missing" });
      }

      const ups = new ServerUPSClient(
        creds.ups.apiKey,
        creds.ups.secretKey,
        creds.ups.accountNumber,
        creds.ups.isSandbox
      );

      let result;
      switch (action) {
        case "rates":
          result = await ups.getRates(params);
          break;
        case "ship":
          result = await ups.createShipment(params);
          break;
        case "track":
          result = await ups.trackShipment(params.trackingNumber);
          break;
        case "cancel":
          result = await ups.cancelShipment(params.trackingNumber);
          break;
        case "validate-address":
          result = await ups.validateAddress(params);
          break;
        default:
          return res.status(404).json({ error: `Unknown action: ${action}` });
      }

      res.json(result);
    } catch (error: any) {
      console.error(`[Server] UPS Error (${req.params.action}):`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // FedEx Proxy Routes
  app.post("/api/fedex/:action", async (req, res) => {
    try {
      const { action } = req.params;
      const { params } = req.body;
      const creds = await loadCredentials();

      if (!creds?.fedex?.enabled) {
        return res.status(400).json({ error: "Server-side FedEx is not configured or credentials missing" });
      }

      const isSandbox = creds.fedex.isSandbox;
      
      // Determine which API key/secret to use based on action and sandbox mode
      let apiKey, secretKey, accountNumber;

      if (action === "track") {
        const isTrackingSandbox = creds.fedex.isTrackingSandbox;
        apiKey = isTrackingSandbox 
          ? (creds.fedex.sandboxTrackingApiKey || creds.fedex.sandboxApiKey)
          : (creds.fedex.productionTrackingApiKey || creds.fedex.productionApiKey || creds.fedex.apiKey);
        secretKey = isTrackingSandbox
          ? (creds.fedex.sandboxTrackingSecretKey || creds.fedex.sandboxSecretKey)
          : (creds.fedex.productionTrackingSecretKey || creds.fedex.productionSecretKey || creds.fedex.secretKey);
        accountNumber = isTrackingSandbox
          ? (creds.fedex.sandboxTrackingAccountNumber || creds.fedex.accountNumber)
          : (creds.fedex.productionTrackingAccountNumber || creds.fedex.productionAccountNumber || creds.fedex.accountNumber);
      } else {
        apiKey = isSandbox 
          ? creds.fedex.sandboxApiKey 
          : (creds.fedex.productionApiKey || creds.fedex.apiKey);
        secretKey = isSandbox 
          ? creds.fedex.sandboxSecretKey 
          : (creds.fedex.productionSecretKey || creds.fedex.secretKey);
        accountNumber = isSandbox 
          ? creds.fedex.accountNumber 
          : (creds.fedex.productionAccountNumber || creds.fedex.accountNumber);
      }

      const fedex = new ServerFedExClient(
        apiKey,
        secretKey,
        accountNumber,
        action === "track" ? creds.fedex.isTrackingSandbox : isSandbox
      );

      let result;
      switch (action) {
        case "rates":
          result = await fedex.getRates(params);
          break;
        case "ship":
          result = await fedex.createShipment(params);
          break;
        case "track":
          result = await fedex.trackShipment(params.trackingNumber);
          break;
        case "cancel":
          result = await fedex.cancelShipment(params.trackingNumber);
          break;
        case "validate-address":
          result = await fedex.validateAddress(params);
          break;
        default:
          return res.status(404).json({ error: `Unknown action: ${action}` });
      }

      res.json(result);
    } catch (error: any) {
      console.error(`[Server] FedEx Error (${req.params.action}):`, error);
      res.status(500).json({ error: error.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    
    // Fallback to index.html for SPA routing
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
