const BncThreshSigClient = require('../dist/src').BncThreshSigClient;

(async () => {
    const client = new BncThreshSigClient();
    await client.initChain();
    await client.initMasterKey();
    const address = client.getAddress();
    console.log(address);
    // tbnb1zaudxtp40f6w3vgjmxqpxjaxfa7mt09t5x0h2s

    console.log(await client.getBalance());
    // [{"free":"0.09244000","frozen":"0.00000000","locked":"0.00000000","symbol":"BNB"}]

    const toAddress = client.getAddress(1);  // new address
    console.log(toAddress);
    // tbnb1glzdlqt70uk7qw8e7jy7u708emfhe9qsdwxhc5

    console.log(await client.transfer(address, toAddress, 0.00123, 'BNB', 'demo!'));
    // {"result":[{"code":0,"hash":"DD505FB142B473471D969BA278E82548BEDD637FEC3A3ED6350408B34A74DB9E","height":"","log":"Msg 0: ","ok":true}],"status":200}
})();