const BncThreshSigClient = require('../dist/src').BncThreshSigClient;
const expect = require('chai').expect;
const BnbApiClient = require('@binance-chain/javascript-sdk');

describe('Binance client tests (make sure to deposit to printed address)', () => {
    let bncThreshSigClient;

    before(async () => {
        console.error = () => {};  // suppress error logs in test to keep it clean
        bncThreshSigClient = new BncThreshSigClient();
        await bncThreshSigClient.initChain();
        await bncThreshSigClient.initMasterKey();
    });

    it('get address', () => {
        const address = bncThreshSigClient.getAddress();
        expect(address).to.be.a('string');
        console.log(address);
    });

    it('get address without address index should return same address', () => {
        const address1 = bncThreshSigClient.getAddress();
        const address2 = bncThreshSigClient.getAddress();
        expect(address1).to.be.a('string');
        expect(address2).to.be.a('string');
        expect(address1).to.equal(address2);
    });

    it('get address without address index should return default address (of index 0)', () => {
        const address1 = bncThreshSigClient.getAddress();
        const address2 = bncThreshSigClient.getAddress(0);
        expect(address1).to.be.a('string');
        expect(address2).to.be.a('string');
        expect(address1).to.equal(address2);
    });

    it('get address with same address index should return same address', () => {
        const address1 = bncThreshSigClient.getAddress(7);
        const address2 = bncThreshSigClient.getAddress(7);
        expect(address1).to.be.a('string');
        expect(address2).to.be.a('string');
        expect(address1).to.equal(address2);
    });

    it('get address with different address index should return different address', () => {
        const address1 = bncThreshSigClient.getAddress(0);
        const address2 = bncThreshSigClient.getAddress(7);
        expect(address1).to.be.a('string');
        expect(address2).to.be.a('string');
        expect(address1).to.not.equal(address2);
    });

    it('get account for address', async () => {
        const address = bncThreshSigClient.getAddress();
        const account = await bncThreshSigClient.getAccount(address);
        expect(account).to.be.an('object');
        expect(account.status).to.eq(200);
        expect(account.result).to.be.an('object');
        expect(account.result.address).to.eq(address);
        expect(account.result.account_number).to.be.a('number');
        expect(account.result.balances).to.be.an('array');
    });

    it('get balance for address', async () => {
        const address = bncThreshSigClient.getAddress();
        const balance = await bncThreshSigClient.getBalance(address);
        expect(balance).to.be.an('array');
        expect(balance.length).to.eq(1);
        expect(balance[0].symbol).to.eq('BNB');
        expect(balance[0].free).to.be.a('string');
        expect(balance[0].frozen).to.be.a('string');
        expect(balance[0].locked).to.be.a('string');
    });

    it('transfer', async () => {
        const addressFrom = bncThreshSigClient.getAddress();
        const addressTo = 'tbnb1fcczqjxk7hq5fnzyp79vym6e3565ktkh5gy5fw';
        const amount = 0.00001;
        const asset = 'BNB';
        const message = 'take some back';
        const transferResponse = await bncThreshSigClient.transfer(addressFrom, addressTo, amount, asset, message);
        expect(transferResponse).to.be.an('object');
        expect(transferResponse.status).to.eq(200);
        expect(transferResponse.result).to.be.an('array');
        expect(transferResponse.result.length).to.be.eq(1);
        expect(transferResponse.result[0].code).to.be.a('number');
        expect(transferResponse.result[0].hash).to.be.a('string');
        expect(transferResponse.result[0].ok).to.eq(true);
    });
});