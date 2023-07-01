# Fulcrum HTTP wrapper

Thin wrapper around Fulcrum to support single HTTP requests.

## Implementation details

Creates a stateful web server keeping a connection to a remote fulcrum instance. If no requests were made in five minutes, the connection will be dropped.

User can instruct the wrapper to connect to the fulcrum instance of their choice by setting `server` header. See example.

Example request:

```bash
curl -X POST -d '{"id":1, "jsonrpc":"2.0","method":"blockchain.headers.get_tip", "params": []}' -H "Content-Type: application/json" -H "server: wss://electrum.imaginary.cash:50004" https://fulcrum-http.pat.mn
```

Response:

```json
{
    "id": 1,
    "jsonrpc": "2.0",
    "result": {
        "height": 799857,
        "hex": "00e0ff3fb977c0c2a2f6a7df792c9711ff0b3f3987177f43e65f00010000000000000000cf0cf8ba1e82877535b51f52048975ee6a74958a78c10ab6bc7bc68135cc3a0f9bba9f64624f0218e5f9716e"
    }
}
```
