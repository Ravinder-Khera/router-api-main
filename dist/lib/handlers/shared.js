import { ChainId, Percent } from '@uniswap/sdk-core';
import { MapWithLowerCaseKey, NATIVE_NAMES_BY_ID, nativeOnChain, } from '@uniswap/smart-order-router';
export const DEFAULT_ROUTING_CONFIG_BY_CHAIN = (chainId) => {
    switch (chainId) {
        case ChainId.OPTIMISM:
            return {
                v2PoolSelection: {
                    topN: 3,
                    topNDirectSwaps: 1,
                    topNTokenInOut: 5,
                    topNSecondHop: 2,
                    topNWithEachBaseToken: 2,
                    topNWithBaseToken: 6,
                },
                v3PoolSelection: {
                    topN: 2,
                    topNDirectSwaps: 2,
                    topNTokenInOut: 2,
                    topNSecondHop: 1,
                    topNWithEachBaseToken: 3,
                    topNWithBaseToken: 3,
                },
                maxSwapsPerPath: 3,
                minSplits: 1,
                maxSplits: 7,
                distributionPercent: 10,
                forceCrossProtocol: false,
            };
        // Arbitrum calls have lower gas limits and tend to timeout more, which causes us to reduce the multicall
        // batch size and send more multicalls per quote. To reduce the amount of requests each quote sends, we
        // have to adjust the routing config so we explore fewer routes.
        case ChainId.ARBITRUM_ONE:
            return {
                v2PoolSelection: {
                    topN: 3,
                    topNDirectSwaps: 1,
                    topNTokenInOut: 5,
                    topNSecondHop: 2,
                    topNWithEachBaseToken: 2,
                    topNWithBaseToken: 6,
                },
                v3PoolSelection: {
                    topN: 2,
                    topNDirectSwaps: 2,
                    topNTokenInOut: 2,
                    topNSecondHop: 1,
                    topNWithEachBaseToken: 3,
                    topNWithBaseToken: 2,
                },
                maxSwapsPerPath: 2,
                minSplits: 1,
                maxSplits: 7,
                distributionPercent: 25,
                forceCrossProtocol: false,
            };
        default:
            return {
                v2PoolSelection: {
                    topN: 3,
                    topNDirectSwaps: 1,
                    topNTokenInOut: 5,
                    topNSecondHop: 2,
                    topNWithEachBaseToken: 2,
                    topNWithBaseToken: 6,
                },
                v3PoolSelection: {
                    topN: 2,
                    topNDirectSwaps: 2,
                    topNTokenInOut: 3,
                    topNSecondHop: 1,
                    topNSecondHopForTokenAddress: new MapWithLowerCaseKey([
                        ['0x5f98805a4e8be255a32880fdec7f6728c6568ba0', 2], // LUSD
                    ]),
                    topNWithEachBaseToken: 3,
                    topNWithBaseToken: 5,
                },
                maxSwapsPerPath: 3,
                minSplits: 1,
                maxSplits: 7,
                distributionPercent: 5,
                forceCrossProtocol: false,
            };
    }
};
export async function tokenStringToCurrency(tokenListProvider, tokenProvider, tokenRaw, chainId, log) {
    const isAddress = (s) => s.length == 42 && s.startsWith('0x');
    let token = undefined;
    if (NATIVE_NAMES_BY_ID[chainId].includes(tokenRaw)) {
        token = nativeOnChain(chainId);
    }
    else if (isAddress(tokenRaw)) {
        token = await tokenListProvider.getTokenByAddress(tokenRaw);
    }
    if (!token) {
        token = await tokenListProvider.getTokenBySymbol(tokenRaw);
    }
    if (token) {
        log.info({
            tokenAddress: token.wrapped.address,
        }, `Got input token from token list`);
        return token;
    }
    log.info(`Getting input token ${tokenRaw} from chain`);
    if (!token && isAddress(tokenRaw)) {
        const tokenAccessor = await tokenProvider.getTokens([tokenRaw]);
        return tokenAccessor.getTokenByAddress(tokenRaw);
    }
    return undefined;
}
export function parseSlippageTolerance(slippageTolerance) {
    const slippagePer10k = Math.round(parseFloat(slippageTolerance) * 100);
    return new Percent(slippagePer10k, 10000);
}
export function parseDeadline(deadline) {
    return Math.floor(Date.now() / 1000) + parseInt(deadline);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2hhcmVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGliL2hhbmRsZXJzL3NoYXJlZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsT0FBTyxFQUFZLE9BQU8sRUFBRSxNQUFNLG1CQUFtQixDQUFBO0FBQzlELE9BQU8sRUFJTCxtQkFBbUIsRUFDbkIsa0JBQWtCLEVBQ2xCLGFBQWEsR0FDZCxNQUFNLDZCQUE2QixDQUFBO0FBR3BDLE1BQU0sQ0FBQyxNQUFNLCtCQUErQixHQUFHLENBQUMsT0FBZ0IsRUFBcUIsRUFBRTtJQUNyRixRQUFRLE9BQU8sRUFBRTtRQUNmLEtBQUssT0FBTyxDQUFDLFFBQVE7WUFDbkIsT0FBTztnQkFDTCxlQUFlLEVBQUU7b0JBQ2YsSUFBSSxFQUFFLENBQUM7b0JBQ1AsZUFBZSxFQUFFLENBQUM7b0JBQ2xCLGNBQWMsRUFBRSxDQUFDO29CQUNqQixhQUFhLEVBQUUsQ0FBQztvQkFDaEIscUJBQXFCLEVBQUUsQ0FBQztvQkFDeEIsaUJBQWlCLEVBQUUsQ0FBQztpQkFDckI7Z0JBQ0QsZUFBZSxFQUFFO29CQUNmLElBQUksRUFBRSxDQUFDO29CQUNQLGVBQWUsRUFBRSxDQUFDO29CQUNsQixjQUFjLEVBQUUsQ0FBQztvQkFDakIsYUFBYSxFQUFFLENBQUM7b0JBQ2hCLHFCQUFxQixFQUFFLENBQUM7b0JBQ3hCLGlCQUFpQixFQUFFLENBQUM7aUJBQ3JCO2dCQUNELGVBQWUsRUFBRSxDQUFDO2dCQUNsQixTQUFTLEVBQUUsQ0FBQztnQkFDWixTQUFTLEVBQUUsQ0FBQztnQkFDWixtQkFBbUIsRUFBRSxFQUFFO2dCQUN2QixrQkFBa0IsRUFBRSxLQUFLO2FBQzFCLENBQUE7UUFDSCx5R0FBeUc7UUFDekcsdUdBQXVHO1FBQ3ZHLGdFQUFnRTtRQUNoRSxLQUFLLE9BQU8sQ0FBQyxZQUFZO1lBQ3ZCLE9BQU87Z0JBQ0wsZUFBZSxFQUFFO29CQUNmLElBQUksRUFBRSxDQUFDO29C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QyxDQUFBO1FBQy9ELE9BQU8sYUFBYSxDQUFDLGlCQUFpQixDQUFDLFFBQVEsQ0FBQyxDQUFBO0tBQ2pEO0lBRUQsT0FBTyxTQUFTLENBQUE7QUFDbEIsQ0FBQztBQUVELE1BQU0sVUFBVSxzQkFBc0IsQ0FBQyxpQkFBeUI7SUFDOUQsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsaUJBQWlCLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FBQTtJQUN0RSxPQUFPLElBQUksT0FBTyxDQUFDLGNBQWMsRUFBRSxLQUFNLENBQUMsQ0FBQTtBQUM1QyxDQUFDO0FBRUQsTUFBTSxVQUFVLGFBQWEsQ0FBQyxRQUFnQjtJQUM1QyxPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLElBQUksQ0FBQyxHQUFHLFFBQVEsQ0FBQyxRQUFRLENBQUMsQ0FBQTtBQUMzRCxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ2hhaW5JZCwgQ3VycmVuY3ksIFBlcmNlbnQgfSBmcm9tICdAdW5pc3dhcC9zZGstY29yZSdcbmltcG9ydCB7XG4gIEFscGhhUm91dGVyQ29uZmlnLFxuICBJVG9rZW5MaXN0UHJvdmlkZXIsXG4gIElUb2tlblByb3ZpZGVyLFxuICBNYXBXaXRoTG93ZXJDYXNlS2V5LFxuICBOQVRJVkVfTkFNRVNfQllfSUQsXG4gIG5hdGl2ZU9uQ2hhaW4sXG59IGZyb20gJ0B1bmlzd2FwL3NtYXJ0LW9yZGVyLXJvdXRlcidcbmltcG9ydCBMb2dnZXIgZnJvbSAnYnVueWFuJ1xuXG5leHBvcnQgY29uc3QgREVGQVVMVF9ST1VUSU5HX0NPTkZJR19CWV9DSEFJTiA9IChjaGFpbklkOiBDaGFpbklkKTogQWxwaGFSb3V0ZXJDb25maWcgPT4ge1xuICBzd2l0Y2ggKGNoYWluSWQpIHtcbiAgICBjYXNlIENoYWluSWQuT1BUSU1JU006XG4gICAgICByZXR1cm4ge1xuICAgICAgICB2MlBvb2xTZWxlY3Rpb246IHtcbiAgICAgICAgICB0b3BOOiAzLFxuICAgICAgICAgIHRvcE5EaXJlY3RTd2FwczogMSxcbiAgICAgICAgICB0b3BOVG9rZW5Jbk91dDogNSxcbiAgICAgICAgICB0b3BOU2Vjb25kSG9wOiAyLFxuICAgICAgICAgIHRvcE5XaXRoRWFjaEJhc2VUb2tlbjogMixcbiAgICAgICAgICB0b3BOV2l0aEJhc2VUb2tlbjogNixcbiAgICAgICAgfSxcbiAgICAgICAgdjNQb29sU2VsZWN0aW9uOiB7XG4gICAgICAgICAgdG9wTjogMixcbiAgICAgICAgICB0b3BORGlyZWN0U3dhcHM6IDIsXG4gICAgICAgICAgdG9wTlRva2VuSW5PdXQ6IDIsXG4gICAgICAgICAgdG9wTlNlY29uZEhvcDogMSxcbiAgICAgICAgICB0b3BOV2l0aEVhY2hCYXNlVG9rZW46IDMsXG4gICAgICAgICAgdG9wTldpdGhCYXNlVG9rZW46IDMsXG4gICAgICAgIH0sXG4gICAgICAgIG1heFN3YXBzUGVyUGF0aDogMyxcbiAgICAgICAgbWluU3BsaXRzOiAxLFxuICAgICAgICBtYXhTcGxpdHM6IDcsXG4gICAgICAgIGRpc3RyaWJ1dGlvblBlcmNlbnQ6IDEwLFxuICAgICAgICBmb3JjZUNyb3NzUHJvdG9jb2w6IGZhbHNlLFxuICAgICAgfVxuICAgIC8vIEFyYml0cnVtIGNhbGxzIGhhdmUgbG93ZXIgZ2FzIGxpbWl0cyBhbmQgdGVuZCB0byB0aW1lb3V0IG1vcmUsIHdoaWNoIGNhdXNlcyB1cyB0byByZWR1Y2UgdGhlIG11bHRpY2FsbFxuICAgIC8vIGJhdGNoIHNpemUgYW5kIHNlbmQgbW9yZSBtdWx0aWNhbGxzIHBlciBxdW90ZS4gVG8gcmVkdWNlIHRoZSBhbW91bnQgb2YgcmVxdWVzdHMgZWFjaCBxdW90ZSBzZW5kcywgd2VcbiAgICAvLyBoYXZlIHRvIGFkanVzdCB0aGUgcm91dGluZyBjb25maWcgc28gd2UgZXhwbG9yZSBmZXdlciByb3V0ZXMuXG4gICAgY2FzZSBDaGFpbklkLkFSQklUUlVNX09ORTpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHYyUG9vbFNlbGVjdGlvbjoge1xuICAgICAgICAgIHRvcE46IDMsXG4gICAgICAgICAgdG9wTkRpcmVjdFN3YXBzOiAxLFxuICAgICAgICAgIHRvcE5Ub2tlbkluT3V0OiA1LFxuICAgICAgICAgIHRvcE5TZWNvbmRIb3A6IDIsXG4gICAgICAgICAgdG9wTldpdGhFYWNoQmFzZVRva2VuOiAyLFxuICAgICAgICAgIHRvcE5XaXRoQmFzZVRva2VuOiA2LFxuICAgICAgICB9LFxuICAgICAgICB2M1Bvb2xTZWxlY3Rpb246IHtcbiAgICAgICAgICB0b3BOOiAyLFxuICAgICAgICAgIHRvcE5EaXJlY3RTd2FwczogMixcbiAgICAgICAgICB0b3BOVG9rZW5Jbk91dDogMixcbiAgICAgICAgICB0b3BOU2Vjb25kSG9wOiAxLFxuICAgICAgICAgIHRvcE5XaXRoRWFjaEJhc2VUb2tlbjogMyxcbiAgICAgICAgICB0b3BOV2l0aEJhc2VUb2tlbjogMixcbiAgICAgICAgfSxcbiAgICAgICAgbWF4U3dhcHNQZXJQYXRoOiAyLFxuICAgICAgICBtaW5TcGxpdHM6IDEsXG4gICAgICAgIG1heFNwbGl0czogNyxcbiAgICAgICAgZGlzdHJpYnV0aW9uUGVyY2VudDogMjUsXG4gICAgICAgIGZvcmNlQ3Jvc3NQcm90b2NvbDogZmFsc2UsXG4gICAgICB9XG4gICAgZGVmYXVsdDpcbiAgICAgIHJldHVybiB7XG4gICAgICAgIHYyUG9vbFNlbGVjdGlvbjoge1xuICAgICAgICAgIHRvcE46IDMsXG4gICAgICAgICAgdG9wTkRpcmVjdFN3YXBzOiAxLFxuICAgICAgICAgIHRvcE5Ub2tlbkluT3V0OiA1LFxuICAgICAgICAgIHRvcE5TZWNvbmRIb3A6IDIsXG4gICAgICAgICAgdG9wTldpdGhFYWNoQmFzZVRva2VuOiAyLFxuICAgICAgICAgIHRvcE5XaXRoQmFzZVRva2VuOiA2LFxuICAgICAgICB9LFxuICAgICAgICB2M1Bvb2xTZWxlY3Rpb246IHtcbiAgICAgICAgICB0b3BOOiAyLFxuICAgICAgICAgIHRvcE5EaXJlY3RTd2FwczogMixcbiAgICAgICAgICB0b3BOVG9rZW5Jbk91dDogMyxcbiAgICAgICAgICB0b3BOU2Vjb25kSG9wOiAxLFxuICAgICAgICAgIHRvcE5TZWNvbmRIb3BGb3JUb2tlbkFkZHJlc3M6IG5ldyBNYXBXaXRoTG93ZXJDYXNlS2V5PG51bWJlcj4oW1xuICAgICAgICAgICAgWycweDVmOTg4MDVhNGU4YmUyNTVhMzI4ODBmZGVjN2Y2NzI4YzY1NjhiYTAnLCAyXSwgLy8gTFVTRFxuICAgICAgICAgIF0pLFxuICAgICAgICAgIHRvcE5XaXRoRWFjaEJhc2VUb2tlbjogMyxcbiAgICAgICAgICB0b3BOV2l0aEJhc2VUb2tlbjogNSxcbiAgICAgICAgfSxcbiAgICAgICAgbWF4U3dhcHNQZXJQYXRoOiAzLFxuICAgICAgICBtaW5TcGxpdHM6IDEsXG4gICAgICAgIG1heFNwbGl0czogNyxcbiAgICAgICAgZGlzdHJpYnV0aW9uUGVyY2VudDogNSxcbiAgICAgICAgZm9yY2VDcm9zc1Byb3RvY29sOiBmYWxzZSxcbiAgICAgIH1cbiAgfVxufVxuXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gdG9rZW5TdHJpbmdUb0N1cnJlbmN5KFxuICB0b2tlbkxpc3RQcm92aWRlcjogSVRva2VuTGlzdFByb3ZpZGVyLFxuICB0b2tlblByb3ZpZGVyOiBJVG9rZW5Qcm92aWRlcixcbiAgdG9rZW5SYXc6IHN0cmluZyxcbiAgY2hhaW5JZDogQ2hhaW5JZCxcbiAgbG9nOiBMb2dnZXJcbik6IFByb21pc2U8Q3VycmVuY3kgfCB1bmRlZmluZWQ+IHtcbiAgY29uc3QgaXNBZGRyZXNzID0gKHM6IHN0cmluZykgPT4gcy5sZW5ndGggPT0gNDIgJiYgcy5zdGFydHNXaXRoKCcweCcpXG5cbiAgbGV0IHRva2VuOiBDdXJyZW5jeSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZFxuXG4gIGlmIChOQVRJVkVfTkFNRVNfQllfSURbY2hhaW5JZF0hLmluY2x1ZGVzKHRva2VuUmF3KSkge1xuICAgIHRva2VuID0gbmF0aXZlT25DaGFpbihjaGFpbklkKVxuICB9IGVsc2UgaWYgKGlzQWRkcmVzcyh0b2tlblJhdykpIHtcbiAgICB0b2tlbiA9IGF3YWl0IHRva2VuTGlzdFByb3ZpZGVyLmdldFRva2VuQnlBZGRyZXNzKHRva2VuUmF3KVxuICB9XG5cbiAgaWYgKCF0b2tlbikge1xuICAgIHRva2VuID0gYXdhaXQgdG9rZW5MaXN0UHJvdmlkZXIuZ2V0VG9rZW5CeVN5bWJvbCh0b2tlblJhdylcbiAgfVxuXG4gIGlmICh0b2tlbikge1xuICAgIGxvZy5pbmZvKFxuICAgICAge1xuICAgICAgICB0b2tlbkFkZHJlc3M6IHRva2VuLndyYXBwZWQuYWRkcmVzcyxcbiAgICAgIH0sXG4gICAgICBgR290IGlucHV0IHRva2VuIGZyb20gdG9rZW4gbGlzdGBcbiAgICApXG4gICAgcmV0dXJuIHRva2VuXG4gIH1cblxuICBsb2cuaW5mbyhgR2V0dGluZyBpbnB1dCB0b2tlbiAke3Rva2VuUmF3fSBmcm9tIGNoYWluYClcbiAgaWYgKCF0b2tlbiAmJiBpc0FkZHJlc3ModG9rZW5SYXcpKSB7XG4gICAgY29uc3QgdG9rZW5BY2Nlc3NvciA9IGF3YWl0IHRva2VuUHJvdmlkZXIuZ2V0VG9rZW5zKFt0b2tlblJhd10pXG4gICAgcmV0dXJuIHRva2VuQWNjZXNzb3IuZ2V0VG9rZW5CeUFkZHJlc3ModG9rZW5SYXcpXG4gIH1cblxuICByZXR1cm4gdW5kZWZpbmVkXG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwYXJzZVNsaXBwYWdlVG9sZXJhbmNlKHNsaXBwYWdlVG9sZXJhbmNlOiBzdHJpbmcpOiBQZXJjZW50IHtcbiAgY29uc3Qgc2xpcHBhZ2VQZXIxMGsgPSBNYXRoLnJvdW5kKHBhcnNlRmxvYXQoc2xpcHBhZ2VUb2xlcmFuY2UpICogMTAwKVxuICByZXR1cm4gbmV3IFBlcmNlbnQoc2xpcHBhZ2VQZXIxMGssIDEwXzAwMClcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhcnNlRGVhZGxpbmUoZGVhZGxpbmU6IHN0cmluZyk6IG51bWJlciB7XG4gIHJldHVybiBNYXRoLmZsb29yKERhdGUubm93KCkgLyAxMDAwKSArIHBhcnNlSW50KGRlYWRsaW5lKVxufVxuIl19