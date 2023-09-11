import { ChainId, CurrencyAmount, Token, TradeType } from '@uniswap/sdk-core';
import { describe, it, expect } from '@jest/globals';
import { CACHED_ROUTES_CONFIGURATION, PairTradeTypeChainId, } from '../../../../../../lib/handlers/router-entities/route-caching';
describe('CachedRoutesConfiguration', () => {
    const WETH = new Token(ChainId.MAINNET, '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2', 18, 'WETH');
    it('can find the strategy for a pair with configuration', () => {
        const pairToLookup = new PairTradeTypeChainId({
            tokenIn: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
            tokenOut: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            tradeType: TradeType.EXACT_INPUT,
            chainId: ChainId.MAINNET,
        });
        const fetchedStrategy = CACHED_ROUTES_CONFIGURATION.get(pairToLookup.toString());
        expect(fetchedStrategy).toBeDefined();
        const currencyAmount = CurrencyAmount.fromRawAmount(WETH, 1 * 10 ** WETH.decimals);
        const cachingParameters = fetchedStrategy === null || fetchedStrategy === void 0 ? void 0 : fetchedStrategy.getCachingBucket(currencyAmount);
        expect(cachingParameters === null || cachingParameters === void 0 ? void 0 : cachingParameters.bucket).toBe(1);
    });
    it('can find the strategy, even if token has different capitalization', () => {
        const pairToLookup = new PairTradeTypeChainId({
            tokenIn: '0xC02AAA39b223fe8d0a0e5c4f27EAD9083c756cc2',
            tokenOut: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            tradeType: TradeType.EXACT_INPUT,
            chainId: ChainId.MAINNET,
        });
        const fetchedStrategy = CACHED_ROUTES_CONFIGURATION.get(pairToLookup.toString());
        expect(fetchedStrategy).toBeDefined();
        const currencyAmount = CurrencyAmount.fromRawAmount(WETH, 1 * 10 ** WETH.decimals);
        const cachingParameters = fetchedStrategy === null || fetchedStrategy === void 0 ? void 0 : fetchedStrategy.getCachingBucket(currencyAmount);
        expect(cachingParameters === null || cachingParameters === void 0 ? void 0 : cachingParameters.bucket).toBe(1);
    });
    it('can find the strategy using a different amount', () => {
        const pairToLookup = new PairTradeTypeChainId({
            tokenIn: '0xC02AAA39b223fe8d0a0e5c4f27EAD9083c756cc2',
            tokenOut: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            tradeType: TradeType.EXACT_INPUT,
            chainId: ChainId.MAINNET,
        });
        const fetchedStrategy = CACHED_ROUTES_CONFIGURATION.get(pairToLookup.toString());
        expect(fetchedStrategy).toBeDefined();
        const currencyAmount = CurrencyAmount.fromRawAmount(WETH, 5 * 10 ** WETH.decimals);
        const cachingParameters = fetchedStrategy === null || fetchedStrategy === void 0 ? void 0 : fetchedStrategy.getCachingBucket(currencyAmount);
        expect(cachingParameters === null || cachingParameters === void 0 ? void 0 : cachingParameters.bucket).toBe(5);
    });
    it('returns undefined when strategy doesnt exist', () => {
        const pairToLookup = new PairTradeTypeChainId({
            tokenIn: '0xC02AAA39b223fe8d0a0e5c4f27EAD9083c756cc2',
            tokenOut: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
            tradeType: TradeType.EXACT_OUTPUT,
            chainId: ChainId.MAINNET,
        });
        const fetchedStrategy = CACHED_ROUTES_CONFIGURATION.get(pairToLookup.toString());
        expect(fetchedStrategy).toBeUndefined();
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FjaGVkLXJvdXRlcy1jb25maWd1cmF0aW9uLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi8uLi90ZXN0L2plc3QvdW5pdC9oYW5kbGVycy9yb3V0ZXItZW50aXRpZXMvcm91dGUtY2FjaGluZy9jYWNoZWQtcm91dGVzLWNvbmZpZ3VyYXRpb24udGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsT0FBTyxFQUFFLGNBQWMsRUFBRSxLQUFLLEVBQUUsU0FBUyxFQUFFLE1BQU0sbUJBQW1CLENBQUE7QUFDN0UsT0FBTyxFQUFFLFFBQVEsRUFBRSxFQUFFLEVBQUUsTUFBTSxFQUFFLE1BQU0sZUFBZSxDQUFBO0FBQ3BELE9BQU8sRUFDTCwyQkFBMkIsRUFDM0Isb0JBQW9CLEdBQ3JCLE1BQU0sOERBQThELENBQUE7QUFFckUsUUFBUSxDQUFDLDJCQUEyQixFQUFFLEdBQUcsRUFBRTtJQUN6QyxNQUFNLElBQUksR0FBRyxJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLDRDQUE0QyxFQUFFLEVBQUUsRUFBRSxNQUFNLENBQUMsQ0FBQTtJQUVqRyxFQUFFLENBQUMscURBQXFELEVBQUUsR0FBRyxFQUFFO1FBQzdELE1BQU0sWUFBWSxHQUFHLElBQUksb0JBQW9CLENBQUM7WUFDNUMsT0FBTyxFQUFFLDRDQUE0QztZQUNyRCxRQUFRLEVBQUUsNENBQTRDO1lBQ3RELFNBQVMsRUFBRSxTQUFTLENBQUMsV0FBVztZQUNoQyxPQUFPLEVBQUUsT0FBTyxDQUFDLE9BQU87U0FDekIsQ0FBQyxDQUFBO1FBRUYsTUFBTSxlQUFlLEdBQUcsMkJBQTJCLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxDQUFBO1FBRWhGLE1BQU0sQ0FBQyxlQUFlLENBQUMsQ0FBQyxXQUFXLEVBQUUsQ0FBQTtRQUVyQyxNQUFNLGNBQWMsR0FBRyxjQUFjLENBQUMsYUFBYSxD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QUFDLENBQUMsQ0FBQTtBQUNKLENBQUMsQ0FBQyxDQUFBIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ2hhaW5JZCwgQ3VycmVuY3lBbW91bnQsIFRva2VuLCBUcmFkZVR5cGUgfSBmcm9tICdAdW5pc3dhcC9zZGstY29yZSdcbmltcG9ydCB7IGRlc2NyaWJlLCBpdCwgZXhwZWN0IH0gZnJvbSAnQGplc3QvZ2xvYmFscydcbmltcG9ydCB7XG4gIENBQ0hFRF9ST1VURVNfQ09ORklHVVJBVElPTixcbiAgUGFpclRyYWRlVHlwZUNoYWluSWQsXG59IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2xpYi9oYW5kbGVycy9yb3V0ZXItZW50aXRpZXMvcm91dGUtY2FjaGluZydcblxuZGVzY3JpYmUoJ0NhY2hlZFJvdXRlc0NvbmZpZ3VyYXRpb24nLCAoKSA9PiB7XG4gIGNvbnN0IFdFVEggPSBuZXcgVG9rZW4oQ2hhaW5JZC5NQUlOTkVULCAnMHhjMDJhYWEzOWIyMjNmZThkMGEwZTVjNGYyN2VhZDkwODNjNzU2Y2MyJywgMTgsICdXRVRIJylcblxuICBpdCgnY2FuIGZpbmQgdGhlIHN0cmF0ZWd5IGZvciBhIHBhaXIgd2l0aCBjb25maWd1cmF0aW9uJywgKCkgPT4ge1xuICAgIGNvbnN0IHBhaXJUb0xvb2t1cCA9IG5ldyBQYWlyVHJhZGVUeXBlQ2hhaW5JZCh7XG4gICAgICB0b2tlbkluOiAnMHhjMDJhYWEzOWIyMjNmZThkMGEwZTVjNGYyN2VhZDkwODNjNzU2Y2MyJywgLy8gV0VUSFxuICAgICAgdG9rZW5PdXQ6ICcweGEwYjg2OTkxYzYyMThiMzZjMWQxOWQ0YTJlOWViMGNlMzYwNmViNDgnLCAvLyBVU0RDXG4gICAgICB0cmFkZVR5cGU6IFRyYWRlVHlwZS5FWEFDVF9JTlBVVCxcbiAgICAgIGNoYWluSWQ6IENoYWluSWQuTUFJTk5FVCxcbiAgICB9KVxuXG4gICAgY29uc3QgZmV0Y2hlZFN0cmF0ZWd5ID0gQ0FDSEVEX1JPVVRFU19DT05GSUdVUkFUSU9OLmdldChwYWlyVG9Mb29rdXAudG9TdHJpbmcoKSlcblxuICAgIGV4cGVjdChmZXRjaGVkU3RyYXRlZ3kpLnRvQmVEZWZpbmVkKClcblxuICAgIGNvbnN0IGN1cnJlbmN5QW1vdW50ID0gQ3VycmVuY3lBbW91bnQuZnJvbVJhd0Ftb3VudChXRVRILCAxICogMTAgKiogV0VUSC5kZWNpbWFscylcbiAgICBjb25zdCBjYWNoaW5nUGFyYW1ldGVycyA9IGZldGNoZWRTdHJhdGVneT8uZ2V0Q2FjaGluZ0J1Y2tldChjdXJyZW5jeUFtb3VudClcblxuICAgIGV4cGVjdChjYWNoaW5nUGFyYW1ldGVycz8uYnVja2V0KS50b0JlKDEpXG4gIH0pXG5cbiAgaXQoJ2NhbiBmaW5kIHRoZSBzdHJhdGVneSwgZXZlbiBpZiB0b2tlbiBoYXMgZGlmZmVyZW50IGNhcGl0YWxpemF0aW9uJywgKCkgPT4ge1xuICAgIGNvbnN0IHBhaXJUb0xvb2t1cCA9IG5ldyBQYWlyVHJhZGVUeXBlQ2hhaW5JZCh7XG4gICAgICB0b2tlbkluOiAnMHhDMDJBQUEzOWIyMjNmZThkMGEwZTVjNGYyN0VBRDkwODNjNzU2Y2MyJywgLy8gV0VUSFxuICAgICAgdG9rZW5PdXQ6ICcweGEwYjg2OTkxYzYyMThiMzZjMWQxOWQ0YTJlOWViMGNlMzYwNmViNDgnLCAvLyBVU0RDXG4gICAgICB0cmFkZVR5cGU6IFRyYWRlVHlwZS5FWEFDVF9JTlBVVCxcbiAgICAgIGNoYWluSWQ6IENoYWluSWQuTUFJTk5FVCxcbiAgICB9KVxuXG4gICAgY29uc3QgZmV0Y2hlZFN0cmF0ZWd5ID0gQ0FDSEVEX1JPVVRFU19DT05GSUdVUkFUSU9OLmdldChwYWlyVG9Mb29rdXAudG9TdHJpbmcoKSlcblxuICAgIGV4cGVjdChmZXRjaGVkU3RyYXRlZ3kpLnRvQmVEZWZpbmVkKClcblxuICAgIGNvbnN0IGN1cnJlbmN5QW1vdW50ID0gQ3VycmVuY3lBbW91bnQuZnJvbVJhd0Ftb3VudChXRVRILCAxICogMTAgKiogV0VUSC5kZWNpbWFscylcbiAgICBjb25zdCBjYWNoaW5nUGFyYW1ldGVycyA9IGZldGNoZWRTdHJhdGVneT8uZ2V0Q2FjaGluZ0J1Y2tldChjdXJyZW5jeUFtb3VudClcblxuICAgIGV4cGVjdChjYWNoaW5nUGFyYW1ldGVycz8uYnVja2V0KS50b0JlKDEpXG4gIH0pXG5cbiAgaXQoJ2NhbiBmaW5kIHRoZSBzdHJhdGVneSB1c2luZyBhIGRpZmZlcmVudCBhbW91bnQnLCAoKSA9PiB7XG4gICAgY29uc3QgcGFpclRvTG9va3VwID0gbmV3IFBhaXJUcmFkZVR5cGVDaGFpbklkKHtcbiAgICAgIHRva2VuSW46ICcweEMwMkFBQTM5YjIyM2ZlOGQwYTBlNWM0ZjI3RUFEOTA4M2M3NTZjYzInLCAvLyBXRVRIXG4gICAgICB0b2tlbk91dDogJzB4YTBiODY5OTFjNjIxOGIzNmMxZDE5ZDRhMmU5ZWIwY2UzNjA2ZWI0OCcsIC8vIFVTRENcbiAgICAgIHRyYWRlVHlwZTogVHJhZGVUeXBlLkVYQUNUX0lOUFVULFxuICAgICAgY2hhaW5JZDogQ2hhaW5JZC5NQUlOTkVULFxuICAgIH0pXG5cbiAgICBjb25zdCBmZXRjaGVkU3RyYXRlZ3kgPSBDQUNIRURfUk9VVEVTX0NPTkZJR1VSQVRJT04uZ2V0KHBhaXJUb0xvb2t1cC50b1N0cmluZygpKVxuXG4gICAgZXhwZWN0KGZldGNoZWRTdHJhdGVneSkudG9CZURlZmluZWQoKVxuXG4gICAgY29uc3QgY3VycmVuY3lBbW91bnQgPSBDdXJyZW5jeUFtb3VudC5mcm9tUmF3QW1vdW50KFdFVEgsIDUgKiAxMCAqKiBXRVRILmRlY2ltYWxzKVxuICAgIGNvbnN0IGNhY2hpbmdQYXJhbWV0ZXJzID0gZmV0Y2hlZFN0cmF0ZWd5Py5nZXRDYWNoaW5nQnVja2V0KGN1cnJlbmN5QW1vdW50KVxuXG4gICAgZXhwZWN0KGNhY2hpbmdQYXJhbWV0ZXJzPy5idWNrZXQpLnRvQmUoNSlcbiAgfSlcblxuICBpdCgncmV0dXJucyB1bmRlZmluZWQgd2hlbiBzdHJhdGVneSBkb2VzbnQgZXhpc3QnLCAoKSA9PiB7XG4gICAgY29uc3QgcGFpclRvTG9va3VwID0gbmV3IFBhaXJUcmFkZVR5cGVDaGFpbklkKHtcbiAgICAgIHRva2VuSW46ICcweEMwMkFBQTM5YjIyM2ZlOGQwYTBlNWM0ZjI3RUFEOTA4M2M3NTZjYzInLCAvLyBXRVRIXG4gICAgICB0b2tlbk91dDogJzB4YTBiODY5OTFjNjIxOGIzNmMxZDE5ZDRhMmU5ZWIwY2UzNjA2ZWI0OCcsIC8vIFVTRENcbiAgICAgIHRyYWRlVHlwZTogVHJhZGVUeXBlLkVYQUNUX09VVFBVVCxcbiAgICAgIGNoYWluSWQ6IENoYWluSWQuTUFJTk5FVCxcbiAgICB9KVxuXG4gICAgY29uc3QgZmV0Y2hlZFN0cmF0ZWd5ID0gQ0FDSEVEX1JPVVRFU19DT05GSUdVUkFUSU9OLmdldChwYWlyVG9Mb29rdXAudG9TdHJpbmcoKSlcblxuICAgIGV4cGVjdChmZXRjaGVkU3RyYXRlZ3kpLnRvQmVVbmRlZmluZWQoKVxuICB9KVxufSlcbiJdfQ==