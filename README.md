Binance chain threshold wallet
=====================================
Binance chain wallet powered by two-party ECDSA. <br>
Soon to be integrated into the ZenGo iOS wallet (www.zengo.com)

## Installation:
```
$ npm install @kzen-networks/binance-thresh-wallet
```
## Usage:
Server (acts as the co-signer in the two-party signing protocol):
```js
const { BncThreshSigServer} = require('@kzen-networks/binance-thresh-wallet');
const server = new BncThreshSigServer();
server.launch();
```

Client:
```js
const { BncThreshSigClient } = require('@kzen-networks/binance-thresh-wallet');

(async () => {
    const client = new BncThreshSigClient();
    
    // initialize
    await client.init();
    
    const address = client.getAddress();
    console.log(address);
    // tbnb1zaudxtp40f6w3vgjmxqpxjaxfa7mt09t5x0h2s
    
    /* Now you should deposit BNB into this address */

    console.log(await client.getBalance());
    // [{"free":"0.09244000","frozen":"0.00000000","locked":"0.00000000","symbol":"BNB"}]

    const toAddress = client.getAddress(1);  // new address
    console.log(toAddress);
    // tbnb1glzdlqt70uk7qw8e7jy7u708emfhe9qsdwxhc5

    console.log(await client.transfer(address, toAddress, 0.00123, 'BNB', 'demo!'));
    // {"result":[{"code":0,"hash":"DD505FB142B473471D969BA278E82548BEDD637FEC3A3ED6350408B34A74DB9E","height":"","log":"Msg 0: ","ok":true}],"status":200}
})();
```
## Demo:
You can also use a demo using the command line.<br>
Server:
```bash
$ demo/server
```
Client:
```bash
$ demo/client --help

Usage: client [options] [command]

Options:
  -h, --help                               output usage information

Commands:
  address [options]
  balance <address>
  transfer [options] <from> <to> <amount>
  buy_order <symbol> <price> <quantity>
  sell_order <symbol> <price> <quantity>
  cancel_order <symbol> <ref_id>

```

Transfer demo:

|![Transfer demo](https://raw.githubusercontent.com/KZen-networks/binance-thresh-wallet/master/demo/binance-tss-demo.gif "Binance Threshold Wallet Demo")|
|:--:|

Trade Demo:

|![Trade demo](https://raw.githubusercontent.com/KZen-networks/binance-thresh-wallet/master/demo/BNB%20trade%20demo.gif "Binance Threshold Wallet Demo")|
|:--:|

## Contact
Feel free to [reach out](mailto:github@kzencorp.com) or join the KZen Research [Telegram]( https://t.me/kzen_research) for discussions on code and research.
