import express from "express";
import cors from "cors";
import compression from "compression";
import { ElectrumClient } from "electrum-cash";
import { URL } from "url";

const app = express();
app.use(cors());
app.use(compression());
app.use(express.json());

const defaultWs = "wss://electrum.imaginary.cash:50004"
const wsCache = {};
const timeouts = {};

app.post("*", async (req, res) => {
  if (!Object.keys(req.body).length || !req.body?.method) {
    res.status(500).json({
      "id": 0,
      "jsonrpc": "2.0",
      "error": {"code": -1, "message": "Malformed request"}
    });
    return;
  }

  const server = req.headers.server ?? defaultWs;
  const endpoint = req.body.method;
  const params = req.body.params;

  if (!wsCache[server]) {
    console.log("New server connection", server);
    const url = new URL(server);
    const client = new ElectrumClient("Electrum-HTTP", "1.5", url.hostname, url.port, url.protocol.replace(":", ""));
    await client.connect();
    wsCache[server] = client;
  }

  const client = wsCache[server];

  // timeout handling
  clearTimeout(timeouts[server]);
  timeouts[server] = setTimeout(async () => {
    console.log("Dropping inactive connection to ", server);
    try {
      await client.disconnect(false, false);
    } finally {
      delete wsCache[server];
    }
  }, 5 * 60000);

  try {
    const response = await client.request(endpoint, ...(params || []));

    if (response instanceof Error) {
      res.status(500).json({
        "id": 0,
        "jsonrpc": "2.0",
        "error": {"code": -1, "message": response.message}
      });
      return;
    }

    res.json({
      "id": req.body.id ?? 0,
      "jsonrpc": "2.0",
      "result": response
    });
  } catch {};
});

console.log("Service started");
app.listen(8000);
