import { Protocol } from '@uniswap/router-sdk';
import { V2SubgraphProvider, V3SubgraphProvider } from '@uniswap/smart-order-router';
import { ChainId } from '@uniswap/sdk-core';
export const chainProtocols = [
    // V3.
    {
        protocol: Protocol.V3,
        chainId: ChainId.MAINNET,
        timeout: 90000,
        provider: new V3SubgraphProvider(ChainId.MAINNET, 3, 90000),
    },
    {
        protocol: Protocol.V3,
        chainId: ChainId.ARBITRUM_ONE,
        timeout: 90000,
        provider: new V3SubgraphProvider(ChainId.ARBITRUM_ONE, 3, 90000),
    },
    {
        protocol: Protocol.V3,
        chainId: ChainId.POLYGON,
        timeout: 90000,
        provider: new V3SubgraphProvider(ChainId.POLYGON, 3, 90000),
    },
    {
        protocol: Protocol.V3,
        chainId: ChainId.CELO,
        timeout: 90000,
        provider: new V3SubgraphProvider(ChainId.CELO, 3, 90000),
    },
    {
        protocol: Protocol.V3,
        chainId: ChainId.BNB,
        timeout: 90000,
        provider: new V3SubgraphProvider(ChainId.BNB, 3, 90000),
    },
    {
        protocol: Protocol.V3,
        chainId: ChainId.AVALANCHE,
        timeout: 90000,
        provider: new V3SubgraphProvider(ChainId.AVALANCHE, 3, 90000),
    },
    // Currently there is no working V3 subgraph for Optimism so we use a static provider.
    // V2.
    {
        protocol: Protocol.V2,
        chainId: ChainId.MAINNET,
        timeout: 840000,
        provider: new V2SubgraphProvider(ChainId.MAINNET, 3, 900000, true, 1000), // 1000 is the largest page size supported by thegraph
    },
];
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FjaGUtY29uZmlnLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGliL2Nyb24vY2FjaGUtY29uZmlnLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxRQUFRLEVBQUUsTUFBTSxxQkFBcUIsQ0FBQTtBQUM5QyxPQUFPLEVBQUUsa0JBQWtCLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQTtBQUNwRixPQUFPLEVBQUUsT0FBTyxFQUFFLE1BQU0sbUJBQW1CLENBQUE7QUFFM0MsTUFBTSxDQUFDLE1BQU0sY0FBYyxHQUFHO0lBQzVCLE1BQU07SUFDTjtRQUNFLFFBQVEsRUFBRSxRQUFRLENBQUMsRUFBRTtRQUNyQixPQUFPLEVBQUUsT0FBTyxDQUFDLE9BQU87UUFDeEIsT0FBTyxFQUFFLEtBQUs7UUFDZCxRQUFRLEVBQUUsSUFBSSxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUMsRUFBRSxLQUFLLENBQUM7S0FDNUQ7SUFDRDtRQUNFLFFBQVEsRUFBRSxRQUFRLENBQUMsRUFBRTtRQUNyQixPQUFPLEVBQUUsT0FBTyxDQUFDLFlBQVk7UUFDN0IsT0FBTyxFQUFFLEtBQUs7UUFDZCxRQUFRLEVBQUUsSUFBSSxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsWUFBWSxFQUFFLENBQUMsRUFBRSxLQUFLLENBQUM7S0FDakU7SUFDRDtRQUNFLFFBQVEsRUFBRSxRQUFRLENBQUMsRUFBRTtRQUNyQixPQUFPLEVBQUUsT0FBTyxDQUFDLE9BQU87UUFDeEIsT0FBTyxFQUFFLEtBQUs7UUFDZCxRQUFRLEVBQUUsSUFBSSxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUMsRUFBRSxLQUFLLENBQUM7S0FDNUQ7SUFDRDtRQUNFLFFBQVEsRUFBRSxRQUFRLENBQUMsRUFBRTtRQUNyQixPQUFPLEVBQUUsT0FBTyxDQUFDLElBQUk7UUFDckIsT0FBTyxFQUFFLEtBQUs7UUFDZCxRQUFRLEVBQUUsSUFBSSxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBRSxLQUFLLENBQUM7S0FDekQ7SUFDRDtRQUNFLFFBQVEsRUFBRSxRQUFRLENBQUMsRUFBRTtRQUNyQixPQUFPLEVBQUUsT0FBTyxDQUFDLEdBQUc7UUFDcEIsT0FBTyxFQUFFLEtBQUs7UUFDZCxRQUFRLEVBQUUsSUFBSSxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRSxLQUFLLENBQUM7S0FDeEQ7SUFDRDtRQUNFLFFBQVEsRUFBRSxRQUFRLENBQUMsRUFBRTtRQUNyQixPQUFPLEVBQUUsT0FBTyxDQUFDLFNBQVM7UUFDMUIsT0FBTyxFQUFFLEtBQUs7UUFDZCxRQUFRLEVBQUUsSUFBSSxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFLENBQUMsRUFBRSxLQUFLLENBQUM7S0FDOUQ7SUFDRCxzRkFBc0Y7SUFDdEYsTUFBTTtJQUVOO1FBQ0UsUUFBUSxFQUFFLFFBQVEsQ0FBQyxFQUFFO1FBQ3JCLE9BQU8sRUFBRSxPQUFPLENBQUMsT0FBTztRQUN4QixPQUFPLEVBQUUsTUFBTTtRQUNmLFFBQVEsRUFBRSxJQUFJLGtCQUFrQixDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQyxFQUFFLE1BQU0sRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUUsc0RBQXNEO0tBQ2pJO0NBQ0YsQ0FBQSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFByb3RvY29sIH0gZnJvbSAnQHVuaXN3YXAvcm91dGVyLXNkaydcbmltcG9ydCB7IFYyU3ViZ3JhcGhQcm92aWRlciwgVjNTdWJncmFwaFByb3ZpZGVyIH0gZnJvbSAnQHVuaXN3YXAvc21hcnQtb3JkZXItcm91dGVyJ1xuaW1wb3J0IHsgQ2hhaW5JZCB9IGZyb20gJ0B1bmlzd2FwL3Nkay1jb3JlJ1xuXG5leHBvcnQgY29uc3QgY2hhaW5Qcm90b2NvbHMgPSBbXG4gIC8vIFYzLlxuICB7XG4gICAgcHJvdG9jb2w6IFByb3RvY29sLlYzLFxuICAgIGNoYWluSWQ6IENoYWluSWQuTUFJTk5FVCxcbiAgICB0aW1lb3V0OiA5MDAwMCxcbiAgICBwcm92aWRlcjogbmV3IFYzU3ViZ3JhcGhQcm92aWRlcihDaGFpbklkLk1BSU5ORVQsIDMsIDkwMDAwKSxcbiAgfSxcbiAge1xuICAgIHByb3RvY29sOiBQcm90b2NvbC5WMyxcbiAgICBjaGFpbklkOiBDaGFpbklkLkFSQklUUlVNX09ORSxcbiAgICB0aW1lb3V0OiA5MDAwMCxcbiAgICBwcm92aWRlcjogbmV3IFYzU3ViZ3JhcGhQcm92aWRlcihDaGFpbklkLkFSQklUUlVNX09ORSwgMywgOTAwMDApLFxuICB9LFxuICB7XG4gICAgcHJvdG9jb2w6IFByb3RvY29sLlYzLFxuICAgIGNoYWluSWQ6IENoYWluSWQuUE9MWUdPTixcbiAgICB0aW1lb3V0OiA5MDAwMCxcbiAgICBwcm92aWRlcjogbmV3IFYzU3ViZ3JhcGhQcm92aWRlcihDaGFpbklkLlBPTFlHT04sIDMsIDkwMDAwKSxcbiAgfSxcbiAge1xuICAgIHByb3RvY29sOiBQcm90b2NvbC5WMyxcbiAgICBjaGFpbklkOiBDaGFpbklkLkNFTE8sXG4gICAgdGltZW91dDogOTAwMDAsXG4gICAgcHJvdmlkZXI6IG5ldyBWM1N1YmdyYXBoUHJvdmlkZXIoQ2hhaW5JZC5DRUxPLCAzLCA5MDAwMCksXG4gIH0sXG4gIHtcbiAgICBwcm90b2NvbDogUHJvdG9jb2wuVjMsXG4gICAgY2hhaW5JZDogQ2hhaW5JZC5CTkIsXG4gICAgdGltZW91dDogOTAwMDAsXG4gICAgcHJvdmlkZXI6IG5ldyBWM1N1YmdyYXBoUHJvdmlkZXIoQ2hhaW5JZC5CTkIsIDMsIDkwMDAwKSxcbiAgfSxcbiAge1xuICAgIHByb3RvY29sOiBQcm90b2NvbC5WMyxcbiAgICBjaGFpbklkOiBDaGFpbklkLkFWQUxBTkNIRSxcbiAgICB0aW1lb3V0OiA5MDAwMCxcbiAgICBwcm92aWRlcjogbmV3IFYzU3ViZ3JhcGhQcm92aWRlcihDaGFpbklkLkFWQUxBTkNIRSwgMywgOTAwMDApLFxuICB9LFxuICAvLyBDdXJyZW50bHkgdGhlcmUgaXMgbm8gd29ya2luZyBWMyBzdWJncmFwaCBmb3IgT3B0aW1pc20gc28gd2UgdXNlIGEgc3RhdGljIHByb3ZpZGVyLlxuICAvLyBWMi5cblxuICB7XG4gICAgcHJvdG9jb2w6IFByb3RvY29sLlYyLFxuICAgIGNoYWluSWQ6IENoYWluSWQuTUFJTk5FVCxcbiAgICB0aW1lb3V0OiA4NDAwMDAsXG4gICAgcHJvdmlkZXI6IG5ldyBWMlN1YmdyYXBoUHJvdmlkZXIoQ2hhaW5JZC5NQUlOTkVULCAzLCA5MDAwMDAsIHRydWUsIDEwMDApLCAvLyAxMDAwIGlzIHRoZSBsYXJnZXN0IHBhZ2Ugc2l6ZSBzdXBwb3J0ZWQgYnkgdGhlZ3JhcGhcbiAgfSxcbl1cbiJdfQ==