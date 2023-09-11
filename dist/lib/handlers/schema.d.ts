/// <reference types="hapi__joi" />
import Joi from '@hapi/joi';
import { MethodParameters } from '@uniswap/smart-order-router';
export declare type TokenInRoute = {
    address: string;
    chainId: number;
    symbol: string;
    decimals: string;
};
export declare type V3PoolInRoute = {
    type: 'v3-pool';
    address: string;
    tokenIn: TokenInRoute;
    tokenOut: TokenInRoute;
    sqrtRatioX96: string;
    liquidity: string;
    tickCurrent: string;
    fee: string;
    amountIn?: string;
    amountOut?: string;
};
export declare type V2Reserve = {
    token: TokenInRoute;
    quotient: string;
};
export declare type V2PoolInRoute = {
    type: 'v2-pool';
    address: string;
    tokenIn: TokenInRoute;
    tokenOut: TokenInRoute;
    reserve0: V2Reserve;
    reserve1: V2Reserve;
    amountIn?: string;
    amountOut?: string;
};
export declare const QuoteResponseSchemaJoi: Joi.ObjectSchema<any>;
export declare type QuoteResponse = {
    quoteId: string;
    amount: string;
    amountDecimals: string;
    quote: string;
    quoteDecimals: string;
    quoteGasAdjusted: string;
    quoteGasAdjustedDecimals: string;
    gasUseEstimate: string;
    gasUseEstimateQuote: string;
    gasUseEstimateQuoteDecimals: string;
    gasUseEstimateUSD: string;
    simulationError?: boolean;
    simulationStatus: string;
    gasPriceWei: string;
    blockNumber: string;
    route: Array<(V3PoolInRoute | V2PoolInRoute)[]>;
    routeString: string;
    methodParameters?: MethodParameters;
};
