import { CachedRoutes, CacheMode, IRouteCachingProvider, log, routeToString, } from '@uniswap/smart-order-router';
import { DynamoDB } from 'aws-sdk';
import { TradeType } from '@uniswap/sdk-core';
import { CACHED_ROUTES_CONFIGURATION } from './cached-routes-configuration';
import { PairTradeTypeChainId } from './model/pair-trade-type-chain-id';
import { CachedRoutesMarshaller } from '../../marshalling/cached-routes-marshaller';
import { ProtocolsBucketBlockNumber } from './model/protocols-bucket-block-number';
export class DynamoRouteCachingProvider extends IRouteCachingProvider {
    constructor({ cachedRoutesTableName, ttlMinutes = 2 }) {
        super();
        // Since this DDB Table is used for Cache, we will fail fast and limit the timeout.
        this.ddbClient = new DynamoDB.DocumentClient({
            maxRetries: 1,
            retryDelayOptions: {
                base: 20,
            },
            httpOptions: {
                timeout: 100,
            },
        });
        this.tableName = cachedRoutesTableName;
        this.ttlMinutes = ttlMinutes;
    }
    /**
     * Implementation of the abstract method defined in `IRouteCachingProvider`
     * Given a CachedRoutesStrategy (from CACHED_ROUTES_CONFIGURATION),
     * we will find the BlocksToLive associated to the bucket.
     *
     * @param cachedRoutes
     * @param amount
     * @protected
     */
    async _getBlocksToLive(cachedRoutes, amount) {
        const cachedRoutesStrategy = this.getCachedRoutesStrategyFromCachedRoutes(cachedRoutes);
        const cachingParameters = cachedRoutesStrategy === null || cachedRoutesStrategy === void 0 ? void 0 : cachedRoutesStrategy.getCachingBucket(amount);
        if (cachingParameters) {
            return cachingParameters.blocksToLive;
        }
        else {
            return 0;
        }
    }
    /**
     * Implementation of the abstract method defined in `IRouteCachingProvider`
     * Fetch the most recent entry from the DynamoDB table for that pair, tradeType, chainId, protocols and bucket
     *
     * @param chainId
     * @param amount
     * @param quoteToken
     * @param tradeType
     * @param protocols
     * @protected
     */
    async _getCachedRoute(chainId, amount, quoteToken, tradeType, protocols) {
        const { tokenIn, tokenOut } = this.determineTokenInOut(amount, quoteToken, tradeType);
        const cachedRoutesStrategy = this.getCachedRoutesStrategy(tokenIn, tokenOut, tradeType, chainId);
        const cachingBucket = cachedRoutesStrategy === null || cachedRoutesStrategy === void 0 ? void 0 : cachedRoutesStrategy.getCachingBucket(amount);
        if (cachingBucket) {
            const partitionKey = new PairTradeTypeChainId({
                tokenIn: tokenIn.address,
                tokenOut: tokenOut.address,
                tradeType,
                chainId,
            });
            const partialSortKey = new ProtocolsBucketBlockNumber({
                protocols,
                bucket: cachingBucket.bucket,
            });
            const queryParams = {
                TableName: this.tableName,
                // Since we don't know what's the latest block that we have in cache, we make a query with a partial sort key
                KeyConditionExpression: '#pk = :pk and begins_with(#sk, :sk)',
                ExpressionAttributeNames: {
                    '#pk': 'pairTradeTypeChainId',
                    '#sk': 'protocolsBucketBlockNumber',
                },
                ExpressionAttributeValues: {
                    ':pk': partitionKey.toString(),
                    ':sk': partialSortKey.protocolsBucketPartialKey(),
                },
                ScanIndexForward: false,
                Limit: Math.max(cachingBucket.withLastNCachedRoutes, 1),
            };
            try {
                log.info({ queryParams }, `[DynamoRouteCachingProvider] Attempting to get route from cache.`);
                const result = await this.ddbClient.query(queryParams).promise();
                log.info({ result }, `[DynamoRouteCachingProvider] Got the following response from querying cache`);
                if (result.Items && result.Items.length > 0) {
                    const cachedRoutesArr = result.Items.map((record) => {
                        // If we got a response with more than 1 item, we extract the binary field from the response
                        const itemBinary = record.item;
                        // Then we convert it into a Buffer
                        const cachedRoutesBuffer = Buffer.from(itemBinary);
                        // We convert that buffer into string and parse as JSON (it was encoded as JSON when it was inserted into cache)
                        const cachedRoutesJson = JSON.parse(cachedRoutesBuffer.toString());
                        // Finally we unmarshal that JSON into a `CachedRoutes` object
                        return CachedRoutesMarshaller.unmarshal(cachedRoutesJson);
                    });
                    const routesMap = new Map();
                    var blockNumber = 0;
                    var originalAmount = '';
                    cachedRoutesArr.forEach((cachedRoutes) => {
                        cachedRoutes.routes.forEach((cachedRoute) => {
                            // we use the stringified route as identifier
                            const routeId = routeToString(cachedRoute.route);
                            // Using a map to remove duplicates, we will the different percents of different routes.
                            if (!routesMap.has(routeId))
                                routesMap.set(routeId, cachedRoute);
                        });
                        // Find the latest blockNumber
                        blockNumber = Math.max(blockNumber, cachedRoutes.blockNumber);
                        // Keep track of all the originalAmounts
                        if (originalAmount === '') {
                            originalAmount = `${cachedRoutes.originalAmount} | ${routesMap.size} | ${cachedRoutes.blockNumber}`;
                        }
                        else {
                            originalAmount = `${originalAmount}, ${cachedRoutes.originalAmount} | ${routesMap.size} | ${cachedRoutes.blockNumber}`;
                        }
                    });
                    const first = cachedRoutesArr[0];
                    // Build a new CachedRoutes object with the values calculated earlier
                    const cachedRoutes = new CachedRoutes({
                        routes: Array.from(routesMap.values()),
                        chainId: first.chainId,
                        tokenIn: first.tokenIn,
                        tokenOut: first.tokenOut,
                        protocolsCovered: first.protocolsCovered,
                        blockNumber,
                        tradeType: first.tradeType,
                        originalAmount,
                        blocksToLive: first.blocksToLive,
                    });
                    log.info({ cachedRoutes }, `[DynamoRouteCachingProvider] Returning the cached and unmarshalled route.`);
                    return cachedRoutes;
                }
                else {
                    log.info(`[DynamoRouteCachingProvider] No items found in the query response.`);
                }
            }
            catch (error) {
                log.error({ queryParams, error }, `[DynamoRouteCachingProvider] Error while fetching route from cache`);
            }
        }
        // We only get here if we didn't find a cachedRoutes
        return undefined;
    }
    /**
     * Implementation of the abstract method defined in `IRouteCachingProvider`
     * Attempts to insert the `CachedRoutes` object into cache, if the CachingStrategy returns the CachingParameters
     *
     * @param cachedRoutes
     * @param amount
     * @protected
     */
    async _setCachedRoute(cachedRoutes, amount) {
        const cachedRoutesStrategy = this.getCachedRoutesStrategyFromCachedRoutes(cachedRoutes);
        const cachingBucket = cachedRoutesStrategy === null || cachedRoutesStrategy === void 0 ? void 0 : cachedRoutesStrategy.getCachingBucket(amount);
        if (cachingBucket && this.isAllowedInCache(cachingBucket, cachedRoutes)) {
            // TTL is minutes from now. multiply ttlMinutes times 60 to convert to seconds, since ttl is in seconds.
            const ttl = Math.floor(Date.now() / 1000) + 60 * this.ttlMinutes;
            // Marshal the CachedRoutes object in preparation for storing in DynamoDB
            const marshalledCachedRoutes = CachedRoutesMarshaller.marshal(cachedRoutes);
            // Convert the marshalledCachedRoutes to JSON string
            const jsonCachedRoutes = JSON.stringify(marshalledCachedRoutes);
            // Encode the jsonCachedRoutes into Binary
            const binaryCachedRoutes = Buffer.from(jsonCachedRoutes);
            // Primary Key object
            const partitionKey = PairTradeTypeChainId.fromCachedRoutes(cachedRoutes);
            const sortKey = new ProtocolsBucketBlockNumber({
                protocols: cachedRoutes.protocolsCovered,
                bucket: cachingBucket.bucket,
                blockNumber: cachedRoutes.blockNumber,
            });
            const putParams = {
                TableName: this.tableName,
                Item: {
                    pairTradeTypeChainId: partitionKey.toString(),
                    protocolsBucketBlockNumber: sortKey.fullKey(),
                    item: binaryCachedRoutes,
                    ttl: ttl,
                },
            };
            log.info({ putParams, cachedRoutes, jsonCachedRoutes }, `[DynamoRouteCachingProvider] Attempting to insert route to cache`);
            try {
                await this.ddbClient.put(putParams).promise();
                log.info(`[DynamoRouteCachingProvider] Cached route inserted to cache`);
                return true;
            }
            catch (error) {
                log.error({ error, putParams }, `[DynamoRouteCachingProvider] Cached route failed to insert`);
                return false;
            }
        }
        else {
            // No CachingParameters found, return false to indicate the route was not cached.
            return false;
        }
    }
    /**
     * Implementation of the abstract method defined in `IRouteCachingProvider`
     * Obtains the CacheMode from the CachingStrategy, if not found, then return Darkmode.
     *
     * @param chainId
     * @param amount
     * @param quoteToken
     * @param tradeType
     * @param _protocols
     */
    async getCacheMode(chainId, amount, quoteToken, tradeType, _protocols) {
        const { tokenIn, tokenOut } = this.determineTokenInOut(amount, quoteToken, tradeType);
        const cachedRoutesStrategy = this.getCachedRoutesStrategy(tokenIn, tokenOut, tradeType, chainId);
        const cachingParameters = cachedRoutesStrategy === null || cachedRoutesStrategy === void 0 ? void 0 : cachedRoutesStrategy.getCachingBucket(amount);
        if (cachingParameters) {
            log.info({
                cachingParameters: cachingParameters,
                tokenIn: tokenIn.address,
                tokenOut: tokenOut.address,
                pair: `${tokenIn.symbol}/${tokenOut.symbol}`,
                chainId,
                tradeType,
                amount: amount.toExact(),
            }, `[DynamoRouteCachingProvider] Got CachingParameters for ${amount.toExact()} in ${tokenIn.symbol}/${tokenOut.symbol}/${tradeType}/${chainId}`);
            return cachingParameters.cacheMode;
        }
        else {
            log.info({
                tokenIn: tokenIn.address,
                tokenOut: tokenOut.address,
                pair: `${tokenIn.symbol}/${tokenOut.symbol}`,
                chainId,
                tradeType,
                amount: amount.toExact(),
            }, `[DynamoRouteCachingProvider] Didn't find CachingParameters for ${amount.toExact()} in ${tokenIn.symbol}/${tokenOut.symbol}/${tradeType}/${chainId}`);
            return CacheMode.Darkmode;
        }
    }
    /**
     * Helper function to fetch the CachingStrategy using CachedRoutes as input
     *
     * @param cachedRoutes
     * @private
     */
    getCachedRoutesStrategyFromCachedRoutes(cachedRoutes) {
        return this.getCachedRoutesStrategy(cachedRoutes.tokenIn, cachedRoutes.tokenOut, cachedRoutes.tradeType, cachedRoutes.chainId);
    }
    /**
     * Helper function to obtain the Caching strategy from the CACHED_ROUTES_CONFIGURATION
     *
     * @param tokenIn
     * @param tokenOut
     * @param tradeType
     * @param chainId
     * @private
     */
    getCachedRoutesStrategy(tokenIn, tokenOut, tradeType, chainId) {
        var _a;
        const pairTradeTypeChainId = new PairTradeTypeChainId({
            tokenIn: tokenIn.address,
            tokenOut: tokenOut.address,
            tradeType: tradeType,
            chainId: chainId,
        });
        let withWildcard;
        if (tradeType === TradeType.EXACT_INPUT) {
            withWildcard = new PairTradeTypeChainId({
                tokenIn: tokenIn.address,
                tokenOut: '*',
                tradeType: TradeType.EXACT_INPUT,
                chainId: chainId,
            });
        }
        else {
            withWildcard = new PairTradeTypeChainId({
                tokenIn: '*',
                tokenOut: tokenOut.address,
                tradeType: TradeType.EXACT_OUTPUT,
                chainId: chainId,
            });
        }
        log.info({ pairTradeTypeChainId }, `[DynamoRouteCachingProvider] Looking for cache configuration of ${pairTradeTypeChainId.toString()}
      or ${withWildcard.toString()}`);
        return ((_a = CACHED_ROUTES_CONFIGURATION.get(pairTradeTypeChainId.toString())) !== null && _a !== void 0 ? _a : CACHED_ROUTES_CONFIGURATION.get(withWildcard.toString()));
    }
    /**
     * Helper function to determine the tokenIn and tokenOut given the tradeType, quoteToken and amount.currency
     *
     * @param amount
     * @param quoteToken
     * @param tradeType
     * @private
     */
    determineTokenInOut(amount, quoteToken, tradeType) {
        if (tradeType == TradeType.EXACT_INPUT) {
            return { tokenIn: amount.currency.wrapped, tokenOut: quoteToken };
        }
        else {
            return { tokenIn: quoteToken, tokenOut: amount.currency.wrapped };
        }
    }
    /**
     * Helper function that based on the CachingBucket can determine if the route is allowed in cache.
     * There are 2 conditions, currently:
     * 1. `cachingBucket.maxSplits <= 0` indicate that any number of maxSplits is allowed
     * 2. `cachedRoutes.routes.length <= maxSplits` to test that there are fewer splits than allowed
     *
     * @param cachingBucket
     * @param cachedRoutes
     * @private
     */
    isAllowedInCache(cachingBucket, cachedRoutes) {
        return cachingBucket.maxSplits <= 0 || cachedRoutes.routes.length <= cachingBucket.maxSplits;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZHluYW1vLXJvdXRlLWNhY2hpbmctcHJvdmlkZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi9saWIvaGFuZGxlcnMvcm91dGVyLWVudGl0aWVzL3JvdXRlLWNhY2hpbmcvZHluYW1vLXJvdXRlLWNhY2hpbmctcHJvdmlkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUVMLFlBQVksRUFDWixTQUFTLEVBQ1QscUJBQXFCLEVBQ3JCLEdBQUcsRUFDSCxhQUFhLEdBQ2QsTUFBTSw2QkFBNkIsQ0FBQTtBQUNwQyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sU0FBUyxDQUFBO0FBQ2xDLE9BQU8sRUFBNEMsU0FBUyxFQUFFLE1BQU0sbUJBQW1CLENBQUE7QUFFdkYsT0FBTyxFQUFFLDJCQUEyQixFQUFFLE1BQU0sK0JBQStCLENBQUE7QUFDM0UsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sa0NBQWtDLENBQUE7QUFDdkUsT0FBTyxFQUFFLHNCQUFzQixFQUFFLE1BQU0sNENBQTRDLENBQUE7QUFFbkYsT0FBTyxFQUFFLDBCQUEwQixFQUFFLE1BQU0sdUNBQXVDLENBQUE7QUFnQmxGLE1BQU0sT0FBTywwQkFBMkIsU0FBUSxxQkFBcUI7SUFLbkUsWUFBWSxFQUFFLHFCQUFxQixFQUFFLFVBQVUsR0FBRyxDQUFDLEVBQXFCO1FBQ3RFLEtBQUssRUFBRSxDQUFBO1FBQ1AsbUZBQW1GO1FBQ25GLElBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxRQUFRLENBQUMsY0FBYyxDQUFDO1lBQzNDLFVBQVUsRUFBRSxDQUFDO1lBQ2IsaUJBQWlCLEVBQUU7Z0JBQ2pCLElBQUksRUFBRSxFQUFFO2FBQ1Q7WUFDRCxXQUFXLEVBQUU7Z0JBQ1gsT0FBTyxFQUFFLEdBQUc7YUFDYjtTQUNGLENBQUMsQ0FBQTtRQUNGLElBQUksQ0FBQyxTQUFTLEdBQUcscUJBQXFCLENBQUE7UUFDdEMsSUFBSSxDQUFDLFVBQVUsR0FB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Q2hDLFVBQWlCLEVBQ2pCLFNBQW9CO1FBRXBCLElBQUksU0FBUyxJQUFJLFNBQVMsQ0FBQyxXQUFXLEVBQUU7WUFDdEMsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLENBQUE7U0FDbEU7YUFBTTtZQUNMLE9BQU8sRUFBRSxPQUFPLEVBQUUsVUFBVSxFQUFFLFFBQVEsRUFBRSxNQUFNLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRSxDQUFBO1NBQ2xFO0lBQ0gsQ0FBQztJQUVEOzs7Ozs7Ozs7T0FTRztJQUNLLGdCQUFnQixDQUFDLGFBQWlDLEVBQUUsWUFBMEI7UUFDcEYsT0FBTyxhQUFhLENBQUMsU0FBUyxJQUFJLENBQUMsSUFBSSxZQUFZLENBQUMsTUFBTSxDQUFDLE1BQU0sSUFBSSxhQUFhLENBQUMsU0FBUyxDQUFBO0lBQzlGLENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XG4gIENhY2hlZFJvdXRlLFxuICBDYWNoZWRSb3V0ZXMsXG4gIENhY2hlTW9kZSxcbiAgSVJvdXRlQ2FjaGluZ1Byb3ZpZGVyLFxuICBsb2csXG4gIHJvdXRlVG9TdHJpbmcsXG59IGZyb20gJ0B1bmlzd2FwL3NtYXJ0LW9yZGVyLXJvdXRlcidcbmltcG9ydCB7IER5bmFtb0RCIH0gZnJvbSAnYXdzLXNkaydcbmltcG9ydCB7IENoYWluSWQsIEN1cnJlbmN5LCBDdXJyZW5jeUFtb3VudCwgVG9rZW4sIFRyYWRlVHlwZSB9IGZyb20gJ0B1bmlzd2FwL3Nkay1jb3JlJ1xuaW1wb3J0IHsgUHJvdG9jb2wgfSBmcm9tICdAdW5pc3dhcC9yb3V0ZXItc2RrJ1xuaW1wb3J0IHsgQ0FDSEVEX1JPVVRFU19DT05GSUdVUkFUSU9OIH0gZnJvbSAnLi9jYWNoZWQtcm91dGVzLWNvbmZpZ3VyYXRpb24nXG5pbXBvcnQgeyBQYWlyVHJhZGVUeXBlQ2hhaW5JZCB9IGZyb20gJy4vbW9kZWwvcGFpci10cmFkZS10eXBlLWNoYWluLWlkJ1xuaW1wb3J0IHsgQ2FjaGVkUm91dGVzTWFyc2hhbGxlciB9IGZyb20gJy4uLy4uL21hcnNoYWxsaW5nL2NhY2hlZC1yb3V0ZXMtbWFyc2hhbGxlcidcbmltcG9ydCB7IENhY2hlZFJvdXRlc1N0cmF0ZWd5IH0gZnJvbSAnLi9tb2RlbC9jYWNoZWQtcm91dGVzLXN0cmF0ZWd5J1xuaW1wb3J0IHsgUHJvdG9jb2xzQnVja2V0QmxvY2tOdW1iZXIgfSBmcm9tICcuL21vZGVsL3Byb3RvY29scy1idWNrZXQtYmxvY2stbnVtYmVyJ1xuaW1wb3J0IHsgQ2FjaGVkUm91dGVzQnVja2V0IH0gZnJvbSAnLi9tb2RlbCdcbmltcG9ydCB7IE1peGVkUm91dGUsIFYyUm91dGUsIFYzUm91dGUgfSBmcm9tICdAdW5pc3dhcC9zbWFydC1vcmRlci1yb3V0ZXIvYnVpbGQvbWFpbi9yb3V0ZXJzJ1xuXG5pbnRlcmZhY2UgQ29uc3RydWN0b3JQYXJhbXMge1xuICAvKipcbiAgICogVGhlIFRhYmxlTmFtZSBmb3IgdGhlIER5bmFtb0RCIFRhYmxlLiBUaGlzIGlzIHdpcmVkIGluIGZyb20gdGhlIENESyBkZWZpbml0aW9uLlxuICAgKi9cbiAgY2FjaGVkUm91dGVzVGFibGVOYW1lOiBzdHJpbmdcbiAgLyoqXG4gICAqIFRoZSBhbW91bnQgb2YgbWludXRlcyB0aGF0IGEgQ2FjaGVkUm91dGUgc2hvdWxkIGxpdmUgaW4gdGhlIGRhdGFiYXNlLlxuICAgKiBUaGlzIGlzIHVzZWQgdG8gbGltaXQgdGhlIGRhdGFiYXNlIGdyb3d0aCwgRHluYW1vIHdpbGwgYXV0b21hdGljYWxseSBkZWxldGUgZXhwaXJlZCBlbnRyaWVzLlxuICAgKi9cbiAgdHRsTWludXRlcz86IG51bWJlclxufVxuXG5leHBvcnQgY2xhc3MgRHluYW1vUm91dGVDYWNoaW5nUHJvdmlkZXIgZXh0ZW5kcyBJUm91dGVDYWNoaW5nUHJvdmlkZXIge1xuICBwcml2YXRlIHJlYWRvbmx5IGRkYkNsaWVudDogRHluYW1vREIuRG9jdW1lbnRDbGllbnRcbiAgcHJpdmF0ZSByZWFkb25seSB0YWJsZU5hbWU6IHN0cmluZ1xuICBwcml2YXRlIHJlYWRvbmx5IHR0bE1pbnV0ZXM6IG51bWJlclxuXG4gIGNvbnN0cnVjdG9yKHsgY2FjaGVkUm91dGVzVGFibGVOYW1lLCB0dGxNaW51dGVzID0gMiB9OiBDb25zdHJ1Y3RvclBhcmFtcykge1xuICAgIHN1cGVyKClcbiAgICAvLyBTaW5jZSB0aGlzIEREQiBUYWJsZSBpcyB1c2VkIGZvciBDYWNoZSwgd2Ugd2lsbCBmYWlsIGZhc3QgYW5kIGxpbWl0IHRoZSB0aW1lb3V0LlxuICAgIHRoaXMuZGRiQ2xpZW50ID0gbmV3IER5bmFtb0RCLkRvY3VtZW50Q2xpZW50KHtcbiAgICAgIG1heFJldHJpZXM6IDEsXG4gICAgICByZXRyeURlbGF5T3B0aW9uczoge1xuICAgICAgICBiYXNlOiAyMCxcbiAgICAgIH0sXG4gICAgICBodHRwT3B0aW9uczoge1xuICAgICAgICB0aW1lb3V0OiAxMDAsXG4gICAgICB9LFxuICAgIH0pXG4gICAgdGhpcy50YWJsZU5hbWUgPSBjYWNoZWRSb3V0ZXNUYWJsZU5hbWVcbiAgICB0aGlzLnR0bE1pbnV0ZXMgPSB0dGxNaW51dGVzXG4gIH1cblxuICAvKipcbiAgICogSW1wbGVtZW50YXRpb24gb2YgdGhlIGFic3RyYWN0IG1ldGhvZCBkZWZpbmVkIGluIGBJUm91dGVDYWNoaW5nUHJvdmlkZXJgXG4gICAqIEdpdmVuIGEgQ2FjaGVkUm91dGVzU3RyYXRlZ3kgKGZyb20gQ0FDSEVEX1JPVVRFU19DT05GSUdVUkFUSU9OKSxcbiAgICogd2Ugd2lsbCBmaW5kIHRoZSBCbG9ja3NUb0xpdmUgYXNzb2NpYXRlZCB0byB0aGUgYnVja2V0LlxuICAgKlxuICAgKiBAcGFyYW0gY2FjaGVkUm91dGVzXG4gICAqIEBwYXJhbSBhbW91bnRcbiAgICogQHByb3RlY3RlZFxuICAgKi9cbiAgcHJvdGVjdGVkIGFzeW5jIF9nZXRCbG9ja3NUb0xpdmUoY2FjaGVkUm91dGVzOiBDYWNoZWRSb3V0ZXMsIGFtb3VudDogQ3VycmVuY3lBbW91bnQ8Q3VycmVuY3k+KTogUHJvbWlzZTxudW1iZXI+IHtcbiAgICBjb25zdCBjYWNoZWRSb3V0ZXNTdHJhdGVneSA9IHRoaXMuZ2V0Q2FjaGVkUm91dGVzU3RyYXRlZ3lGcm9tQ2FjaGVkUm91dGVzKGNhY2hlZFJvdXRlcylcbiAgICBjb25zdCBjYWNoaW5nUGFyYW1ldGVycyA9IGNhY2hlZFJvdXRlc1N0cmF0ZWd5Py5nZXRDYWNoaW5nQnVja2V0KGFtb3VudClcblxuICAgIGlmIChjYWNoaW5nUGFyYW1ldGVycykge1xuICAgICAgcmV0dXJuIGNhY2hpbmdQYXJhbWV0ZXJzLmJsb2Nrc1RvTGl2ZVxuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gMFxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBJbXBsZW1lbnRhdGlvbiBvZiB0aGUgYWJzdHJhY3QgbWV0aG9kIGRlZmluZWQgaW4gYElSb3V0ZUNhY2hpbmdQcm92aWRlcmBcbiAgICogRmV0Y2ggdGhlIG1vc3QgcmVjZW50IGVudHJ5IGZyb20gdGhlIER5bmFtb0RCIHRhYmxlIGZvciB0aGF0IHBhaXIsIHRyYWRlVHlwZSwgY2hhaW5JZCwgcHJvdG9jb2xzIGFuZCBidWNrZXRcbiAgICpcbiAgICogQHBhcmFtIGNoYWluSWRcbiAgICogQHBhcmFtIGFtb3VudFxuICAgKiBAcGFyYW0gcXVvdGVUb2tlblxuICAgKiBAcGFyYW0gdHJhZGVUeXBlXG4gICAqIEBwYXJhbSBwcm90b2NvbHNcbiAgICogQHByb3RlY3RlZFxuICAgKi9cbiAgcHJvdGVjdGVkIGFzeW5jIF9nZXRDYWNoZWRSb3V0ZShcbiAgICBjaGFpbklkOiBDaGFpbklkLFxuICAgIGFtb3VudDogQ3VycmVuY3lBbW91bnQ8Q3VycmVuY3k+LFxuICAgIHF1b3RlVG9rZW46IFRva2VuLFxuICAgIHRyYWRlVHlwZTogVHJhZGVUeXBlLFxuICAgIHByb3RvY29sczogUHJvdG9jb2xbXVxuICApOiBQcm9taXNlPENhY2hlZFJvdXRlcyB8IHVuZGVmaW5lZD4ge1xuICAgIGNvbnN0IHsgdG9rZW5JbiwgdG9rZW5PdXQgfSA9IHRoaXMuZGV0ZXJtaW5lVG9rZW5Jbk91dChhbW91bnQsIHF1b3RlVG9rZW4sIHRyYWRlVHlwZSlcbiAgICBjb25zdCBjYWNoZWRSb3V0ZXNTdHJhdGVneSA9IHRoaXMuZ2V0Q2FjaGVkUm91dGVzU3RyYXRlZ3kodG9rZW5JbiwgdG9rZW5PdXQsIHRyYWRlVHlwZSwgY2hhaW5JZClcbiAgICBjb25zdCBjYWNoaW5nQnVja2V0ID0gY2FjaGVkUm91dGVzU3RyYXRlZ3k/LmdldENhY2hpbmdCdWNrZXQoYW1vdW50KVxuXG4gICAgaWYgKGNhY2hpbmdCdWNrZXQpIHtcbiAgICAgIGNvbnN0IHBhcnRpdGlvbktleSA9IG5ldyBQYWlyVHJhZGVUeXBlQ2hhaW5JZCh7XG4gICAgICAgIHRva2VuSW46IHRva2VuSW4uYWRkcmVzcyxcbiAgICAgICAgdG9rZW5PdXQ6IHRva2VuT3V0LmFkZHJlc3MsXG4gICAgICAgIHRyYWRlVHlwZSxcbiAgICAgICAgY2hhaW5JZCxcbiAgICAgIH0pXG4gICAgICBjb25zdCBwYXJ0aWFsU29ydEtleSA9IG5ldyBQcm90b2NvbHNCdWNrZXRCbG9ja051bWJlcih7XG4gICAgICAgIHByb3RvY29scyxcbiAgICAgICAgYnVja2V0OiBjYWNoaW5nQnVja2V0LmJ1Y2tldCxcbiAgICAgIH0pXG5cbiAgICAgIGNvbnN0IHF1ZXJ5UGFyYW1zID0ge1xuICAgICAgICBUYWJsZU5hbWU6IHRoaXMudGFibGVOYW1lLFxuICAgICAgICAvLyBTaW5jZSB3ZSBkb24ndCBrbm93IHdoYXQncyB0aGUgbGF0ZXN0IGJsb2NrIHRoYXQgd2UgaGF2ZSBpbiBjYWNoZSwgd2UgbWFrZSBhIHF1ZXJ5IHdpdGggYSBwYXJ0aWFsIHNvcnQga2V5XG4gICAgICAgIEtleUNvbmRpdGlvbkV4cHJlc3Npb246ICcjcGsgPSA6cGsgYW5kIGJlZ2luc193aXRoKCNzaywgOnNrKScsXG4gICAgICAgIEV4cHJlc3Npb25BdHRyaWJ1dGVOYW1lczoge1xuICAgICAgICAgICcjcGsnOiAncGFpclRyYWRlVHlwZUNoYWluSWQnLFxuICAgICAgICAgICcjc2snOiAncHJvdG9jb2xzQnVja2V0QmxvY2tOdW1iZXInLFxuICAgICAgICB9LFxuICAgICAgICBFeHByZXNzaW9uQXR0cmlidXRlVmFsdWVzOiB7XG4gICAgICAgICAgJzpwayc6IHBhcnRpdGlvbktleS50b1N0cmluZygpLFxuICAgICAgICAgICc6c2snOiBwYXJ0aWFsU29ydEtleS5wcm90b2NvbHNCdWNrZXRQYXJ0aWFsS2V5KCksXG4gICAgICAgIH0sXG4gICAgICAgIFNjYW5JbmRleEZvcndhcmQ6IGZhbHNlLCAvLyBSZXZlcnNlIG9yZGVyIHRvIHJldHJpZXZlIG1vc3QgcmVjZW50IGl0ZW0gZmlyc3RcbiAgICAgICAgTGltaXQ6IE1hdGgubWF4KGNhY2hpbmdCdWNrZXQud2l0aExhc3ROQ2FjaGVkUm91dGVzLCAxKSxcbiAgICAgIH1cblxuICAgICAgdHJ5IHtcbiAgICAgICAgbG9nLmluZm8oeyBxdWVyeVBhcmFtcyB9LCBgW0R5bmFtb1JvdXRlQ2FjaGluZ1Byb3ZpZGVyXSBBdHRlbXB0aW5nIHRvIGdldCByb3V0ZSBmcm9tIGNhY2hlLmApXG5cbiAgICAgICAgY29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5kZGJDbGllbnQucXVlcnkocXVlcnlQYXJhbXMpLnByb21pc2UoKVxuXG4gICAgICAgIGxvZy5pbmZvKHsgcmVzdWx0IH0sIGBbRHluYW1vUm91dGVDYWNoaW5nUHJvdmlkZXJdIEdvdCB0aGUgZm9sbG93aW5nIHJlc3BvbnNlIGZyb20gcXVlcnlpbmcgY2FjaGVgKVxuXG4gICAgICAgIGlmIChyZXN1bHQuSXRlbXMgJiYgcmVzdWx0Lkl0ZW1zLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICBjb25zdCBjYWNoZWRSb3V0ZXNBcnI6IENhY2hlZFJvdXRlc1tdID0gcmVzdWx0Lkl0ZW1zLm1hcCgocmVjb3JkKSA9PiB7XG4gICAgICAgICAgICAvLyBJZiB3ZSBnb3QgYSByZXNwb25zZSB3aXRoIG1vcmUgdGhhbiAxIGl0ZW0sIHdlIGV4dHJhY3QgdGhlIGJpbmFyeSBmaWVsZCBmcm9tIHRoZSByZXNwb25zZVxuICAgICAgICAgICAgY29uc3QgaXRlbUJpbmFyeSA9IHJlY29yZC5pdGVtXG4gICAgICAgICAgICAvLyBUaGVuIHdlIGNvbnZlcnQgaXQgaW50byBhIEJ1ZmZlclxuICAgICAgICAgICAgY29uc3QgY2FjaGVkUm91dGVzQnVmZmVyID0gQnVmZmVyLmZyb20oaXRlbUJpbmFyeSlcbiAgICAgICAgICAgIC8vIFdlIGNvbnZlcnQgdGhhdCBidWZmZXIgaW50byBzdHJpbmcgYW5kIHBhcnNlIGFzIEpTT04gKGl0IHdhcyBlbmNvZGVkIGFzIEpTT04gd2hlbiBpdCB3YXMgaW5zZXJ0ZWQgaW50byBjYWNoZSlcbiAgICAgICAgICAgIGNvbnN0IGNhY2hlZFJvdXRlc0pzb24gPSBKU09OLnBhcnNlKGNhY2hlZFJvdXRlc0J1ZmZlci50b1N0cmluZygpKVxuICAgICAgICAgICAgLy8gRmluYWxseSB3ZSB1bm1hcnNoYWwgdGhhdCBKU09OIGludG8gYSBgQ2FjaGVkUm91dGVzYCBvYmplY3RcbiAgICAgICAgICAgIHJldHVybiBDYWNoZWRSb3V0ZXNNYXJzaGFsbGVyLnVubWFyc2hhbChjYWNoZWRSb3V0ZXNKc29uKVxuICAgICAgICAgIH0pXG5cbiAgICAgICAgICBjb25zdCByb3V0ZXNNYXA6IE1hcDxzdHJpbmcsIENhY2hlZFJvdXRlPFYzUm91dGUgfCBWMlJvdXRlIHwgTWl4ZWRSb3V0ZT4+ID0gbmV3IE1hcCgpXG4gICAgICAgICAgdmFyIGJsb2NrTnVtYmVyOiBudW1iZXIgPSAwXG4gICAgICAgICAgdmFyIG9yaWdpbmFsQW1vdW50OiBzdHJpbmcgPSAnJ1xuXG4gICAgICAgICAgY2FjaGVkUm91dGVzQXJyLmZvckVhY2goKGNhY2hlZFJvdXRlcykgPT4ge1xuICAgICAgICAgICAgY2FjaGVkUm91dGVzLnJvdXRlcy5mb3JFYWNoKChjYWNoZWRSb3V0ZSkgPT4ge1xuICAgICAgICAgICAgICAvLyB3ZSB1c2UgdGhlIHN0cmluZ2lmaWVkIHJvdXRlIGFzIGlkZW50aWZpZXJcbiAgICAgICAgICAgICAgY29uc3Qgcm91dGVJZCA9IHJvdXRlVG9TdHJpbmcoY2FjaGVkUm91dGUucm91dGUpXG4gICAgICAgICAgICAgIC8vIFVzaW5nIGEgbWFwIHRvIHJlbW92ZSBkdXBsaWNhdGVzLCB3ZSB3aWxsIHRoZSBkaWZmZXJlbnQgcGVyY2VudHMgb2YgZGlmZmVyZW50IHJvdXRlcy5cbiAgICAgICAgICAgICAgaWYgKCFyb3V0ZXNNYXAuaGFzKHJvdXRlSWQpKSByb3V0ZXNNYXAuc2V0KHJvdXRlSWQsIGNhY2hlZFJvdXRlKVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIC8vIEZpbmQgdGhlIGxhdGVzdCBibG9ja051bWJlclxuICAgICAgICAgICAgYmxvY2tOdW1iZXIgPSBNYXRoLm1heChibG9ja051bWJlciwgY2FjaGVkUm91dGVzLmJsb2NrTnVtYmVyKVxuICAgICAgICAgICAgLy8gS2VlcCB0cmFjayBvZiBhbGwgdGhlIG9yaWdpbmFsQW1vdW50c1xuICAgICAgICAgICAgaWYgKG9yaWdpbmFsQW1vdW50ID09PSAnJykge1xuICAgICAgICAgICAgICBvcmlnaW5hbEFtb3VudCA9IGAke2NhY2hlZFJvdXRlcy5vcmlnaW5hbEFtb3VudH0gfCAke3JvdXRlc01hcC5zaXplfSB8ICR7Y2FjaGVkUm91dGVzLmJsb2NrTnVtYmVyfWBcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgIG9yaWdpbmFsQW1vdW50ID0gYCR7b3JpZ2luYWxBbW91bnR9LCAke2NhY2hlZFJvdXRlcy5vcmlnaW5hbEFtb3VudH0gfCAke3JvdXRlc01hcC5zaXplfSB8ICR7Y2FjaGVkUm91dGVzLmJsb2NrTnVtYmVyfWBcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9KVxuXG4gICAgICAgICAgY29uc3QgZmlyc3QgPSBjYWNoZWRSb3V0ZXNBcnJbMF1cblxuICAgICAgICAgIC8vIEJ1aWxkIGEgbmV3IENhY2hlZFJvdXRlcyBvYmplY3Qgd2l0aCB0aGUgdmFsdWVzIGNhbGN1bGF0ZWQgZWFybGllclxuICAgICAgICAgIGNvbnN0IGNhY2hlZFJvdXRlcyA9IG5ldyBDYWNoZWRSb3V0ZXMoe1xuICAgICAgICAgICAgcm91dGVzOiBBcnJheS5mcm9tKHJvdXRlc01hcC52YWx1ZXMoKSksXG4gICAgICAgICAgICBjaGFpbklkOiBmaXJzdC5jaGFpbklkLFxuICAgICAgICAgICAgdG9rZW5JbjogZmlyc3QudG9rZW5JbixcbiAgICAgICAgICAgIHRva2VuT3V0OiBmaXJzdC50b2tlbk91dCxcbiAgICAgICAgICAgIHByb3RvY29sc0NvdmVyZWQ6IGZpcnN0LnByb3RvY29sc0NvdmVyZWQsXG4gICAgICAgICAgICBibG9ja051bWJlcixcbiAgICAgICAgICAgIHRyYWRlVHlwZTogZmlyc3QudHJhZGVUeXBlLFxuICAgICAgICAgICAgb3JpZ2luYWxBbW91bnQsXG4gICAgICAgICAgICBibG9ja3NUb0xpdmU6IGZpcnN0LmJsb2Nrc1RvTGl2ZSxcbiAgICAgICAgICB9KVxuXG4gICAgICAgICAgbG9nLmluZm8oeyBjYWNoZWRSb3V0ZXMgfSwgYFtEeW5hbW9Sb3V0ZUNhY2hpbmdQcm92aWRlcl0gUmV0dXJuaW5nIHRoZSBjYWNoZWQgYW5kIHVubWFyc2hhbGxlZCByb3V0ZS5gKVxuXG4gICAgICAgICAgcmV0dXJuIGNhY2hlZFJvdXRlc1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGxvZy5pbmZvKGBbRHluYW1vUm91dGVDYWNoaW5nUHJvdmlkZXJdIE5vIGl0ZW1zIGZvdW5kIGluIHRoZSBxdWVyeSByZXNwb25zZS5gKVxuICAgICAgICB9XG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBsb2cuZXJyb3IoeyBxdWVyeVBhcmFtcywgZXJyb3IgfSwgYFtEeW5hbW9Sb3V0ZUNhY2hpbmdQcm92aWRlcl0gRXJyb3Igd2hpbGUgZmV0Y2hpbmcgcm91dGUgZnJvbSBjYWNoZWApXG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gV2Ugb25seSBnZXQgaGVyZSBpZiB3ZSBkaWRuJ3QgZmluZCBhIGNhY2hlZFJvdXRlc1xuICAgIHJldHVybiB1bmRlZmluZWRcbiAgfVxuXG4gIC8qKlxuICAgKiBJbXBsZW1lbnRhdGlvbiBvZiB0aGUgYWJzdHJhY3QgbWV0aG9kIGRlZmluZWQgaW4gYElSb3V0ZUNhY2hpbmdQcm92aWRlcmBcbiAgICogQXR0ZW1wdHMgdG8gaW5zZXJ0IHRoZSBgQ2FjaGVkUm91dGVzYCBvYmplY3QgaW50byBjYWNoZSwgaWYgdGhlIENhY2hpbmdTdHJhdGVneSByZXR1cm5zIHRoZSBDYWNoaW5nUGFyYW1ldGVyc1xuICAgKlxuICAgKiBAcGFyYW0gY2FjaGVkUm91dGVzXG4gICAqIEBwYXJhbSBhbW91bnRcbiAgICogQHByb3RlY3RlZFxuICAgKi9cbiAgcHJvdGVjdGVkIGFzeW5jIF9zZXRDYWNoZWRSb3V0ZShjYWNoZWRSb3V0ZXM6IENhY2hlZFJvdXRlcywgYW1vdW50OiBDdXJyZW5jeUFtb3VudDxDdXJyZW5jeT4pOiBQcm9taXNlPGJvb2xlYW4+IHtcbiAgICBjb25zdCBjYWNoZWRSb3V0ZXNTdHJhdGVneSA9IHRoaXMuZ2V0Q2FjaGVkUm91dGVzU3RyYXRlZ3lGcm9tQ2FjaGVkUm91dGVzKGNhY2hlZFJvdXRlcylcbiAgICBjb25zdCBjYWNoaW5nQnVja2V0ID0gY2FjaGVkUm91dGVzU3RyYXRlZ3k/LmdldENhY2hpbmdCdWNrZXQoYW1vdW50KVxuXG4gICAgaWYgKGNhY2hpbmdCdWNrZXQgJiYgdGhpcy5pc0FsbG93ZWRJbkNhY2hlKGNhY2hpbmdCdWNrZXQsIGNhY2hlZFJvdXRlcykpIHtcbiAgICAgIC8vIFRUTCBpcyBtaW51dGVzIGZyb20gbm93LiBtdWx0aXBseSB0dGxNaW51dGVzIHRpbWVzIDYwIHRvIGNvbnZlcnQgdG8gc2Vjb25kcywgc2luY2UgdHRsIGlzIGluIHNlY29uZHMuXG4gICAgICBjb25zdCB0dGwgPSBNYXRoLmZsb29yKERhdGUubm93KCkgLyAxMDAwKSArIDYwICogdGhpcy50dGxNaW51dGVzXG4gICAgICAvLyBNYXJzaGFsIHRoZSBDYWNoZWRSb3V0ZXMgb2JqZWN0IGluIHByZXBhcmF0aW9uIGZvciBzdG9yaW5nIGluIER5bmFtb0RCXG4gICAgICBjb25zdCBtYXJzaGFsbGVkQ2FjaGVkUm91dGVzID0gQ2FjaGVkUm91dGVzTWFyc2hhbGxlci5tYXJzaGFsKGNhY2hlZFJvdXRlcylcbiAgICAgIC8vIENvbnZlcnQgdGhlIG1hcnNoYWxsZWRDYWNoZWRSb3V0ZXMgdG8gSlNPTiBzdHJpbmdcbiAgICAgIGNvbnN0IGpzb25DYWNoZWRSb3V0ZXMgPSBKU09OLnN0cmluZ2lmeShtYXJzaGFsbGVkQ2FjaGVkUm91dGVzKVxuICAgICAgLy8gRW5jb2RlIHRoZSBqc29uQ2FjaGVkUm91dGVzIGludG8gQmluYXJ5XG4gICAgICBjb25zdCBiaW5hcnlDYWNoZWRSb3V0ZXMgPSBCdWZmZXIuZnJvbShqc29uQ2FjaGVkUm91dGVzKVxuXG4gICAgICAvLyBQcmltYXJ5IEtleSBvYmplY3RcbiAgICAgIGNvbnN0IHBhcnRpdGlvbktleSA9IFBhaXJUcmFkZVR5cGVDaGFpbklkLmZyb21DYWNoZWRSb3V0ZXMoY2FjaGVkUm91dGVzKVxuICAgICAgY29uc3Qgc29ydEtleSA9IG5ldyBQcm90b2NvbHNCdWNrZXRCbG9ja051bWJlcih7XG4gICAgICAgIHByb3RvY29sczogY2FjaGVkUm91dGVzLnByb3RvY29sc0NvdmVyZWQsXG4gICAgICAgIGJ1Y2tldDogY2FjaGluZ0J1Y2tldC5idWNrZXQsXG4gICAgICAgIGJsb2NrTnVtYmVyOiBjYWNoZWRSb3V0ZXMuYmxvY2tOdW1iZXIsXG4gICAgICB9KVxuXG4gICAgICBjb25zdCBwdXRQYXJhbXMgPSB7XG4gICAgICAgIFRhYmxlTmFtZTogdGhpcy50YWJsZU5hbWUsXG4gICAgICAgIEl0ZW06IHtcbiAgICAgICAgICBwYWlyVHJhZGVUeXBlQ2hhaW5JZDogcGFydGl0aW9uS2V5LnRvU3RyaW5nKCksXG4gICAgICAgICAgcHJvdG9jb2xzQnVja2V0QmxvY2tOdW1iZXI6IHNvcnRLZXkuZnVsbEtleSgpLFxuICAgICAgICAgIGl0ZW06IGJpbmFyeUNhY2hlZFJvdXRlcyxcbiAgICAgICAgICB0dGw6IHR0bCxcbiAgICAgICAgfSxcbiAgICAgIH1cblxuICAgICAgbG9nLmluZm8oXG4gICAgICAgIHsgcHV0UGFyYW1zLCBjYWNoZWRSb3V0ZXMsIGpzb25DYWNoZWRSb3V0ZXMgfSxcbiAgICAgICAgYFtEeW5hbW9Sb3V0ZUNhY2hpbmdQcm92aWRlcl0gQXR0ZW1wdGluZyB0byBpbnNlcnQgcm91dGUgdG8gY2FjaGVgXG4gICAgICApXG5cbiAgICAgIHRyeSB7XG4gICAgICAgIGF3YWl0IHRoaXMuZGRiQ2xpZW50LnB1dChwdXRQYXJhbXMpLnByb21pc2UoKVxuICAgICAgICBsb2cuaW5mbyhgW0R5bmFtb1JvdXRlQ2FjaGluZ1Byb3ZpZGVyXSBDYWNoZWQgcm91dGUgaW5zZXJ0ZWQgdG8gY2FjaGVgKVxuXG4gICAgICAgIHJldHVybiB0cnVlXG4gICAgICB9IGNhdGNoIChlcnJvcikge1xuICAgICAgICBsb2cuZXJyb3IoeyBlcnJvciwgcHV0UGFyYW1zIH0sIGBbRHluYW1vUm91dGVDYWNoaW5nUHJvdmlkZXJdIENhY2hlZCByb3V0ZSBmYWlsZWQgdG8gaW5zZXJ0YClcblxuICAgICAgICByZXR1cm4gZmFsc2VcbiAgICAgIH1cbiAgICB9IGVsc2Uge1xuICAgICAgLy8gTm8gQ2FjaGluZ1BhcmFtZXRlcnMgZm91bmQsIHJldHVybiBmYWxzZSB0byBpbmRpY2F0ZSB0aGUgcm91dGUgd2FzIG5vdCBjYWNoZWQuXG5cbiAgICAgIHJldHVybiBmYWxzZVxuICAgIH1cbiAgfVxuXG4gIC8qKlxuICAgKiBJbXBsZW1lbnRhdGlvbiBvZiB0aGUgYWJzdHJhY3QgbWV0aG9kIGRlZmluZWQgaW4gYElSb3V0ZUNhY2hpbmdQcm92aWRlcmBcbiAgICogT2J0YWlucyB0aGUgQ2FjaGVNb2RlIGZyb20gdGhlIENhY2hpbmdTdHJhdGVneSwgaWYgbm90IGZvdW5kLCB0aGVuIHJldHVybiBEYXJrbW9kZS5cbiAgICpcbiAgICogQHBhcmFtIGNoYWluSWRcbiAgICogQHBhcmFtIGFtb3VudFxuICAgKiBAcGFyYW0gcXVvdGVUb2tlblxuICAgKiBAcGFyYW0gdHJhZGVUeXBlXG4gICAqIEBwYXJhbSBfcHJvdG9jb2xzXG4gICAqL1xuICBwdWJsaWMgYXN5bmMgZ2V0Q2FjaGVNb2RlKFxuICAgIGNoYWluSWQ6IENoYWluSWQsXG4gICAgYW1vdW50OiBDdXJyZW5jeUFtb3VudDxDdXJyZW5jeT4sXG4gICAgcXVvdGVUb2tlbjogVG9rZW4sXG4gICAgdHJhZGVUeXBlOiBUcmFkZVR5cGUsXG4gICAgX3Byb3RvY29sczogUHJvdG9jb2xbXVxuICApOiBQcm9taXNlPENhY2hlTW9kZT4ge1xuICAgIGNvbnN0IHsgdG9rZW5JbiwgdG9rZW5PdXQgfSA9IHRoaXMuZGV0ZXJtaW5lVG9rZW5Jbk91dChhbW91bnQsIHF1b3RlVG9rZW4sIHRyYWRlVHlwZSlcbiAgICBjb25zdCBjYWNoZWRSb3V0ZXNTdHJhdGVneSA9IHRoaXMuZ2V0Q2FjaGVkUm91dGVzU3RyYXRlZ3kodG9rZW5JbiwgdG9rZW5PdXQsIHRyYWRlVHlwZSwgY2hhaW5JZClcbiAgICBjb25zdCBjYWNoaW5nUGFyYW1ldGVycyA9IGNhY2hlZFJvdXRlc1N0cmF0ZWd5Py5nZXRDYWNoaW5nQnVja2V0KGFtb3VudClcblxuICAgIGlmIChjYWNoaW5nUGFyYW1ldGVycykge1xuICAgICAgbG9nLmluZm8oXG4gICAgICAgIHtcbiAgICAgICAgICBjYWNoaW5nUGFyYW1ldGVyczogY2FjaGluZ1BhcmFtZXRlcnMsXG4gICAgICAgICAgdG9rZW5JbjogdG9rZW5Jbi5hZGRyZXNzLFxuICAgICAgICAgIHRva2VuT3V0OiB0b2tlbk91dC5hZGRyZXNzLFxuICAgICAgICAgIHBhaXI6IGAke3Rva2VuSW4uc3ltYm9sfS8ke3Rva2VuT3V0LnN5bWJvbH1gLFxuICAgICAgICAgIGNoYWluSWQsXG4gICAgICAgICAgdHJhZGVUeXBlLFxuICAgICAgICAgIGFtb3VudDogYW1vdW50LnRvRXhhY3QoKSxcbiAgICAgICAgfSxcbiAgICAgICAgYFtEeW5hbW9Sb3V0ZUNhY2hpbmdQcm92aWRlcl0gR290IENhY2hpbmdQYXJhbWV0ZXJzIGZvciAke2Ftb3VudC50b0V4YWN0KCl9IGluICR7dG9rZW5Jbi5zeW1ib2x9LyR7XG4gICAgICAgICAgdG9rZW5PdXQuc3ltYm9sXG4gICAgICAgIH0vJHt0cmFkZVR5cGV9LyR7Y2hhaW5JZH1gXG4gICAgICApXG5cbiAgICAgIHJldHVybiBjYWNoaW5nUGFyYW1ldGVycy5jYWNoZU1vZGVcbiAgICB9IGVsc2Uge1xuICAgICAgbG9nLmluZm8oXG4gICAgICAgIHtcbiAgICAgICAgICB0b2tlbkluOiB0b2tlbkluLmFkZHJlc3MsXG4gICAgICAgICAgdG9rZW5PdXQ6IHRva2VuT3V0LmFkZHJlc3MsXG4gICAgICAgICAgcGFpcjogYCR7dG9rZW5Jbi5zeW1ib2x9LyR7dG9rZW5PdXQuc3ltYm9sfWAsXG4gICAgICAgICAgY2hhaW5JZCxcbiAgICAgICAgICB0cmFkZVR5cGUsXG4gICAgICAgICAgYW1vdW50OiBhbW91bnQudG9FeGFjdCgpLFxuICAgICAgICB9LFxuICAgICAgICBgW0R5bmFtb1JvdXRlQ2FjaGluZ1Byb3ZpZGVyXSBEaWRuJ3QgZmluZCBDYWNoaW5nUGFyYW1ldGVycyBmb3IgJHthbW91bnQudG9FeGFjdCgpfSBpbiAke3Rva2VuSW4uc3ltYm9sfS8ke1xuICAgICAgICAgIHRva2VuT3V0LnN5bWJvbFxuICAgICAgICB9LyR7dHJhZGVUeXBlfS8ke2NoYWluSWR9YFxuICAgICAgKVxuXG4gICAgICByZXR1cm4gQ2FjaGVNb2RlLkRhcmttb2RlXG4gICAgfVxuICB9XG5cbiAgLyoqXG4gICAqIEhlbHBlciBmdW5jdGlvbiB0byBmZXRjaCB0aGUgQ2FjaGluZ1N0cmF0ZWd5IHVzaW5nIENhY2hlZFJvdXRlcyBhcyBpbnB1dFxuICAgKlxuICAgKiBAcGFyYW0gY2FjaGVkUm91dGVzXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBwcml2YXRlIGdldENhY2hlZFJvdXRlc1N0cmF0ZWd5RnJvbUNhY2hlZFJvdXRlcyhjYWNoZWRSb3V0ZXM6IENhY2hlZFJvdXRlcyk6IENhY2hlZFJvdXRlc1N0cmF0ZWd5IHwgdW5kZWZpbmVkIHtcbiAgICByZXR1cm4gdGhpcy5nZXRDYWNoZWRSb3V0ZXNTdHJhdGVneShcbiAgICAgIGNhY2hlZFJvdXRlcy50b2tlbkluLFxuICAgICAgY2FjaGVkUm91dGVzLnRva2VuT3V0LFxuICAgICAgY2FjaGVkUm91dGVzLnRyYWRlVHlwZSxcbiAgICAgIGNhY2hlZFJvdXRlcy5jaGFpbklkXG4gICAgKVxuICB9XG5cbiAgLyoqXG4gICAqIEhlbHBlciBmdW5jdGlvbiB0byBvYnRhaW4gdGhlIENhY2hpbmcgc3RyYXRlZ3kgZnJvbSB0aGUgQ0FDSEVEX1JPVVRFU19DT05GSUdVUkFUSU9OXG4gICAqXG4gICAqIEBwYXJhbSB0b2tlbkluXG4gICAqIEBwYXJhbSB0b2tlbk91dFxuICAgKiBAcGFyYW0gdHJhZGVUeXBlXG4gICAqIEBwYXJhbSBjaGFpbklkXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBwcml2YXRlIGdldENhY2hlZFJvdXRlc1N0cmF0ZWd5KFxuICAgIHRva2VuSW46IFRva2VuLFxuICAgIHRva2VuT3V0OiBUb2tlbixcbiAgICB0cmFkZVR5cGU6IFRyYWRlVHlwZSxcbiAgICBjaGFpbklkOiBDaGFpbklkXG4gICk6IENhY2hlZFJvdXRlc1N0cmF0ZWd5IHwgdW5kZWZpbmVkIHtcbiAgICBjb25zdCBwYWlyVHJhZGVUeXBlQ2hhaW5JZCA9IG5ldyBQYWlyVHJhZGVUeXBlQ2hhaW5JZCh7XG4gICAgICB0b2tlbkluOiB0b2tlbkluLmFkZHJlc3MsXG4gICAgICB0b2tlbk91dDogdG9rZW5PdXQuYWRkcmVzcyxcbiAgICAgIHRyYWRlVHlwZTogdHJhZGVUeXBlLFxuICAgICAgY2hhaW5JZDogY2hhaW5JZCxcbiAgICB9KVxuXG4gICAgbGV0IHdpdGhXaWxkY2FyZDogUGFpclRyYWRlVHlwZUNoYWluSWRcbiAgICBpZiAodHJhZGVUeXBlID09PSBUcmFkZVR5cGUuRVhBQ1RfSU5QVVQpIHtcbiAgICAgIHdpdGhXaWxkY2FyZCA9IG5ldyBQYWlyVHJhZGVUeXBlQ2hhaW5JZCh7XG4gICAgICAgIHRva2VuSW46IHRva2VuSW4uYWRkcmVzcyxcbiAgICAgICAgdG9rZW5PdXQ6ICcqJyxcbiAgICAgICAgdHJhZGVUeXBlOiBUcmFkZVR5cGUuRVhBQ1RfSU5QVVQsXG4gICAgICAgIGNoYWluSWQ6IGNoYWluSWQsXG4gICAgICB9KVxuICAgIH0gZWxzZSB7XG4gICAgICB3aXRoV2lsZGNhcmQgPSBuZXcgUGFpclRyYWRlVHlwZUNoYWluSWQoe1xuICAgICAgICB0b2tlbkluOiAnKicsXG4gICAgICAgIHRva2VuT3V0OiB0b2tlbk91dC5hZGRyZXNzLFxuICAgICAgICB0cmFkZVR5cGU6IFRyYWRlVHlwZS5FWEFDVF9PVVRQVVQsXG4gICAgICAgIGNoYWluSWQ6IGNoYWluSWQsXG4gICAgICB9KVxuICAgIH1cblxuICAgIGxvZy5pbmZvKFxuICAgICAgeyBwYWlyVHJhZGVUeXBlQ2hhaW5JZCB9LFxuICAgICAgYFtEeW5hbW9Sb3V0ZUNhY2hpbmdQcm92aWRlcl0gTG9va2luZyBmb3IgY2FjaGUgY29uZmlndXJhdGlvbiBvZiAke3BhaXJUcmFkZVR5cGVDaGFpbklkLnRvU3RyaW5nKCl9XG4gICAgICBvciAke3dpdGhXaWxkY2FyZC50b1N0cmluZygpfWBcbiAgICApXG5cbiAgICByZXR1cm4gKFxuICAgICAgQ0FDSEVEX1JPVVRFU19DT05GSUdVUkFUSU9OLmdldChwYWlyVHJhZGVUeXBlQ2hhaW5JZC50b1N0cmluZygpKSA/P1xuICAgICAgQ0FDSEVEX1JPVVRFU19DT05GSUdVUkFUSU9OLmdldCh3aXRoV2lsZGNhcmQudG9TdHJpbmcoKSlcbiAgICApXG4gIH1cblxuICAvKipcbiAgICogSGVscGVyIGZ1bmN0aW9uIHRvIGRldGVybWluZSB0aGUgdG9rZW5JbiBhbmQgdG9rZW5PdXQgZ2l2ZW4gdGhlIHRyYWRlVHlwZSwgcXVvdGVUb2tlbiBhbmQgYW1vdW50LmN1cnJlbmN5XG4gICAqXG4gICAqIEBwYXJhbSBhbW91bnRcbiAgICogQHBhcmFtIHF1b3RlVG9rZW5cbiAgICogQHBhcmFtIHRyYWRlVHlwZVxuICAgKiBAcHJpdmF0ZVxuICAgKi9cbiAgcHJpdmF0ZSBkZXRlcm1pbmVUb2tlbkluT3V0KFxuICAgIGFtb3VudDogQ3VycmVuY3lBbW91bnQ8Q3VycmVuY3k+LFxuICAgIHF1b3RlVG9rZW46IFRva2VuLFxuICAgIHRyYWRlVHlwZTogVHJhZGVUeXBlXG4gICk6IHsgdG9rZW5JbjogVG9rZW47IHRva2VuT3V0OiBUb2tlbiB9IHtcbiAgICBpZiAodHJhZGVUeXBlID09IFRyYWRlVHlwZS5FWEFDVF9JTlBVVCkge1xuICAgICAgcmV0dXJuIHsgdG9rZW5JbjogYW1vdW50LmN1cnJlbmN5LndyYXBwZWQsIHRva2VuT3V0OiBxdW90ZVRva2VuIH1cbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHsgdG9rZW5JbjogcXVvdGVUb2tlbiwgdG9rZW5PdXQ6IGFtb3VudC5jdXJyZW5jeS53cmFwcGVkIH1cbiAgICB9XG4gIH1cblxuICAvKipcbiAgICogSGVscGVyIGZ1bmN0aW9uIHRoYXQgYmFzZWQgb24gdGhlIENhY2hpbmdCdWNrZXQgY2FuIGRldGVybWluZSBpZiB0aGUgcm91dGUgaXMgYWxsb3dlZCBpbiBjYWNoZS5cbiAgICogVGhlcmUgYXJlIDIgY29uZGl0aW9ucywgY3VycmVudGx5OlxuICAgKiAxLiBgY2FjaGluZ0J1Y2tldC5tYXhTcGxpdHMgPD0gMGAgaW5kaWNhdGUgdGhhdCBhbnkgbnVtYmVyIG9mIG1heFNwbGl0cyBpcyBhbGxvd2VkXG4gICAqIDIuIGBjYWNoZWRSb3V0ZXMucm91dGVzLmxlbmd0aCA8PSBtYXhTcGxpdHNgIHRvIHRlc3QgdGhhdCB0aGVyZSBhcmUgZmV3ZXIgc3BsaXRzIHRoYW4gYWxsb3dlZFxuICAgKlxuICAgKiBAcGFyYW0gY2FjaGluZ0J1Y2tldFxuICAgKiBAcGFyYW0gY2FjaGVkUm91dGVzXG4gICAqIEBwcml2YXRlXG4gICAqL1xuICBwcml2YXRlIGlzQWxsb3dlZEluQ2FjaGUoY2FjaGluZ0J1Y2tldDogQ2FjaGVkUm91dGVzQnVja2V0LCBjYWNoZWRSb3V0ZXM6IENhY2hlZFJvdXRlcyk6IGJvb2xlYW4ge1xuICAgIHJldHVybiBjYWNoaW5nQnVja2V0Lm1heFNwbGl0cyA8PSAwIHx8IGNhY2hlZFJvdXRlcy5yb3V0ZXMubGVuZ3RoIDw9IGNhY2hpbmdCdWNrZXQubWF4U3BsaXRzXG4gIH1cbn1cbiJdfQ==