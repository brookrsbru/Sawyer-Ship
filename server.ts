import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import axios from "axios";
import admin from "firebase-admin";
import firebaseConfig from "./firebase-applet-config.json" assert { type: "json" };

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
admin.initializeApp({
  projectId: firebaseConfig.projectId,
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- Auth Middleware ---
  const authenticate = async (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Unauthorized: No token provided" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      req.user = decodedToken;
      
      // Check if user is the authorized admin (brookrsbru@gmail.com)
      if (decodedToken.email !== "brookrsbru@gmail.com") {
        return res.status(403).json({ error: "Forbidden: Access restricted to authorized admin" });
      }
      
      next();
    } catch (error) {
      console.error("Auth Error:", error);
      res.status(401).json({ error: "Unauthorized: Invalid token" });
    }
  };

  // --- API Routes ---

  // Magento: Fetch Orders (Protected)
  app.get("/api/magento/orders", authenticate, async (req, res) => {
    try {
      const { MAGENTO_URL, MAGENTO_ACCESS_TOKEN } = process.env;
      if (!MAGENTO_URL || !MAGENTO_ACCESS_TOKEN) {
        return res.status(400).json({ error: "Magento credentials not configured" });
      }

      const response = await axios.get(`${MAGENTO_URL}/rest/V1/orders`, {
        params: {
          'searchCriteria[filter_groups][0][filters][0][field]': 'status',
          'searchCriteria[filter_groups][0][filters][0][value]': 'processing',
          'searchCriteria[filter_groups][0][filters][0][condition_type]': 'eq'
        },
        headers: {
          Authorization: `Bearer ${MAGENTO_ACCESS_TOKEN}`
        }
      });
      res.json(response.data);
    } catch (error: any) {
      console.error("Magento Error:", error.response?.data || error.message);
      res.status(500).json({ error: "Failed to fetch Magento orders" });
    }
  });

  // UPS: Get Rates (Direct Integration)
  app.post("/api/ups/rates", async (req, res) => {
    try {
      // Implementation for UPS Rate API would go here
      // Requires OAuth token first
      res.json({ message: "UPS Rate API integration placeholder" });
    } catch (error) {
      res.status(500).json({ error: "UPS API Error" });
    }
  });

  // FedEx: Get Rates (Direct Integration)
  app.post("/api/fedex/rates", async (req, res) => {
    try {
      // Implementation for FedEx Rate API would go here
      res.json({ message: "FedEx Rate API integration placeholder" });
    } catch (error) {
      res.status(500).json({ error: "FedEx API Error" });
    }
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
