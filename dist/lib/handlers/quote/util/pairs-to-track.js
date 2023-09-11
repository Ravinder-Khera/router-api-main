import { ChainId, TradeType } from '@uniswap/sdk-core';
export const PAIRS_TO_TRACK = new Map([
    [
        ChainId.MAINNET,
        new Map([
            [
                TradeType.EXACT_INPUT,
                ['WETH/USDC', 'USDC/WETH', 'USDT/WETH', 'WETH/USDT', 'WETH/*', 'USDC/*', 'USDT/*', 'DAI/*', 'WBTC/*'],
            ],
            [TradeType.EXACT_OUTPUT, ['USDC/WETH', '*/WETH', '*/USDC', '*/USDT', '*/DAI']],
        ]),
    ],
    [
        ChainId.OPTIMISM,
        new Map([
            [TradeType.EXACT_INPUT, ['WETH/USDC', 'USDC/WETH']],
            [TradeType.EXACT_OUTPUT, ['*/WETH']],
        ]),
    ],
    [
        ChainId.ARBITRUM_ONE,
        new Map([
            [TradeType.EXACT_INPUT, ['WETH/USDC', 'USDC/WETH']],
            [TradeType.EXACT_OUTPUT, ['*/WETH']],
        ]),
    ],
    [
        ChainId.POLYGON,
        new Map([
            [TradeType.EXACT_INPUT, ['WETH/USDC', 'USDC/WETH', 'WMATIC/USDC', 'USDC/WMATIC']],
            [TradeType.EXACT_OUTPUT, ['*/WMATIC']],
        ]),
    ],
    [ChainId.CELO, new Map([[TradeType.EXACT_OUTPUT, ['*/CELO']]])],
]);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFpcnMtdG8tdHJhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9saWIvaGFuZGxlcnMvcXVvdGUvdXRpbC9wYWlycy10by10cmFjay50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsT0FBTyxFQUFFLFNBQVMsRUFBRSxNQUFNLG1CQUFtQixDQUFBO0FBRXRELE1BQU0sQ0FBQyxNQUFNLGNBQWMsR0FBMkMsSUFBSSxHQUFHLENBQUM7SUFDNUU7UUFDRSxPQUFPLENBQUMsT0FBTztRQUNmLElBQUksR0FBRyxDQUFDO1lBQ047Z0JBQ0UsU0FBUyxDQUFDLFdBQVc7Z0JBQ3JCLENBQUMsV0FBVyxFQUFFLFdBQVcsRUFBRSxXQUFXLEVBQUUsV0FBVyxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLE9BQU8sRUFBRSxRQUFRLENBQUM7YUFDdEc7WUFDRCxDQUFDLFNBQVMsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxXQUFXLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsT0FBTyxDQUFDLENBQUM7U0FDL0UsQ0FBQztLQUNIO0lBQ0Q7UUFDRSxPQUFPLENBQUMsUUFBUTtRQUNoQixJQUFJLEdBQUcsQ0FBQztZQUNOLENBQUMsU0FBUyxDQUFDLFdBQVcsRUFBRSxDQUFDLFdBQVcsRUFBRSxXQUFXLENBQUMsQ0FBQztZQUNuRCxDQUFDLFNBQVMsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxRQUFRLENBQUMsQ0FBQztTQUNyQyxDQUFDO0tBQ0g7SUFDRDtRQUNFLE9BQU8sQ0FBQyxZQUFZO1FBQ3BCLElBQUksR0FBRyxDQUFDO1lBQ04sQ0FBQyxTQUFTLENBQUMsV0FBVyxFQUFFLENBQUMsV0FBVyxFQUFFLFdBQVcsQ0FBQyxDQUFDO1lBQ25ELENBQUMsU0FBUyxDQUFDLFlBQVksRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1NBQ3JDLENBQUM7S0FDSDtJQUNEO1FBQ0UsT0FBTyxDQUFDLE9BQU87UUFDZixJQUFJLEdBQUcsQ0FBQztZQUNOLENBQUMsU0FBUyxDQUFDLFdBQVcsRUFBRSxDQUFDLFdBQVcsRUFBRSxXQUFXLEVBQUUsYUFBYSxFQUFFLGFBQWEsQ0FBQyxDQUFDO1lBQ2pGLENBQUMsU0FBUyxDQUFDLFlBQVksRUFBRSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1NBQ3ZDLENBQUM7S0FDSDtJQUNELENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxJQUFJLEdBQUcsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLFlBQVksRUFBRSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0NBQ2hFLENBQUMsQ0FBQSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENoYWluSWQsIFRyYWRlVHlwZSB9IGZyb20gJ0B1bmlzd2FwL3Nkay1jb3JlJ1xuXG5leHBvcnQgY29uc3QgUEFJUlNfVE9fVFJBQ0s6IE1hcDxDaGFpbklkLCBNYXA8VHJhZGVUeXBlLCBzdHJpbmdbXT4+ID0gbmV3IE1hcChbXG4gIFtcbiAgICBDaGFpbklkLk1BSU5ORVQsXG4gICAgbmV3IE1hcChbXG4gICAgICBbXG4gICAgICAgIFRyYWRlVHlwZS5FWEFDVF9JTlBVVCxcbiAgICAgICAgWydXRVRIL1VTREMnLCAnVVNEQy9XRVRIJywgJ1VTRFQvV0VUSCcsICdXRVRIL1VTRFQnLCAnV0VUSC8qJywgJ1VTREMvKicsICdVU0RULyonLCAnREFJLyonLCAnV0JUQy8qJ10sXG4gICAgICBdLFxuICAgICAgW1RyYWRlVHlwZS5FWEFDVF9PVVRQVVQsIFsnVVNEQy9XRVRIJywgJyovV0VUSCcsICcqL1VTREMnLCAnKi9VU0RUJywgJyovREFJJ11dLFxuICAgIF0pLFxuICBdLFxuICBbXG4gICAgQ2hhaW5JZC5PUFRJTUlTTSxcbiAgICBuZXcgTWFwKFtcbiAgICAgIFtUcmFkZVR5cGUuRVhBQ1RfSU5QVVQsIFsnV0VUSC9VU0RDJywgJ1VTREMvV0VUSCddXSxcbiAgICAgIFtUcmFkZVR5cGUuRVhBQ1RfT1VUUFVULCBbJyovV0VUSCddXSxcbiAgICBdKSxcbiAgXSxcbiAgW1xuICAgIENoYWluSWQuQVJCSVRSVU1fT05FLFxuICAgIG5ldyBNYXAoW1xuICAgICAgW1RyYWRlVHlwZS5FWEFDVF9JTlBVVCwgWydXRVRIL1VTREMnLCAnVVNEQy9XRVRIJ11dLFxuICAgICAgW1RyYWRlVHlwZS5FWEFDVF9PVVRQVVQsIFsnKi9XRVRIJ11dLFxuICAgIF0pLFxuICBdLFxuICBbXG4gICAgQ2hhaW5JZC5QT0xZR09OLFxuICAgIG5ldyBNYXAoW1xuICAgICAgW1RyYWRlVHlwZS5FWEFDVF9JTlBVVCwgWydXRVRIL1VTREMnLCAnVVNEQy9XRVRIJywgJ1dNQVRJQy9VU0RDJywgJ1VTREMvV01BVElDJ11dLFxuICAgICAgW1RyYWRlVHlwZS5FWEFDVF9PVVRQVVQsIFsnKi9XTUFUSUMnXV0sXG4gICAgXSksXG4gIF0sXG4gIFtDaGFpbklkLkNFTE8sIG5ldyBNYXAoW1tUcmFkZVR5cGUuRVhBQ1RfT1VUUFVULCBbJyovQ0VMTyddXV0pXSxcbl0pXG4iXX0=