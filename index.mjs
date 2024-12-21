import express from "express";
import cors from "cors";
import compression from "compression";
import { ElectrumClient } from "electrum-cash";
import { URL } from "url";
import { Hash } from "bitcoin-minimal/lib/utils/index.js";

import { SetupP2p } from "./p2p.mjs";
const p2p = SetupP2p();

const getBlockByHeight = async (blockHeight, verbosity) => {
  const { height, hex } = await request(defaultWs, "blockchain.header.get", [blockHeight])
  const hash = Hash.sha256sha256(Buffer.from(hex, "hex")).reverse();

  return await getBlockByHash(hash, verbosity, height);
}

const getBlockHeightByHash = async (blockHash) => {
  const { height } = await request(defaultWs, "blockchain.header.get", [blockHash])
  return height;
}

const request = async (server, method, params) => {
  server = server ?? defaultWs;

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

  let response;

  switch (method) {
    case "blockchain.block.get":
      if (typeof params[0] === "number") {
        response = await getBlockByHeight(params[0], params[1]);
      } else if (typeof params[0] === "string") {
        response = await getBlockByHash(params[0], params[1], params[2]);
      }
      break;
    default:
      response = await client.request(method, ...(params || []));
      break;
  }

  if (response instanceof Error) {
    throw response;
  }

  return response;
}

const getBlockByHash = async (blockHash, verbosity, height) => {
  const block = await p2p.getBlock(blockHash);

  if (!verbosity || Number(verbosity) === 0) {
    const result = block.toBuffer().toString("hex");
    return result;
  } else if (Number(verbosity === 1) || Number(verbosity === 1.5)) {
    height = height ?? (() => {
      try {
        return block.getHeight();
      } catch (e) {
        return undefined;
      }
     })() ?? await getBlockHeightByHash(blockHash);
    const result = {
      hash: block.getHash().toString("hex"),
      confirmations: -1,
      size: block.size,
      height: height,
      version: block.header.version.slice().readUint32BE(0),
      versionHex: block.header.version.toString("hex"),
      merkleroot: block.header.merkleRoot.toString("hex"),
      tx: [],
      time: block.header.time,
      mediantime: 0,
      nonce: block.header.nonce,
      bits: block.header.bits.toString("hex"),
      difficulty: 0,
      nTx: block.txCount,
      previousblockhash: block.header.prevHash.toString("hex"),
      nextblockhash: "",
    }

    const rawTransactions = block.getRawTransactions();
    if (Number(verbosity === 1)) {
      result.tx = rawTransactions.map(tx => Hash.sha256sha256(tx).reverse().toString("hex"));
    } else {
      result.tx = rawTransactions.map(tx => tx.toString("hex"));
    }
    return result;
  }

  return null;
}

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
  const method = req.body.method;
  const params = req.body.params;

  try {
    res.json({
      "id": req.body.id ?? 0,
      "jsonrpc": "2.0",
      "result": await request(server, method, params)
    });
  } catch (error) {
    res.status(500).json({
      "id": 0,
      "jsonrpc": "2.0",
      "error": {"code": -1, "message": error.message}
    });
  }
});

console.log("Service started");
app.listen(8000);
