import {Party2, Party2Share, Signature} from '@kzen-networks/thresh-sig';
import 'babel-polyfill';
const bncClient = require('@binance-chain/javascript-sdk');
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import low from 'lowdb';
import FileSync from 'lowdb/adapters/FileSync';

const P1_ENDPOINT = 'http://localhost:8000';
const HD_COIN_INDEX = 0;
const CLIENT_DB_PATH = path.join(__dirname, '../../client_db');
const BINANCE_CHAIN_URL_MAINNET = 'https://dex.binance.org/';
const BINANCE_CHAIN_URL_TESTNET = 'https://testnet-dex.binance.org';

const api = {
    getTransactions: '/api/v1/transactions'
};

interface GetTransactionsOptions {
    address?: string;
    blockHeight?: number;
    startTime?: number;
    endTime?: number;
    limit?: number;
    offset?: number;
    side?: string;
    txAsset?: string;
    txType?: string;
}

export class BncThreshSigClient {
    private p2: Party2;
    private p2MasterKeyShare: Party2Share;
    private bncClient: any;
    private db: any;

    constructor(mainnet: boolean = false, useAsyncBroadcast: boolean = false) {
        const url = mainnet ? BINANCE_CHAIN_URL_MAINNET : BINANCE_CHAIN_URL_TESTNET;
        this.bncClient = new bncClient(url, useAsyncBroadcast);
        this.p2 = new Party2(P1_ENDPOINT);
        this.bncClient.setSigningDelegate(this.sign.bind(this));
    }

    public async init() {
        return Promise.all([
            this.bncClient.initChain(),
            (async () => {
                this.initDb();
                await this.initMasterKey();
            })(),
        ])
    }

    /**
     * get the address of the specified index. If the index is omitted, will return the default address (of index 0).
     * @param addressIndex HD index of the address to get
     */
    public getAddress(addressIndex: number = 0): string {
        const publicKey = this.getPublicKey(addressIndex);
        const publicKeyHex = publicKey.encode('hex', true);
        const address = bncClient.crypto.getAddressFromPublicKey(publicKeyHex);
        const dbAddress = this.db.get('addresses').find({ address }).value();
        if (!dbAddress) {
            this.db.get('addresses').push({ address, index: addressIndex}).write();
        }
        return address;
    }

    /**
     * Transfer tokens from one address to another.
     * @param {String} fromAddress - if null, will use the default address (of index 0)
     * @param {String} toAddress
     * @param {Number} amount
     * @param {String} asset
     * @param {String} memo optional memo
     * @param {Number} sequence optional sequence
     * @return {Promise} resolves with response (success or fail)
     */
    public async transfer(fromAddress: string | null, toAddress: string, amount: number, asset: string, memo='', sequence=null) {
        fromAddress = fromAddress || this.getAddress(0);
        return this.bncClient.transfer(fromAddress, toAddress, amount, asset, memo, sequence);
    }

    /**
     * Place an order.
     * @param {String} address. If address is null, will use the default address (of index 0)
     * @param {String} symbol the market pair
     * @param {Number} side (1-Buy, 2-Sell)
     * @param {Number} price
     * @param {Number} quantity
     * @param {Number} sequence optional sequence
     * @param {Number} timeinforce (1-GTC(Good Till Expire), 3-IOC(Immediate or Cancel))
     * @return {Promise} resolves with response (success or fail)
     */
    public async placeOrder(address: string | null, symbol: string, side: number, price: number, quantity: number, sequence = null, timeinforce = 1) {
        address = address || this.getAddress(0);
        return this.bncClient.placeOrder(address, symbol, side, price, quantity, null, timeinforce);
    }

    /**
     * Cancel an order.
     * @param {String} address. If address is null, will use the default address (of index 0)
     * @param {String} symbol the market pair
     * @param {String} refid the order ID of the order to cancel
     * @param {Number} sequence optional sequence
     * @return {Promise} resolves with response (success or fail)
     */
    public async cancelOrder(address: string | null, symbol: string, refid: string, sequence = null){
        address = address || this.getAddress(0);
        return this.bncClient.cancelOrder(address, symbol, refid, sequence)
    }


    /**
     * get account of specified address. If address is omitted, will use the default address (of index 0).
     * @param {String} address
     * @return {Promise} resolves with http response
     */
    public async getAccount(address: string = this.getAddress(0)) {
        return this.bncClient.getAccount(address);
    }

    /**
     * get balances of the specified address. If no address specified, will use the default address (of index 0).
     * @param {String} address optional address
     * @return {Promise} resolves with http response
     */
    public async getBalance(address?: string) {
        if (!address) {
            address = this.getAddress(0);
        }
        return this.bncClient.getBalance(address);
    }

    public async getTransactions(options: GetTransactionsOptions = {}) {
        const address = options.address || this.getAddress(0);
        return this.bncClient._httpClient.request("get", `${api.getTransactions}?address=${address}` +
            (options.blockHeight ? `&blockHeight=${options.blockHeight}` : '') +
            (options.startTime ? `&startTime=${options.startTime}` : '') +
            (options.endTime ? `&endTime=${options.endTime}` : '') +
            (options.limit ? `&limit=${options.limit}` : '') +
            (options.offset ? `&offset=${options.offset}` : '') +
            (options.side ? `&side=${options.side}` : '') +
            (options.txAsset ? `&txAsset=${options.txAsset}` : '') +
            (options.txType ? `&txType=${options.txType}` : ''));
    }

    /**
     * Initialize the client's chain ID
     * @return {Promise}
     */
    private async initChain() {
        return this.bncClient.initChain();
    }

    private initDb() {
        ensureDirSync(CLIENT_DB_PATH);
        const adapter = new FileSync(`${CLIENT_DB_PATH}/db.json`);
        this.db = low(adapter);
        this.db.defaults({ mkShare: null, addresses: [] }).write();
    }

    /**
     * Initialize the client's master key.
     * Will either generate a new one by the 2 party protocol, or restore one from previous session.
     * @return {Promise}
     */
    private async initMasterKey() {
        this.p2MasterKeyShare = await this.restoreOrGenerateMasterKey();
    }

    /**
     * The signing delegate which uses the local master key share and performs 2P-ECDSA with party one's server.
     * @param  {Transaction} tx      the transaction
     * @param  {Object}      signMsg the canonical sign bytes for the msg
     * @return {Transaction}
     */
    private async sign(tx: any, signMsg: any) {
        const fromAddress: string = (signMsg.inputs && signMsg.inputs[0].address) || signMsg.sender;
        const addressObj: any = this.db.get('addresses').find({ address: fromAddress }).value();
        const addressIndex: number = addressObj.index;
        const signBytes: Buffer = tx.getSignBytes(signMsg);
        const p2ChildShare: Party2Share = this.p2.getChildShare(this.p2MasterKeyShare, HD_COIN_INDEX, addressIndex);
        const msgHash: Buffer = crypto.createHash('sha256').update(signBytes).digest();
        const signature: Signature = await this.p2.sign(msgHash, p2ChildShare, HD_COIN_INDEX, addressIndex);
        const publicKey = this.getPublicKey(addressIndex);
        tx.addSignature(publicKey, signature.toBuffer());
        return tx;
    }

    /**
     * @return {Elliptic.PublicKey} PubKey
     */
    private getPublicKey(addressIndex: number) {
        // assuming a single default address
        const p2ChildShare = this.p2.getChildShare(this.p2MasterKeyShare, HD_COIN_INDEX, addressIndex);
        return p2ChildShare.getPublicKey();
    }

    private async restoreOrGenerateMasterKey(): Promise<Party2Share> {
        const p2MasterKeyShare = this.db.get('mkShare').value();
        if (p2MasterKeyShare) {
            return p2MasterKeyShare;
        }

        return this.generateMasterKeyShare();
    }

    private async generateMasterKeyShare(): Promise<Party2Share> {
        const p2MasterKeyShare: Party2Share = await this.p2.generateMasterKey();
        this.db.set('mkShare', p2MasterKeyShare).write();

        return p2MasterKeyShare;
    }
}

function ensureDirSync(dirpath: string) {
    try {
        fs.mkdirSync(dirpath, { recursive: true })
    } catch (err) {
        if (err.code !== 'EEXIST') throw err
    }
}
