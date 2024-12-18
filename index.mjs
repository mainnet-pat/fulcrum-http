import express from "express";
import cors from "cors";
import compression from "compression";
import { ElectrumClient } from "electrum-cash";
import { URL } from "url";
import bitcore from "@chaingraph/bitcore-lib-cash";

import { SetupP2p } from "./p2p.mjs";
const p2p = SetupP2p();

const getBlockByHeight = async (blockHeight, verbosity) => {
  const { height, hex } = await request(defaultWs, "blockchain.header.get", [blockHeight])
  const hash = bitcore.crypto.Hash.sha256sha256(Buffer.from(hex, "hex"));

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
  return await new Promise((resolve) => {
    const handler = async (message) => {
      if (!verbosity || Number(verbosity) === 0) {
        const block = message.block.toBuffer().toString("hex");
        resolve(block);
      } else if (Number(verbosity === 1) || Number(verbosity === 1.5)) {
        const blockBuffer = message.block.toBuffer();
        height = height ?? await getBlockHeightByHash(blockHash);
        const block = {
          hash: message.block._getHash().reverse().toString("hex"),
          confirmations: -1,
          size: blockBuffer.length,
          height: height,
          version: message.block.header.version,
          versionHex: null,
          merkleroot: message.block.header.merkleRoot.reverse().toString("hex"),
          tx: [],
          time: message.block.header.time,
          mediantime: null,
          nonce: message.block.header.nonce,
          bits: null,
          difficulty: message.block.header.getDifficulty(),
          nTx: message.block.transactions.length,
          previousblockhash: message.block.header.prevHash.reverse().toString("hex"),
          nextblockhash: null
        }

        if (Number(verbosity === 1)) {
          block.tx = message.block.getTransactionHashes().map(buffer => buffer.reverse().toString("hex"));
        } else {
          block.tx = message.block.transactions.map(tx => tx.uncheckedSerialize().toString("hex"));
        }
        resolve(block);
      }

      resolve(null);
      p2p.off('block', handler);
    };
    p2p.on('block', handler);
    p2p.sendMessage(p2p.messages.GetData.forBlock(blockHash));
  });
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
