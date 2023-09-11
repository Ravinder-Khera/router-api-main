import { Protocol } from '@uniswap/router-sdk';
import { UNIVERSAL_ROUTER_ADDRESS } from '@uniswap/universal-router-sdk';
import { CurrencyAmount, TradeType } from '@uniswap/sdk-core';
import { MetricLoggerUnit, routeAmountsToString, SwapType, SimulationStatus, ID_TO_NETWORK_NAME, } from '@uniswap/smart-order-router';
import { Pool } from '@uniswap/v3-sdk';
import JSBI from 'jsbi';
import _ from 'lodash';
import { APIGLambdaHandler } from '../handler';
import { QuoteResponseSchemaJoi } from '../schema';
import { DEFAULT_ROUTING_CONFIG_BY_CHAIN, parseDeadline, parseSlippageTolerance, tokenStringToCurrency, } from '../shared';
import { QuoteQueryParamsJoi } from './schema/quote-schema';
import { utils } from 'ethers';
import { simulationStatusToString } from './util/simulation';
import { PAIRS_TO_TRACK } from './util/pairs-to-track';
export class QuoteHandler extends APIGLambdaHandler {
    async handleRequest(params) {
        const { chainId, metric, log } = params.requestInjected;
        const startTime = Date.now();
        let result;
        try {
            result = await this.handleRequestInternal(params);
            switch (result.statusCode) {
                case 200:
                case 202:
                    metric.putMetric(`GET_QUOTE_200_CHAINID: ${chainId}`, 1, MetricLoggerUnit.Count);
                    break;
                case 400:
                case 403:
                case 404:
                case 408:
                case 409:
                    metric.putMetric(`GET_QUOTE_400_CHAINID: ${chainId}`, 1, MetricLoggerUnit.Count);
                    log.error({
                        statusCode: result === null || result === void 0 ? void 0 : result.statusCode,
                        errorCode: result === null || result === void 0 ? void 0 : result.errorCode,
                        detail: result === null || result === void 0 ? void 0 : result.detail,
                    }, `Quote 4XX Error [${result === null || result === void 0 ? void 0 : result.statusCode}] on ${ID_TO_NETWORK_NAME(chainId)} with errorCode '${result === null || result === void 0 ? void 0 : result.errorCode}': ${result === null || result === void 0 ? void 0 : result.detail}`);
                    break;
                case 500:
                    metric.putMetric(`GET_QUOTE_500_CHAINID: ${chainId}`, 1, MetricLoggerUnit.Count);
                    break;
            }
        }
        catch (err) {
            metric.putMetric(`GET_QUOTE_500_CHAINID: ${chainId}`, 1, MetricLoggerUnit.Count);
            throw err;
        }
        finally {
            // This metric is logged after calling the internal handler to correlate with the status metrics
            metric.putMetric(`GET_QUOTE_REQUESTED_CHAINID: ${chainId}`, 1, MetricLoggerUnit.Count);
            metric.putMetric(`GET_QUOTE_LATENCY_CHAIN_${chainId}`, Date.now() - startTime, MetricLoggerUnit.Milliseconds);
        }
        return result;
    }
    async handleRequestInternal(params) {
        const { requestQueryParams: { tokenInAddress, tokenInChainId, tokenOutAddress, tokenOutChainId, amount: amountRaw, type, recipient, slippageTolerance, deadline, minSplits, forceCrossProtocol, forceMixedRoutes, protocols: protocolsStr, simulateFromAddress, permitSignature, permitNonce, permitExpiration, permitAmount, permitSigDeadline, enableUniversalRouter, }, requestInjected: { router, log, id: quoteId, chainId, tokenProvider, tokenListProvider, v3PoolProvider: v3PoolProvider, v2PoolProvider: v2PoolProvider, metric, }, } = params;
        // Parse user provided token address/symbol to Currency object.
        let before = Date.now();
        const startTime = Date.now();
        const currencyIn = await tokenStringToCurrency(tokenListProvider, tokenProvider, tokenInAddress, tokenInChainId, log);
        const currencyOut = await tokenStringToCurrency(tokenListProvider, tokenProvider, tokenOutAddress, tokenOutChainId, log);
        metric.putMetric('TokenInOutStrToToken', Date.now() - before, MetricLoggerUnit.Milliseconds);
        if (!currencyIn) {
            return {
                statusCode: 400,
                errorCode: 'TOKEN_IN_INVALID',
                detail: `Could not find token with address "${tokenInAddress}"`,
            };
        }
        if (!currencyOut) {
            return {
                statusCode: 400,
                errorCode: 'TOKEN_OUT_INVALID',
                detail: `Could not find token with address "${tokenOutAddress}"`,
            };
        }
        if (tokenInChainId != tokenOutChainId) {
            return {
                statusCode: 400,
                errorCode: 'TOKEN_CHAINS_DIFFERENT',
                detail: `Cannot request quotes for tokens on different chains`,
            };
        }
        if (currencyIn.equals(currencyOut)) {
            return {
                statusCode: 400,
                errorCode: 'TOKEN_IN_OUT_SAME',
                detail: `tokenIn and tokenOut must be different`,
            };
        }
        let protocols = [];
        if (protocolsStr) {
            for (const protocolStr of protocolsStr) {
                switch (protocolStr.toLowerCase()) {
                    case 'v2':
                        protocols.push(Protocol.V2);
                        break;
                    case 'v3':
                        protocols.push(Protocol.V3);
                        break;
                    case 'mixed':
                        protocols.push(Protocol.MIXED);
                        break;
                    default:
                        return {
                            statusCode: 400,
                            errorCode: 'INVALID_PROTOCOL',
                            detail: `Invalid protocol specified. Supported protocols: ${JSON.stringify(Object.values(Protocol))}`,
                        };
                }
            }
        }
        else if (!forceCrossProtocol) {
            protocols = [Protocol.V3];
        }
        const routingConfig = {
            ...DEFAULT_ROUTING_CONFIG_BY_CHAIN(chainId),
            ...(minSplits ? { minSplits } : {}),
            ...(forceCrossProtocol ? { forceCrossProtocol } : {}),
            ...(forceMixedRoutes ? { forceMixedRoutes } : {}),
            protocols,
        };
        let swapParams = undefined;
        // e.g. Inputs of form "1.25%" with 2dp max. Convert to fractional representation => 1.25 => 125 / 10000
        if (slippageTolerance && deadline && recipient) {
            const slippageTolerancePercent = parseSlippageTolerance(slippageTolerance);
            // TODO: Remove once universal router is no longer behind a feature flag.
            if (enableUniversalRouter) {
                swapParams = {
                    type: SwapType.UNIVERSAL_ROUTER,
                    deadlineOrPreviousBlockhash: parseDeadline(deadline),
                    recipient: recipient,
                    slippageTolerance: slippageTolerancePercent,
                };
            }
            else {
                swapParams = {
                    type: SwapType.SWAP_ROUTER_02,
                    deadline: parseDeadline(deadline),
                    recipient: recipient,
                    slippageTolerance: slippageTolerancePercent,
                };
            }
            if (enableUniversalRouter &&
                permitSignature &&
                permitNonce &&
                permitExpiration &&
                permitAmount &&
                permitSigDeadline) {
                const permit = {
                    details: {
                        token: currencyIn.wrapped.address,
                        amount: permitAmount,
                        expiration: permitExpiration,
                        nonce: permitNonce,
                    },
                    spender: UNIVERSAL_ROUTER_ADDRESS(chainId),
                    sigDeadline: permitSigDeadline,
                };
                swapParams.inputTokenPermit = {
                    ...permit,
                    signature: permitSignature,
                };
            }
            else if (!enableUniversalRouter &&
                permitSignature &&
                ((permitNonce && permitExpiration) || (permitAmount && permitSigDeadline))) {
                const { v, r, s } = utils.splitSignature(permitSignature);
                swapParams.inputTokenPermit = {
                    v: v,
                    r,
                    s,
                    ...(permitNonce && permitExpiration
                        ? { nonce: permitNonce, expiry: permitExpiration }
                        : { amount: permitAmount, deadline: permitSigDeadline }),
                };
            }
            if (simulateFromAddress) {
                metric.putMetric('Simulation Requested', 1, MetricLoggerUnit.Count);
                swapParams.simulate = { fromAddress: simulateFromAddress };
            }
        }
        before = Date.now();
        let swapRoute;
        let amount;
        let tokenPairSymbol = '';
        let tokenPairSymbolChain = '';
        if (currencyIn.symbol && currencyOut.symbol) {
            tokenPairSymbol = _([currencyIn.symbol, currencyOut.symbol]).join('/');
            tokenPairSymbolChain = `${tokenPairSymbol}/${chainId}`;
        }
        const [token0Symbol, token0Address, token1Symbol, token1Address] = currencyIn.wrapped.sortsBefore(currencyOut.wrapped)
            ? [currencyIn.symbol, currencyIn.wrapped.address, currencyOut.symbol, currencyOut.wrapped.address]
            : [currencyOut.symbol, currencyOut.wrapped.address, currencyIn.symbol, currencyIn.wrapped.address];
        switch (type) {
            case 'exactIn':
                amount = CurrencyAmount.fromRawAmount(currencyIn, JSBI.BigInt(amountRaw));
                log.info({
                    amountIn: amount.toExact(),
                    token0Address,
                    token1Address,
                    token0Symbol,
                    token1Symbol,
                    tokenInSymbol: currencyIn.symbol,
                    tokenOutSymbol: currencyOut.symbol,
                    tokenPairSymbol,
                    tokenPairSymbolChain,
                    type,
                    routingConfig: routingConfig,
                    swapParams,
                }, `Exact In Swap: Give ${amount.toExact()} ${amount.currency.symbol}, Want: ${currencyOut.symbol}. Chain: ${chainId}`);
                swapRoute = await router.route(amount, currencyOut, TradeType.EXACT_INPUT, swapParams, routingConfig);
                break;
            case 'exactOut':
                amount = CurrencyAmount.fromRawAmount(currencyOut, JSBI.BigInt(amountRaw));
                log.info({
                    amountOut: amount.toExact(),
                    token0Address,
                    token1Address,
                    token0Symbol,
                    token1Symbol,
                    tokenInSymbol: currencyIn.symbol,
                    tokenOutSymbol: currencyOut.symbol,
                    tokenPairSymbol,
                    tokenPairSymbolChain,
                    type,
                    routingConfig: routingConfig,
                    swapParams,
                }, `Exact Out Swap: Want ${amount.toExact()} ${amount.currency.symbol} Give: ${currencyIn.symbol}. Chain: ${chainId}`);
                swapRoute = await router.route(amount, currencyIn, TradeType.EXACT_OUTPUT, swapParams, routingConfig);
                break;
            default:
                throw new Error('Invalid swap type');
        }
        if (!swapRoute) {
            log.info({
                type,
                tokenIn: currencyIn,
                tokenOut: currencyOut,
                amount: amount.quotient.toString(),
            }, `No route found. 404`);
            return {
                statusCode: 404,
                errorCode: 'NO_ROUTE',
                detail: 'No route found',
            };
        }
        const { quote, quoteGasAdjusted, route, estimatedGasUsed, estimatedGasUsedQuoteToken, estimatedGasUsedUSD, gasPriceWei, methodParameters, blockNumber, simulationStatus, } = swapRoute;
        if (simulationStatus == SimulationStatus.Failed) {
            metric.putMetric('SimulationFailed', 1, MetricLoggerUnit.Count);
        }
        else if (simulationStatus == SimulationStatus.Succeeded) {
            metric.putMetric('SimulationSuccessful', 1, MetricLoggerUnit.Count);
        }
        else if (simulationStatus == SimulationStatus.InsufficientBalance) {
            metric.putMetric('SimulationInsufficientBalance', 1, MetricLoggerUnit.Count);
        }
        else if (simulationStatus == SimulationStatus.NotApproved) {
            metric.putMetric('SimulationNotApproved', 1, MetricLoggerUnit.Count);
        }
        else if (simulationStatus == SimulationStatus.NotSupported) {
            metric.putMetric('SimulationNotSupported', 1, MetricLoggerUnit.Count);
        }
        const routeResponse = [];
        for (const subRoute of route) {
            const { amount, quote, tokenPath } = subRoute;
            const pools = subRoute.protocol == Protocol.V2 ? subRoute.route.pairs : subRoute.route.pools;
            const curRoute = [];
            for (let i = 0; i < pools.length; i++) {
                const nextPool = pools[i];
                const tokenIn = tokenPath[i];
                const tokenOut = tokenPath[i + 1];
                let edgeAmountIn = undefined;
                if (i == 0) {
                    edgeAmountIn = type == 'exactIn' ? amount.quotient.toString() : quote.quotient.toString();
                }
                let edgeAmountOut = undefined;
                if (i == pools.length - 1) {
                    edgeAmountOut = type == 'exactIn' ? quote.quotient.toString() : amount.quotient.toString();
                }
                if (nextPool instanceof Pool) {
                    curRoute.push({
                        type: 'v3-pool',
                        address: v3PoolProvider.getPoolAddress(nextPool.token0, nextPool.token1, nextPool.fee).poolAddress,
                        tokenIn: {
                            chainId: tokenIn.chainId,
                            decimals: tokenIn.decimals.toString(),
                            address: tokenIn.address,
                            symbol: tokenIn.symbol,
                        },
                        tokenOut: {
                            chainId: tokenOut.chainId,
                            decimals: tokenOut.decimals.toString(),
                            address: tokenOut.address,
                            symbol: tokenOut.symbol,
                        },
                        fee: nextPool.fee.toString(),
                        liquidity: nextPool.liquidity.toString(),
                        sqrtRatioX96: nextPool.sqrtRatioX96.toString(),
                        tickCurrent: nextPool.tickCurrent.toString(),
                        amountIn: edgeAmountIn,
                        amountOut: edgeAmountOut,
                    });
                }
                else {
                    const reserve0 = nextPool.reserve0;
                    const reserve1 = nextPool.reserve1;
                    curRoute.push({
                        type: 'v2-pool',
                        address: v2PoolProvider.getPoolAddress(nextPool.token0, nextPool.token1).poolAddress,
                        tokenIn: {
                            chainId: tokenIn.chainId,
                            decimals: tokenIn.decimals.toString(),
                            address: tokenIn.address,
                            symbol: tokenIn.symbol,
                        },
                        tokenOut: {
                            chainId: tokenOut.chainId,
                            decimals: tokenOut.decimals.toString(),
                            address: tokenOut.address,
                            symbol: tokenOut.symbol,
                        },
                        reserve0: {
                            token: {
                                chainId: reserve0.currency.wrapped.chainId,
                                decimals: reserve0.currency.wrapped.decimals.toString(),
                                address: reserve0.currency.wrapped.address,
                                symbol: reserve0.currency.wrapped.symbol,
                            },
                            quotient: reserve0.quotient.toString(),
                        },
                        reserve1: {
                            token: {
                                chainId: reserve1.currency.wrapped.chainId,
                                decimals: reserve1.currency.wrapped.decimals.toString(),
                                address: reserve1.currency.wrapped.address,
                                symbol: reserve1.currency.wrapped.symbol,
                            },
                            quotient: reserve1.quotient.toString(),
                        },
                        amountIn: edgeAmountIn,
                        amountOut: edgeAmountOut,
                    });
                }
            }
            routeResponse.push(curRoute);
        }
        const routeString = routeAmountsToString(route);
        const result = {
            methodParameters,
            blockNumber: blockNumber.toString(),
            amount: amount.quotient.toString(),
            amountDecimals: amount.toExact(),
            quote: quote.quotient.toString(),
            quoteDecimals: quote.toExact(),
            quoteGasAdjusted: quoteGasAdjusted.quotient.toString(),
            quoteGasAdjustedDecimals: quoteGasAdjusted.toExact(),
            gasUseEstimateQuote: estimatedGasUsedQuoteToken.quotient.toString(),
            gasUseEstimateQuoteDecimals: estimatedGasUsedQuoteToken.toExact(),
            gasUseEstimate: estimatedGasUsed.toString(),
            gasUseEstimateUSD: estimatedGasUsedUSD.toExact(),
            simulationStatus: simulationStatusToString(simulationStatus, log),
            simulationError: simulationStatus == SimulationStatus.Failed,
            gasPriceWei: gasPriceWei.toString(),
            route: routeResponse,
            routeString,
            quoteId,
        };
        this.logRouteMetrics(log, metric, startTime, currencyIn, currencyOut, tokenInAddress, tokenOutAddress, type, chainId, amount, routeString);
        return {
            statusCode: 200,
            body: result,
        };
    }
    logRouteMetrics(log, metric, startTime, currencyIn, currencyOut, tokenInAddress, tokenOutAddress, tradeType, chainId, amount, routeString) {
        var _a;
        const tradingPair = `${currencyIn.wrapped.symbol}/${currencyOut.wrapped.symbol}`;
        const wildcardInPair = `${currencyIn.wrapped.symbol}/*`;
        const wildcardOutPair = `*/${currencyOut.wrapped.symbol}`;
        const tradeTypeEnumValue = tradeType == 'exactIn' ? TradeType.EXACT_INPUT : TradeType.EXACT_OUTPUT;
        const pairsTracked = (_a = PAIRS_TO_TRACK.get(chainId)) === null || _a === void 0 ? void 0 : _a.get(tradeTypeEnumValue);
        if ((pairsTracked === null || pairsTracked === void 0 ? void 0 : pairsTracked.includes(tradingPair)) ||
            (pairsTracked === null || pairsTracked === void 0 ? void 0 : pairsTracked.includes(wildcardInPair)) ||
            (pairsTracked === null || pairsTracked === void 0 ? void 0 : pairsTracked.includes(wildcardOutPair))) {
            const metricPair = (pairsTracked === null || pairsTracked === void 0 ? void 0 : pairsTracked.includes(tradingPair))
                ? tradingPair
                : (pairsTracked === null || pairsTracked === void 0 ? void 0 : pairsTracked.includes(wildcardInPair))
                    ? wildcardInPair
                    : wildcardOutPair;
            metric.putMetric(`GET_QUOTE_AMOUNT_${metricPair}_${tradeType.toUpperCase()}_CHAIN_${chainId}`, Number(amount.toExact()), MetricLoggerUnit.None);
            metric.putMetric(`GET_QUOTE_LATENCY_${metricPair}_${tradeType.toUpperCase()}_CHAIN_${chainId}`, Date.now() - startTime, MetricLoggerUnit.Milliseconds);
            // Create a hashcode from the routeString, this will indicate that a different route is being used
            // hashcode function copied from: https://gist.github.com/hyamamoto/fd435505d29ebfa3d9716fd2be8d42f0?permalink_comment_id=4261728#gistcomment-4261728
            const routeStringHash = Math.abs(routeString.split('').reduce((s, c) => (Math.imul(31, s) + c.charCodeAt(0)) | 0, 0));
            // Log the chose route
            log.info({
                tradingPair,
                tokenInAddress,
                tokenOutAddress,
                tradeType,
                amount: amount.toExact(),
                routeString,
                routeStringHash,
                chainId,
            }, `Tracked Route for pair [${tradingPair}/${tradeType.toUpperCase()}] on chain [${chainId}] with route hash [${routeStringHash}] for amount [${amount.toExact()}]`);
        }
    }
    requestBodySchema() {
        return null;
    }
    requestQueryParamsSchema() {
        return QuoteQueryParamsJoi;
    }
    responseBodySchema() {
        return QuoteResponseSchemaJoi;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicXVvdGUuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9saWIvaGFuZGxlcnMvcXVvdGUvcXVvdGUudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQ0EsT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHFCQUFxQixDQUFBO0FBQzlDLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLCtCQUErQixDQUFBO0FBRXhFLE9BQU8sRUFBcUIsY0FBYyxFQUFFLFNBQVMsRUFBRSxNQUFNLG1CQUFtQixDQUFBO0FBQ2hGLE9BQU8sRUFHTCxnQkFBZ0IsRUFDaEIsb0JBQW9CLEVBR3BCLFFBQVEsRUFDUixnQkFBZ0IsRUFFaEIsa0JBQWtCLEdBQ25CLE1BQU0sNkJBQTZCLENBQUE7QUFDcEMsT0FBTyxFQUFFLElBQUksRUFBRSxNQUFNLGlCQUFpQixDQUFBO0FBQ3RDLE9BQU8sSUFBSSxNQUFNLE1BQU0sQ0FBQTtBQUN2QixPQUFPLENBQUMsTUFBTSxRQUFRLENBQUE7QUFDdEIsT0FBTyxFQUFFLGlCQUFpQixFQUFnRCxNQUFNLFlBQVksQ0FBQTtBQUU1RixPQUFPLEVBQWlCLHNCQUFzQixFQUFnQyxNQUFNLFdBQVcsQ0FBQTtBQUMvRixPQUFPLEVBQ0wsK0JBQStCLEVBQy9CLGFBQWEsRUFDYixzQkFBc0IsRUFDdEIscUJBQXFCLEdBQ3RCLE1BQU0sV0FBVyxDQUFBO0FBQ2xCLE9BQU8sRUFBb0IsbUJBQW1CLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQTtBQUM3RSxPQUFPLEVBQUUsS0FBSyxFQUFFLE1BQU0sUUFBUSxDQUFBO0FBQzlCLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxNQUFNLG1CQUFtQixDQUFBO0FBRTVELE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSx1QkFBdUIsQ0FBQTtBQUV0RCxNQUFNLE9BQU8sWUFBYSxTQUFRLGlCQU1qQztJQUNRLEtBQUssQ0FBQyxhQUFhLENBQ3hCLE1BQXFHO1FBRXJHLE1BQU0sRUFBRSxPQUFPLEVBQUUs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QUFHLENBQzlCLFdBQVcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUNwRixDQUFBO1lBQ0Qsc0JBQXNCO1lBQ3RCLEdBQUcsQ0FBQyxJQUFJLENBQ047Z0JBQ0UsV0FBVztnQkFDWCxjQUFjO2dCQUNkLGVBQWU7Z0JBQ2YsU0FBUztnQkFDVCxNQUFNLEVBQUUsTUFBTSxDQUFDLE9BQU8sRUFBRTtnQkFDeEIsV0FBVztnQkFDWCxlQUFlO2dCQUNmLE9BQU87YUFDUixFQUNELDJCQUEyQixXQUFXLElBQUksU0FBUyxDQUFDLFdBQVcsRUFBRSxlQUFlLE9BQU8sc0JBQXNCLGVBQWUsaUJBQWlCLE1BQU0sQ0FBQyxPQUFPLEVBQUUsR0FBRyxDQUNqSyxDQUFBO1NBQ0Y7SUFDSCxDQUFDO0lBRVMsaUJBQWlCO1FBQ3pCLE9BQU8sSUFBSSxDQUFBO0lBQ2IsQ0FBQztJQUVTLHdCQUF3QjtRQUNoQyxPQUFPLG1CQUFtQixDQUFBO0lBQzVCLENBQUM7SUFFUyxrQkFBa0I7UUFDMUIsT0FBTyxzQkFBc0IsQ0FBQTtJQUMvQixDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgSm9pIGZyb20gJ0BoYXBpL2pvaSdcbmltcG9ydCB7IFByb3RvY29sIH0gZnJvbSAnQHVuaXN3YXAvcm91dGVyLXNkaydcbmltcG9ydCB7IFVOSVZFUlNBTF9ST1VURVJfQUREUkVTUyB9IGZyb20gJ0B1bmlzd2FwL3VuaXZlcnNhbC1yb3V0ZXItc2RrJ1xuaW1wb3J0IHsgUGVybWl0U2luZ2xlIH0gZnJvbSAnQHVuaXN3YXAvcGVybWl0Mi1zZGsnXG5pbXBvcnQgeyBDaGFpbklkLCBDdXJyZW5jeSwgQ3VycmVuY3lBbW91bnQsIFRyYWRlVHlwZSB9IGZyb20gJ0B1bmlzd2FwL3Nkay1jb3JlJ1xuaW1wb3J0IHtcbiAgQWxwaGFSb3V0ZXJDb25maWcsXG4gIElSb3V0ZXIsXG4gIE1ldHJpY0xvZ2dlclVuaXQsXG4gIHJvdXRlQW1vdW50c1RvU3RyaW5nLFxuICBTd2FwUm91dGUsXG4gIFN3YXBPcHRpb25zLFxuICBTd2FwVHlwZSxcbiAgU2ltdWxhdGlvblN0YXR1cyxcbiAgSU1ldHJpYyxcbiAgSURfVE9fTkVUV09SS19OQU1FLFxufSBmcm9tICdAdW5pc3dhcC9zbWFydC1vcmRlci1yb3V0ZXInXG5pbXBvcnQgeyBQb29sIH0gZnJvbSAnQHVuaXN3YXAvdjMtc2RrJ1xuaW1wb3J0IEpTQkkgZnJvbSAnanNiaSdcbmltcG9ydCBfIGZyb20gJ2xvZGFzaCdcbmltcG9ydCB7IEFQSUdMYW1iZGFIYW5kbGVyLCBFcnJvclJlc3BvbnNlLCBIYW5kbGVSZXF1ZXN0UGFyYW1zLCBSZXNwb25zZSB9IGZyb20gJy4uL2hhbmRsZXInXG5pbXBvcnQgeyBDb250YWluZXJJbmplY3RlZCwgUmVxdWVzdEluamVjdGVkIH0gZnJvbSAnLi4vaW5qZWN0b3Itc29yJ1xuaW1wb3J0IHsgUXVvdGVSZXNwb25zZSwgUXVvdGVSZXNwb25zZVNjaGVtYUpvaSwgVjJQb29sSW5Sb3V0ZSwgVjNQb29sSW5Sb3V0ZSB9IGZyb20gJy4uL3NjaGVtYSdcbmltcG9ydCB7XG4gIERFRkFVTFRfUk9VVElOR19DT05GSUdfQllfQ0hBSU4sXG4gIHBhcnNlRGVhZGxpbmUsXG4gIHBhcnNlU2xpcHBhZ2VUb2xlcmFuY2UsXG4gIHRva2VuU3RyaW5nVG9DdXJyZW5jeSxcbn0gZnJvbSAnLi4vc2hhcmVkJ1xuaW1wb3J0IHsgUXVvdGVRdWVyeVBhcmFtcywgUXVvdGVRdWVyeVBhcmFtc0pvaSB9IGZyb20gJy4vc2NoZW1hL3F1b3RlLXNjaGVtYSdcbmltcG9ydCB7IHV0aWxzIH0gZnJvbSAnZXRoZXJzJ1xuaW1wb3J0IHsgc2ltdWxhdGlvblN0YXR1c1RvU3RyaW5nIH0gZnJvbSAnLi91dGlsL3NpbXVsYXRpb24nXG5pbXBvcnQgTG9nZ2VyIGZyb20gJ2J1bnlhbidcbmltcG9ydCB7IFBBSVJTX1RPX1RSQUNLIH0gZnJvbSAnLi91dGlsL3BhaXJzLXRvLXRyYWNrJ1xuXG5leHBvcnQgY2xhc3MgUXVvdGVIYW5kbGVyIGV4dGVuZHMgQVBJR0xhbWJkYUhhbmRsZXI8XG4gIENvbnRhaW5lckluamVjdGVkLFxuICBSZXF1ZXN0SW5qZWN0ZWQ8SVJvdXRlcjxBbHBoYVJvdXRlckNvbmZpZz4+LFxuICB2b2lkLFxuICBRdW90ZVF1ZXJ5UGFyYW1zLFxuICBRdW90ZVJlc3BvbnNlXG4+IHtcbiAgcHVibGljIGFzeW5jIGhhbmRsZVJlcXVlc3QoXG4gICAgcGFyYW1zOiBIYW5kbGVSZXF1ZXN0UGFyYW1zPENvbnRhaW5lckluamVjdGVkLCBSZXF1ZXN0SW5qZWN0ZWQ8SVJvdXRlcjxhbnk+Piwgdm9pZCwgUXVvdGVRdWVyeVBhcmFtcz5cbiAgKTogUHJvbWlzZTxSZXNwb25zZTxRdW90ZVJlc3BvbnNlPiB8IEVycm9yUmVzcG9uc2U+IHtcbiAgICBjb25zdCB7IGNoYWluSWQsIG1ldHJpYywgbG9nIH0gPSBwYXJhbXMucmVxdWVzdEluamVjdGVkXG4gICAgY29uc3Qgc3RhcnRUaW1lID0gRGF0ZS5ub3coKVxuXG4gICAgbGV0IHJlc3VsdDogUmVzcG9uc2U8UXVvdGVSZXNwb25zZT4gfCBFcnJvclJlc3BvbnNlXG5cbiAgICB0cnkge1xuICAgICAgcmVzdWx0ID0gYXdhaXQgdGhpcy5oYW5kbGVSZXF1ZXN0SW50ZXJuYWwocGFyYW1zKVxuXG4gICAgICBzd2l0Y2ggKHJlc3VsdC5zdGF0dXNDb2RlKSB7XG4gICAgICAgIGNhc2UgMjAwOlxuICAgICAgICBjYXNlIDIwMjpcbiAgICAgICAgICBtZXRyaWMucHV0TWV0cmljKGBHRVRfUVVPVEVfMjAwX0NIQUlOSUQ6ICR7Y2hhaW5JZH1gLCAxLCBNZXRyaWNMb2dnZXJVbml0LkNvdW50KVxuICAgICAgICAgIGJyZWFrXG4gICAgICAgIGNhc2UgNDAwOlxuICAgICAgICBjYXNlIDQwMzpcbiAgICAgICAgY2FzZSA0MDQ6XG4gICAgICAgIGNhc2UgNDA4OlxuICAgICAgICBjYXNlIDQwOTpcbiAgICAgICAgICBtZXRyaWMucHV0TWV0cmljKGBHRVRfUVVPVEVfNDAwX0NIQUlOSUQ6ICR7Y2hhaW5JZH1gLCAxLCBNZXRyaWNMb2dnZXJVbml0LkNvdW50KVxuICAgICAgICAgIGxvZy5lcnJvcihcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgc3RhdHVzQ29kZTogcmVzdWx0Py5zdGF0dXNDb2RlLFxuICAgICAgICAgICAgICBlcnJvckNvZGU6IHJlc3VsdD8uZXJyb3JDb2RlLFxuICAgICAgICAgICAgICBkZXRhaWw6IHJlc3VsdD8uZGV0YWlsLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGBRdW90ZSA0WFggRXJyb3IgWyR7cmVzdWx0Py5zdGF0dXNDb2RlfV0gb24gJHtJRF9UT19ORVRXT1JLX05BTUUoY2hhaW5JZCl9IHdpdGggZXJyb3JDb2RlICcke1xuICAgICAgICAgICAgICByZXN1bHQ/LmVycm9yQ29kZVxuICAgICAgICAgICAgfSc6ICR7cmVzdWx0Py5kZXRhaWx9YFxuICAgICAgICAgIClcbiAgICAgICAgICBicmVha1xuICAgICAgICBjYXNlIDUwMDpcbiAgICAgICAgICBtZXRyaWMucHV0TWV0cmljKGBHRVRfUVVPVEVfNTAwX0NIQUlOSUQ6ICR7Y2hhaW5JZH1gLCAxLCBNZXRyaWNMb2dnZXJVbml0LkNvdW50KVxuICAgICAgICAgIGJyZWFrXG4gICAgICB9XG4gICAgfSBjYXRjaCAoZXJyKSB7XG4gICAgICBtZXRyaWMucHV0TWV0cmljKGBHRVRfUVVPVEVfNTAwX0NIQUlOSUQ6ICR7Y2hhaW5JZH1gLCAxLCBNZXRyaWNMb2dnZXJVbml0LkNvdW50KVxuXG4gICAgICB0aHJvdyBlcnJcbiAgICB9IGZpbmFsbHkge1xuICAgICAgLy8gVGhpcyBtZXRyaWMgaXMgbG9nZ2VkIGFmdGVyIGNhbGxpbmcgdGhlIGludGVybmFsIGhhbmRsZXIgdG8gY29ycmVsYXRlIHdpdGggdGhlIHN0YXR1cyBtZXRyaWNzXG4gICAgICBtZXRyaWMucHV0TWV0cmljKGBHRVRfUVVPVEVfUkVRVUVTVEVEX0NIQUlOSUQ6ICR7Y2hhaW5JZH1gLCAxLCBNZXRyaWNMb2dnZXJVbml0LkNvdW50KVxuICAgICAgbWV0cmljLnB1dE1ldHJpYyhgR0VUX1FVT1RFX0xBVEVOQ1lfQ0hBSU5fJHtjaGFpbklkfWAsIERhdGUubm93KCkgLSBzdGFydFRpbWUsIE1ldHJpY0xvZ2dlclVuaXQuTWlsbGlzZWNvbmRzKVxuICAgIH1cblxuICAgIHJldHVybiByZXN1bHRcbiAgfVxuXG4gIHByaXZhdGUgYXN5bmMgaGFuZGxlUmVxdWVzdEludGVybmFsKFxuICAgIHBhcmFtczogSGFuZGxlUmVxdWVzdFBhcmFtczxDb250YWluZXJJbmplY3RlZCwgUmVxdWVzdEluamVjdGVkPElSb3V0ZXI8YW55Pj4sIHZvaWQsIFF1b3RlUXVlcnlQYXJhbXM+XG4gICk6IFByb21pc2U8UmVzcG9uc2U8UXVvdGVSZXNwb25zZT4gfCBFcnJvclJlc3BvbnNlPiB7XG4gICAgY29uc3Qge1xuICAgICAgcmVxdWVzdFF1ZXJ5UGFyYW1zOiB7XG4gICAgICAgIHRva2VuSW5BZGRyZXNzLFxuICAgICAgICB0b2tlbkluQ2hhaW5JZCxcbiAgICAgICAgdG9rZW5PdXRBZGRyZXNzLFxuICAgICAgICB0b2tlbk91dENoYWluSWQsXG4gICAgICAgIGFtb3VudDogYW1vdW50UmF3LFxuICAgICAgICB0eXBlLFxuICAgICAgICByZWNpcGllbnQsXG4gICAgICAgIHNsaXBwYWdlVG9sZXJhbmNlLFxuICAgICAgICBkZWFkbGluZSxcbiAgICAgICAgbWluU3BsaXRzLFxuICAgICAgICBmb3JjZUNyb3NzUHJvdG9jb2wsXG4gICAgICAgIGZvcmNlTWl4ZWRSb3V0ZXMsXG4gICAgICAgIHByb3RvY29sczogcHJvdG9jb2xzU3RyLFxuICAgICAgICBzaW11bGF0ZUZyb21BZGRyZXNzLFxuICAgICAgICBwZXJtaXRTaWduYXR1cmUsXG4gICAgICAgIHBlcm1pdE5vbmNlLFxuICAgICAgICBwZXJtaXRFeHBpcmF0aW9uLFxuICAgICAgICBwZXJtaXRBbW91bnQsXG4gICAgICAgIHBlcm1pdFNpZ0RlYWRsaW5lLFxuICAgICAgICBlbmFibGVVbml2ZXJzYWxSb3V0ZXIsXG4gICAgICB9LFxuICAgICAgcmVxdWVzdEluamVjdGVkOiB7XG4gICAgICAgIHJvdXRlcixcbiAgICAgICAgbG9nLFxuICAgICAgICBpZDogcXVvdGVJZCxcbiAgICAgICAgY2hhaW5JZCxcbiAgICAgICAgdG9rZW5Qcm92aWRlcixcbiAgICAgICAgdG9rZW5MaXN0UHJvdmlkZXIsXG4gICAgICAgIHYzUG9vbFByb3ZpZGVyOiB2M1Bvb2xQcm92aWRlcixcbiAgICAgICAgdjJQb29sUHJvdmlkZXI6IHYyUG9vbFByb3ZpZGVyLFxuICAgICAgICBtZXRyaWMsXG4gICAgICB9LFxuICAgIH0gPSBwYXJhbXNcblxuICAgIC8vIFBhcnNlIHVzZXIgcHJvdmlkZWQgdG9rZW4gYWRkcmVzcy9zeW1ib2wgdG8gQ3VycmVuY3kgb2JqZWN0LlxuICAgIGxldCBiZWZvcmUgPSBEYXRlLm5vdygpXG4gICAgY29uc3Qgc3RhcnRUaW1lID0gRGF0ZS5ub3coKVxuXG4gICAgY29uc3QgY3VycmVuY3lJbiA9IGF3YWl0IHRva2VuU3RyaW5nVG9DdXJyZW5jeShcbiAgICAgIHRva2VuTGlzdFByb3ZpZGVyLFxuICAgICAgdG9rZW5Qcm92aWRlcixcbiAgICAgIHRva2VuSW5BZGRyZXNzLFxuICAgICAgdG9rZW5JbkNoYWluSWQsXG4gICAgICBsb2dcbiAgICApXG5cbiAgICBjb25zdCBjdXJyZW5jeU91dCA9IGF3YWl0IHRva2VuU3RyaW5nVG9DdXJyZW5jeShcbiAgICAgIHRva2VuTGlzdFByb3ZpZGVyLFxuICAgICAgdG9rZW5Qcm92aWRlcixcbiAgICAgIHRva2VuT3V0QWRkcmVzcyxcbiAgICAgIHRva2VuT3V0Q2hhaW5JZCxcbiAgICAgIGxvZ1xuICAgIClcblxuICAgIG1ldHJpYy5wdXRNZXRyaWMoJ1Rva2VuSW5PdXRTdHJUb1Rva2VuJywgRGF0ZS5ub3coKSAtIGJlZm9yZSwgTWV0cmljTG9nZ2VyVW5pdC5NaWxsaXNlY29uZHMpXG5cbiAgICBpZiAoIWN1cnJlbmN5SW4pIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN0YXR1c0NvZGU6IDQwMCxcbiAgICAgICAgZXJyb3JDb2RlOiAnVE9LRU5fSU5fSU5WQUxJRCcsXG4gICAgICAgIGRldGFpbDogYENvdWxkIG5vdCBmaW5kIHRva2VuIHdpdGggYWRkcmVzcyBcIiR7dG9rZW5JbkFkZHJlc3N9XCJgLFxuICAgICAgfVxuICAgIH1cblxuICAgIGlmICghY3VycmVuY3lPdXQpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN0YXR1c0NvZGU6IDQwMCxcbiAgICAgICAgZXJyb3JDb2RlOiAnVE9LRU5fT1VUX0lOVkFMSUQnLFxuICAgICAgICBkZXRhaWw6IGBDb3VsZCBub3QgZmluZCB0b2tlbiB3aXRoIGFkZHJlc3MgXCIke3Rva2VuT3V0QWRkcmVzc31cImAsXG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKHRva2VuSW5DaGFpbklkICE9IHRva2VuT3V0Q2hhaW5JZCkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3RhdHVzQ29kZTogNDAwLFxuICAgICAgICBlcnJvckNvZGU6ICdUT0tFTl9DSEFJTlNfRElGRkVSRU5UJyxcbiAgICAgICAgZGV0YWlsOiBgQ2Fubm90IHJlcXVlc3QgcXVvdGVzIGZvciB0b2tlbnMgb24gZGlmZmVyZW50IGNoYWluc2AsXG4gICAgICB9XG4gICAgfVxuXG4gICAgaWYgKGN1cnJlbmN5SW4uZXF1YWxzKGN1cnJlbmN5T3V0KSkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgc3RhdHVzQ29kZTogNDAwLFxuICAgICAgICBlcnJvckNvZGU6ICdUT0tFTl9JTl9PVVRfU0FNRScsXG4gICAgICAgIGRldGFpbDogYHRva2VuSW4gYW5kIHRva2VuT3V0IG11c3QgYmUgZGlmZmVyZW50YCxcbiAgICAgIH1cbiAgICB9XG5cbiAgICBsZXQgcHJvdG9jb2xzOiBQcm90b2NvbFtdID0gW11cbiAgICBpZiAocHJvdG9jb2xzU3RyKSB7XG4gICAgICBmb3IgKGNvbnN0IHByb3RvY29sU3RyIG9mIHByb3RvY29sc1N0cikge1xuICAgICAgICBzd2l0Y2ggKHByb3RvY29sU3RyLnRvTG93ZXJDYXNlKCkpIHtcbiAgICAgICAgICBjYXNlICd2Mic6XG4gICAgICAgICAgICBwcm90b2NvbHMucHVzaChQcm90b2NvbC5WMilcbiAgICAgICAgICAgIGJyZWFrXG4gICAgICAgICAgY2FzZSAndjMnOlxuICAgICAgICAgICAgcHJvdG9jb2xzLnB1c2goUHJvdG9jb2wuVjMpXG4gICAgICAgICAgICBicmVha1xuICAgICAgICAgIGNhc2UgJ21peGVkJzpcbiAgICAgICAgICAgIHByb3RvY29scy5wdXNoKFByb3RvY29sLk1JWEVEKVxuICAgICAgICAgICAgYnJlYWtcbiAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICAgICAgc3RhdHVzQ29kZTogNDAwLFxuICAgICAgICAgICAgICBlcnJvckNvZGU6ICdJTlZBTElEX1BST1RPQ09MJyxcbiAgICAgICAgICAgICAgZGV0YWlsOiBgSW52YWxpZCBwcm90b2NvbCBzcGVjaWZpZWQuIFN1cHBvcnRlZCBwcm90b2NvbHM6ICR7SlNPTi5zdHJpbmdpZnkoT2JqZWN0LnZhbHVlcyhQcm90b2NvbCkpfWAsXG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9IGVsc2UgaWYgKCFmb3JjZUNyb3NzUHJvdG9jb2wpIHtcbiAgICAgIHByb3RvY29scyA9IFtQcm90b2NvbC5WM11cbiAgICB9XG5cbiAgICBjb25zdCByb3V0aW5nQ29uZmlnOiBBbHBoYVJvdXRlckNvbmZpZyA9IHtcbiAgICAgIC4uLkRFRkFVTFRfUk9VVElOR19DT05GSUdfQllfQ0hBSU4oY2hhaW5JZCksXG4gICAgICAuLi4obWluU3BsaXRzID8geyBtaW5TcGxpdHMgfSA6IHt9KSxcbiAgICAgIC4uLihmb3JjZUNyb3NzUHJvdG9jb2wgPyB7IGZvcmNlQ3Jvc3NQcm90b2NvbCB9IDoge30pLFxuICAgICAgLi4uKGZvcmNlTWl4ZWRSb3V0ZXMgPyB7IGZvcmNlTWl4ZWRSb3V0ZXMgfSA6IHt9KSxcbiAgICAgIHByb3RvY29scyxcbiAgICB9XG5cbiAgICBsZXQgc3dhcFBhcmFtczogU3dhcE9wdGlvbnMgfCB1bmRlZmluZWQgPSB1bmRlZmluZWRcblxuICAgIC8vIGUuZy4gSW5wdXRzIG9mIGZvcm0gXCIxLjI1JVwiIHdpdGggMmRwIG1heC4gQ29udmVydCB0byBmcmFjdGlvbmFsIHJlcHJlc2VudGF0aW9uID0+IDEuMjUgPT4gMTI1IC8gMTAwMDBcbiAgICBpZiAoc2xpcHBhZ2VUb2xlcmFuY2UgJiYgZGVhZGxpbmUgJiYgcmVjaXBpZW50KSB7XG4gICAgICBjb25zdCBzbGlwcGFnZVRvbGVyYW5jZVBlcmNlbnQgPSBwYXJzZVNsaXBwYWdlVG9sZXJhbmNlKHNsaXBwYWdlVG9sZXJhbmNlKVxuXG4gICAgICAvLyBUT0RPOiBSZW1vdmUgb25jZSB1bml2ZXJzYWwgcm91dGVyIGlzIG5vIGxvbmdlciBiZWhpbmQgYSBmZWF0dXJlIGZsYWcuXG4gICAgICBpZiAoZW5hYmxlVW5pdmVyc2FsUm91dGVyKSB7XG4gICAgICAgIHN3YXBQYXJhbXMgPSB7XG4gICAgICAgICAgdHlwZTogU3dhcFR5cGUuVU5JVkVSU0FMX1JPVVRFUixcbiAgICAgICAgICBkZWFkbGluZU9yUHJldmlvdXNCbG9ja2hhc2g6IHBhcnNlRGVhZGxpbmUoZGVhZGxpbmUpLFxuICAgICAgICAgIHJlY2lwaWVudDogcmVjaXBpZW50LFxuICAgICAgICAgIHNsaXBwYWdlVG9sZXJhbmNlOiBzbGlwcGFnZVRvbGVyYW5jZVBlcmNlbnQsXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHN3YXBQYXJhbXMgPSB7XG4gICAgICAgICAgdHlwZTogU3dhcFR5cGUuU1dBUF9ST1VURVJfMDIsXG4gICAgICAgICAgZGVhZGxpbmU6IHBhcnNlRGVhZGxpbmUoZGVhZGxpbmUpLFxuICAgICAgICAgIHJlY2lwaWVudDogcmVjaXBpZW50LFxuICAgICAgICAgIHNsaXBwYWdlVG9sZXJhbmNlOiBzbGlwcGFnZVRvbGVyYW5jZVBlcmNlbnQsXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgaWYgKFxuICAgICAgICBlbmFibGVVbml2ZXJzYWxSb3V0ZXIgJiZcbiAgICAgICAgcGVybWl0U2lnbmF0dXJlICYmXG4gICAgICAgIHBlcm1pdE5vbmNlICYmXG4gICAgICAgIHBlcm1pdEV4cGlyYXRpb24gJiZcbiAgICAgICAgcGVybWl0QW1vdW50ICYmXG4gICAgICAgIHBlcm1pdFNpZ0RlYWRsaW5lXG4gICAgICApIHtcbiAgICAgICAgY29uc3QgcGVybWl0OiBQZXJtaXRTaW5nbGUgPSB7XG4gICAgICAgICAgZGV0YWlsczoge1xuICAgICAgICAgICAgdG9rZW46IGN1cnJlbmN5SW4ud3JhcHBlZC5hZGRyZXNzLFxuICAgICAgICAgICAgYW1vdW50OiBwZXJtaXRBbW91bnQsXG4gICAgICAgICAgICBleHBpcmF0aW9uOiBwZXJtaXRFeHBpcmF0aW9uLFxuICAgICAgICAgICAgbm9uY2U6IHBlcm1pdE5vbmNlLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgc3BlbmRlcjogVU5JVkVSU0FMX1JPVVRFUl9BRERSRVNTKGNoYWluSWQpLFxuICAgICAgICAgIHNpZ0RlYWRsaW5lOiBwZXJtaXRTaWdEZWFkbGluZSxcbiAgICAgICAgfVxuXG4gICAgICAgIHN3YXBQYXJhbXMuaW5wdXRUb2tlblBlcm1pdCA9IHtcbiAgICAgICAgICAuLi5wZXJtaXQsXG4gICAgICAgICAgc2lnbmF0dXJlOiBwZXJtaXRTaWduYXR1cmUsXG4gICAgICAgIH1cbiAgICAgIH0gZWxzZSBpZiAoXG4gICAgICAgICFlbmFibGVVbml2ZXJzYWxSb3V0ZXIgJiZcbiAgICAgICAgcGVybWl0U2lnbmF0dXJlICYmXG4gICAgICAgICgocGVybWl0Tm9uY2UgJiYgcGVybWl0RXhwaXJhdGlvbikgfHwgKHBlcm1pdEFtb3VudCAmJiBwZXJtaXRTaWdEZWFkbGluZSkpXG4gICAgICApIHtcbiAgICAgICAgY29uc3QgeyB2LCByLCBzIH0gPSB1dGlscy5zcGxpdFNpZ25hdHVyZShwZXJtaXRTaWduYXR1cmUpXG5cbiAgICAgICAgc3dhcFBhcmFtcy5pbnB1dFRva2VuUGVybWl0ID0ge1xuICAgICAgICAgIHY6IHYgYXMgMCB8IDEgfCAyNyB8IDI4LFxuICAgICAgICAgIHIsXG4gICAgICAgICAgcyxcbiAgICAgICAgICAuLi4ocGVybWl0Tm9uY2UgJiYgcGVybWl0RXhwaXJhdGlvblxuICAgICAgICAgICAgPyB7IG5vbmNlOiBwZXJtaXROb25jZSEsIGV4cGlyeTogcGVybWl0RXhwaXJhdGlvbiEgfVxuICAgICAgICAgICAgOiB7IGFtb3VudDogcGVybWl0QW1vdW50ISwgZGVhZGxpbmU6IHBlcm1pdFNpZ0RlYWRsaW5lISB9KSxcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAoc2ltdWxhdGVGcm9tQWRkcmVzcykge1xuICAgICAgICBtZXRyaWMucHV0TWV0cmljKCdTaW11bGF0aW9uIFJlcXVlc3RlZCcsIDEsIE1ldHJpY0xvZ2dlclVuaXQuQ291bnQpXG4gICAgICAgIHN3YXBQYXJhbXMuc2ltdWxhdGUgPSB7IGZyb21BZGRyZXNzOiBzaW11bGF0ZUZyb21BZGRyZXNzIH1cbiAgICAgIH1cbiAgICB9XG5cbiAgICBiZWZvcmUgPSBEYXRlLm5vdygpXG5cbiAgICBsZXQgc3dhcFJvdXRlOiBTd2FwUm91dGUgfCBudWxsXG4gICAgbGV0IGFtb3VudDogQ3VycmVuY3lBbW91bnQ8Q3VycmVuY3k+XG5cbiAgICBsZXQgdG9rZW5QYWlyU3ltYm9sID0gJydcbiAgICBsZXQgdG9rZW5QYWlyU3ltYm9sQ2hhaW4gPSAnJ1xuICAgIGlmIChjdXJyZW5jeUluLnN5bWJvbCAmJiBjdXJyZW5jeU91dC5zeW1ib2wpIHtcbiAgICAgIHRva2VuUGFpclN5bWJvbCA9IF8oW2N1cnJlbmN5SW4uc3ltYm9sLCBjdXJyZW5jeU91dC5zeW1ib2xdKS5qb2luKCcvJylcbiAgICAgIHRva2VuUGFpclN5bWJvbENoYWluID0gYCR7dG9rZW5QYWlyU3ltYm9sfS8ke2NoYWluSWR9YFxuICAgIH1cblxuICAgIGNvbnN0IFt0b2tlbjBTeW1ib2wsIHRva2VuMEFkZHJlc3MsIHRva2VuMVN5bWJvbCwgdG9rZW4xQWRkcmVzc10gPSBjdXJyZW5jeUluLndyYXBwZWQuc29ydHNCZWZvcmUoXG4gICAgICBjdXJyZW5jeU91dC53cmFwcGVkXG4gICAgKVxuICAgICAgPyBbY3VycmVuY3lJbi5zeW1ib2wsIGN1cnJlbmN5SW4ud3JhcHBlZC5hZGRyZXNzLCBjdXJyZW5jeU91dC5zeW1ib2wsIGN1cnJlbmN5T3V0LndyYXBwZWQuYWRkcmVzc11cbiAgICAgIDogW2N1cnJlbmN5T3V0LnN5bWJvbCwgY3VycmVuY3lPdXQud3JhcHBlZC5hZGRyZXNzLCBjdXJyZW5jeUluLnN5bWJvbCwgY3VycmVuY3lJbi53cmFwcGVkLmFkZHJlc3NdXG5cbiAgICBzd2l0Y2ggKHR5cGUpIHtcbiAgICAgIGNhc2UgJ2V4YWN0SW4nOlxuICAgICAgICBhbW91bnQgPSBDdXJyZW5jeUFtb3VudC5mcm9tUmF3QW1vdW50KGN1cnJlbmN5SW4sIEpTQkkuQmlnSW50KGFtb3VudFJhdykpXG5cbiAgICAgICAgbG9nLmluZm8oXG4gICAgICAgICAge1xuICAgICAgICAgICAgYW1vdW50SW46IGFtb3VudC50b0V4YWN0KCksXG4gICAgICAgICAgICB0b2tlbjBBZGRyZXNzLFxuICAgICAgICAgICAgdG9rZW4xQWRkcmVzcyxcbiAgICAgICAgICAgIHRva2VuMFN5bWJvbCxcbiAgICAgICAgICAgIHRva2VuMVN5bWJvbCxcbiAgICAgICAgICAgIHRva2VuSW5TeW1ib2w6IGN1cnJlbmN5SW4uc3ltYm9sLFxuICAgICAgICAgICAgdG9rZW5PdXRTeW1ib2w6IGN1cnJlbmN5T3V0LnN5bWJvbCxcbiAgICAgICAgICAgIHRva2VuUGFpclN5bWJvbCxcbiAgICAgICAgICAgIHRva2VuUGFpclN5bWJvbENoYWluLFxuICAgICAgICAgICAgdHlwZSxcbiAgICAgICAgICAgIHJvdXRpbmdDb25maWc6IHJvdXRpbmdDb25maWcsXG4gICAgICAgICAgICBzd2FwUGFyYW1zLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgYEV4YWN0IEluIFN3YXA6IEdpdmUgJHthbW91bnQudG9FeGFjdCgpfSAke2Ftb3VudC5jdXJyZW5jeS5zeW1ib2x9LCBXYW50OiAke1xuICAgICAgICAgICAgY3VycmVuY3lPdXQuc3ltYm9sXG4gICAgICAgICAgfS4gQ2hhaW46ICR7Y2hhaW5JZH1gXG4gICAgICAgIClcblxuICAgICAgICBzd2FwUm91dGUgPSBhd2FpdCByb3V0ZXIucm91dGUoYW1vdW50LCBjdXJyZW5jeU91dCwgVHJhZGVUeXBlLkVYQUNUX0lOUFVULCBzd2FwUGFyYW1zLCByb3V0aW5nQ29uZmlnKVxuICAgICAgICBicmVha1xuICAgICAgY2FzZSAnZXhhY3RPdXQnOlxuICAgICAgICBhbW91bnQgPSBDdXJyZW5jeUFtb3VudC5mcm9tUmF3QW1vdW50KGN1cnJlbmN5T3V0LCBKU0JJLkJpZ0ludChhbW91bnRSYXcpKVxuXG4gICAgICAgIGxvZy5pbmZvKFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGFtb3VudE91dDogYW1vdW50LnRvRXhhY3QoKSxcbiAgICAgICAgICAgIHRva2VuMEFkZHJlc3MsXG4gICAgICAgICAgICB0b2tlbjFBZGRyZXNzLFxuICAgICAgICAgICAgdG9rZW4wU3ltYm9sLFxuICAgICAgICAgICAgdG9rZW4xU3ltYm9sLFxuICAgICAgICAgICAgdG9rZW5JblN5bWJvbDogY3VycmVuY3lJbi5zeW1ib2wsXG4gICAgICAgICAgICB0b2tlbk91dFN5bWJvbDogY3VycmVuY3lPdXQuc3ltYm9sLFxuICAgICAgICAgICAgdG9rZW5QYWlyU3ltYm9sLFxuICAgICAgICAgICAgdG9rZW5QYWlyU3ltYm9sQ2hhaW4sXG4gICAgICAgICAgICB0eXBlLFxuICAgICAgICAgICAgcm91dGluZ0NvbmZpZzogcm91dGluZ0NvbmZpZyxcbiAgICAgICAgICAgIHN3YXBQYXJhbXMsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBgRXhhY3QgT3V0IFN3YXA6IFdhbnQgJHthbW91bnQudG9FeGFjdCgpfSAke2Ftb3VudC5jdXJyZW5jeS5zeW1ib2x9IEdpdmU6ICR7XG4gICAgICAgICAgICBjdXJyZW5jeUluLnN5bWJvbFxuICAgICAgICAgIH0uIENoYWluOiAke2NoYWluSWR9YFxuICAgICAgICApXG5cbiAgICAgICAgc3dhcFJvdXRlID0gYXdhaXQgcm91dGVyLnJvdXRlKGFtb3VudCwgY3VycmVuY3lJbiwgVHJhZGVUeXBlLkVYQUNUX09VVFBVVCwgc3dhcFBhcmFtcywgcm91dGluZ0NvbmZpZylcbiAgICAgICAgYnJlYWtcbiAgICAgIGRlZmF1bHQ6XG4gICAgICAgIHRocm93IG5ldyBFcnJvcignSW52YWxpZCBzd2FwIHR5cGUnKVxuICAgIH1cblxuICAgIGlmICghc3dhcFJvdXRlKSB7XG4gICAgICBsb2cuaW5mbyhcbiAgICAgICAge1xuICAgICAgICAgIHR5cGUsXG4gICAgICAgICAgdG9rZW5JbjogY3VycmVuY3lJbixcbiAgICAgICAgICB0b2tlbk91dDogY3VycmVuY3lPdXQsXG4gICAgICAgICAgYW1vdW50OiBhbW91bnQucXVvdGllbnQudG9TdHJpbmcoKSxcbiAgICAgICAgfSxcbiAgICAgICAgYE5vIHJvdXRlIGZvdW5kLiA0MDRgXG4gICAgICApXG5cbiAgICAgIHJldHVybiB7XG4gICAgICAgIHN0YXR1c0NvZGU6IDQwNCxcbiAgICAgICAgZXJyb3JDb2RlOiAnTk9fUk9VVEUnLFxuICAgICAgICBkZXRhaWw6ICdObyByb3V0ZSBmb3VuZCcsXG4gICAgICB9XG4gICAgfVxuXG4gICAgY29uc3Qge1xuICAgICAgcXVvdGUsXG4gICAgICBxdW90ZUdhc0FkanVzdGVkLFxuICAgICAgcm91dGUsXG4gICAgICBlc3RpbWF0ZWRHYXNVc2VkLFxuICAgICAgZXN0aW1hdGVkR2FzVXNlZFF1b3RlVG9rZW4sXG4gICAgICBlc3RpbWF0ZWRHYXNVc2VkVVNELFxuICAgICAgZ2FzUHJpY2VXZWksXG4gICAgICBtZXRob2RQYXJhbWV0ZXJzLFxuICAgICAgYmxvY2tOdW1iZXIsXG4gICAgICBzaW11bGF0aW9uU3RhdHVzLFxuICAgIH0gPSBzd2FwUm91dGVcblxuICAgIGlmIChzaW11bGF0aW9uU3RhdHVzID09IFNpbXVsYXRpb25TdGF0dXMuRmFpbGVkKSB7XG4gICAgICBtZXRyaWMucHV0TWV0cmljKCdTaW11bGF0aW9uRmFpbGVkJywgMSwgTWV0cmljTG9nZ2VyVW5pdC5Db3VudClcbiAgICB9IGVsc2UgaWYgKHNpbXVsYXRpb25TdGF0dXMgPT0gU2ltdWxhdGlvblN0YXR1cy5TdWNjZWVkZWQpIHtcbiAgICAgIG1ldHJpYy5wdXRNZXRyaWMoJ1NpbXVsYXRpb25TdWNjZXNzZnVsJywgMSwgTWV0cmljTG9nZ2VyVW5pdC5Db3VudClcbiAgICB9IGVsc2UgaWYgKHNpbXVsYXRpb25TdGF0dXMgPT0gU2ltdWxhdGlvblN0YXR1cy5JbnN1ZmZpY2llbnRCYWxhbmNlKSB7XG4gICAgICBtZXRyaWMucHV0TWV0cmljKCdTaW11bGF0aW9uSW5zdWZmaWNpZW50QmFsYW5jZScsIDEsIE1ldHJpY0xvZ2dlclVuaXQuQ291bnQpXG4gICAgfSBlbHNlIGlmIChzaW11bGF0aW9uU3RhdHVzID09IFNpbXVsYXRpb25TdGF0dXMuTm90QXBwcm92ZWQpIHtcbiAgICAgIG1ldHJpYy5wdXRNZXRyaWMoJ1NpbXVsYXRpb25Ob3RBcHByb3ZlZCcsIDEsIE1ldHJpY0xvZ2dlclVuaXQuQ291bnQpXG4gICAgfSBlbHNlIGlmIChzaW11bGF0aW9uU3RhdHVzID09IFNpbXVsYXRpb25TdGF0dXMuTm90U3VwcG9ydGVkKSB7XG4gICAgICBtZXRyaWMucHV0TWV0cmljKCdTaW11bGF0aW9uTm90U3VwcG9ydGVkJywgMSwgTWV0cmljTG9nZ2VyVW5pdC5Db3VudClcbiAgICB9XG5cbiAgICBjb25zdCByb3V0ZVJlc3BvbnNlOiBBcnJheTwoVjNQb29sSW5Sb3V0ZSB8IFYyUG9vbEluUm91dGUpW10+ID0gW11cblxuICAgIGZvciAoY29uc3Qgc3ViUm91dGUgb2Ygcm91dGUpIHtcbiAgICAgIGNvbnN0IHsgYW1vdW50LCBxdW90ZSwgdG9rZW5QYXRoIH0gPSBzdWJSb3V0ZVxuXG4gICAgICBjb25zdCBwb29scyA9IHN1YlJvdXRlLnByb3RvY29sID09IFByb3RvY29sLlYyID8gc3ViUm91dGUucm91dGUucGFpcnMgOiBzdWJSb3V0ZS5yb3V0ZS5wb29sc1xuICAgICAgY29uc3QgY3VyUm91dGU6IChWM1Bvb2xJblJvdXRlIHwgVjJQb29sSW5Sb3V0ZSlbXSA9IFtdXG4gICAgICBmb3IgKGxldCBpID0gMDsgaSA8IHBvb2xzLmxlbmd0aDsgaSsrKSB7XG4gICAgICAgIGNvbnN0IG5leHRQb29sID0gcG9vbHNbaV1cbiAgICAgICAgY29uc3QgdG9rZW5JbiA9IHRva2VuUGF0aFtpXVxuICAgICAgICBjb25zdCB0b2tlbk91dCA9IHRva2VuUGF0aFtpICsgMV1cblxuICAgICAgICBsZXQgZWRnZUFtb3VudEluID0gdW5kZWZpbmVkXG4gICAgICAgIGlmIChpID09IDApIHtcbiAgICAgICAgICBlZGdlQW1vdW50SW4gPSB0eXBlID09ICdleGFjdEluJyA/IGFtb3VudC5xdW90aWVudC50b1N0cmluZygpIDogcXVvdGUucXVvdGllbnQudG9TdHJpbmcoKVxuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGVkZ2VBbW91bnRPdXQgPSB1bmRlZmluZWRcbiAgICAgICAgaWYgKGkgPT0gcG9vbHMubGVuZ3RoIC0gMSkge1xuICAgICAgICAgIGVkZ2VBbW91bnRPdXQgPSB0eXBlID09ICdleGFjdEluJyA/IHF1b3RlLnF1b3RpZW50LnRvU3RyaW5nKCkgOiBhbW91bnQucXVvdGllbnQudG9TdHJpbmcoKVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5leHRQb29sIGluc3RhbmNlb2YgUG9vbCkge1xuICAgICAgICAgIGN1clJvdXRlLnB1c2goe1xuICAgICAgICAgICAgdHlwZTogJ3YzLXBvb2wnLFxuICAgICAgICAgICAgYWRkcmVzczogdjNQb29sUHJvdmlkZXIuZ2V0UG9vbEFkZHJlc3MobmV4dFBvb2wudG9rZW4wLCBuZXh0UG9vbC50b2tlbjEsIG5leHRQb29sLmZlZSkucG9vbEFkZHJlc3MsXG4gICAgICAgICAgICB0b2tlbkluOiB7XG4gICAgICAgICAgICAgIGNoYWluSWQ6IHRva2VuSW4uY2hhaW5JZCxcbiAgICAgICAgICAgICAgZGVjaW1hbHM6IHRva2VuSW4uZGVjaW1hbHMudG9TdHJpbmcoKSxcbiAgICAgICAgICAgICAgYWRkcmVzczogdG9rZW5Jbi5hZGRyZXNzLFxuICAgICAgICAgICAgICBzeW1ib2w6IHRva2VuSW4uc3ltYm9sISxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB0b2tlbk91dDoge1xuICAgICAgICAgICAgICBjaGFpbklkOiB0b2tlbk91dC5jaGFpbklkLFxuICAgICAgICAgICAgICBkZWNpbWFsczogdG9rZW5PdXQuZGVjaW1hbHMudG9TdHJpbmcoKSxcbiAgICAgICAgICAgICAgYWRkcmVzczogdG9rZW5PdXQuYWRkcmVzcyxcbiAgICAgICAgICAgICAgc3ltYm9sOiB0b2tlbk91dC5zeW1ib2whLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGZlZTogbmV4dFBvb2wuZmVlLnRvU3RyaW5nKCksXG4gICAgICAgICAgICBsaXF1aWRpdHk6IG5leHRQb29sLmxpcXVpZGl0eS50b1N0cmluZygpLFxuICAgICAgICAgICAgc3FydFJhdGlvWDk2OiBuZXh0UG9vbC5zcXJ0UmF0aW9YOTYudG9TdHJpbmcoKSxcbiAgICAgICAgICAgIHRpY2tDdXJyZW50OiBuZXh0UG9vbC50aWNrQ3VycmVudC50b1N0cmluZygpLFxuICAgICAgICAgICAgYW1vdW50SW46IGVkZ2VBbW91bnRJbixcbiAgICAgICAgICAgIGFtb3VudE91dDogZWRnZUFtb3VudE91dCxcbiAgICAgICAgICB9KVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGNvbnN0IHJlc2VydmUwID0gbmV4dFBvb2wucmVzZXJ2ZTBcbiAgICAgICAgICBjb25zdCByZXNlcnZlMSA9IG5leHRQb29sLnJlc2VydmUxXG5cbiAgICAgICAgICBjdXJSb3V0ZS5wdXNoKHtcbiAgICAgICAgICAgIHR5cGU6ICd2Mi1wb29sJyxcbiAgICAgICAgICAgIGFkZHJlc3M6IHYyUG9vbFByb3ZpZGVyLmdldFBvb2xBZGRyZXNzKG5leHRQb29sLnRva2VuMCwgbmV4dFBvb2wudG9rZW4xKS5wb29sQWRkcmVzcyxcbiAgICAgICAgICAgIHRva2VuSW46IHtcbiAgICAgICAgICAgICAgY2hhaW5JZDogdG9rZW5Jbi5jaGFpbklkLFxuICAgICAgICAgICAgICBkZWNpbWFsczogdG9rZW5Jbi5kZWNpbWFscy50b1N0cmluZygpLFxuICAgICAgICAgICAgICBhZGRyZXNzOiB0b2tlbkluLmFkZHJlc3MsXG4gICAgICAgICAgICAgIHN5bWJvbDogdG9rZW5Jbi5zeW1ib2whLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHRva2VuT3V0OiB7XG4gICAgICAgICAgICAgIGNoYWluSWQ6IHRva2VuT3V0LmNoYWluSWQsXG4gICAgICAgICAgICAgIGRlY2ltYWxzOiB0b2tlbk91dC5kZWNpbWFscy50b1N0cmluZygpLFxuICAgICAgICAgICAgICBhZGRyZXNzOiB0b2tlbk91dC5hZGRyZXNzLFxuICAgICAgICAgICAgICBzeW1ib2w6IHRva2VuT3V0LnN5bWJvbCEsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgcmVzZXJ2ZTA6IHtcbiAgICAgICAgICAgICAgdG9rZW46IHtcbiAgICAgICAgICAgICAgICBjaGFpbklkOiByZXNlcnZlMC5jdXJyZW5jeS53cmFwcGVkLmNoYWluSWQsXG4gICAgICAgICAgICAgICAgZGVjaW1hbHM6IHJlc2VydmUwLmN1cnJlbmN5LndyYXBwZWQuZGVjaW1hbHMudG9TdHJpbmcoKSxcbiAgICAgICAgICAgICAgICBhZGRyZXNzOiByZXNlcnZlMC5jdXJyZW5jeS53cmFwcGVkLmFkZHJlc3MsXG4gICAgICAgICAgICAgICAgc3ltYm9sOiByZXNlcnZlMC5jdXJyZW5jeS53cmFwcGVkLnN5bWJvbCEsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIHF1b3RpZW50OiByZXNlcnZlMC5xdW90aWVudC50b1N0cmluZygpLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHJlc2VydmUxOiB7XG4gICAgICAgICAgICAgIHRva2VuOiB7XG4gICAgICAgICAgICAgICAgY2hhaW5JZDogcmVzZXJ2ZTEuY3VycmVuY3kud3JhcHBlZC5jaGFpbklkLFxuICAgICAgICAgICAgICAgIGRlY2ltYWxzOiByZXNlcnZlMS5jdXJyZW5jeS53cmFwcGVkLmRlY2ltYWxzLnRvU3RyaW5nKCksXG4gICAgICAgICAgICAgICAgYWRkcmVzczogcmVzZXJ2ZTEuY3VycmVuY3kud3JhcHBlZC5hZGRyZXNzLFxuICAgICAgICAgICAgICAgIHN5bWJvbDogcmVzZXJ2ZTEuY3VycmVuY3kud3JhcHBlZC5zeW1ib2whLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBxdW90aWVudDogcmVzZXJ2ZTEucXVvdGllbnQudG9TdHJpbmcoKSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBhbW91bnRJbjogZWRnZUFtb3VudEluLFxuICAgICAgICAgICAgYW1vdW50T3V0OiBlZGdlQW1vdW50T3V0LFxuICAgICAgICAgIH0pXG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcm91dGVSZXNwb25zZS5wdXNoKGN1clJvdXRlKVxuICAgIH1cblxuICAgIGNvbnN0IHJvdXRlU3RyaW5nID0gcm91dGVBbW91bnRzVG9TdHJpbmcocm91dGUpXG5cbiAgICBjb25zdCByZXN1bHQ6IFF1b3RlUmVzcG9uc2UgPSB7XG4gICAgICBtZXRob2RQYXJhbWV0ZXJzLFxuICAgICAgYmxvY2tOdW1iZXI6IGJsb2NrTnVtYmVyLnRvU3RyaW5nKCksXG4gICAgICBhbW91bnQ6IGFtb3VudC5xdW90aWVudC50b1N0cmluZygpLFxuICAgICAgYW1vdW50RGVjaW1hbHM6IGFtb3VudC50b0V4YWN0KCksXG4gICAgICBxdW90ZTogcXVvdGUucXVvdGllbnQudG9TdHJpbmcoKSxcbiAgICAgIHF1b3RlRGVjaW1hbHM6IHF1b3RlLnRvRXhhY3QoKSxcbiAgICAgIHF1b3RlR2FzQWRqdXN0ZWQ6IHF1b3RlR2FzQWRqdXN0ZWQucXVvdGllbnQudG9TdHJpbmcoKSxcbiAgICAgIHF1b3RlR2FzQWRqdXN0ZWREZWNpbWFsczogcXVvdGVHYXNBZGp1c3RlZC50b0V4YWN0KCksXG4gICAgICBnYXNVc2VFc3RpbWF0ZVF1b3RlOiBlc3RpbWF0ZWRHYXNVc2VkUXVvdGVUb2tlbi5xdW90aWVudC50b1N0cmluZygpLFxuICAgICAgZ2FzVXNlRXN0aW1hdGVRdW90ZURlY2ltYWxzOiBlc3RpbWF0ZWRHYXNVc2VkUXVvdGVUb2tlbi50b0V4YWN0KCksXG4gICAgICBnYXNVc2VFc3RpbWF0ZTogZXN0aW1hdGVkR2FzVXNlZC50b1N0cmluZygpLFxuICAgICAgZ2FzVXNlRXN0aW1hdGVVU0Q6IGVzdGltYXRlZEdhc1VzZWRVU0QudG9FeGFjdCgpLFxuICAgICAgc2ltdWxhdGlvblN0YXR1czogc2ltdWxhdGlvblN0YXR1c1RvU3RyaW5nKHNpbXVsYXRpb25TdGF0dXMsIGxvZyksXG4gICAgICBzaW11bGF0aW9uRXJyb3I6IHNpbXVsYXRpb25TdGF0dXMgPT0gU2ltdWxhdGlvblN0YXR1cy5GYWlsZWQsXG4gICAgICBnYXNQcmljZVdlaTogZ2FzUHJpY2VXZWkudG9TdHJpbmcoKSxcbiAgICAgIHJvdXRlOiByb3V0ZVJlc3BvbnNlLFxuICAgICAgcm91dGVTdHJpbmcsXG4gICAgICBxdW90ZUlkLFxuICAgIH1cblxuICAgIHRoaXMubG9nUm91dGVNZXRyaWNzKFxuICAgICAgbG9nLFxuICAgICAgbWV0cmljLFxuICAgICAgc3RhcnRUaW1lLFxuICAgICAgY3VycmVuY3lJbixcbiAgICAgIGN1cnJlbmN5T3V0LFxuICAgICAgdG9rZW5JbkFkZHJlc3MsXG4gICAgICB0b2tlbk91dEFkZHJlc3MsXG4gICAgICB0eXBlLFxuICAgICAgY2hhaW5JZCxcbiAgICAgIGFtb3VudCxcbiAgICAgIHJvdXRlU3RyaW5nXG4gICAgKVxuXG4gICAgcmV0dXJuIHtcbiAgICAgIHN0YXR1c0NvZGU6IDIwMCxcbiAgICAgIGJvZHk6IHJlc3VsdCxcbiAgICB9XG4gIH1cblxuICBwcml2YXRlIGxvZ1JvdXRlTWV0cmljcyhcbiAgICBsb2c6IExvZ2dlcixcbiAgICBtZXRyaWM6IElNZXRyaWMsXG4gICAgc3RhcnRUaW1lOiBudW1iZXIsXG4gICAgY3VycmVuY3lJbjogQ3VycmVuY3ksXG4gICAgY3VycmVuY3lPdXQ6IEN1cnJlbmN5LFxuICAgIHRva2VuSW5BZGRyZXNzOiBzdHJpbmcsXG4gICAgdG9rZW5PdXRBZGRyZXNzOiBzdHJpbmcsXG4gICAgdHJhZGVUeXBlOiAnZXhhY3RJbicgfCAnZXhhY3RPdXQnLFxuICAgIGNoYWluSWQ6IENoYWluSWQsXG4gICAgYW1vdW50OiBDdXJyZW5jeUFtb3VudDxDdXJyZW5jeT4sXG4gICAgcm91dGVTdHJpbmc6IHN0cmluZ1xuICApOiB2b2lkIHtcbiAgICBjb25zdCB0cmFkaW5nUGFpciA9IGAke2N1cnJlbmN5SW4ud3JhcHBlZC5zeW1ib2x9LyR7Y3VycmVuY3lPdXQud3JhcHBlZC5zeW1ib2x9YFxuICAgIGNvbnN0IHdpbGRjYXJkSW5QYWlyID0gYCR7Y3VycmVuY3lJbi53cmFwcGVkLnN5bWJvbH0vKmBcbiAgICBjb25zdCB3aWxkY2FyZE91dFBhaXIgPSBgKi8ke2N1cnJlbmN5T3V0LndyYXBwZWQuc3ltYm9sfWBcbiAgICBjb25zdCB0cmFkZVR5cGVFbnVtVmFsdWUgPSB0cmFkZVR5cGUgPT0gJ2V4YWN0SW4nID8gVHJhZGVUeXBlLkVYQUNUX0lOUFVUIDogVHJhZGVUeXBlLkVYQUNUX09VVFBVVFxuICAgIGNvbnN0IHBhaXJzVHJhY2tlZCA9IFBBSVJTX1RPX1RSQUNLLmdldChjaGFpbklkKT8uZ2V0KHRyYWRlVHlwZUVudW1WYWx1ZSlcblxuICAgIGlmIChcbiAgICAgIHBhaXJzVHJhY2tlZD8uaW5jbHVkZXModHJhZGluZ1BhaXIpIHx8XG4gICAgICBwYWlyc1RyYWNrZWQ/LmluY2x1ZGVzKHdpbGRjYXJkSW5QYWlyKSB8fFxuICAgICAgcGFpcnNUcmFja2VkPy5pbmNsdWRlcyh3aWxkY2FyZE91dFBhaXIpXG4gICAgKSB7XG4gICAgICBjb25zdCBtZXRyaWNQYWlyID0gcGFpcnNUcmFja2VkPy5pbmNsdWRlcyh0cmFkaW5nUGFpcilcbiAgICAgICAgPyB0cmFkaW5nUGFpclxuICAgICAgICA6IHBhaXJzVHJhY2tlZD8uaW5jbHVkZXMod2lsZGNhcmRJblBhaXIpXG4gICAgICAgID8gd2lsZGNhcmRJblBhaXJcbiAgICAgICAgOiB3aWxkY2FyZE91dFBhaXJcblxuICAgICAgbWV0cmljLnB1dE1ldHJpYyhcbiAgICAgICAgYEdFVF9RVU9URV9BTU9VTlRfJHttZXRyaWNQYWlyfV8ke3RyYWRlVHlwZS50b1VwcGVyQ2FzZSgpfV9DSEFJTl8ke2NoYWluSWR9YCxcbiAgICAgICAgTnVtYmVyKGFtb3VudC50b0V4YWN0KCkpLFxuICAgICAgICBNZXRyaWNMb2dnZXJVbml0Lk5vbmVcbiAgICAgIClcblxuICAgICAgbWV0cmljLnB1dE1ldHJpYyhcbiAgICAgICAgYEdFVF9RVU9URV9MQVRFTkNZXyR7bWV0cmljUGFpcn1fJHt0cmFkZVR5cGUudG9VcHBlckNhc2UoKX1fQ0hBSU5fJHtjaGFpbklkfWAsXG4gICAgICAgIERhdGUubm93KCkgLSBzdGFydFRpbWUsXG4gICAgICAgIE1ldHJpY0xvZ2dlclVuaXQuTWlsbGlzZWNvbmRzXG4gICAgICApXG4gICAgICAvLyBDcmVhdGUgYSBoYXNoY29kZSBmcm9tIHRoZSByb3V0ZVN0cmluZywgdGhpcyB3aWxsIGluZGljYXRlIHRoYXQgYSBkaWZmZXJlbnQgcm91dGUgaXMgYmVpbmcgdXNlZFxuICAgICAgLy8gaGFzaGNvZGUgZnVuY3Rpb24gY29waWVkIGZyb206IGh0dHBzOi8vZ2lzdC5naXRodWIuY29tL2h5YW1hbW90by9mZDQzNTUwNWQyOWViZmEzZDk3MTZmZDJiZThkNDJmMD9wZXJtYWxpbmtfY29tbWVudF9pZD00MjYxNzI4I2dpc3Rjb21tZW50LTQyNjE3MjhcbiAgICAgIGNvbnN0IHJvdXRlU3RyaW5nSGFzaCA9IE1hdGguYWJzKFxuICAgICAgICByb3V0ZVN0cmluZy5zcGxpdCgnJykucmVkdWNlKChzLCBjKSA9PiAoTWF0aC5pbXVsKDMxLCBzKSArIGMuY2hhckNvZGVBdCgwKSkgfCAwLCAwKVxuICAgICAgKVxuICAgICAgLy8gTG9nIHRoZSBjaG9zZSByb3V0ZVxuICAgICAgbG9nLmluZm8oXG4gICAgICAgIHtcbiAgICAgICAgICB0cmFkaW5nUGFpcixcbiAgICAgICAgICB0b2tlbkluQWRkcmVzcyxcbiAgICAgICAgICB0b2tlbk91dEFkZHJlc3MsXG4gICAgICAgICAgdHJhZGVUeXBlLFxuICAgICAgICAgIGFtb3VudDogYW1vdW50LnRvRXhhY3QoKSxcbiAgICAgICAgICByb3V0ZVN0cmluZyxcbiAgICAgICAgICByb3V0ZVN0cmluZ0hhc2gsXG4gICAgICAgICAgY2hhaW5JZCxcbiAgICAgICAgfSxcbiAgICAgICAgYFRyYWNrZWQgUm91dGUgZm9yIHBhaXIgWyR7dHJhZGluZ1BhaXJ9LyR7dHJhZGVUeXBlLnRvVXBwZXJDYXNlKCl9XSBvbiBjaGFpbiBbJHtjaGFpbklkfV0gd2l0aCByb3V0ZSBoYXNoIFske3JvdXRlU3RyaW5nSGFzaH1dIGZvciBhbW91bnQgWyR7YW1vdW50LnRvRXhhY3QoKX1dYFxuICAgICAgKVxuICAgIH1cbiAgfVxuXG4gIHByb3RlY3RlZCByZXF1ZXN0Qm9keVNjaGVtYSgpOiBKb2kuT2JqZWN0U2NoZW1hIHwgbnVsbCB7XG4gICAgcmV0dXJuIG51bGxcbiAgfVxuXG4gIHByb3RlY3RlZCByZXF1ZXN0UXVlcnlQYXJhbXNTY2hlbWEoKTogSm9pLk9iamVjdFNjaGVtYSB8IG51bGwge1xuICAgIHJldHVybiBRdW90ZVF1ZXJ5UGFyYW1zSm9pXG4gIH1cblxuICBwcm90ZWN0ZWQgcmVzcG9uc2VCb2R5U2NoZW1hKCk6IEpvaS5PYmplY3RTY2hlbWEgfCBudWxsIHtcbiAgICByZXR1cm4gUXVvdGVSZXNwb25zZVNjaGVtYUpvaVxuICB9XG59XG4iXX0=