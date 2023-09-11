import { AlphaRouter, ID_TO_CHAIN_ID, setGlobalLogger, setGlobalMetric, V3HeuristicGasModelFactory, } from '@uniswap/smart-order-router';
import { default as bunyan } from 'bunyan';
import { BigNumber } from 'ethers';
import { InjectorSOR } from '../injector-sor';
import { AWSMetricsLogger } from '../router-entities/aws-metrics-logger';
import { StaticGasPriceProvider } from '../router-entities/static-gas-price-provider';
export class QuoteHandlerInjector extends InjectorSOR {
    async getRequestInjected(containerInjected, _requestBody, requestQueryParams, _event, context, log, metricsLogger) {
        const requestId = context.awsRequestId;
        const quoteId = requestId.substring(0, 5);
        // Sample 10% of all requests at the INFO log level for debugging purposes.
        // All other requests will only log warnings and errors.
        // Note that we use WARN as a default rather than ERROR
        // to capture Tapcompare logs in the smart-order-router.
        const logLevel = Math.random() < 0.1 ? bunyan.INFO : bunyan.WARN;
        const { tokenInAddress, tokenInChainId, tokenOutAddress, amount, type, algorithm, gasPriceWei } = requestQueryParams;
        log = log.child({
            serializers: bunyan.stdSerializers,
            level: logLevel,
            requestId,
            quoteId,
            tokenInAddress,
            chainId: tokenInChainId,
            tokenOutAddress,
            amount,
            type,
            algorithm,
        });
        setGlobalLogger(log);
        metricsLogger.setNamespace('Uniswap');
        metricsLogger.setDimensions({ Service: 'RoutingAPI' });
        const metric = new AWSMetricsLogger(metricsLogger);
        setGlobalMetric(metric);
        // Today API is restricted such that both tokens must be on the same chain.
        const chainId = tokenInChainId;
        const chainIdEnum = ID_TO_CHAIN_ID(chainId);
        const { dependencies } = containerInjected;
        if (!dependencies[chainIdEnum]) {
            // Request validation should prevent reject unsupported chains with 4xx already, so this should not be possible.
            throw new Error(`No container injected dependencies for chain: ${chainIdEnum}`);
        }
        const { provider, v3PoolProvider, multicallProvider, tokenProvider, tokenListProvider, v3SubgraphProvider, blockedTokenListProvider, v2PoolProvider, v2QuoteProvider, v2SubgraphProvider, gasPriceProvider: gasPriceProviderOnChain, simulator, routeCachingProvider, } = dependencies[chainIdEnum];
        let onChainQuoteProvider = dependencies[chainIdEnum].onChainQuoteProvider;
        let gasPriceProvider = gasPriceProviderOnChain;
        if (gasPriceWei) {
            const gasPriceWeiBN = BigNumber.from(gasPriceWei);
            gasPriceProvider = new StaticGasPriceProvider(gasPriceWeiBN);
        }
        let router;
        switch (algorithm) {
            case 'alpha':
            default:
                router = new AlphaRouter({
                    chainId,
                    provider,
                    v3SubgraphProvider,
                    multicall2Provider: multicallProvider,
                    v3PoolProvider,
                    onChainQuoteProvider,
                    gasPriceProvider,
                    v3GasModelFactory: new V3HeuristicGasModelFactory(),
                    blockedTokenListProvider,
                    tokenProvider,
                    v2PoolProvider,
                    v2QuoteProvider,
                    v2SubgraphProvider,
                    simulator,
                    routeCachingProvider,
                });
                break;
        }
        return {
            chainId: chainIdEnum,
            id: quoteId,
            log,
            metric,
            router,
            v3PoolProvider,
            v2PoolProvider,
            tokenProvider,
            tokenListProvider,
        };
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5qZWN0b3IuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi9saWIvaGFuZGxlcnMvcXVvdGUvaW5qZWN0b3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUNMLFdBQVcsRUFFWCxjQUFjLEVBR2QsZUFBZSxFQUNmLGVBQWUsRUFDZiwwQkFBMEIsR0FDM0IsTUFBTSw2QkFBNkIsQ0FBQTtBQUdwQyxPQUFPLEVBQUUsT0FBTyxJQUFJLE1BQU0sRUFBcUIsTUFBTSxRQUFRLENBQUE7QUFDN0QsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLFFBQVEsQ0FBQTtBQUNsQyxPQUFPLEVBQXFCLFdBQVcsRUFBbUIsTUFBTSxpQkFBaUIsQ0FBQTtBQUNqRixPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSx1Q0FBdUMsQ0FBQTtBQUN4RSxPQUFPLEVBQUUsc0JBQXNCLEVBQUUsTUFBTSw4Q0FBOEMsQ0FBQTtBQUVyRixNQUFNLE9BQU8sb0JBQXFCLFNBQVEsV0FHekM7SUFDUSxLQUFLLENBQUMsa0JBQWtCLENBQzdCLGlCQUFvQyxFQUNwQyxZQUFrQixFQUNsQixrQkFBb0MsRUFDcEMsTUFBNEIsRUFDNUIsT0FBZ0IsRUFDaEIsR0FBVyxFQUNYLGFBQTRCO1FBRTVCLE1BQU0sU0FBUyxHQUFHLE9BQU8sQ0FBQyxZQUFZLENBQUE7UUFDdEMsTUFBTSxPQUFPLEdBQUcsU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUE7UUFDekMsMkVBQTJFO1FBQzNFLHdEQUF3RDtRQUN4RCx1REFBdUQ7UUFDdkQsd0RBQXdEO1FBQ3hELE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxNQUFNLEVBQUUsR0FBRyxHQUFHLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUE7UUFFaEUsTUFBTSxFQUFFLGNBQWMsRUFBRSxjQUFjLEVBQUUsZUFBZSxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLFdBQVcsRUFBRSxHQUFHLGtCQUFrQixDQUFBO1FBRXBILEdBQUcsR0FBRyxHQUFHLENBQUMsS0FBSyxDQUFDO1lBQ2QsV0FBVyxFQUFFLE1BQU0sQ0FBQyxjQUFjO1lBQ2xDLEtBQUssRUFBRSxRQUFRO1lBQ2YsU0FBUztZQUNULE9BQU87WUFDUCxjQUFjO1lBQ2QsT0FBTyxFQUFFLGNBQWM7WUFDdkIsZUFBZTtZQUNmLE1BQU07WUFDTixJQUFJO1lBQ0osU0FBUztTQUNWLENBQUMsQ0FBQTtRQUNGLGVBQWUsQ0FBQyxHQUFHLENBQUMsQ0FBQTtRQUVwQixhQUFhLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxDQUFBO1FBQ3JDLGFBQWEsQ0FBQyxhQUFhLENBQUMsRUFBRSxPQUFPLEVBQUUsWUFBWSxFQUFFLENBQUMsQ0FBQTtRQUN0RCxNQUFNLE1BQU0sR0FBRyxJQUFJLGdCQUFnQixDQUFDLGFBQWEsQ0FBQyxDQUFBO1FBQ2xELGVBQWUsQ0FBQyxNQUFNLENBQUMsQ0FBQTtRQUV2QiwyRUFBMkU7UUFDM0UsTUFBTSxPQUFPLEdBQUcsY0FBYyxDQUFBO1FBQzlCLE1BQU0sV0FBVyxHQUFHLGNBQWMsQ0FBQyxPQUFPLENBQUMsQ0FBQTtRQUUzQyxNQUFNLEVBQUUsWUFBWSxFQUFFLEdBQUcsaUJBQWlCLENBQUE7UUFFMUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxXQUFXLENBQUMsRUFBRTtZQUM5QixnSEFBZ0g7WUFDaEgsTUFBTSxJQUFJLEtBQUssQ0FBQyxpREFBaUQsV0FBVyxFQUFFLENBQUMsQ0FBQTtTQUNoRjtRQUVELE1BQU0sRUFDSixRQUFRLEVBQ1IsY0FBYyxFQUNkLGlCQUFpQixFQUNqQixhQUFhLEVBQ2IsaUJBQWlCLEVBQ2pCLGtCQUFrQixFQUNsQix3QkFBd0IsRUFDeEIsY0FBYyxFQUNkLGVBQWUsRUFDZixrQkFBa0IsRUFDbEIsZ0JBQWdCLEVBQUUsdUJBQXVCLEVBQ3pDLFNBQVMsRUFDVCxvQkFBb0IsR0FDckIsR0FBRyxZQUFZLENBQUMsV0FBVyxDQUFFLENBQUE7UUFFOUIsSUFBSSxvQkFBb0IsR0FBRyxZQUFZLENBQUMsV0FBVyxDQUFFLENBQUMsb0JBQW9CLENBQUE7UUFDMUUsSUFBSSxnQkFBZ0IsR0FBRyx1QkFBdUIsQ0FBQTtRQUM5QyxJQUFJLFdBQVcsRUFBRTtZQUNmLE1BQU0sYUFBYSxHQUFHLFNBQVMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLENBQUE7WUFDakQsZ0JBQWdCLEdBQUcsSUFBSSxzQkFBc0IsQ0FBQyxhQUFhLENBQUMsQ0FBQTtTQUM3RDtRQUVELElBQUksTUFBTSxDQUFBO1FBQ1YsUUFBUSxTQUFTLEVBQUU7WUFDakIsS0FBSyxPQUFPLENBQUM7WUFDYjtnQkFDRSxNQUFNLEdBQUcsSUFBSSxXQUFXLENBQUM7b0JBQ3ZCLE9BQU87b0JBQ1AsUUFBUTtvQkFDUixrQkFBa0I7b0JBQ2xCLGtCQUFrQixFQUFFLGlCQUFpQjtvQkFDckMsY0FBYztvQkFDZCxvQkFBb0I7b0JBQ3BCLGdCQUFnQjtvQkFDaEIsaUJBQWlCLEVBQUUsSUFBSSwwQkFBMEIsRUFBRTtvQkFDbkQsd0JBQXdCO29CQUN4QixhQUFhO29CQUNiLGNBQWM7b0JBQ2QsZUFBZTtvQkFDZixrQkFBa0I7b0JBQ2xCLFNBQVM7b0JBQ1Qsb0JBQW9CO2lCQUNyQixDQUFDLENBQUE7Z0JBQ0YsTUFBSztTQUNSO1FBRUQsT0FBTztZQUNMLE9BQU8sRUFBRSxXQUFXO1lBQ3BCLEVBQUUsRUFBRSxPQUFPO1lBQ1gsR0FBRztZQUNILE1BQU07WUFDTixNQUFNO1lBQ04sY0FBYztZQUNkLGNBQWM7WUFDZCxhQUFhO1lBQ2IsaUJBQWlCO1NBQ2xCLENBQUE7SUFDSCxDQUFDO0NBQ0YiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQge1xuICBBbHBoYVJvdXRlcixcbiAgQWxwaGFSb3V0ZXJDb25maWcsXG4gIElEX1RPX0NIQUlOX0lELFxuICBJUm91dGVyLFxuICBMZWdhY3lSb3V0aW5nQ29uZmlnLFxuICBzZXRHbG9iYWxMb2dnZXIsXG4gIHNldEdsb2JhbE1ldHJpYyxcbiAgVjNIZXVyaXN0aWNHYXNNb2RlbEZhY3RvcnksXG59IGZyb20gJ0B1bmlzd2FwL3NtYXJ0LW9yZGVyLXJvdXRlcidcbmltcG9ydCB7IE1ldHJpY3NMb2dnZXIgfSBmcm9tICdhd3MtZW1iZWRkZWQtbWV0cmljcydcbmltcG9ydCB7IEFQSUdhdGV3YXlQcm94eUV2ZW50LCBDb250ZXh0IH0gZnJvbSAnYXdzLWxhbWJkYSdcbmltcG9ydCB7IGRlZmF1bHQgYXMgYnVueWFuLCBkZWZhdWx0IGFzIExvZ2dlciB9IGZyb20gJ2J1bnlhbidcbmltcG9ydCB7IEJpZ051bWJlciB9IGZyb20gJ2V0aGVycydcbmltcG9ydCB7IENvbnRhaW5lckluamVjdGVkLCBJbmplY3RvclNPUiwgUmVxdWVzdEluamVjdGVkIH0gZnJvbSAnLi4vaW5qZWN0b3Itc29yJ1xuaW1wb3J0IHsgQVdTTWV0cmljc0xvZ2dlciB9IGZyb20gJy4uL3JvdXRlci1lbnRpdGllcy9hd3MtbWV0cmljcy1sb2dnZXInXG5pbXBvcnQgeyBTdGF0aWNHYXNQcmljZVByb3ZpZGVyIH0gZnJvbSAnLi4vcm91dGVyLWVudGl0aWVzL3N0YXRpYy1nYXMtcHJpY2UtcHJvdmlkZXInXG5pbXBvcnQgeyBRdW90ZVF1ZXJ5UGFyYW1zIH0gZnJvbSAnLi9zY2hlbWEvcXVvdGUtc2NoZW1hJ1xuZXhwb3J0IGNsYXNzIFF1b3RlSGFuZGxlckluamVjdG9yIGV4dGVuZHMgSW5qZWN0b3JTT1I8XG4gIElSb3V0ZXI8QWxwaGFSb3V0ZXJDb25maWcgfCBMZWdhY3lSb3V0aW5nQ29uZmlnPixcbiAgUXVvdGVRdWVyeVBhcmFtc1xuPiB7XG4gIHB1YmxpYyBhc3luYyBnZXRSZXF1ZXN0SW5qZWN0ZWQoXG4gICAgY29udGFpbmVySW5qZWN0ZWQ6IENvbnRhaW5lckluamVjdGVkLFxuICAgIF9yZXF1ZXN0Qm9keTogdm9pZCxcbiAgICByZXF1ZXN0UXVlcnlQYXJhbXM6IFF1b3RlUXVlcnlQYXJhbXMsXG4gICAgX2V2ZW50OiBBUElHYXRld2F5UHJveHlFdmVudCxcbiAgICBjb250ZXh0OiBDb250ZXh0LFxuICAgIGxvZzogTG9nZ2VyLFxuICAgIG1ldHJpY3NMb2dnZXI6IE1ldHJpY3NMb2dnZXJcbiAgKTogUHJvbWlzZTxSZXF1ZXN0SW5qZWN0ZWQ8SVJvdXRlcjxBbHBoYVJvdXRlckNvbmZpZyB8IExlZ2FjeVJvdXRpbmdDb25maWc+Pj4ge1xuICAgIGNvbnN0IHJlcXVlc3RJZCA9IGNvbnRleHQuYXdzUmVxdWVzdElkXG4gICAgY29uc3QgcXVvdGVJZCA9IHJlcXVlc3RJZC5zdWJzdHJpbmcoMCwgNSlcbiAgICAvLyBTYW1wbGUgMTAlIG9mIGFsbCByZXF1ZXN0cyBhdCB0aGUgSU5GTyBsb2cgbGV2ZWwgZm9yIGRlYnVnZ2luZyBwdXJwb3Nlcy5cbiAgICAvLyBBbGwgb3RoZXIgcmVxdWVzdHMgd2lsbCBvbmx5IGxvZyB3YXJuaW5ncyBhbmQgZXJyb3JzLlxuICAgIC8vIE5vdGUgdGhhdCB3ZSB1c2UgV0FSTiBhcyBhIGRlZmF1bHQgcmF0aGVyIHRoYW4gRVJST1JcbiAgICAvLyB0byBjYXB0dXJlIFRhcGNvbXBhcmUgbG9ncyBpbiB0aGUgc21hcnQtb3JkZXItcm91dGVyLlxuICAgIGNvbnN0IGxvZ0xldmVsID0gTWF0aC5yYW5kb20oKSA8IDAuMSA/IGJ1bnlhbi5JTkZPIDogYnVueWFuLldBUk5cblxuICAgIGNvbnN0IHsgdG9rZW5JbkFkZHJlc3MsIHRva2VuSW5DaGFpbklkLCB0b2tlbk91dEFkZHJlc3MsIGFtb3VudCwgdHlwZSwgYWxnb3JpdGhtLCBnYXNQcmljZVdlaSB9ID0gcmVxdWVzdFF1ZXJ5UGFyYW1zXG5cbiAgICBsb2cgPSBsb2cuY2hpbGQoe1xuICAgICAgc2VyaWFsaXplcnM6IGJ1bnlhbi5zdGRTZXJpYWxpemVycyxcbiAgICAgIGxldmVsOiBsb2dMZXZlbCxcbiAgICAgIHJlcXVlc3RJZCxcbiAgICAgIHF1b3RlSWQsXG4gICAgICB0b2tlbkluQWRkcmVzcyxcbiAgICAgIGNoYWluSWQ6IHRva2VuSW5DaGFpbklkLFxuICAgICAgdG9rZW5PdXRBZGRyZXNzLFxuICAgICAgYW1vdW50LFxuICAgICAgdHlwZSxcbiAgICAgIGFsZ29yaXRobSxcbiAgICB9KVxuICAgIHNldEdsb2JhbExvZ2dlcihsb2cpXG5cbiAgICBtZXRyaWNzTG9nZ2VyLnNldE5hbWVzcGFjZSgnVW5pc3dhcCcpXG4gICAgbWV0cmljc0xvZ2dlci5zZXREaW1lbnNpb25zKHsgU2VydmljZTogJ1JvdXRpbmdBUEknIH0pXG4gICAgY29uc3QgbWV0cmljID0gbmV3IEFXU01ldHJpY3NMb2dnZXIobWV0cmljc0xvZ2dlcilcbiAgICBzZXRHbG9iYWxNZXRyaWMobWV0cmljKVxuXG4gICAgLy8gVG9kYXkgQVBJIGlzIHJlc3RyaWN0ZWQgc3VjaCB0aGF0IGJvdGggdG9rZW5zIG11c3QgYmUgb24gdGhlIHNhbWUgY2hhaW4uXG4gICAgY29uc3QgY2hhaW5JZCA9IHRva2VuSW5DaGFpbklkXG4gICAgY29uc3QgY2hhaW5JZEVudW0gPSBJRF9UT19DSEFJTl9JRChjaGFpbklkKVxuXG4gICAgY29uc3QgeyBkZXBlbmRlbmNpZXMgfSA9IGNvbnRhaW5lckluamVjdGVkXG5cbiAgICBpZiAoIWRlcGVuZGVuY2llc1tjaGFpbklkRW51bV0pIHtcbiAgICAgIC8vIFJlcXVlc3QgdmFsaWRhdGlvbiBzaG91bGQgcHJldmVudCByZWplY3QgdW5zdXBwb3J0ZWQgY2hhaW5zIHdpdGggNHh4IGFscmVhZHksIHNvIHRoaXMgc2hvdWxkIG5vdCBiZSBwb3NzaWJsZS5cbiAgICAgIHRocm93IG5ldyBFcnJvcihgTm8gY29udGFpbmVyIGluamVjdGVkIGRlcGVuZGVuY2llcyBmb3IgY2hhaW46ICR7Y2hhaW5JZEVudW19YClcbiAgICB9XG5cbiAgICBjb25zdCB7XG4gICAgICBwcm92aWRlcixcbiAgICAgIHYzUG9vbFByb3ZpZGVyLFxuICAgICAgbXVsdGljYWxsUHJvdmlkZXIsXG4gICAgICB0b2tlblByb3ZpZGVyLFxuICAgICAgdG9rZW5MaXN0UHJvdmlkZXIsXG4gICAgICB2M1N1YmdyYXBoUHJvdmlkZXIsXG4gICAgICBibG9ja2VkVG9rZW5MaXN0UHJvdmlkZXIsXG4gICAgICB2MlBvb2xQcm92aWRlcixcbiAgICAgIHYyUXVvdGVQcm92aWRlcixcbiAgICAgIHYyU3ViZ3JhcGhQcm92aWRlcixcbiAgICAgIGdhc1ByaWNlUHJvdmlkZXI6IGdhc1ByaWNlUHJvdmlkZXJPbkNoYWluLFxuICAgICAgc2ltdWxhdG9yLFxuICAgICAgcm91dGVDYWNoaW5nUHJvdmlkZXIsXG4gICAgfSA9IGRlcGVuZGVuY2llc1tjaGFpbklkRW51bV0hXG5cbiAgICBsZXQgb25DaGFpblF1b3RlUHJvdmlkZXIgPSBkZXBlbmRlbmNpZXNbY2hhaW5JZEVudW1dIS5vbkNoYWluUXVvdGVQcm92aWRlclxuICAgIGxldCBnYXNQcmljZVByb3ZpZGVyID0gZ2FzUHJpY2VQcm92aWRlck9uQ2hhaW5cbiAgICBpZiAoZ2FzUHJpY2VXZWkpIHtcbiAgICAgIGNvbnN0IGdhc1ByaWNlV2VpQk4gPSBCaWdOdW1iZXIuZnJvbShnYXNQcmljZVdlaSlcbiAgICAgIGdhc1ByaWNlUHJvdmlkZXIgPSBuZXcgU3RhdGljR2FzUHJpY2VQcm92aWRlcihnYXNQcmljZVdlaUJOKVxuICAgIH1cblxuICAgIGxldCByb3V0ZXJcbiAgICBzd2l0Y2ggKGFsZ29yaXRobSkge1xuICAgICAgY2FzZSAnYWxwaGEnOlxuICAgICAgZGVmYXVsdDpcbiAgICAgICAgcm91dGVyID0gbmV3IEFscGhhUm91dGVyKHtcbiAgICAgICAgICBjaGFpbklkLFxuICAgICAgICAgIHByb3ZpZGVyLFxuICAgICAgICAgIHYzU3ViZ3JhcGhQcm92aWRlcixcbiAgICAgICAgICBtdWx0aWNhbGwyUHJvdmlkZXI6IG11bHRpY2FsbFByb3ZpZGVyLFxuICAgICAgICAgIHYzUG9vbFByb3ZpZGVyLFxuICAgICAgICAgIG9uQ2hhaW5RdW90ZVByb3ZpZGVyLFxuICAgICAgICAgIGdhc1ByaWNlUHJvdmlkZXIsXG4gICAgICAgICAgdjNHYXNNb2RlbEZhY3Rvcnk6IG5ldyBWM0hldXJpc3RpY0dhc01vZGVsRmFjdG9yeSgpLFxuICAgICAgICAgIGJsb2NrZWRUb2tlbkxpc3RQcm92aWRlcixcbiAgICAgICAgICB0b2tlblByb3ZpZGVyLFxuICAgICAgICAgIHYyUG9vbFByb3ZpZGVyLFxuICAgICAgICAgIHYyUXVvdGVQcm92aWRlcixcbiAgICAgICAgICB2MlN1YmdyYXBoUHJvdmlkZXIsXG4gICAgICAgICAgc2ltdWxhdG9yLFxuICAgICAgICAgIHJvdXRlQ2FjaGluZ1Byb3ZpZGVyLFxuICAgICAgICB9KVxuICAgICAgICBicmVha1xuICAgIH1cblxuICAgIHJldHVybiB7XG4gICAgICBjaGFpbklkOiBjaGFpbklkRW51bSxcbiAgICAgIGlkOiBxdW90ZUlkLFxuICAgICAgbG9nLFxuICAgICAgbWV0cmljLFxuICAgICAgcm91dGVyLFxuICAgICAgdjNQb29sUHJvdmlkZXIsXG4gICAgICB2MlBvb2xQcm92aWRlcixcbiAgICAgIHRva2VuUHJvdmlkZXIsXG4gICAgICB0b2tlbkxpc3RQcm92aWRlcixcbiAgICB9XG4gIH1cbn1cbiJdfQ==