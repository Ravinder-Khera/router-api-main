import { V3PoolProvider } from '@uniswap/smart-order-router';
import { Pool } from '@uniswap/v3-sdk';
import { buildMockV3PoolAccessor, DAI_USDT_LOW, USDC_DAI_LOW, USDC_DAI_MEDIUM, USDC_WETH_LOW, WETH9_USDT_LOW, } from './mocked-data';
import sinon from 'sinon';
export function getMockedV3PoolProvider(pools = [USDC_DAI_LOW, USDC_DAI_MEDIUM, USDC_WETH_LOW, WETH9_USDT_LOW, DAI_USDT_LOW]) {
    const mockV3PoolProvider = sinon.createStubInstance(V3PoolProvider);
    mockV3PoolProvider.getPools.resolves(buildMockV3PoolAccessor(pools));
    mockV3PoolProvider.getPoolAddress.callsFake((tA, tB, fee) => ({
        poolAddress: Pool.getAddress(tA, tB, fee),
        token0: tA,
        token1: tB,
    }));
    return mockV3PoolProvider;
}
export const TEST_ROUTE_TABLE = {
    TableName: 'PoolCachingV3',
    KeySchema: [
        {
            AttributeName: 'poolAddress',
            KeyType: 'HASH',
        },
        {
            AttributeName: 'blockNumber',
            KeyType: 'RANGE',
        },
    ],
    AttributeDefinitions: [
        {
            AttributeName: 'poolAddress',
            AttributeType: 'S',
        },
        {
            AttributeName: 'blockNumber',
            AttributeType: 'N',
        },
    ],
    ProvisionedThroughput: {
        ReadCapacityUnits: 1,
        WriteCapacityUnits: 1,
    },
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9ja2VkLWRlcGVuZGVuY2llcy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL3Rlc3QvdGVzdC11dGlscy9tb2NrZWQtZGVwZW5kZW5jaWVzLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxjQUFjLEVBQUUsTUFBTSw2QkFBNkIsQ0FBQTtBQUM1RCxPQUFPLEVBQUUsSUFBSSxFQUFFLE1BQU0saUJBQWlCLENBQUE7QUFDdEMsT0FBTyxFQUNMLHVCQUF1QixFQUN2QixZQUFZLEVBQ1osWUFBWSxFQUNaLGVBQWUsRUFDZixhQUFhLEVBQ2IsY0FBYyxHQUNmLE1BQU0sZUFBZSxDQUFBO0FBQ3RCLE9BQU8sS0FBSyxNQUFNLE9BQU8sQ0FBQTtBQUV6QixNQUFNLFVBQVUsdUJBQXVCLENBQ3JDLFFBQWdCLENBQUMsWUFBWSxFQUFFLGVBQWUsRUFBRSxhQUFhLEVBQUUsY0FBYyxFQUFFLFlBQVksQ0FBQztJQUU1RixNQUFNLGtCQUFrQixHQUFHLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxjQUFjLENBQUMsQ0FBQTtJQUVuRSxrQkFBa0IsQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDLHVCQUF1QixDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUE7SUFDcEUsa0JBQWtCLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQyxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsR0FBRyxFQUFFLEVBQUUsQ0FBQyxDQUFDO1FBQzVELFdBQVcsRUFBRSxJQUFJLENBQUMsVUFBVSxDQUFDLEVBQUUsRUFBRSxFQUFFLEVBQUUsR0FBRyxDQUFDO1FBQ3pDLE1BQU0sRUFBRSxFQUFFO1FBQ1YsTUFBTSxFQUFFLEVBQUU7S0FDWCxDQUFDLENBQUMsQ0FBQTtJQUVILE9BQU8sa0JBQWtCLENBQUE7QUFDM0IsQ0FBQztBQUVELE1BQU0sQ0FBQyxNQUFNLGdCQUFnQixHQUFHO0lBQzlCLFNBQVMsRUFBRSxlQUFlO0lBQzFCLFNBQVMsRUFBRTtRQUNUO1lBQ0UsYUFBYSxFQUFFLGFBQWE7WUFDNUIsT0FBTyxFQUFFLE1BQU07U0FDaEI7UUFDRDtZQUNFLGFBQWEsRUFBRSxhQUFhO1lBQzVCLE9BQU8sRUFBRSxPQUFPO1NBQ2pCO0tBQ0Y7SUFDRCxvQkFBb0IsRUFBRTtRQUNwQjtZQUNFLGFBQWEsRUFBRSxhQUFhO1lBQzVCLGFBQWEsRUFBRSxHQUFHO1NBQ25CO1FBQ0Q7WUFDRSxhQUFhLEVBQUUsYUFBYTtZQUM1QixhQUFhLEVBQUUsR0FBRztTQUNuQjtLQUNGO0lBQ0QscUJBQXFCLEVBQUU7UUFDckIsaUJBQWlCLEVBQUUsQ0FBQztRQUNwQixrQkFBa0IsRUFBRSxDQUFDO0tBQ3RCO0NBQ0YsQ0FBQSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFYzUG9vbFByb3ZpZGVyIH0gZnJvbSAnQHVuaXN3YXAvc21hcnQtb3JkZXItcm91dGVyJ1xuaW1wb3J0IHsgUG9vbCB9IGZyb20gJ0B1bmlzd2FwL3YzLXNkaydcbmltcG9ydCB7XG4gIGJ1aWxkTW9ja1YzUG9vbEFjY2Vzc29yLFxuICBEQUlfVVNEVF9MT1csXG4gIFVTRENfREFJX0xPVyxcbiAgVVNEQ19EQUlfTUVESVVNLFxuICBVU0RDX1dFVEhfTE9XLFxuICBXRVRIOV9VU0RUX0xPVyxcbn0gZnJvbSAnLi9tb2NrZWQtZGF0YSdcbmltcG9ydCBzaW5vbiBmcm9tICdzaW5vbidcblxuZXhwb3J0IGZ1bmN0aW9uIGdldE1vY2tlZFYzUG9vbFByb3ZpZGVyKFxuICBwb29sczogUG9vbFtdID0gW1VTRENfREFJX0xPVywgVVNEQ19EQUlfTUVESVVNLCBVU0RDX1dFVEhfTE9XLCBXRVRIOV9VU0RUX0xPVywgREFJX1VTRFRfTE9XXVxuKTogVjNQb29sUHJvdmlkZXIge1xuICBjb25zdCBtb2NrVjNQb29sUHJvdmlkZXIgPSBzaW5vbi5jcmVhdGVTdHViSW5zdGFuY2UoVjNQb29sUHJvdmlkZXIpXG5cbiAgbW9ja1YzUG9vbFByb3ZpZGVyLmdldFBvb2xzLnJlc29sdmVzKGJ1aWxkTW9ja1YzUG9vbEFjY2Vzc29yKHBvb2xzKSlcbiAgbW9ja1YzUG9vbFByb3ZpZGVyLmdldFBvb2xBZGRyZXNzLmNhbGxzRmFrZSgodEEsIHRCLCBmZWUpID0+ICh7XG4gICAgcG9vbEFkZHJlc3M6IFBvb2wuZ2V0QWRkcmVzcyh0QSwgdEIsIGZlZSksXG4gICAgdG9rZW4wOiB0QSxcbiAgICB0b2tlbjE6IHRCLFxuICB9KSlcblxuICByZXR1cm4gbW9ja1YzUG9vbFByb3ZpZGVyXG59XG5cbmV4cG9ydCBjb25zdCBURVNUX1JPVVRFX1RBQkxFID0ge1xuICBUYWJsZU5hbWU6ICdQb29sQ2FjaGluZ1YzJyxcbiAgS2V5U2NoZW1hOiBbXG4gICAge1xuICAgICAgQXR0cmlidXRlTmFtZTogJ3Bvb2xBZGRyZXNzJyxcbiAgICAgIEtleVR5cGU6ICdIQVNIJyxcbiAgICB9LFxuICAgIHtcbiAgICAgIEF0dHJpYnV0ZU5hbWU6ICdibG9ja051bWJlcicsXG4gICAgICBLZXlUeXBlOiAnUkFOR0UnLFxuICAgIH0sXG4gIF0sXG4gIEF0dHJpYnV0ZURlZmluaXRpb25zOiBbXG4gICAge1xuICAgICAgQXR0cmlidXRlTmFtZTogJ3Bvb2xBZGRyZXNzJyxcbiAgICAgIEF0dHJpYnV0ZVR5cGU6ICdTJyxcbiAgICB9LFxuICAgIHtcbiAgICAgIEF0dHJpYnV0ZU5hbWU6ICdibG9ja051bWJlcicsXG4gICAgICBBdHRyaWJ1dGVUeXBlOiAnTicsXG4gICAgfSxcbiAgXSxcbiAgUHJvdmlzaW9uZWRUaHJvdWdocHV0OiB7XG4gICAgUmVhZENhcGFjaXR5VW5pdHM6IDEsXG4gICAgV3JpdGVDYXBhY2l0eVVuaXRzOiAxLFxuICB9LFxufVxuIl19