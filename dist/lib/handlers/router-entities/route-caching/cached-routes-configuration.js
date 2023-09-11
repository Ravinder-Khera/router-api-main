import { ChainId, TradeType } from '@uniswap/sdk-core';
import { CacheMode } from '@uniswap/smart-order-router';
import { CachedRoutesStrategy } from './model/cached-routes-strategy';
import { PairTradeTypeChainId } from './model/pair-trade-type-chain-id';
import { CachedRoutesBucket } from './model/cached-routes-bucket';
/**
 * This is the main configuration for the caching strategies of routes.
 *
 * The keys are generated by calling the `toString` method in the `PairTradeTypeChainId` class,
 * this way we can guarantee the correct format of the key.
 *
 * The values are an object of type `CachedRoutesStrategy`.
 * which receive an array of `CachedRoutesParameters` with the configuration of the buckets.
 */
export const CACHED_ROUTES_CONFIGURATION = new Map([
    /**
     * WETH/USDC - Mainnet
     */
    [
        new PairTradeTypeChainId({
            tokenIn: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            tokenOut: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            tradeType: TradeType.EXACT_INPUT,
            chainId: ChainId.MAINNET,
        }).toString(),
        new CachedRoutesStrategy({
            pair: 'WETH/USDC',
            tradeType: TradeType.EXACT_INPUT,
            chainId: ChainId.MAINNET,
            buckets: [
                new CachedRoutesBucket({ bucket: 0.2, cacheMode: CacheMode.Livemode }),
                new CachedRoutesBucket({ bucket: 1, cacheMode: CacheMode.Livemode }),
                new CachedRoutesBucket({ bucket: 3, cacheMode: CacheMode.Livemode }),
                new CachedRoutesBucket({ bucket: 5, cacheMode: CacheMode.Livemode }),
                new CachedRoutesBucket({ bucket: 8, cacheMode: CacheMode.Livemode }),
                new CachedRoutesBucket({ bucket: 13, cacheMode: CacheMode.Livemode }),
                new CachedRoutesBucket({ bucket: 21, cacheMode: CacheMode.Livemode }),
                new CachedRoutesBucket({ bucket: 34, cacheMode: CacheMode.Livemode }),
                new CachedRoutesBucket({ bucket: 55, cacheMode: CacheMode.Livemode }),
            ],
        }),
    ],
    /**
     * USDC/WETH - Mainnet
     */
    [
        new PairTradeTypeChainId({
            tokenIn: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            tokenOut: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            tradeType: TradeType.EXACT_INPUT,
            chainId: ChainId.MAINNET,
        }).toString(),
        new CachedRoutesStrategy({
            pair: 'USDC/WETH',
            tradeType: TradeType.EXACT_INPUT,
            chainId: ChainId.MAINNET,
            buckets: [
                new CachedRoutesBucket({ bucket: 500, cacheMode: CacheMode.Livemode }),
                new CachedRoutesBucket({ bucket: 1000, cacheMode: CacheMode.Livemode }),
                new CachedRoutesBucket({ bucket: 3000, cacheMode: CacheMode.Livemode }),
                new CachedRoutesBucket({ bucket: 8000, cacheMode: CacheMode.Livemode }),
                new CachedRoutesBucket({ bucket: 13000, cacheMode: CacheMode.Livemode }),
                new CachedRoutesBucket({ bucket: 21000, cacheMode: CacheMode.Livemode }),
                new CachedRoutesBucket({ bucket: 34000, cacheMode: CacheMode.Livemode }),
                new CachedRoutesBucket({ bucket: 55000, cacheMode: CacheMode.Livemode }),
                new CachedRoutesBucket({ bucket: 89000, cacheMode: CacheMode.Livemode }),
            ],
        }),
    ],
    /**
     * WETH/USDT - Mainnet
     */
    [
        new PairTradeTypeChainId({
            tokenIn: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            tokenOut: '0xdac17f958d2ee523a2206206994597c13d831ec7',
            tradeType: TradeType.EXACT_INPUT,
            chainId: ChainId.MAINNET,
        }).toString(),
        new CachedRoutesStrategy({
            pair: 'WETH/USDT',
            tradeType: TradeType.EXACT_INPUT,
            chainId: ChainId.MAINNET,
            buckets: [
                new CachedRoutesBucket({ bucket: 0.2, cacheMode: CacheMode.Livemode }),
                new CachedRoutesBucket({ bucket: 1, cacheMode: CacheMode.Livemode }),
                new CachedRoutesBucket({ bucket: 3, cacheMode: CacheMode.Livemode }),
                new CachedRoutesBucket({ bucket: 5, cacheMode: CacheMode.Livemode }),
                new CachedRoutesBucket({ bucket: 8, cacheMode: CacheMode.Livemode }),
                new CachedRoutesBucket({ bucket: 13, cacheMode: CacheMode.Livemode }),
                new CachedRoutesBucket({ bucket: 21, cacheMode: CacheMode.Livemode }),
                new CachedRoutesBucket({ bucket: 34, cacheMode: CacheMode.Livemode }),
                new CachedRoutesBucket({ bucket: 55, cacheMode: CacheMode.Livemode }),
            ],
        }),
    ],
    /**
     * USDT/WETH - Mainnet
     */
    [
        new PairTradeTypeChainId({
            tokenIn: '0xdac17f958d2ee523a2206206994597c13d831ec7',
            tokenOut: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            tradeType: TradeType.EXACT_INPUT,
            chainId: ChainId.MAINNET,
        }).toString(),
        new CachedRoutesStrategy({
            pair: 'USDT/WETH',
            tradeType: TradeType.EXACT_INPUT,
            chainId: ChainId.MAINNET,
            buckets: [
                new CachedRoutesBucket({ bucket: 500, cacheMode: CacheMode.Livemode }),
                new CachedRoutesBucket({ bucket: 1000, cacheMode: CacheMode.Livemode }),
                new CachedRoutesBucket({ bucket: 3000, cacheMode: CacheMode.Livemode }),
                new CachedRoutesBucket({ bucket: 8000, cacheMode: CacheMode.Livemode }),
                new CachedRoutesBucket({ bucket: 13000, cacheMode: CacheMode.Livemode }),
                new CachedRoutesBucket({ bucket: 21000, cacheMode: CacheMode.Livemode }),
                new CachedRoutesBucket({ bucket: 34000, cacheMode: CacheMode.Livemode }),
                new CachedRoutesBucket({ bucket: 55000, cacheMode: CacheMode.Livemode }),
                new CachedRoutesBucket({ bucket: 89000, cacheMode: CacheMode.Livemode }),
            ],
        }),
    ],
    [
        new PairTradeTypeChainId({
            tokenIn: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            tokenOut: '*',
            tradeType: TradeType.EXACT_INPUT,
            chainId: ChainId.MAINNET,
        }).toString(),
        new CachedRoutesStrategy({
            pair: 'WETH/*',
            tradeType: TradeType.EXACT_INPUT,
            chainId: ChainId.MAINNET,
            buckets: [
                // Any amounts lower than 0.015 in Mainnet are likely to be heavily influenced by the gas prices. Darkmoding everything below 0.01
                new CachedRoutesBucket({ bucket: 0.015, cacheMode: CacheMode.Darkmode }),
                new CachedRoutesBucket({ bucket: 0.05, cacheMode: CacheMode.Livemode, withLastNCachedRoutes: 20 }),
                new CachedRoutesBucket({ bucket: 0.1, cacheMode: CacheMode.Livemode, withLastNCachedRoutes: 20 }),
                new CachedRoutesBucket({ bucket: 0.5, cacheMode: CacheMode.Livemode, withLastNCachedRoutes: 20 }),
                new CachedRoutesBucket({ bucket: 1, cacheMode: CacheMode.Livemode, withLastNCachedRoutes: 20 }),
                new CachedRoutesBucket({ bucket: 2, cacheMode: CacheMode.Livemode, withLastNCachedRoutes: 15 }),
                new CachedRoutesBucket({ bucket: 3, cacheMode: CacheMode.Livemode, withLastNCachedRoutes: 15 }),
                new CachedRoutesBucket({ bucket: 4, cacheMode: CacheMode.Livemode, withLastNCachedRoutes: 15 }),
                new CachedRoutesBucket({ bucket: 5, cacheMode: CacheMode.Livemode, withLastNCachedRoutes: 15 }),
            ],
        }),
    ],
    [
        new PairTradeTypeChainId({
            tokenIn: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            tokenOut: '*',
            tradeType: TradeType.EXACT_INPUT,
            chainId: ChainId.MAINNET,
        }).toString(),
        new CachedRoutesStrategy({
            pair: 'USDC/*',
            tradeType: TradeType.EXACT_INPUT,
            chainId: ChainId.MAINNET,
            buckets: [
                new CachedRoutesBucket({ bucket: 100, cacheMode: CacheMode.Darkmode, withLastNCachedRoutes: 10 }),
                new CachedRoutesBucket({ bucket: 300, cacheMode: CacheMode.Livemode, withLastNCachedRoutes: 10 }),
                new CachedRoutesBucket({ bucket: 500, cacheMode: CacheMode.Livemode, withLastNCachedRoutes: 10 }),
                new CachedRoutesBucket({ bucket: 750, cacheMode: CacheMode.Livemode, withLastNCachedRoutes: 10 }),
                new CachedRoutesBucket({ bucket: 1000, cacheMode: CacheMode.Livemode, withLastNCachedRoutes: 10 }),
                new CachedRoutesBucket({ bucket: 3000, cacheMode: CacheMode.Livemode, withLastNCachedRoutes: 10 }),
                new CachedRoutesBucket({ bucket: 8000, cacheMode: CacheMode.Livemode, withLastNCachedRoutes: 10 }),
                new CachedRoutesBucket({ bucket: 13000, cacheMode: CacheMode.Livemode, withLastNCachedRoutes: 10 }),
            ],
        }),
    ],
    /**
     * NOTE: Only Cache configuration for Pricing below this comment
     * These configurations are influenced by the frontend configuration:
     * https://github.com/Uniswap/interface/blob/main/src/hooks/useUSDPrice.ts#L15
     */
    [
        new PairTradeTypeChainId({
            tokenIn: '*',
            tokenOut: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            tradeType: TradeType.EXACT_OUTPUT,
            chainId: ChainId.MAINNET,
        }).toString(),
        new CachedRoutesStrategy({
            pair: '*/WETH',
            tradeType: TradeType.EXACT_OUTPUT,
            chainId: ChainId.MAINNET,
            buckets: [
                new CachedRoutesBucket({ bucket: 0.015, cacheMode: CacheMode.Darkmode }),
                new CachedRoutesBucket({ bucket: 0.05, cacheMode: CacheMode.Darkmode }),
                new CachedRoutesBucket({ bucket: 0.1, cacheMode: CacheMode.Tapcompare, withLastNCachedRoutes: 10 }),
                new CachedRoutesBucket({ bucket: 0.5, cacheMode: CacheMode.Tapcompare, withLastNCachedRoutes: 10 }),
                new CachedRoutesBucket({ bucket: 1, cacheMode: CacheMode.Tapcompare, withLastNCachedRoutes: 10 }),
                new CachedRoutesBucket({ bucket: 2, cacheMode: CacheMode.Tapcompare, withLastNCachedRoutes: 10 }),
                new CachedRoutesBucket({ bucket: 4, cacheMode: CacheMode.Tapcompare, withLastNCachedRoutes: 10 }),
                new CachedRoutesBucket({ bucket: 6, cacheMode: CacheMode.Tapcompare, withLastNCachedRoutes: 10 }),
                new CachedRoutesBucket({ bucket: 10, cacheMode: CacheMode.Tapcompare, withLastNCachedRoutes: 10 }),
                new CachedRoutesBucket({ bucket: 16, cacheMode: CacheMode.Tapcompare, withLastNCachedRoutes: 10 }),
                new CachedRoutesBucket({ bucket: 30, cacheMode: CacheMode.Tapcompare, withLastNCachedRoutes: 10 }),
                new CachedRoutesBucket({ bucket: 45, cacheMode: CacheMode.Tapcompare, withLastNCachedRoutes: 10 }),
                new CachedRoutesBucket({ bucket: 55, cacheMode: CacheMode.Livemode, withLastNCachedRoutes: 10 }),
                new CachedRoutesBucket({ bucket: 80, cacheMode: CacheMode.Tapcompare, withLastNCachedRoutes: 10 }),
                new CachedRoutesBucket({ bucket: 95, cacheMode: CacheMode.Tapcompare, withLastNCachedRoutes: 10 }),
                new CachedRoutesBucket({ bucket: 110, cacheMode: CacheMode.Tapcompare, withLastNCachedRoutes: 10 }),
            ],
        }),
    ],
]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FjaGVkLXJvdXRlcy1jb25maWd1cmF0aW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vbGliL2hhbmRsZXJzL3JvdXRlci1lbnRpdGllcy9yb3V0ZS1jYWNoaW5nL2NhY2hlZC1yb3V0ZXMtY29uZmlndXJhdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLG1CQUFtQixDQUFBO0FBQ3RELE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQTtBQUN2RCxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxnQ0FBZ0MsQ0FBQTtBQUNyRSxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxrQ0FBa0MsQ0FBQTtBQUN2RSxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQTtBQUVqRTs7Ozs7Ozs7R0FRRztBQUNILE1BQU0sQ0FBQyxNQUFNLDJCQUEyQixHQUFzQyxJQUFJLEdBQUcsQ0FBQztJQUNwRjs7T0FFRztJQUNIO1FBQ0UsSUFBSSxvQkFBb0IsQ0FBQztZQUN2QixPQUFPLEVBQUUsNENBQTRDO1lBQ3JELFFBQVEsRUFBRSw0Q0FBNEM7WUFDdEQsU0FBUyxFQUFFLFNBQVMsQ0FBQyxXQUFXO1lBQ2hDLE9BQU8sRUFBRSxPQUFPLENBQUMsT0FBTztTQUN6QixDQUFDLENBQUMsUUFBUSxFQUFFO1FBQ2IsSUFBSSxvQkFBb0IsQ0FBQztZQUN2QixJQUFJLEVBQUUsV0FBVztZQUNqQixTQUFTLEVBQUUsU0FBUyxDQUFDLFdBQVc7WUFDaEMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxPQUFPO1lBQ3hCLE9BQU8sRUFBRTtnQkFDUCxJQUFJLGtCQUFrQixDQUFDLEVBQUUsTUFBTSxFQUFFLEdBQUcsRUFBRSxTQUFTLEVBQUUsU0FBUyxDQUFDLFFBQVEsRUFBRSxDQUFDO2dCQUN0RSxJQUFJLGtCQUFrQixDQUFDLEVBQUUsTUFB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LElBQUksa0JBQWtCLENBQUMsRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLFNBQVMsRUFBRSxTQUFTLENBQUMsVUFBVSxFQUFFLHFCQUFxQixFQUFFLEVBQUUsRUFBRSxDQUFDO2FBQ3BHO1NBQ0YsQ0FBQztLQUNIO0NBQ0YsQ0FBQyxDQUFBIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ2hhaW5JZCwgVHJhZGVUeXBlIH0gZnJvbSAnQHVuaXN3YXAvc2RrLWNvcmUnXG5pbXBvcnQgeyBDYWNoZU1vZGUgfSBmcm9tICdAdW5pc3dhcC9zbWFydC1vcmRlci1yb3V0ZXInXG5pbXBvcnQgeyBDYWNoZWRSb3V0ZXNTdHJhdGVneSB9IGZyb20gJy4vbW9kZWwvY2FjaGVkLXJvdXRlcy1zdHJhdGVneSdcbmltcG9ydCB7IFBhaXJUcmFkZVR5cGVDaGFpbklkIH0gZnJvbSAnLi9tb2RlbC9wYWlyLXRyYWRlLXR5cGUtY2hhaW4taWQnXG5pbXBvcnQgeyBDYWNoZWRSb3V0ZXNCdWNrZXQgfSBmcm9tICcuL21vZGVsL2NhY2hlZC1yb3V0ZXMtYnVja2V0J1xuXG4vKipcbiAqIFRoaXMgaXMgdGhlIG1haW4gY29uZmlndXJhdGlvbiBmb3IgdGhlIGNhY2hpbmcgc3RyYXRlZ2llcyBvZiByb3V0ZXMuXG4gKlxuICogVGhlIGtleXMgYXJlIGdlbmVyYXRlZCBieSBjYWxsaW5nIHRoZSBgdG9TdHJpbmdgIG1ldGhvZCBpbiB0aGUgYFBhaXJUcmFkZVR5cGVDaGFpbklkYCBjbGFzcyxcbiAqIHRoaXMgd2F5IHdlIGNhbiBndWFyYW50ZWUgdGhlIGNvcnJlY3QgZm9ybWF0IG9mIHRoZSBrZXkuXG4gKlxuICogVGhlIHZhbHVlcyBhcmUgYW4gb2JqZWN0IG9mIHR5cGUgYENhY2hlZFJvdXRlc1N0cmF0ZWd5YC5cbiAqIHdoaWNoIHJlY2VpdmUgYW4gYXJyYXkgb2YgYENhY2hlZFJvdXRlc1BhcmFtZXRlcnNgIHdpdGggdGhlIGNvbmZpZ3VyYXRpb24gb2YgdGhlIGJ1Y2tldHMuXG4gKi9cbmV4cG9ydCBjb25zdCBDQUNIRURfUk9VVEVTX0NPTkZJR1VSQVRJT046IE1hcDxzdHJpbmcsIENhY2hlZFJvdXRlc1N0cmF0ZWd5PiA9IG5ldyBNYXAoW1xuICAvKipcbiAgICogV0VUSC9VU0RDIC0gTWFpbm5ldFxuICAgKi9cbiAgW1xuICAgIG5ldyBQYWlyVHJhZGVUeXBlQ2hhaW5JZCh7XG4gICAgICB0b2tlbkluOiAnMHhjMDJhYWEzOWIyMjNmZThkMGEwZTVjNGYyN2VhZDkwODNjNzU2Y2MyJywgLy8gV0VUSFxuICAgICAgdG9rZW5PdXQ6ICcweGEwYjg2OTkxYzYyMThiMzZjMWQxOWQ0YTJlOWViMGNlMzYwNmViNDgnLCAvLyBVU0RDXG4gICAgICB0cmFkZVR5cGU6IFRyYWRlVHlwZS5FWEFDVF9JTlBVVCxcbiAgICAgIGNoYWluSWQ6IENoYWluSWQuTUFJTk5FVCxcbiAgICB9KS50b1N0cmluZygpLFxuICAgIG5ldyBDYWNoZWRSb3V0ZXNTdHJhdGVneSh7XG4gICAgICBwYWlyOiAnV0VUSC9VU0RDJyxcbiAgICAgIHRyYWRlVHlwZTogVHJhZGVUeXBlLkVYQUNUX0lOUFVULFxuICAgICAgY2hhaW5JZDogQ2hhaW5JZC5NQUlOTkVULFxuICAgICAgYnVja2V0czogW1xuICAgICAgICBuZXcgQ2FjaGVkUm91dGVzQnVja2V0KHsgYnVja2V0OiAwLjIsIGNhY2hlTW9kZTogQ2FjaGVNb2RlLkxpdmVtb2RlIH0pLFxuICAgICAgICBuZXcgQ2FjaGVkUm91dGVzQnVja2V0KHsgYnVja2V0OiAxLCBjYWNoZU1vZGU6IENhY2hlTW9kZS5MaXZlbW9kZSB9KSxcbiAgICAgICAgbmV3IENhY2hlZFJvdXRlc0J1Y2tldCh7IGJ1Y2tldDogMywgY2FjaGVNb2RlOiBDYWNoZU1vZGUuTGl2ZW1vZGUgfSksXG4gICAgICAgIG5ldyBDYWNoZWRSb3V0ZXNCdWNrZXQoeyBidWNrZXQ6IDUsIGNhY2hlTW9kZTogQ2FjaGVNb2RlLkxpdmVtb2RlIH0pLFxuICAgICAgICBuZXcgQ2FjaGVkUm91dGVzQnVja2V0KHsgYnVja2V0OiA4LCBjYWNoZU1vZGU6IENhY2hlTW9kZS5MaXZlbW9kZSB9KSxcbiAgICAgICAgbmV3IENhY2hlZFJvdXRlc0J1Y2tldCh7IGJ1Y2tldDogMTMsIGNhY2hlTW9kZTogQ2FjaGVNb2RlLkxpdmVtb2RlIH0pLFxuICAgICAgICBuZXcgQ2FjaGVkUm91dGVzQnVja2V0KHsgYnVja2V0OiAyMSwgY2FjaGVNb2RlOiBDYWNoZU1vZGUuTGl2ZW1vZGUgfSksXG4gICAgICAgIG5ldyBDYWNoZWRSb3V0ZXNCdWNrZXQoeyBidWNrZXQ6IDM0LCBjYWNoZU1vZGU6IENhY2hlTW9kZS5MaXZlbW9kZSB9KSxcbiAgICAgICAgbmV3IENhY2hlZFJvdXRlc0J1Y2tldCh7IGJ1Y2tldDogNTUsIGNhY2hlTW9kZTogQ2FjaGVNb2RlLkxpdmVtb2RlIH0pLFxuICAgICAgXSxcbiAgICB9KSxcbiAgXSxcbiAgLyoqXG4gICAqIFVTREMvV0VUSCAtIE1haW5uZXRcbiAgICovXG4gIFtcbiAgICBuZXcgUGFpclRyYWRlVHlwZUNoYWluSWQoe1xuICAgICAgdG9rZW5JbjogJzB4YTBiODY5OTFjNjIxOGIzNmMxZDE5ZDRhMmU5ZWIwY2UzNjA2ZWI0OCcsIC8vIFVTRENcbiAgICAgIHRva2VuT3V0OiAnMHhjMDJhYWEzOWIyMjNmZThkMGEwZTVjNGYyN2VhZDkwODNjNzU2Y2MyJywgLy8gV0VUSFxuICAgICAgdHJhZGVUeXBlOiBUcmFkZVR5cGUuRVhBQ1RfSU5QVVQsXG4gICAgICBjaGFpbklkOiBDaGFpbklkLk1BSU5ORVQsXG4gICAgfSkudG9TdHJpbmcoKSxcbiAgICBuZXcgQ2FjaGVkUm91dGVzU3RyYXRlZ3koe1xuICAgICAgcGFpcjogJ1VTREMvV0VUSCcsXG4gICAgICB0cmFkZVR5cGU6IFRyYWRlVHlwZS5FWEFDVF9JTlBVVCxcbiAgICAgIGNoYWluSWQ6IENoYWluSWQuTUFJTk5FVCxcbiAgICAgIGJ1Y2tldHM6IFtcbiAgICAgICAgbmV3IENhY2hlZFJvdXRlc0J1Y2tldCh7IGJ1Y2tldDogNTAwLCBjYWNoZU1vZGU6IENhY2hlTW9kZS5MaXZlbW9kZSB9KSxcbiAgICAgICAgbmV3IENhY2hlZFJvdXRlc0J1Y2tldCh7IGJ1Y2tldDogMV8wMDAsIGNhY2hlTW9kZTogQ2FjaGVNb2RlLkxpdmVtb2RlIH0pLFxuICAgICAgICBuZXcgQ2FjaGVkUm91dGVzQnVja2V0KHsgYnVja2V0OiAzXzAwMCwgY2FjaGVNb2RlOiBDYWNoZU1vZGUuTGl2ZW1vZGUgfSksXG4gICAgICAgIG5ldyBDYWNoZWRSb3V0ZXNCdWNrZXQoeyBidWNrZXQ6IDhfMDAwLCBjYWNoZU1vZGU6IENhY2hlTW9kZS5MaXZlbW9kZSB9KSxcbiAgICAgICAgbmV3IENhY2hlZFJvdXRlc0J1Y2tldCh7IGJ1Y2tldDogMTNfMDAwLCBjYWNoZU1vZGU6IENhY2hlTW9kZS5MaXZlbW9kZSB9KSxcbiAgICAgICAgbmV3IENhY2hlZFJvdXRlc0J1Y2tldCh7IGJ1Y2tldDogMjFfMDAwLCBjYWNoZU1vZGU6IENhY2hlTW9kZS5MaXZlbW9kZSB9KSxcbiAgICAgICAgbmV3IENhY2hlZFJvdXRlc0J1Y2tldCh7IGJ1Y2tldDogMzRfMDAwLCBjYWNoZU1vZGU6IENhY2hlTW9kZS5MaXZlbW9kZSB9KSxcbiAgICAgICAgbmV3IENhY2hlZFJvdXRlc0J1Y2tldCh7IGJ1Y2tldDogNTVfMDAwLCBjYWNoZU1vZGU6IENhY2hlTW9kZS5MaXZlbW9kZSB9KSxcbiAgICAgICAgbmV3IENhY2hlZFJvdXRlc0J1Y2tldCh7IGJ1Y2tldDogODlfMDAwLCBjYWNoZU1vZGU6IENhY2hlTW9kZS5MaXZlbW9kZSB9KSxcbiAgICAgIF0sXG4gICAgfSksXG4gIF0sXG4gIC8qKlxuICAgKiBXRVRIL1VTRFQgLSBNYWlubmV0XG4gICAqL1xuICBbXG4gICAgbmV3IFBhaXJUcmFkZVR5cGVDaGFpbklkKHtcbiAgICAgIHRva2VuSW46ICcweGMwMmFhYTM5YjIyM2ZlOGQwYTBlNWM0ZjI3ZWFkOTA4M2M3NTZjYzInLCAvLyBXRVRIXG4gICAgICB0b2tlbk91dDogJzB4ZGFjMTdmOTU4ZDJlZTUyM2EyMjA2MjA2OTk0NTk3YzEzZDgzMWVjNycsIC8vIFVTRFRcbiAgICAgIHRyYWRlVHlwZTogVHJhZGVUeXBlLkVYQUNUX0lOUFVULFxuICAgICAgY2hhaW5JZDogQ2hhaW5JZC5NQUlOTkVULFxuICAgIH0pLnRvU3RyaW5nKCksXG4gICAgbmV3IENhY2hlZFJvdXRlc1N0cmF0ZWd5KHtcbiAgICAgIHBhaXI6ICdXRVRIL1VTRFQnLFxuICAgICAgdHJhZGVUeXBlOiBUcmFkZVR5cGUuRVhBQ1RfSU5QVVQsXG4gICAgICBjaGFpbklkOiBDaGFpbklkLk1BSU5ORVQsXG4gICAgICBidWNrZXRzOiBbXG4gICAgICAgIG5ldyBDYWNoZWRSb3V0ZXNCdWNrZXQoeyBidWNrZXQ6IDAuMiwgY2FjaGVNb2RlOiBDYWNoZU1vZGUuTGl2ZW1vZGUgfSksXG4gICAgICAgIG5ldyBDYWNoZWRSb3V0ZXNCdWNrZXQoeyBidWNrZXQ6IDEsIGNhY2hlTW9kZTogQ2FjaGVNb2RlLkxpdmVtb2RlIH0pLFxuICAgICAgICBuZXcgQ2FjaGVkUm91dGVzQnVja2V0KHsgYnVja2V0OiAzLCBjYWNoZU1vZGU6IENhY2hlTW9kZS5MaXZlbW9kZSB9KSxcbiAgICAgICAgbmV3IENhY2hlZFJvdXRlc0J1Y2tldCh7IGJ1Y2tldDogNSwgY2FjaGVNb2RlOiBDYWNoZU1vZGUuTGl2ZW1vZGUgfSksXG4gICAgICAgIG5ldyBDYWNoZWRSb3V0ZXNCdWNrZXQoeyBidWNrZXQ6IDgsIGNhY2hlTW9kZTogQ2FjaGVNb2RlLkxpdmVtb2RlIH0pLFxuICAgICAgICBuZXcgQ2FjaGVkUm91dGVzQnVja2V0KHsgYnVja2V0OiAxMywgY2FjaGVNb2RlOiBDYWNoZU1vZGUuTGl2ZW1vZGUgfSksXG4gICAgICAgIG5ldyBDYWNoZWRSb3V0ZXNCdWNrZXQoeyBidWNrZXQ6IDIxLCBjYWNoZU1vZGU6IENhY2hlTW9kZS5MaXZlbW9kZSB9KSxcbiAgICAgICAgbmV3IENhY2hlZFJvdXRlc0J1Y2tldCh7IGJ1Y2tldDogMzQsIGNhY2hlTW9kZTogQ2FjaGVNb2RlLkxpdmVtb2RlIH0pLFxuICAgICAgICBuZXcgQ2FjaGVkUm91dGVzQnVja2V0KHsgYnVja2V0OiA1NSwgY2FjaGVNb2RlOiBDYWNoZU1vZGUuTGl2ZW1vZGUgfSksXG4gICAgICBdLFxuICAgIH0pLFxuICBdLFxuICAvKipcbiAgICogVVNEVC9XRVRIIC0gTWFpbm5ldFxuICAgKi9cbiAgW1xuICAgIG5ldyBQYWlyVHJhZGVUeXBlQ2hhaW5JZCh7XG4gICAgICB0b2tlbkluOiAnMHhkYWMxN2Y5NThkMmVlNTIzYTIyMDYyMDY5OTQ1OTdjMTNkODMxZWM3JywgLy8gVVNEVFxuICAgICAgdG9rZW5PdXQ6ICcweGMwMmFhYTM5YjIyM2ZlOGQwYTBlNWM0ZjI3ZWFkOTA4M2M3NTZjYzInLCAvLyBXRVRIXG4gICAgICB0cmFkZVR5cGU6IFRyYWRlVHlwZS5FWEFDVF9JTlBVVCxcbiAgICAgIGNoYWluSWQ6IENoYWluSWQuTUFJTk5FVCxcbiAgICB9KS50b1N0cmluZygpLFxuICAgIG5ldyBDYWNoZWRSb3V0ZXNTdHJhdGVneSh7XG4gICAgICBwYWlyOiAnVVNEVC9XRVRIJyxcbiAgICAgIHRyYWRlVHlwZTogVHJhZGVUeXBlLkVYQUNUX0lOUFVULFxuICAgICAgY2hhaW5JZDogQ2hhaW5JZC5NQUlOTkVULFxuICAgICAgYnVja2V0czogW1xuICAgICAgICBuZXcgQ2FjaGVkUm91dGVzQnVja2V0KHsgYnVja2V0OiA1MDAsIGNhY2hlTW9kZTogQ2FjaGVNb2RlLkxpdmVtb2RlIH0pLFxuICAgICAgICBuZXcgQ2FjaGVkUm91dGVzQnVja2V0KHsgYnVja2V0OiAxXzAwMCwgY2FjaGVNb2RlOiBDYWNoZU1vZGUuTGl2ZW1vZGUgfSksXG4gICAgICAgIG5ldyBDYWNoZWRSb3V0ZXNCdWNrZXQoeyBidWNrZXQ6IDNfMDAwLCBjYWNoZU1vZGU6IENhY2hlTW9kZS5MaXZlbW9kZSB9KSxcbiAgICAgICAgbmV3IENhY2hlZFJvdXRlc0J1Y2tldCh7IGJ1Y2tldDogOF8wMDAsIGNhY2hlTW9kZTogQ2FjaGVNb2RlLkxpdmVtb2RlIH0pLFxuICAgICAgICBuZXcgQ2FjaGVkUm91dGVzQnVja2V0KHsgYnVja2V0OiAxM18wMDAsIGNhY2hlTW9kZTogQ2FjaGVNb2RlLkxpdmVtb2RlIH0pLFxuICAgICAgICBuZXcgQ2FjaGVkUm91dGVzQnVja2V0KHsgYnVja2V0OiAyMV8wMDAsIGNhY2hlTW9kZTogQ2FjaGVNb2RlLkxpdmVtb2RlIH0pLFxuICAgICAgICBuZXcgQ2FjaGVkUm91dGVzQnVja2V0KHsgYnVja2V0OiAzNF8wMDAsIGNhY2hlTW9kZTogQ2FjaGVNb2RlLkxpdmVtb2RlIH0pLFxuICAgICAgICBuZXcgQ2FjaGVkUm91dGVzQnVja2V0KHsgYnVja2V0OiA1NV8wMDAsIGNhY2hlTW9kZTogQ2FjaGVNb2RlLkxpdmVtb2RlIH0pLFxuICAgICAgICBuZXcgQ2FjaGVkUm91dGVzQnVja2V0KHsgYnVja2V0OiA4OV8wMDAsIGNhY2hlTW9kZTogQ2FjaGVNb2RlLkxpdmVtb2RlIH0pLFxuICAgICAgXSxcbiAgICB9KSxcbiAgXSxcbiAgW1xuICAgIG5ldyBQYWlyVHJhZGVUeXBlQ2hhaW5JZCh7XG4gICAgICB0b2tlbkluOiAnMHhjMDJhYWEzOWIyMjNmZThkMGEwZTVjNGYyN2VhZDkwODNjNzU2Y2MyJywgLy8gV0VUSFxuICAgICAgdG9rZW5PdXQ6ICcqJywgLy8gQU5ZIFRPS0VOXG4gICAgICB0cmFkZVR5cGU6IFRyYWRlVHlwZS5FWEFDVF9JTlBVVCxcbiAgICAgIGNoYWluSWQ6IENoYWluSWQuTUFJTk5FVCxcbiAgICB9KS50b1N0cmluZygpLFxuICAgIG5ldyBDYWNoZWRSb3V0ZXNTdHJhdGVneSh7XG4gICAgICBwYWlyOiAnV0VUSC8qJyxcbiAgICAgIHRyYWRlVHlwZTogVHJhZGVUeXBlLkVYQUNUX0lOUFVULFxuICAgICAgY2hhaW5JZDogQ2hhaW5JZC5NQUlOTkVULFxuICAgICAgYnVja2V0czogW1xuICAgICAgICAvLyBBbnkgYW1vdW50cyBsb3dlciB0aGFuIDAuMDE1IGluIE1haW5uZXQgYXJlIGxpa2VseSB0byBiZSBoZWF2aWx5IGluZmx1ZW5jZWQgYnkgdGhlIGdhcyBwcmljZXMuIERhcmttb2RpbmcgZXZlcnl0aGluZyBiZWxvdyAwLjAxXG4gICAgICAgIG5ldyBDYWNoZWRSb3V0ZXNCdWNrZXQoeyBidWNrZXQ6IDAuMDE1LCBjYWNoZU1vZGU6IENhY2hlTW9kZS5EYXJrbW9kZSB9KSwgLy8gSW50ZW50aW9uYWxseSBEYXJrbW9kZWRcbiAgICAgICAgbmV3IENhY2hlZFJvdXRlc0J1Y2tldCh7IGJ1Y2tldDogMC4wNSwgY2FjaGVNb2RlOiBDYWNoZU1vZGUuTGl2ZW1vZGUsIHdpdGhMYXN0TkNhY2hlZFJvdXRlczogMjAgfSksXG4gICAgICAgIG5ldyBDYWNoZWRSb3V0ZXNCdWNrZXQoeyBidWNrZXQ6IDAuMSwgY2FjaGVNb2RlOiBDYWNoZU1vZGUuTGl2ZW1vZGUsIHdpdGhMYXN0TkNhY2hlZFJvdXRlczogMjAgfSksXG4gICAgICAgIG5ldyBDYWNoZWRSb3V0ZXNCdWNrZXQoeyBidWNrZXQ6IDAuNSwgY2FjaGVNb2RlOiBDYWNoZU1vZGUuTGl2ZW1vZGUsIHdpdGhMYXN0TkNhY2hlZFJvdXRlczogMjAgfSksXG4gICAgICAgIG5ldyBDYWNoZWRSb3V0ZXNCdWNrZXQoeyBidWNrZXQ6IDEsIGNhY2hlTW9kZTogQ2FjaGVNb2RlLkxpdmVtb2RlLCB3aXRoTGFzdE5DYWNoZWRSb3V0ZXM6IDIwIH0pLFxuICAgICAgICBuZXcgQ2FjaGVkUm91dGVzQnVja2V0KHsgYnVja2V0OiAyLCBjYWNoZU1vZGU6IENhY2hlTW9kZS5MaXZlbW9kZSwgd2l0aExhc3ROQ2FjaGVkUm91dGVzOiAxNSB9KSxcbiAgICAgICAgbmV3IENhY2hlZFJvdXRlc0J1Y2tldCh7IGJ1Y2tldDogMywgY2FjaGVNb2RlOiBDYWNoZU1vZGUuTGl2ZW1vZGUsIHdpdGhMYXN0TkNhY2hlZFJvdXRlczogMTUgfSksXG4gICAgICAgIG5ldyBDYWNoZWRSb3V0ZXNCdWNrZXQoeyBidWNrZXQ6IDQsIGNhY2hlTW9kZTogQ2FjaGVNb2RlLkxpdmVtb2RlLCB3aXRoTGFzdE5DYWNoZWRSb3V0ZXM6IDE1IH0pLFxuICAgICAgICBuZXcgQ2FjaGVkUm91dGVzQnVja2V0KHsgYnVja2V0OiA1LCBjYWNoZU1vZGU6IENhY2hlTW9kZS5MaXZlbW9kZSwgd2l0aExhc3ROQ2FjaGVkUm91dGVzOiAxNSB9KSxcbiAgICAgIF0sXG4gICAgfSksXG4gIF0sXG4gIFtcbiAgICBuZXcgUGFpclRyYWRlVHlwZUNoYWluSWQoe1xuICAgICAgdG9rZW5JbjogJzB4YTBiODY5OTFjNjIxOGIzNmMxZDE5ZDRhMmU5ZWIwY2UzNjA2ZWI0OCcsIC8vIFVTRENcbiAgICAgIHRva2VuT3V0OiAnKicsIC8vIEFOWSBUT0tFTlxuICAgICAgdHJhZGVUeXBlOiBUcmFkZVR5cGUuRVhBQ1RfSU5QVVQsXG4gICAgICBjaGFpbklkOiBDaGFpbklkLk1BSU5ORVQsXG4gICAgfSkudG9TdHJpbmcoKSxcbiAgICBuZXcgQ2FjaGVkUm91dGVzU3RyYXRlZ3koe1xuICAgICAgcGFpcjogJ1VTREMvKicsXG4gICAgICB0cmFkZVR5cGU6IFRyYWRlVHlwZS5FWEFDVF9JTlBVVCxcbiAgICAgIGNoYWluSWQ6IENoYWluSWQuTUFJTk5FVCxcbiAgICAgIGJ1Y2tldHM6IFtcbiAgICAgICAgbmV3IENhY2hlZFJvdXRlc0J1Y2tldCh7IGJ1Y2tldDogMTAwLCBjYWNoZU1vZGU6IENhY2hlTW9kZS5EYXJrbW9kZSwgd2l0aExhc3ROQ2FjaGVkUm91dGVzOiAxMCB9KSxcbiAgICAgICAgbmV3IENhY2hlZFJvdXRlc0J1Y2tldCh7IGJ1Y2tldDogMzAwLCBjYWNoZU1vZGU6IENhY2hlTW9kZS5MaXZlbW9kZSwgd2l0aExhc3ROQ2FjaGVkUm91dGVzOiAxMCB9KSxcbiAgICAgICAgbmV3IENhY2hlZFJvdXRlc0J1Y2tldCh7IGJ1Y2tldDogNTAwLCBjYWNoZU1vZGU6IENhY2hlTW9kZS5MaXZlbW9kZSwgd2l0aExhc3ROQ2FjaGVkUm91dGVzOiAxMCB9KSxcbiAgICAgICAgbmV3IENhY2hlZFJvdXRlc0J1Y2tldCh7IGJ1Y2tldDogNzUwLCBjYWNoZU1vZGU6IENhY2hlTW9kZS5MaXZlbW9kZSwgd2l0aExhc3ROQ2FjaGVkUm91dGVzOiAxMCB9KSxcbiAgICAgICAgbmV3IENhY2hlZFJvdXRlc0J1Y2tldCh7IGJ1Y2tldDogMV8wMDAsIGNhY2hlTW9kZTogQ2FjaGVNb2RlLkxpdmVtb2RlLCB3aXRoTGFzdE5DYWNoZWRSb3V0ZXM6IDEwIH0pLFxuICAgICAgICBuZXcgQ2FjaGVkUm91dGVzQnVja2V0KHsgYnVja2V0OiAzXzAwMCwgY2FjaGVNb2RlOiBDYWNoZU1vZGUuTGl2ZW1vZGUsIHdpdGhMYXN0TkNhY2hlZFJvdXRlczogMTAgfSksXG4gICAgICAgIG5ldyBDYWNoZWRSb3V0ZXNCdWNrZXQoeyBidWNrZXQ6IDhfMDAwLCBjYWNoZU1vZGU6IENhY2hlTW9kZS5MaXZlbW9kZSwgd2l0aExhc3ROQ2FjaGVkUm91dGVzOiAxMCB9KSxcbiAgICAgICAgbmV3IENhY2hlZFJvdXRlc0J1Y2tldCh7IGJ1Y2tldDogMTNfMDAwLCBjYWNoZU1vZGU6IENhY2hlTW9kZS5MaXZlbW9kZSwgd2l0aExhc3ROQ2FjaGVkUm91dGVzOiAxMCB9KSxcbiAgICAgIF0sXG4gICAgfSksXG4gIF0sXG4gIC8qKlxuICAgKiBOT1RFOiBPbmx5IENhY2hlIGNvbmZpZ3VyYXRpb24gZm9yIFByaWNpbmcgYmVsb3cgdGhpcyBjb21tZW50XG4gICAqIFRoZXNlIGNvbmZpZ3VyYXRpb25zIGFyZSBpbmZsdWVuY2VkIGJ5IHRoZSBmcm9udGVuZCBjb25maWd1cmF0aW9uOlxuICAgKiBodHRwczovL2dpdGh1Yi5jb20vVW5pc3dhcC9pbnRlcmZhY2UvYmxvYi9tYWluL3NyYy9ob29rcy91c2VVU0RQcmljZS50cyNMMTVcbiAgICovXG4gIFtcbiAgICBuZXcgUGFpclRyYWRlVHlwZUNoYWluSWQoe1xuICAgICAgdG9rZW5JbjogJyonLCAvLyBBTlkgVE9LRU5cbiAgICAgIHRva2VuT3V0OiAnMHhjMDJhYWEzOWIyMjNmZThkMGEwZTVjNGYyN2VhZDkwODNjNzU2Y2MyJywgLy8gV0VUSFxuICAgICAgdHJhZGVUeXBlOiBUcmFkZVR5cGUuRVhBQ1RfT1VUUFVULFxuICAgICAgY2hhaW5JZDogQ2hhaW5JZC5NQUlOTkVULFxuICAgIH0pLnRvU3RyaW5nKCksXG4gICAgbmV3IENhY2hlZFJvdXRlc1N0cmF0ZWd5KHtcbiAgICAgIHBhaXI6ICcqL1dFVEgnLFxuICAgICAgdHJhZGVUeXBlOiBUcmFkZVR5cGUuRVhBQ1RfT1VUUFVULFxuICAgICAgY2hhaW5JZDogQ2hhaW5JZC5NQUlOTkVULFxuICAgICAgYnVja2V0czogW1xuICAgICAgICBuZXcgQ2FjaGVkUm91dGVzQnVja2V0KHsgYnVja2V0OiAwLjAxNSwgY2FjaGVNb2RlOiBDYWNoZU1vZGUuRGFya21vZGUgfSksXG4gICAgICAgIG5ldyBDYWNoZWRSb3V0ZXNCdWNrZXQoeyBidWNrZXQ6IDAuMDUsIGNhY2hlTW9kZTogQ2FjaGVNb2RlLkRhcmttb2RlIH0pLFxuICAgICAgICBuZXcgQ2FjaGVkUm91dGVzQnVja2V0KHsgYnVja2V0OiAwLjEsIGNhY2hlTW9kZTogQ2FjaGVNb2RlLlRhcGNvbXBhcmUsIHdpdGhMYXN0TkNhY2hlZFJvdXRlczogMTAgfSksXG4gICAgICAgIG5ldyBDYWNoZWRSb3V0ZXNCdWNrZXQoeyBidWNrZXQ6IDAuNSwgY2FjaGVNb2RlOiBDYWNoZU1vZGUuVGFwY29tcGFyZSwgd2l0aExhc3ROQ2FjaGVkUm91dGVzOiAxMCB9KSxcbiAgICAgICAgbmV3IENhY2hlZFJvdXRlc0J1Y2tldCh7IGJ1Y2tldDogMSwgY2FjaGVNb2RlOiBDYWNoZU1vZGUuVGFwY29tcGFyZSwgd2l0aExhc3ROQ2FjaGVkUm91dGVzOiAxMCB9KSxcbiAgICAgICAgbmV3IENhY2hlZFJvdXRlc0J1Y2tldCh7IGJ1Y2tldDogMiwgY2FjaGVNb2RlOiBDYWNoZU1vZGUuVGFwY29tcGFyZSwgd2l0aExhc3ROQ2FjaGVkUm91dGVzOiAxMCB9KSxcbiAgICAgICAgbmV3IENhY2hlZFJvdXRlc0J1Y2tldCh7IGJ1Y2tldDogNCwgY2FjaGVNb2RlOiBDYWNoZU1vZGUuVGFwY29tcGFyZSwgd2l0aExhc3ROQ2FjaGVkUm91dGVzOiAxMCB9KSxcbiAgICAgICAgbmV3IENhY2hlZFJvdXRlc0J1Y2tldCh7IGJ1Y2tldDogNiwgY2FjaGVNb2RlOiBDYWNoZU1vZGUuVGFwY29tcGFyZSwgd2l0aExhc3ROQ2FjaGVkUm91dGVzOiAxMCB9KSxcbiAgICAgICAgbmV3IENhY2hlZFJvdXRlc0J1Y2tldCh7IGJ1Y2tldDogMTAsIGNhY2hlTW9kZTogQ2FjaGVNb2RlLlRhcGNvbXBhcmUsIHdpdGhMYXN0TkNhY2hlZFJvdXRlczogMTAgfSksXG4gICAgICAgIG5ldyBDYWNoZWRSb3V0ZXNCdWNrZXQoeyBidWNrZXQ6IDE2LCBjYWNoZU1vZGU6IENhY2hlTW9kZS5UYXBjb21wYXJlLCB3aXRoTGFzdE5DYWNoZWRSb3V0ZXM6IDEwIH0pLFxuICAgICAgICBuZXcgQ2FjaGVkUm91dGVzQnVja2V0KHsgYnVja2V0OiAzMCwgY2FjaGVNb2RlOiBDYWNoZU1vZGUuVGFwY29tcGFyZSwgd2l0aExhc3ROQ2FjaGVkUm91dGVzOiAxMCB9KSxcbiAgICAgICAgbmV3IENhY2hlZFJvdXRlc0J1Y2tldCh7IGJ1Y2tldDogNDUsIGNhY2hlTW9kZTogQ2FjaGVNb2RlLlRhcGNvbXBhcmUsIHdpdGhMYXN0TkNhY2hlZFJvdXRlczogMTAgfSksXG4gICAgICAgIG5ldyBDYWNoZWRSb3V0ZXNCdWNrZXQoeyBidWNrZXQ6IDU1LCBjYWNoZU1vZGU6IENhY2hlTW9kZS5MaXZlbW9kZSwgd2l0aExhc3ROQ2FjaGVkUm91dGVzOiAxMCB9KSxcbiAgICAgICAgbmV3IENhY2hlZFJvdXRlc0J1Y2tldCh7IGJ1Y2tldDogODAsIGNhY2hlTW9kZTogQ2FjaGVNb2RlLlRhcGNvbXBhcmUsIHdpdGhMYXN0TkNhY2hlZFJvdXRlczogMTAgfSksXG4gICAgICAgIG5ldyBDYWNoZWRSb3V0ZXNCdWNrZXQoeyBidWNrZXQ6IDk1LCBjYWNoZU1vZGU6IENhY2hlTW9kZS5UYXBjb21wYXJlLCB3aXRoTGFzdE5DYWNoZWRSb3V0ZXM6IDEwIH0pLFxuICAgICAgICBuZXcgQ2FjaGVkUm91dGVzQnVja2V0KHsgYnVja2V0OiAxMTAsIGNhY2hlTW9kZTogQ2FjaGVNb2RlLlRhcGNvbXBhcmUsIHdpdGhMYXN0TkNhY2hlZFJvdXRlczogMTAgfSksXG4gICAgICBdLFxuICAgIH0pLFxuICBdLFxuXSlcbiJdfQ==