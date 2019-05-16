import {Party2, Party2Share, Signature} from '@kzen-networks/thresh-sig';
import 'babel-polyfill';
const bncClient = require('@binance-chain/javascript-sdk');
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

const GOTHAM_ENDPOINT = 'http://localhost:8000';
const HD_COIN_INDEX = 0;
const PARTY2_SHARE_PATH = path.join(__dirname, '../../p2-share.json');
const BINANCE_CHAIN_URL_MAINNET = 'https://dex.binance.org/';
const BINANCE_CHAIN_URL_TESTNET = 'https://testnet-dex.binance.org';

export class BncThreshSigClient {
    private p2: Party2;
    private p2MasterKeyShare: Party2Share;
    private bncClient: any;
    private addressesToIndexes: {[address: string]: number};

    constructor(mainnet: boolean = false, useAsyncBroadcast: boolean = false) {
        const url = mainnet ? BINANCE_CHAIN_URL_MAINNET : BINANCE_CHAIN_URL_TESTNET;
        this.bncClient = new bncClient(url, useAsyncBroadcast);
        this.p2 = new Party2(GOTHAM_ENDPOINT);
        this.bncClient.setSigningDelegate(this.sign.bind(this));
        this.addressesToIndexes = {};
    }

    /**
     * Initialize the client's chain ID
     * @return {Promise}
     */
    public async initChain() {
        return this.bncClient.initChain();
    }

    /**
     * Initialize the client's master key.
     * Will either generate a new one by the 2 party protocol, or restore one from previous session.
     * @return {Promise}
     */
    public async initMasterKey() {
        this.p2MasterKeyShare = await this.restoreOrGenerateMasterKey();
    }

    /**
     * get the address of the specified index. If the index is omitted, will return the default address (of index 0).
     * @param addressIndex HD index of the address to get
     */
    public getAddress(addressIndex?: number): string {
        addressIndex = addressIndex || 0;
        const publicKey = this.getPublicKey(addressIndex);
        const publicKeyHex = publicKey.encode('hex', true);
        const address = bncClient.crypto.getAddressFromPublicKey(publicKeyHex);
        this.addressesToIndexes[address] = addressIndex;
        return address;
    }

    /**
     * Transfer tokens from one address to another.
     * @param {String} fromAddress
     * @param {String} toAddress
     * @param {Number} amount
     * @param {String} asset
     * @param {String} memo optional memo
     * @param {Number} sequence optional sequence
     * @return {Promise} resolves with response (success or fail)
     */
    public async transfer(fromAddress: string, toAddress: string, amount: number, asset: string, memo='', sequence=null) {
        return this.bncClient.transfer(fromAddress, toAddress, amount, asset, memo, sequence);
    }

    /**
     * get account of specified address. If address is omitted, will use the default address (of index 0).
     * @param {String} address
     * @return {Promise} resolves with http response
     */
    public async getAccount(address?: string) {
        if (!address) {
            address = this.getAddress(0);
        }
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

    /**
     * The signing delegate which uses the local master key share and performs 2P-ECDSA with party one's server.
     * @param  {Transaction} tx      the transaction
     * @param  {Object}      signMsg the canonical sign bytes for the msg
     * @return {Transaction}
     */
    private async sign(tx: any, signMsg: any) {
        const fromAddress: string = (signMsg.inputs && signMsg.inputs[0].address) || signMsg.sender;
        const addressIndex: number = this.addressesToIndexes[fromAddress];
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
        if (fs.existsSync(PARTY2_SHARE_PATH)) {
            let p2MasterKeyShare: string = fs.readFileSync(PARTY2_SHARE_PATH, 'utf8');
            if (p2MasterKeyShare) {
                return JSON.parse(p2MasterKeyShare);
            }
        }

        return this.generateMasterKeyShare();
    }

    private async generateMasterKeyShare(): Promise<Party2Share> {
        const p2MasterKeyShare: Party2Share = await this.p2.generateMasterKey();
        fs.writeFileSync(PARTY2_SHARE_PATH, JSON.stringify(p2MasterKeyShare));
        return p2MasterKeyShare;
    }
}