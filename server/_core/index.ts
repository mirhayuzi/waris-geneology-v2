import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Enable CORS for all routes - reflect the request origin to support credentials
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerOAuthRoutes(app);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  // Google OAuth callback proxy
  // The app redirects Google OAuth to this HTTPS endpoint.
  // The server exchanges the auth code for tokens (using client_secret),
  // then redirects to the app's custom scheme with the tokens.
  app.get("/api/google/callback", async (req, res) => {
    const { code, error } = req.query;
    const appScheme = "warisgenealogy";

    if (error) {
      res.redirect(`${appScheme}://google-callback?error=${encodeURIComponent(String(error))}`);
      return;
    }

    if (!code) {
      res.status(400).send("Missing code or error parameter");
      return;
    }

    try {
      // Exchange code for tokens on the server side (has client_secret)
      const clientId = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || "";
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET || "";
      // The redirect_uri must match what was sent in the initial auth request
      const protocol = req.headers["x-forwarded-proto"] || req.protocol;
      const host = req.headers["x-forwarded-host"] || req.headers.host;
      const redirectUri = `${protocol}://${host}/api/google/callback`;

      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: String(code),
          redirect_uri: redirectUri,
          client_id: clientId,
          client_secret: clientSecret,
        }).toString(),
      });

      if (!tokenResponse.ok) {
        const errText = await tokenResponse.text();
        console.error("Google token exchange failed:", errText);
        res.redirect(`${appScheme}://google-callback?error=${encodeURIComponent("token_exchange_failed")}`);
        return;
      }

      const tokenData = await tokenResponse.json();

      // Redirect tokens to app via custom scheme
      const params = new URLSearchParams({
        access_token: tokenData.access_token,
        expires_in: String(tokenData.expires_in || 3600),
      });
      if (tokenData.refresh_token) {
        params.set("refresh_token", tokenData.refresh_token);
      }

      res.redirect(`${appScheme}://google-callback?${params.toString()}`);
    } catch (e) {
      console.error("Google OAuth callback error:", e);
      res.redirect(`${appScheme}://google-callback?error=${encodeURIComponent("server_error")}`);
    }
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
  });
}

startServer().catch(console.error);
