import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import dotenv from "dotenv";
import axios from "axios";
import admin from "firebase-admin";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Firebase Config safely
const firebaseConfigPath = path.join(__dirname, "firebase-applet-config.json");
const firebaseConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, "utf-8"));

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
      res.json({ message: "UPS Rate API integration placeholder" });
    } catch (error) {
      res.status(500).json({ error: "UPS API Error" });
    }
  });

  // FedEx: Get Rates (Direct Integration)
  app.post("/api/fedex/rates", async (req, res) => {
    try {
      res.json({ message: "FedEx Rate API integration placeholder" });
    } catch (error) {
      res.status(500).json({ error: "FedEx API Error" });
    }
  });

  // --- Vite Middleware ---
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "custom", // Changed to custom to handle HTML manually
    });
    
    app.use(vite.middlewares);

    app.use("*", async (req, res, next) => {
      const url = req.originalUrl;
      try {
        // 1. Read index.html
        let template = fs.readFileSync(
          path.resolve(__dirname, "index.html"),
          "utf-8"
        );

        // 2. Apply Vite HTML transforms. This injects the Vite HMR client, and
        //    also applies HTML transforms from Vite plugins, e.g. global preambles
        //    from @vitejs/plugin-react
        template = await vite.transformIndexHtml(url, template);

        // 3. Send the rendered HTML back.
        res.status(200).set({ "Content-Type": "text/html" }).end(template);
      } catch (e: any) {
        // If an error is caught, let Vite fix the stack trace so it maps back
        // to your actual source code.
        vite.ssrFixStacktrace(e);
        next(e);
      }
    });
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
