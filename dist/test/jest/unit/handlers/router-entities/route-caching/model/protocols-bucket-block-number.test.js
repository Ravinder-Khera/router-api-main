import { ProtocolsBucketBlockNumber } from '../../../../../../../lib/handlers/router-entities/route-caching/model/protocols-bucket-block-number';
import { Protocol } from '@uniswap/router-sdk';
import { describe, it, expect } from '@jest/globals';
describe('ProtocolsBucketBlockNumber', () => {
    describe('#fullKey', () => {
        it('returns a string-ified version of the object', () => {
            const protocolsBucketBlockNumber = new ProtocolsBucketBlockNumber({
                protocols: [Protocol.MIXED, Protocol.V2, Protocol.V3],
                bucket: 5,
                blockNumber: 12345,
            });
            expect(protocolsBucketBlockNumber.fullKey()).toBe('MIXED,V2,V3/5/12345');
        });
        it('protocols are sorted, even if the original array is not', () => {
            const protocolsBucketBlockNumber = new ProtocolsBucketBlockNumber({
                protocols: [Protocol.V3, Protocol.MIXED, Protocol.V2],
                bucket: 5,
                blockNumber: 12345,
            });
            expect(protocolsBucketBlockNumber.fullKey()).toBe('MIXED,V2,V3/5/12345');
        });
        it('throws an error when the bucketNumber is undefined', () => {
            const protocolsBucketBlockNumber = new ProtocolsBucketBlockNumber({
                protocols: [Protocol.V3, Protocol.MIXED, Protocol.V2],
                bucket: 5,
            });
            expect(() => protocolsBucketBlockNumber.fullKey()).toThrow('BlockNumber is necessary to create a fullKey');
        });
    });
    describe('#protocolsBucketPartialKey', () => {
        it('returns a string-ified version of the object without the blockNumber', () => {
            const protocolsBucketBlockNumber = new ProtocolsBucketBlockNumber({
                protocols: [Protocol.MIXED, Protocol.V2, Protocol.V3],
                bucket: 5,
                blockNumber: 12345,
            });
            expect(protocolsBucketBlockNumber.protocolsBucketPartialKey()).toBe('MIXED,V2,V3/5/');
        });
        it('protocols are sorted, even if the original array is not, without the blockNumber', () => {
            const protocolsBucketBlockNumber = new ProtocolsBucketBlockNumber({
                protocols: [Protocol.V3, Protocol.MIXED, Protocol.V2],
                bucket: 5,
                blockNumber: 12345,
            });
            expect(protocolsBucketBlockNumber.protocolsBucketPartialKey()).toBe('MIXED,V2,V3/5/');
        });
        it('returns the partial key even if blockNumber is undefined', () => {
            const protocolsBucketBlockNumber = new ProtocolsBucketBlockNumber({
                protocols: [Protocol.V3, Protocol.MIXED, Protocol.V2],
                bucket: 5,
            });
            expect(protocolsBucketBlockNumber.protocolsBucketPartialKey()).toBe('MIXED,V2,V3/5/');
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJvdG9jb2xzLWJ1Y2tldC1ibG9jay1udW1iZXIudGVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uLy4uLy4uLy4uLy4uLy4uLy4uL3Rlc3QvamVzdC91bml0L2hhbmRsZXJzL3JvdXRlci1lbnRpdGllcy9yb3V0ZS1jYWNoaW5nL21vZGVsL3Byb3RvY29scy1idWNrZXQtYmxvY2stbnVtYmVyLnRlc3QudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLDBCQUEwQixFQUFFLE1BQU0scUdBQXFHLENBQUE7QUFDaEosT0FBTyxFQUFFLFFBQVEsRUFBRSxNQUFNLHFCQUFxQixDQUFBO0FBQzlDLE9BQU8sRUFBRSxRQUFRLEVBQUUsRUFBRSxFQUFFLE1BQU0sRUFBRSxNQUFNLGVBQWUsQ0FBQTtBQUVwRCxRQUFRLENBQUMsNEJBQTRCLEVBQUUsR0FBRyxFQUFFO0lBQzFDLFFBQVEsQ0FBQyxVQUFVLEVBQUUsR0FBRyxFQUFFO1FBQ3hCLEVBQUUsQ0FBQyw4Q0FBOEMsRUFBRSxHQUFHLEVBQUU7WUFDdEQsTUFBTSwwQkFBMEIsR0FBRyxJQUFJLDBCQUEwQixDQUFDO2dCQUNoRSxTQUFTLEVBQUUsQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxFQUFFLEVBQUUsUUFBUSxDQUFDLEVBQUUsQ0FBQztnQkFDckQsTUFBTSxFQUFFLENBQUM7Z0JBQ1QsV0FBVyxFQUFFLEtBQUs7YUFDbkIsQ0FBQyxDQUFBO1lBRUYsTUFBTSxDQUFDLDBCQUEwQixDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLENBQUE7UUFDMUUsQ0FBQyxDQUFDLENBQUE7UUFFRixFQUFFLENBQUMseURBQXlELEVBQUUsR0FBRyxFQUFFO1lBQ2pFLE1BQU0sMEJBQTBCLEdBQUcsSUFBSSwwQkFBMEIsQ0FBQztnQkFDaEUsU0FBUyxFQUFFLENBQUMsUUFBUSxDQUFDLEVBQUUsRUFBRSxRQUFRLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxFQUFFLENBQUM7Z0JBQ3JELE1BQU0sRUFBRSxDQUFDO2dCQUNULFdBQVcsRUFBRSxLQUFLO2FBQ25CLENBQUMsQ0FBQTtZQUVGLE1BQU0sQ0FBQywwQkFBMEIsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxDQUFBO1FBQzFFLENBQUMsQ0FBQyxDQUFBO1FBRUYsRUFBRSxDQUFDLG9EQUFvRCxFQUFFLEdBQUcsRUFBRTtZQUM1RCxNQUFNLDBCQUEwQixHQUFHLElBQUksMEJBQTBCLENBQUM7Z0JBQ2hFLFNBQVMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxFQUFFLEVBQUUsUUFBUSxDQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsRUFBRSxDQUFDO2dCQUNyRCxNQUFNLEVBQUUsQ0FBQzthQUNWLENBQUMsQ0FBQTtZQUVGLE1BQU0sQ0FBQyxHQUFHLEVBQUUsQ0FBQywwQkFBMEIsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyw4Q0FBOEMsQ0FBQyxDQUFBO1FBQzVHLENBQUMsQ0FBQyxDQUFBO0lBQ0osQ0FBQyxDQUFDLENBQUE7SUFFRixRQUFRLENBQUMsNEJBQTRCLEVBQUUsR0FBRyxFQUFFO1FBQzFDLEVBQUUsQ0FBQyxzRUFBc0UsRUFBRSxHQUFHLEVBQUU7WUFDOUUsTUFBTSwwQkFBMEIsR0FBRyxJQUFJLDBCQUEwQixDQUFDO2dCQUNoRSxTQUFTLEVBQUUsQ0FBQyxRQUFRLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxFQUFFLEVBQUUsUUFBUSxDQUFDLEVBQUUsQ0FBQztnQkFDckQsTUFBTSxFQUFFLENBQUM7Z0JBQ1QsV0FBVyxFQUFFLEtBQUs7YUFDbkIsQ0FBQyxDQUFBO1lBRUYsTUFBTSxDQUFDLDBCQUEwQixDQUFDLHlCQUF5QixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQTtRQUN2RixDQUFDLENBQUMsQ0FBQTtRQUVGLEVBQUUsQ0FBQyxrRkFBa0YsRUFBRSxHQUFHLEVBQUU7WUFDMUYsTUFBTSwwQkFBMEIsR0FBRyxJQUFJLDBCQUEwQixDQUFDO2dCQUNoRSxTQUFTLEVBQUUsQ0FBQyxRQUFRLENBQUMsRUFBRSxFQUFFLFFBQVEsQ0FBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLEVBQUUsQ0FBQztnQkFDckQsTUFBTSxFQUFFLENBQUM7Z0JBQ1QsV0FBVyxFQUFFLEtBQUs7YUFDbkIsQ0FBQyxDQUFBO1lBRUYsTUFBTSxDQUFDLDBCQUEwQixDQUFDLHlCQUF5QixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQTtRQUN2RixDQUFDLENBQUMsQ0FBQTtRQUVGLEVBQUUsQ0FBQywwREFBMEQsRUFBRSxHQUFHLEVBQUU7WUFDbEUsTUFBTSwwQkFBMEIsR0FBRyxJQUFJLDBCQUEwQixDQUFDO2dCQUNoRSxTQUFTLEVBQUUsQ0FBQyxRQUFRLENBQUMsRUFBRSxFQUFFLFFBQVEsQ0FBQyxLQUFLLEVBQUUsUUFBUSxDQUFDLEVBQUUsQ0FBQztnQkFDckQsTUFBTSxFQUFFLENBQUM7YUFDVixDQUFDLENBQUE7WUFFRixNQUFNLENBQUMsMEJBQTBCLENBQUMseUJBQXlCLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFBO1FBQ3ZGLENBQUMsQ0FBQyxDQUFBO0lBQ0osQ0FBQyxDQUFDLENBQUE7QUFDSixDQUFDLENBQUMsQ0FBQSIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFByb3RvY29sc0J1Y2tldEJsb2NrTnVtYmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vLi4vbGliL2hhbmRsZXJzL3JvdXRlci1lbnRpdGllcy9yb3V0ZS1jYWNoaW5nL21vZGVsL3Byb3RvY29scy1idWNrZXQtYmxvY2stbnVtYmVyJ1xuaW1wb3J0IHsgUHJvdG9jb2wgfSBmcm9tICdAdW5pc3dhcC9yb3V0ZXItc2RrJ1xuaW1wb3J0IHsgZGVzY3JpYmUsIGl0LCBleHBlY3QgfSBmcm9tICdAamVzdC9nbG9iYWxzJ1xuXG5kZXNjcmliZSgnUHJvdG9jb2xzQnVja2V0QmxvY2tOdW1iZXInLCAoKSA9PiB7XG4gIGRlc2NyaWJlKCcjZnVsbEtleScsICgpID0+IHtcbiAgICBpdCgncmV0dXJucyBhIHN0cmluZy1pZmllZCB2ZXJzaW9uIG9mIHRoZSBvYmplY3QnLCAoKSA9PiB7XG4gICAgICBjb25zdCBwcm90b2NvbHNCdWNrZXRCbG9ja051bWJlciA9IG5ldyBQcm90b2NvbHNCdWNrZXRCbG9ja051bWJlcih7XG4gICAgICAgIHByb3RvY29sczogW1Byb3RvY29sLk1JWEVELCBQcm90b2NvbC5WMiwgUHJvdG9jb2wuVjNdLFxuICAgICAgICBidWNrZXQ6IDUsXG4gICAgICAgIGJsb2NrTnVtYmVyOiAxMjM0NSxcbiAgICAgIH0pXG5cbiAgICAgIGV4cGVjdChwcm90b2NvbHNCdWNrZXRCbG9ja051bWJlci5mdWxsS2V5KCkpLnRvQmUoJ01JWEVELFYyLFYzLzUvMTIzNDUnKVxuICAgIH0pXG5cbiAgICBpdCgncHJvdG9jb2xzIGFyZSBzb3J0ZWQsIGV2ZW4gaWYgdGhlIG9yaWdpbmFsIGFycmF5IGlzIG5vdCcsICgpID0+IHtcbiAgICAgIGNvbnN0IHByb3RvY29sc0J1Y2tldEJsb2NrTnVtYmVyID0gbmV3IFByb3RvY29sc0J1Y2tldEJsb2NrTnVtYmVyKHtcbiAgICAgICAgcHJvdG9jb2xzOiBbUHJvdG9jb2wuVjMsIFByb3RvY29sLk1JWEVELCBQcm90b2NvbC5WMl0sXG4gICAgICAgIGJ1Y2tldDogNSxcbiAgICAgICAgYmxvY2tOdW1iZXI6IDEyMzQ1LFxuICAgICAgfSlcblxuICAgICAgZXhwZWN0KHByb3RvY29sc0J1Y2tldEJsb2NrTnVtYmVyLmZ1bGxLZXkoKSkudG9CZSgnTUlYRUQsVjIsVjMvNS8xMjM0NScpXG4gICAgfSlcblxuICAgIGl0KCd0aHJvd3MgYW4gZXJyb3Igd2hlbiB0aGUgYnVja2V0TnVtYmVyIGlzIHVuZGVmaW5lZCcsICgpID0+IHtcbiAgICAgIGNvbnN0IHByb3RvY29sc0J1Y2tldEJsb2NrTnVtYmVyID0gbmV3IFByb3RvY29sc0J1Y2tldEJsb2NrTnVtYmVyKHtcbiAgICAgICAgcHJvdG9jb2xzOiBbUHJvdG9jb2wuVjMsIFByb3RvY29sLk1JWEVELCBQcm90b2NvbC5WMl0sXG4gICAgICAgIGJ1Y2tldDogNSxcbiAgICAgIH0pXG5cbiAgICAgIGV4cGVjdCgoKSA9PiBwcm90b2NvbHNCdWNrZXRCbG9ja051bWJlci5mdWxsS2V5KCkpLnRvVGhyb3coJ0Jsb2NrTnVtYmVyIGlzIG5lY2Vzc2FyeSB0byBjcmVhdGUgYSBmdWxsS2V5JylcbiAgICB9KVxuICB9KVxuXG4gIGRlc2NyaWJlKCcjcHJvdG9jb2xzQnVja2V0UGFydGlhbEtleScsICgpID0+IHtcbiAgICBpdCgncmV0dXJucyBhIHN0cmluZy1pZmllZCB2ZXJzaW9uIG9mIHRoZSBvYmplY3Qgd2l0aG91dCB0aGUgYmxvY2tOdW1iZXInLCAoKSA9PiB7XG4gICAgICBjb25zdCBwcm90b2NvbHNCdWNrZXRCbG9ja051bWJlciA9IG5ldyBQcm90b2NvbHNCdWNrZXRCbG9ja051bWJlcih7XG4gICAgICAgIHByb3RvY29sczogW1Byb3RvY29sLk1JWEVELCBQcm90b2NvbC5WMiwgUHJvdG9jb2wuVjNdLFxuICAgICAgICBidWNrZXQ6IDUsXG4gICAgICAgIGJsb2NrTnVtYmVyOiAxMjM0NSxcbiAgICAgIH0pXG5cbiAgICAgIGV4cGVjdChwcm90b2NvbHNCdWNrZXRCbG9ja051bWJlci5wcm90b2NvbHNCdWNrZXRQYXJ0aWFsS2V5KCkpLnRvQmUoJ01JWEVELFYyLFYzLzUvJylcbiAgICB9KVxuXG4gICAgaXQoJ3Byb3RvY29scyBhcmUgc29ydGVkLCBldmVuIGlmIHRoZSBvcmlnaW5hbCBhcnJheSBpcyBub3QsIHdpdGhvdXQgdGhlIGJsb2NrTnVtYmVyJywgKCkgPT4ge1xuICAgICAgY29uc3QgcHJvdG9jb2xzQnVja2V0QmxvY2tOdW1iZXIgPSBuZXcgUHJvdG9jb2xzQnVja2V0QmxvY2tOdW1iZXIoe1xuICAgICAgICBwcm90b2NvbHM6IFtQcm90b2NvbC5WMywgUHJvdG9jb2wuTUlYRUQsIFByb3RvY29sLlYyXSxcbiAgICAgICAgYnVja2V0OiA1LFxuICAgICAgICBibG9ja051bWJlcjogMTIzNDUsXG4gICAgICB9KVxuXG4gICAgICBleHBlY3QocHJvdG9jb2xzQnVja2V0QmxvY2tOdW1iZXIucHJvdG9jb2xzQnVja2V0UGFydGlhbEtleSgpKS50b0JlKCdNSVhFRCxWMixWMy81LycpXG4gICAgfSlcblxuICAgIGl0KCdyZXR1cm5zIHRoZSBwYXJ0aWFsIGtleSBldmVuIGlmIGJsb2NrTnVtYmVyIGlzIHVuZGVmaW5lZCcsICgpID0+IHtcbiAgICAgIGNvbnN0IHByb3RvY29sc0J1Y2tldEJsb2NrTnVtYmVyID0gbmV3IFByb3RvY29sc0J1Y2tldEJsb2NrTnVtYmVyKHtcbiAgICAgICAgcHJvdG9jb2xzOiBbUHJvdG9jb2wuVjMsIFByb3RvY29sLk1JWEVELCBQcm90b2NvbC5WMl0sXG4gICAgICAgIGJ1Y2tldDogNSxcbiAgICAgIH0pXG5cbiAgICAgIGV4cGVjdChwcm90b2NvbHNCdWNrZXRCbG9ja051bWJlci5wcm90b2NvbHNCdWNrZXRQYXJ0aWFsS2V5KCkpLnRvQmUoJ01JWEVELFYyLFYzLzUvJylcbiAgICB9KVxuICB9KVxufSlcbiJdfQ==