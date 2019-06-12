const path = require('path');
const { BncThreshSigClient } = require(path.join(__dirname, '../dist/src'));
const expect = require('chai').expect;
const { exec } = require('child_process');

describe('Binance client tests (make sure to deposit to printed address)', () => {
    let client;
    let server;

    before(async () => {
        console.error = () => {};  // suppress error logs in test to keep it clean
        server = exec(path.join(__dirname, '../demo/server'));
        client = new BncThreshSigClient();
        await client.init();
        await client.initWebSocket();
    });

    after(() => {
        server.kill();
    });

    it('get address', () => {
        const address = client.getAddress();
        expect(address).to.be.a('string');
        console.log(address);
    });

    it('get address without address index should return same address', () => {
        const address1 = client.getAddress();
        const address2 = client.getAddress();
        expect(address1).to.be.a('string');
        expect(address2).to.be.a('string');
        expect(address1).to.equal(address2);
    });

    it('get address without address index should return default address (of index 0)', () => {
        const address1 = client.getAddress();
        const address2 = client.getAddress(0);
        expect(address1).to.be.a('string');
        expect(address2).to.be.a('string');
        expect(address1).to.equal(address2);
    });

    it('get address with same address index should return same address', () => {
        const address1 = client.getAddress(7);
        const address2 = client.getAddress(7);
        expect(address1).to.be.a('string');
        expect(address2).to.be.a('string');
        expect(address1).to.equal(address2);
    });

    it('get address with different address index should return different address', () => {
        const address1 = client.getAddress(0);
        const address2 = client.getAddress(7);
        expect(address1).to.be.a('string');
        expect(address2).to.be.a('string');
        expect(address1).to.not.equal(address2);
    });

    it('get account for address', async () => {
        const address = client.getAddress();
        const account = await client.getAccount(address);
        expect(account).to.be.an('object');
        expect(account.status).to.eq(200);
        expect(account.result).to.be.an('object');
        expect(account.result.address).to.eq(address);
        expect(account.result.account_number).to.be.a('number');
        expect(account.result.balances).to.be.an('array');
    });

    it('get balance for address', async () => {
        const address = client.getAddress();
        const balance = await client.getBalance(address);
        expect(balance).to.be.an('array');
        expect(balance.length).to.eq(1);
        expect(balance[0].symbol).to.eq('BNB');
        expect(balance[0].free).to.be.a('string');
        expect(balance[0].frozen).to.be.a('string');
        expect(balance[0].locked).to.be.a('string');
    });

    it('transfer', async () => {
        const addressFrom = client.getAddress();
        const addressTo = 'tbnb1fcczqjxk7hq5fnzyp79vym6e3565ktkh5gy5fw';
        const amount = 0.00001;
        const asset = 'BNB';
        // subscribe to transfers websocket
        let hash;
        client.ws.send(JSON.stringify({method: 'subscribe', topic: 'transfers', address: addressTo}));
        client.ws.onmessage = e => {
            const eventData = JSON.parse(e.data);
            expect(eventData.stream).to.eq('transfers');
            expect(eventData.data).to.be.an('object');
            expect(eventData.data.f).to.eq(addressFrom);
            expect(eventData.data.t).to.be.an('array');
            expect(eventData.data.t[0].o).to.eq(addressTo);
            expect(eventData.data.t[0].c).to.be.an('array');
            expect(eventData.data.t[0].c[0].a).to.eq('BNB');
            expect(parseFloat(eventData.data.t[0].c[0].A)).to.eq(amount);
            expect(eventData.data.H).to.be.a('string');
            expect(eventData.data.H).to.be.lengthOf(64);
            if (!hash) {
                hash = eventData.data.H;
            } else {
                // reached here after transfer response
                expect(eventData.data.H).to.eq(hash);
                client.ws.close(); // to end this test
            }
        };

        const message = 'take some back';
        const transferResponse = await client.transfer(addressFrom, addressTo, amount, asset, message);
        expect(transferResponse).to.be.an('object');
        expect(transferResponse.status).to.eq(200);
        expect(transferResponse.result).to.be.an('array');
        expect(transferResponse.result.length).to.be.eq(1);
        expect(transferResponse.result[0].code).to.be.a('number');
        expect(transferResponse.result[0].ok).to.eq(true);
        expect(transferResponse.result[0].hash).to.be.a('string');
        if (!hash) {
            hash = transferResponse.result[0].hash;
        } else {
            // reached here after socket event
            expect(e.data.H).to.eq(hash);
            client.ws.close(); // to end this test
        }
    });

    it('get transactions', async () => {
        const transactionsResponse = await client.getTransactions();
        expect(transactionsResponse).to.be.an('object');
        expect(transactionsResponse.result).to.be.an('object');
        expect(transactionsResponse.result.total).to.be.greaterThan(0);
        expect(transactionsResponse.result.tx.length).to.be.greaterThan(0);
    });
});