import bitcoreP2pCash from '@chaingraph/bitcore-p2p-cash';
const { internalBitcore, Peer } = bitcoreP2pCash;

const node = {
  name: "p2p client peer",
  host: "3.142.98.179",
  network: "e3e1f3e8",
  port: 8333,
  subversion: "/fulcrum-http/",
  version: 70012,
}

const chaingraphLogFirehose = false;
const logger = console;

export const SetupP2p = () => {
  internalBitcore.Networks.add({
    name: node.networkMagicHex,
    networkMagic: parseInt(node.networkMagicHex, 16),
  });
  const peerConfig = {
    host: node.host,
    network: node.networkMagicHex,
    port: node.port,
    subversion: node.subversion,
    version: node.version,
  };
  const peer = new Peer(peerConfig);
  peer.setMaxListeners(1e10);

  if (chaingraphLogFirehose) {
    peer.on('*', (message, eventName) => {
      logger.trace(
        `${eventName} received from peer - ${node.name}: `, message);
    });
  }

  peer.on('ready', () => {
    logger.info(
      `${node.name}: connected to node`
    );
  });

  peer.on('disconnect', () => {
    logger.info(`${node.name}: disconnected`);

    setTimeout(() => {
      logger.info(`${node.name}: reconnecting`);
      peer.connect();
    }, 1000);
  });

  peer.on('error', (err) => {
    logger.error(err, `Error from peer: ${node.name}`);
  });

  peer.connect();

  return peer;
}