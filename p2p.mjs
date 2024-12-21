import { Peer } from "p2p-cash";

const node = {
  name: "p2p client peer",
  host: "3.142.98.179",
  network: "e3e1f3e8",
  port: 8333,
  subversion: "/fulcrum-http/",
  version: 70012,
}

export const SetupP2p = () => {
  const peer = new Peer({
    ticker: "BCH",
    node: node.host,
    port: node.port,
    validate: false,
    magic: Buffer.from(node.network, "hex"),
    userAgent: node.subversion,
    version: node.version,
    listenRelay: false,
    DEBUG_LOG: false,
  });

  peer.on('connected', () => {
    console.info(
      `${node.name}: connected to node`
    );
  });

  peer.connect();

  return peer;
}