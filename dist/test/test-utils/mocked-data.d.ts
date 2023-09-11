import { Pool } from '@uniswap/v3-sdk';
import { V3PoolAccessor } from '@uniswap/smart-order-router/build/main/providers/v3/pool-provider';
export declare const USDC_DAI_LOW: Pool;
export declare const USDC_DAI_MEDIUM: Pool;
export declare const USDC_WETH_LOW: Pool;
export declare const WETH9_USDT_LOW: Pool;
export declare const DAI_USDT_LOW: Pool;
export declare const SUPPORTED_POOLS: Pool[];
export declare const buildMockV3PoolAccessor: (pools: Pool[]) => V3PoolAccessor;
