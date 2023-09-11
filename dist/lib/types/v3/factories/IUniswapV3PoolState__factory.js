/* Autogenerated file. Do not edit manually. */
/* tslint:disable */
/* eslint-disable */
import { Contract, utils } from "ethers";
const _abi = [
    {
        inputs: [],
        name: "feeGrowthGlobal0X128",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "feeGrowthGlobal1X128",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "liquidity",
        outputs: [
            {
                internalType: "uint128",
                name: "",
                type: "uint128",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "uint256",
                name: "index",
                type: "uint256",
            },
        ],
        name: "observations",
        outputs: [
            {
                internalType: "uint32",
                name: "blockTimestamp",
                type: "uint32",
            },
            {
                internalType: "int56",
                name: "tickCumulative",
                type: "int56",
            },
            {
                internalType: "uint160",
                name: "secondsPerLiquidityCumulativeX128",
                type: "uint160",
            },
            {
                internalType: "bool",
                name: "initialized",
                type: "bool",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "bytes32",
                name: "key",
                type: "bytes32",
            },
        ],
        name: "positions",
        outputs: [
            {
                internalType: "uint128",
                name: "_liquidity",
                type: "uint128",
            },
            {
                internalType: "uint256",
                name: "feeGrowthInside0LastX128",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "feeGrowthInside1LastX128",
                type: "uint256",
            },
            {
                internalType: "uint128",
                name: "tokensOwed0",
                type: "uint128",
            },
            {
                internalType: "uint128",
                name: "tokensOwed1",
                type: "uint128",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "protocolFees",
        outputs: [
            {
                internalType: "uint128",
                name: "token0",
                type: "uint128",
            },
            {
                internalType: "uint128",
                name: "token1",
                type: "uint128",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [],
        name: "slot0",
        outputs: [
            {
                internalType: "uint160",
                name: "sqrtPriceX96",
                type: "uint160",
            },
            {
                internalType: "int24",
                name: "tick",
                type: "int24",
            },
            {
                internalType: "uint16",
                name: "observationIndex",
                type: "uint16",
            },
            {
                internalType: "uint16",
                name: "observationCardinality",
                type: "uint16",
            },
            {
                internalType: "uint16",
                name: "observationCardinalityNext",
                type: "uint16",
            },
            {
                internalType: "uint8",
                name: "feeProtocol",
                type: "uint8",
            },
            {
                internalType: "bool",
                name: "unlocked",
                type: "bool",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "int16",
                name: "wordPosition",
                type: "int16",
            },
        ],
        name: "tickBitmap",
        outputs: [
            {
                internalType: "uint256",
                name: "",
                type: "uint256",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
    {
        inputs: [
            {
                internalType: "int24",
                name: "tick",
                type: "int24",
            },
        ],
        name: "ticks",
        outputs: [
            {
                internalType: "uint128",
                name: "liquidityGross",
                type: "uint128",
            },
            {
                internalType: "int128",
                name: "liquidityNet",
                type: "int128",
            },
            {
                internalType: "uint256",
                name: "feeGrowthOutside0X128",
                type: "uint256",
            },
            {
                internalType: "uint256",
                name: "feeGrowthOutside1X128",
                type: "uint256",
            },
            {
                internalType: "int56",
                name: "tickCumulativeOutside",
                type: "int56",
            },
            {
                internalType: "uint160",
                name: "secondsPerLiquidityOutsideX128",
                type: "uint160",
            },
            {
                internalType: "uint32",
                name: "secondsOutside",
                type: "uint32",
            },
            {
                internalType: "bool",
                name: "initialized",
                type: "bool",
            },
        ],
        stateMutability: "view",
        type: "function",
    },
];
export class IUniswapV3PoolState__factory {
    static createInterface() {
        return new utils.Interface(_abi);
    }
    static connect(address, signerOrProvider) {
        return new Contract(address, _abi, signerOrProvider);
    }
}
IUniswapV3PoolState__factory.abi = _abi;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiSVVuaXN3YXBWM1Bvb2xTdGF0ZV9fZmFjdG9yeS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uL2xpYi90eXBlcy92My9mYWN0b3JpZXMvSVVuaXN3YXBWM1Bvb2xTdGF0ZV9fZmFjdG9yeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSwrQ0FBK0M7QUFDL0Msb0JBQW9CO0FBQ3BCLG9CQUFvQjtBQUVwQixPQUFPLEVBQUUsUUFBUSxFQUFVLEtBQUssRUFBRSxNQUFNLFFBQVEsQ0FBQztBQU9qRCxNQUFNLElBQUksR0FBRztJQUNYO1FBQ0UsTUFBTSxFQUFFLEVBQUU7UUFDVixJQUFJLEVBQUUsc0JBQXNCO1FBQzVCLE9BQU8sRUFBRTtZQUNQO2dCQUNFLFlBQVksRUFBRSxTQUFTO2dCQUN2QixJQUFJLEVBQUUsRUFBRTtnQkFDUixJQUFJLEVBQUUsU0FBUzthQUNoQjtTQUNGO1FBQ0QsZUFBZSxFQUFFLE1BQU07UUFDdkIsSUFBSSxFQUFFLFVBQVU7S0FDakI7SUFDRDtRQUNFLE1BQU0sRUFBRSxFQUFFO1FBQ1YsSUFBSSxFQUFFLHNCQUFzQjtRQUM1QixPQUFPLEVBQUU7WUFDUDtnQkFDRSxZQUFZLEVBQUUsU0FBUztnQkFDdkIsSUFBSSxFQUFFLEVBQUU7Z0JBQ1IsSUFBSSxFQUFFLFNBQVM7YUFDaEI7U0FDRjtRQUNELGVBQWUsRUFBRSxNQUFNO1FBQ3ZCLElBQUksRUFBRSxVQUFVO0tBQ2pCO0lBQ0Q7UUFDRSxNQUFNLEVBQUUsRUFBRTtRQUNWLElBQUksRUFBRSxXQUFXO1FBQ2pCLE9BQU8sRUFBRTtZQUNQO2dCQUNFLFlBQVksRUFBRSxTQUFTO2dCQUN2QixJQUFJLEVBQUUsRUFBRTtnQkFDUixJQUFJLEVBQUUsU0FBUzthQUNoQjtTQUNGO1FBQ0QsZUFBZSxFQUFFLE1BQU07UUFDdkIsSUFBSSxFQUFFLFVBQVU7S0FDakI7SUFDRDtRQUNFLE1BQU0sRUFBRTtZQUNOO2dCQUNFLFlBQVksRUFBRSxTQUFT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LE9BQU87YUFDZDtZQUNEO2dCQUNFLFlBQVksRUFBRSxTQUFTO2dCQUN2QixJQUFJLEVBQUUsZ0NBQWdDO2dCQUN0QyxJQUFJLEVBQUUsU0FBUzthQUNoQjtZQUNEO2dCQUNFLFlBQVksRUFBRSxRQUFRO2dCQUN0QixJQUFJLEVBQUUsZ0JBQWdCO2dCQUN0QixJQUFJLEVBQUUsUUFBUTthQUNmO1lBQ0Q7Z0JBQ0UsWUFBWSxFQUFFLE1BQU07Z0JBQ3BCLElBQUksRUFBRSxhQUFhO2dCQUNuQixJQUFJLEVBQUUsTUFBTTthQUNiO1NBQ0Y7UUFDRCxlQUFlLEVBQUUsTUFBTTtRQUN2QixJQUFJLEVBQUUsVUFBVTtLQUNqQjtDQUNGLENBQUM7QUFFRixNQUFNLE9BQU8sNEJBQTRCO0lBRXZDLE1BQU0sQ0FBQyxlQUFlO1FBQ3BCLE9BQU8sSUFBSSxLQUFLLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBaUMsQ0FBQztJQUNuRSxDQUFDO0lBQ0QsTUFBTSxDQUFDLE9BQU8sQ0FDWixPQUFlLEVBQ2YsZ0JBQW1DO1FBRW5DLE9BQU8sSUFBSSxRQUFRLENBQUMsT0FBTyxFQUFFLElBQUksRUFBRSxnQkFBZ0IsQ0FBd0IsQ0FBQztJQUM5RSxDQUFDOztBQVRlLGdDQUFHLEdBQUcsSUFBSSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiLyogQXV0b2dlbmVyYXRlZCBmaWxlLiBEbyBub3QgZWRpdCBtYW51YWxseS4gKi9cbi8qIHRzbGludDpkaXNhYmxlICovXG4vKiBlc2xpbnQtZGlzYWJsZSAqL1xuXG5pbXBvcnQgeyBDb250cmFjdCwgU2lnbmVyLCB1dGlscyB9IGZyb20gXCJldGhlcnNcIjtcbmltcG9ydCB7IFByb3ZpZGVyIH0gZnJvbSBcIkBldGhlcnNwcm9qZWN0L3Byb3ZpZGVyc1wiO1xuaW1wb3J0IHR5cGUge1xuICBJVW5pc3dhcFYzUG9vbFN0YXRlLFxuICBJVW5pc3dhcFYzUG9vbFN0YXRlSW50ZXJmYWNlLFxufSBmcm9tIFwiLi4vSVVuaXN3YXBWM1Bvb2xTdGF0ZVwiO1xuXG5jb25zdCBfYWJpID0gW1xuICB7XG4gICAgaW5wdXRzOiBbXSxcbiAgICBuYW1lOiBcImZlZUdyb3d0aEdsb2JhbDBYMTI4XCIsXG4gICAgb3V0cHV0czogW1xuICAgICAge1xuICAgICAgICBpbnRlcm5hbFR5cGU6IFwidWludDI1NlwiLFxuICAgICAgICBuYW1lOiBcIlwiLFxuICAgICAgICB0eXBlOiBcInVpbnQyNTZcIixcbiAgICAgIH0sXG4gICAgXSxcbiAgICBzdGF0ZU11dGFiaWxpdHk6IFwidmlld1wiLFxuICAgIHR5cGU6IFwiZnVuY3Rpb25cIixcbiAgfSxcbiAge1xuICAgIGlucHV0czogW10sXG4gICAgbmFtZTogXCJmZWVHcm93dGhHbG9iYWwxWDEyOFwiLFxuICAgIG91dHB1dHM6IFtcbiAgICAgIHtcbiAgICAgICAgaW50ZXJuYWxUeXBlOiBcInVpbnQyNTZcIixcbiAgICAgICAgbmFtZTogXCJcIixcbiAgICAgICAgdHlwZTogXCJ1aW50MjU2XCIsXG4gICAgICB9LFxuICAgIF0sXG4gICAgc3RhdGVNdXRhYmlsaXR5OiBcInZpZXdcIixcbiAgICB0eXBlOiBcImZ1bmN0aW9uXCIsXG4gIH0sXG4gIHtcbiAgICBpbnB1dHM6IFtdLFxuICAgIG5hbWU6IFwibGlxdWlkaXR5XCIsXG4gICAgb3V0cHV0czogW1xuICAgICAge1xuICAgICAgICBpbnRlcm5hbFR5cGU6IFwidWludDEyOFwiLFxuICAgICAgICBuYW1lOiBcIlwiLFxuICAgICAgICB0eXBlOiBcInVpbnQxMjhcIixcbiAgICAgIH0sXG4gICAgXSxcbiAgICBzdGF0ZU11dGFiaWxpdHk6IFwidmlld1wiLFxuICAgIHR5cGU6IFwiZnVuY3Rpb25cIixcbiAgfSxcbiAge1xuICAgIGlucHV0czogW1xuICAgICAge1xuICAgICAgICBpbnRlcm5hbFR5cGU6IFwidWludDI1NlwiLFxuICAgICAgICBuYW1lOiBcImluZGV4XCIsXG4gICAgICAgIHR5cGU6IFwidWludDI1NlwiLFxuICAgICAgfSxcbiAgICBdLFxuICAgIG5hbWU6IFwib2JzZXJ2YXRpb25zXCIsXG4gICAgb3V0cHV0czogW1xuICAgICAge1xuICAgICAgICBpbnRlcm5hbFR5cGU6IFwidWludDMyXCIsXG4gICAgICAgIG5hbWU6IFwiYmxvY2tUaW1lc3RhbXBcIixcbiAgICAgICAgdHlwZTogXCJ1aW50MzJcIixcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGludGVybmFsVHlwZTogXCJpbnQ1NlwiLFxuICAgICAgICBuYW1lOiBcInRpY2tDdW11bGF0aXZlXCIsXG4gICAgICAgIHR5cGU6IFwiaW50NTZcIixcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGludGVybmFsVHlwZTogXCJ1aW50MTYwXCIsXG4gICAgICAgIG5hbWU6IFwic2Vjb25kc1BlckxpcXVpZGl0eUN1bXVsYXRpdmVYMTI4XCIsXG4gICAgICAgIHR5cGU6IFwidWludDE2MFwiLFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgaW50ZXJuYWxUeXBlOiBcImJvb2xcIixcbiAgICAgICAgbmFtZTogXCJpbml0aWFsaXplZFwiLFxuICAgICAgICB0eXBlOiBcImJvb2xcIixcbiAgICAgIH0sXG4gICAgXSxcbiAgICBzdGF0ZU11dGFiaWxpdHk6IFwidmlld1wiLFxuICAgIHR5cGU6IFwiZnVuY3Rpb25cIixcbiAgfSxcbiAge1xuICAgIGlucHV0czogW1xuICAgICAge1xuICAgICAgICBpbnRlcm5hbFR5cGU6IFwiYnl0ZXMzMlwiLFxuICAgICAgICBuYW1lOiBcImtleVwiLFxuICAgICAgICB0eXBlOiBcImJ5dGVzMzJcIixcbiAgICAgIH0sXG4gICAgXSxcbiAgICBuYW1lOiBcInBvc2l0aW9uc1wiLFxuICAgIG91dHB1dHM6IFtcbiAgICAgIHtcbiAgICAgICAgaW50ZXJuYWxUeXBlOiBcInVpbnQxMjhcIixcbiAgICAgICAgbmFtZTogXCJfbGlxdWlkaXR5XCIsXG4gICAgICAgIHR5cGU6IFwidWludDEyOFwiLFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgaW50ZXJuYWxUeXBlOiBcInVpbnQyNTZcIixcbiAgICAgICAgbmFtZTogXCJmZWVHcm93dGhJbnNpZGUwTGFzdFgxMjhcIixcbiAgICAgICAgdHlwZTogXCJ1aW50MjU2XCIsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpbnRlcm5hbFR5cGU6IFwidWludDI1NlwiLFxuICAgICAgICBuYW1lOiBcImZlZUdyb3d0aEluc2lkZTFMYXN0WDEyOFwiLFxuICAgICAgICB0eXBlOiBcInVpbnQyNTZcIixcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGludGVybmFsVHlwZTogXCJ1aW50MTI4XCIsXG4gICAgICAgIG5hbWU6IFwidG9rZW5zT3dlZDBcIixcbiAgICAgICAgdHlwZTogXCJ1aW50MTI4XCIsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpbnRlcm5hbFR5cGU6IFwidWludDEyOFwiLFxuICAgICAgICBuYW1lOiBcInRva2Vuc093ZWQxXCIsXG4gICAgICAgIHR5cGU6IFwidWludDEyOFwiLFxuICAgICAgfSxcbiAgICBdLFxuICAgIHN0YXRlTXV0YWJpbGl0eTogXCJ2aWV3XCIsXG4gICAgdHlwZTogXCJmdW5jdGlvblwiLFxuICB9LFxuICB7XG4gICAgaW5wdXRzOiBbXSxcbiAgICBuYW1lOiBcInByb3RvY29sRmVlc1wiLFxuICAgIG91dHB1dHM6IFtcbiAgICAgIHtcbiAgICAgICAgaW50ZXJuYWxUeXBlOiBcInVpbnQxMjhcIixcbiAgICAgICAgbmFtZTogXCJ0b2tlbjBcIixcbiAgICAgICAgdHlwZTogXCJ1aW50MTI4XCIsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpbnRlcm5hbFR5cGU6IFwidWludDEyOFwiLFxuICAgICAgICBuYW1lOiBcInRva2VuMVwiLFxuICAgICAgICB0eXBlOiBcInVpbnQxMjhcIixcbiAgICAgIH0sXG4gICAgXSxcbiAgICBzdGF0ZU11dGFiaWxpdHk6IFwidmlld1wiLFxuICAgIHR5cGU6IFwiZnVuY3Rpb25cIixcbiAgfSxcbiAge1xuICAgIGlucHV0czogW10sXG4gICAgbmFtZTogXCJzbG90MFwiLFxuICAgIG91dHB1dHM6IFtcbiAgICAgIHtcbiAgICAgICAgaW50ZXJuYWxUeXBlOiBcInVpbnQxNjBcIixcbiAgICAgICAgbmFtZTogXCJzcXJ0UHJpY2VYOTZcIixcbiAgICAgICAgdHlwZTogXCJ1aW50MTYwXCIsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpbnRlcm5hbFR5cGU6IFwiaW50MjRcIixcbiAgICAgICAgbmFtZTogXCJ0aWNrXCIsXG4gICAgICAgIHR5cGU6IFwiaW50MjRcIixcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGludGVybmFsVHlwZTogXCJ1aW50MTZcIixcbiAgICAgICAgbmFtZTogXCJvYnNlcnZhdGlvbkluZGV4XCIsXG4gICAgICAgIHR5cGU6IFwidWludDE2XCIsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpbnRlcm5hbFR5cGU6IFwidWludDE2XCIsXG4gICAgICAgIG5hbWU6IFwib2JzZXJ2YXRpb25DYXJkaW5hbGl0eVwiLFxuICAgICAgICB0eXBlOiBcInVpbnQxNlwiLFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgaW50ZXJuYWxUeXBlOiBcInVpbnQxNlwiLFxuICAgICAgICBuYW1lOiBcIm9ic2VydmF0aW9uQ2FyZGluYWxpdHlOZXh0XCIsXG4gICAgICAgIHR5cGU6IFwidWludDE2XCIsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpbnRlcm5hbFR5cGU6IFwidWludDhcIixcbiAgICAgICAgbmFtZTogXCJmZWVQcm90b2NvbFwiLFxuICAgICAgICB0eXBlOiBcInVpbnQ4XCIsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpbnRlcm5hbFR5cGU6IFwiYm9vbFwiLFxuICAgICAgICBuYW1lOiBcInVubG9ja2VkXCIsXG4gICAgICAgIHR5cGU6IFwiYm9vbFwiLFxuICAgICAgfSxcbiAgICBdLFxuICAgIHN0YXRlTXV0YWJpbGl0eTogXCJ2aWV3XCIsXG4gICAgdHlwZTogXCJmdW5jdGlvblwiLFxuICB9LFxuICB7XG4gICAgaW5wdXRzOiBbXG4gICAgICB7XG4gICAgICAgIGludGVybmFsVHlwZTogXCJpbnQxNlwiLFxuICAgICAgICBuYW1lOiBcIndvcmRQb3NpdGlvblwiLFxuICAgICAgICB0eXBlOiBcImludDE2XCIsXG4gICAgICB9LFxuICAgIF0sXG4gICAgbmFtZTogXCJ0aWNrQml0bWFwXCIsXG4gICAgb3V0cHV0czogW1xuICAgICAge1xuICAgICAgICBpbnRlcm5hbFR5cGU6IFwidWludDI1NlwiLFxuICAgICAgICBuYW1lOiBcIlwiLFxuICAgICAgICB0eXBlOiBcInVpbnQyNTZcIixcbiAgICAgIH0sXG4gICAgXSxcbiAgICBzdGF0ZU11dGFiaWxpdHk6IFwidmlld1wiLFxuICAgIHR5cGU6IFwiZnVuY3Rpb25cIixcbiAgfSxcbiAge1xuICAgIGlucHV0czogW1xuICAgICAge1xuICAgICAgICBpbnRlcm5hbFR5cGU6IFwiaW50MjRcIixcbiAgICAgICAgbmFtZTogXCJ0aWNrXCIsXG4gICAgICAgIHR5cGU6IFwiaW50MjRcIixcbiAgICAgIH0sXG4gICAgXSxcbiAgICBuYW1lOiBcInRpY2tzXCIsXG4gICAgb3V0cHV0czogW1xuICAgICAge1xuICAgICAgICBpbnRlcm5hbFR5cGU6IFwidWludDEyOFwiLFxuICAgICAgICBuYW1lOiBcImxpcXVpZGl0eUdyb3NzXCIsXG4gICAgICAgIHR5cGU6IFwidWludDEyOFwiLFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgaW50ZXJuYWxUeXBlOiBcImludDEyOFwiLFxuICAgICAgICBuYW1lOiBcImxpcXVpZGl0eU5ldFwiLFxuICAgICAgICB0eXBlOiBcImludDEyOFwiLFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgaW50ZXJuYWxUeXBlOiBcInVpbnQyNTZcIixcbiAgICAgICAgbmFtZTogXCJmZWVHcm93dGhPdXRzaWRlMFgxMjhcIixcbiAgICAgICAgdHlwZTogXCJ1aW50MjU2XCIsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpbnRlcm5hbFR5cGU6IFwidWludDI1NlwiLFxuICAgICAgICBuYW1lOiBcImZlZUdyb3d0aE91dHNpZGUxWDEyOFwiLFxuICAgICAgICB0eXBlOiBcInVpbnQyNTZcIixcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGludGVybmFsVHlwZTogXCJpbnQ1NlwiLFxuICAgICAgICBuYW1lOiBcInRpY2tDdW11bGF0aXZlT3V0c2lkZVwiLFxuICAgICAgICB0eXBlOiBcImludDU2XCIsXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICBpbnRlcm5hbFR5cGU6IFwidWludDE2MFwiLFxuICAgICAgICBuYW1lOiBcInNlY29uZHNQZXJMaXF1aWRpdHlPdXRzaWRlWDEyOFwiLFxuICAgICAgICB0eXBlOiBcInVpbnQxNjBcIixcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGludGVybmFsVHlwZTogXCJ1aW50MzJcIixcbiAgICAgICAgbmFtZTogXCJzZWNvbmRzT3V0c2lkZVwiLFxuICAgICAgICB0eXBlOiBcInVpbnQzMlwiLFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgaW50ZXJuYWxUeXBlOiBcImJvb2xcIixcbiAgICAgICAgbmFtZTogXCJpbml0aWFsaXplZFwiLFxuICAgICAgICB0eXBlOiBcImJvb2xcIixcbiAgICAgIH0sXG4gICAgXSxcbiAgICBzdGF0ZU11dGFiaWxpdHk6IFwidmlld1wiLFxuICAgIHR5cGU6IFwiZnVuY3Rpb25cIixcbiAgfSxcbl07XG5cbmV4cG9ydCBjbGFzcyBJVW5pc3dhcFYzUG9vbFN0YXRlX19mYWN0b3J5IHtcbiAgc3RhdGljIHJlYWRvbmx5IGFiaSA9IF9hYmk7XG4gIHN0YXRpYyBjcmVhdGVJbnRlcmZhY2UoKTogSVVuaXN3YXBWM1Bvb2xTdGF0ZUludGVyZmFjZSB7XG4gICAgcmV0dXJuIG5ldyB1dGlscy5JbnRlcmZhY2UoX2FiaSkgYXMgSVVuaXN3YXBWM1Bvb2xTdGF0ZUludGVyZmFjZTtcbiAgfVxuICBzdGF0aWMgY29ubmVjdChcbiAgICBhZGRyZXNzOiBzdHJpbmcsXG4gICAgc2lnbmVyT3JQcm92aWRlcjogU2lnbmVyIHwgUHJvdmlkZXJcbiAgKTogSVVuaXN3YXBWM1Bvb2xTdGF0ZSB7XG4gICAgcmV0dXJuIG5ldyBDb250cmFjdChhZGRyZXNzLCBfYWJpLCBzaWduZXJPclByb3ZpZGVyKSBhcyBJVW5pc3dhcFYzUG9vbFN0YXRlO1xuICB9XG59XG4iXX0=