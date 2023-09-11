/**
 * Class used to model the partition key of the CachedRoutes cache database and configuration.
 */
export class PairTradeTypeChainId {
    constructor({ tokenIn, tokenOut, tradeType, chainId }) {
        this.tokenIn = tokenIn.toLowerCase(); // All token addresses should be lower case for normalization.
        this.tokenOut = tokenOut.toLowerCase(); // All token addresses should be lower case for normalization.
        this.tradeType = tradeType;
        this.chainId = chainId;
    }
    toString() {
        return `${this.tokenIn}/${this.tokenOut}/${this.tradeType}/${this.chainId}`;
    }
    static fromCachedRoutes(cachedRoutes) {
        return new PairTradeTypeChainId({
            tokenIn: cachedRoutes.tokenIn.address,
            tokenOut: cachedRoutes.tokenOut.address,
            tradeType: cachedRoutes.tradeType,
            chainId: cachedRoutes.chainId,
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicGFpci10cmFkZS10eXBlLWNoYWluLWlkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbGliL2hhbmRsZXJzL3JvdXRlci1lbnRpdGllcy9yb3V0ZS1jYWNoaW5nL21vZGVsL3BhaXItdHJhZGUtdHlwZS1jaGFpbi1pZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFVQTs7R0FFRztBQUNILE1BQU0sT0FBTyxvQkFBb0I7SUFNL0IsWUFBWSxFQUFFLE9BQU8sRUFBRSxRQUFRLEVBQUUsU0FBUyxFQUFFLE9BQU8sRUFBNEI7UUFDN0UsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUEsQ0FBQyw4REFBOEQ7UUFDbkcsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRLENBQUMsV0FBVyxFQUFFLENBQUEsQ0FBQyw4REFBOEQ7UUFDckcsSUFBSSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUE7UUFDMUIsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUE7SUFDeEIsQ0FBQztJQUVNLFFBQVE7UUFDYixPQUFPLEdBQUcsSUFBSSxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUMsUUFBUSxJQUFJLElBQUksQ0FBQyxTQUFTLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRSxDQUFBO0lBQzdFLENBQUM7SUFFTSxNQUFNLENBQUMsZ0JBQWdCLENBQUMsWUFBMEI7UUFDdkQsT0FBTyxJQUFJLG9CQUFvQixDQUFDO1lBQzlCLE9BQU8sRUFBRSxZQUFZLENBQUMsT0FBTyxDQUFDLE9BQU87WUFDckMsUUFBUSxFQUFFLFlBQVksQ0FBQyxRQUFRLENBQUMsT0FBTztZQUN2QyxTQUFTLEVBQUUsWUFBWSxDQUFDLFNBQVM7WUFDakMsT0FBTyxFQUFFLFlBQVksQ0FBQyxPQUFPO1NBQzlCLENBQUMsQ0FBQTtJQUNKLENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENoYWluSWQsIFRyYWRlVHlwZSB9IGZyb20gJ0B1bmlzd2FwL3Nkay1jb3JlJ1xuaW1wb3J0IHsgQ2FjaGVkUm91dGVzIH0gZnJvbSAnQHVuaXN3YXAvc21hcnQtb3JkZXItcm91dGVyJ1xuXG5pbnRlcmZhY2UgUGFpclRyYWRlVHlwZUNoYWluSWRBcmdzIHtcbiAgdG9rZW5Jbjogc3RyaW5nXG4gIHRva2VuT3V0OiBzdHJpbmdcbiAgdHJhZGVUeXBlOiBUcmFkZVR5cGVcbiAgY2hhaW5JZDogQ2hhaW5JZFxufVxuXG4vKipcbiAqIENsYXNzIHVzZWQgdG8gbW9kZWwgdGhlIHBhcnRpdGlvbiBrZXkgb2YgdGhlIENhY2hlZFJvdXRlcyBjYWNoZSBkYXRhYmFzZSBhbmQgY29uZmlndXJhdGlvbi5cbiAqL1xuZXhwb3J0IGNsYXNzIFBhaXJUcmFkZVR5cGVDaGFpbklkIHtcbiAgcHJpdmF0ZSB0b2tlbkluOiBzdHJpbmdcbiAgcHJpdmF0ZSB0b2tlbk91dDogc3RyaW5nXG4gIHByaXZhdGUgdHJhZGVUeXBlOiBUcmFkZVR5cGVcbiAgcHJpdmF0ZSBjaGFpbklkOiBDaGFpbklkXG5cbiAgY29uc3RydWN0b3IoeyB0b2tlbkluLCB0b2tlbk91dCwgdHJhZGVUeXBlLCBjaGFpbklkIH06IFBhaXJUcmFkZVR5cGVDaGFpbklkQXJncykge1xuICAgIHRoaXMudG9rZW5JbiA9IHRva2VuSW4udG9Mb3dlckNhc2UoKSAvLyBBbGwgdG9rZW4gYWRkcmVzc2VzIHNob3VsZCBiZSBsb3dlciBjYXNlIGZvciBub3JtYWxpemF0aW9uLlxuICAgIHRoaXMudG9rZW5PdXQgPSB0b2tlbk91dC50b0xvd2VyQ2FzZSgpIC8vIEFsbCB0b2tlbiBhZGRyZXNzZXMgc2hvdWxkIGJlIGxvd2VyIGNhc2UgZm9yIG5vcm1hbGl6YXRpb24uXG4gICAgdGhpcy50cmFkZVR5cGUgPSB0cmFkZVR5cGVcbiAgICB0aGlzLmNoYWluSWQgPSBjaGFpbklkXG4gIH1cblxuICBwdWJsaWMgdG9TdHJpbmcoKTogc3RyaW5nIHtcbiAgICByZXR1cm4gYCR7dGhpcy50b2tlbklufS8ke3RoaXMudG9rZW5PdXR9LyR7dGhpcy50cmFkZVR5cGV9LyR7dGhpcy5jaGFpbklkfWBcbiAgfVxuXG4gIHB1YmxpYyBzdGF0aWMgZnJvbUNhY2hlZFJvdXRlcyhjYWNoZWRSb3V0ZXM6IENhY2hlZFJvdXRlcyk6IFBhaXJUcmFkZVR5cGVDaGFpbklkIHtcbiAgICByZXR1cm4gbmV3IFBhaXJUcmFkZVR5cGVDaGFpbklkKHtcbiAgICAgIHRva2VuSW46IGNhY2hlZFJvdXRlcy50b2tlbkluLmFkZHJlc3MsXG4gICAgICB0b2tlbk91dDogY2FjaGVkUm91dGVzLnRva2VuT3V0LmFkZHJlc3MsXG4gICAgICB0cmFkZVR5cGU6IGNhY2hlZFJvdXRlcy50cmFkZVR5cGUsXG4gICAgICBjaGFpbklkOiBjYWNoZWRSb3V0ZXMuY2hhaW5JZCxcbiAgICB9KVxuICB9XG59XG4iXX0=