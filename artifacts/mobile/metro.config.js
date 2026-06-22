const { getDefaultConfig } = require("expo/metro-config");
const http = require("http");

const config = getDefaultConfig(__dirname);

const API_PORT = 5000;

config.server = config.server ?? {};
config.server.enhanceMiddleware = (middleware) => {
  return (req, res, next) => {
    if (req.url && req.url.startsWith("/api")) {
      const options = {
        hostname: "localhost",
        port: API_PORT,
        path: req.url,
        method: req.method,
        headers: { ...req.headers, host: `localhost:${API_PORT}` },
      };

      const proxyReq = http.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
      });

      proxyReq.on("error", (err) => {
        console.error("[Metro proxy] API request failed:", err.message);
        if (!res.headersSent) {
          res.writeHead(502);
          res.end("API server unavailable");
        }
      });

      req.pipe(proxyReq, { end: true });
    } else {
      middleware(req, res, next);
    }
  };
};

module.exports = config;
