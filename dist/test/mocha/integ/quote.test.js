import { AllowanceTransfer } from '@uniswap/permit2-sdk';
import { ChainId, CurrencyAmount, Ether, Fraction, WETH9 } from '@uniswap/sdk-core';
import { CEUR_CELO, CEUR_CELO_ALFAJORES, CUSD_CELO, CUSD_CELO_ALFAJORES, DAI_MAINNET, ID_TO_NETWORK_NAME, NATIVE_CURRENCY, parseAmount, SWAP_ROUTER_02_ADDRESSES, USDC_MAINNET, USDT_MAINNET, WBTC_MAINNET, } from '@uniswap/smart-order-router';
import { PERMIT2_ADDRESS, UNIVERSAL_ROUTER_ADDRESS as UNIVERSAL_ROUTER_ADDRESS_BY_CHAIN, } from '@uniswap/universal-router-sdk';
import { fail } from 'assert';
import axiosStatic from 'axios';
import axiosRetry from 'axios-retry';
import chai, { expect } from 'chai';
import chaiAsPromised from 'chai-as-promised';
import chaiSubset from 'chai-subset';
import { BigNumber, Wallet } from 'ethers';
import hre from 'hardhat';
import _ from 'lodash';
import qs from 'qs';
import { SUPPORTED_CHAINS } from '../../../lib/handlers/injector-sor';
import { Permit2__factory } from '../../../lib/types/ext';
import { resetAndFundAtBlock } from '../../utils/forkAndFund';
import { getBalance, getBalanceAndApprove } from '../../utils/getBalanceAndApprove';
import { DAI_ON, getAmount, getAmountFromToken, UNI_MAINNET, USDC_ON, USDT_ON, WNATIVE_ON } from '../../utils/tokens';
const { ethers } = hre;
chai.use(chaiAsPromised);
chai.use(chaiSubset);
const UNIVERSAL_ROUTER_ADDRESS = UNIVERSAL_ROUTER_ADDRESS_BY_CHAIN(1);
if (!process.env.UNISWAP_ROUTING_API || !process.env.ARCHIVE_NODE_RPC) {
    throw new Error('Must set UNISWAP_ROUTING_API and ARCHIVE_NODE_RPC env variables for integ tests. See README');
}
const API = `${process.env.UNISWAP_ROUTING_API}quote`;
const SLIPPAGE = '5';
const LARGE_SLIPPAGE = '10';
const axios = axiosStatic.create();
axiosRetry(axios, {
    retries: 10,
    retryCondition: (err) => { var _a; return ((_a = err.response) === null || _a === void 0 ? void 0 : _a.status) == 429; },
    retryDelay: axiosRetry.exponentialDelay,
});
const callAndExpectFail = async (quoteReq, resp) => {
    const queryParams = qs.stringify(quoteReq);
    try {
        await axios.get(`${API}?${queryParams}`);
        fail();
    }
    catch (err) {
        expect(err.response).to.containSubset(resp);
    }
};
const checkQuoteToken = (before, after, tokensQuoted) => {
    // Check which is bigger to support exactIn and exactOut
    const tokensSwapped = after.greaterThan(before) ? after.subtract(before) : before.subtract(after);
    const tokensDiff = tokensQuoted.greaterThan(tokensSwapped)
        ? tokensQuoted.subtract(tokensSwapped)
        : tokensSwapped.subtract(tokensQuoted);
    const percentDiff = tokensDiff.asFraction.divide(tokensQuoted.asFraction);
    expect(percentDiff.lessThan(new Fraction(parseInt(SLIPPAGE), 100))).to.be.true;
};
let warnedTesterPK = false;
const isTesterPKEnvironmentSet = () => {
    const isSet = !!process.env.TESTER_PK;
    if (!isSet && !warnedTesterPK) {
        console.log('Skipping tests requiring real PK since env variables for TESTER_PK is not set.');
        warnedTesterPK = true;
    }
    return isSet;
};
const MAX_UINT160 = '0xffffffffffffffffffffffffffffffffffffffff';
describe('quote', function () {
    // Help with test flakiness by retrying.
    this.retries(0);
    this.timeout('500s');
    let alice;
    let block;
    let curNonce = 0;
    let nextPermitNonce = () => {
        const nonce = curNonce.toString();
        curNonce = curNonce + 1;
        return nonce;
    };
    const executeSwap = async (methodParameters, currencyIn, currencyOut, permit, chainId = ChainId.MAINNET) => {
        const permit2 = Permit2__factory.connect(PERMIT2_ADDRESS, alice);
        // Approve Permit2
        const tokenInBefore = await getBalanceAndApprove(alice, PERMIT2_ADDRESS, currencyIn);
        const tokenOutBefore = await getBalance(alice, currencyOut);
        // Approve SwapRouter02 in case we request calldata for it instead of Universal Router
        await getBalanceAndApprove(alice, SWAP_ROUTER_02_ADDRESSES(chainId), currencyIn);
        // If not using permit do a regular approval allowing narwhal max balance.
        if (!permit) {
            const approveNarwhal = await permit2.approve(currencyIn.wrapped.address, UNIVERSAL_ROUTER_ADDRESS, MAX_UINT160, 100000000000000);
            await approveNarwhal.wait();
        }
        const transaction = {
            data: methodParameters.calldata,
            to: methodParameters.to,
            value: BigNumber.from(methodParameters.value),
            from: alice.address,
            gasPrice: BigNumber.from(2000000000000),
            type: 1,
        };
        const transactionResponse = await alice.sendTransaction(transaction);
        await transactionResponse.wait();
        const tokenInAfter = await getBalance(alice, currencyIn);
        const tokenOutAfter = await getBalance(alice, currencyOut);
        return {
            tokenInAfter,
            tokenInBefore,
            tokenOutAfter,
            tokenOutBefore,
        };
    };
    before(async function () {
        this.timeout(40000);
        [alice] = await ethers.getSigners();
        // Make a dummy call to the API to get a block number to fork from.
        const quoteReq = {
            tokenInAddress: 'USDC',
            tokenInChainId: 1,
            tokenOutAddress: 'USDT',
            tokenOutChainId: 1,
            amount: await getAmount(1, 'exactIn', 'USDC', 'USDT', '100'),
            type: 'exactIn',
        };
        const { data: { blockNumber }, } = await axios.get(`${API}?${qs.stringify(quoteReq)}`);
        block = parseInt(blockNumber) - 10;
        alice = await resetAndFundAtBlock(alice, block, [
            parseAmount('8000000', USDC_MAINNET),
            parseAmount('5000000', USDT_MAINNET),
            parseAmount('10', WBTC_MAINNET),
            parseAmount('1000', UNI_MAINNET),
            parseAmount('4000', WETH9[1]),
            parseAmount('5000000', DAI_MAINNET),
        ]);
    });
    for (const algorithm of ['alpha']) {
        for (const type of ['exactIn', 'exactOut']) {
            describe(`${ID_TO_NETWORK_NAME(1)} ${algorithm} ${type} 2xx`, () => {
                describe(`+ Execute Swap`, () => {
                    it(`erc20 -> erc20`, async () => {
                        const quoteReq = {
                            tokenInAddress: 'USDC',
                            tokenInChainId: 1,
                            tokenOutAddress: 'USDT',
                            tokenOutChainId: 1,
                            amount: await getAmount(1, type, 'USDC', 'USDT', '100'),
                            type,
                            recipient: alice.address,
                            slippageTolerance: SLIPPAGE,
                            deadline: '360',
                            algorithm,
                            enableUniversalRouter: true,
                        };
                        const queryParams = qs.stringify(quoteReq);
                        const response = await axios.get(`${API}?${queryParams}`);
                        const { data: { quote, quoteDecimals, quoteGasAdjustedDecimals, methodParameters }, status, } = response;
                        expect(status).to.equal(200);
                        expect(parseFloat(quoteDecimals)).to.be.greaterThan(90);
                        expect(parseFloat(quoteDecimals)).to.be.lessThan(110);
                        if (type == 'exactIn') {
                            expect(parseFloat(quoteGasAdjustedDecimals)).to.be.lessThanOrEqual(parseFloat(quoteDecimals));
                        }
                        else {
                            expect(parseFloat(quoteGasAdjustedDecimals)).to.be.greaterThanOrEqual(parseFloat(quoteDecimals));
                        }
                        expect(methodParameters).to.not.be.undefined;
                        expect(methodParameters === null || methodParameters === void 0 ? void 0 : methodParameters.to).to.equal(UNIVERSAL_ROUTER_ADDRESS);
                        const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(methodParameters, USDC_MAINNET, USDT_MAINNET);
                        if (type == 'exactIn') {
                            expect(tokenInBefore.subtract(tokenInAfter).toExact()).to.equal('100');
                            checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(USDT_MAINNET, quote));
                        }
                        else {
                            expect(tokenOutAfter.subtract(tokenOutBefore).toExact()).to.equal('100');
                            checkQuoteToken(tokenInBefore, tokenInAfter, CurrencyAmount.fromRawAmount(USDC_MAINNET, quote));
                        }
                    });
                    it(`erc20 -> erc20 swaprouter02`, async () => {
                        const quoteReq = {
                            tokenInAddress: 'USDC',
                            tokenInChainId: 1,
                            tokenOutAddress: 'USDT',
                            tokenOutChainId: 1,
                            amount: await getAmount(1, type, 'USDC', 'USDT', '100'),
                            type,
                            recipient: alice.address,
                            slippageTolerance: SLIPPAGE,
                            deadline: '360',
                            algorithm,
                        };
                        const queryParams = qs.stringify(quoteReq);
                        const response = await axios.get(`${API}?${queryParams}`);
                        const { data: { quote, quoteDecimals, quoteGasAdjustedDecimals, methodParameters }, status, } = response;
                        expect(status).to.equal(200);
                        expect(parseFloat(quoteDecimals)).to.be.greaterThan(90);
                        expect(parseFloat(quoteDecimals)).to.be.lessThan(110);
                        if (type == 'exactIn') {
                            expect(parseFloat(quoteGasAdjustedDecimals)).to.be.lessThanOrEqual(parseFloat(quoteDecimals));
                        }
                        else {
                            expect(parseFloat(quoteGasAdjustedDecimals)).to.be.greaterThanOrEqual(parseFloat(quoteDecimals));
                        }
                        expect(methodParameters).to.not.be.undefined;
                        expect(methodParameters === null || methodParameters === void 0 ? void 0 : methodParameters.to).to.equal(SWAP_ROUTER_02_ADDRESSES(ChainId.MAINNET));
                        const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(methodParameters, USDC_MAINNET, USDT_MAINNET);
                        if (type == 'exactIn') {
                            expect(tokenInBefore.subtract(tokenInAfter).toExact()).to.equal('100');
                            checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(USDT_MAINNET, quote));
                        }
                        else {
                            expect(tokenOutAfter.subtract(tokenOutBefore).toExact()).to.equal('100');
                            checkQuoteToken(tokenInBefore, tokenInAfter, CurrencyAmount.fromRawAmount(USDC_MAINNET, quote));
                        }
                    });
                    it(`erc20 -> erc20 with permit`, async () => {
                        const amount = await getAmount(1, type, 'USDC', 'USDT', '10');
                        const nonce = nextPermitNonce();
                        const permit = {
                            details: {
                                token: USDC_MAINNET.address,
                                amount: '15000000',
                                expiration: Math.floor(new Date().getTime() / 1000 + 10000000).toString(),
                                nonce,
                            },
                            spender: UNIVERSAL_ROUTER_ADDRESS,
                            sigDeadline: Math.floor(new Date().getTime() / 1000 + 10000000).toString(),
                        };
                        const { domain, types, values } = AllowanceTransfer.getPermitData(permit, PERMIT2_ADDRESS, 1);
                        const signature = await alice._signTypedData(domain, types, values);
                        const quoteReq = {
                            tokenInAddress: 'USDC',
                            tokenInChainId: 1,
                            tokenOutAddress: 'USDT',
                            tokenOutChainId: 1,
                            amount,
                            type,
                            recipient: alice.address,
                            slippageTolerance: SLIPPAGE,
                            deadline: '360',
                            algorithm,
                            permitSignature: signature,
                            permitAmount: permit.details.amount.toString(),
                            permitExpiration: permit.details.expiration.toString(),
                            permitSigDeadline: permit.sigDeadline.toString(),
                            permitNonce: permit.details.nonce.toString(),
                            enableUniversalRouter: true,
                        };
                        const queryParams = qs.stringify(quoteReq);
                        const response = await axios.get(`${API}?${queryParams}`);
                        const { data: { quote, quoteDecimals, quoteGasAdjustedDecimals, methodParameters }, status, } = response;
                        expect(status).to.equal(200);
                        expect(parseFloat(quoteDecimals)).to.be.greaterThan(9);
                        expect(parseFloat(quoteDecimals)).to.be.lessThan(11);
                        if (type == 'exactIn') {
                            expect(parseFloat(quoteGasAdjustedDecimals)).to.be.lessThanOrEqual(parseFloat(quoteDecimals));
                        }
                        else {
                            expect(parseFloat(quoteGasAdjustedDecimals)).to.be.greaterThanOrEqual(parseFloat(quoteDecimals));
                        }
                        expect(methodParameters).to.not.be.undefined;
                        expect(methodParameters === null || methodParameters === void 0 ? void 0 : methodParameters.to).to.equal(UNIVERSAL_ROUTER_ADDRESS);
                        const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(methodParameters, USDC_MAINNET, USDT_MAINNET, true);
                        if (type == 'exactIn') {
                            expect(tokenInBefore.subtract(tokenInAfter).toExact()).to.equal('10');
                            checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(USDT_MAINNET, quote));
                        }
                        else {
                            expect(tokenOutAfter.subtract(tokenOutBefore).toExact()).to.equal('10');
                            checkQuoteToken(tokenInBefore, tokenInAfter, CurrencyAmount.fromRawAmount(USDC_MAINNET, quote));
                        }
                    });
                    it(`erc20 -> eth`, async () => {
                        const quoteReq = {
                            tokenInAddress: 'USDC',
                            tokenInChainId: 1,
                            tokenOutAddress: 'ETH',
                            tokenOutChainId: 1,
                            amount: await getAmount(1, type, 'USDC', 'ETH', type == 'exactIn' ? '1000000' : '10'),
                            type,
                            recipient: alice.address,
                            slippageTolerance: SLIPPAGE,
                            deadline: '360',
                            algorithm,
                            enableUniversalRouter: true,
                        };
                        const queryParams = qs.stringify(quoteReq);
                        const response = await axios.get(`${API}?${queryParams}`);
                        const { data: { quote, methodParameters }, status, } = response;
                        expect(status).to.equal(200);
                        expect(methodParameters).to.not.be.undefined;
                        const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(methodParameters, USDC_MAINNET, Ether.onChain(1));
                        if (type == 'exactIn') {
                            expect(tokenInBefore.subtract(tokenInAfter).toExact()).to.equal('1000000');
                            checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(Ether.onChain(1), quote));
                        }
                        else {
                            // Hard to test ETH balance due to gas costs for approval and swap. Just check tokenIn changes
                            checkQuoteToken(tokenInBefore, tokenInAfter, CurrencyAmount.fromRawAmount(USDC_MAINNET, quote));
                        }
                    });
                    it(`erc20 -> eth large trade`, async () => {
                        // Trade of this size almost always results in splits.
                        const quoteReq = {
                            tokenInAddress: 'USDC',
                            tokenInChainId: 1,
                            tokenOutAddress: 'ETH',
                            tokenOutChainId: 1,
                            amount: type == 'exactIn'
                                ? await getAmount(1, type, 'USDC', 'ETH', '1000000')
                                : await getAmount(1, type, 'USDC', 'ETH', '100'),
                            type,
                            recipient: alice.address,
                            slippageTolerance: SLIPPAGE,
                            deadline: '360',
                            algorithm,
                            enableUniversalRouter: true,
                        };
                        const queryParams = qs.stringify(quoteReq);
                        const response = await axios.get(`${API}?${queryParams}`);
                        const { data, status } = response;
                        expect(status).to.equal(200);
                        expect(data.methodParameters).to.not.be.undefined;
                        expect(data.route).to.not.be.undefined;
                        const amountInEdgesTotal = _(data.route)
                            .flatMap((route) => route[0])
                            .filter((pool) => !!pool.amountIn)
                            .map((pool) => BigNumber.from(pool.amountIn))
                            .reduce((cur, total) => total.add(cur), BigNumber.from(0));
                        const amountIn = BigNumber.from(data.quote);
                        expect(amountIn.eq(amountInEdgesTotal));
                        const amountOutEdgesTotal = _(data.route)
                            .flatMap((route) => route[0])
                            .filter((pool) => !!pool.amountOut)
                            .map((pool) => BigNumber.from(pool.amountOut))
                            .reduce((cur, total) => total.add(cur), BigNumber.from(0));
                        const amountOut = BigNumber.from(data.quote);
                        expect(amountOut.eq(amountOutEdgesTotal));
                        const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(data.methodParameters, USDC_MAINNET, Ether.onChain(1));
                        if (type == 'exactIn') {
                            expect(tokenInBefore.subtract(tokenInAfter).toExact()).to.equal('1000000');
                            checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(Ether.onChain(1), data.quote));
                        }
                        else {
                            // Hard to test ETH balance due to gas costs for approval and swap. Just check tokenIn changes
                            checkQuoteToken(tokenInBefore, tokenInAfter, CurrencyAmount.fromRawAmount(USDC_MAINNET, data.quote));
                        }
                    });
                    it(`erc20 -> eth large trade with permit`, async () => {
                        const nonce = nextPermitNonce();
                        const amount = type == 'exactIn'
                            ? await getAmount(1, type, 'USDC', 'ETH', '1000000')
                            : await getAmount(1, type, 'USDC', 'ETH', '100');
                        const permit = {
                            details: {
                                token: USDC_MAINNET.address,
                                amount: '1500000000000',
                                expiration: Math.floor(new Date().getTime() / 1000 + 10000000).toString(),
                                nonce,
                            },
                            spender: UNIVERSAL_ROUTER_ADDRESS,
                            sigDeadline: Math.floor(new Date().getTime() / 1000 + 10000000).toString(),
                        };
                        const { domain, types, values } = AllowanceTransfer.getPermitData(permit, PERMIT2_ADDRESS, 1);
                        const signature = await alice._signTypedData(domain, types, values);
                        // Trade of this size almost always results in splits.
                        const quoteReq = {
                            tokenInAddress: 'USDC',
                            tokenInChainId: 1,
                            tokenOutAddress: 'ETH',
                            tokenOutChainId: 1,
                            amount,
                            type,
                            recipient: alice.address,
                            slippageTolerance: SLIPPAGE,
                            deadline: '360',
                            algorithm,
                            permitSignature: signature,
                            permitAmount: permit.details.amount.toString(),
                            permitExpiration: permit.details.expiration.toString(),
                            permitSigDeadline: permit.sigDeadline.toString(),
                            permitNonce: permit.details.nonce.toString(),
                            enableUniversalRouter: true,
                        };
                        const queryParams = qs.stringify(quoteReq);
                        const response = await axios.get(`${API}?${queryParams}`);
                        const { data, status } = response;
                        expect(status).to.equal(200);
                        expect(data.methodParameters).to.not.be.undefined;
                        expect(data.route).to.not.be.undefined;
                        const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(data.methodParameters, USDC_MAINNET, Ether.onChain(1), true);
                        if (type == 'exactIn') {
                            expect(tokenInBefore.subtract(tokenInAfter).toExact()).to.equal('1000000');
                            checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(Ether.onChain(1), data.quote));
                        }
                        else {
                            // Hard to test ETH balance due to gas costs for approval and swap. Just check tokenIn changes
                            checkQuoteToken(tokenInBefore, tokenInAfter, CurrencyAmount.fromRawAmount(USDC_MAINNET, data.quote));
                        }
                    });
                    it(`eth -> erc20`, async () => {
                        const quoteReq = {
                            tokenInAddress: 'ETH',
                            tokenInChainId: 1,
                            tokenOutAddress: 'UNI',
                            tokenOutChainId: 1,
                            amount: type == 'exactIn'
                                ? await getAmount(1, type, 'ETH', 'UNI', '10')
                                : await getAmount(1, type, 'ETH', 'UNI', '10000'),
                            type,
                            recipient: alice.address,
                            slippageTolerance: SLIPPAGE,
                            deadline: '360',
                            algorithm,
                            enableUniversalRouter: true,
                        };
                        const queryParams = qs.stringify(quoteReq);
                        const response = await axios.get(`${API}?${queryParams}`);
                        const { data, status } = response;
                        expect(status).to.equal(200);
                        expect(data.methodParameters).to.not.be.undefined;
                        const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(data.methodParameters, Ether.onChain(1), UNI_MAINNET);
                        if (type == 'exactIn') {
                            // We've swapped 10 ETH + gas costs
                            expect(tokenInBefore.subtract(tokenInAfter).greaterThan(parseAmount('10', Ether.onChain(1)))).to.be.true;
                            checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(UNI_MAINNET, data.quote));
                        }
                        else {
                            expect(tokenOutAfter.subtract(tokenOutBefore).toExact()).to.equal('10000');
                            // Can't easily check slippage for ETH due to gas costs effecting ETH balance.
                        }
                    });
                    it(`eth -> erc20 swaprouter02`, async () => {
                        var _a;
                        const quoteReq = {
                            tokenInAddress: 'ETH',
                            tokenInChainId: 1,
                            tokenOutAddress: 'UNI',
                            tokenOutChainId: 1,
                            amount: type == 'exactIn'
                                ? await getAmount(1, type, 'ETH', 'UNI', '10')
                                : await getAmount(1, type, 'ETH', 'UNI', '10000'),
                            type,
                            recipient: alice.address,
                            slippageTolerance: type == 'exactOut' ? LARGE_SLIPPAGE : SLIPPAGE,
                            deadline: '360',
                            algorithm,
                            enableUniversalRouter: false,
                        };
                        const queryParams = qs.stringify(quoteReq);
                        const response = await axios.get(`${API}?${queryParams}`);
                        const { data, status } = response;
                        expect(status).to.equal(200);
                        expect(data.methodParameters).to.not.be.undefined;
                        expect((_a = data.methodParameters) === null || _a === void 0 ? void 0 : _a.to).to.equal(SWAP_ROUTER_02_ADDRESSES(ChainId.MAINNET));
                        const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(data.methodParameters, Ether.onChain(1), UNI_MAINNET);
                        if (type == 'exactIn') {
                            // We've swapped 10 ETH + gas costs
                            expect(tokenInBefore.subtract(tokenInAfter).greaterThan(parseAmount('10', Ether.onChain(1)))).to.be.true;
                            checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(UNI_MAINNET, data.quote));
                        }
                        else {
                            expect(tokenOutAfter.subtract(tokenOutBefore).toExact()).to.equal('10000');
                            // Can't easily check slippage for ETH due to gas costs effecting ETH balance.
                        }
                    });
                    it(`weth -> erc20`, async () => {
                        const quoteReq = {
                            tokenInAddress: 'WETH',
                            tokenInChainId: 1,
                            tokenOutAddress: 'DAI',
                            tokenOutChainId: 1,
                            amount: await getAmount(1, type, 'WETH', 'DAI', '100'),
                            type,
                            recipient: alice.address,
                            slippageTolerance: SLIPPAGE,
                            deadline: '360',
                            algorithm,
                            enableUniversalRouter: true,
                        };
                        const queryParams = qs.stringify(quoteReq);
                        const response = await axios.get(`${API}?${queryParams}`);
                        const { data, status } = response;
                        expect(status).to.equal(200);
                        expect(data.methodParameters).to.not.be.undefined;
                        const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(data.methodParameters, WETH9[1], DAI_MAINNET);
                        if (type == 'exactIn') {
                            expect(tokenInBefore.subtract(tokenInAfter).toExact()).to.equal('100');
                            checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(DAI_MAINNET, data.quote));
                        }
                        else {
                            expect(tokenOutAfter.subtract(tokenOutBefore).toExact()).to.equal('100');
                            checkQuoteToken(tokenInBefore, tokenInAfter, CurrencyAmount.fromRawAmount(WETH9[1], data.quote));
                        }
                    });
                    it(`erc20 -> weth`, async () => {
                        const quoteReq = {
                            tokenInAddress: 'USDC',
                            tokenInChainId: 1,
                            tokenOutAddress: 'WETH',
                            tokenOutChainId: 1,
                            amount: await getAmount(1, type, 'USDC', 'WETH', '100'),
                            type,
                            recipient: alice.address,
                            slippageTolerance: SLIPPAGE,
                            deadline: '360',
                            algorithm,
                            enableUniversalRouter: true,
                        };
                        const queryParams = qs.stringify(quoteReq);
                        const response = await axios.get(`${API}?${queryParams}`);
                        const { data, status } = response;
                        expect(status).to.equal(200);
                        expect(data.methodParameters).to.not.be.undefined;
                        const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(data.methodParameters, USDC_MAINNET, WETH9[1]);
                        if (type == 'exactIn') {
                            expect(tokenInBefore.subtract(tokenInAfter).toExact()).to.equal('100');
                            checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(WETH9[1], data.quote));
                        }
                        else {
                            expect(tokenOutAfter.subtract(tokenOutBefore).toExact()).to.equal('100');
                            checkQuoteToken(tokenInBefore, tokenInAfter, CurrencyAmount.fromRawAmount(USDC_MAINNET, data.quote));
                        }
                    });
                    if (algorithm == 'alpha') {
                        it(`erc20 -> erc20 v3 only`, async () => {
                            const quoteReq = {
                                tokenInAddress: 'USDC',
                                tokenInChainId: 1,
                                tokenOutAddress: 'USDT',
                                tokenOutChainId: 1,
                                amount: await getAmount(1, type, 'USDC', 'USDT', '100'),
                                type,
                                recipient: alice.address,
                                slippageTolerance: SLIPPAGE,
                                deadline: '360',
                                algorithm: 'alpha',
                                protocols: 'v3',
                                enableUniversalRouter: true,
                            };
                            const queryParams = qs.stringify(quoteReq);
                            const response = await axios.get(`${API}?${queryParams}`);
                            const { data: { quote, quoteDecimals, quoteGasAdjustedDecimals, methodParameters, route }, status, } = response;
                            expect(status).to.equal(200);
                            expect(parseFloat(quoteDecimals)).to.be.greaterThan(90);
                            expect(parseFloat(quoteDecimals)).to.be.lessThan(110);
                            if (type == 'exactIn') {
                                expect(parseFloat(quoteGasAdjustedDecimals)).to.be.lessThanOrEqual(parseFloat(quoteDecimals));
                            }
                            else {
                                expect(parseFloat(quoteGasAdjustedDecimals)).to.be.greaterThanOrEqual(parseFloat(quoteDecimals));
                            }
                            expect(methodParameters).to.not.be.undefined;
                            for (const r of route) {
                                for (const pool of r) {
                                    expect(pool.type).to.equal('v3-pool');
                                }
                            }
                            const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(response.data.methodParameters, USDC_MAINNET, USDT_MAINNET);
                            if (type == 'exactIn') {
                                expect(tokenInBefore.subtract(tokenInAfter).toExact()).to.equal('100');
                                checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(USDT_MAINNET, quote));
                            }
                            else {
                                expect(tokenOutAfter.subtract(tokenOutBefore).toExact()).to.equal('100');
                                checkQuoteToken(tokenInBefore, tokenInAfter, CurrencyAmount.fromRawAmount(USDC_MAINNET, quote));
                            }
                        });
                        it(`erc20 -> erc20 v2 only`, async () => {
                            const quoteReq = {
                                tokenInAddress: 'USDC',
                                tokenInChainId: 1,
                                tokenOutAddress: 'USDT',
                                tokenOutChainId: 1,
                                amount: await getAmount(1, type, 'USDC', 'USDT', '100'),
                                type,
                                recipient: alice.address,
                                slippageTolerance: SLIPPAGE,
                                deadline: '360',
                                algorithm: 'alpha',
                                protocols: 'v2',
                                enableUniversalRouter: true,
                            };
                            const queryParams = qs.stringify(quoteReq);
                            const response = await axios.get(`${API}?${queryParams}`);
                            const { data: { quote, quoteDecimals, quoteGasAdjustedDecimals, methodParameters, route }, status, } = response;
                            expect(status).to.equal(200);
                            expect(parseFloat(quoteDecimals)).to.be.greaterThan(90);
                            expect(parseFloat(quoteDecimals)).to.be.lessThan(110);
                            if (type == 'exactIn') {
                                expect(parseFloat(quoteGasAdjustedDecimals)).to.be.lessThanOrEqual(parseFloat(quoteDecimals));
                            }
                            else {
                                expect(parseFloat(quoteGasAdjustedDecimals)).to.be.greaterThanOrEqual(parseFloat(quoteDecimals));
                            }
                            expect(methodParameters).to.not.be.undefined;
                            for (const r of route) {
                                for (const pool of r) {
                                    expect(pool.type).to.equal('v2-pool');
                                }
                            }
                            const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(response.data.methodParameters, USDC_MAINNET, USDT_MAINNET);
                            if (type == 'exactIn') {
                                expect(tokenInBefore.subtract(tokenInAfter).toExact()).to.equal('100');
                                checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(USDT_MAINNET, quote));
                            }
                            else {
                                expect(tokenOutAfter.subtract(tokenOutBefore).toExact()).to.equal('100');
                                checkQuoteToken(tokenInBefore, tokenInAfter, CurrencyAmount.fromRawAmount(USDC_MAINNET, quote));
                            }
                        });
                        it(`erc20 -> erc20 forceCrossProtocol`, async () => {
                            const quoteReq = {
                                tokenInAddress: 'USDC',
                                tokenInChainId: 1,
                                tokenOutAddress: 'USDT',
                                tokenOutChainId: 1,
                                amount: await getAmount(1, type, 'USDC', 'USDT', '100'),
                                type,
                                recipient: alice.address,
                                slippageTolerance: SLIPPAGE,
                                deadline: '360',
                                algorithm: 'alpha',
                                forceCrossProtocol: true,
                                enableUniversalRouter: true,
                            };
                            const queryParams = qs.stringify(quoteReq);
                            const response = await axios.get(`${API}?${queryParams}`);
                            const { data: { quote, quoteDecimals, quoteGasAdjustedDecimals, methodParameters, route }, status, } = response;
                            expect(status).to.equal(200);
                            expect(parseFloat(quoteDecimals)).to.be.greaterThan(90);
                            expect(parseFloat(quoteDecimals)).to.be.lessThan(110);
                            if (type == 'exactIn') {
                                expect(parseFloat(quoteGasAdjustedDecimals)).to.be.lessThanOrEqual(parseFloat(quoteDecimals));
                            }
                            else {
                                expect(parseFloat(quoteGasAdjustedDecimals)).to.be.greaterThanOrEqual(parseFloat(quoteDecimals));
                            }
                            expect(methodParameters).to.not.be.undefined;
                            let hasV3Pool = false;
                            let hasV2Pool = false;
                            for (const r of route) {
                                for (const pool of r) {
                                    if (pool.type == 'v3-pool') {
                                        hasV3Pool = true;
                                    }
                                    if (pool.type == 'v2-pool') {
                                        hasV2Pool = true;
                                    }
                                }
                            }
                            expect(hasV3Pool && hasV2Pool).to.be.true;
                            const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(response.data.methodParameters, USDC_MAINNET, USDT_MAINNET);
                            if (type == 'exactIn') {
                                expect(tokenInBefore.subtract(tokenInAfter).toExact()).to.equal('100');
                                checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(USDT_MAINNET, quote));
                            }
                            else {
                                expect(tokenOutAfter.subtract(tokenOutBefore).toExact()).to.equal('100');
                                checkQuoteToken(tokenInBefore, tokenInAfter, CurrencyAmount.fromRawAmount(USDC_MAINNET, quote));
                            }
                        });
                        /// Tests for routes likely to result in MixedRoutes being returned
                        if (type === 'exactIn') {
                            it(`erc20 -> erc20 forceMixedRoutes not specified for v2,v3 does not return mixed route even when it is better`, async () => {
                                const quoteReq = {
                                    tokenInAddress: 'BOND',
                                    tokenInChainId: 1,
                                    tokenOutAddress: 'APE',
                                    tokenOutChainId: 1,
                                    amount: await getAmount(1, type, 'BOND', 'APE', '10000'),
                                    type,
                                    recipient: alice.address,
                                    slippageTolerance: SLIPPAGE,
                                    deadline: '360',
                                    algorithm: 'alpha',
                                    protocols: 'v2,v3',
                                    enableUniversalRouter: true,
                                };
                                const queryParams = qs.stringify(quoteReq);
                                const response = await axios.get(`${API}?${queryParams}`);
                                const { data: { quoteDecimals, quoteGasAdjustedDecimals, methodParameters, routeString }, status, } = response;
                                expect(status).to.equal(200);
                                if (type == 'exactIn') {
                                    expect(parseFloat(quoteGasAdjustedDecimals)).to.be.lessThanOrEqual(parseFloat(quoteDecimals));
                                }
                                else {
                                    expect(parseFloat(quoteGasAdjustedDecimals)).to.be.greaterThanOrEqual(parseFloat(quoteDecimals));
                                }
                                expect(methodParameters).to.not.be.undefined;
                                expect(!routeString.includes('[V2 + V3]'));
                            });
                            it(`erc20 -> erc20 forceMixedRoutes true for v2,v3`, async () => {
                                const quoteReq = {
                                    tokenInAddress: 'BOND',
                                    tokenInChainId: 1,
                                    tokenOutAddress: 'APE',
                                    tokenOutChainId: 1,
                                    amount: await getAmount(1, type, 'BOND', 'APE', '10000'),
                                    type,
                                    recipient: alice.address,
                                    slippageTolerance: SLIPPAGE,
                                    deadline: '360',
                                    algorithm: 'alpha',
                                    forceMixedRoutes: true,
                                    protocols: 'v2,v3',
                                    enableUniversalRouter: true,
                                };
                                await callAndExpectFail(quoteReq, {
                                    status: 404,
                                    data: {
                                        detail: 'No route found',
                                        errorCode: 'NO_ROUTE',
                                    },
                                });
                            });
                            it.skip(`erc20 -> erc20 forceMixedRoutes true for all protocols specified`, async () => {
                                const quoteReq = {
                                    tokenInAddress: 'BOND',
                                    tokenInChainId: 1,
                                    tokenOutAddress: 'APE',
                                    tokenOutChainId: 1,
                                    amount: await getAmount(1, type, 'BOND', 'APE', '10000'),
                                    type,
                                    recipient: alice.address,
                                    slippageTolerance: SLIPPAGE,
                                    deadline: '360',
                                    algorithm: 'alpha',
                                    forceMixedRoutes: true,
                                    protocols: 'v2,v3,mixed',
                                    enableUniversalRouter: true,
                                };
                                const queryParams = qs.stringify(quoteReq);
                                const response = await axios.get(`${API}?${queryParams}`);
                                const { data: { quoteDecimals, quoteGasAdjustedDecimals, methodParameters, routeString }, status, } = response;
                                expect(status).to.equal(200);
                                if (type == 'exactIn') {
                                    expect(parseFloat(quoteGasAdjustedDecimals)).to.be.lessThanOrEqual(parseFloat(quoteDecimals));
                                }
                                else {
                                    expect(parseFloat(quoteGasAdjustedDecimals)).to.be.greaterThanOrEqual(parseFloat(quoteDecimals));
                                }
                                expect(methodParameters).to.not.be.undefined;
                                /// since we only get the routeString back, we can check if there's V3 + V2
                                expect(routeString.includes('[V2 + V3]'));
                            });
                        }
                    }
                });
                if (algorithm == 'alpha') {
                    describe(`+ Simulate Swap + Execute Swap`, () => {
                        it(`erc20 -> erc20`, async () => {
                            const quoteReq = {
                                tokenInAddress: 'USDC',
                                tokenInChainId: 1,
                                tokenOutAddress: 'USDT',
                                tokenOutChainId: 1,
                                amount: await getAmount(1, type, 'USDC', 'USDT', '100'),
                                type,
                                recipient: alice.address,
                                slippageTolerance: SLIPPAGE,
                                deadline: '360',
                                algorithm,
                                simulateFromAddress: '0xf584f8728b874a6a5c7a8d4d387c9aae9172d621',
                                enableUniversalRouter: true,
                            };
                            const queryParams = qs.stringify(quoteReq);
                            const response = await axios.get(`${API}?${queryParams}`);
                            const { data: { quote, quoteDecimals, quoteGasAdjustedDecimals, methodParameters, simulationError }, status, } = response;
                            expect(status).to.equal(200);
                            expect(simulationError).to.equal(false);
                            expect(parseFloat(quoteDecimals)).to.be.greaterThan(90);
                            expect(parseFloat(quoteDecimals)).to.be.lessThan(110);
                            if (type == 'exactIn') {
                                expect(parseFloat(quoteGasAdjustedDecimals)).to.be.lessThanOrEqual(parseFloat(quoteDecimals));
                            }
                            else {
                                expect(parseFloat(quoteGasAdjustedDecimals)).to.be.greaterThanOrEqual(parseFloat(quoteDecimals));
                            }
                            expect(methodParameters).to.not.be.undefined;
                            const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(methodParameters, USDC_MAINNET, USDT_MAINNET);
                            if (type == 'exactIn') {
                                expect(tokenInBefore.subtract(tokenInAfter).toExact()).to.equal('100');
                                checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(USDT_MAINNET, quote));
                            }
                            else {
                                expect(tokenOutAfter.subtract(tokenOutBefore).toExact()).to.equal('100');
                                checkQuoteToken(tokenInBefore, tokenInAfter, CurrencyAmount.fromRawAmount(USDC_MAINNET, quote));
                            }
                        });
                        it(`erc20 -> erc20 swaprouter02`, async () => {
                            const quoteReq = {
                                tokenInAddress: 'USDC',
                                tokenInChainId: 1,
                                tokenOutAddress: 'USDT',
                                tokenOutChainId: 1,
                                amount: await getAmount(1, type, 'USDC', 'USDT', '100'),
                                type,
                                recipient: alice.address,
                                slippageTolerance: SLIPPAGE,
                                deadline: '360',
                                algorithm,
                                simulateFromAddress: '0xf584f8728b874a6a5c7a8d4d387c9aae9172d621',
                            };
                            const queryParams = qs.stringify(quoteReq);
                            const response = await axios.get(`${API}?${queryParams}`);
                            const { data: { quote, quoteDecimals, quoteGasAdjustedDecimals, methodParameters, simulationError }, status, } = response;
                            expect(status).to.equal(200);
                            expect(simulationError).to.equal(false);
                            expect(parseFloat(quoteDecimals)).to.be.greaterThan(90);
                            expect(parseFloat(quoteDecimals)).to.be.lessThan(110);
                            if (type == 'exactIn') {
                                expect(parseFloat(quoteGasAdjustedDecimals)).to.be.lessThanOrEqual(parseFloat(quoteDecimals));
                            }
                            else {
                                expect(parseFloat(quoteGasAdjustedDecimals)).to.be.greaterThanOrEqual(parseFloat(quoteDecimals));
                            }
                            expect(methodParameters).to.not.be.undefined;
                            expect(methodParameters.to).to.equal(SWAP_ROUTER_02_ADDRESSES(ChainId.MAINNET));
                            const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(methodParameters, USDC_MAINNET, USDT_MAINNET);
                            if (type == 'exactIn') {
                                expect(tokenInBefore.subtract(tokenInAfter).toExact()).to.equal('100');
                                checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(USDT_MAINNET, quote));
                            }
                            else {
                                expect(tokenOutAfter.subtract(tokenOutBefore).toExact()).to.equal('100');
                                checkQuoteToken(tokenInBefore, tokenInAfter, CurrencyAmount.fromRawAmount(USDC_MAINNET, quote));
                            }
                        });
                        if (isTesterPKEnvironmentSet()) {
                            it(`erc20 -> erc20 with permit with tester pk`, async () => {
                                // This test requires a private key with at least 10 USDC
                                // at FORK_BLOCK time.
                                const amount = await getAmount(1, type, 'USDC', 'USDT', '10');
                                const nonce = '0';
                                const permit = {
                                    details: {
                                        token: USDC_MAINNET.address,
                                        amount: amount,
                                        expiration: Math.floor(new Date().getTime() / 1000 + 10000000).toString(),
                                        nonce,
                                    },
                                    spender: UNIVERSAL_ROUTER_ADDRESS,
                                    sigDeadline: Math.floor(new Date().getTime() / 1000 + 10000000).toString(),
                                };
                                const wallet = new Wallet(process.env.TESTER_PK);
                                const { domain, types, values } = AllowanceTransfer.getPermitData(permit, PERMIT2_ADDRESS, 1);
                                const signature = await wallet._signTypedData(domain, types, values);
                                const quoteReq = {
                                    tokenInAddress: 'USDC',
                                    tokenInChainId: 1,
                                    tokenOutAddress: 'USDT',
                                    tokenOutChainId: 1,
                                    amount,
                                    type,
                                    recipient: wallet.address,
                                    slippageTolerance: SLIPPAGE,
                                    deadline: '360',
                                    algorithm,
                                    simulateFromAddress: wallet.address,
                                    permitSignature: signature,
                                    permitAmount: permit.details.amount.toString(),
                                    permitExpiration: permit.details.expiration.toString(),
                                    permitSigDeadline: permit.sigDeadline.toString(),
                                    permitNonce: permit.details.nonce.toString(),
                                    enableUniversalRouter: true,
                                };
                                const queryParams = qs.stringify(quoteReq);
                                const response = await axios.get(`${API}?${queryParams}`);
                                const { data: { quoteDecimals, quoteGasAdjustedDecimals, methodParameters, simulationError }, status, } = response;
                                expect(status).to.equal(200);
                                expect(simulationError).to.equal(false);
                                expect(parseFloat(quoteDecimals)).to.be.greaterThan(9);
                                expect(parseFloat(quoteDecimals)).to.be.lessThan(11);
                                if (type == 'exactIn') {
                                    expect(parseFloat(quoteGasAdjustedDecimals)).to.be.lessThanOrEqual(parseFloat(quoteDecimals));
                                }
                                else {
                                    expect(parseFloat(quoteGasAdjustedDecimals)).to.be.greaterThanOrEqual(parseFloat(quoteDecimals));
                                }
                                expect(methodParameters).to.not.be.undefined;
                            });
                        }
                        it(`erc20 -> eth`, async () => {
                            const quoteReq = {
                                tokenInAddress: 'USDC',
                                tokenInChainId: 1,
                                tokenOutAddress: 'ETH',
                                tokenOutChainId: 1,
                                amount: await getAmount(1, type, 'USDC', 'ETH', type == 'exactIn' ? '1000000' : '10'),
                                type,
                                recipient: alice.address,
                                slippageTolerance: SLIPPAGE,
                                deadline: '360',
                                algorithm,
                                simulateFromAddress: '0xf584f8728b874a6a5c7a8d4d387c9aae9172d621',
                                enableUniversalRouter: true,
                            };
                            const queryParams = qs.stringify(quoteReq);
                            const response = await axios.get(`${API}?${queryParams}`);
                            const { data: { quote, methodParameters, simulationError }, status, } = response;
                            expect(status).to.equal(200);
                            expect(simulationError).to.equal(false);
                            expect(methodParameters).to.not.be.undefined;
                            const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(methodParameters, USDC_MAINNET, Ether.onChain(1));
                            if (type == 'exactIn') {
                                expect(tokenInBefore.subtract(tokenInAfter).toExact()).to.equal('1000000');
                                checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(Ether.onChain(1), quote));
                            }
                            else {
                                // Hard to test ETH balance due to gas costs for approval and swap. Just check tokenIn changes
                                checkQuoteToken(tokenInBefore, tokenInAfter, CurrencyAmount.fromRawAmount(USDC_MAINNET, quote));
                            }
                        });
                        it(`erc20 -> eth large trade`, async () => {
                            // Trade of this size almost always results in splits.
                            const quoteReq = {
                                tokenInAddress: 'USDC',
                                tokenInChainId: 1,
                                tokenOutAddress: 'ETH',
                                tokenOutChainId: 1,
                                amount: type == 'exactIn'
                                    ? await getAmount(1, type, 'USDC', 'ETH', '1000000')
                                    : await getAmount(1, type, 'USDC', 'ETH', '100'),
                                type,
                                recipient: alice.address,
                                slippageTolerance: SLIPPAGE,
                                deadline: '360',
                                algorithm,
                                simulateFromAddress: '0xf584f8728b874a6a5c7a8d4d387c9aae9172d621',
                                enableUniversalRouter: true,
                            };
                            const queryParams = qs.stringify(quoteReq);
                            const response = await axios.get(`${API}?${queryParams}`);
                            const { data, status } = response;
                            expect(status).to.equal(200);
                            expect(data.simulationError).to.equal(false);
                            expect(data.methodParameters).to.not.be.undefined;
                            expect(data.route).to.not.be.undefined;
                            const amountInEdgesTotal = _(data.route)
                                .flatMap((route) => route[0])
                                .filter((pool) => !!pool.amountIn)
                                .map((pool) => BigNumber.from(pool.amountIn))
                                .reduce((cur, total) => total.add(cur), BigNumber.from(0));
                            const amountIn = BigNumber.from(data.quote);
                            expect(amountIn.eq(amountInEdgesTotal));
                            const amountOutEdgesTotal = _(data.route)
                                .flatMap((route) => route[0])
                                .filter((pool) => !!pool.amountOut)
                                .map((pool) => BigNumber.from(pool.amountOut))
                                .reduce((cur, total) => total.add(cur), BigNumber.from(0));
                            const amountOut = BigNumber.from(data.quote);
                            expect(amountOut.eq(amountOutEdgesTotal));
                            const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(data.methodParameters, USDC_MAINNET, Ether.onChain(1));
                            if (type == 'exactIn') {
                                expect(tokenInBefore.subtract(tokenInAfter).toExact()).to.equal('1000000');
                                checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(Ether.onChain(1), data.quote));
                            }
                            else {
                                // Hard to test ETH balance due to gas costs for approval and swap. Just check tokenIn changes
                                checkQuoteToken(tokenInBefore, tokenInAfter, CurrencyAmount.fromRawAmount(USDC_MAINNET, data.quote));
                            }
                        });
                        it(`eth -> erc20`, async () => {
                            const quoteReq = {
                                tokenInAddress: 'ETH',
                                tokenInChainId: 1,
                                tokenOutAddress: 'UNI',
                                tokenOutChainId: 1,
                                amount: type == 'exactIn'
                                    ? await getAmount(1, type, 'ETH', 'UNI', '10')
                                    : await getAmount(1, type, 'ETH', 'UNI', '10000'),
                                type,
                                recipient: alice.address,
                                slippageTolerance: type == 'exactOut' ? LARGE_SLIPPAGE : SLIPPAGE,
                                deadline: '360',
                                algorithm,
                                simulateFromAddress: '0x0716a17FBAeE714f1E6aB0f9d59edbC5f09815C0',
                                enableUniversalRouter: true,
                            };
                            const queryParams = qs.stringify(quoteReq);
                            const response = await axios.get(`${API}?${queryParams}`);
                            const { data, status } = response;
                            expect(status).to.equal(200);
                            expect(data.simulationError).to.equal(false);
                            expect(data.methodParameters).to.not.be.undefined;
                            const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(data.methodParameters, Ether.onChain(1), UNI_MAINNET);
                            if (type == 'exactIn') {
                                // We've swapped 10 ETH + gas costs
                                expect(tokenInBefore.subtract(tokenInAfter).greaterThan(parseAmount('10', Ether.onChain(1)))).to.be.true;
                                checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(UNI_MAINNET, data.quote));
                            }
                            else {
                                expect(tokenOutAfter.subtract(tokenOutBefore).toExact()).to.equal('10000');
                                // Can't easily check slippage for ETH due to gas costs effecting ETH balance.
                            }
                        });
                        it(`eth -> erc20 swaprouter02`, async () => {
                            const quoteReq = {
                                tokenInAddress: 'ETH',
                                tokenInChainId: 1,
                                tokenOutAddress: 'UNI',
                                tokenOutChainId: 1,
                                amount: type == 'exactIn'
                                    ? await getAmount(1, type, 'ETH', 'UNI', '10')
                                    : await getAmount(1, type, 'ETH', 'UNI', '10000'),
                                type,
                                recipient: alice.address,
                                slippageTolerance: type == 'exactOut' ? LARGE_SLIPPAGE : SLIPPAGE,
                                deadline: '360',
                                algorithm,
                                simulateFromAddress: '0x0716a17FBAeE714f1E6aB0f9d59edbC5f09815C0',
                                enableUniversalRouter: false,
                            };
                            const queryParams = qs.stringify(quoteReq);
                            const response = await axios.get(`${API}?${queryParams}`);
                            const { data, status } = response;
                            expect(status).to.equal(200);
                            expect(data.simulationError).to.equal(false);
                            expect(data.methodParameters).to.not.be.undefined;
                            const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(data.methodParameters, Ether.onChain(1), UNI_MAINNET);
                            if (type == 'exactIn') {
                                // We've swapped 10 ETH + gas costs
                                expect(tokenInBefore.subtract(tokenInAfter).greaterThan(parseAmount('10', Ether.onChain(1)))).to.be.true;
                                checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(UNI_MAINNET, data.quote));
                            }
                            else {
                                expect(tokenOutAfter.subtract(tokenOutBefore).toExact()).to.equal('10000');
                                // Can't easily check slippage for ETH due to gas costs effecting ETH balance.
                            }
                        });
                        it(`weth -> erc20`, async () => {
                            const quoteReq = {
                                tokenInAddress: 'WETH',
                                tokenInChainId: 1,
                                tokenOutAddress: 'DAI',
                                tokenOutChainId: 1,
                                amount: await getAmount(1, type, 'WETH', 'DAI', '100'),
                                type,
                                recipient: alice.address,
                                slippageTolerance: SLIPPAGE,
                                deadline: '360',
                                algorithm,
                                simulateFromAddress: '0xf04a5cc80b1e94c69b48f5ee68a08cd2f09a7c3e',
                                enableUniversalRouter: true,
                            };
                            const queryParams = qs.stringify(quoteReq);
                            const response = await axios.get(`${API}?${queryParams}`);
                            const { data, status } = response;
                            expect(status).to.equal(200);
                            expect(data.simulationError).to.equal(false);
                            expect(data.methodParameters).to.not.be.undefined;
                            const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(data.methodParameters, WETH9[1], DAI_MAINNET);
                            if (type == 'exactIn') {
                                expect(tokenInBefore.subtract(tokenInAfter).toExact()).to.equal('100');
                                checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(DAI_MAINNET, data.quote));
                            }
                            else {
                                expect(tokenOutAfter.subtract(tokenOutBefore).toExact()).to.equal('100');
                                checkQuoteToken(tokenInBefore, tokenInAfter, CurrencyAmount.fromRawAmount(WETH9[1], data.quote));
                            }
                        });
                        it(`erc20 -> weth`, async () => {
                            const quoteReq = {
                                tokenInAddress: 'USDC',
                                tokenInChainId: 1,
                                tokenOutAddress: 'WETH',
                                tokenOutChainId: 1,
                                amount: await getAmount(1, type, 'USDC', 'WETH', '100'),
                                type,
                                recipient: alice.address,
                                slippageTolerance: SLIPPAGE,
                                deadline: '360',
                                algorithm,
                                simulateFromAddress: '0xf584f8728b874a6a5c7a8d4d387c9aae9172d621',
                                enableUniversalRouter: true,
                            };
                            const queryParams = qs.stringify(quoteReq);
                            const response = await axios.get(`${API}?${queryParams}`);
                            const { data, status } = response;
                            expect(status).to.equal(200);
                            expect(data.simulationError).to.equal(false);
                            expect(data.methodParameters).to.not.be.undefined;
                            const { tokenInBefore, tokenInAfter, tokenOutBefore, tokenOutAfter } = await executeSwap(data.methodParameters, USDC_MAINNET, WETH9[1]);
                            if (type == 'exactIn') {
                                expect(tokenInBefore.subtract(tokenInAfter).toExact()).to.equal('100');
                                checkQuoteToken(tokenOutBefore, tokenOutAfter, CurrencyAmount.fromRawAmount(WETH9[1], data.quote));
                            }
                            else {
                                expect(tokenOutAfter.subtract(tokenOutBefore).toExact()).to.equal('100');
                                checkQuoteToken(tokenInBefore, tokenInAfter, CurrencyAmount.fromRawAmount(USDC_MAINNET, data.quote));
                            }
                        });
                    });
                }
                it(`erc20 -> erc20 no recipient/deadline/slippage`, async () => {
                    const quoteReq = {
                        tokenInAddress: 'USDC',
                        tokenInChainId: 1,
                        tokenOutAddress: 'USDT',
                        tokenOutChainId: 1,
                        amount: await getAmount(1, type, 'USDC', 'USDT', '100'),
                        type,
                        algorithm,
                        enableUniversalRouter: true,
                    };
                    const queryParams = qs.stringify(quoteReq);
                    const response = await axios.get(`${API}?${queryParams}`);
                    const { data: { quoteDecimals, quoteGasAdjustedDecimals, methodParameters }, status, } = response;
                    expect(status).to.equal(200);
                    expect(parseFloat(quoteDecimals)).to.be.greaterThan(90);
                    expect(parseFloat(quoteDecimals)).to.be.lessThan(110);
                    if (type == 'exactIn') {
                        expect(parseFloat(quoteGasAdjustedDecimals)).to.be.lessThanOrEqual(parseFloat(quoteDecimals));
                    }
                    else {
                        expect(parseFloat(quoteGasAdjustedDecimals)).to.be.greaterThanOrEqual(parseFloat(quoteDecimals));
                    }
                    expect(methodParameters).to.be.undefined;
                });
                it(`erc20 -> erc20 gas price specified`, async () => {
                    const quoteReq = {
                        tokenInAddress: 'USDC',
                        tokenInChainId: 1,
                        tokenOutAddress: 'USDT',
                        tokenOutChainId: 1,
                        amount: await getAmount(1, type, 'USDC', 'USDT', '100'),
                        type,
                        algorithm,
                        gasPriceWei: '60000000000',
                        enableUniversalRouter: true,
                    };
                    const queryParams = qs.stringify(quoteReq);
                    const response = await axios.get(`${API}?${queryParams}`);
                    const { data: { quoteDecimals, quoteGasAdjustedDecimals, methodParameters, gasPriceWei }, status, } = response;
                    expect(status).to.equal(200);
                    if (algorithm == 'alpha') {
                        expect(gasPriceWei).to.equal('60000000000');
                    }
                    expect(parseFloat(quoteDecimals)).to.be.greaterThan(90);
                    expect(parseFloat(quoteDecimals)).to.be.lessThan(110);
                    if (type == 'exactIn') {
                        expect(parseFloat(quoteGasAdjustedDecimals)).to.be.lessThanOrEqual(parseFloat(quoteDecimals));
                    }
                    else {
                        expect(parseFloat(quoteGasAdjustedDecimals)).to.be.greaterThanOrEqual(parseFloat(quoteDecimals));
                    }
                    expect(methodParameters).to.be.undefined;
                });
                it(`erc20 -> erc20 by address`, async () => {
                    const quoteReq = {
                        tokenInAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
                        tokenInChainId: 1,
                        tokenOutAddress: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
                        tokenOutChainId: 1,
                        amount: await getAmount(1, type, 'DAI', 'USDC', '100'),
                        type,
                        recipient: alice.address,
                        slippageTolerance: SLIPPAGE,
                        deadline: '360',
                        algorithm,
                        enableUniversalRouter: true,
                    };
                    const queryParams = qs.stringify(quoteReq);
                    const response = await axios.get(`${API}?${queryParams}`);
                    const { data: { quoteDecimals, quoteGasAdjustedDecimals }, status, } = response;
                    expect(status).to.equal(200);
                    expect(parseFloat(quoteDecimals)).to.be.greaterThan(90);
                    if (type == 'exactIn') {
                        expect(parseFloat(quoteGasAdjustedDecimals)).to.be.lessThanOrEqual(parseFloat(quoteDecimals));
                    }
                    else {
                        expect(parseFloat(quoteGasAdjustedDecimals)).to.be.greaterThanOrEqual(parseFloat(quoteDecimals));
                    }
                    expect(parseFloat(quoteDecimals)).to.be.lessThan(110);
                });
                it(`erc20 -> erc20 one by address one by symbol`, async () => {
                    const quoteReq = {
                        tokenInAddress: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
                        tokenInChainId: 1,
                        tokenOutAddress: 'USDC',
                        tokenOutChainId: 1,
                        amount: await getAmount(1, type, 'DAI', 'USDC', '100'),
                        type,
                        recipient: alice.address,
                        slippageTolerance: SLIPPAGE,
                        deadline: '360',
                        algorithm,
                        enableUniversalRouter: true,
                    };
                    const queryParams = qs.stringify(quoteReq);
                    const response = await axios.get(`${API}?${queryParams}`);
                    const { data: { quoteDecimals, quoteGasAdjustedDecimals }, status, } = response;
                    expect(status).to.equal(200);
                    expect(parseFloat(quoteDecimals)).to.be.greaterThan(90);
                    if (type == 'exactIn') {
                        expect(parseFloat(quoteGasAdjustedDecimals)).to.be.lessThanOrEqual(parseFloat(quoteDecimals));
                    }
                    else {
                        expect(parseFloat(quoteGasAdjustedDecimals)).to.be.greaterThanOrEqual(parseFloat(quoteDecimals));
                    }
                    expect(parseFloat(quoteDecimals)).to.be.lessThan(110);
                });
            });
            describe(`${ID_TO_NETWORK_NAME(1)} ${algorithm} ${type} 4xx`, () => {
                it(`field is missing in body`, async () => {
                    const quoteReq = {
                        tokenOutAddress: 'USDT',
                        tokenInChainId: 1,
                        tokenOutChainId: 1,
                        amount: await getAmount(1, type, 'USDC', 'USDT', '100'),
                        type,
                        recipient: alice.address,
                        slippageTolerance: SLIPPAGE,
                        deadline: '360',
                        algorithm,
                        enableUniversalRouter: true,
                    };
                    await callAndExpectFail(quoteReq, {
                        status: 400,
                        data: {
                            detail: '"tokenInAddress" is required',
                            errorCode: 'VALIDATION_ERROR',
                        },
                    });
                });
                it.skip(`amount is too big to find route`, async () => {
                    const quoteReq = {
                        tokenInAddress: 'UNI',
                        tokenInChainId: 1,
                        tokenOutAddress: 'KNC',
                        tokenOutChainId: 1,
                        amount: await getAmount(1, type, 'UNI', 'KNC', '9999999999999999999999999999999999999999999999999'),
                        type,
                        recipient: '0x88fc765949a27405480F374Aa49E20dcCD3fCfb8',
                        slippageTolerance: SLIPPAGE,
                        deadline: '360',
                        algorithm,
                        enableUniversalRouter: true,
                    };
                    await callAndExpectFail(quoteReq, {
                        status: 400,
                        data: {
                            detail: 'No route found',
                            errorCode: 'NO_ROUTE',
                        },
                    });
                });
                it(`amount is too big for uint256`, async () => {
                    const quoteReq = {
                        tokenInAddress: 'USDC',
                        tokenInChainId: 1,
                        tokenOutAddress: 'USDT',
                        tokenOutChainId: 1,
                        amount: await getAmount(1, type, 'USDC', 'USDT', '100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000'),
                        type,
                        recipient: alice.address,
                        slippageTolerance: SLIPPAGE,
                        deadline: '360',
                        algorithm,
                    };
                    await callAndExpectFail(quoteReq, {
                        status: 400,
                        data: {
                            detail: '"amount" length must be less than or equal to 77 characters long',
                            errorCode: 'VALIDATION_ERROR',
                        },
                    });
                });
                it(`amount is negative`, async () => {
                    const quoteReq = {
                        tokenInAddress: 'USDC',
                        tokenInChainId: 1,
                        tokenOutAddress: 'USDT',
                        tokenOutChainId: 1,
                        amount: '-10000000000',
                        type,
                        recipient: alice.address,
                        slippageTolerance: SLIPPAGE,
                        deadline: '360',
                        algorithm,
                        enableUniversalRouter: true,
                    };
                    await callAndExpectFail(quoteReq, {
                        status: 400,
                        data: {
                            detail: '"amount" with value "-10000000000" fails to match the required pattern: /^[0-9]+$/',
                            errorCode: 'VALIDATION_ERROR',
                        },
                    });
                });
                it(`amount is decimal`, async () => {
                    const quoteReq = {
                        tokenInAddress: 'USDC',
                        tokenInChainId: 1,
                        tokenOutAddress: 'USDT',
                        tokenOutChainId: 1,
                        amount: '1000000000.25',
                        type,
                        recipient: alice.address,
                        slippageTolerance: SLIPPAGE,
                        deadline: '360',
                        algorithm,
                        enableUniversalRouter: true,
                    };
                    await callAndExpectFail(quoteReq, {
                        status: 400,
                        data: {
                            detail: '"amount" with value "1000000000.25" fails to match the required pattern: /^[0-9]+$/',
                            errorCode: 'VALIDATION_ERROR',
                        },
                    });
                });
                it(`symbol doesnt exist`, async () => {
                    const quoteReq = {
                        tokenInAddress: 'USDC',
                        tokenInChainId: 1,
                        tokenOutAddress: 'NONEXISTANTTOKEN',
                        tokenOutChainId: 1,
                        amount: await getAmount(1, type, 'USDC', 'USDT', '100'),
                        type,
                        recipient: alice.address,
                        slippageTolerance: SLIPPAGE,
                        deadline: '360',
                        algorithm,
                    };
                    await callAndExpectFail(quoteReq, {
                        status: 400,
                        data: {
                            detail: 'Could not find token with address "NONEXISTANTTOKEN"',
                            errorCode: 'TOKEN_OUT_INVALID',
                        },
                    });
                });
                it(`tokens are the same symbol`, async () => {
                    const quoteReq = {
                        tokenInAddress: 'USDT',
                        tokenInChainId: 1,
                        tokenOutAddress: 'USDT',
                        tokenOutChainId: 1,
                        amount: await getAmount(1, type, 'USDC', 'USDT', '100'),
                        type,
                        recipient: alice.address,
                        slippageTolerance: SLIPPAGE,
                        deadline: '360',
                        algorithm,
                        enableUniversalRouter: true,
                    };
                    await callAndExpectFail(quoteReq, {
                        status: 400,
                        data: {
                            detail: 'tokenIn and tokenOut must be different',
                            errorCode: 'TOKEN_IN_OUT_SAME',
                        },
                    });
                });
                it(`tokens are the same symbol and address`, async () => {
                    const quoteReq = {
                        tokenInAddress: 'USDT',
                        tokenInChainId: 1,
                        tokenOutAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
                        tokenOutChainId: 1,
                        amount: await getAmount(1, type, 'USDT', 'USDT', '100'),
                        type,
                        recipient: alice.address,
                        slippageTolerance: SLIPPAGE,
                        deadline: '360',
                        algorithm,
                        enableUniversalRouter: true,
                    };
                    await callAndExpectFail(quoteReq, {
                        status: 400,
                        data: {
                            detail: 'tokenIn and tokenOut must be different',
                            errorCode: 'TOKEN_IN_OUT_SAME',
                        },
                    });
                });
                it(`tokens are the same address`, async () => {
                    const quoteReq = {
                        tokenInAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
                        tokenInChainId: 1,
                        tokenOutAddress: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
                        tokenOutChainId: 1,
                        amount: await getAmount(1, type, 'USDT', 'USDT', '100'),
                        type,
                        recipient: alice.address,
                        slippageTolerance: SLIPPAGE,
                        deadline: '360',
                        algorithm,
                        enableUniversalRouter: true,
                    };
                    await callAndExpectFail(quoteReq, {
                        status: 400,
                        data: {
                            detail: 'tokenIn and tokenOut must be different',
                            errorCode: 'TOKEN_IN_OUT_SAME',
                        },
                    });
                });
                it(`one of recipient/deadline/slippage is missing`, async () => {
                    const quoteReq = {
                        tokenInAddress: 'USDC',
                        tokenInChainId: 1,
                        tokenOutAddress: 'USDT',
                        tokenOutChainId: 1,
                        amount: await getAmount(1, type, 'USDC', 'USDT', '100'),
                        type,
                        slippageTolerance: SLIPPAGE,
                        deadline: '360',
                        algorithm,
                        enableUniversalRouter: true,
                    };
                    await callAndExpectFail(quoteReq, {
                        status: 400,
                        data: {
                            detail: '"value" contains [slippageTolerance, deadline] without its required peers [recipient]',
                            errorCode: 'VALIDATION_ERROR',
                        },
                    });
                });
                it(`recipient is an invalid address`, async () => {
                    const quoteReq = {
                        tokenInAddress: 'USDT',
                        tokenInChainId: 1,
                        tokenOutAddress: 'USDC',
                        tokenOutChainId: 1,
                        amount: await getAmount(1, type, 'USDT', 'USDC', '100'),
                        type,
                        recipient: '0xAb5801a7D398351b8bE11C439e05C5B3259aZZZZZZZ',
                        slippageTolerance: SLIPPAGE,
                        deadline: '360',
                        algorithm,
                        enableUniversalRouter: true,
                    };
                    await callAndExpectFail(quoteReq, {
                        status: 400,
                        data: {
                            detail: '"recipient" with value "0xAb5801a7D398351b8bE11C439e05C5B3259aZZZZZZZ" fails to match the required pattern: /^0x[a-fA-F0-9]{40}$/',
                            errorCode: 'VALIDATION_ERROR',
                        },
                    });
                });
                it(`unsupported chain`, async () => {
                    const quoteReq = {
                        tokenInAddress: 'USDC',
                        tokenInChainId: 70,
                        tokenOutAddress: 'USDT',
                        tokenOutChainId: 70,
                        amount: '10000000000',
                        type,
                        recipient: alice.address,
                        slippageTolerance: SLIPPAGE,
                        deadline: '360',
                        algorithm,
                        enableUniversalRouter: true,
                    };
                    const chains = SUPPORTED_CHAINS.values();
                    const chainStr = [...chains].toString().split(',').join(', ');
                    await callAndExpectFail(quoteReq, {
                        status: 400,
                        data: {
                            detail: `"tokenInChainId" must be one of [${chainStr}]`,
                            errorCode: 'VALIDATION_ERROR',
                        },
                    });
                });
            });
        }
    }
    const TEST_ERC20_1 = {
        [ChainId.MAINNET]: USDC_ON(1),
        [ChainId.GOERLI]: USDC_ON(ChainId.GOERLI),
        [ChainId.SEPOLIA]: USDC_ON(ChainId.SEPOLIA),
        [ChainId.OPTIMISM]: USDC_ON(ChainId.OPTIMISM),
        [ChainId.OPTIMISM_GOERLI]: USDC_ON(ChainId.OPTIMISM_GOERLI),
        [ChainId.ARBITRUM_ONE]: USDC_ON(ChainId.ARBITRUM_ONE),
        [ChainId.POLYGON]: USDC_ON(ChainId.POLYGON),
        [ChainId.POLYGON_MUMBAI]: USDC_ON(ChainId.POLYGON_MUMBAI),
        [ChainId.CELO]: CUSD_CELO,
        [ChainId.CELO_ALFAJORES]: CUSD_CELO_ALFAJORES,
        [ChainId.MOONBEAM]: null,
        [ChainId.GNOSIS]: null,
        [ChainId.ARBITRUM_GOERLI]: null,
        [ChainId.BNB]: USDC_ON(ChainId.BNB),
        [ChainId.AVALANCHE]: USDC_ON(ChainId.AVALANCHE),
        [ChainId.BASE_GOERLI]: null,
        [ChainId.BASE]: null
    };
    const TEST_ERC20_2 = {
        [ChainId.MAINNET]: DAI_ON(1),
        [ChainId.GOERLI]: DAI_ON(ChainId.GOERLI),
        [ChainId.SEPOLIA]: DAI_ON(ChainId.SEPOLIA),
        [ChainId.OPTIMISM]: DAI_ON(ChainId.OPTIMISM),
        [ChainId.OPTIMISM_GOERLI]: DAI_ON(ChainId.OPTIMISM_GOERLI),
        [ChainId.ARBITRUM_ONE]: DAI_ON(ChainId.ARBITRUM_ONE),
        [ChainId.POLYGON]: DAI_ON(ChainId.POLYGON),
        [ChainId.POLYGON_MUMBAI]: DAI_ON(ChainId.POLYGON_MUMBAI),
        [ChainId.CELO]: CEUR_CELO,
        [ChainId.CELO_ALFAJORES]: CEUR_CELO_ALFAJORES,
        [ChainId.MOONBEAM]: null,
        [ChainId.GNOSIS]: null,
        [ChainId.ARBITRUM_GOERLI]: null,
        [ChainId.BNB]: USDT_ON(ChainId.BNB),
        [ChainId.AVALANCHE]: DAI_ON(ChainId.AVALANCHE),
        [ChainId.BASE_GOERLI]: null,
        [ChainId.BASE]: null
    };
    // TODO: Find valid pools/tokens on optimistic kovan and polygon mumbai. We skip those tests for now.
    for (const chain of _.filter(SUPPORTED_CHAINS, (c) => c != ChainId.POLYGON_MUMBAI &&
        c != ChainId.ARBITRUM_GOERLI &&
        c != ChainId.CELO_ALFAJORES &&
        c != ChainId.GOERLI &&
        c != ChainId.SEPOLIA)) {
        for (const type of ['exactIn', 'exactOut']) {
            const erc1 = TEST_ERC20_1[chain];
            const erc2 = TEST_ERC20_2[chain];
            // This is for Gnosis and Moonbeam which we don't have RPC Providers yet
            if (erc1 == null || erc2 == null)
                continue;
            describe(`${ID_TO_NETWORK_NAME(chain)} ${type} 2xx`, function () {
                // Help with test flakiness by retrying.
                this.retries(0);
                const wrappedNative = WNATIVE_ON(chain);
                it(`${wrappedNative.symbol} -> erc20`, async () => {
                    const quoteReq = {
                        tokenInAddress: wrappedNative.address,
                        tokenInChainId: chain,
                        tokenOutAddress: erc1.address,
                        tokenOutChainId: chain,
                        amount: await getAmountFromToken(type, wrappedNative, erc1, '1'),
                        type,
                        enableUniversalRouter: true,
                    };
                    const queryParams = qs.stringify(quoteReq);
                    try {
                        const response = await axios.get(`${API}?${queryParams}`);
                        const { status } = response;
                        expect(status).to.equal(200);
                    }
                    catch (err) {
                        fail(JSON.stringify(err.response.data));
                    }
                });
                it(`erc20 -> erc20`, async () => {
                    const quoteReq = {
                        tokenInAddress: erc1.address,
                        tokenInChainId: chain,
                        tokenOutAddress: erc2.address,
                        tokenOutChainId: chain,
                        amount: await getAmountFromToken(type, erc1, erc2, '1'),
                        type,
                    };
                    const queryParams = qs.stringify(quoteReq);
                    try {
                        const response = await axios.get(`${API}?${queryParams}`);
                        const { status } = response;
                        expect(status).to.equal(200);
                    }
                    catch (err) {
                        fail(JSON.stringify(err.response.data));
                    }
                });
                const native = NATIVE_CURRENCY[chain];
                it(`${native} -> erc20`, async () => {
                    const quoteReq = {
                        tokenInAddress: native,
                        tokenInChainId: chain,
                        tokenOutAddress: erc2.address,
                        tokenOutChainId: chain,
                        amount: await getAmountFromToken(type, WNATIVE_ON(chain), erc2, '1'),
                        type,
                        enableUniversalRouter: true,
                    };
                    const queryParams = qs.stringify(quoteReq);
                    try {
                        const response = await axios.get(`${API}?${queryParams}`);
                        const { status } = response;
                        expect(status).to.equal(200, JSON.stringify(response.data));
                    }
                    catch (err) {
                        fail(JSON.stringify(err.response.data));
                    }
                });
                it(`has quoteGasAdjusted values`, async () => {
                    const quoteReq = {
                        tokenInAddress: erc1.address,
                        tokenInChainId: chain,
                        tokenOutAddress: erc2.address,
                        tokenOutChainId: chain,
                        amount: await getAmountFromToken(type, erc1, erc2, '1'),
                        type,
                    };
                    const queryParams = qs.stringify(quoteReq);
                    try {
                        const response = await axios.get(`${API}?${queryParams}`);
                        const { data: { quoteDecimals, quoteGasAdjustedDecimals }, status, } = response;
                        expect(status).to.equal(200);
                        // check for quotes to be gas adjusted
                        if (type == 'exactIn') {
                            expect(parseFloat(quoteGasAdjustedDecimals)).to.be.lessThanOrEqual(parseFloat(quoteDecimals));
                        }
                        else {
                            expect(parseFloat(quoteGasAdjustedDecimals)).to.be.greaterThanOrEqual(parseFloat(quoteDecimals));
                        }
                    }
                    catch (err) {
                        fail(JSON.stringify(err.response.data));
                    }
                });
            });
        }
    }
});
describe('alpha only quote', function () {
    this.timeout(5000);
    for (const type of ['exactIn', 'exactOut']) {
        describe(`${type} 2xx`, () => { });
    }
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicXVvdGUudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uL3Rlc3QvbW9jaGEvaW50ZWcvcXVvdGUudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFDQSxPQUFPLEVBQUUsaUJBQWlCLEVBQWdCLE1BQU0sc0JBQXNCLENBQUE7QUFDdEUsT0FBTyxFQUFFLE9BQU8sRUFBWSxjQUFjLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBUyxLQUFLLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQTtBQUNwRyxPQUFPLEVBQ0wsU0FBUyxFQUNULG1CQUFtQixFQUNuQixTQUFTLEVBQ1QsbUJBQW1CLEVBQ25CLFdBQVcsRUFDWCxrQkFBa0IsRUFDbEIsZUFBZSxFQUNmLFdBQVcsRUFDWCx3QkFBd0IsRUFDeEIsWUFBWSxFQUNaLFlBQVksRUFDWixZQUFZLEdBQ2IsTUFBTSw2QkFBNkIsQ0FBQTtBQUNwQyxPQUFPLEVBQ0wsZUFBZSxFQUNmLHdCQUF3QixJQUFJLGlDQUFpQyxHQUM5RCxNQUFNLCtCQUErQixDQUFBO0FBRXRDLE9BQU8sRUFBRSxJQUFJLEVBQUUsTUFBTSxRQUFRLENBQUE7QUFDN0IsT0FBTyxXQUE4QixNQUFNLE9BQU8sQ0FBQTtBQUNsRCxPQUFPLFVBQVUsTUFBTSxhQUFhLENBQUE7QUFDcEMsT0FBTyxJQUFJLEVBQUUsRUFBRSxNQUFNLEVBQUUsTUFBTSxNQUFNLENBQUE7QUFDbkMsT0FBTyxjQUFjLE1BQU0sa0JBQWtCLENBQUE7QUFDN0MsT0FBTyxVQUFVLE1BQU0sYUFBYSxDQUFBO0FBQ3BDLE9BQU8sRUFBRSxTQUFTLEVBQWEsTUFBTSxFQUFFLE1BQU0sUUFBUSxDQUFBO0FBQ3JELE9BQU8sR0FBRyxNQUFNLFNBQVMsQ0FBQTtBQUN6QixPQUFPLENBQUMsTUFBTSxRQUFRLENBQUE7QUFDdEIsT0FBTyxFQUFFLE1BQU0sSUFBSSxDQUFBO0FBQ25CLE9BQU8sRUFBRSxnQkFBZ0IsRUFBRSxNQUFNLG9DQUFvQyxDQUFB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QkFDRjtvQkFBQyxPQUFPLEdBQVEsRUFBRTt3QkFDakIsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFBO3FCQUN4QztnQkFDSCxDQUFDLENBQUMsQ0FBQTtZQUNKLENBQUMsQ0FBQyxDQUFBO1NBQ0g7S0FDRjtBQUNILENBQUMsQ0FBQyxDQUFBO0FBRUYsUUFBUSxDQUFDLGtCQUFrQixFQUFFO0lBQzNCLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUE7SUFFbEIsS0FBSyxNQUFNLElBQUksSUFBSSxDQUFDLFNBQVMsRUFBRSxVQUFVLENBQUMsRUFBRTtRQUMxQyxRQUFRLENBQUMsR0FBRyxJQUFJLE1BQU0sRUFBRSxHQUFHLEVBQUUsR0FBRSxDQUFDLENBQUMsQ0FBQTtLQUNsQztBQUNILENBQUMsQ0FBQyxDQUFBIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgU2lnbmVyV2l0aEFkZHJlc3MgfSBmcm9tICdAbm9taWNsYWJzL2hhcmRoYXQtZXRoZXJzL3NpZ25lcnMnXG5pbXBvcnQgeyBBbGxvd2FuY2VUcmFuc2ZlciwgUGVybWl0U2luZ2xlIH0gZnJvbSAnQHVuaXN3YXAvcGVybWl0Mi1zZGsnXG5pbXBvcnQgeyBDaGFpbklkLCBDdXJyZW5jeSwgQ3VycmVuY3lBbW91bnQsIEV0aGVyLCBGcmFjdGlvbiwgVG9rZW4sIFdFVEg5IH0gZnJvbSAnQHVuaXN3YXAvc2RrLWNvcmUnXG5pbXBvcnQge1xuICBDRVVSX0NFTE8sXG4gIENFVVJfQ0VMT19BTEZBSk9SRVMsXG4gIENVU0RfQ0VMTyxcbiAgQ1VTRF9DRUxPX0FMRkFKT1JFUyxcbiAgREFJX01BSU5ORVQsXG4gIElEX1RPX05FVFdPUktfTkFNRSxcbiAgTkFUSVZFX0NVUlJFTkNZLFxuICBwYXJzZUFtb3VudCxcbiAgU1dBUF9ST1VURVJfMDJfQUREUkVTU0VTLFxuICBVU0RDX01BSU5ORVQsXG4gIFVTRFRfTUFJTk5FVCxcbiAgV0JUQ19NQUlOTkVULFxufSBmcm9tICdAdW5pc3dhcC9zbWFydC1vcmRlci1yb3V0ZXInXG5pbXBvcnQge1xuICBQRVJNSVQyX0FERFJFU1MsXG4gIFVOSVZFUlNBTF9ST1VURVJfQUREUkVTUyBhcyBVTklWRVJTQUxfUk9VVEVSX0FERFJFU1NfQllfQ0hBSU4sXG59IGZyb20gJ0B1bmlzd2FwL3VuaXZlcnNhbC1yb3V0ZXItc2RrJ1xuaW1wb3J0IHsgTWV0aG9kUGFyYW1ldGVycyB9IGZyb20gJ0B1bmlzd2FwL3NtYXJ0LW9yZGVyLXJvdXRlcidcbmltcG9ydCB7IGZhaWwgfSBmcm9tICdhc3NlcnQnXG5pbXBvcnQgYXhpb3NTdGF0aWMsIHsgQXhpb3NSZXNwb25zZSB9IGZyb20gJ2F4aW9zJ1xuaW1wb3J0IGF4aW9zUmV0cnkgZnJvbSAnYXhpb3MtcmV0cnknXG5pbXBvcnQgY2hhaSwgeyBleHBlY3QgfSBmcm9tICdjaGFpJ1xuaW1wb3J0IGNoYWlBc1Byb21pc2VkIGZyb20gJ2NoYWktYXMtcHJvbWlzZWQnXG5pbXBvcnQgY2hhaVN1YnNldCBmcm9tICdjaGFpLXN1YnNldCdcbmltcG9ydCB7IEJpZ051bWJlciwgcHJvdmlkZXJzLCBXYWxsZXQgfSBmcm9tICdldGhlcnMnXG5pbXBvcnQgaHJlIGZyb20gJ2hhcmRoYXQnXG5pbXBvcnQgXyBmcm9tICdsb2Rhc2gnXG5pbXBvcnQgcXMgZnJvbSAncXMnXG5pbXBvcnQgeyBTVVBQT1JURURfQ0hBSU5TIH0gZnJvbSAnLi4vLi4vLi4vbGliL2hhbmRsZXJzL2luamVjdG9yLXNvcidcbmltcG9ydCB7IFF1b3RlUXVlcnlQYXJhbXMgfSBmcm9tICcuLi8uLi8uLi9saWIvaGFuZGxlcnMvcXVvdGUvc2NoZW1hL3F1b3RlLXNjaGVtYSdcbmltcG9ydCB7IFF1b3RlUmVzcG9uc2UgfSBmcm9tICcuLi8uLi8uLi9saWIvaGFuZGxlcnMvc2NoZW1hJ1xuaW1wb3J0IHsgUGVybWl0Ml9fZmFjdG9yeSB9IGZyb20gJy4uLy4uLy4uL2xpYi90eXBlcy9leHQnXG5pbXBvcnQgeyByZXNldEFuZEZ1bmRBdEJsb2NrIH0gZnJvbSAnLi4vLi4vdXRpbHMvZm9ya0FuZEZ1bmQnXG5pbXBvcnQgeyBnZXRCYWxhbmNlLCBnZXRCYWxhbmNlQW5kQXBwcm92ZSB9IGZyb20gJy4uLy4uL3V0aWxzL2dldEJhbGFuY2VBbmRBcHByb3ZlJ1xuaW1wb3J0IHsgREFJX09OLCBnZXRBbW91bnQsIGdldEFtb3VudEZyb21Ub2tlbiwgVU5JX01BSU5ORVQsIFVTRENfT04sIFVTRFRfT04sIFdOQVRJVkVfT04gfSBmcm9tICcuLi8uLi91dGlscy90b2tlbnMnXG5cbmNvbnN0IHsgZXRoZXJzIH0gPSBocmVcblxuY2hhaS51c2UoY2hhaUFzUHJvbWlzZWQpXG5jaGFpLnVzZShjaGFpU3Vic2V0KVxuXG5jb25zdCBVTklWRVJTQUxfUk9VVEVSX0FERFJFU1MgPSBVTklWRVJTQUxfUk9VVEVSX0FERFJFU1NfQllfQ0hBSU4oMSlcblxuaWYgKCFwcm9jZXNzLmVudi5VTklTV0FQX1JPVVRJTkdfQVBJIHx8ICFwcm9jZXNzLmVudi5BUkNISVZFX05PREVfUlBDKSB7XG4gIHRocm93IG5ldyBFcnJvcignTXVzdCBzZXQgVU5JU1dBUF9ST1VUSU5HX0FQSSBhbmQgQVJDSElWRV9OT0RFX1JQQyBlbnYgdmFyaWFibGVzIGZvciBpbnRlZyB0ZXN0cy4gU2VlIFJFQURNRScpXG59XG5cbmNvbnN0IEFQSSA9IGAke3Byb2Nlc3MuZW52LlVOSVNXQVBfUk9VVElOR19BUEkhfXF1b3RlYFxuXG5jb25zdCBTTElQUEFHRSA9ICc1J1xuY29uc3QgTEFSR0VfU0xJUFBBR0UgPSAnMTAnXG5cbmNvbnN0IGF4aW9zID0gYXhpb3NTdGF0aWMuY3JlYXRlKClcbmF4aW9zUmV0cnkoYXhpb3MsIHtcbiAgcmV0cmllczogMTAsXG4gIHJldHJ5Q29uZGl0aW9uOiAoZXJyKSA9PiBlcnIucmVzcG9uc2U/LnN0YXR1cyA9PSA0MjksXG4gIHJldHJ5RGVsYXk6IGF4aW9zUmV0cnkuZXhwb25lbnRpYWxEZWxheSxcbn0pXG5cbmNvbnN0IGNhbGxBbmRFeHBlY3RGYWlsID0gYXN5bmMgKHF1b3RlUmVxOiBQYXJ0aWFsPFF1b3RlUXVlcnlQYXJhbXM+LCByZXNwOiB7IHN0YXR1czogbnVtYmVyOyBkYXRhOiBhbnkgfSkgPT4ge1xuICBjb25zdCBxdWVyeVBhcmFtcyA9IHFzLnN0cmluZ2lmeShxdW90ZVJlcSlcbiAgdHJ5IHtcbiAgICBhd2FpdCBheGlvcy5nZXQ8UXVvdGVSZXNwb25zZT4oYCR7QVBJfT8ke3F1ZXJ5UGFyYW1zfWApXG4gICAgZmFpbCgpXG4gIH0gY2F0Y2ggKGVycjogYW55KSB7XG4gICAgZXhwZWN0KGVyci5yZXNwb25zZSkudG8uY29udGFpblN1YnNldChyZXNwKVxuICB9XG59XG5cbmNvbnN0IGNoZWNrUXVvdGVUb2tlbiA9IChcbiAgYmVmb3JlOiBDdXJyZW5jeUFtb3VudDxDdXJyZW5jeT4sXG4gIGFmdGVyOiBDdXJyZW5jeUFtb3VudDxDdXJyZW5jeT4sXG4gIHRva2Vuc1F1b3RlZDogQ3VycmVuY3lBbW91bnQ8Q3VycmVuY3k+XG4pID0+IHtcbiAgLy8gQ2hlY2sgd2hpY2ggaXMgYmlnZ2VyIHRvIHN1cHBvcnQgZXhhY3RJbiBhbmQgZXhhY3RPdXRcbiAgY29uc3QgdG9rZW5zU3dhcHBlZCA9IGFmdGVyLmdyZWF0ZXJUaGFuKGJlZm9yZSkgPyBhZnRlci5zdWJ0cmFjdChiZWZvcmUpIDogYmVmb3JlLnN1YnRyYWN0KGFmdGVyKVxuXG4gIGNvbnN0IHRva2Vuc0RpZmYgPSB0b2tlbnNRdW90ZWQuZ3JlYXRlclRoYW4odG9rZW5zU3dhcHBlZClcbiAgICA/IHRva2Vuc1F1b3RlZC5zdWJ0cmFjdCh0b2tlbnNTd2FwcGVkKVxuICAgIDogdG9rZW5zU3dhcHBlZC5zdWJ0cmFjdCh0b2tlbnNRdW90ZWQpXG4gIGNvbnN0IHBlcmNlbnREaWZmID0gdG9rZW5zRGlmZi5hc0ZyYWN0aW9uLmRpdmlkZSh0b2tlbnNRdW90ZWQuYXNGcmFjdGlvbilcbiAgZXhwZWN0KHBlcmNlbnREaWZmLmxlc3NUaGFuKG5ldyBGcmFjdGlvbihwYXJzZUludChTTElQUEFHRSksIDEwMCkpKS50by5iZS50cnVlXG59XG5cbmxldCB3YXJuZWRUZXN0ZXJQSyA9IGZhbHNlXG5jb25zdCBpc1Rlc3RlclBLRW52aXJvbm1lbnRTZXQgPSAoKTogYm9vbGVhbiA9PiB7XG4gIGNvbnN0IGlzU2V0ID0gISFwcm9jZXNzLmVudi5URVNURVJfUEtcbiAgaWYgKCFpc1NldCAmJiAhd2FybmVkVGVzdGVyUEspIHtcbiAgICBjb25zb2xlLmxvZygnU2tpcHBpbmcgdGVzdHMgcmVxdWlyaW5nIHJlYWwgUEsgc2luY2UgZW52IHZhcmlhYmxlcyBmb3IgVEVTVEVSX1BLIGlzIG5vdCBzZXQuJylcbiAgICB3YXJuZWRUZXN0ZXJQSyA9IHRydWVcbiAgfVxuICByZXR1cm4gaXNTZXRcbn1cblxuY29uc3QgTUFYX1VJTlQxNjAgPSAnMHhmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmZmJ1xuXG5kZXNjcmliZSgncXVvdGUnLCBmdW5jdGlvbiAoKSB7XG4gIC8vIEhlbHAgd2l0aCB0ZXN0IGZsYWtpbmVzcyBieSByZXRyeWluZy5cbiAgdGhpcy5yZXRyaWVzKDApXG5cbiAgdGhpcy50aW1lb3V0KCc1MDBzJylcblxuICBsZXQgYWxpY2U6IFNpZ25lcldpdGhBZGRyZXNzXG4gIGxldCBibG9jazogbnVtYmVyXG4gIGxldCBjdXJOb25jZTogbnVtYmVyID0gMFxuICBsZXQgbmV4dFBlcm1pdE5vbmNlOiAoKSA9PiBzdHJpbmcgPSAoKSA9PiB7XG4gICAgY29uc3Qgbm9uY2UgPSBjdXJOb25jZS50b1N0cmluZygpXG4gICAgY3VyTm9uY2UgPSBjdXJOb25jZSArIDFcbiAgICByZXR1cm4gbm9uY2VcbiAgfVxuXG4gIGNvbnN0IGV4ZWN1dGVTd2FwID0gYXN5bmMgKFxuICAgIG1ldGhvZFBhcmFtZXRlcnM6IE1ldGhvZFBhcmFtZXRlcnMsXG4gICAgY3VycmVuY3lJbjogQ3VycmVuY3ksXG4gICAgY3VycmVuY3lPdXQ6IEN1cnJlbmN5LFxuICAgIHBlcm1pdD86IGJvb2xlYW4sXG4gICAgY2hhaW5JZCA9IENoYWluSWQuTUFJTk5FVFxuICApOiBQcm9taXNlPHtcbiAgICB0b2tlbkluQWZ0ZXI6IEN1cnJlbmN5QW1vdW50PEN1cnJlbmN5PlxuICAgIHRva2VuSW5CZWZvcmU6IEN1cnJlbmN5QW1vdW50PEN1cnJlbmN5PlxuICAgIHRva2VuT3V0QWZ0ZXI6IEN1cnJlbmN5QW1vdW50PEN1cnJlbmN5PlxuICAgIHRva2VuT3V0QmVmb3JlOiBDdXJyZW5jeUFtb3VudDxDdXJyZW5jeT5cbiAgfT4gPT4ge1xuICAgIGNvbnN0IHBlcm1pdDIgPSBQZXJtaXQyX19mYWN0b3J5LmNvbm5lY3QoUEVSTUlUMl9BRERSRVNTLCBhbGljZSlcblxuICAgIC8vIEFwcHJvdmUgUGVybWl0MlxuICAgIGNvbnN0IHRva2VuSW5CZWZvcmUgPSBhd2FpdCBnZXRCYWxhbmNlQW5kQXBwcm92ZShhbGljZSwgUEVSTUlUMl9BRERSRVNTLCBjdXJyZW5jeUluKVxuICAgIGNvbnN0IHRva2VuT3V0QmVmb3JlID0gYXdhaXQgZ2V0QmFsYW5jZShhbGljZSwgY3VycmVuY3lPdXQpXG5cbiAgICAvLyBBcHByb3ZlIFN3YXBSb3V0ZXIwMiBpbiBjYXNlIHdlIHJlcXVlc3QgY2FsbGRhdGEgZm9yIGl0IGluc3RlYWQgb2YgVW5pdmVyc2FsIFJvdXRlclxuICAgIGF3YWl0IGdldEJhbGFuY2VBbmRBcHByb3ZlKGFsaWNlLCBTV0FQX1JPVVRFUl8wMl9BRERSRVNTRVMoY2hhaW5JZCksIGN1cnJlbmN5SW4pXG5cbiAgICAvLyBJZiBub3QgdXNpbmcgcGVybWl0IGRvIGEgcmVndWxhciBhcHByb3ZhbCBhbGxvd2luZyBuYXJ3aGFsIG1heCBiYWxhbmNlLlxuICAgIGlmICghcGVybWl0KSB7XG4gICAgICBjb25zdCBhcHByb3ZlTmFyd2hhbCA9IGF3YWl0IHBlcm1pdDIuYXBwcm92ZShcbiAgICAgICAgY3VycmVuY3lJbi53cmFwcGVkLmFkZHJlc3MsXG4gICAgICAgIFVOSVZFUlNBTF9ST1VURVJfQUREUkVTUyxcbiAgICAgICAgTUFYX1VJTlQxNjAsXG4gICAgICAgIDEwMDAwMDAwMDAwMDAwMFxuICAgICAgKVxuICAgICAgYXdhaXQgYXBwcm92ZU5hcndoYWwud2FpdCgpXG4gICAgfVxuXG4gICAgY29uc3QgdHJhbnNhY3Rpb24gPSB7XG4gICAgICBkYXRhOiBtZXRob2RQYXJhbWV0ZXJzLmNhbGxkYXRhLFxuICAgICAgdG86IG1ldGhvZFBhcmFtZXRlcnMudG8sXG4gICAgICB2YWx1ZTogQmlnTnVtYmVyLmZyb20obWV0aG9kUGFyYW1ldGVycy52YWx1ZSksXG4gICAgICBmcm9tOiBhbGljZS5hZGRyZXNzLFxuICAgICAgZ2FzUHJpY2U6IEJpZ051bWJlci5mcm9tKDIwMDAwMDAwMDAwMDApLFxuICAgICAgdHlwZTogMSxcbiAgICB9XG5cbiAgICBjb25zdCB0cmFuc2FjdGlvblJlc3BvbnNlOiBwcm92aWRlcnMuVHJhbnNhY3Rpb25SZXNwb25zZSA9IGF3YWl0IGFsaWNlLnNlbmRUcmFuc2FjdGlvbih0cmFuc2FjdGlvbilcbiAgICBhd2FpdCB0cmFuc2FjdGlvblJlc3BvbnNlLndhaXQoKVxuXG4gICAgY29uc3QgdG9rZW5JbkFmdGVyID0gYXdhaXQgZ2V0QmFsYW5jZShhbGljZSwgY3VycmVuY3lJbilcbiAgICBjb25zdCB0b2tlbk91dEFmdGVyID0gYXdhaXQgZ2V0QmFsYW5jZShhbGljZSwgY3VycmVuY3lPdXQpXG5cbiAgICByZXR1cm4ge1xuICAgICAgdG9rZW5JbkFmdGVyLFxuICAgICAgdG9rZW5JbkJlZm9yZSxcbiAgICAgIHRva2VuT3V0QWZ0ZXIsXG4gICAgICB0b2tlbk91dEJlZm9yZSxcbiAgICB9XG4gIH1cblxuICBiZWZvcmUoYXN5bmMgZnVuY3Rpb24gKCkge1xuICAgIHRoaXMudGltZW91dCg0MDAwMClcbiAgICA7W2FsaWNlXSA9IGF3YWl0IGV0aGVycy5nZXRTaWduZXJzKClcblxuICAgIC8vIE1ha2UgYSBkdW1teSBjYWxsIHRvIHRoZSBBUEkgdG8gZ2V0IGEgYmxvY2sgbnVtYmVyIHRvIGZvcmsgZnJvbS5cbiAgICBjb25zdCBxdW90ZVJlcTogUXVvdGVRdWVyeVBhcmFtcyA9IHtcbiAgICAgIHRva2VuSW5BZGRyZXNzOiAnVVNEQycsXG4gICAgICB0b2tlbkluQ2hhaW5JZDogMSxcbiAgICAgIHRva2VuT3V0QWRkcmVzczogJ1VTRFQnLFxuICAgICAgdG9rZW5PdXRDaGFpbklkOiAxLFxuICAgICAgYW1vdW50OiBhd2FpdCBnZXRBbW91bnQoMSwgJ2V4YWN0SW4nLCAnVVNEQycsICdVU0RUJywgJzEwMCcpLFxuICAgICAgdHlwZTogJ2V4YWN0SW4nLFxuICAgIH1cblxuICAgIGNvbnN0IHtcbiAgICAgIGRhdGE6IHsgYmxvY2tOdW1iZXIgfSxcbiAgICB9ID0gYXdhaXQgYXhpb3MuZ2V0PFF1b3RlUmVzcG9uc2U+KGAke0FQSX0/JHtxcy5zdHJpbmdpZnkocXVvdGVSZXEpfWApXG5cbiAgICBibG9jayA9IHBhcnNlSW50KGJsb2NrTnVtYmVyKSAtIDEwXG5cbiAgICBhbGljZSA9IGF3YWl0IHJlc2V0QW5kRnVuZEF0QmxvY2soYWxpY2UsIGJsb2NrLCBbXG4gICAgICBwYXJzZUFtb3VudCgnODAwMDAwMCcsIFVTRENfTUFJTk5FVCksXG4gICAgICBwYXJzZUFtb3VudCgnNTAwMDAwMCcsIFVTRFRfTUFJTk5FVCksXG4gICAgICBwYXJzZUFtb3VudCgnMTAnLCBXQlRDX01BSU5ORVQpLFxuICAgICAgcGFyc2VBbW91bnQoJzEwMDAnLCBVTklfTUFJTk5FVCksXG4gICAgICBwYXJzZUFtb3VudCgnNDAwMCcsIFdFVEg5WzFdKSxcbiAgICAgIHBhcnNlQW1vdW50KCc1MDAwMDAwJywgREFJX01BSU5ORVQpLFxuICAgIF0pXG4gIH0pXG5cbiAgZm9yIChjb25zdCBhbGdvcml0aG0gb2YgWydhbHBoYSddKSB7XG4gICAgZm9yIChjb25zdCB0eXBlIG9mIFsnZXhhY3RJbicsICdleGFjdE91dCddKSB7XG4gICAgICBkZXNjcmliZShgJHtJRF9UT19ORVRXT1JLX05BTUUoMSl9ICR7YWxnb3JpdGhtfSAke3R5cGV9IDJ4eGAsICgpID0+IHtcbiAgICAgICAgZGVzY3JpYmUoYCsgRXhlY3V0ZSBTd2FwYCwgKCkgPT4ge1xuICAgICAgICAgIGl0KGBlcmMyMCAtPiBlcmMyMGAsIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHF1b3RlUmVxOiBRdW90ZVF1ZXJ5UGFyYW1zID0ge1xuICAgICAgICAgICAgICB0b2tlbkluQWRkcmVzczogJ1VTREMnLFxuICAgICAgICAgICAgICB0b2tlbkluQ2hhaW5JZDogMSxcbiAgICAgICAgICAgICAgdG9rZW5PdXRBZGRyZXNzOiAnVVNEVCcsXG4gICAgICAgICAgICAgIHRva2VuT3V0Q2hhaW5JZDogMSxcbiAgICAgICAgICAgICAgYW1vdW50OiBhd2FpdCBnZXRBbW91bnQoMSwgdHlwZSwgJ1VTREMnLCAnVVNEVCcsICcxMDAnKSxcbiAgICAgICAgICAgICAgdHlwZSxcbiAgICAgICAgICAgICAgcmVjaXBpZW50OiBhbGljZS5hZGRyZXNzLFxuICAgICAgICAgICAgICBzbGlwcGFnZVRvbGVyYW5jZTogU0xJUFBBR0UsXG4gICAgICAgICAgICAgIGRlYWRsaW5lOiAnMzYwJyxcbiAgICAgICAgICAgICAgYWxnb3JpdGhtLFxuICAgICAgICAgICAgICBlbmFibGVVbml2ZXJzYWxSb3V0ZXI6IHRydWUsXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHF1ZXJ5UGFyYW1zID0gcXMuc3RyaW5naWZ5KHF1b3RlUmVxKVxuXG4gICAgICAgICAgICBjb25zdCByZXNwb25zZTogQXhpb3NSZXNwb25zZTxRdW90ZVJlc3BvbnNlPiA9IGF3YWl0IGF4aW9zLmdldDxRdW90ZVJlc3BvbnNlPihgJHtBUEl9PyR7cXVlcnlQYXJhbXN9YClcbiAgICAgICAgICAgIGNvbnN0IHtcbiAgICAgICAgICAgICAgZGF0YTogeyBxdW90ZSwgcXVvdGVEZWNpbWFscywgcXVvdGVHYXNBZGp1c3RlZERlY2ltYWxzLCBtZXRob2RQYXJhbWV0ZXJzIH0sXG4gICAgICAgICAgICAgIHN0YXR1cyxcbiAgICAgICAgICAgIH0gPSByZXNwb25zZVxuXG4gICAgICAgICAgICBleHBlY3Qoc3RhdHVzKS50by5lcXVhbCgyMDApXG4gICAgICAgICAgICBleHBlY3QocGFyc2VGbG9hdChxdW90ZURlY2ltYWxzKSkudG8uYmUuZ3JlYXRlclRoYW4oOTApXG4gICAgICAgICAgICBleHBlY3QocGFyc2VGbG9hdChxdW90ZURlY2ltYWxzKSkudG8uYmUubGVzc1RoYW4oMTEwKVxuXG4gICAgICAgICAgICBpZiAodHlwZSA9PSAnZXhhY3RJbicpIHtcbiAgICAgICAgICAgICAgZXhwZWN0KHBhcnNlRmxvYXQocXVvdGVHYXNBZGp1c3RlZERlY2ltYWxzKSkudG8uYmUubGVzc1RoYW5PckVxdWFsKHBhcnNlRmxvYXQocXVvdGVEZWNpbWFscykpXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBleHBlY3QocGFyc2VGbG9hdChxdW90ZUdhc0FkanVzdGVkRGVjaW1hbHMpKS50by5iZS5ncmVhdGVyVGhhbk9yRXF1YWwocGFyc2VGbG9hdChxdW90ZURlY2ltYWxzKSlcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgZXhwZWN0KG1ldGhvZFBhcmFtZXRlcnMpLnRvLm5vdC5iZS51bmRlZmluZWRcbiAgICAgICAgICAgIGV4cGVjdChtZXRob2RQYXJhbWV0ZXJzPy50bykudG8uZXF1YWwoVU5JVkVSU0FMX1JPVVRFUl9BRERSRVNTKVxuXG4gICAgICAgICAgICBjb25zdCB7IHRva2VuSW5CZWZvcmUsIHRva2VuSW5BZnRlciwgdG9rZW5PdXRCZWZvcmUsIHRva2VuT3V0QWZ0ZXIgfSA9IGF3YWl0IGV4ZWN1dGVTd2FwKFxuICAgICAgICAgICAgICBtZXRob2RQYXJhbWV0ZXJzISxcbiAgICAgICAgICAgICAgVVNEQ19NQUlOTkVULFxuICAgICAgICAgICAgICBVU0RUX01BSU5ORVRcbiAgICAgICAgICAgIClcblxuICAgICAgICAgICAgaWYgKHR5cGUgPT0gJ2V4YWN0SW4nKSB7XG4gICAgICAgICAgICAgIGV4cGVjdCh0b2tlbkluQmVmb3JlLnN1YnRyYWN0KHRva2VuSW5BZnRlcikudG9FeGFjdCgpKS50by5lcXVhbCgnMTAwJylcbiAgICAgICAgICAgICAgY2hlY2tRdW90ZVRva2VuKHRva2VuT3V0QmVmb3JlLCB0b2tlbk91dEFmdGVyLCBDdXJyZW5jeUFtb3VudC5mcm9tUmF3QW1vdW50KFVTRFRfTUFJTk5FVCwgcXVvdGUpKVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgZXhwZWN0KHRva2VuT3V0QWZ0ZXIuc3VidHJhY3QodG9rZW5PdXRCZWZvcmUpLnRvRXhhY3QoKSkudG8uZXF1YWwoJzEwMCcpXG4gICAgICAgICAgICAgIGNoZWNrUXVvdGVUb2tlbih0b2tlbkluQmVmb3JlLCB0b2tlbkluQWZ0ZXIsIEN1cnJlbmN5QW1vdW50LmZyb21SYXdBbW91bnQoVVNEQ19NQUlOTkVULCBxdW90ZSkpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSlcblxuICAgICAgICAgIGl0KGBlcmMyMCAtPiBlcmMyMCBzd2Fwcm91dGVyMDJgLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBxdW90ZVJlcTogUXVvdGVRdWVyeVBhcmFtcyA9IHtcbiAgICAgICAgICAgICAgdG9rZW5JbkFkZHJlc3M6ICdVU0RDJyxcbiAgICAgICAgICAgICAgdG9rZW5JbkNoYWluSWQ6IDEsXG4gICAgICAgICAgICAgIHRva2VuT3V0QWRkcmVzczogJ1VTRFQnLFxuICAgICAgICAgICAgICB0b2tlbk91dENoYWluSWQ6IDEsXG4gICAgICAgICAgICAgIGFtb3VudDogYXdhaXQgZ2V0QW1vdW50KDEsIHR5cGUsICdVU0RDJywgJ1VTRFQnLCAnMTAwJyksXG4gICAgICAgICAgICAgIHR5cGUsXG4gICAgICAgICAgICAgIHJlY2lwaWVudDogYWxpY2UuYWRkcmVzcyxcbiAgICAgICAgICAgICAgc2xpcHBhZ2VUb2xlcmFuY2U6IFNMSVBQQUdFLFxuICAgICAgICAgICAgICBkZWFkbGluZTogJzM2MCcsXG4gICAgICAgICAgICAgIGFsZ29yaXRobSxcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgcXVlcnlQYXJhbXMgPSBxcy5zdHJpbmdpZnkocXVvdGVSZXEpXG5cbiAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlOiBBeGlvc1Jlc3BvbnNlPFF1b3RlUmVzcG9uc2U+ID0gYXdhaXQgYXhpb3MuZ2V0PFF1b3RlUmVzcG9uc2U+KGAke0FQSX0/JHtxdWVyeVBhcmFtc31gKVxuICAgICAgICAgICAgY29uc3Qge1xuICAgICAgICAgICAgICBkYXRhOiB7IHF1b3RlLCBxdW90ZURlY2ltYWxzLCBxdW90ZUdhc0FkanVzdGVkRGVjaW1hbHMsIG1ldGhvZFBhcmFtZXRlcnMgfSxcbiAgICAgICAgICAgICAgc3RhdHVzLFxuICAgICAgICAgICAgfSA9IHJlc3BvbnNlXG5cbiAgICAgICAgICAgIGV4cGVjdChzdGF0dXMpLnRvLmVxdWFsKDIwMClcbiAgICAgICAgICAgIGV4cGVjdChwYXJzZUZsb2F0KHF1b3RlRGVjaW1hbHMpKS50by5iZS5ncmVhdGVyVGhhbig5MClcbiAgICAgICAgICAgIGV4cGVjdChwYXJzZUZsb2F0KHF1b3RlRGVjaW1hbHMpKS50by5iZS5sZXNzVGhhbigxMTApXG5cbiAgICAgICAgICAgIGlmICh0eXBlID09ICdleGFjdEluJykge1xuICAgICAgICAgICAgICBleHBlY3QocGFyc2VGbG9hdChxdW90ZUdhc0FkanVzdGVkRGVjaW1hbHMpKS50by5iZS5sZXNzVGhhbk9yRXF1YWwocGFyc2VGbG9hdChxdW90ZURlY2ltYWxzKSlcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGV4cGVjdChwYXJzZUZsb2F0KHF1b3RlR2FzQWRqdXN0ZWREZWNpbWFscykpLnRvLmJlLmdyZWF0ZXJUaGFuT3JFcXVhbChwYXJzZUZsb2F0KHF1b3RlRGVjaW1hbHMpKVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBleHBlY3QobWV0aG9kUGFyYW1ldGVycykudG8ubm90LmJlLnVuZGVmaW5lZFxuICAgICAgICAgICAgZXhwZWN0KG1ldGhvZFBhcmFtZXRlcnM/LnRvKS50by5lcXVhbChTV0FQX1JPVVRFUl8wMl9BRERSRVNTRVMoQ2hhaW5JZC5NQUlOTkVUKSlcblxuICAgICAgICAgICAgY29uc3QgeyB0b2tlbkluQmVmb3JlLCB0b2tlbkluQWZ0ZXIsIHRva2VuT3V0QmVmb3JlLCB0b2tlbk91dEFmdGVyIH0gPSBhd2FpdCBleGVjdXRlU3dhcChcbiAgICAgICAgICAgICAgbWV0aG9kUGFyYW1ldGVycyEsXG4gICAgICAgICAgICAgIFVTRENfTUFJTk5FVCxcbiAgICAgICAgICAgICAgVVNEVF9NQUlOTkVUXG4gICAgICAgICAgICApXG5cbiAgICAgICAgICAgIGlmICh0eXBlID09ICdleGFjdEluJykge1xuICAgICAgICAgICAgICBleHBlY3QodG9rZW5JbkJlZm9yZS5zdWJ0cmFjdCh0b2tlbkluQWZ0ZXIpLnRvRXhhY3QoKSkudG8uZXF1YWwoJzEwMCcpXG4gICAgICAgICAgICAgIGNoZWNrUXVvdGVUb2tlbih0b2tlbk91dEJlZm9yZSwgdG9rZW5PdXRBZnRlciwgQ3VycmVuY3lBbW91bnQuZnJvbVJhd0Ftb3VudChVU0RUX01BSU5ORVQsIHF1b3RlKSlcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGV4cGVjdCh0b2tlbk91dEFmdGVyLnN1YnRyYWN0KHRva2VuT3V0QmVmb3JlKS50b0V4YWN0KCkpLnRvLmVxdWFsKCcxMDAnKVxuICAgICAgICAgICAgICBjaGVja1F1b3RlVG9rZW4odG9rZW5JbkJlZm9yZSwgdG9rZW5JbkFmdGVyLCBDdXJyZW5jeUFtb3VudC5mcm9tUmF3QW1vdW50KFVTRENfTUFJTk5FVCwgcXVvdGUpKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pXG5cbiAgICAgICAgICBpdChgZXJjMjAgLT4gZXJjMjAgd2l0aCBwZXJtaXRgLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBhbW91bnQgPSBhd2FpdCBnZXRBbW91bnQoMSwgdHlwZSwgJ1VTREMnLCAnVVNEVCcsICcxMCcpXG5cbiAgICAgICAgICAgIGNvbnN0IG5vbmNlID0gbmV4dFBlcm1pdE5vbmNlKClcblxuICAgICAgICAgICAgY29uc3QgcGVybWl0OiBQZXJtaXRTaW5nbGUgPSB7XG4gICAgICAgICAgICAgIGRldGFpbHM6IHtcbiAgICAgICAgICAgICAgICB0b2tlbjogVVNEQ19NQUlOTkVULmFkZHJlc3MsXG4gICAgICAgICAgICAgICAgYW1vdW50OiAnMTUwMDAwMDAnLCAvLyBGb3IgZXhhY3Qgb3V0IHdlIGRvbid0IGtub3cgdGhlIGV4YWN0IGFtb3VudCBuZWVkZWQgdG8gcGVybWl0LCBzbyBqdXN0IHNwZWNpZnkgYSBsYXJnZSBhbW91bnQuXG4gICAgICAgICAgICAgICAgZXhwaXJhdGlvbjogTWF0aC5mbG9vcihuZXcgRGF0ZSgpLmdldFRpbWUoKSAvIDEwMDAgKyAxMDAwMDAwMCkudG9TdHJpbmcoKSxcbiAgICAgICAgICAgICAgICBub25jZSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgc3BlbmRlcjogVU5JVkVSU0FMX1JPVVRFUl9BRERSRVNTLFxuICAgICAgICAgICAgICBzaWdEZWFkbGluZTogTWF0aC5mbG9vcihuZXcgRGF0ZSgpLmdldFRpbWUoKSAvIDEwMDAgKyAxMDAwMDAwMCkudG9TdHJpbmcoKSxcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgeyBkb21haW4sIHR5cGVzLCB2YWx1ZXMgfSA9IEFsbG93YW5jZVRyYW5zZmVyLmdldFBlcm1pdERhdGEocGVybWl0LCBQRVJNSVQyX0FERFJFU1MsIDEpXG5cbiAgICAgICAgICAgIGNvbnN0IHNpZ25hdHVyZSA9IGF3YWl0IGFsaWNlLl9zaWduVHlwZWREYXRhKGRvbWFpbiwgdHlwZXMsIHZhbHVlcylcblxuICAgICAgICAgICAgY29uc3QgcXVvdGVSZXE6IFF1b3RlUXVlcnlQYXJhbXMgPSB7XG4gICAgICAgICAgICAgIHRva2VuSW5BZGRyZXNzOiAnVVNEQycsXG4gICAgICAgICAgICAgIHRva2VuSW5DaGFpbklkOiAxLFxuICAgICAgICAgICAgICB0b2tlbk91dEFkZHJlc3M6ICdVU0RUJyxcbiAgICAgICAgICAgICAgdG9rZW5PdXRDaGFpbklkOiAxLFxuICAgICAgICAgICAgICBhbW91bnQsXG4gICAgICAgICAgICAgIHR5cGUsXG4gICAgICAgICAgICAgIHJlY2lwaWVudDogYWxpY2UuYWRkcmVzcyxcbiAgICAgICAgICAgICAgc2xpcHBhZ2VUb2xlcmFuY2U6IFNMSVBQQUdFLFxuICAgICAgICAgICAgICBkZWFkbGluZTogJzM2MCcsXG4gICAgICAgICAgICAgIGFsZ29yaXRobSxcbiAgICAgICAgICAgICAgcGVybWl0U2lnbmF0dXJlOiBzaWduYXR1cmUsXG4gICAgICAgICAgICAgIHBlcm1pdEFtb3VudDogcGVybWl0LmRldGFpbHMuYW1vdW50LnRvU3RyaW5nKCksXG4gICAgICAgICAgICAgIHBlcm1pdEV4cGlyYXRpb246IHBlcm1pdC5kZXRhaWxzLmV4cGlyYXRpb24udG9TdHJpbmcoKSxcbiAgICAgICAgICAgICAgcGVybWl0U2lnRGVhZGxpbmU6IHBlcm1pdC5zaWdEZWFkbGluZS50b1N0cmluZygpLFxuICAgICAgICAgICAgICBwZXJtaXROb25jZTogcGVybWl0LmRldGFpbHMubm9uY2UudG9TdHJpbmcoKSxcbiAgICAgICAgICAgICAgZW5hYmxlVW5pdmVyc2FsUm91dGVyOiB0cnVlLFxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBxdWVyeVBhcmFtcyA9IHFzLnN0cmluZ2lmeShxdW90ZVJlcSlcblxuICAgICAgICAgICAgY29uc3QgcmVzcG9uc2U6IEF4aW9zUmVzcG9uc2U8UXVvdGVSZXNwb25zZT4gPSBhd2FpdCBheGlvcy5nZXQ8UXVvdGVSZXNwb25zZT4oYCR7QVBJfT8ke3F1ZXJ5UGFyYW1zfWApXG4gICAgICAgICAgICBjb25zdCB7XG4gICAgICAgICAgICAgIGRhdGE6IHsgcXVvdGUsIHF1b3RlRGVjaW1hbHMsIHF1b3RlR2FzQWRqdXN0ZWREZWNpbWFscywgbWV0aG9kUGFyYW1ldGVycyB9LFxuICAgICAgICAgICAgICBzdGF0dXMsXG4gICAgICAgICAgICB9ID0gcmVzcG9uc2VcblxuICAgICAgICAgICAgZXhwZWN0KHN0YXR1cykudG8uZXF1YWwoMjAwKVxuICAgICAgICAgICAgZXhwZWN0KHBhcnNlRmxvYXQocXVvdGVEZWNpbWFscykpLnRvLmJlLmdyZWF0ZXJUaGFuKDkpXG4gICAgICAgICAgICBleHBlY3QocGFyc2VGbG9hdChxdW90ZURlY2ltYWxzKSkudG8uYmUubGVzc1RoYW4oMTEpXG5cbiAgICAgICAgICAgIGlmICh0eXBlID09ICdleGFjdEluJykge1xuICAgICAgICAgICAgICBleHBlY3QocGFyc2VGbG9hdChxdW90ZUdhc0FkanVzdGVkRGVjaW1hbHMpKS50by5iZS5sZXNzVGhhbk9yRXF1YWwocGFyc2VGbG9hdChxdW90ZURlY2ltYWxzKSlcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGV4cGVjdChwYXJzZUZsb2F0KHF1b3RlR2FzQWRqdXN0ZWREZWNpbWFscykpLnRvLmJlLmdyZWF0ZXJUaGFuT3JFcXVhbChwYXJzZUZsb2F0KHF1b3RlRGVjaW1hbHMpKVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBleHBlY3QobWV0aG9kUGFyYW1ldGVycykudG8ubm90LmJlLnVuZGVmaW5lZFxuICAgICAgICAgICAgZXhwZWN0KG1ldGhvZFBhcmFtZXRlcnM/LnRvKS50by5lcXVhbChVTklWRVJTQUxfUk9VVEVSX0FERFJFU1MpXG5cbiAgICAgICAgICAgIGNvbnN0IHsgdG9rZW5JbkJlZm9yZSwgdG9rZW5JbkFmdGVyLCB0b2tlbk91dEJlZm9yZSwgdG9rZW5PdXRBZnRlciB9ID0gYXdhaXQgZXhlY3V0ZVN3YXAoXG4gICAgICAgICAgICAgIG1ldGhvZFBhcmFtZXRlcnMhLFxuICAgICAgICAgICAgICBVU0RDX01BSU5ORVQsXG4gICAgICAgICAgICAgIFVTRFRfTUFJTk5FVCxcbiAgICAgICAgICAgICAgdHJ1ZVxuICAgICAgICAgICAgKVxuXG4gICAgICAgICAgICBpZiAodHlwZSA9PSAnZXhhY3RJbicpIHtcbiAgICAgICAgICAgICAgZXhwZWN0KHRva2VuSW5CZWZvcmUuc3VidHJhY3QodG9rZW5JbkFmdGVyKS50b0V4YWN0KCkpLnRvLmVxdWFsKCcxMCcpXG4gICAgICAgICAgICAgIGNoZWNrUXVvdGVUb2tlbih0b2tlbk91dEJlZm9yZSwgdG9rZW5PdXRBZnRlciwgQ3VycmVuY3lBbW91bnQuZnJvbVJhd0Ftb3VudChVU0RUX01BSU5ORVQsIHF1b3RlKSlcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIGV4cGVjdCh0b2tlbk91dEFmdGVyLnN1YnRyYWN0KHRva2VuT3V0QmVmb3JlKS50b0V4YWN0KCkpLnRvLmVxdWFsKCcxMCcpXG4gICAgICAgICAgICAgIGNoZWNrUXVvdGVUb2tlbih0b2tlbkluQmVmb3JlLCB0b2tlbkluQWZ0ZXIsIEN1cnJlbmN5QW1vdW50LmZyb21SYXdBbW91bnQoVVNEQ19NQUlOTkVULCBxdW90ZSkpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSlcblxuICAgICAgICAgIGl0KGBlcmMyMCAtPiBldGhgLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBxdW90ZVJlcTogUXVvdGVRdWVyeVBhcmFtcyA9IHtcbiAgICAgICAgICAgICAgdG9rZW5JbkFkZHJlc3M6ICdVU0RDJyxcbiAgICAgICAgICAgICAgdG9rZW5JbkNoYWluSWQ6IDEsXG4gICAgICAgICAgICAgIHRva2VuT3V0QWRkcmVzczogJ0VUSCcsXG4gICAgICAgICAgICAgIHRva2VuT3V0Q2hhaW5JZDogMSxcbiAgICAgICAgICAgICAgYW1vdW50OiBhd2FpdCBnZXRBbW91bnQoMSwgdHlwZSwgJ1VTREMnLCAnRVRIJywgdHlwZSA9PSAnZXhhY3RJbicgPyAnMTAwMDAwMCcgOiAnMTAnKSxcbiAgICAgICAgICAgICAgdHlwZSxcbiAgICAgICAgICAgICAgcmVjaXBpZW50OiBhbGljZS5hZGRyZXNzLFxuICAgICAgICAgICAgICBzbGlwcGFnZVRvbGVyYW5jZTogU0xJUFBBR0UsXG4gICAgICAgICAgICAgIGRlYWRsaW5lOiAnMzYwJyxcbiAgICAgICAgICAgICAgYWxnb3JpdGhtLFxuICAgICAgICAgICAgICBlbmFibGVVbml2ZXJzYWxSb3V0ZXI6IHRydWUsXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHF1ZXJ5UGFyYW1zID0gcXMuc3RyaW5naWZ5KHF1b3RlUmVxKVxuXG4gICAgICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGF4aW9zLmdldDxRdW90ZVJlc3BvbnNlPihgJHtBUEl9PyR7cXVlcnlQYXJhbXN9YClcbiAgICAgICAgICAgIGNvbnN0IHtcbiAgICAgICAgICAgICAgZGF0YTogeyBxdW90ZSwgbWV0aG9kUGFyYW1ldGVycyB9LFxuICAgICAgICAgICAgICBzdGF0dXMsXG4gICAgICAgICAgICB9ID0gcmVzcG9uc2VcblxuICAgICAgICAgICAgZXhwZWN0KHN0YXR1cykudG8uZXF1YWwoMjAwKVxuICAgICAgICAgICAgZXhwZWN0KG1ldGhvZFBhcmFtZXRlcnMpLnRvLm5vdC5iZS51bmRlZmluZWRcblxuICAgICAgICAgICAgY29uc3QgeyB0b2tlbkluQmVmb3JlLCB0b2tlbkluQWZ0ZXIsIHRva2VuT3V0QmVmb3JlLCB0b2tlbk91dEFmdGVyIH0gPSBhd2FpdCBleGVjdXRlU3dhcChcbiAgICAgICAgICAgICAgbWV0aG9kUGFyYW1ldGVycyEsXG4gICAgICAgICAgICAgIFVTRENfTUFJTk5FVCxcbiAgICAgICAgICAgICAgRXRoZXIub25DaGFpbigxKVxuICAgICAgICAgICAgKVxuXG4gICAgICAgICAgICBpZiAodHlwZSA9PSAnZXhhY3RJbicpIHtcbiAgICAgICAgICAgICAgZXhwZWN0KHRva2VuSW5CZWZvcmUuc3VidHJhY3QodG9rZW5JbkFmdGVyKS50b0V4YWN0KCkpLnRvLmVxdWFsKCcxMDAwMDAwJylcbiAgICAgICAgICAgICAgY2hlY2tRdW90ZVRva2VuKHRva2VuT3V0QmVmb3JlLCB0b2tlbk91dEFmdGVyLCBDdXJyZW5jeUFtb3VudC5mcm9tUmF3QW1vdW50KEV0aGVyLm9uQ2hhaW4oMSksIHF1b3RlKSlcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIEhhcmQgdG8gdGVzdCBFVEggYmFsYW5jZSBkdWUgdG8gZ2FzIGNvc3RzIGZvciBhcHByb3ZhbCBhbmQgc3dhcC4gSnVzdCBjaGVjayB0b2tlbkluIGNoYW5nZXNcbiAgICAgICAgICAgICAgY2hlY2tRdW90ZVRva2VuKHRva2VuSW5CZWZvcmUsIHRva2VuSW5BZnRlciwgQ3VycmVuY3lBbW91bnQuZnJvbVJhd0Ftb3VudChVU0RDX01BSU5ORVQsIHF1b3RlKSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KVxuXG4gICAgICAgICAgaXQoYGVyYzIwIC0+IGV0aCBsYXJnZSB0cmFkZWAsIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIC8vIFRyYWRlIG9mIHRoaXMgc2l6ZSBhbG1vc3QgYWx3YXlzIHJlc3VsdHMgaW4gc3BsaXRzLlxuICAgICAgICAgICAgY29uc3QgcXVvdGVSZXE6IFF1b3RlUXVlcnlQYXJhbXMgPSB7XG4gICAgICAgICAgICAgIHRva2VuSW5BZGRyZXNzOiAnVVNEQycsXG4gICAgICAgICAgICAgIHRva2VuSW5DaGFpbklkOiAxLFxuICAgICAgICAgICAgICB0b2tlbk91dEFkZHJlc3M6ICdFVEgnLFxuICAgICAgICAgICAgICB0b2tlbk91dENoYWluSWQ6IDEsXG4gICAgICAgICAgICAgIGFtb3VudDpcbiAgICAgICAgICAgICAgICB0eXBlID09ICdleGFjdEluJ1xuICAgICAgICAgICAgICAgICAgPyBhd2FpdCBnZXRBbW91bnQoMSwgdHlwZSwgJ1VTREMnLCAnRVRIJywgJzEwMDAwMDAnKVxuICAgICAgICAgICAgICAgICAgOiBhd2FpdCBnZXRBbW91bnQoMSwgdHlwZSwgJ1VTREMnLCAnRVRIJywgJzEwMCcpLFxuICAgICAgICAgICAgICB0eXBlLFxuICAgICAgICAgICAgICByZWNpcGllbnQ6IGFsaWNlLmFkZHJlc3MsXG4gICAgICAgICAgICAgIHNsaXBwYWdlVG9sZXJhbmNlOiBTTElQUEFHRSxcbiAgICAgICAgICAgICAgZGVhZGxpbmU6ICczNjAnLFxuICAgICAgICAgICAgICBhbGdvcml0aG0sXG4gICAgICAgICAgICAgIGVuYWJsZVVuaXZlcnNhbFJvdXRlcjogdHJ1ZSxcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgcXVlcnlQYXJhbXMgPSBxcy5zdHJpbmdpZnkocXVvdGVSZXEpXG5cbiAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgYXhpb3MuZ2V0PFF1b3RlUmVzcG9uc2U+KGAke0FQSX0/JHtxdWVyeVBhcmFtc31gKVxuICAgICAgICAgICAgY29uc3QgeyBkYXRhLCBzdGF0dXMgfSA9IHJlc3BvbnNlXG5cbiAgICAgICAgICAgIGV4cGVjdChzdGF0dXMpLnRvLmVxdWFsKDIwMClcbiAgICAgICAgICAgIGV4cGVjdChkYXRhLm1ldGhvZFBhcmFtZXRlcnMpLnRvLm5vdC5iZS51bmRlZmluZWRcblxuICAgICAgICAgICAgZXhwZWN0KGRhdGEucm91dGUpLnRvLm5vdC5iZS51bmRlZmluZWRcblxuICAgICAgICAgICAgY29uc3QgYW1vdW50SW5FZGdlc1RvdGFsID0gXyhkYXRhLnJvdXRlKVxuICAgICAgICAgICAgICAuZmxhdE1hcCgocm91dGUpID0+IHJvdXRlWzBdISlcbiAgICAgICAgICAgICAgLmZpbHRlcigocG9vbCkgPT4gISFwb29sLmFtb3VudEluKVxuICAgICAgICAgICAgICAubWFwKChwb29sKSA9PiBCaWdOdW1iZXIuZnJvbShwb29sLmFtb3VudEluKSlcbiAgICAgICAgICAgICAgLnJlZHVjZSgoY3VyLCB0b3RhbCkgPT4gdG90YWwuYWRkKGN1ciksIEJpZ051bWJlci5mcm9tKDApKVxuICAgICAgICAgICAgY29uc3QgYW1vdW50SW4gPSBCaWdOdW1iZXIuZnJvbShkYXRhLnF1b3RlKVxuICAgICAgICAgICAgZXhwZWN0KGFtb3VudEluLmVxKGFtb3VudEluRWRnZXNUb3RhbCkpXG5cbiAgICAgICAgICAgIGNvbnN0IGFtb3VudE91dEVkZ2VzVG90YWwgPSBfKGRhdGEucm91dGUpXG4gICAgICAgICAgICAgIC5mbGF0TWFwKChyb3V0ZSkgPT4gcm91dGVbMF0hKVxuICAgICAgICAgICAgICAuZmlsdGVyKChwb29sKSA9PiAhIXBvb2wuYW1vdW50T3V0KVxuICAgICAgICAgICAgICAubWFwKChwb29sKSA9PiBCaWdOdW1iZXIuZnJvbShwb29sLmFtb3VudE91dCkpXG4gICAgICAgICAgICAgIC5yZWR1Y2UoKGN1ciwgdG90YWwpID0+IHRvdGFsLmFkZChjdXIpLCBCaWdOdW1iZXIuZnJvbSgwKSlcbiAgICAgICAgICAgIGNvbnN0IGFtb3VudE91dCA9IEJpZ051bWJlci5mcm9tKGRhdGEucXVvdGUpXG4gICAgICAgICAgICBleHBlY3QoYW1vdW50T3V0LmVxKGFtb3VudE91dEVkZ2VzVG90YWwpKVxuXG4gICAgICAgICAgICBjb25zdCB7IHRva2VuSW5CZWZvcmUsIHRva2VuSW5BZnRlciwgdG9rZW5PdXRCZWZvcmUsIHRva2VuT3V0QWZ0ZXIgfSA9IGF3YWl0IGV4ZWN1dGVTd2FwKFxuICAgICAgICAgICAgICBkYXRhLm1ldGhvZFBhcmFtZXRlcnMhLFxuICAgICAgICAgICAgICBVU0RDX01BSU5ORVQsXG4gICAgICAgICAgICAgIEV0aGVyLm9uQ2hhaW4oMSlcbiAgICAgICAgICAgIClcblxuICAgICAgICAgICAgaWYgKHR5cGUgPT0gJ2V4YWN0SW4nKSB7XG4gICAgICAgICAgICAgIGV4cGVjdCh0b2tlbkluQmVmb3JlLnN1YnRyYWN0KHRva2VuSW5BZnRlcikudG9FeGFjdCgpKS50by5lcXVhbCgnMTAwMDAwMCcpXG4gICAgICAgICAgICAgIGNoZWNrUXVvdGVUb2tlbih0b2tlbk91dEJlZm9yZSwgdG9rZW5PdXRBZnRlciwgQ3VycmVuY3lBbW91bnQuZnJvbVJhd0Ftb3VudChFdGhlci5vbkNoYWluKDEpLCBkYXRhLnF1b3RlKSlcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIC8vIEhhcmQgdG8gdGVzdCBFVEggYmFsYW5jZSBkdWUgdG8gZ2FzIGNvc3RzIGZvciBhcHByb3ZhbCBhbmQgc3dhcC4gSnVzdCBjaGVjayB0b2tlbkluIGNoYW5nZXNcbiAgICAgICAgICAgICAgY2hlY2tRdW90ZVRva2VuKHRva2VuSW5CZWZvcmUsIHRva2VuSW5BZnRlciwgQ3VycmVuY3lBbW91bnQuZnJvbVJhd0Ftb3VudChVU0RDX01BSU5ORVQsIGRhdGEucXVvdGUpKVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH0pXG5cbiAgICAgICAgICBpdChgZXJjMjAgLT4gZXRoIGxhcmdlIHRyYWRlIHdpdGggcGVybWl0YCwgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgY29uc3Qgbm9uY2UgPSBuZXh0UGVybWl0Tm9uY2UoKVxuXG4gICAgICAgICAgICBjb25zdCBhbW91bnQgPVxuICAgICAgICAgICAgICB0eXBlID09ICdleGFjdEluJ1xuICAgICAgICAgICAgICAgID8gYXdhaXQgZ2V0QW1vdW50KDEsIHR5cGUsICdVU0RDJywgJ0VUSCcsICcxMDAwMDAwJylcbiAgICAgICAgICAgICAgICA6IGF3YWl0IGdldEFtb3VudCgxLCB0eXBlLCAnVVNEQycsICdFVEgnLCAnMTAwJylcblxuICAgICAgICAgICAgY29uc3QgcGVybWl0OiBQZXJtaXRTaW5nbGUgPSB7XG4gICAgICAgICAgICAgIGRldGFpbHM6IHtcbiAgICAgICAgICAgICAgICB0b2tlbjogVVNEQ19NQUlOTkVULmFkZHJlc3MsXG4gICAgICAgICAgICAgICAgYW1vdW50OiAnMTUwMDAwMDAwMDAwMCcsIC8vIEZvciBleGFjdCBvdXQgd2UgZG9uJ3Qga25vdyB0aGUgZXhhY3QgYW1vdW50IG5lZWRlZCB0byBwZXJtaXQsIHNvIGp1c3Qgc3BlY2lmeSBhIGxhcmdlIGFtb3VudC5cbiAgICAgICAgICAgICAgICBleHBpcmF0aW9uOiBNYXRoLmZsb29yKG5ldyBEYXRlKCkuZ2V0VGltZSgpIC8gMTAwMCArIDEwMDAwMDAwKS50b1N0cmluZygpLFxuICAgICAgICAgICAgICAgIG5vbmNlLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBzcGVuZGVyOiBVTklWRVJTQUxfUk9VVEVSX0FERFJFU1MsXG4gICAgICAgICAgICAgIHNpZ0RlYWRsaW5lOiBNYXRoLmZsb29yKG5ldyBEYXRlKCkuZ2V0VGltZSgpIC8gMTAwMCArIDEwMDAwMDAwKS50b1N0cmluZygpLFxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCB7IGRvbWFpbiwgdHlwZXMsIHZhbHVlcyB9ID0gQWxsb3dhbmNlVHJhbnNmZXIuZ2V0UGVybWl0RGF0YShwZXJtaXQsIFBFUk1JVDJfQUREUkVTUywgMSlcblxuICAgICAgICAgICAgY29uc3Qgc2lnbmF0dXJlID0gYXdhaXQgYWxpY2UuX3NpZ25UeXBlZERhdGEoZG9tYWluLCB0eXBlcywgdmFsdWVzKVxuXG4gICAgICAgICAgICAvLyBUcmFkZSBvZiB0aGlzIHNpemUgYWxtb3N0IGFsd2F5cyByZXN1bHRzIGluIHNwbGl0cy5cbiAgICAgICAgICAgIGNvbnN0IHF1b3RlUmVxOiBRdW90ZVF1ZXJ5UGFyYW1zID0ge1xuICAgICAgICAgICAgICB0b2tlbkluQWRkcmVzczogJ1VTREMnLFxuICAgICAgICAgICAgICB0b2tlbkluQ2hhaW5JZDogMSxcbiAgICAgICAgICAgICAgdG9rZW5PdXRBZGRyZXNzOiAnRVRIJyxcbiAgICAgICAgICAgICAgdG9rZW5PdXRDaGFpbklkOiAxLFxuICAgICAgICAgICAgICBhbW91bnQsXG4gICAgICAgICAgICAgIHR5cGUsXG4gICAgICAgICAgICAgIHJlY2lwaWVudDogYWxpY2UuYWRkcmVzcyxcbiAgICAgICAgICAgICAgc2xpcHBhZ2VUb2xlcmFuY2U6IFNMSVBQQUdFLFxuICAgICAgICAgICAgICBkZWFkbGluZTogJzM2MCcsXG4gICAgICAgICAgICAgIGFsZ29yaXRobSxcbiAgICAgICAgICAgICAgcGVybWl0U2lnbmF0dXJlOiBzaWduYXR1cmUsXG4gICAgICAgICAgICAgIHBlcm1pdEFtb3VudDogcGVybWl0LmRldGFpbHMuYW1vdW50LnRvU3RyaW5nKCksXG4gICAgICAgICAgICAgIHBlcm1pdEV4cGlyYXRpb246IHBlcm1pdC5kZXRhaWxzLmV4cGlyYXRpb24udG9TdHJpbmcoKSxcbiAgICAgICAgICAgICAgcGVybWl0U2lnRGVhZGxpbmU6IHBlcm1pdC5zaWdEZWFkbGluZS50b1N0cmluZygpLFxuICAgICAgICAgICAgICBwZXJtaXROb25jZTogcGVybWl0LmRldGFpbHMubm9uY2UudG9TdHJpbmcoKSxcbiAgICAgICAgICAgICAgZW5hYmxlVW5pdmVyc2FsUm91dGVyOiB0cnVlLFxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBxdWVyeVBhcmFtcyA9IHFzLnN0cmluZ2lmeShxdW90ZVJlcSlcblxuICAgICAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBheGlvcy5nZXQ8UXVvdGVSZXNwb25zZT4oYCR7QVBJfT8ke3F1ZXJ5UGFyYW1zfWApXG4gICAgICAgICAgICBjb25zdCB7IGRhdGEsIHN0YXR1cyB9ID0gcmVzcG9uc2VcblxuICAgICAgICAgICAgZXhwZWN0KHN0YXR1cykudG8uZXF1YWwoMjAwKVxuICAgICAgICAgICAgZXhwZWN0KGRhdGEubWV0aG9kUGFyYW1ldGVycykudG8ubm90LmJlLnVuZGVmaW5lZFxuICAgICAgICAgICAgZXhwZWN0KGRhdGEucm91dGUpLnRvLm5vdC5iZS51bmRlZmluZWRcblxuICAgICAgICAgICAgY29uc3QgeyB0b2tlbkluQmVmb3JlLCB0b2tlbkluQWZ0ZXIsIHRva2VuT3V0QmVmb3JlLCB0b2tlbk91dEFmdGVyIH0gPSBhd2FpdCBleGVjdXRlU3dhcChcbiAgICAgICAgICAgICAgZGF0YS5tZXRob2RQYXJhbWV0ZXJzISxcbiAgICAgICAgICAgICAgVVNEQ19NQUlOTkVULFxuICAgICAgICAgICAgICBFdGhlci5vbkNoYWluKDEpLFxuICAgICAgICAgICAgICB0cnVlXG4gICAgICAgICAgICApXG5cbiAgICAgICAgICAgIGlmICh0eXBlID09ICdleGFjdEluJykge1xuICAgICAgICAgICAgICBleHBlY3QodG9rZW5JbkJlZm9yZS5zdWJ0cmFjdCh0b2tlbkluQWZ0ZXIpLnRvRXhhY3QoKSkudG8uZXF1YWwoJzEwMDAwMDAnKVxuICAgICAgICAgICAgICBjaGVja1F1b3RlVG9rZW4odG9rZW5PdXRCZWZvcmUsIHRva2VuT3V0QWZ0ZXIsIEN1cnJlbmN5QW1vdW50LmZyb21SYXdBbW91bnQoRXRoZXIub25DaGFpbigxKSwgZGF0YS5xdW90ZSkpXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAvLyBIYXJkIHRvIHRlc3QgRVRIIGJhbGFuY2UgZHVlIHRvIGdhcyBjb3N0cyBmb3IgYXBwcm92YWwgYW5kIHN3YXAuIEp1c3QgY2hlY2sgdG9rZW5JbiBjaGFuZ2VzXG4gICAgICAgICAgICAgIGNoZWNrUXVvdGVUb2tlbih0b2tlbkluQmVmb3JlLCB0b2tlbkluQWZ0ZXIsIEN1cnJlbmN5QW1vdW50LmZyb21SYXdBbW91bnQoVVNEQ19NQUlOTkVULCBkYXRhLnF1b3RlKSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KVxuXG4gICAgICAgICAgaXQoYGV0aCAtPiBlcmMyMGAsIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHF1b3RlUmVxOiBRdW90ZVF1ZXJ5UGFyYW1zID0ge1xuICAgICAgICAgICAgICB0b2tlbkluQWRkcmVzczogJ0VUSCcsXG4gICAgICAgICAgICAgIHRva2VuSW5DaGFpbklkOiAxLFxuICAgICAgICAgICAgICB0b2tlbk91dEFkZHJlc3M6ICdVTkknLFxuICAgICAgICAgICAgICB0b2tlbk91dENoYWluSWQ6IDEsXG4gICAgICAgICAgICAgIGFtb3VudDpcbiAgICAgICAgICAgICAgICB0eXBlID09ICdleGFjdEluJ1xuICAgICAgICAgICAgICAgICAgPyBhd2FpdCBnZXRBbW91bnQoMSwgdHlwZSwgJ0VUSCcsICdVTkknLCAnMTAnKVxuICAgICAgICAgICAgICAgICAgOiBhd2FpdCBnZXRBbW91bnQoMSwgdHlwZSwgJ0VUSCcsICdVTkknLCAnMTAwMDAnKSxcbiAgICAgICAgICAgICAgdHlwZSxcbiAgICAgICAgICAgICAgcmVjaXBpZW50OiBhbGljZS5hZGRyZXNzLFxuICAgICAgICAgICAgICBzbGlwcGFnZVRvbGVyYW5jZTogU0xJUFBBR0UsXG4gICAgICAgICAgICAgIGRlYWRsaW5lOiAnMzYwJyxcbiAgICAgICAgICAgICAgYWxnb3JpdGhtLFxuICAgICAgICAgICAgICBlbmFibGVVbml2ZXJzYWxSb3V0ZXI6IHRydWUsXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGNvbnN0IHF1ZXJ5UGFyYW1zID0gcXMuc3RyaW5naWZ5KHF1b3RlUmVxKVxuXG4gICAgICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGF4aW9zLmdldDxRdW90ZVJlc3BvbnNlPihgJHtBUEl9PyR7cXVlcnlQYXJhbXN9YClcbiAgICAgICAgICAgIGNvbnN0IHsgZGF0YSwgc3RhdHVzIH0gPSByZXNwb25zZVxuXG4gICAgICAgICAgICBleHBlY3Qoc3RhdHVzKS50by5lcXVhbCgyMDApXG4gICAgICAgICAgICBleHBlY3QoZGF0YS5tZXRob2RQYXJhbWV0ZXJzKS50by5ub3QuYmUudW5kZWZpbmVkXG5cbiAgICAgICAgICAgIGNvbnN0IHsgdG9rZW5JbkJlZm9yZSwgdG9rZW5JbkFmdGVyLCB0b2tlbk91dEJlZm9yZSwgdG9rZW5PdXRBZnRlciB9ID0gYXdhaXQgZXhlY3V0ZVN3YXAoXG4gICAgICAgICAgICAgIGRhdGEubWV0aG9kUGFyYW1ldGVycyEsXG4gICAgICAgICAgICAgIEV0aGVyLm9uQ2hhaW4oMSksXG4gICAgICAgICAgICAgIFVOSV9NQUlOTkVUXG4gICAgICAgICAgICApXG5cbiAgICAgICAgICAgIGlmICh0eXBlID09ICdleGFjdEluJykge1xuICAgICAgICAgICAgICAvLyBXZSd2ZSBzd2FwcGVkIDEwIEVUSCArIGdhcyBjb3N0c1xuICAgICAgICAgICAgICBleHBlY3QodG9rZW5JbkJlZm9yZS5zdWJ0cmFjdCh0b2tlbkluQWZ0ZXIpLmdyZWF0ZXJUaGFuKHBhcnNlQW1vdW50KCcxMCcsIEV0aGVyLm9uQ2hhaW4oMSkpKSkudG8uYmUudHJ1ZVxuICAgICAgICAgICAgICBjaGVja1F1b3RlVG9rZW4odG9rZW5PdXRCZWZvcmUsIHRva2VuT3V0QWZ0ZXIsIEN1cnJlbmN5QW1vdW50LmZyb21SYXdBbW91bnQoVU5JX01BSU5ORVQsIGRhdGEucXVvdGUpKVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgZXhwZWN0KHRva2VuT3V0QWZ0ZXIuc3VidHJhY3QodG9rZW5PdXRCZWZvcmUpLnRvRXhhY3QoKSkudG8uZXF1YWwoJzEwMDAwJylcbiAgICAgICAgICAgICAgLy8gQ2FuJ3QgZWFzaWx5IGNoZWNrIHNsaXBwYWdlIGZvciBFVEggZHVlIHRvIGdhcyBjb3N0cyBlZmZlY3RpbmcgRVRIIGJhbGFuY2UuXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSlcblxuICAgICAgICAgIGl0KGBldGggLT4gZXJjMjAgc3dhcHJvdXRlcjAyYCwgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgY29uc3QgcXVvdGVSZXE6IFF1b3RlUXVlcnlQYXJhbXMgPSB7XG4gICAgICAgICAgICAgIHRva2VuSW5BZGRyZXNzOiAnRVRIJyxcbiAgICAgICAgICAgICAgdG9rZW5JbkNoYWluSWQ6IDEsXG4gICAgICAgICAgICAgIHRva2VuT3V0QWRkcmVzczogJ1VOSScsXG4gICAgICAgICAgICAgIHRva2VuT3V0Q2hhaW5JZDogMSxcbiAgICAgICAgICAgICAgYW1vdW50OlxuICAgICAgICAgICAgICAgIHR5cGUgPT0gJ2V4YWN0SW4nXG4gICAgICAgICAgICAgICAgICA/IGF3YWl0IGdldEFtb3VudCgxLCB0eXBlLCAnRVRIJywgJ1VOSScsICcxMCcpXG4gICAgICAgICAgICAgICAgICA6IGF3YWl0IGdldEFtb3VudCgxLCB0eXBlLCAnRVRIJywgJ1VOSScsICcxMDAwMCcpLFxuICAgICAgICAgICAgICB0eXBlLFxuICAgICAgICAgICAgICByZWNpcGllbnQ6IGFsaWNlLmFkZHJlc3MsXG4gICAgICAgICAgICAgIHNsaXBwYWdlVG9sZXJhbmNlOiB0eXBlID09ICdleGFjdE91dCcgPyBMQVJHRV9TTElQUEFHRSA6IFNMSVBQQUdFLFxuICAgICAgICAgICAgICBkZWFkbGluZTogJzM2MCcsXG4gICAgICAgICAgICAgIGFsZ29yaXRobSxcbiAgICAgICAgICAgICAgZW5hYmxlVW5pdmVyc2FsUm91dGVyOiBmYWxzZSxcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgcXVlcnlQYXJhbXMgPSBxcy5zdHJpbmdpZnkocXVvdGVSZXEpXG5cbiAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgYXhpb3MuZ2V0PFF1b3RlUmVzcG9uc2U+KGAke0FQSX0/JHtxdWVyeVBhcmFtc31gKVxuICAgICAgICAgICAgY29uc3QgeyBkYXRhLCBzdGF0dXMgfSA9IHJlc3BvbnNlXG5cbiAgICAgICAgICAgIGV4cGVjdChzdGF0dXMpLnRvLmVxdWFsKDIwMClcbiAgICAgICAgICAgIGV4cGVjdChkYXRhLm1ldGhvZFBhcmFtZXRlcnMpLnRvLm5vdC5iZS51bmRlZmluZWRcbiAgICAgICAgICAgIGV4cGVjdChkYXRhLm1ldGhvZFBhcmFtZXRlcnM/LnRvKS50by5lcXVhbChTV0FQX1JPVVRFUl8wMl9BRERSRVNTRVMoQ2hhaW5JZC5NQUlOTkVUKSlcblxuICAgICAgICAgICAgY29uc3QgeyB0b2tlbkluQmVmb3JlLCB0b2tlbkluQWZ0ZXIsIHRva2VuT3V0QmVmb3JlLCB0b2tlbk91dEFmdGVyIH0gPSBhd2FpdCBleGVjdXRlU3dhcChcbiAgICAgICAgICAgICAgZGF0YS5tZXRob2RQYXJhbWV0ZXJzISxcbiAgICAgICAgICAgICAgRXRoZXIub25DaGFpbigxKSxcbiAgICAgICAgICAgICAgVU5JX01BSU5ORVRcbiAgICAgICAgICAgIClcblxuICAgICAgICAgICAgaWYgKHR5cGUgPT0gJ2V4YWN0SW4nKSB7XG4gICAgICAgICAgICAgIC8vIFdlJ3ZlIHN3YXBwZWQgMTAgRVRIICsgZ2FzIGNvc3RzXG4gICAgICAgICAgICAgIGV4cGVjdCh0b2tlbkluQmVmb3JlLnN1YnRyYWN0KHRva2VuSW5BZnRlcikuZ3JlYXRlclRoYW4ocGFyc2VBbW91bnQoJzEwJywgRXRoZXIub25DaGFpbigxKSkpKS50by5iZS50cnVlXG4gICAgICAgICAgICAgIGNoZWNrUXVvdGVUb2tlbih0b2tlbk91dEJlZm9yZSwgdG9rZW5PdXRBZnRlciwgQ3VycmVuY3lBbW91bnQuZnJvbVJhd0Ftb3VudChVTklfTUFJTk5FVCwgZGF0YS5xdW90ZSkpXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICBleHBlY3QodG9rZW5PdXRBZnRlci5zdWJ0cmFjdCh0b2tlbk91dEJlZm9yZSkudG9FeGFjdCgpKS50by5lcXVhbCgnMTAwMDAnKVxuICAgICAgICAgICAgICAvLyBDYW4ndCBlYXNpbHkgY2hlY2sgc2xpcHBhZ2UgZm9yIEVUSCBkdWUgdG8gZ2FzIGNvc3RzIGVmZmVjdGluZyBFVEggYmFsYW5jZS5cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KVxuXG4gICAgICAgICAgaXQoYHdldGggLT4gZXJjMjBgLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBxdW90ZVJlcTogUXVvdGVRdWVyeVBhcmFtcyA9IHtcbiAgICAgICAgICAgICAgdG9rZW5JbkFkZHJlc3M6ICdXRVRIJyxcbiAgICAgICAgICAgICAgdG9rZW5JbkNoYWluSWQ6IDEsXG4gICAgICAgICAgICAgIHRva2VuT3V0QWRkcmVzczogJ0RBSScsXG4gICAgICAgICAgICAgIHRva2VuT3V0Q2hhaW5JZDogMSxcbiAgICAgICAgICAgICAgYW1vdW50OiBhd2FpdCBnZXRBbW91bnQoMSwgdHlwZSwgJ1dFVEgnLCAnREFJJywgJzEwMCcpLFxuICAgICAgICAgICAgICB0eXBlLFxuICAgICAgICAgICAgICByZWNpcGllbnQ6IGFsaWNlLmFkZHJlc3MsXG4gICAgICAgICAgICAgIHNsaXBwYWdlVG9sZXJhbmNlOiBTTElQUEFHRSxcbiAgICAgICAgICAgICAgZGVhZGxpbmU6ICczNjAnLFxuICAgICAgICAgICAgICBhbGdvcml0aG0sXG4gICAgICAgICAgICAgIGVuYWJsZVVuaXZlcnNhbFJvdXRlcjogdHJ1ZSxcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgY29uc3QgcXVlcnlQYXJhbXMgPSBxcy5zdHJpbmdpZnkocXVvdGVSZXEpXG5cbiAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgYXhpb3MuZ2V0PFF1b3RlUmVzcG9uc2U+KGAke0FQSX0/JHtxdWVyeVBhcmFtc31gKVxuICAgICAgICAgICAgY29uc3QgeyBkYXRhLCBzdGF0dXMgfSA9IHJlc3BvbnNlXG5cbiAgICAgICAgICAgIGV4cGVjdChzdGF0dXMpLnRvLmVxdWFsKDIwMClcbiAgICAgICAgICAgIGV4cGVjdChkYXRhLm1ldGhvZFBhcmFtZXRlcnMpLnRvLm5vdC5iZS51bmRlZmluZWRcblxuICAgICAgICAgICAgY29uc3QgeyB0b2tlbkluQmVmb3JlLCB0b2tlbkluQWZ0ZXIsIHRva2VuT3V0QmVmb3JlLCB0b2tlbk91dEFmdGVyIH0gPSBhd2FpdCBleGVjdXRlU3dhcChcbiAgICAgICAgICAgICAgZGF0YS5tZXRob2RQYXJhbWV0ZXJzISxcbiAgICAgICAgICAgICAgV0VUSDlbMV0hLFxuICAgICAgICAgICAgICBEQUlfTUFJTk5FVFxuICAgICAgICAgICAgKVxuXG4gICAgICAgICAgICBpZiAodHlwZSA9PSAnZXhhY3RJbicpIHtcbiAgICAgICAgICAgICAgZXhwZWN0KHRva2VuSW5CZWZvcmUuc3VidHJhY3QodG9rZW5JbkFmdGVyKS50b0V4YWN0KCkpLnRvLmVxdWFsKCcxMDAnKVxuICAgICAgICAgICAgICBjaGVja1F1b3RlVG9rZW4odG9rZW5PdXRCZWZvcmUsIHRva2VuT3V0QWZ0ZXIsIEN1cnJlbmN5QW1vdW50LmZyb21SYXdBbW91bnQoREFJX01BSU5ORVQsIGRhdGEucXVvdGUpKVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgZXhwZWN0KHRva2VuT3V0QWZ0ZXIuc3VidHJhY3QodG9rZW5PdXRCZWZvcmUpLnRvRXhhY3QoKSkudG8uZXF1YWwoJzEwMCcpXG4gICAgICAgICAgICAgIGNoZWNrUXVvdGVUb2tlbih0b2tlbkluQmVmb3JlLCB0b2tlbkluQWZ0ZXIsIEN1cnJlbmN5QW1vdW50LmZyb21SYXdBbW91bnQoV0VUSDlbMV0hLCBkYXRhLnF1b3RlKSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KVxuXG4gICAgICAgICAgaXQoYGVyYzIwIC0+IHdldGhgLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICBjb25zdCBxdW90ZVJlcTogUXVvdGVRdWVyeVBhcmFtcyA9IHtcbiAgICAgICAgICAgICAgdG9rZW5JbkFkZHJlc3M6ICdVU0RDJyxcbiAgICAgICAgICAgICAgdG9rZW5JbkNoYWluSWQ6IDEsXG4gICAgICAgICAgICAgIHRva2VuT3V0QWRkcmVzczogJ1dFVEgnLFxuICAgICAgICAgICAgICB0b2tlbk91dENoYWluSWQ6IDEsXG4gICAgICAgICAgICAgIGFtb3VudDogYXdhaXQgZ2V0QW1vdW50KDEsIHR5cGUsICdVU0RDJywgJ1dFVEgnLCAnMTAwJyksXG4gICAgICAgICAgICAgIHR5cGUsXG4gICAgICAgICAgICAgIHJlY2lwaWVudDogYWxpY2UuYWRkcmVzcyxcbiAgICAgICAgICAgICAgc2xpcHBhZ2VUb2xlcmFuY2U6IFNMSVBQQUdFLFxuICAgICAgICAgICAgICBkZWFkbGluZTogJzM2MCcsXG4gICAgICAgICAgICAgIGFsZ29yaXRobSxcbiAgICAgICAgICAgICAgZW5hYmxlVW5pdmVyc2FsUm91dGVyOiB0cnVlLFxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBjb25zdCBxdWVyeVBhcmFtcyA9IHFzLnN0cmluZ2lmeShxdW90ZVJlcSlcblxuICAgICAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBheGlvcy5nZXQ8UXVvdGVSZXNwb25zZT4oYCR7QVBJfT8ke3F1ZXJ5UGFyYW1zfWApXG4gICAgICAgICAgICBjb25zdCB7IGRhdGEsIHN0YXR1cyB9ID0gcmVzcG9uc2VcblxuICAgICAgICAgICAgZXhwZWN0KHN0YXR1cykudG8uZXF1YWwoMjAwKVxuICAgICAgICAgICAgZXhwZWN0KGRhdGEubWV0aG9kUGFyYW1ldGVycykudG8ubm90LmJlLnVuZGVmaW5lZFxuXG4gICAgICAgICAgICBjb25zdCB7IHRva2VuSW5CZWZvcmUsIHRva2VuSW5BZnRlciwgdG9rZW5PdXRCZWZvcmUsIHRva2VuT3V0QWZ0ZXIgfSA9IGF3YWl0IGV4ZWN1dGVTd2FwKFxuICAgICAgICAgICAgICBkYXRhLm1ldGhvZFBhcmFtZXRlcnMhLFxuICAgICAgICAgICAgICBVU0RDX01BSU5ORVQsXG4gICAgICAgICAgICAgIFdFVEg5WzFdIVxuICAgICAgICAgICAgKVxuXG4gICAgICAgICAgICBpZiAodHlwZSA9PSAnZXhhY3RJbicpIHtcbiAgICAgICAgICAgICAgZXhwZWN0KHRva2VuSW5CZWZvcmUuc3VidHJhY3QodG9rZW5JbkFmdGVyKS50b0V4YWN0KCkpLnRvLmVxdWFsKCcxMDAnKVxuICAgICAgICAgICAgICBjaGVja1F1b3RlVG9rZW4odG9rZW5PdXRCZWZvcmUsIHRva2VuT3V0QWZ0ZXIsIEN1cnJlbmN5QW1vdW50LmZyb21SYXdBbW91bnQoV0VUSDlbMV0sIGRhdGEucXVvdGUpKVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgZXhwZWN0KHRva2VuT3V0QWZ0ZXIuc3VidHJhY3QodG9rZW5PdXRCZWZvcmUpLnRvRXhhY3QoKSkudG8uZXF1YWwoJzEwMCcpXG4gICAgICAgICAgICAgIGNoZWNrUXVvdGVUb2tlbih0b2tlbkluQmVmb3JlLCB0b2tlbkluQWZ0ZXIsIEN1cnJlbmN5QW1vdW50LmZyb21SYXdBbW91bnQoVVNEQ19NQUlOTkVULCBkYXRhLnF1b3RlKSlcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KVxuXG4gICAgICAgICAgaWYgKGFsZ29yaXRobSA9PSAnYWxwaGEnKSB7XG4gICAgICAgICAgICBpdChgZXJjMjAgLT4gZXJjMjAgdjMgb25seWAsIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgY29uc3QgcXVvdGVSZXE6IFF1b3RlUXVlcnlQYXJhbXMgPSB7XG4gICAgICAgICAgICAgICAgdG9rZW5JbkFkZHJlc3M6ICdVU0RDJyxcbiAgICAgICAgICAgICAgICB0b2tlbkluQ2hhaW5JZDogMSxcbiAgICAgICAgICAgICAgICB0b2tlbk91dEFkZHJlc3M6ICdVU0RUJyxcbiAgICAgICAgICAgICAgICB0b2tlbk91dENoYWluSWQ6IDEsXG4gICAgICAgICAgICAgICAgYW1vdW50OiBhd2FpdCBnZXRBbW91bnQoMSwgdHlwZSwgJ1VTREMnLCAnVVNEVCcsICcxMDAnKSxcbiAgICAgICAgICAgICAgICB0eXBlLFxuICAgICAgICAgICAgICAgIHJlY2lwaWVudDogYWxpY2UuYWRkcmVzcyxcbiAgICAgICAgICAgICAgICBzbGlwcGFnZVRvbGVyYW5jZTogU0xJUFBBR0UsXG4gICAgICAgICAgICAgICAgZGVhZGxpbmU6ICczNjAnLFxuICAgICAgICAgICAgICAgIGFsZ29yaXRobTogJ2FscGhhJyxcbiAgICAgICAgICAgICAgICBwcm90b2NvbHM6ICd2MycsXG4gICAgICAgICAgICAgICAgZW5hYmxlVW5pdmVyc2FsUm91dGVyOiB0cnVlLFxuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgY29uc3QgcXVlcnlQYXJhbXMgPSBxcy5zdHJpbmdpZnkocXVvdGVSZXEpXG5cbiAgICAgICAgICAgICAgY29uc3QgcmVzcG9uc2U6IEF4aW9zUmVzcG9uc2U8UXVvdGVSZXNwb25zZT4gPSBhd2FpdCBheGlvcy5nZXQ8UXVvdGVSZXNwb25zZT4oYCR7QVBJfT8ke3F1ZXJ5UGFyYW1zfWApXG4gICAgICAgICAgICAgIGNvbnN0IHtcbiAgICAgICAgICAgICAgICBkYXRhOiB7IHF1b3RlLCBxdW90ZURlY2ltYWxzLCBxdW90ZUdhc0FkanVzdGVkRGVjaW1hbHMsIG1ldGhvZFBhcmFtZXRlcnMsIHJvdXRlIH0sXG4gICAgICAgICAgICAgICAgc3RhdHVzLFxuICAgICAgICAgICAgICB9ID0gcmVzcG9uc2VcblxuICAgICAgICAgICAgICBleHBlY3Qoc3RhdHVzKS50by5lcXVhbCgyMDApXG4gICAgICAgICAgICAgIGV4cGVjdChwYXJzZUZsb2F0KHF1b3RlRGVjaW1hbHMpKS50by5iZS5ncmVhdGVyVGhhbig5MClcbiAgICAgICAgICAgICAgZXhwZWN0KHBhcnNlRmxvYXQocXVvdGVEZWNpbWFscykpLnRvLmJlLmxlc3NUaGFuKDExMClcblxuICAgICAgICAgICAgICBpZiAodHlwZSA9PSAnZXhhY3RJbicpIHtcbiAgICAgICAgICAgICAgICBleHBlY3QocGFyc2VGbG9hdChxdW90ZUdhc0FkanVzdGVkRGVjaW1hbHMpKS50by5iZS5sZXNzVGhhbk9yRXF1YWwocGFyc2VGbG9hdChxdW90ZURlY2ltYWxzKSlcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBleHBlY3QocGFyc2VGbG9hdChxdW90ZUdhc0FkanVzdGVkRGVjaW1hbHMpKS50by5iZS5ncmVhdGVyVGhhbk9yRXF1YWwocGFyc2VGbG9hdChxdW90ZURlY2ltYWxzKSlcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGV4cGVjdChtZXRob2RQYXJhbWV0ZXJzKS50by5ub3QuYmUudW5kZWZpbmVkXG5cbiAgICAgICAgICAgICAgZm9yIChjb25zdCByIG9mIHJvdXRlKSB7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBwb29sIG9mIHIpIHtcbiAgICAgICAgICAgICAgICAgIGV4cGVjdChwb29sLnR5cGUpLnRvLmVxdWFsKCd2My1wb29sJylcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBjb25zdCB7IHRva2VuSW5CZWZvcmUsIHRva2VuSW5BZnRlciwgdG9rZW5PdXRCZWZvcmUsIHRva2VuT3V0QWZ0ZXIgfSA9IGF3YWl0IGV4ZWN1dGVTd2FwKFxuICAgICAgICAgICAgICAgIHJlc3BvbnNlLmRhdGEubWV0aG9kUGFyYW1ldGVycyEsXG4gICAgICAgICAgICAgICAgVVNEQ19NQUlOTkVULFxuICAgICAgICAgICAgICAgIFVTRFRfTUFJTk5FVCFcbiAgICAgICAgICAgICAgKVxuXG4gICAgICAgICAgICAgIGlmICh0eXBlID09ICdleGFjdEluJykge1xuICAgICAgICAgICAgICAgIGV4cGVjdCh0b2tlbkluQmVmb3JlLnN1YnRyYWN0KHRva2VuSW5BZnRlcikudG9FeGFjdCgpKS50by5lcXVhbCgnMTAwJylcbiAgICAgICAgICAgICAgICBjaGVja1F1b3RlVG9rZW4odG9rZW5PdXRCZWZvcmUsIHRva2VuT3V0QWZ0ZXIsIEN1cnJlbmN5QW1vdW50LmZyb21SYXdBbW91bnQoVVNEVF9NQUlOTkVULCBxdW90ZSkpXG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZXhwZWN0KHRva2VuT3V0QWZ0ZXIuc3VidHJhY3QodG9rZW5PdXRCZWZvcmUpLnRvRXhhY3QoKSkudG8uZXF1YWwoJzEwMCcpXG4gICAgICAgICAgICAgICAgY2hlY2tRdW90ZVRva2VuKHRva2VuSW5CZWZvcmUsIHRva2VuSW5BZnRlciwgQ3VycmVuY3lBbW91bnQuZnJvbVJhd0Ftb3VudChVU0RDX01BSU5ORVQsIHF1b3RlKSlcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcblxuICAgICAgICAgICAgaXQoYGVyYzIwIC0+IGVyYzIwIHYyIG9ubHlgLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IHF1b3RlUmVxOiBRdW90ZVF1ZXJ5UGFyYW1zID0ge1xuICAgICAgICAgICAgICAgIHRva2VuSW5BZGRyZXNzOiAnVVNEQycsXG4gICAgICAgICAgICAgICAgdG9rZW5JbkNoYWluSWQ6IDEsXG4gICAgICAgICAgICAgICAgdG9rZW5PdXRBZGRyZXNzOiAnVVNEVCcsXG4gICAgICAgICAgICAgICAgdG9rZW5PdXRDaGFpbklkOiAxLFxuICAgICAgICAgICAgICAgIGFtb3VudDogYXdhaXQgZ2V0QW1vdW50KDEsIHR5cGUsICdVU0RDJywgJ1VTRFQnLCAnMTAwJyksXG4gICAgICAgICAgICAgICAgdHlwZSxcbiAgICAgICAgICAgICAgICByZWNpcGllbnQ6IGFsaWNlLmFkZHJlc3MsXG4gICAgICAgICAgICAgICAgc2xpcHBhZ2VUb2xlcmFuY2U6IFNMSVBQQUdFLFxuICAgICAgICAgICAgICAgIGRlYWRsaW5lOiAnMzYwJyxcbiAgICAgICAgICAgICAgICBhbGdvcml0aG06ICdhbHBoYScsXG4gICAgICAgICAgICAgICAgcHJvdG9jb2xzOiAndjInLFxuICAgICAgICAgICAgICAgIGVuYWJsZVVuaXZlcnNhbFJvdXRlcjogdHJ1ZSxcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGNvbnN0IHF1ZXJ5UGFyYW1zID0gcXMuc3RyaW5naWZ5KHF1b3RlUmVxKVxuXG4gICAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlOiBBeGlvc1Jlc3BvbnNlPFF1b3RlUmVzcG9uc2U+ID0gYXdhaXQgYXhpb3MuZ2V0PFF1b3RlUmVzcG9uc2U+KGAke0FQSX0/JHtxdWVyeVBhcmFtc31gKVxuICAgICAgICAgICAgICBjb25zdCB7XG4gICAgICAgICAgICAgICAgZGF0YTogeyBxdW90ZSwgcXVvdGVEZWNpbWFscywgcXVvdGVHYXNBZGp1c3RlZERlY2ltYWxzLCBtZXRob2RQYXJhbWV0ZXJzLCByb3V0ZSB9LFxuICAgICAgICAgICAgICAgIHN0YXR1cyxcbiAgICAgICAgICAgICAgfSA9IHJlc3BvbnNlXG5cbiAgICAgICAgICAgICAgZXhwZWN0KHN0YXR1cykudG8uZXF1YWwoMjAwKVxuICAgICAgICAgICAgICBleHBlY3QocGFyc2VGbG9hdChxdW90ZURlY2ltYWxzKSkudG8uYmUuZ3JlYXRlclRoYW4oOTApXG4gICAgICAgICAgICAgIGV4cGVjdChwYXJzZUZsb2F0KHF1b3RlRGVjaW1hbHMpKS50by5iZS5sZXNzVGhhbigxMTApXG5cbiAgICAgICAgICAgICAgaWYgKHR5cGUgPT0gJ2V4YWN0SW4nKSB7XG4gICAgICAgICAgICAgICAgZXhwZWN0KHBhcnNlRmxvYXQocXVvdGVHYXNBZGp1c3RlZERlY2ltYWxzKSkudG8uYmUubGVzc1RoYW5PckVxdWFsKHBhcnNlRmxvYXQocXVvdGVEZWNpbWFscykpXG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZXhwZWN0KHBhcnNlRmxvYXQocXVvdGVHYXNBZGp1c3RlZERlY2ltYWxzKSkudG8uYmUuZ3JlYXRlclRoYW5PckVxdWFsKHBhcnNlRmxvYXQocXVvdGVEZWNpbWFscykpXG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBleHBlY3QobWV0aG9kUGFyYW1ldGVycykudG8ubm90LmJlLnVuZGVmaW5lZFxuXG4gICAgICAgICAgICAgIGZvciAoY29uc3QgciBvZiByb3V0ZSkge1xuICAgICAgICAgICAgICAgIGZvciAoY29uc3QgcG9vbCBvZiByKSB7XG4gICAgICAgICAgICAgICAgICBleHBlY3QocG9vbC50eXBlKS50by5lcXVhbCgndjItcG9vbCcpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgY29uc3QgeyB0b2tlbkluQmVmb3JlLCB0b2tlbkluQWZ0ZXIsIHRva2VuT3V0QmVmb3JlLCB0b2tlbk91dEFmdGVyIH0gPSBhd2FpdCBleGVjdXRlU3dhcChcbiAgICAgICAgICAgICAgICByZXNwb25zZS5kYXRhLm1ldGhvZFBhcmFtZXRlcnMhLFxuICAgICAgICAgICAgICAgIFVTRENfTUFJTk5FVCxcbiAgICAgICAgICAgICAgICBVU0RUX01BSU5ORVQhXG4gICAgICAgICAgICAgIClcblxuICAgICAgICAgICAgICBpZiAodHlwZSA9PSAnZXhhY3RJbicpIHtcbiAgICAgICAgICAgICAgICBleHBlY3QodG9rZW5JbkJlZm9yZS5zdWJ0cmFjdCh0b2tlbkluQWZ0ZXIpLnRvRXhhY3QoKSkudG8uZXF1YWwoJzEwMCcpXG4gICAgICAgICAgICAgICAgY2hlY2tRdW90ZVRva2VuKHRva2VuT3V0QmVmb3JlLCB0b2tlbk91dEFmdGVyLCBDdXJyZW5jeUFtb3VudC5mcm9tUmF3QW1vdW50KFVTRFRfTUFJTk5FVCwgcXVvdGUpKVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGV4cGVjdCh0b2tlbk91dEFmdGVyLnN1YnRyYWN0KHRva2VuT3V0QmVmb3JlKS50b0V4YWN0KCkpLnRvLmVxdWFsKCcxMDAnKVxuICAgICAgICAgICAgICAgIGNoZWNrUXVvdGVUb2tlbih0b2tlbkluQmVmb3JlLCB0b2tlbkluQWZ0ZXIsIEN1cnJlbmN5QW1vdW50LmZyb21SYXdBbW91bnQoVVNEQ19NQUlOTkVULCBxdW90ZSkpXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgIGl0KGBlcmMyMCAtPiBlcmMyMCBmb3JjZUNyb3NzUHJvdG9jb2xgLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IHF1b3RlUmVxOiBRdW90ZVF1ZXJ5UGFyYW1zID0ge1xuICAgICAgICAgICAgICAgIHRva2VuSW5BZGRyZXNzOiAnVVNEQycsXG4gICAgICAgICAgICAgICAgdG9rZW5JbkNoYWluSWQ6IDEsXG4gICAgICAgICAgICAgICAgdG9rZW5PdXRBZGRyZXNzOiAnVVNEVCcsXG4gICAgICAgICAgICAgICAgdG9rZW5PdXRDaGFpbklkOiAxLFxuICAgICAgICAgICAgICAgIGFtb3VudDogYXdhaXQgZ2V0QW1vdW50KDEsIHR5cGUsICdVU0RDJywgJ1VTRFQnLCAnMTAwJyksXG4gICAgICAgICAgICAgICAgdHlwZSxcbiAgICAgICAgICAgICAgICByZWNpcGllbnQ6IGFsaWNlLmFkZHJlc3MsXG4gICAgICAgICAgICAgICAgc2xpcHBhZ2VUb2xlcmFuY2U6IFNMSVBQQUdFLFxuICAgICAgICAgICAgICAgIGRlYWRsaW5lOiAnMzYwJyxcbiAgICAgICAgICAgICAgICBhbGdvcml0aG06ICdhbHBoYScsXG4gICAgICAgICAgICAgICAgZm9yY2VDcm9zc1Byb3RvY29sOiB0cnVlLFxuICAgICAgICAgICAgICAgIGVuYWJsZVVuaXZlcnNhbFJvdXRlcjogdHJ1ZSxcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGNvbnN0IHF1ZXJ5UGFyYW1zID0gcXMuc3RyaW5naWZ5KHF1b3RlUmVxKVxuXG4gICAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlOiBBeGlvc1Jlc3BvbnNlPFF1b3RlUmVzcG9uc2U+ID0gYXdhaXQgYXhpb3MuZ2V0PFF1b3RlUmVzcG9uc2U+KGAke0FQSX0/JHtxdWVyeVBhcmFtc31gKVxuICAgICAgICAgICAgICBjb25zdCB7XG4gICAgICAgICAgICAgICAgZGF0YTogeyBxdW90ZSwgcXVvdGVEZWNpbWFscywgcXVvdGVHYXNBZGp1c3RlZERlY2ltYWxzLCBtZXRob2RQYXJhbWV0ZXJzLCByb3V0ZSB9LFxuICAgICAgICAgICAgICAgIHN0YXR1cyxcbiAgICAgICAgICAgICAgfSA9IHJlc3BvbnNlXG5cbiAgICAgICAgICAgICAgZXhwZWN0KHN0YXR1cykudG8uZXF1YWwoMjAwKVxuICAgICAgICAgICAgICBleHBlY3QocGFyc2VGbG9hdChxdW90ZURlY2ltYWxzKSkudG8uYmUuZ3JlYXRlclRoYW4oOTApXG4gICAgICAgICAgICAgIGV4cGVjdChwYXJzZUZsb2F0KHF1b3RlRGVjaW1hbHMpKS50by5iZS5sZXNzVGhhbigxMTApXG5cbiAgICAgICAgICAgICAgaWYgKHR5cGUgPT0gJ2V4YWN0SW4nKSB7XG4gICAgICAgICAgICAgICAgZXhwZWN0KHBhcnNlRmxvYXQocXVvdGVHYXNBZGp1c3RlZERlY2ltYWxzKSkudG8uYmUubGVzc1RoYW5PckVxdWFsKHBhcnNlRmxvYXQocXVvdGVEZWNpbWFscykpXG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZXhwZWN0KHBhcnNlRmxvYXQocXVvdGVHYXNBZGp1c3RlZERlY2ltYWxzKSkudG8uYmUuZ3JlYXRlclRoYW5PckVxdWFsKHBhcnNlRmxvYXQocXVvdGVEZWNpbWFscykpXG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBleHBlY3QobWV0aG9kUGFyYW1ldGVycykudG8ubm90LmJlLnVuZGVmaW5lZFxuXG4gICAgICAgICAgICAgIGxldCBoYXNWM1Bvb2wgPSBmYWxzZVxuICAgICAgICAgICAgICBsZXQgaGFzVjJQb29sID0gZmFsc2VcbiAgICAgICAgICAgICAgZm9yIChjb25zdCByIG9mIHJvdXRlKSB7XG4gICAgICAgICAgICAgICAgZm9yIChjb25zdCBwb29sIG9mIHIpIHtcbiAgICAgICAgICAgICAgICAgIGlmIChwb29sLnR5cGUgPT0gJ3YzLXBvb2wnKSB7XG4gICAgICAgICAgICAgICAgICAgIGhhc1YzUG9vbCA9IHRydWVcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgIGlmIChwb29sLnR5cGUgPT0gJ3YyLXBvb2wnKSB7XG4gICAgICAgICAgICAgICAgICAgIGhhc1YyUG9vbCA9IHRydWVcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBleHBlY3QoaGFzVjNQb29sICYmIGhhc1YyUG9vbCkudG8uYmUudHJ1ZVxuXG4gICAgICAgICAgICAgIGNvbnN0IHsgdG9rZW5JbkJlZm9yZSwgdG9rZW5JbkFmdGVyLCB0b2tlbk91dEJlZm9yZSwgdG9rZW5PdXRBZnRlciB9ID0gYXdhaXQgZXhlY3V0ZVN3YXAoXG4gICAgICAgICAgICAgICAgcmVzcG9uc2UuZGF0YS5tZXRob2RQYXJhbWV0ZXJzISxcbiAgICAgICAgICAgICAgICBVU0RDX01BSU5ORVQsXG4gICAgICAgICAgICAgICAgVVNEVF9NQUlOTkVUIVxuICAgICAgICAgICAgICApXG5cbiAgICAgICAgICAgICAgaWYgKHR5cGUgPT0gJ2V4YWN0SW4nKSB7XG4gICAgICAgICAgICAgICAgZXhwZWN0KHRva2VuSW5CZWZvcmUuc3VidHJhY3QodG9rZW5JbkFmdGVyKS50b0V4YWN0KCkpLnRvLmVxdWFsKCcxMDAnKVxuICAgICAgICAgICAgICAgIGNoZWNrUXVvdGVUb2tlbih0b2tlbk91dEJlZm9yZSwgdG9rZW5PdXRBZnRlciwgQ3VycmVuY3lBbW91bnQuZnJvbVJhd0Ftb3VudChVU0RUX01BSU5ORVQsIHF1b3RlKSlcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBleHBlY3QodG9rZW5PdXRBZnRlci5zdWJ0cmFjdCh0b2tlbk91dEJlZm9yZSkudG9FeGFjdCgpKS50by5lcXVhbCgnMTAwJylcbiAgICAgICAgICAgICAgICBjaGVja1F1b3RlVG9rZW4odG9rZW5JbkJlZm9yZSwgdG9rZW5JbkFmdGVyLCBDdXJyZW5jeUFtb3VudC5mcm9tUmF3QW1vdW50KFVTRENfTUFJTk5FVCwgcXVvdGUpKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuXG4gICAgICAgICAgICAvLy8gVGVzdHMgZm9yIHJvdXRlcyBsaWtlbHkgdG8gcmVzdWx0IGluIE1peGVkUm91dGVzIGJlaW5nIHJldHVybmVkXG4gICAgICAgICAgICBpZiAodHlwZSA9PT0gJ2V4YWN0SW4nKSB7XG4gICAgICAgICAgICAgIGl0KGBlcmMyMCAtPiBlcmMyMCBmb3JjZU1peGVkUm91dGVzIG5vdCBzcGVjaWZpZWQgZm9yIHYyLHYzIGRvZXMgbm90IHJldHVybiBtaXhlZCByb3V0ZSBldmVuIHdoZW4gaXQgaXMgYmV0dGVyYCwgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHF1b3RlUmVxOiBRdW90ZVF1ZXJ5UGFyYW1zID0ge1xuICAgICAgICAgICAgICAgICAgdG9rZW5JbkFkZHJlc3M6ICdCT05EJyxcbiAgICAgICAgICAgICAgICAgIHRva2VuSW5DaGFpbklkOiAxLFxuICAgICAgICAgICAgICAgICAgdG9rZW5PdXRBZGRyZXNzOiAnQVBFJyxcbiAgICAgICAgICAgICAgICAgIHRva2VuT3V0Q2hhaW5JZDogMSxcbiAgICAgICAgICAgICAgICAgIGFtb3VudDogYXdhaXQgZ2V0QW1vdW50KDEsIHR5cGUsICdCT05EJywgJ0FQRScsICcxMDAwMCcpLFxuICAgICAgICAgICAgICAgICAgdHlwZSxcbiAgICAgICAgICAgICAgICAgIHJlY2lwaWVudDogYWxpY2UuYWRkcmVzcyxcbiAgICAgICAgICAgICAgICAgIHNsaXBwYWdlVG9sZXJhbmNlOiBTTElQUEFHRSxcbiAgICAgICAgICAgICAgICAgIGRlYWRsaW5lOiAnMzYwJyxcbiAgICAgICAgICAgICAgICAgIGFsZ29yaXRobTogJ2FscGhhJyxcbiAgICAgICAgICAgICAgICAgIHByb3RvY29sczogJ3YyLHYzJyxcbiAgICAgICAgICAgICAgICAgIGVuYWJsZVVuaXZlcnNhbFJvdXRlcjogdHJ1ZSxcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBjb25zdCBxdWVyeVBhcmFtcyA9IHFzLnN0cmluZ2lmeShxdW90ZVJlcSlcblxuICAgICAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlOiBBeGlvc1Jlc3BvbnNlPFF1b3RlUmVzcG9uc2U+ID0gYXdhaXQgYXhpb3MuZ2V0PFF1b3RlUmVzcG9uc2U+KGAke0FQSX0/JHtxdWVyeVBhcmFtc31gKVxuICAgICAgICAgICAgICAgIGNvbnN0IHtcbiAgICAgICAgICAgICAgICAgIGRhdGE6IHsgcXVvdGVEZWNpbWFscywgcXVvdGVHYXNBZGp1c3RlZERlY2ltYWxzLCBtZXRob2RQYXJhbWV0ZXJzLCByb3V0ZVN0cmluZyB9LFxuICAgICAgICAgICAgICAgICAgc3RhdHVzLFxuICAgICAgICAgICAgICAgIH0gPSByZXNwb25zZVxuXG4gICAgICAgICAgICAgICAgZXhwZWN0KHN0YXR1cykudG8uZXF1YWwoMjAwKVxuXG4gICAgICAgICAgICAgICAgaWYgKHR5cGUgPT0gJ2V4YWN0SW4nKSB7XG4gICAgICAgICAgICAgICAgICBleHBlY3QocGFyc2VGbG9hdChxdW90ZUdhc0FkanVzdGVkRGVjaW1hbHMpKS50by5iZS5sZXNzVGhhbk9yRXF1YWwocGFyc2VGbG9hdChxdW90ZURlY2ltYWxzKSlcbiAgICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgICAgZXhwZWN0KHBhcnNlRmxvYXQocXVvdGVHYXNBZGp1c3RlZERlY2ltYWxzKSkudG8uYmUuZ3JlYXRlclRoYW5PckVxdWFsKHBhcnNlRmxvYXQocXVvdGVEZWNpbWFscykpXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgZXhwZWN0KG1ldGhvZFBhcmFtZXRlcnMpLnRvLm5vdC5iZS51bmRlZmluZWRcblxuICAgICAgICAgICAgICAgIGV4cGVjdCghcm91dGVTdHJpbmcuaW5jbHVkZXMoJ1tWMiArIFYzXScpKVxuICAgICAgICAgICAgICB9KVxuXG4gICAgICAgICAgICAgIGl0KGBlcmMyMCAtPiBlcmMyMCBmb3JjZU1peGVkUm91dGVzIHRydWUgZm9yIHYyLHYzYCwgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHF1b3RlUmVxOiBRdW90ZVF1ZXJ5UGFyYW1zID0ge1xuICAgICAgICAgICAgICAgICAgdG9rZW5JbkFkZHJlc3M6ICdCT05EJyxcbiAgICAgICAgICAgICAgICAgIHRva2VuSW5DaGFpbklkOiAxLFxuICAgICAgICAgICAgICAgICAgdG9rZW5PdXRBZGRyZXNzOiAnQVBFJyxcbiAgICAgICAgICAgICAgICAgIHRva2VuT3V0Q2hhaW5JZDogMSxcbiAgICAgICAgICAgICAgICAgIGFtb3VudDogYXdhaXQgZ2V0QW1vdW50KDEsIHR5cGUsICdCT05EJywgJ0FQRScsICcxMDAwMCcpLFxuICAgICAgICAgICAgICAgICAgdHlwZSxcbiAgICAgICAgICAgICAgICAgIHJlY2lwaWVudDogYWxpY2UuYWRkcmVzcyxcbiAgICAgICAgICAgICAgICAgIHNsaXBwYWdlVG9sZXJhbmNlOiBTTElQUEFHRSxcbiAgICAgICAgICAgICAgICAgIGRlYWRsaW5lOiAnMzYwJyxcbiAgICAgICAgICAgICAgICAgIGFsZ29yaXRobTogJ2FscGhhJyxcbiAgICAgICAgICAgICAgICAgIGZvcmNlTWl4ZWRSb3V0ZXM6IHRydWUsXG4gICAgICAgICAgICAgICAgICBwcm90b2NvbHM6ICd2Mix2MycsXG4gICAgICAgICAgICAgICAgICBlbmFibGVVbml2ZXJzYWxSb3V0ZXI6IHRydWUsXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgYXdhaXQgY2FsbEFuZEV4cGVjdEZhaWwocXVvdGVSZXEsIHtcbiAgICAgICAgICAgICAgICAgIHN0YXR1czogNDA0LFxuICAgICAgICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICAgICAgICBkZXRhaWw6ICdObyByb3V0ZSBmb3VuZCcsXG4gICAgICAgICAgICAgICAgICAgIGVycm9yQ29kZTogJ05PX1JPVVRFJyxcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgICAgfSlcblxuICAgICAgICAgICAgICBpdC5za2lwKGBlcmMyMCAtPiBlcmMyMCBmb3JjZU1peGVkUm91dGVzIHRydWUgZm9yIGFsbCBwcm90b2NvbHMgc3BlY2lmaWVkYCwgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IHF1b3RlUmVxOiBRdW90ZVF1ZXJ5UGFyYW1zID0ge1xuICAgICAgICAgICAgICAgICAgdG9rZW5JbkFkZHJlc3M6ICdCT05EJyxcbiAgICAgICAgICAgICAgICAgIHRva2VuSW5DaGFpbklkOiAxLFxuICAgICAgICAgICAgICAgICAgdG9rZW5PdXRBZGRyZXNzOiAnQVBFJyxcbiAgICAgICAgICAgICAgICAgIHRva2VuT3V0Q2hhaW5JZDogMSxcbiAgICAgICAgICAgICAgICAgIGFtb3VudDogYXdhaXQgZ2V0QW1vdW50KDEsIHR5cGUsICdCT05EJywgJ0FQRScsICcxMDAwMCcpLFxuICAgICAgICAgICAgICAgICAgdHlwZSxcbiAgICAgICAgICAgICAgICAgIHJlY2lwaWVudDogYWxpY2UuYWRkcmVzcyxcbiAgICAgICAgICAgICAgICAgIHNsaXBwYWdlVG9sZXJhbmNlOiBTTElQUEFHRSxcbiAgICAgICAgICAgICAgICAgIGRlYWRsaW5lOiAnMzYwJyxcbiAgICAgICAgICAgICAgICAgIGFsZ29yaXRobTogJ2FscGhhJyxcbiAgICAgICAgICAgICAgICAgIGZvcmNlTWl4ZWRSb3V0ZXM6IHRydWUsXG4gICAgICAgICAgICAgICAgICBwcm90b2NvbHM6ICd2Mix2MyxtaXhlZCcsXG4gICAgICAgICAgICAgICAgICBlbmFibGVVbml2ZXJzYWxSb3V0ZXI6IHRydWUsXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgcXVlcnlQYXJhbXMgPSBxcy5zdHJpbmdpZnkocXVvdGVSZXEpXG5cbiAgICAgICAgICAgICAgICBjb25zdCByZXNwb25zZTogQXhpb3NSZXNwb25zZTxRdW90ZVJlc3BvbnNlPiA9IGF3YWl0IGF4aW9zLmdldDxRdW90ZVJlc3BvbnNlPihgJHtBUEl9PyR7cXVlcnlQYXJhbXN9YClcbiAgICAgICAgICAgICAgICBjb25zdCB7XG4gICAgICAgICAgICAgICAgICBkYXRhOiB7IHF1b3RlRGVjaW1hbHMsIHF1b3RlR2FzQWRqdXN0ZWREZWNpbWFscywgbWV0aG9kUGFyYW1ldGVycywgcm91dGVTdHJpbmcgfSxcbiAgICAgICAgICAgICAgICAgIHN0YXR1cyxcbiAgICAgICAgICAgICAgICB9ID0gcmVzcG9uc2VcblxuICAgICAgICAgICAgICAgIGV4cGVjdChzdGF0dXMpLnRvLmVxdWFsKDIwMClcblxuICAgICAgICAgICAgICAgIGlmICh0eXBlID09ICdleGFjdEluJykge1xuICAgICAgICAgICAgICAgICAgZXhwZWN0KHBhcnNlRmxvYXQocXVvdGVHYXNBZGp1c3RlZERlY2ltYWxzKSkudG8uYmUubGVzc1RoYW5PckVxdWFsKHBhcnNlRmxvYXQocXVvdGVEZWNpbWFscykpXG4gICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgIGV4cGVjdChwYXJzZUZsb2F0KHF1b3RlR2FzQWRqdXN0ZWREZWNpbWFscykpLnRvLmJlLmdyZWF0ZXJUaGFuT3JFcXVhbChwYXJzZUZsb2F0KHF1b3RlRGVjaW1hbHMpKVxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGV4cGVjdChtZXRob2RQYXJhbWV0ZXJzKS50by5ub3QuYmUudW5kZWZpbmVkXG5cbiAgICAgICAgICAgICAgICAvLy8gc2luY2Ugd2Ugb25seSBnZXQgdGhlIHJvdXRlU3RyaW5nIGJhY2ssIHdlIGNhbiBjaGVjayBpZiB0aGVyZSdzIFYzICsgVjJcbiAgICAgICAgICAgICAgICBleHBlY3Qocm91dGVTdHJpbmcuaW5jbHVkZXMoJ1tWMiArIFYzXScpKVxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfSlcblxuICAgICAgICBpZiAoYWxnb3JpdGhtID09ICdhbHBoYScpIHtcbiAgICAgICAgICBkZXNjcmliZShgKyBTaW11bGF0ZSBTd2FwICsgRXhlY3V0ZSBTd2FwYCwgKCkgPT4ge1xuICAgICAgICAgICAgaXQoYGVyYzIwIC0+IGVyYzIwYCwgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICBjb25zdCBxdW90ZVJlcTogUXVvdGVRdWVyeVBhcmFtcyA9IHtcbiAgICAgICAgICAgICAgICB0b2tlbkluQWRkcmVzczogJ1VTREMnLFxuICAgICAgICAgICAgICAgIHRva2VuSW5DaGFpbklkOiAxLFxuICAgICAgICAgICAgICAgIHRva2VuT3V0QWRkcmVzczogJ1VTRFQnLFxuICAgICAgICAgICAgICAgIHRva2VuT3V0Q2hhaW5JZDogMSxcbiAgICAgICAgICAgICAgICBhbW91bnQ6IGF3YWl0IGdldEFtb3VudCgxLCB0eXBlLCAnVVNEQycsICdVU0RUJywgJzEwMCcpLFxuICAgICAgICAgICAgICAgIHR5cGUsXG4gICAgICAgICAgICAgICAgcmVjaXBpZW50OiBhbGljZS5hZGRyZXNzLFxuICAgICAgICAgICAgICAgIHNsaXBwYWdlVG9sZXJhbmNlOiBTTElQUEFHRSxcbiAgICAgICAgICAgICAgICBkZWFkbGluZTogJzM2MCcsXG4gICAgICAgICAgICAgICAgYWxnb3JpdGhtLFxuICAgICAgICAgICAgICAgIHNpbXVsYXRlRnJvbUFkZHJlc3M6ICcweGY1ODRmODcyOGI4NzRhNmE1YzdhOGQ0ZDM4N2M5YWFlOTE3MmQ2MjEnLFxuICAgICAgICAgICAgICAgIGVuYWJsZVVuaXZlcnNhbFJvdXRlcjogdHJ1ZSxcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGNvbnN0IHF1ZXJ5UGFyYW1zID0gcXMuc3RyaW5naWZ5KHF1b3RlUmVxKVxuXG4gICAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlOiBBeGlvc1Jlc3BvbnNlPFF1b3RlUmVzcG9uc2U+ID0gYXdhaXQgYXhpb3MuZ2V0PFF1b3RlUmVzcG9uc2U+KGAke0FQSX0/JHtxdWVyeVBhcmFtc31gKVxuICAgICAgICAgICAgICBjb25zdCB7XG4gICAgICAgICAgICAgICAgZGF0YTogeyBxdW90ZSwgcXVvdGVEZWNpbWFscywgcXVvdGVHYXNBZGp1c3RlZERlY2ltYWxzLCBtZXRob2RQYXJhbWV0ZXJzLCBzaW11bGF0aW9uRXJyb3IgfSxcbiAgICAgICAgICAgICAgICBzdGF0dXMsXG4gICAgICAgICAgICAgIH0gPSByZXNwb25zZVxuXG4gICAgICAgICAgICAgIGV4cGVjdChzdGF0dXMpLnRvLmVxdWFsKDIwMClcbiAgICAgICAgICAgICAgZXhwZWN0KHNpbXVsYXRpb25FcnJvcikudG8uZXF1YWwoZmFsc2UpXG4gICAgICAgICAgICAgIGV4cGVjdChwYXJzZUZsb2F0KHF1b3RlRGVjaW1hbHMpKS50by5iZS5ncmVhdGVyVGhhbig5MClcbiAgICAgICAgICAgICAgZXhwZWN0KHBhcnNlRmxvYXQocXVvdGVEZWNpbWFscykpLnRvLmJlLmxlc3NUaGFuKDExMClcblxuICAgICAgICAgICAgICBpZiAodHlwZSA9PSAnZXhhY3RJbicpIHtcbiAgICAgICAgICAgICAgICBleHBlY3QocGFyc2VGbG9hdChxdW90ZUdhc0FkanVzdGVkRGVjaW1hbHMpKS50by5iZS5sZXNzVGhhbk9yRXF1YWwocGFyc2VGbG9hdChxdW90ZURlY2ltYWxzKSlcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBleHBlY3QocGFyc2VGbG9hdChxdW90ZUdhc0FkanVzdGVkRGVjaW1hbHMpKS50by5iZS5ncmVhdGVyVGhhbk9yRXF1YWwocGFyc2VGbG9hdChxdW90ZURlY2ltYWxzKSlcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGV4cGVjdChtZXRob2RQYXJhbWV0ZXJzKS50by5ub3QuYmUudW5kZWZpbmVkXG5cbiAgICAgICAgICAgICAgY29uc3QgeyB0b2tlbkluQmVmb3JlLCB0b2tlbkluQWZ0ZXIsIHRva2VuT3V0QmVmb3JlLCB0b2tlbk91dEFmdGVyIH0gPSBhd2FpdCBleGVjdXRlU3dhcChcbiAgICAgICAgICAgICAgICBtZXRob2RQYXJhbWV0ZXJzISxcbiAgICAgICAgICAgICAgICBVU0RDX01BSU5ORVQsXG4gICAgICAgICAgICAgICAgVVNEVF9NQUlOTkVUXG4gICAgICAgICAgICAgIClcblxuICAgICAgICAgICAgICBpZiAodHlwZSA9PSAnZXhhY3RJbicpIHtcbiAgICAgICAgICAgICAgICBleHBlY3QodG9rZW5JbkJlZm9yZS5zdWJ0cmFjdCh0b2tlbkluQWZ0ZXIpLnRvRXhhY3QoKSkudG8uZXF1YWwoJzEwMCcpXG4gICAgICAgICAgICAgICAgY2hlY2tRdW90ZVRva2VuKHRva2VuT3V0QmVmb3JlLCB0b2tlbk91dEFmdGVyLCBDdXJyZW5jeUFtb3VudC5mcm9tUmF3QW1vdW50KFVTRFRfTUFJTk5FVCwgcXVvdGUpKVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGV4cGVjdCh0b2tlbk91dEFmdGVyLnN1YnRyYWN0KHRva2VuT3V0QmVmb3JlKS50b0V4YWN0KCkpLnRvLmVxdWFsKCcxMDAnKVxuICAgICAgICAgICAgICAgIGNoZWNrUXVvdGVUb2tlbih0b2tlbkluQmVmb3JlLCB0b2tlbkluQWZ0ZXIsIEN1cnJlbmN5QW1vdW50LmZyb21SYXdBbW91bnQoVVNEQ19NQUlOTkVULCBxdW90ZSkpXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgIGl0KGBlcmMyMCAtPiBlcmMyMCBzd2Fwcm91dGVyMDJgLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IHF1b3RlUmVxOiBRdW90ZVF1ZXJ5UGFyYW1zID0ge1xuICAgICAgICAgICAgICAgIHRva2VuSW5BZGRyZXNzOiAnVVNEQycsXG4gICAgICAgICAgICAgICAgdG9rZW5JbkNoYWluSWQ6IDEsXG4gICAgICAgICAgICAgICAgdG9rZW5PdXRBZGRyZXNzOiAnVVNEVCcsXG4gICAgICAgICAgICAgICAgdG9rZW5PdXRDaGFpbklkOiAxLFxuICAgICAgICAgICAgICAgIGFtb3VudDogYXdhaXQgZ2V0QW1vdW50KDEsIHR5cGUsICdVU0RDJywgJ1VTRFQnLCAnMTAwJyksXG4gICAgICAgICAgICAgICAgdHlwZSxcbiAgICAgICAgICAgICAgICByZWNpcGllbnQ6IGFsaWNlLmFkZHJlc3MsXG4gICAgICAgICAgICAgICAgc2xpcHBhZ2VUb2xlcmFuY2U6IFNMSVBQQUdFLFxuICAgICAgICAgICAgICAgIGRlYWRsaW5lOiAnMzYwJyxcbiAgICAgICAgICAgICAgICBhbGdvcml0aG0sXG4gICAgICAgICAgICAgICAgc2ltdWxhdGVGcm9tQWRkcmVzczogJzB4ZjU4NGY4NzI4Yjg3NGE2YTVjN2E4ZDRkMzg3YzlhYWU5MTcyZDYyMScsXG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBjb25zdCBxdWVyeVBhcmFtcyA9IHFzLnN0cmluZ2lmeShxdW90ZVJlcSlcblxuICAgICAgICAgICAgICBjb25zdCByZXNwb25zZTogQXhpb3NSZXNwb25zZTxRdW90ZVJlc3BvbnNlPiA9IGF3YWl0IGF4aW9zLmdldDxRdW90ZVJlc3BvbnNlPihgJHtBUEl9PyR7cXVlcnlQYXJhbXN9YClcbiAgICAgICAgICAgICAgY29uc3Qge1xuICAgICAgICAgICAgICAgIGRhdGE6IHsgcXVvdGUsIHF1b3RlRGVjaW1hbHMsIHF1b3RlR2FzQWRqdXN0ZWREZWNpbWFscywgbWV0aG9kUGFyYW1ldGVycywgc2ltdWxhdGlvbkVycm9yIH0sXG4gICAgICAgICAgICAgICAgc3RhdHVzLFxuICAgICAgICAgICAgICB9ID0gcmVzcG9uc2VcblxuICAgICAgICAgICAgICBleHBlY3Qoc3RhdHVzKS50by5lcXVhbCgyMDApXG4gICAgICAgICAgICAgIGV4cGVjdChzaW11bGF0aW9uRXJyb3IpLnRvLmVxdWFsKGZhbHNlKVxuICAgICAgICAgICAgICBleHBlY3QocGFyc2VGbG9hdChxdW90ZURlY2ltYWxzKSkudG8uYmUuZ3JlYXRlclRoYW4oOTApXG4gICAgICAgICAgICAgIGV4cGVjdChwYXJzZUZsb2F0KHF1b3RlRGVjaW1hbHMpKS50by5iZS5sZXNzVGhhbigxMTApXG5cbiAgICAgICAgICAgICAgaWYgKHR5cGUgPT0gJ2V4YWN0SW4nKSB7XG4gICAgICAgICAgICAgICAgZXhwZWN0KHBhcnNlRmxvYXQocXVvdGVHYXNBZGp1c3RlZERlY2ltYWxzKSkudG8uYmUubGVzc1RoYW5PckVxdWFsKHBhcnNlRmxvYXQocXVvdGVEZWNpbWFscykpXG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZXhwZWN0KHBhcnNlRmxvYXQocXVvdGVHYXNBZGp1c3RlZERlY2ltYWxzKSkudG8uYmUuZ3JlYXRlclRoYW5PckVxdWFsKHBhcnNlRmxvYXQocXVvdGVEZWNpbWFscykpXG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBleHBlY3QobWV0aG9kUGFyYW1ldGVycykudG8ubm90LmJlLnVuZGVmaW5lZFxuICAgICAgICAgICAgICBleHBlY3QobWV0aG9kUGFyYW1ldGVycyEudG8pLnRvLmVxdWFsKFNXQVBfUk9VVEVSXzAyX0FERFJFU1NFUyhDaGFpbklkLk1BSU5ORVQpKVxuXG4gICAgICAgICAgICAgIGNvbnN0IHsgdG9rZW5JbkJlZm9yZSwgdG9rZW5JbkFmdGVyLCB0b2tlbk91dEJlZm9yZSwgdG9rZW5PdXRBZnRlciB9ID0gYXdhaXQgZXhlY3V0ZVN3YXAoXG4gICAgICAgICAgICAgICAgbWV0aG9kUGFyYW1ldGVycyEsXG4gICAgICAgICAgICAgICAgVVNEQ19NQUlOTkVULFxuICAgICAgICAgICAgICAgIFVTRFRfTUFJTk5FVFxuICAgICAgICAgICAgICApXG5cbiAgICAgICAgICAgICAgaWYgKHR5cGUgPT0gJ2V4YWN0SW4nKSB7XG4gICAgICAgICAgICAgICAgZXhwZWN0KHRva2VuSW5CZWZvcmUuc3VidHJhY3QodG9rZW5JbkFmdGVyKS50b0V4YWN0KCkpLnRvLmVxdWFsKCcxMDAnKVxuICAgICAgICAgICAgICAgIGNoZWNrUXVvdGVUb2tlbih0b2tlbk91dEJlZm9yZSwgdG9rZW5PdXRBZnRlciwgQ3VycmVuY3lBbW91bnQuZnJvbVJhd0Ftb3VudChVU0RUX01BSU5ORVQsIHF1b3RlKSlcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBleHBlY3QodG9rZW5PdXRBZnRlci5zdWJ0cmFjdCh0b2tlbk91dEJlZm9yZSkudG9FeGFjdCgpKS50by5lcXVhbCgnMTAwJylcbiAgICAgICAgICAgICAgICBjaGVja1F1b3RlVG9rZW4odG9rZW5JbkJlZm9yZSwgdG9rZW5JbkFmdGVyLCBDdXJyZW5jeUFtb3VudC5mcm9tUmF3QW1vdW50KFVTRENfTUFJTk5FVCwgcXVvdGUpKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuXG4gICAgICAgICAgICBpZiAoaXNUZXN0ZXJQS0Vudmlyb25tZW50U2V0KCkpIHtcbiAgICAgICAgICAgICAgaXQoYGVyYzIwIC0+IGVyYzIwIHdpdGggcGVybWl0IHdpdGggdGVzdGVyIHBrYCwgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAgIC8vIFRoaXMgdGVzdCByZXF1aXJlcyBhIHByaXZhdGUga2V5IHdpdGggYXQgbGVhc3QgMTAgVVNEQ1xuICAgICAgICAgICAgICAgIC8vIGF0IEZPUktfQkxPQ0sgdGltZS5cbiAgICAgICAgICAgICAgICBjb25zdCBhbW91bnQgPSBhd2FpdCBnZXRBbW91bnQoMSwgdHlwZSwgJ1VTREMnLCAnVVNEVCcsICcxMCcpXG5cbiAgICAgICAgICAgICAgICBjb25zdCBub25jZSA9ICcwJ1xuXG4gICAgICAgICAgICAgICAgY29uc3QgcGVybWl0OiBQZXJtaXRTaW5nbGUgPSB7XG4gICAgICAgICAgICAgICAgICBkZXRhaWxzOiB7XG4gICAgICAgICAgICAgICAgICAgIHRva2VuOiBVU0RDX01BSU5ORVQuYWRkcmVzcyxcbiAgICAgICAgICAgICAgICAgICAgYW1vdW50OiBhbW91bnQsXG4gICAgICAgICAgICAgICAgICAgIGV4cGlyYXRpb246IE1hdGguZmxvb3IobmV3IERhdGUoKS5nZXRUaW1lKCkgLyAxMDAwICsgMTAwMDAwMDApLnRvU3RyaW5nKCksXG4gICAgICAgICAgICAgICAgICAgIG5vbmNlLFxuICAgICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAgIHNwZW5kZXI6IFVOSVZFUlNBTF9ST1VURVJfQUREUkVTUyxcbiAgICAgICAgICAgICAgICAgIHNpZ0RlYWRsaW5lOiBNYXRoLmZsb29yKG5ldyBEYXRlKCkuZ2V0VGltZSgpIC8gMTAwMCArIDEwMDAwMDAwKS50b1N0cmluZygpLFxuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIGNvbnN0IHdhbGxldCA9IG5ldyBXYWxsZXQocHJvY2Vzcy5lbnYuVEVTVEVSX1BLISlcblxuICAgICAgICAgICAgICAgIGNvbnN0IHsgZG9tYWluLCB0eXBlcywgdmFsdWVzIH0gPSBBbGxvd2FuY2VUcmFuc2Zlci5nZXRQZXJtaXREYXRhKHBlcm1pdCwgUEVSTUlUMl9BRERSRVNTLCAxKVxuXG4gICAgICAgICAgICAgICAgY29uc3Qgc2lnbmF0dXJlID0gYXdhaXQgd2FsbGV0Ll9zaWduVHlwZWREYXRhKGRvbWFpbiwgdHlwZXMsIHZhbHVlcylcblxuICAgICAgICAgICAgICAgIGNvbnN0IHF1b3RlUmVxOiBRdW90ZVF1ZXJ5UGFyYW1zID0ge1xuICAgICAgICAgICAgICAgICAgdG9rZW5JbkFkZHJlc3M6ICdVU0RDJyxcbiAgICAgICAgICAgICAgICAgIHRva2VuSW5DaGFpbklkOiAxLFxuICAgICAgICAgICAgICAgICAgdG9rZW5PdXRBZGRyZXNzOiAnVVNEVCcsXG4gICAgICAgICAgICAgICAgICB0b2tlbk91dENoYWluSWQ6IDEsXG4gICAgICAgICAgICAgICAgICBhbW91bnQsXG4gICAgICAgICAgICAgICAgICB0eXBlLFxuICAgICAgICAgICAgICAgICAgcmVjaXBpZW50OiB3YWxsZXQuYWRkcmVzcyxcbiAgICAgICAgICAgICAgICAgIHNsaXBwYWdlVG9sZXJhbmNlOiBTTElQUEFHRSxcbiAgICAgICAgICAgICAgICAgIGRlYWRsaW5lOiAnMzYwJyxcbiAgICAgICAgICAgICAgICAgIGFsZ29yaXRobSxcbiAgICAgICAgICAgICAgICAgIHNpbXVsYXRlRnJvbUFkZHJlc3M6IHdhbGxldC5hZGRyZXNzLFxuICAgICAgICAgICAgICAgICAgcGVybWl0U2lnbmF0dXJlOiBzaWduYXR1cmUsXG4gICAgICAgICAgICAgICAgICBwZXJtaXRBbW91bnQ6IHBlcm1pdC5kZXRhaWxzLmFtb3VudC50b1N0cmluZygpLFxuICAgICAgICAgICAgICAgICAgcGVybWl0RXhwaXJhdGlvbjogcGVybWl0LmRldGFpbHMuZXhwaXJhdGlvbi50b1N0cmluZygpLFxuICAgICAgICAgICAgICAgICAgcGVybWl0U2lnRGVhZGxpbmU6IHBlcm1pdC5zaWdEZWFkbGluZS50b1N0cmluZygpLFxuICAgICAgICAgICAgICAgICAgcGVybWl0Tm9uY2U6IHBlcm1pdC5kZXRhaWxzLm5vbmNlLnRvU3RyaW5nKCksXG4gICAgICAgICAgICAgICAgICBlbmFibGVVbml2ZXJzYWxSb3V0ZXI6IHRydWUsXG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgY29uc3QgcXVlcnlQYXJhbXMgPSBxcy5zdHJpbmdpZnkocXVvdGVSZXEpXG5cbiAgICAgICAgICAgICAgICBjb25zdCByZXNwb25zZTogQXhpb3NSZXNwb25zZTxRdW90ZVJlc3BvbnNlPiA9IGF3YWl0IGF4aW9zLmdldDxRdW90ZVJlc3BvbnNlPihgJHtBUEl9PyR7cXVlcnlQYXJhbXN9YClcbiAgICAgICAgICAgICAgICBjb25zdCB7XG4gICAgICAgICAgICAgICAgICBkYXRhOiB7IHF1b3RlRGVjaW1hbHMsIHF1b3RlR2FzQWRqdXN0ZWREZWNpbWFscywgbWV0aG9kUGFyYW1ldGVycywgc2ltdWxhdGlvbkVycm9yIH0sXG4gICAgICAgICAgICAgICAgICBzdGF0dXMsXG4gICAgICAgICAgICAgICAgfSA9IHJlc3BvbnNlXG4gICAgICAgICAgICAgICAgZXhwZWN0KHN0YXR1cykudG8uZXF1YWwoMjAwKVxuXG4gICAgICAgICAgICAgICAgZXhwZWN0KHNpbXVsYXRpb25FcnJvcikudG8uZXF1YWwoZmFsc2UpXG5cbiAgICAgICAgICAgICAgICBleHBlY3QocGFyc2VGbG9hdChxdW90ZURlY2ltYWxzKSkudG8uYmUuZ3JlYXRlclRoYW4oOSlcbiAgICAgICAgICAgICAgICBleHBlY3QocGFyc2VGbG9hdChxdW90ZURlY2ltYWxzKSkudG8uYmUubGVzc1RoYW4oMTEpXG5cbiAgICAgICAgICAgICAgICBpZiAodHlwZSA9PSAnZXhhY3RJbicpIHtcbiAgICAgICAgICAgICAgICAgIGV4cGVjdChwYXJzZUZsb2F0KHF1b3RlR2FzQWRqdXN0ZWREZWNpbWFscykpLnRvLmJlLmxlc3NUaGFuT3JFcXVhbChwYXJzZUZsb2F0KHF1b3RlRGVjaW1hbHMpKVxuICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICBleHBlY3QocGFyc2VGbG9hdChxdW90ZUdhc0FkanVzdGVkRGVjaW1hbHMpKS50by5iZS5ncmVhdGVyVGhhbk9yRXF1YWwocGFyc2VGbG9hdChxdW90ZURlY2ltYWxzKSlcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBleHBlY3QobWV0aG9kUGFyYW1ldGVycykudG8ubm90LmJlLnVuZGVmaW5lZFxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpdChgZXJjMjAgLT4gZXRoYCwgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICBjb25zdCBxdW90ZVJlcTogUXVvdGVRdWVyeVBhcmFtcyA9IHtcbiAgICAgICAgICAgICAgICB0b2tlbkluQWRkcmVzczogJ1VTREMnLFxuICAgICAgICAgICAgICAgIHRva2VuSW5DaGFpbklkOiAxLFxuICAgICAgICAgICAgICAgIHRva2VuT3V0QWRkcmVzczogJ0VUSCcsXG4gICAgICAgICAgICAgICAgdG9rZW5PdXRDaGFpbklkOiAxLFxuICAgICAgICAgICAgICAgIGFtb3VudDogYXdhaXQgZ2V0QW1vdW50KDEsIHR5cGUsICdVU0RDJywgJ0VUSCcsIHR5cGUgPT0gJ2V4YWN0SW4nID8gJzEwMDAwMDAnIDogJzEwJyksXG4gICAgICAgICAgICAgICAgdHlwZSxcbiAgICAgICAgICAgICAgICByZWNpcGllbnQ6IGFsaWNlLmFkZHJlc3MsXG4gICAgICAgICAgICAgICAgc2xpcHBhZ2VUb2xlcmFuY2U6IFNMSVBQQUdFLFxuICAgICAgICAgICAgICAgIGRlYWRsaW5lOiAnMzYwJyxcbiAgICAgICAgICAgICAgICBhbGdvcml0aG0sXG4gICAgICAgICAgICAgICAgc2ltdWxhdGVGcm9tQWRkcmVzczogJzB4ZjU4NGY4NzI4Yjg3NGE2YTVjN2E4ZDRkMzg3YzlhYWU5MTcyZDYyMScsXG4gICAgICAgICAgICAgICAgZW5hYmxlVW5pdmVyc2FsUm91dGVyOiB0cnVlLFxuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgY29uc3QgcXVlcnlQYXJhbXMgPSBxcy5zdHJpbmdpZnkocXVvdGVSZXEpXG5cbiAgICAgICAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBheGlvcy5nZXQ8UXVvdGVSZXNwb25zZT4oYCR7QVBJfT8ke3F1ZXJ5UGFyYW1zfWApXG4gICAgICAgICAgICAgIGNvbnN0IHtcbiAgICAgICAgICAgICAgICBkYXRhOiB7IHF1b3RlLCBtZXRob2RQYXJhbWV0ZXJzLCBzaW11bGF0aW9uRXJyb3IgfSxcbiAgICAgICAgICAgICAgICBzdGF0dXMsXG4gICAgICAgICAgICAgIH0gPSByZXNwb25zZVxuXG4gICAgICAgICAgICAgIGV4cGVjdChzdGF0dXMpLnRvLmVxdWFsKDIwMClcbiAgICAgICAgICAgICAgZXhwZWN0KHNpbXVsYXRpb25FcnJvcikudG8uZXF1YWwoZmFsc2UpXG4gICAgICAgICAgICAgIGV4cGVjdChtZXRob2RQYXJhbWV0ZXJzKS50by5ub3QuYmUudW5kZWZpbmVkXG5cbiAgICAgICAgICAgICAgY29uc3QgeyB0b2tlbkluQmVmb3JlLCB0b2tlbkluQWZ0ZXIsIHRva2VuT3V0QmVmb3JlLCB0b2tlbk91dEFmdGVyIH0gPSBhd2FpdCBleGVjdXRlU3dhcChcbiAgICAgICAgICAgICAgICBtZXRob2RQYXJhbWV0ZXJzISxcbiAgICAgICAgICAgICAgICBVU0RDX01BSU5ORVQsXG4gICAgICAgICAgICAgICAgRXRoZXIub25DaGFpbigxKVxuICAgICAgICAgICAgICApXG5cbiAgICAgICAgICAgICAgaWYgKHR5cGUgPT0gJ2V4YWN0SW4nKSB7XG4gICAgICAgICAgICAgICAgZXhwZWN0KHRva2VuSW5CZWZvcmUuc3VidHJhY3QodG9rZW5JbkFmdGVyKS50b0V4YWN0KCkpLnRvLmVxdWFsKCcxMDAwMDAwJylcbiAgICAgICAgICAgICAgICBjaGVja1F1b3RlVG9rZW4odG9rZW5PdXRCZWZvcmUsIHRva2VuT3V0QWZ0ZXIsIEN1cnJlbmN5QW1vdW50LmZyb21SYXdBbW91bnQoRXRoZXIub25DaGFpbigxKSwgcXVvdGUpKVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIC8vIEhhcmQgdG8gdGVzdCBFVEggYmFsYW5jZSBkdWUgdG8gZ2FzIGNvc3RzIGZvciBhcHByb3ZhbCBhbmQgc3dhcC4gSnVzdCBjaGVjayB0b2tlbkluIGNoYW5nZXNcbiAgICAgICAgICAgICAgICBjaGVja1F1b3RlVG9rZW4odG9rZW5JbkJlZm9yZSwgdG9rZW5JbkFmdGVyLCBDdXJyZW5jeUFtb3VudC5mcm9tUmF3QW1vdW50KFVTRENfTUFJTk5FVCwgcXVvdGUpKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuXG4gICAgICAgICAgICBpdChgZXJjMjAgLT4gZXRoIGxhcmdlIHRyYWRlYCwgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICAvLyBUcmFkZSBvZiB0aGlzIHNpemUgYWxtb3N0IGFsd2F5cyByZXN1bHRzIGluIHNwbGl0cy5cbiAgICAgICAgICAgICAgY29uc3QgcXVvdGVSZXE6IFF1b3RlUXVlcnlQYXJhbXMgPSB7XG4gICAgICAgICAgICAgICAgdG9rZW5JbkFkZHJlc3M6ICdVU0RDJyxcbiAgICAgICAgICAgICAgICB0b2tlbkluQ2hhaW5JZDogMSxcbiAgICAgICAgICAgICAgICB0b2tlbk91dEFkZHJlc3M6ICdFVEgnLFxuICAgICAgICAgICAgICAgIHRva2VuT3V0Q2hhaW5JZDogMSxcbiAgICAgICAgICAgICAgICBhbW91bnQ6XG4gICAgICAgICAgICAgICAgICB0eXBlID09ICdleGFjdEluJ1xuICAgICAgICAgICAgICAgICAgICA/IGF3YWl0IGdldEFtb3VudCgxLCB0eXBlLCAnVVNEQycsICdFVEgnLCAnMTAwMDAwMCcpXG4gICAgICAgICAgICAgICAgICAgIDogYXdhaXQgZ2V0QW1vdW50KDEsIHR5cGUsICdVU0RDJywgJ0VUSCcsICcxMDAnKSxcbiAgICAgICAgICAgICAgICB0eXBlLFxuICAgICAgICAgICAgICAgIHJlY2lwaWVudDogYWxpY2UuYWRkcmVzcyxcbiAgICAgICAgICAgICAgICBzbGlwcGFnZVRvbGVyYW5jZTogU0xJUFBBR0UsXG4gICAgICAgICAgICAgICAgZGVhZGxpbmU6ICczNjAnLFxuICAgICAgICAgICAgICAgIGFsZ29yaXRobSxcbiAgICAgICAgICAgICAgICBzaW11bGF0ZUZyb21BZGRyZXNzOiAnMHhmNTg0Zjg3MjhiODc0YTZhNWM3YThkNGQzODdjOWFhZTkxNzJkNjIxJyxcbiAgICAgICAgICAgICAgICBlbmFibGVVbml2ZXJzYWxSb3V0ZXI6IHRydWUsXG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBjb25zdCBxdWVyeVBhcmFtcyA9IHFzLnN0cmluZ2lmeShxdW90ZVJlcSlcblxuICAgICAgICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGF4aW9zLmdldDxRdW90ZVJlc3BvbnNlPihgJHtBUEl9PyR7cXVlcnlQYXJhbXN9YClcbiAgICAgICAgICAgICAgY29uc3QgeyBkYXRhLCBzdGF0dXMgfSA9IHJlc3BvbnNlXG5cbiAgICAgICAgICAgICAgZXhwZWN0KHN0YXR1cykudG8uZXF1YWwoMjAwKVxuICAgICAgICAgICAgICBleHBlY3QoZGF0YS5zaW11bGF0aW9uRXJyb3IpLnRvLmVxdWFsKGZhbHNlKVxuICAgICAgICAgICAgICBleHBlY3QoZGF0YS5tZXRob2RQYXJhbWV0ZXJzKS50by5ub3QuYmUudW5kZWZpbmVkXG5cbiAgICAgICAgICAgICAgZXhwZWN0KGRhdGEucm91dGUpLnRvLm5vdC5iZS51bmRlZmluZWRcblxuICAgICAgICAgICAgICBjb25zdCBhbW91bnRJbkVkZ2VzVG90YWwgPSBfKGRhdGEucm91dGUpXG4gICAgICAgICAgICAgICAgLmZsYXRNYXAoKHJvdXRlKSA9PiByb3V0ZVswXSEpXG4gICAgICAgICAgICAgICAgLmZpbHRlcigocG9vbCkgPT4gISFwb29sLmFtb3VudEluKVxuICAgICAgICAgICAgICAgIC5tYXAoKHBvb2wpID0+IEJpZ051bWJlci5mcm9tKHBvb2wuYW1vdW50SW4pKVxuICAgICAgICAgICAgICAgIC5yZWR1Y2UoKGN1ciwgdG90YWwpID0+IHRvdGFsLmFkZChjdXIpLCBCaWdOdW1iZXIuZnJvbSgwKSlcbiAgICAgICAgICAgICAgY29uc3QgYW1vdW50SW4gPSBCaWdOdW1iZXIuZnJvbShkYXRhLnF1b3RlKVxuICAgICAgICAgICAgICBleHBlY3QoYW1vdW50SW4uZXEoYW1vdW50SW5FZGdlc1RvdGFsKSlcblxuICAgICAgICAgICAgICBjb25zdCBhbW91bnRPdXRFZGdlc1RvdGFsID0gXyhkYXRhLnJvdXRlKVxuICAgICAgICAgICAgICAgIC5mbGF0TWFwKChyb3V0ZSkgPT4gcm91dGVbMF0hKVxuICAgICAgICAgICAgICAgIC5maWx0ZXIoKHBvb2wpID0+ICEhcG9vbC5hbW91bnRPdXQpXG4gICAgICAgICAgICAgICAgLm1hcCgocG9vbCkgPT4gQmlnTnVtYmVyLmZyb20ocG9vbC5hbW91bnRPdXQpKVxuICAgICAgICAgICAgICAgIC5yZWR1Y2UoKGN1ciwgdG90YWwpID0+IHRvdGFsLmFkZChjdXIpLCBCaWdOdW1iZXIuZnJvbSgwKSlcbiAgICAgICAgICAgICAgY29uc3QgYW1vdW50T3V0ID0gQmlnTnVtYmVyLmZyb20oZGF0YS5xdW90ZSlcbiAgICAgICAgICAgICAgZXhwZWN0KGFtb3VudE91dC5lcShhbW91bnRPdXRFZGdlc1RvdGFsKSlcblxuICAgICAgICAgICAgICBjb25zdCB7IHRva2VuSW5CZWZvcmUsIHRva2VuSW5BZnRlciwgdG9rZW5PdXRCZWZvcmUsIHRva2VuT3V0QWZ0ZXIgfSA9IGF3YWl0IGV4ZWN1dGVTd2FwKFxuICAgICAgICAgICAgICAgIGRhdGEubWV0aG9kUGFyYW1ldGVycyEsXG4gICAgICAgICAgICAgICAgVVNEQ19NQUlOTkVULFxuICAgICAgICAgICAgICAgIEV0aGVyLm9uQ2hhaW4oMSlcbiAgICAgICAgICAgICAgKVxuXG4gICAgICAgICAgICAgIGlmICh0eXBlID09ICdleGFjdEluJykge1xuICAgICAgICAgICAgICAgIGV4cGVjdCh0b2tlbkluQmVmb3JlLnN1YnRyYWN0KHRva2VuSW5BZnRlcikudG9FeGFjdCgpKS50by5lcXVhbCgnMTAwMDAwMCcpXG4gICAgICAgICAgICAgICAgY2hlY2tRdW90ZVRva2VuKFxuICAgICAgICAgICAgICAgICAgdG9rZW5PdXRCZWZvcmUsXG4gICAgICAgICAgICAgICAgICB0b2tlbk91dEFmdGVyLFxuICAgICAgICAgICAgICAgICAgQ3VycmVuY3lBbW91bnQuZnJvbVJhd0Ftb3VudChFdGhlci5vbkNoYWluKDEpLCBkYXRhLnF1b3RlKVxuICAgICAgICAgICAgICAgIClcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAvLyBIYXJkIHRvIHRlc3QgRVRIIGJhbGFuY2UgZHVlIHRvIGdhcyBjb3N0cyBmb3IgYXBwcm92YWwgYW5kIHN3YXAuIEp1c3QgY2hlY2sgdG9rZW5JbiBjaGFuZ2VzXG4gICAgICAgICAgICAgICAgY2hlY2tRdW90ZVRva2VuKHRva2VuSW5CZWZvcmUsIHRva2VuSW5BZnRlciwgQ3VycmVuY3lBbW91bnQuZnJvbVJhd0Ftb3VudChVU0RDX01BSU5ORVQsIGRhdGEucXVvdGUpKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuXG4gICAgICAgICAgICBpdChgZXRoIC0+IGVyYzIwYCwgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICBjb25zdCBxdW90ZVJlcTogUXVvdGVRdWVyeVBhcmFtcyA9IHtcbiAgICAgICAgICAgICAgICB0b2tlbkluQWRkcmVzczogJ0VUSCcsXG4gICAgICAgICAgICAgICAgdG9rZW5JbkNoYWluSWQ6IDEsXG4gICAgICAgICAgICAgICAgdG9rZW5PdXRBZGRyZXNzOiAnVU5JJyxcbiAgICAgICAgICAgICAgICB0b2tlbk91dENoYWluSWQ6IDEsXG4gICAgICAgICAgICAgICAgYW1vdW50OlxuICAgICAgICAgICAgICAgICAgdHlwZSA9PSAnZXhhY3RJbidcbiAgICAgICAgICAgICAgICAgICAgPyBhd2FpdCBnZXRBbW91bnQoMSwgdHlwZSwgJ0VUSCcsICdVTkknLCAnMTAnKVxuICAgICAgICAgICAgICAgICAgICA6IGF3YWl0IGdldEFtb3VudCgxLCB0eXBlLCAnRVRIJywgJ1VOSScsICcxMDAwMCcpLFxuICAgICAgICAgICAgICAgIHR5cGUsXG4gICAgICAgICAgICAgICAgcmVjaXBpZW50OiBhbGljZS5hZGRyZXNzLFxuICAgICAgICAgICAgICAgIHNsaXBwYWdlVG9sZXJhbmNlOiB0eXBlID09ICdleGFjdE91dCcgPyBMQVJHRV9TTElQUEFHRSA6IFNMSVBQQUdFLCAvLyBmb3IgZXhhY3Qgb3V0IHNvbWVob3cgdGhlIGxpcXVpZGF0aW9uIHdhc24ndCBzdWZmaWNpZW50LCBoZW5jZSBoaWdoZXIgc2xpcHBhZ2VcbiAgICAgICAgICAgICAgICBkZWFkbGluZTogJzM2MCcsXG4gICAgICAgICAgICAgICAgYWxnb3JpdGhtLFxuICAgICAgICAgICAgICAgIHNpbXVsYXRlRnJvbUFkZHJlc3M6ICcweDA3MTZhMTdGQkFlRTcxNGYxRTZhQjBmOWQ1OWVkYkM1ZjA5ODE1QzAnLFxuICAgICAgICAgICAgICAgIGVuYWJsZVVuaXZlcnNhbFJvdXRlcjogdHJ1ZSxcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGNvbnN0IHF1ZXJ5UGFyYW1zID0gcXMuc3RyaW5naWZ5KHF1b3RlUmVxKVxuXG4gICAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgYXhpb3MuZ2V0PFF1b3RlUmVzcG9uc2U+KGAke0FQSX0/JHtxdWVyeVBhcmFtc31gKVxuICAgICAgICAgICAgICBjb25zdCB7IGRhdGEsIHN0YXR1cyB9ID0gcmVzcG9uc2VcbiAgICAgICAgICAgICAgZXhwZWN0KHN0YXR1cykudG8uZXF1YWwoMjAwKVxuICAgICAgICAgICAgICBleHBlY3QoZGF0YS5zaW11bGF0aW9uRXJyb3IpLnRvLmVxdWFsKGZhbHNlKVxuICAgICAgICAgICAgICBleHBlY3QoZGF0YS5tZXRob2RQYXJhbWV0ZXJzKS50by5ub3QuYmUudW5kZWZpbmVkXG5cbiAgICAgICAgICAgICAgY29uc3QgeyB0b2tlbkluQmVmb3JlLCB0b2tlbkluQWZ0ZXIsIHRva2VuT3V0QmVmb3JlLCB0b2tlbk91dEFmdGVyIH0gPSBhd2FpdCBleGVjdXRlU3dhcChcbiAgICAgICAgICAgICAgICBkYXRhLm1ldGhvZFBhcmFtZXRlcnMhLFxuICAgICAgICAgICAgICAgIEV0aGVyLm9uQ2hhaW4oMSksXG4gICAgICAgICAgICAgICAgVU5JX01BSU5ORVRcbiAgICAgICAgICAgICAgKVxuXG4gICAgICAgICAgICAgIGlmICh0eXBlID09ICdleGFjdEluJykge1xuICAgICAgICAgICAgICAgIC8vIFdlJ3ZlIHN3YXBwZWQgMTAgRVRIICsgZ2FzIGNvc3RzXG4gICAgICAgICAgICAgICAgZXhwZWN0KHRva2VuSW5CZWZvcmUuc3VidHJhY3QodG9rZW5JbkFmdGVyKS5ncmVhdGVyVGhhbihwYXJzZUFtb3VudCgnMTAnLCBFdGhlci5vbkNoYWluKDEpKSkpLnRvLmJlLnRydWVcbiAgICAgICAgICAgICAgICBjaGVja1F1b3RlVG9rZW4odG9rZW5PdXRCZWZvcmUsIHRva2VuT3V0QWZ0ZXIsIEN1cnJlbmN5QW1vdW50LmZyb21SYXdBbW91bnQoVU5JX01BSU5ORVQsIGRhdGEucXVvdGUpKVxuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGV4cGVjdCh0b2tlbk91dEFmdGVyLnN1YnRyYWN0KHRva2VuT3V0QmVmb3JlKS50b0V4YWN0KCkpLnRvLmVxdWFsKCcxMDAwMCcpXG4gICAgICAgICAgICAgICAgLy8gQ2FuJ3QgZWFzaWx5IGNoZWNrIHNsaXBwYWdlIGZvciBFVEggZHVlIHRvIGdhcyBjb3N0cyBlZmZlY3RpbmcgRVRIIGJhbGFuY2UuXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG5cbiAgICAgICAgICAgIGl0KGBldGggLT4gZXJjMjAgc3dhcHJvdXRlcjAyYCwgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgICAgICBjb25zdCBxdW90ZVJlcTogUXVvdGVRdWVyeVBhcmFtcyA9IHtcbiAgICAgICAgICAgICAgICB0b2tlbkluQWRkcmVzczogJ0VUSCcsXG4gICAgICAgICAgICAgICAgdG9rZW5JbkNoYWluSWQ6IDEsXG4gICAgICAgICAgICAgICAgdG9rZW5PdXRBZGRyZXNzOiAnVU5JJyxcbiAgICAgICAgICAgICAgICB0b2tlbk91dENoYWluSWQ6IDEsXG4gICAgICAgICAgICAgICAgYW1vdW50OlxuICAgICAgICAgICAgICAgICAgdHlwZSA9PSAnZXhhY3RJbidcbiAgICAgICAgICAgICAgICAgICAgPyBhd2FpdCBnZXRBbW91bnQoMSwgdHlwZSwgJ0VUSCcsICdVTkknLCAnMTAnKVxuICAgICAgICAgICAgICAgICAgICA6IGF3YWl0IGdldEFtb3VudCgxLCB0eXBlLCAnRVRIJywgJ1VOSScsICcxMDAwMCcpLFxuICAgICAgICAgICAgICAgIHR5cGUsXG4gICAgICAgICAgICAgICAgcmVjaXBpZW50OiBhbGljZS5hZGRyZXNzLFxuICAgICAgICAgICAgICAgIHNsaXBwYWdlVG9sZXJhbmNlOiB0eXBlID09ICdleGFjdE91dCcgPyBMQVJHRV9TTElQUEFHRSA6IFNMSVBQQUdFLCAvLyBmb3IgZXhhY3Qgb3V0IHNvbWVob3cgdGhlIGxpcXVpZGF0aW9uIHdhc24ndCBzdWZmaWNpZW50LCBoZW5jZSBoaWdoZXIgc2xpcHBhZ2UsXG4gICAgICAgICAgICAgICAgZGVhZGxpbmU6ICczNjAnLFxuICAgICAgICAgICAgICAgIGFsZ29yaXRobSxcbiAgICAgICAgICAgICAgICBzaW11bGF0ZUZyb21BZGRyZXNzOiAnMHgwNzE2YTE3RkJBZUU3MTRmMUU2YUIwZjlkNTllZGJDNWYwOTgxNUMwJyxcbiAgICAgICAgICAgICAgICBlbmFibGVVbml2ZXJzYWxSb3V0ZXI6IGZhbHNlLFxuICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgY29uc3QgcXVlcnlQYXJhbXMgPSBxcy5zdHJpbmdpZnkocXVvdGVSZXEpXG5cbiAgICAgICAgICAgICAgY29uc3QgcmVzcG9uc2UgPSBhd2FpdCBheGlvcy5nZXQ8UXVvdGVSZXNwb25zZT4oYCR7QVBJfT8ke3F1ZXJ5UGFyYW1zfWApXG4gICAgICAgICAgICAgIGNvbnN0IHsgZGF0YSwgc3RhdHVzIH0gPSByZXNwb25zZVxuICAgICAgICAgICAgICBleHBlY3Qoc3RhdHVzKS50by5lcXVhbCgyMDApXG4gICAgICAgICAgICAgIGV4cGVjdChkYXRhLnNpbXVsYXRpb25FcnJvcikudG8uZXF1YWwoZmFsc2UpXG4gICAgICAgICAgICAgIGV4cGVjdChkYXRhLm1ldGhvZFBhcmFtZXRlcnMpLnRvLm5vdC5iZS51bmRlZmluZWRcblxuICAgICAgICAgICAgICBjb25zdCB7IHRva2VuSW5CZWZvcmUsIHRva2VuSW5BZnRlciwgdG9rZW5PdXRCZWZvcmUsIHRva2VuT3V0QWZ0ZXIgfSA9IGF3YWl0IGV4ZWN1dGVTd2FwKFxuICAgICAgICAgICAgICAgIGRhdGEubWV0aG9kUGFyYW1ldGVycyEsXG4gICAgICAgICAgICAgICAgRXRoZXIub25DaGFpbigxKSxcbiAgICAgICAgICAgICAgICBVTklfTUFJTk5FVFxuICAgICAgICAgICAgICApXG5cbiAgICAgICAgICAgICAgaWYgKHR5cGUgPT0gJ2V4YWN0SW4nKSB7XG4gICAgICAgICAgICAgICAgLy8gV2UndmUgc3dhcHBlZCAxMCBFVEggKyBnYXMgY29zdHNcbiAgICAgICAgICAgICAgICBleHBlY3QodG9rZW5JbkJlZm9yZS5zdWJ0cmFjdCh0b2tlbkluQWZ0ZXIpLmdyZWF0ZXJUaGFuKHBhcnNlQW1vdW50KCcxMCcsIEV0aGVyLm9uQ2hhaW4oMSkpKSkudG8uYmUudHJ1ZVxuICAgICAgICAgICAgICAgIGNoZWNrUXVvdGVUb2tlbih0b2tlbk91dEJlZm9yZSwgdG9rZW5PdXRBZnRlciwgQ3VycmVuY3lBbW91bnQuZnJvbVJhd0Ftb3VudChVTklfTUFJTk5FVCwgZGF0YS5xdW90ZSkpXG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZXhwZWN0KHRva2VuT3V0QWZ0ZXIuc3VidHJhY3QodG9rZW5PdXRCZWZvcmUpLnRvRXhhY3QoKSkudG8uZXF1YWwoJzEwMDAwJylcbiAgICAgICAgICAgICAgICAvLyBDYW4ndCBlYXNpbHkgY2hlY2sgc2xpcHBhZ2UgZm9yIEVUSCBkdWUgdG8gZ2FzIGNvc3RzIGVmZmVjdGluZyBFVEggYmFsYW5jZS5cbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfSlcblxuICAgICAgICAgICAgaXQoYHdldGggLT4gZXJjMjBgLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgICAgIGNvbnN0IHF1b3RlUmVxOiBRdW90ZVF1ZXJ5UGFyYW1zID0ge1xuICAgICAgICAgICAgICAgIHRva2VuSW5BZGRyZXNzOiAnV0VUSCcsXG4gICAgICAgICAgICAgICAgdG9rZW5JbkNoYWluSWQ6IDEsXG4gICAgICAgICAgICAgICAgdG9rZW5PdXRBZGRyZXNzOiAnREFJJyxcbiAgICAgICAgICAgICAgICB0b2tlbk91dENoYWluSWQ6IDEsXG4gICAgICAgICAgICAgICAgYW1vdW50OiBhd2FpdCBnZXRBbW91bnQoMSwgdHlwZSwgJ1dFVEgnLCAnREFJJywgJzEwMCcpLFxuICAgICAgICAgICAgICAgIHR5cGUsXG4gICAgICAgICAgICAgICAgcmVjaXBpZW50OiBhbGljZS5hZGRyZXNzLFxuICAgICAgICAgICAgICAgIHNsaXBwYWdlVG9sZXJhbmNlOiBTTElQUEFHRSxcbiAgICAgICAgICAgICAgICBkZWFkbGluZTogJzM2MCcsXG4gICAgICAgICAgICAgICAgYWxnb3JpdGhtLFxuICAgICAgICAgICAgICAgIHNpbXVsYXRlRnJvbUFkZHJlc3M6ICcweGYwNGE1Y2M4MGIxZTk0YzY5YjQ4ZjVlZTY4YTA4Y2QyZjA5YTdjM2UnLFxuICAgICAgICAgICAgICAgIGVuYWJsZVVuaXZlcnNhbFJvdXRlcjogdHJ1ZSxcbiAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgIGNvbnN0IHF1ZXJ5UGFyYW1zID0gcXMuc3RyaW5naWZ5KHF1b3RlUmVxKVxuXG4gICAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgYXhpb3MuZ2V0PFF1b3RlUmVzcG9uc2U+KGAke0FQSX0/JHtxdWVyeVBhcmFtc31gKVxuICAgICAgICAgICAgICBjb25zdCB7IGRhdGEsIHN0YXR1cyB9ID0gcmVzcG9uc2VcbiAgICAgICAgICAgICAgZXhwZWN0KHN0YXR1cykudG8uZXF1YWwoMjAwKVxuICAgICAgICAgICAgICBleHBlY3QoZGF0YS5zaW11bGF0aW9uRXJyb3IpLnRvLmVxdWFsKGZhbHNlKVxuICAgICAgICAgICAgICBleHBlY3QoZGF0YS5tZXRob2RQYXJhbWV0ZXJzKS50by5ub3QuYmUudW5kZWZpbmVkXG5cbiAgICAgICAgICAgICAgY29uc3QgeyB0b2tlbkluQmVmb3JlLCB0b2tlbkluQWZ0ZXIsIHRva2VuT3V0QmVmb3JlLCB0b2tlbk91dEFmdGVyIH0gPSBhd2FpdCBleGVjdXRlU3dhcChcbiAgICAgICAgICAgICAgICBkYXRhLm1ldGhvZFBhcmFtZXRlcnMhLFxuICAgICAgICAgICAgICAgIFdFVEg5WzFdISxcbiAgICAgICAgICAgICAgICBEQUlfTUFJTk5FVFxuICAgICAgICAgICAgICApXG5cbiAgICAgICAgICAgICAgaWYgKHR5cGUgPT0gJ2V4YWN0SW4nKSB7XG4gICAgICAgICAgICAgICAgZXhwZWN0KHRva2VuSW5CZWZvcmUuc3VidHJhY3QodG9rZW5JbkFmdGVyKS50b0V4YWN0KCkpLnRvLmVxdWFsKCcxMDAnKVxuICAgICAgICAgICAgICAgIGNoZWNrUXVvdGVUb2tlbih0b2tlbk91dEJlZm9yZSwgdG9rZW5PdXRBZnRlciwgQ3VycmVuY3lBbW91bnQuZnJvbVJhd0Ftb3VudChEQUlfTUFJTk5FVCwgZGF0YS5xdW90ZSkpXG4gICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZXhwZWN0KHRva2VuT3V0QWZ0ZXIuc3VidHJhY3QodG9rZW5PdXRCZWZvcmUpLnRvRXhhY3QoKSkudG8uZXF1YWwoJzEwMCcpXG4gICAgICAgICAgICAgICAgY2hlY2tRdW90ZVRva2VuKHRva2VuSW5CZWZvcmUsIHRva2VuSW5BZnRlciwgQ3VycmVuY3lBbW91bnQuZnJvbVJhd0Ftb3VudChXRVRIOVsxXSEsIGRhdGEucXVvdGUpKVxuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9KVxuXG4gICAgICAgICAgICBpdChgZXJjMjAgLT4gd2V0aGAsIGFzeW5jICgpID0+IHtcbiAgICAgICAgICAgICAgY29uc3QgcXVvdGVSZXE6IFF1b3RlUXVlcnlQYXJhbXMgPSB7XG4gICAgICAgICAgICAgICAgdG9rZW5JbkFkZHJlc3M6ICdVU0RDJyxcbiAgICAgICAgICAgICAgICB0b2tlbkluQ2hhaW5JZDogMSxcbiAgICAgICAgICAgICAgICB0b2tlbk91dEFkZHJlc3M6ICdXRVRIJyxcbiAgICAgICAgICAgICAgICB0b2tlbk91dENoYWluSWQ6IDEsXG4gICAgICAgICAgICAgICAgYW1vdW50OiBhd2FpdCBnZXRBbW91bnQoMSwgdHlwZSwgJ1VTREMnLCAnV0VUSCcsICcxMDAnKSxcbiAgICAgICAgICAgICAgICB0eXBlLFxuICAgICAgICAgICAgICAgIHJlY2lwaWVudDogYWxpY2UuYWRkcmVzcyxcbiAgICAgICAgICAgICAgICBzbGlwcGFnZVRvbGVyYW5jZTogU0xJUFBBR0UsXG4gICAgICAgICAgICAgICAgZGVhZGxpbmU6ICczNjAnLFxuICAgICAgICAgICAgICAgIGFsZ29yaXRobSxcbiAgICAgICAgICAgICAgICBzaW11bGF0ZUZyb21BZGRyZXNzOiAnMHhmNTg0Zjg3MjhiODc0YTZhNWM3YThkNGQzODdjOWFhZTkxNzJkNjIxJyxcbiAgICAgICAgICAgICAgICBlbmFibGVVbml2ZXJzYWxSb3V0ZXI6IHRydWUsXG4gICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICBjb25zdCBxdWVyeVBhcmFtcyA9IHFzLnN0cmluZ2lmeShxdW90ZVJlcSlcblxuICAgICAgICAgICAgICBjb25zdCByZXNwb25zZSA9IGF3YWl0IGF4aW9zLmdldDxRdW90ZVJlc3BvbnNlPihgJHtBUEl9PyR7cXVlcnlQYXJhbXN9YClcbiAgICAgICAgICAgICAgY29uc3QgeyBkYXRhLCBzdGF0dXMgfSA9IHJlc3BvbnNlXG4gICAgICAgICAgICAgIGV4cGVjdChzdGF0dXMpLnRvLmVxdWFsKDIwMClcbiAgICAgICAgICAgICAgZXhwZWN0KGRhdGEuc2ltdWxhdGlvbkVycm9yKS50by5lcXVhbChmYWxzZSlcbiAgICAgICAgICAgICAgZXhwZWN0KGRhdGEubWV0aG9kUGFyYW1ldGVycykudG8ubm90LmJlLnVuZGVmaW5lZFxuXG4gICAgICAgICAgICAgIGNvbnN0IHsgdG9rZW5JbkJlZm9yZSwgdG9rZW5JbkFmdGVyLCB0b2tlbk91dEJlZm9yZSwgdG9rZW5PdXRBZnRlciB9ID0gYXdhaXQgZXhlY3V0ZVN3YXAoXG4gICAgICAgICAgICAgICAgZGF0YS5tZXRob2RQYXJhbWV0ZXJzISxcbiAgICAgICAgICAgICAgICBVU0RDX01BSU5ORVQsXG4gICAgICAgICAgICAgICAgV0VUSDlbMV0hXG4gICAgICAgICAgICAgIClcblxuICAgICAgICAgICAgICBpZiAodHlwZSA9PSAnZXhhY3RJbicpIHtcbiAgICAgICAgICAgICAgICBleHBlY3QodG9rZW5JbkJlZm9yZS5zdWJ0cmFjdCh0b2tlbkluQWZ0ZXIpLnRvRXhhY3QoKSkudG8uZXF1YWwoJzEwMCcpXG4gICAgICAgICAgICAgICAgY2hlY2tRdW90ZVRva2VuKHRva2VuT3V0QmVmb3JlLCB0b2tlbk91dEFmdGVyLCBDdXJyZW5jeUFtb3VudC5mcm9tUmF3QW1vdW50KFdFVEg5WzFdLCBkYXRhLnF1b3RlKSlcbiAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBleHBlY3QodG9rZW5PdXRBZnRlci5zdWJ0cmFjdCh0b2tlbk91dEJlZm9yZSkudG9FeGFjdCgpKS50by5lcXVhbCgnMTAwJylcbiAgICAgICAgICAgICAgICBjaGVja1F1b3RlVG9rZW4odG9rZW5JbkJlZm9yZSwgdG9rZW5JbkFmdGVyLCBDdXJyZW5jeUFtb3VudC5mcm9tUmF3QW1vdW50KFVTRENfTUFJTk5FVCwgZGF0YS5xdW90ZSkpXG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgICBpdChgZXJjMjAgLT4gZXJjMjAgbm8gcmVjaXBpZW50L2RlYWRsaW5lL3NsaXBwYWdlYCwgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHF1b3RlUmVxOiBRdW90ZVF1ZXJ5UGFyYW1zID0ge1xuICAgICAgICAgICAgdG9rZW5JbkFkZHJlc3M6ICdVU0RDJyxcbiAgICAgICAgICAgIHRva2VuSW5DaGFpbklkOiAxLFxuICAgICAgICAgICAgdG9rZW5PdXRBZGRyZXNzOiAnVVNEVCcsXG4gICAgICAgICAgICB0b2tlbk91dENoYWluSWQ6IDEsXG4gICAgICAgICAgICBhbW91bnQ6IGF3YWl0IGdldEFtb3VudCgxLCB0eXBlLCAnVVNEQycsICdVU0RUJywgJzEwMCcpLFxuICAgICAgICAgICAgdHlwZSxcbiAgICAgICAgICAgIGFsZ29yaXRobSxcbiAgICAgICAgICAgIGVuYWJsZVVuaXZlcnNhbFJvdXRlcjogdHJ1ZSxcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBxdWVyeVBhcmFtcyA9IHFzLnN0cmluZ2lmeShxdW90ZVJlcSlcblxuICAgICAgICAgIGNvbnN0IHJlc3BvbnNlOiBBeGlvc1Jlc3BvbnNlPFF1b3RlUmVzcG9uc2U+ID0gYXdhaXQgYXhpb3MuZ2V0PFF1b3RlUmVzcG9uc2U+KGAke0FQSX0/JHtxdWVyeVBhcmFtc31gKVxuICAgICAgICAgIGNvbnN0IHtcbiAgICAgICAgICAgIGRhdGE6IHsgcXVvdGVEZWNpbWFscywgcXVvdGVHYXNBZGp1c3RlZERlY2ltYWxzLCBtZXRob2RQYXJhbWV0ZXJzIH0sXG4gICAgICAgICAgICBzdGF0dXMsXG4gICAgICAgICAgfSA9IHJlc3BvbnNlXG5cbiAgICAgICAgICBleHBlY3Qoc3RhdHVzKS50by5lcXVhbCgyMDApXG4gICAgICAgICAgZXhwZWN0KHBhcnNlRmxvYXQocXVvdGVEZWNpbWFscykpLnRvLmJlLmdyZWF0ZXJUaGFuKDkwKVxuICAgICAgICAgIGV4cGVjdChwYXJzZUZsb2F0KHF1b3RlRGVjaW1hbHMpKS50by5iZS5sZXNzVGhhbigxMTApXG5cbiAgICAgICAgICBpZiAodHlwZSA9PSAnZXhhY3RJbicpIHtcbiAgICAgICAgICAgIGV4cGVjdChwYXJzZUZsb2F0KHF1b3RlR2FzQWRqdXN0ZWREZWNpbWFscykpLnRvLmJlLmxlc3NUaGFuT3JFcXVhbChwYXJzZUZsb2F0KHF1b3RlRGVjaW1hbHMpKVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBleHBlY3QocGFyc2VGbG9hdChxdW90ZUdhc0FkanVzdGVkRGVjaW1hbHMpKS50by5iZS5ncmVhdGVyVGhhbk9yRXF1YWwocGFyc2VGbG9hdChxdW90ZURlY2ltYWxzKSlcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBleHBlY3QobWV0aG9kUGFyYW1ldGVycykudG8uYmUudW5kZWZpbmVkXG4gICAgICAgIH0pXG5cbiAgICAgICAgaXQoYGVyYzIwIC0+IGVyYzIwIGdhcyBwcmljZSBzcGVjaWZpZWRgLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgY29uc3QgcXVvdGVSZXE6IFF1b3RlUXVlcnlQYXJhbXMgPSB7XG4gICAgICAgICAgICB0b2tlbkluQWRkcmVzczogJ1VTREMnLFxuICAgICAgICAgICAgdG9rZW5JbkNoYWluSWQ6IDEsXG4gICAgICAgICAgICB0b2tlbk91dEFkZHJlc3M6ICdVU0RUJyxcbiAgICAgICAgICAgIHRva2VuT3V0Q2hhaW5JZDogMSxcbiAgICAgICAgICAgIGFtb3VudDogYXdhaXQgZ2V0QW1vdW50KDEsIHR5cGUsICdVU0RDJywgJ1VTRFQnLCAnMTAwJyksXG4gICAgICAgICAgICB0eXBlLFxuICAgICAgICAgICAgYWxnb3JpdGhtLFxuICAgICAgICAgICAgZ2FzUHJpY2VXZWk6ICc2MDAwMDAwMDAwMCcsXG4gICAgICAgICAgICBlbmFibGVVbml2ZXJzYWxSb3V0ZXI6IHRydWUsXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgcXVlcnlQYXJhbXMgPSBxcy5zdHJpbmdpZnkocXVvdGVSZXEpXG5cbiAgICAgICAgICBjb25zdCByZXNwb25zZTogQXhpb3NSZXNwb25zZTxRdW90ZVJlc3BvbnNlPiA9IGF3YWl0IGF4aW9zLmdldDxRdW90ZVJlc3BvbnNlPihgJHtBUEl9PyR7cXVlcnlQYXJhbXN9YClcbiAgICAgICAgICBjb25zdCB7XG4gICAgICAgICAgICBkYXRhOiB7IHF1b3RlRGVjaW1hbHMsIHF1b3RlR2FzQWRqdXN0ZWREZWNpbWFscywgbWV0aG9kUGFyYW1ldGVycywgZ2FzUHJpY2VXZWkgfSxcbiAgICAgICAgICAgIHN0YXR1cyxcbiAgICAgICAgICB9ID0gcmVzcG9uc2VcblxuICAgICAgICAgIGV4cGVjdChzdGF0dXMpLnRvLmVxdWFsKDIwMClcblxuICAgICAgICAgIGlmIChhbGdvcml0aG0gPT0gJ2FscGhhJykge1xuICAgICAgICAgICAgZXhwZWN0KGdhc1ByaWNlV2VpKS50by5lcXVhbCgnNjAwMDAwMDAwMDAnKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGV4cGVjdChwYXJzZUZsb2F0KHF1b3RlRGVjaW1hbHMpKS50by5iZS5ncmVhdGVyVGhhbig5MClcbiAgICAgICAgICBleHBlY3QocGFyc2VGbG9hdChxdW90ZURlY2ltYWxzKSkudG8uYmUubGVzc1RoYW4oMTEwKVxuXG4gICAgICAgICAgaWYgKHR5cGUgPT0gJ2V4YWN0SW4nKSB7XG4gICAgICAgICAgICBleHBlY3QocGFyc2VGbG9hdChxdW90ZUdhc0FkanVzdGVkRGVjaW1hbHMpKS50by5iZS5sZXNzVGhhbk9yRXF1YWwocGFyc2VGbG9hdChxdW90ZURlY2ltYWxzKSlcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgZXhwZWN0KHBhcnNlRmxvYXQocXVvdGVHYXNBZGp1c3RlZERlY2ltYWxzKSkudG8uYmUuZ3JlYXRlclRoYW5PckVxdWFsKHBhcnNlRmxvYXQocXVvdGVEZWNpbWFscykpXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgZXhwZWN0KG1ldGhvZFBhcmFtZXRlcnMpLnRvLmJlLnVuZGVmaW5lZFxuICAgICAgICB9KVxuXG4gICAgICAgIGl0KGBlcmMyMCAtPiBlcmMyMCBieSBhZGRyZXNzYCwgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHF1b3RlUmVxOiBRdW90ZVF1ZXJ5UGFyYW1zID0ge1xuICAgICAgICAgICAgdG9rZW5JbkFkZHJlc3M6ICcweDZCMTc1NDc0RTg5MDk0QzQ0RGE5OGI5NTRFZWRlQUM0OTUyNzFkMEYnLFxuICAgICAgICAgICAgdG9rZW5JbkNoYWluSWQ6IDEsIC8vIERBSVxuICAgICAgICAgICAgdG9rZW5PdXRBZGRyZXNzOiAnMHhBMGI4Njk5MWM2MjE4YjM2YzFkMTlENGEyZTlFYjBjRTM2MDZlQjQ4JyxcbiAgICAgICAgICAgIHRva2VuT3V0Q2hhaW5JZDogMSwgLy8gVVNEQ1xuICAgICAgICAgICAgYW1vdW50OiBhd2FpdCBnZXRBbW91bnQoMSwgdHlwZSwgJ0RBSScsICdVU0RDJywgJzEwMCcpLFxuICAgICAgICAgICAgdHlwZSxcbiAgICAgICAgICAgIHJlY2lwaWVudDogYWxpY2UuYWRkcmVzcyxcbiAgICAgICAgICAgIHNsaXBwYWdlVG9sZXJhbmNlOiBTTElQUEFHRSxcbiAgICAgICAgICAgIGRlYWRsaW5lOiAnMzYwJyxcbiAgICAgICAgICAgIGFsZ29yaXRobSxcbiAgICAgICAgICAgIGVuYWJsZVVuaXZlcnNhbFJvdXRlcjogdHJ1ZSxcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBxdWVyeVBhcmFtcyA9IHFzLnN0cmluZ2lmeShxdW90ZVJlcSlcblxuICAgICAgICAgIGNvbnN0IHJlc3BvbnNlOiBBeGlvc1Jlc3BvbnNlPFF1b3RlUmVzcG9uc2U+ID0gYXdhaXQgYXhpb3MuZ2V0PFF1b3RlUmVzcG9uc2U+KGAke0FQSX0/JHtxdWVyeVBhcmFtc31gKVxuXG4gICAgICAgICAgY29uc3Qge1xuICAgICAgICAgICAgZGF0YTogeyBxdW90ZURlY2ltYWxzLCBxdW90ZUdhc0FkanVzdGVkRGVjaW1hbHMgfSxcbiAgICAgICAgICAgIHN0YXR1cyxcbiAgICAgICAgICB9ID0gcmVzcG9uc2VcblxuICAgICAgICAgIGV4cGVjdChzdGF0dXMpLnRvLmVxdWFsKDIwMClcbiAgICAgICAgICBleHBlY3QocGFyc2VGbG9hdChxdW90ZURlY2ltYWxzKSkudG8uYmUuZ3JlYXRlclRoYW4oOTApXG5cbiAgICAgICAgICBpZiAodHlwZSA9PSAnZXhhY3RJbicpIHtcbiAgICAgICAgICAgIGV4cGVjdChwYXJzZUZsb2F0KHF1b3RlR2FzQWRqdXN0ZWREZWNpbWFscykpLnRvLmJlLmxlc3NUaGFuT3JFcXVhbChwYXJzZUZsb2F0KHF1b3RlRGVjaW1hbHMpKVxuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBleHBlY3QocGFyc2VGbG9hdChxdW90ZUdhc0FkanVzdGVkRGVjaW1hbHMpKS50by5iZS5ncmVhdGVyVGhhbk9yRXF1YWwocGFyc2VGbG9hdChxdW90ZURlY2ltYWxzKSlcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBleHBlY3QocGFyc2VGbG9hdChxdW90ZURlY2ltYWxzKSkudG8uYmUubGVzc1RoYW4oMTEwKVxuICAgICAgICB9KVxuXG4gICAgICAgIGl0KGBlcmMyMCAtPiBlcmMyMCBvbmUgYnkgYWRkcmVzcyBvbmUgYnkgc3ltYm9sYCwgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHF1b3RlUmVxOiBRdW90ZVF1ZXJ5UGFyYW1zID0ge1xuICAgICAgICAgICAgdG9rZW5JbkFkZHJlc3M6ICcweDZCMTc1NDc0RTg5MDk0QzQ0RGE5OGI5NTRFZWRlQUM0OTUyNzFkMEYnLFxuICAgICAgICAgICAgdG9rZW5JbkNoYWluSWQ6IDEsXG4gICAgICAgICAgICB0b2tlbk91dEFkZHJlc3M6ICdVU0RDJyxcbiAgICAgICAgICAgIHRva2VuT3V0Q2hhaW5JZDogMSxcbiAgICAgICAgICAgIGFtb3VudDogYXdhaXQgZ2V0QW1vdW50KDEsIHR5cGUsICdEQUknLCAnVVNEQycsICcxMDAnKSxcbiAgICAgICAgICAgIHR5cGUsXG4gICAgICAgICAgICByZWNpcGllbnQ6IGFsaWNlLmFkZHJlc3MsXG4gICAgICAgICAgICBzbGlwcGFnZVRvbGVyYW5jZTogU0xJUFBBR0UsXG4gICAgICAgICAgICBkZWFkbGluZTogJzM2MCcsXG4gICAgICAgICAgICBhbGdvcml0aG0sXG4gICAgICAgICAgICBlbmFibGVVbml2ZXJzYWxSb3V0ZXI6IHRydWUsXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgcXVlcnlQYXJhbXMgPSBxcy5zdHJpbmdpZnkocXVvdGVSZXEpXG5cbiAgICAgICAgICBjb25zdCByZXNwb25zZTogQXhpb3NSZXNwb25zZTxRdW90ZVJlc3BvbnNlPiA9IGF3YWl0IGF4aW9zLmdldDxRdW90ZVJlc3BvbnNlPihgJHtBUEl9PyR7cXVlcnlQYXJhbXN9YClcbiAgICAgICAgICBjb25zdCB7XG4gICAgICAgICAgICBkYXRhOiB7IHF1b3RlRGVjaW1hbHMsIHF1b3RlR2FzQWRqdXN0ZWREZWNpbWFscyB9LFxuICAgICAgICAgICAgc3RhdHVzLFxuICAgICAgICAgIH0gPSByZXNwb25zZVxuXG4gICAgICAgICAgZXhwZWN0KHN0YXR1cykudG8uZXF1YWwoMjAwKVxuICAgICAgICAgIGV4cGVjdChwYXJzZUZsb2F0KHF1b3RlRGVjaW1hbHMpKS50by5iZS5ncmVhdGVyVGhhbig5MClcblxuICAgICAgICAgIGlmICh0eXBlID09ICdleGFjdEluJykge1xuICAgICAgICAgICAgZXhwZWN0KHBhcnNlRmxvYXQocXVvdGVHYXNBZGp1c3RlZERlY2ltYWxzKSkudG8uYmUubGVzc1RoYW5PckVxdWFsKHBhcnNlRmxvYXQocXVvdGVEZWNpbWFscykpXG4gICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGV4cGVjdChwYXJzZUZsb2F0KHF1b3RlR2FzQWRqdXN0ZWREZWNpbWFscykpLnRvLmJlLmdyZWF0ZXJUaGFuT3JFcXVhbChwYXJzZUZsb2F0KHF1b3RlRGVjaW1hbHMpKVxuICAgICAgICAgIH1cblxuICAgICAgICAgIGV4cGVjdChwYXJzZUZsb2F0KHF1b3RlRGVjaW1hbHMpKS50by5iZS5sZXNzVGhhbigxMTApXG4gICAgICAgIH0pXG4gICAgICB9KVxuXG4gICAgICBkZXNjcmliZShgJHtJRF9UT19ORVRXT1JLX05BTUUoMSl9ICR7YWxnb3JpdGhtfSAke3R5cGV9IDR4eGAsICgpID0+IHtcbiAgICAgICAgaXQoYGZpZWxkIGlzIG1pc3NpbmcgaW4gYm9keWAsIGFzeW5jICgpID0+IHtcbiAgICAgICAgICBjb25zdCBxdW90ZVJlcTogUGFydGlhbDxRdW90ZVF1ZXJ5UGFyYW1zPiA9IHtcbiAgICAgICAgICAgIHRva2VuT3V0QWRkcmVzczogJ1VTRFQnLFxuICAgICAgICAgICAgdG9rZW5JbkNoYWluSWQ6IDEsXG4gICAgICAgICAgICB0b2tlbk91dENoYWluSWQ6IDEsXG4gICAgICAgICAgICBhbW91bnQ6IGF3YWl0IGdldEFtb3VudCgxLCB0eXBlLCAnVVNEQycsICdVU0RUJywgJzEwMCcpLFxuICAgICAgICAgICAgdHlwZSxcbiAgICAgICAgICAgIHJlY2lwaWVudDogYWxpY2UuYWRkcmVzcyxcbiAgICAgICAgICAgIHNsaXBwYWdlVG9sZXJhbmNlOiBTTElQUEFHRSxcbiAgICAgICAgICAgIGRlYWRsaW5lOiAnMzYwJyxcbiAgICAgICAgICAgIGFsZ29yaXRobSxcbiAgICAgICAgICAgIGVuYWJsZVVuaXZlcnNhbFJvdXRlcjogdHJ1ZSxcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBhd2FpdCBjYWxsQW5kRXhwZWN0RmFpbChxdW90ZVJlcSwge1xuICAgICAgICAgICAgc3RhdHVzOiA0MDAsXG4gICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgIGRldGFpbDogJ1widG9rZW5JbkFkZHJlc3NcIiBpcyByZXF1aXJlZCcsXG4gICAgICAgICAgICAgIGVycm9yQ29kZTogJ1ZBTElEQVRJT05fRVJST1InLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9KVxuICAgICAgICB9KVxuXG4gICAgICAgIGl0LnNraXAoYGFtb3VudCBpcyB0b28gYmlnIHRvIGZpbmQgcm91dGVgLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgY29uc3QgcXVvdGVSZXE6IFF1b3RlUXVlcnlQYXJhbXMgPSB7XG4gICAgICAgICAgICB0b2tlbkluQWRkcmVzczogJ1VOSScsXG4gICAgICAgICAgICB0b2tlbkluQ2hhaW5JZDogMSxcbiAgICAgICAgICAgIHRva2VuT3V0QWRkcmVzczogJ0tOQycsXG4gICAgICAgICAgICB0b2tlbk91dENoYWluSWQ6IDEsXG4gICAgICAgICAgICBhbW91bnQ6IGF3YWl0IGdldEFtb3VudCgxLCB0eXBlLCAnVU5JJywgJ0tOQycsICc5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5OTk5JyksXG4gICAgICAgICAgICB0eXBlLFxuICAgICAgICAgICAgcmVjaXBpZW50OiAnMHg4OGZjNzY1OTQ5YTI3NDA1NDgwRjM3NEFhNDlFMjBkY0NEM2ZDZmI4JyxcbiAgICAgICAgICAgIHNsaXBwYWdlVG9sZXJhbmNlOiBTTElQUEFHRSxcbiAgICAgICAgICAgIGRlYWRsaW5lOiAnMzYwJyxcbiAgICAgICAgICAgIGFsZ29yaXRobSxcbiAgICAgICAgICAgIGVuYWJsZVVuaXZlcnNhbFJvdXRlcjogdHJ1ZSxcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBhd2FpdCBjYWxsQW5kRXhwZWN0RmFpbChxdW90ZVJlcSwge1xuICAgICAgICAgICAgc3RhdHVzOiA0MDAsXG4gICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgIGRldGFpbDogJ05vIHJvdXRlIGZvdW5kJyxcbiAgICAgICAgICAgICAgZXJyb3JDb2RlOiAnTk9fUk9VVEUnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9KVxuICAgICAgICB9KVxuXG4gICAgICAgIGl0KGBhbW91bnQgaXMgdG9vIGJpZyBmb3IgdWludDI1NmAsIGFzeW5jICgpID0+IHtcbiAgICAgICAgICBjb25zdCBxdW90ZVJlcTogUXVvdGVRdWVyeVBhcmFtcyA9IHtcbiAgICAgICAgICAgIHRva2VuSW5BZGRyZXNzOiAnVVNEQycsXG4gICAgICAgICAgICB0b2tlbkluQ2hhaW5JZDogMSxcbiAgICAgICAgICAgIHRva2VuT3V0QWRkcmVzczogJ1VTRFQnLFxuICAgICAgICAgICAgdG9rZW5PdXRDaGFpbklkOiAxLFxuICAgICAgICAgICAgYW1vdW50OiBhd2FpdCBnZXRBbW91bnQoXG4gICAgICAgICAgICAgIDEsXG4gICAgICAgICAgICAgIHR5cGUsXG4gICAgICAgICAgICAgICdVU0RDJyxcbiAgICAgICAgICAgICAgJ1VTRFQnLFxuICAgICAgICAgICAgICAnMTAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwJ1xuICAgICAgICAgICAgKSxcbiAgICAgICAgICAgIHR5cGUsXG4gICAgICAgICAgICByZWNpcGllbnQ6IGFsaWNlLmFkZHJlc3MsXG4gICAgICAgICAgICBzbGlwcGFnZVRvbGVyYW5jZTogU0xJUFBBR0UsXG4gICAgICAgICAgICBkZWFkbGluZTogJzM2MCcsXG4gICAgICAgICAgICBhbGdvcml0aG0sXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgYXdhaXQgY2FsbEFuZEV4cGVjdEZhaWwocXVvdGVSZXEsIHtcbiAgICAgICAgICAgIHN0YXR1czogNDAwLFxuICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICBkZXRhaWw6ICdcImFtb3VudFwiIGxlbmd0aCBtdXN0IGJlIGxlc3MgdGhhbiBvciBlcXVhbCB0byA3NyBjaGFyYWN0ZXJzIGxvbmcnLFxuICAgICAgICAgICAgICBlcnJvckNvZGU6ICdWQUxJREFUSU9OX0VSUk9SJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSlcbiAgICAgICAgfSlcblxuICAgICAgICBpdChgYW1vdW50IGlzIG5lZ2F0aXZlYCwgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHF1b3RlUmVxOiBRdW90ZVF1ZXJ5UGFyYW1zID0ge1xuICAgICAgICAgICAgdG9rZW5JbkFkZHJlc3M6ICdVU0RDJyxcbiAgICAgICAgICAgIHRva2VuSW5DaGFpbklkOiAxLFxuICAgICAgICAgICAgdG9rZW5PdXRBZGRyZXNzOiAnVVNEVCcsXG4gICAgICAgICAgICB0b2tlbk91dENoYWluSWQ6IDEsXG4gICAgICAgICAgICBhbW91bnQ6ICctMTAwMDAwMDAwMDAnLFxuICAgICAgICAgICAgdHlwZSxcbiAgICAgICAgICAgIHJlY2lwaWVudDogYWxpY2UuYWRkcmVzcyxcbiAgICAgICAgICAgIHNsaXBwYWdlVG9sZXJhbmNlOiBTTElQUEFHRSxcbiAgICAgICAgICAgIGRlYWRsaW5lOiAnMzYwJyxcbiAgICAgICAgICAgIGFsZ29yaXRobSxcbiAgICAgICAgICAgIGVuYWJsZVVuaXZlcnNhbFJvdXRlcjogdHJ1ZSxcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBhd2FpdCBjYWxsQW5kRXhwZWN0RmFpbChxdW90ZVJlcSwge1xuICAgICAgICAgICAgc3RhdHVzOiA0MDAsXG4gICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgIGRldGFpbDogJ1wiYW1vdW50XCIgd2l0aCB2YWx1ZSBcIi0xMDAwMDAwMDAwMFwiIGZhaWxzIHRvIG1hdGNoIHRoZSByZXF1aXJlZCBwYXR0ZXJuOiAvXlswLTldKyQvJyxcbiAgICAgICAgICAgICAgZXJyb3JDb2RlOiAnVkFMSURBVElPTl9FUlJPUicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pXG4gICAgICAgIH0pXG5cbiAgICAgICAgaXQoYGFtb3VudCBpcyBkZWNpbWFsYCwgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHF1b3RlUmVxOiBRdW90ZVF1ZXJ5UGFyYW1zID0ge1xuICAgICAgICAgICAgdG9rZW5JbkFkZHJlc3M6ICdVU0RDJyxcbiAgICAgICAgICAgIHRva2VuSW5DaGFpbklkOiAxLFxuICAgICAgICAgICAgdG9rZW5PdXRBZGRyZXNzOiAnVVNEVCcsXG4gICAgICAgICAgICB0b2tlbk91dENoYWluSWQ6IDEsXG4gICAgICAgICAgICBhbW91bnQ6ICcxMDAwMDAwMDAwLjI1JyxcbiAgICAgICAgICAgIHR5cGUsXG4gICAgICAgICAgICByZWNpcGllbnQ6IGFsaWNlLmFkZHJlc3MsXG4gICAgICAgICAgICBzbGlwcGFnZVRvbGVyYW5jZTogU0xJUFBBR0UsXG4gICAgICAgICAgICBkZWFkbGluZTogJzM2MCcsXG4gICAgICAgICAgICBhbGdvcml0aG0sXG4gICAgICAgICAgICBlbmFibGVVbml2ZXJzYWxSb3V0ZXI6IHRydWUsXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgYXdhaXQgY2FsbEFuZEV4cGVjdEZhaWwocXVvdGVSZXEsIHtcbiAgICAgICAgICAgIHN0YXR1czogNDAwLFxuICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICBkZXRhaWw6ICdcImFtb3VudFwiIHdpdGggdmFsdWUgXCIxMDAwMDAwMDAwLjI1XCIgZmFpbHMgdG8gbWF0Y2ggdGhlIHJlcXVpcmVkIHBhdHRlcm46IC9eWzAtOV0rJC8nLFxuICAgICAgICAgICAgICBlcnJvckNvZGU6ICdWQUxJREFUSU9OX0VSUk9SJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSlcbiAgICAgICAgfSlcblxuICAgICAgICBpdChgc3ltYm9sIGRvZXNudCBleGlzdGAsIGFzeW5jICgpID0+IHtcbiAgICAgICAgICBjb25zdCBxdW90ZVJlcTogUXVvdGVRdWVyeVBhcmFtcyA9IHtcbiAgICAgICAgICAgIHRva2VuSW5BZGRyZXNzOiAnVVNEQycsXG4gICAgICAgICAgICB0b2tlbkluQ2hhaW5JZDogMSxcbiAgICAgICAgICAgIHRva2VuT3V0QWRkcmVzczogJ05PTkVYSVNUQU5UVE9LRU4nLFxuICAgICAgICAgICAgdG9rZW5PdXRDaGFpbklkOiAxLFxuICAgICAgICAgICAgYW1vdW50OiBhd2FpdCBnZXRBbW91bnQoMSwgdHlwZSwgJ1VTREMnLCAnVVNEVCcsICcxMDAnKSxcbiAgICAgICAgICAgIHR5cGUsXG4gICAgICAgICAgICByZWNpcGllbnQ6IGFsaWNlLmFkZHJlc3MsXG4gICAgICAgICAgICBzbGlwcGFnZVRvbGVyYW5jZTogU0xJUFBBR0UsXG4gICAgICAgICAgICBkZWFkbGluZTogJzM2MCcsXG4gICAgICAgICAgICBhbGdvcml0aG0sXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgYXdhaXQgY2FsbEFuZEV4cGVjdEZhaWwocXVvdGVSZXEsIHtcbiAgICAgICAgICAgIHN0YXR1czogNDAwLFxuICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICBkZXRhaWw6ICdDb3VsZCBub3QgZmluZCB0b2tlbiB3aXRoIGFkZHJlc3MgXCJOT05FWElTVEFOVFRPS0VOXCInLFxuICAgICAgICAgICAgICBlcnJvckNvZGU6ICdUT0tFTl9PVVRfSU5WQUxJRCcsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pXG4gICAgICAgIH0pXG5cbiAgICAgICAgaXQoYHRva2VucyBhcmUgdGhlIHNhbWUgc3ltYm9sYCwgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHF1b3RlUmVxOiBRdW90ZVF1ZXJ5UGFyYW1zID0ge1xuICAgICAgICAgICAgdG9rZW5JbkFkZHJlc3M6ICdVU0RUJyxcbiAgICAgICAgICAgIHRva2VuSW5DaGFpbklkOiAxLFxuICAgICAgICAgICAgdG9rZW5PdXRBZGRyZXNzOiAnVVNEVCcsXG4gICAgICAgICAgICB0b2tlbk91dENoYWluSWQ6IDEsXG4gICAgICAgICAgICBhbW91bnQ6IGF3YWl0IGdldEFtb3VudCgxLCB0eXBlLCAnVVNEQycsICdVU0RUJywgJzEwMCcpLFxuICAgICAgICAgICAgdHlwZSxcbiAgICAgICAgICAgIHJlY2lwaWVudDogYWxpY2UuYWRkcmVzcyxcbiAgICAgICAgICAgIHNsaXBwYWdlVG9sZXJhbmNlOiBTTElQUEFHRSxcbiAgICAgICAgICAgIGRlYWRsaW5lOiAnMzYwJyxcbiAgICAgICAgICAgIGFsZ29yaXRobSxcbiAgICAgICAgICAgIGVuYWJsZVVuaXZlcnNhbFJvdXRlcjogdHJ1ZSxcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBhd2FpdCBjYWxsQW5kRXhwZWN0RmFpbChxdW90ZVJlcSwge1xuICAgICAgICAgICAgc3RhdHVzOiA0MDAsXG4gICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgIGRldGFpbDogJ3Rva2VuSW4gYW5kIHRva2VuT3V0IG11c3QgYmUgZGlmZmVyZW50JyxcbiAgICAgICAgICAgICAgZXJyb3JDb2RlOiAnVE9LRU5fSU5fT1VUX1NBTUUnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9KVxuICAgICAgICB9KVxuXG4gICAgICAgIGl0KGB0b2tlbnMgYXJlIHRoZSBzYW1lIHN5bWJvbCBhbmQgYWRkcmVzc2AsIGFzeW5jICgpID0+IHtcbiAgICAgICAgICBjb25zdCBxdW90ZVJlcTogUXVvdGVRdWVyeVBhcmFtcyA9IHtcbiAgICAgICAgICAgIHRva2VuSW5BZGRyZXNzOiAnVVNEVCcsXG4gICAgICAgICAgICB0b2tlbkluQ2hhaW5JZDogMSxcbiAgICAgICAgICAgIHRva2VuT3V0QWRkcmVzczogJzB4ZEFDMTdGOTU4RDJlZTUyM2EyMjA2MjA2OTk0NTk3QzEzRDgzMWVjNycsXG4gICAgICAgICAgICB0b2tlbk91dENoYWluSWQ6IDEsXG4gICAgICAgICAgICBhbW91bnQ6IGF3YWl0IGdldEFtb3VudCgxLCB0eXBlLCAnVVNEVCcsICdVU0RUJywgJzEwMCcpLFxuICAgICAgICAgICAgdHlwZSxcbiAgICAgICAgICAgIHJlY2lwaWVudDogYWxpY2UuYWRkcmVzcyxcbiAgICAgICAgICAgIHNsaXBwYWdlVG9sZXJhbmNlOiBTTElQUEFHRSxcbiAgICAgICAgICAgIGRlYWRsaW5lOiAnMzYwJyxcbiAgICAgICAgICAgIGFsZ29yaXRobSxcbiAgICAgICAgICAgIGVuYWJsZVVuaXZlcnNhbFJvdXRlcjogdHJ1ZSxcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBhd2FpdCBjYWxsQW5kRXhwZWN0RmFpbChxdW90ZVJlcSwge1xuICAgICAgICAgICAgc3RhdHVzOiA0MDAsXG4gICAgICAgICAgICBkYXRhOiB7XG4gICAgICAgICAgICAgIGRldGFpbDogJ3Rva2VuSW4gYW5kIHRva2VuT3V0IG11c3QgYmUgZGlmZmVyZW50JyxcbiAgICAgICAgICAgICAgZXJyb3JDb2RlOiAnVE9LRU5fSU5fT1VUX1NBTUUnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9KVxuICAgICAgICB9KVxuXG4gICAgICAgIGl0KGB0b2tlbnMgYXJlIHRoZSBzYW1lIGFkZHJlc3NgLCBhc3luYyAoKSA9PiB7XG4gICAgICAgICAgY29uc3QgcXVvdGVSZXE6IFF1b3RlUXVlcnlQYXJhbXMgPSB7XG4gICAgICAgICAgICB0b2tlbkluQWRkcmVzczogJzB4ZEFDMTdGOTU4RDJlZTUyM2EyMjA2MjA2OTk0NTk3QzEzRDgzMWVjNycsXG4gICAgICAgICAgICB0b2tlbkluQ2hhaW5JZDogMSxcbiAgICAgICAgICAgIHRva2VuT3V0QWRkcmVzczogJzB4ZEFDMTdGOTU4RDJlZTUyM2EyMjA2MjA2OTk0NTk3QzEzRDgzMWVjNycsXG4gICAgICAgICAgICB0b2tlbk91dENoYWluSWQ6IDEsXG4gICAgICAgICAgICBhbW91bnQ6IGF3YWl0IGdldEFtb3VudCgxLCB0eXBlLCAnVVNEVCcsICdVU0RUJywgJzEwMCcpLFxuICAgICAgICAgICAgdHlwZSxcbiAgICAgICAgICAgIHJlY2lwaWVudDogYWxpY2UuYWRkcmVzcyxcbiAgICAgICAgICAgIHNsaXBwYWdlVG9sZXJhbmNlOiBTTElQUEFHRSxcbiAgICAgICAgICAgIGRlYWRsaW5lOiAnMzYwJyxcbiAgICAgICAgICAgIGFsZ29yaXRobSxcbiAgICAgICAgICAgIGVuYWJsZVVuaXZlcnNhbFJvdXRlcjogdHJ1ZSxcbiAgICAgICAgICB9XG4gICAgICAgICAgYXdhaXQgY2FsbEFuZEV4cGVjdEZhaWwocXVvdGVSZXEsIHtcbiAgICAgICAgICAgIHN0YXR1czogNDAwLFxuICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICBkZXRhaWw6ICd0b2tlbkluIGFuZCB0b2tlbk91dCBtdXN0IGJlIGRpZmZlcmVudCcsXG4gICAgICAgICAgICAgIGVycm9yQ29kZTogJ1RPS0VOX0lOX09VVF9TQU1FJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSlcbiAgICAgICAgfSlcblxuICAgICAgICBpdChgb25lIG9mIHJlY2lwaWVudC9kZWFkbGluZS9zbGlwcGFnZSBpcyBtaXNzaW5nYCwgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHF1b3RlUmVxOiBRdW90ZVF1ZXJ5UGFyYW1zID0ge1xuICAgICAgICAgICAgdG9rZW5JbkFkZHJlc3M6ICdVU0RDJyxcbiAgICAgICAgICAgIHRva2VuSW5DaGFpbklkOiAxLFxuICAgICAgICAgICAgdG9rZW5PdXRBZGRyZXNzOiAnVVNEVCcsXG4gICAgICAgICAgICB0b2tlbk91dENoYWluSWQ6IDEsXG4gICAgICAgICAgICBhbW91bnQ6IGF3YWl0IGdldEFtb3VudCgxLCB0eXBlLCAnVVNEQycsICdVU0RUJywgJzEwMCcpLFxuICAgICAgICAgICAgdHlwZSxcbiAgICAgICAgICAgIHNsaXBwYWdlVG9sZXJhbmNlOiBTTElQUEFHRSxcbiAgICAgICAgICAgIGRlYWRsaW5lOiAnMzYwJyxcbiAgICAgICAgICAgIGFsZ29yaXRobSxcbiAgICAgICAgICAgIGVuYWJsZVVuaXZlcnNhbFJvdXRlcjogdHJ1ZSxcbiAgICAgICAgICB9XG4gICAgICAgICAgYXdhaXQgY2FsbEFuZEV4cGVjdEZhaWwocXVvdGVSZXEsIHtcbiAgICAgICAgICAgIHN0YXR1czogNDAwLFxuICAgICAgICAgICAgZGF0YToge1xuICAgICAgICAgICAgICBkZXRhaWw6ICdcInZhbHVlXCIgY29udGFpbnMgW3NsaXBwYWdlVG9sZXJhbmNlLCBkZWFkbGluZV0gd2l0aG91dCBpdHMgcmVxdWlyZWQgcGVlcnMgW3JlY2lwaWVudF0nLFxuICAgICAgICAgICAgICBlcnJvckNvZGU6ICdWQUxJREFUSU9OX0VSUk9SJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSlcbiAgICAgICAgfSlcblxuICAgICAgICBpdChgcmVjaXBpZW50IGlzIGFuIGludmFsaWQgYWRkcmVzc2AsIGFzeW5jICgpID0+IHtcbiAgICAgICAgICBjb25zdCBxdW90ZVJlcTogUXVvdGVRdWVyeVBhcmFtcyA9IHtcbiAgICAgICAgICAgIHRva2VuSW5BZGRyZXNzOiAnVVNEVCcsXG4gICAgICAgICAgICB0b2tlbkluQ2hhaW5JZDogMSxcbiAgICAgICAgICAgIHRva2VuT3V0QWRkcmVzczogJ1VTREMnLFxuICAgICAgICAgICAgdG9rZW5PdXRDaGFpbklkOiAxLFxuICAgICAgICAgICAgYW1vdW50OiBhd2FpdCBnZXRBbW91bnQoMSwgdHlwZSwgJ1VTRFQnLCAnVVNEQycsICcxMDAnKSxcbiAgICAgICAgICAgIHR5cGUsXG4gICAgICAgICAgICByZWNpcGllbnQ6ICcweEFiNTgwMWE3RDM5ODM1MWI4YkUxMUM0MzllMDVDNUIzMjU5YVpaWlpaWlonLFxuICAgICAgICAgICAgc2xpcHBhZ2VUb2xlcmFuY2U6IFNMSVBQQUdFLFxuICAgICAgICAgICAgZGVhZGxpbmU6ICczNjAnLFxuICAgICAgICAgICAgYWxnb3JpdGhtLFxuICAgICAgICAgICAgZW5hYmxlVW5pdmVyc2FsUm91dGVyOiB0cnVlLFxuICAgICAgICAgIH1cblxuICAgICAgICAgIGF3YWl0IGNhbGxBbmRFeHBlY3RGYWlsKHF1b3RlUmVxLCB7XG4gICAgICAgICAgICBzdGF0dXM6IDQwMCxcbiAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgZGV0YWlsOlxuICAgICAgICAgICAgICAgICdcInJlY2lwaWVudFwiIHdpdGggdmFsdWUgXCIweEFiNTgwMWE3RDM5ODM1MWI4YkUxMUM0MzllMDVDNUIzMjU5YVpaWlpaWlpcIiBmYWlscyB0byBtYXRjaCB0aGUgcmVxdWlyZWQgcGF0dGVybjogL14weFthLWZBLUYwLTldezQwfSQvJyxcbiAgICAgICAgICAgICAgZXJyb3JDb2RlOiAnVkFMSURBVElPTl9FUlJPUicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0pXG4gICAgICAgIH0pXG5cbiAgICAgICAgaXQoYHVuc3VwcG9ydGVkIGNoYWluYCwgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHF1b3RlUmVxOiBRdW90ZVF1ZXJ5UGFyYW1zID0ge1xuICAgICAgICAgICAgdG9rZW5JbkFkZHJlc3M6ICdVU0RDJyxcbiAgICAgICAgICAgIHRva2VuSW5DaGFpbklkOiA3MCxcbiAgICAgICAgICAgIHRva2VuT3V0QWRkcmVzczogJ1VTRFQnLFxuICAgICAgICAgICAgdG9rZW5PdXRDaGFpbklkOiA3MCxcbiAgICAgICAgICAgIGFtb3VudDogJzEwMDAwMDAwMDAwJyxcbiAgICAgICAgICAgIHR5cGUsXG4gICAgICAgICAgICByZWNpcGllbnQ6IGFsaWNlLmFkZHJlc3MsXG4gICAgICAgICAgICBzbGlwcGFnZVRvbGVyYW5jZTogU0xJUFBBR0UsXG4gICAgICAgICAgICBkZWFkbGluZTogJzM2MCcsXG4gICAgICAgICAgICBhbGdvcml0aG0sXG4gICAgICAgICAgICBlbmFibGVVbml2ZXJzYWxSb3V0ZXI6IHRydWUsXG4gICAgICAgICAgfVxuXG4gICAgICAgICAgY29uc3QgY2hhaW5zID0gU1VQUE9SVEVEX0NIQUlOUy52YWx1ZXMoKVxuICAgICAgICAgIGNvbnN0IGNoYWluU3RyID0gWy4uLmNoYWluc10udG9TdHJpbmcoKS5zcGxpdCgnLCcpLmpvaW4oJywgJylcblxuICAgICAgICAgIGF3YWl0IGNhbGxBbmRFeHBlY3RGYWlsKHF1b3RlUmVxLCB7XG4gICAgICAgICAgICBzdGF0dXM6IDQwMCxcbiAgICAgICAgICAgIGRhdGE6IHtcbiAgICAgICAgICAgICAgZGV0YWlsOiBgXCJ0b2tlbkluQ2hhaW5JZFwiIG11c3QgYmUgb25lIG9mIFske2NoYWluU3RyfV1gLFxuICAgICAgICAgICAgICBlcnJvckNvZGU6ICdWQUxJREFUSU9OX0VSUk9SJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSlcbiAgICAgICAgfSlcbiAgICAgIH0pXG4gICAgfVxuICB9XG5cbiAgY29uc3QgVEVTVF9FUkMyMF8xOiB7IFtjaGFpbklkIGluIENoYWluSWRdOiBudWxsIHwgVG9rZW4gfSA9IHtcbiAgICBbQ2hhaW5JZC5NQUlOTkVUXTogVVNEQ19PTigxKSxcbiAgICBbQ2hhaW5JZC5HT0VSTEldOiBVU0RDX09OKENoYWluSWQuR09FUkxJKSxcbiAgICBbQ2hhaW5JZC5TRVBPTElBXTogVVNEQ19PTihDaGFpbklkLlNFUE9MSUEpLFxuICAgIFtDaGFpbklkLk9QVElNSVNNXTogVVNEQ19PTihDaGFpbklkLk9QVElNSVNNKSxcbiAgICBbQ2hhaW5JZC5PUFRJTUlTTV9HT0VSTEldOiBVU0RDX09OKENoYWluSWQuT1BUSU1JU01fR09FUkxJKSxcbiAgICBbQ2hhaW5JZC5BUkJJVFJVTV9PTkVdOiBVU0RDX09OKENoYWluSWQuQVJCSVRSVU1fT05FKSxcbiAgICBbQ2hhaW5JZC5QT0xZR09OXTogVVNEQ19PTihDaGFpbklkLlBPTFlHT04pLFxuICAgIFtDaGFpbklkLlBPTFlHT05fTVVNQkFJXTogVVNEQ19PTihDaGFpbklkLlBPTFlHT05fTVVNQkFJKSxcbiAgICBbQ2hhaW5JZC5DRUxPXTogQ1VTRF9DRUxPLFxuICAgIFtDaGFpbklkLkNFTE9fQUxGQUpPUkVTXTogQ1VTRF9DRUxPX0FMRkFKT1JFUyxcbiAgICBbQ2hhaW5JZC5NT09OQkVBTV06IG51bGwsXG4gICAgW0NoYWluSWQuR05PU0lTXTogbnVsbCxcbiAgICBbQ2hhaW5JZC5BUkJJVFJVTV9HT0VSTEldOiBudWxsLFxuICAgIFtDaGFpbklkLkJOQl06IFVTRENfT04oQ2hhaW5JZC5CTkIpLFxuICAgIFtDaGFpbklkLkFWQUxBTkNIRV06IFVTRENfT04oQ2hhaW5JZC5BVkFMQU5DSEUpLFxuICAgIFtDaGFpbklkLkJBU0VfR09FUkxJXTogbnVsbCxcbiAgICBbQ2hhaW5JZC5CQVNFXTogbnVsbFxuICB9XG5cbiAgY29uc3QgVEVTVF9FUkMyMF8yOiB7IFtjaGFpbklkIGluIENoYWluSWRdOiBUb2tlbiB8IG51bGwgfSA9IHtcbiAgICBbQ2hhaW5JZC5NQUlOTkVUXTogREFJX09OKDEpLFxuICAgIFtDaGFpbklkLkdPRVJMSV06IERBSV9PTihDaGFpbklkLkdPRVJMSSksXG4gICAgW0NoYWluSWQuU0VQT0xJQV06IERBSV9PTihDaGFpbklkLlNFUE9MSUEpLFxuICAgIFtDaGFpbklkLk9QVElNSVNNXTogREFJX09OKENoYWluSWQuT1BUSU1JU00pLFxuICAgIFtDaGFpbklkLk9QVElNSVNNX0dPRVJMSV06IERBSV9PTihDaGFpbklkLk9QVElNSVNNX0dPRVJMSSksXG4gICAgW0NoYWluSWQuQVJCSVRSVU1fT05FXTogREFJX09OKENoYWluSWQuQVJCSVRSVU1fT05FKSxcbiAgICBbQ2hhaW5JZC5QT0xZR09OXTogREFJX09OKENoYWluSWQuUE9MWUdPTiksXG4gICAgW0NoYWluSWQuUE9MWUdPTl9NVU1CQUldOiBEQUlfT04oQ2hhaW5JZC5QT0xZR09OX01VTUJBSSksXG4gICAgW0NoYWluSWQuQ0VMT106IENFVVJfQ0VMTyxcbiAgICBbQ2hhaW5JZC5DRUxPX0FMRkFKT1JFU106IENFVVJfQ0VMT19BTEZBSk9SRVMsXG4gICAgW0NoYWluSWQuTU9PTkJFQU1dOiBudWxsLFxuICAgIFtDaGFpbklkLkdOT1NJU106IG51bGwsXG4gICAgW0NoYWluSWQuQVJCSVRSVU1fR09FUkxJXTogbnVsbCxcbiAgICBbQ2hhaW5JZC5CTkJdOiBVU0RUX09OKENoYWluSWQuQk5CKSxcbiAgICBbQ2hhaW5JZC5BVkFMQU5DSEVdOiBEQUlfT04oQ2hhaW5JZC5BVkFMQU5DSEUpLFxuICAgIFtDaGFpbklkLkJBU0VfR09FUkxJXTogbnVsbCxcbiAgICBbQ2hhaW5JZC5CQVNFXTogbnVsbFxuICB9XG5cbiAgLy8gVE9ETzogRmluZCB2YWxpZCBwb29scy90b2tlbnMgb24gb3B0aW1pc3RpYyBrb3ZhbiBhbmQgcG9seWdvbiBtdW1iYWkuIFdlIHNraXAgdGhvc2UgdGVzdHMgZm9yIG5vdy5cbiAgZm9yIChjb25zdCBjaGFpbiBvZiBfLmZpbHRlcihcbiAgICBTVVBQT1JURURfQ0hBSU5TLFxuICAgIChjKSA9PlxuICAgICAgYyAhPSBDaGFpbklkLlBPTFlHT05fTVVNQkFJICYmXG4gICAgICBjICE9IENoYWluSWQuQVJCSVRSVU1fR09FUkxJICYmXG4gICAgICBjICE9IENoYWluSWQuQ0VMT19BTEZBSk9SRVMgJiZcbiAgICAgIGMgIT0gQ2hhaW5JZC5HT0VSTEkgJiZcbiAgICAgIGMgIT0gQ2hhaW5JZC5TRVBPTElBXG4gICkpIHtcbiAgICBmb3IgKGNvbnN0IHR5cGUgb2YgWydleGFjdEluJywgJ2V4YWN0T3V0J10pIHtcbiAgICAgIGNvbnN0IGVyYzEgPSBURVNUX0VSQzIwXzFbY2hhaW5dXG4gICAgICBjb25zdCBlcmMyID0gVEVTVF9FUkMyMF8yW2NoYWluXVxuXG4gICAgICAvLyBUaGlzIGlzIGZvciBHbm9zaXMgYW5kIE1vb25iZWFtIHdoaWNoIHdlIGRvbid0IGhhdmUgUlBDIFByb3ZpZGVycyB5ZXRcbiAgICAgIGlmIChlcmMxID09IG51bGwgfHwgZXJjMiA9PSBudWxsKSBjb250aW51ZVxuXG4gICAgICBkZXNjcmliZShgJHtJRF9UT19ORVRXT1JLX05BTUUoY2hhaW4pfSAke3R5cGV9IDJ4eGAsIGZ1bmN0aW9uICgpIHtcbiAgICAgICAgLy8gSGVscCB3aXRoIHRlc3QgZmxha2luZXNzIGJ5IHJldHJ5aW5nLlxuICAgICAgICB0aGlzLnJldHJpZXMoMClcbiAgICAgICAgY29uc3Qgd3JhcHBlZE5hdGl2ZSA9IFdOQVRJVkVfT04oY2hhaW4pXG5cbiAgICAgICAgaXQoYCR7d3JhcHBlZE5hdGl2ZS5zeW1ib2x9IC0+IGVyYzIwYCwgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHF1b3RlUmVxOiBRdW90ZVF1ZXJ5UGFyYW1zID0ge1xuICAgICAgICAgICAgdG9rZW5JbkFkZHJlc3M6IHdyYXBwZWROYXRpdmUuYWRkcmVzcyxcbiAgICAgICAgICAgIHRva2VuSW5DaGFpbklkOiBjaGFpbixcbiAgICAgICAgICAgIHRva2VuT3V0QWRkcmVzczogZXJjMS5hZGRyZXNzLFxuICAgICAgICAgICAgdG9rZW5PdXRDaGFpbklkOiBjaGFpbixcbiAgICAgICAgICAgIGFtb3VudDogYXdhaXQgZ2V0QW1vdW50RnJvbVRva2VuKHR5cGUsIHdyYXBwZWROYXRpdmUsIGVyYzEsICcxJyksXG4gICAgICAgICAgICB0eXBlLFxuICAgICAgICAgICAgZW5hYmxlVW5pdmVyc2FsUm91dGVyOiB0cnVlLFxuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IHF1ZXJ5UGFyYW1zID0gcXMuc3RyaW5naWZ5KHF1b3RlUmVxKVxuXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlOiBBeGlvc1Jlc3BvbnNlPFF1b3RlUmVzcG9uc2U+ID0gYXdhaXQgYXhpb3MuZ2V0PFF1b3RlUmVzcG9uc2U+KGAke0FQSX0/JHtxdWVyeVBhcmFtc31gKVxuICAgICAgICAgICAgY29uc3QgeyBzdGF0dXMgfSA9IHJlc3BvbnNlXG5cbiAgICAgICAgICAgIGV4cGVjdChzdGF0dXMpLnRvLmVxdWFsKDIwMClcbiAgICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgZmFpbChKU09OLnN0cmluZ2lmeShlcnIucmVzcG9uc2UuZGF0YSkpXG4gICAgICAgICAgfVxuICAgICAgICB9KVxuXG4gICAgICAgIGl0KGBlcmMyMCAtPiBlcmMyMGAsIGFzeW5jICgpID0+IHtcbiAgICAgICAgICBjb25zdCBxdW90ZVJlcTogUXVvdGVRdWVyeVBhcmFtcyA9IHtcbiAgICAgICAgICAgIHRva2VuSW5BZGRyZXNzOiBlcmMxLmFkZHJlc3MsXG4gICAgICAgICAgICB0b2tlbkluQ2hhaW5JZDogY2hhaW4sXG4gICAgICAgICAgICB0b2tlbk91dEFkZHJlc3M6IGVyYzIuYWRkcmVzcyxcbiAgICAgICAgICAgIHRva2VuT3V0Q2hhaW5JZDogY2hhaW4sXG4gICAgICAgICAgICBhbW91bnQ6IGF3YWl0IGdldEFtb3VudEZyb21Ub2tlbih0eXBlLCBlcmMxLCBlcmMyLCAnMScpLFxuICAgICAgICAgICAgdHlwZSxcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBxdWVyeVBhcmFtcyA9IHFzLnN0cmluZ2lmeShxdW90ZVJlcSlcblxuICAgICAgICAgIHRyeSB7XG4gICAgICAgICAgICBjb25zdCByZXNwb25zZTogQXhpb3NSZXNwb25zZTxRdW90ZVJlc3BvbnNlPiA9IGF3YWl0IGF4aW9zLmdldDxRdW90ZVJlc3BvbnNlPihgJHtBUEl9PyR7cXVlcnlQYXJhbXN9YClcbiAgICAgICAgICAgIGNvbnN0IHsgc3RhdHVzIH0gPSByZXNwb25zZVxuXG4gICAgICAgICAgICBleHBlY3Qoc3RhdHVzKS50by5lcXVhbCgyMDApXG4gICAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIGZhaWwoSlNPTi5zdHJpbmdpZnkoZXJyLnJlc3BvbnNlLmRhdGEpKVxuICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgICAgY29uc3QgbmF0aXZlID0gTkFUSVZFX0NVUlJFTkNZW2NoYWluXVxuICAgICAgICBpdChgJHtuYXRpdmV9IC0+IGVyYzIwYCwgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHF1b3RlUmVxOiBRdW90ZVF1ZXJ5UGFyYW1zID0ge1xuICAgICAgICAgICAgdG9rZW5JbkFkZHJlc3M6IG5hdGl2ZSxcbiAgICAgICAgICAgIHRva2VuSW5DaGFpbklkOiBjaGFpbixcbiAgICAgICAgICAgIHRva2VuT3V0QWRkcmVzczogZXJjMi5hZGRyZXNzLFxuICAgICAgICAgICAgdG9rZW5PdXRDaGFpbklkOiBjaGFpbixcbiAgICAgICAgICAgIGFtb3VudDogYXdhaXQgZ2V0QW1vdW50RnJvbVRva2VuKHR5cGUsIFdOQVRJVkVfT04oY2hhaW4pLCBlcmMyLCAnMScpLFxuICAgICAgICAgICAgdHlwZSxcbiAgICAgICAgICAgIGVuYWJsZVVuaXZlcnNhbFJvdXRlcjogdHJ1ZSxcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBxdWVyeVBhcmFtcyA9IHFzLnN0cmluZ2lmeShxdW90ZVJlcSlcbiAgICAgICAgICB0cnkge1xuICAgICAgICAgICAgY29uc3QgcmVzcG9uc2U6IEF4aW9zUmVzcG9uc2U8UXVvdGVSZXNwb25zZT4gPSBhd2FpdCBheGlvcy5nZXQ8UXVvdGVSZXNwb25zZT4oYCR7QVBJfT8ke3F1ZXJ5UGFyYW1zfWApXG4gICAgICAgICAgICBjb25zdCB7IHN0YXR1cyB9ID0gcmVzcG9uc2VcblxuICAgICAgICAgICAgZXhwZWN0KHN0YXR1cykudG8uZXF1YWwoMjAwLCBKU09OLnN0cmluZ2lmeShyZXNwb25zZS5kYXRhKSlcbiAgICAgICAgICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgICAgICAgICAgZmFpbChKU09OLnN0cmluZ2lmeShlcnIucmVzcG9uc2UuZGF0YSkpXG4gICAgICAgICAgfVxuICAgICAgICB9KVxuICAgICAgICBpdChgaGFzIHF1b3RlR2FzQWRqdXN0ZWQgdmFsdWVzYCwgYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHF1b3RlUmVxOiBRdW90ZVF1ZXJ5UGFyYW1zID0ge1xuICAgICAgICAgICAgdG9rZW5JbkFkZHJlc3M6IGVyYzEuYWRkcmVzcyxcbiAgICAgICAgICAgIHRva2VuSW5DaGFpbklkOiBjaGFpbixcbiAgICAgICAgICAgIHRva2VuT3V0QWRkcmVzczogZXJjMi5hZGRyZXNzLFxuICAgICAgICAgICAgdG9rZW5PdXRDaGFpbklkOiBjaGFpbixcbiAgICAgICAgICAgIGFtb3VudDogYXdhaXQgZ2V0QW1vdW50RnJvbVRva2VuKHR5cGUsIGVyYzEsIGVyYzIsICcxJyksXG4gICAgICAgICAgICB0eXBlLFxuICAgICAgICAgIH1cblxuICAgICAgICAgIGNvbnN0IHF1ZXJ5UGFyYW1zID0gcXMuc3RyaW5naWZ5KHF1b3RlUmVxKVxuXG4gICAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGNvbnN0IHJlc3BvbnNlOiBBeGlvc1Jlc3BvbnNlPFF1b3RlUmVzcG9uc2U+ID0gYXdhaXQgYXhpb3MuZ2V0PFF1b3RlUmVzcG9uc2U+KGAke0FQSX0/JHtxdWVyeVBhcmFtc31gKVxuICAgICAgICAgICAgY29uc3Qge1xuICAgICAgICAgICAgICBkYXRhOiB7IHF1b3RlRGVjaW1hbHMsIHF1b3RlR2FzQWRqdXN0ZWREZWNpbWFscyB9LFxuICAgICAgICAgICAgICBzdGF0dXMsXG4gICAgICAgICAgICB9ID0gcmVzcG9uc2VcblxuICAgICAgICAgICAgZXhwZWN0KHN0YXR1cykudG8uZXF1YWwoMjAwKVxuXG4gICAgICAgICAgICAvLyBjaGVjayBmb3IgcXVvdGVzIHRvIGJlIGdhcyBhZGp1c3RlZFxuICAgICAgICAgICAgaWYgKHR5cGUgPT0gJ2V4YWN0SW4nKSB7XG4gICAgICAgICAgICAgIGV4cGVjdChwYXJzZUZsb2F0KHF1b3RlR2FzQWRqdXN0ZWREZWNpbWFscykpLnRvLmJlLmxlc3NUaGFuT3JFcXVhbChwYXJzZUZsb2F0KHF1b3RlRGVjaW1hbHMpKVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgZXhwZWN0KHBhcnNlRmxvYXQocXVvdGVHYXNBZGp1c3RlZERlY2ltYWxzKSkudG8uYmUuZ3JlYXRlclRoYW5PckVxdWFsKHBhcnNlRmxvYXQocXVvdGVEZWNpbWFscykpXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSBjYXRjaCAoZXJyOiBhbnkpIHtcbiAgICAgICAgICAgIGZhaWwoSlNPTi5zdHJpbmdpZnkoZXJyLnJlc3BvbnNlLmRhdGEpKVxuICAgICAgICAgIH1cbiAgICAgICAgfSlcbiAgICAgIH0pXG4gICAgfVxuICB9XG59KVxuXG5kZXNjcmliZSgnYWxwaGEgb25seSBxdW90ZScsIGZ1bmN0aW9uICgpIHtcbiAgdGhpcy50aW1lb3V0KDUwMDApXG5cbiAgZm9yIChjb25zdCB0eXBlIG9mIFsnZXhhY3RJbicsICdleGFjdE91dCddKSB7XG4gICAgZGVzY3JpYmUoYCR7dHlwZX0gMnh4YCwgKCkgPT4ge30pXG4gIH1cbn0pXG4iXX0=