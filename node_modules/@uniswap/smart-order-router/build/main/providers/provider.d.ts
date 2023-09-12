import { BigNumber } from '@ethersproject/bignumber';
export declare type ProviderConfig = {
    /**
     * The block number to use when getting data on-chain.
     */
    blockNumber?: number | Promise<number>;
    additionalGasOverhead?: BigNumber;
    debugRouting?: boolean;
};
export declare type LocalCacheEntry<T> = {
    entry: T;
    blockNumber: number;
};
