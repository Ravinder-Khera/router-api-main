import { ChainId, Currency, Percent } from '@uniswap/sdk-core';
import { AlphaRouterConfig, ITokenListProvider, ITokenProvider } from '@uniswap/smart-order-router';
import Logger from 'bunyan';
export declare const DEFAULT_ROUTING_CONFIG_BY_CHAIN: (chainId: ChainId) => AlphaRouterConfig;
export declare function tokenStringToCurrency(tokenListProvider: ITokenListProvider, tokenProvider: ITokenProvider, tokenRaw: string, chainId: ChainId, log: Logger): Promise<Currency | undefined>;
export declare function parseSlippageTolerance(slippageTolerance: string): Percent;
export declare function parseDeadline(deadline: string): number;
