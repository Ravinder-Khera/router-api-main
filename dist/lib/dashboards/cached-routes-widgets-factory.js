import _ from 'lodash';
import { CACHED_ROUTES_CONFIGURATION } from '../handlers/router-entities/route-caching';
import { TradeType } from '@uniswap/sdk-core';
export class CachedRoutesWidgetsFactory {
    constructor(namespace, region, lambdaName) {
        this.region = region;
        this.namespace = namespace;
        this.lambdaName = lambdaName;
    }
    generateWidgets() {
        const cacheHitMissWidgets = this.generateCacheHitMissMetricsWidgets();
        const [wildcardStrategies, strategies] = _.partition(Array.from(CACHED_ROUTES_CONFIGURATION.values()), (strategy) => strategy.pair.includes('*'));
        let wildcardStrategiesWidgets = [];
        if (wildcardStrategies.length > 0) {
            wildcardStrategiesWidgets = _.flatMap(wildcardStrategies, (cacheStrategy) => this.generateWidgetsForStrategies(cacheStrategy));
            wildcardStrategiesWidgets.unshift({
                type: 'text',
                width: 24,
                height: 1,
                properties: {
                    markdown: `# Wildcard pairs`,
                },
            });
        }
        const strategiesWidgets = _.flatMap(strategies, (cacheStrategy) => this.generateWidgetsForStrategies(cacheStrategy));
        return cacheHitMissWidgets.concat(wildcardStrategiesWidgets).concat(strategiesWidgets);
    }
    generateCacheHitMissMetricsWidgets() {
        return [
            {
                type: 'text',
                width: 24,
                height: 1,
                properties: {
                    markdown: `# Overall Cache Hit/Miss`,
                },
            },
            {
                type: 'metric',
                width: 12,
                height: 7,
                properties: {
                    view: 'timeSeries',
                    stacked: false,
                    metrics: [
                        [{ expression: 'SUM(METRICS())', label: 'Requests', id: 'e1' }],
                        [this.namespace, 'GetCachedRoute_hit_livemode', 'Service', 'RoutingAPI', { label: 'Cache Hit', id: 'm1' }],
                        ['.', 'GetCachedRoute_miss_livemode', '.', '.', { label: 'Cache Miss', id: 'm2' }],
                    ],
                    region: this.region,
                    title: 'Cache Hit, Miss and Total requests of Cachemode.Livemode',
                    period: 300,
                    stat: 'Sum',
                    yAxis: {
                        left: {
                            min: 0,
                        },
                    },
                },
            },
            {
                type: 'metric',
                width: 12,
                height: 7,
                properties: {
                    view: 'timeSeries',
                    stacked: false,
                    metrics: [
                        [{ expression: 'SUM(METRICS())', label: 'AllRequests', id: 'e1', visible: false }],
                        [{ expression: 'm1/e1 * 100', label: 'Cache Hit Rate', id: 'e2' }],
                        [{ expression: 'm2/e1 * 100', label: 'Cache Miss Rate', id: 'e3' }],
                        [
                            this.namespace,
                            'GetCachedRoute_hit_livemode',
                            'Service',
                            'RoutingAPI',
                            { label: 'Cache Hit', id: 'm1', visible: false },
                        ],
                        ['.', 'GetCachedRoute_miss_livemode', '.', '.', { label: 'Cache Miss', id: 'm2', visible: false }],
                    ],
                    region: this.region,
                    title: 'Cache Hit and Miss Rates of Cachemode.Livemode',
                    period: 300,
                    stat: 'Sum',
                    yAxis: {
                        left: {
                            min: 0,
                            max: 100,
                        },
                    },
                },
            },
            {
                type: 'metric',
                width: 12,
                height: 7,
                properties: {
                    view: 'timeSeries',
                    stacked: false,
                    metrics: [
                        [{ expression: 'SUM(METRICS())', label: 'Requests', id: 'e1' }],
                        [
                            this.namespace,
                            'GetCachedRoute_hit_tapcompare',
                            'Service',
                            'RoutingAPI',
                            { label: 'Cache Hit', id: 'm1' },
                        ],
                        ['.', 'GetCachedRoute_miss_tapcompare', '.', '.', { label: 'Cache Miss', id: 'm2' }],
                    ],
                    region: this.region,
                    title: 'Cache Hit, Miss and Total requests of Cachemode.Tapcompare',
                    period: 300,
                    stat: 'Sum',
                    yAxis: {
                        left: {
                            min: 0,
                        },
                    },
                },
            },
            {
                type: 'metric',
                width: 12,
                height: 7,
                properties: {
                    view: 'timeSeries',
                    stacked: false,
                    metrics: [
                        [{ expression: 'SUM(METRICS())', label: 'AllRequests', id: 'e1', visible: false }],
                        [{ expression: 'm1/e1 * 100', label: 'Cache Hit Rate', id: 'e2' }],
                        [{ expression: 'm2/e1 * 100', label: 'Cache Miss Rate', id: 'e3' }],
                        [
                            this.namespace,
                            'GetCachedRoute_hit_tapcompare',
                            'Service',
                            'RoutingAPI',
                            { label: 'Cache Hit', id: 'm1', visible: false },
                        ],
                        ['.', 'GetCachedRoute_miss_tapcompare', '.', '.', { label: 'Cache Miss', id: 'm2', visible: false }],
                    ],
                    region: this.region,
                    title: 'Cache Hit and Miss Rates of cachemode.Tapcompare',
                    period: 300,
                    stat: 'Sum',
                    yAxis: {
                        left: {
                            min: 0,
                            max: 100,
                        },
                    },
                },
            },
            {
                type: 'metric',
                width: 12,
                height: 7,
                properties: {
                    view: 'timeSeries',
                    stacked: false,
                    metrics: [
                        [
                            this.namespace,
                            'TapcompareCachedRoute_quoteGasAdjustedDiffPercent',
                            'Service',
                            'RoutingAPI',
                            { label: 'Misquote' },
                        ],
                    ],
                    region: this.region,
                    title: 'Total number of Misquotes from Tapcompare',
                    period: 300,
                    stat: 'SampleCount',
                    yAxis: {
                        left: {
                            min: 0,
                        },
                    },
                },
            },
            {
                type: 'metric',
                width: 12,
                height: 7,
                properties: {
                    view: 'timeSeries',
                    stacked: false,
                    metrics: [
                        [{ expression: 'm2/m1 * 100', label: 'Misquote Rate', id: 'e1' }],
                        [
                            this.namespace,
                            'GetCachedRoute_hit_tapcompare',
                            'Service',
                            'RoutingAPI',
                            { label: 'Cache Hit', id: 'm1', visible: false },
                        ],
                        [
                            '.',
                            'TapcompareCachedRoute_quoteGasAdjustedDiffPercent',
                            '.',
                            '.',
                            { label: 'Cache Miss', id: 'm2', stat: 'SampleCount', visible: false },
                        ],
                    ],
                    region: this.region,
                    title: 'Misquote rate from Tapcompare',
                    period: 300,
                    stat: 'Sum',
                    yAxis: {
                        left: {
                            min: 0,
                        },
                    },
                },
            },
        ];
    }
    generateWidgetsForStrategies(cacheStrategy) {
        const pairTradeTypeChainId = cacheStrategy.readablePairTradeTypeChainId();
        const getQuoteAmountMetricName = `GET_QUOTE_AMOUNT_${cacheStrategy.pair}_${cacheStrategy.tradeType.toUpperCase()}_CHAIN_${cacheStrategy.chainId}`;
        const getQuoteLatencyMetricName = `GET_QUOTE_LATENCY_${cacheStrategy.pair}_${cacheStrategy.tradeType.toUpperCase()}_CHAIN_${cacheStrategy.chainId}`;
        const tokenIn = cacheStrategy.pair.split('/')[0].replace('*', 'TokenIn');
        const tokenOut = cacheStrategy.pair.split('/')[1].replace('*', 'TokenOut');
        const quoteAmountsMetrics = [
            {
                type: 'text',
                width: 24,
                height: 1,
                properties: {
                    markdown: `# Cached Routes Performance for ${pairTradeTypeChainId}`,
                },
            },
            {
                type: 'metric',
                width: 12,
                height: 9,
                properties: {
                    view: 'timeSeries',
                    stacked: false,
                    metrics: [
                        [
                            this.namespace,
                            getQuoteAmountMetricName,
                            'Service',
                            'RoutingAPI',
                            { label: `${cacheStrategy.pair}/${cacheStrategy.tradeType.toUpperCase()} Quotes` },
                        ],
                    ],
                    region: this.region,
                    title: `Number of requested quotes`,
                    period: 300,
                    stat: 'SampleCount',
                    yAxis: {
                        left: {
                            min: 0,
                        },
                    },
                },
            },
            {
                type: 'metric',
                width: 12,
                height: 9,
                properties: {
                    view: 'timeSeries',
                    stacked: true,
                    metrics: cacheStrategy
                        .bucketPairs()
                        .map((bucket) => [
                        this.namespace,
                        getQuoteAmountMetricName,
                        'Service',
                        'RoutingAPI',
                        this.generateStatWithLabel(bucket, cacheStrategy.pair, cacheStrategy._tradeType),
                    ]),
                    region: this.region,
                    title: `Distribution of quotes ${pairTradeTypeChainId}`,
                    period: 300,
                },
            },
            {
                type: 'metric',
                width: 24,
                height: 6,
                properties: {
                    view: 'timeSeries',
                    stacked: false,
                    metrics: [
                        [
                            this.namespace,
                            getQuoteLatencyMetricName,
                            'Service',
                            'RoutingAPI',
                            { stat: 'p99.999', label: `${cacheStrategy.pair}/${cacheStrategy.tradeType.toUpperCase()} P99.999` },
                        ],
                        ['...', { stat: 'p99.99', label: `${cacheStrategy.pair}/${cacheStrategy.tradeType.toUpperCase()} P99.99` }],
                        ['...', { stat: 'p99.9', label: `${cacheStrategy.pair}/${cacheStrategy.tradeType.toUpperCase()} P99.9` }],
                        ['...', { stat: 'p99', label: `${cacheStrategy.pair}/${cacheStrategy.tradeType.toUpperCase()} P99` }],
                        ['...', { stat: 'p95', label: `${cacheStrategy.pair}/${cacheStrategy.tradeType.toUpperCase()} P95` }],
                        ['...', { stat: 'p90', label: `${cacheStrategy.pair}/${cacheStrategy.tradeType.toUpperCase()} P90` }],
                        ['...', { stat: 'p50', label: `${cacheStrategy.pair}/${cacheStrategy.tradeType.toUpperCase()} Median` }],
                        [
                            '...',
                            { stat: 'Average', label: `${cacheStrategy.pair}/${cacheStrategy.tradeType.toUpperCase()} Average` },
                        ],
                        [
                            '...',
                            { stat: 'Minimum', label: `${cacheStrategy.pair}/${cacheStrategy.tradeType.toUpperCase()} Minimum` },
                        ],
                    ],
                    region: this.region,
                    title: `Latency of API for requested pair`,
                    period: 300,
                    stat: 'SampleCount',
                    yAxis: {
                        left: {
                            min: 0,
                        },
                    },
                },
            },
        ];
        let tapcompareMetrics = [];
        if (cacheStrategy.willTapcompare) {
            tapcompareMetrics = this.generateTapcompareWidgets(tokenIn, tokenOut, pairTradeTypeChainId);
        }
        return quoteAmountsMetrics.concat(tapcompareMetrics);
    }
    generateStatWithLabel([min, max], pair, tradeType) {
        const tokens = pair.split('/');
        const maxNormalized = max > 0 ? max.toString() : '';
        switch (tradeType) {
            case TradeType.EXACT_INPUT:
                return {
                    stat: `PR(${min}:${maxNormalized})`,
                    label: `${min} to ${max} ${tokens[0]}`,
                };
            case TradeType.EXACT_OUTPUT:
                return {
                    stat: `PR(${min}:${maxNormalized})`,
                    label: `${min} to ${max} ${tokens[1]}`,
                };
        }
    }
    generateTapcompareWidgets(tokenIn, tokenOut, pairTradeTypeChainId) {
        // Escape the pairTradeTypeChainId in order to be used for matching against wildcards too
        const escapedPairTradeTypeChainId = pairTradeTypeChainId
            .replace(/\//g, '\\/') // Escape forward slashes
            .replace(/\*/g, '.*'); // Replace * with .* to match against any character in the pair
        const widget = [
            {
                type: 'log',
                width: 24,
                height: 8,
                properties: {
                    view: 'table',
                    query: `SOURCE '/aws/lambda/${this.lambdaName}'
            | fields @timestamp, pair, amount as amountOf${tokenIn}, quoteDiff as diffOf${tokenOut}, quoteDiff * (amount/quoteFromChain) as diffIn${tokenIn}Terms, diffIn${tokenIn}Terms / amount * 100 as misquotePercent, quoteGasAdjustedDiff as diffGasAdjustedOf${tokenOut}, quoteGasAdjustedDiff * (amount/quoteGasAdjustedFromChain) as diffGasAdjustedIn${tokenIn}Terms, diffGasAdjustedIn${tokenIn}Terms / amount * 100 as misquoteGasAdjustedPercent, gasUsedDiff, originalAmount
            | filter msg like 'Comparing quotes between Chain and Cache' and pair like /${escapedPairTradeTypeChainId}/ and quoteGasAdjustedDiff != 0 
            | sort misquoteGasAdjustedPercent desc`,
                    region: this.region,
                    title: `Quote Differences and Amounts for ${pairTradeTypeChainId}`,
                },
            },
        ];
        return widget;
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FjaGVkLXJvdXRlcy13aWRnZXRzLWZhY3RvcnkuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvZGFzaGJvYXJkcy9jYWNoZWQtcm91dGVzLXdpZGdldHMtZmFjdG9yeS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLENBQUMsTUFBTSxRQUFRLENBQUE7QUFHdEIsT0FBTyxFQUFFLDJCQUEyQixFQUF3QixNQUFNLDJDQUEyQyxDQUFBO0FBQzdHLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQTtBQUU3QyxNQUFNLE9BQU8sMEJBQTBCO0lBS3JDLFlBQVksU0FBaUIsRUFBRSxNQUFjLEVBQUUsVUFBa0I7UUFDL0QsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUE7UUFDcEIsSUFBSSxDQUFDLFNBQVMsR0FBRyxTQUFTLENBQUE7UUFDMUIsSUFBSSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUE7SUFDOUIsQ0FBQztJQUVELGVBQWU7UUFDYixNQUFNLG1CQUFtQixHQUFHLElBQUksQ0FBQyxrQ0FBa0MsRUFBRSxDQUFBO1FBRXJFLE1BQU0sQ0FBQyxrQkFBa0IsRUFBRSxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsMkJBQTJCLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBRSxDQUFDLFFBQVEsRUFBRSxFQUFFLENBQ2xILFFBQVEsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxDQUM1QixDQUFBO1FBRUQsSUFBSSx5QkFBeUIsR0FBYSxFQUFFLENBQUE7UUFDNUMsSUFBSSxrQkFBa0IsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1lBQ2pDLHlCQUF5QixHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUMsa0JBQWtCLEVBQUUsQ0FBQyxhQUFhLEVBQUUsRUFBRSxDQUMxRSxJQUFJLENBQUMsNEJBQTRCLENBQUMsYUFBYSxDQUFDLENB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RkFBcUYsUUFBUSxtRkFBbUYsT0FBTywyQkFBMkIsT0FBTzswRkFDalQsMkJBQTJCO21EQUNsRTtvQkFDekMsTUFBTSxFQUFFLElBQUksQ0FBQyxNQUFNO29CQUNuQixLQUFLLEVBQUUscUNBQXFDLG9CQUFvQixFQUFFO2lCQUNuRTthQUNGO1NBQ0YsQ0FBQTtRQUVELE9BQU8sTUFBTSxDQUFBO0lBQ2YsQ0FBQztDQUNGIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IF8gZnJvbSAnbG9kYXNoJ1xuaW1wb3J0IHsgV2lkZ2V0IH0gZnJvbSAnLi9jb3JlL21vZGVsL3dpZGdldCdcbmltcG9ydCB7IFdpZGdldHNGYWN0b3J5IH0gZnJvbSAnLi9jb3JlL3dpZGdldHMtZmFjdG9yeSdcbmltcG9ydCB7IENBQ0hFRF9ST1VURVNfQ09ORklHVVJBVElPTiwgQ2FjaGVkUm91dGVzU3RyYXRlZ3kgfSBmcm9tICcuLi9oYW5kbGVycy9yb3V0ZXItZW50aXRpZXMvcm91dGUtY2FjaGluZydcbmltcG9ydCB7IFRyYWRlVHlwZSB9IGZyb20gJ0B1bmlzd2FwL3Nkay1jb3JlJ1xuXG5leHBvcnQgY2xhc3MgQ2FjaGVkUm91dGVzV2lkZ2V0c0ZhY3RvcnkgaW1wbGVtZW50cyBXaWRnZXRzRmFjdG9yeSB7XG4gIHJlZ2lvbjogc3RyaW5nXG4gIG5hbWVzcGFjZTogc3RyaW5nXG4gIGxhbWJkYU5hbWU6IHN0cmluZ1xuXG4gIGNvbnN0cnVjdG9yKG5hbWVzcGFjZTogc3RyaW5nLCByZWdpb246IHN0cmluZywgbGFtYmRhTmFtZTogc3RyaW5nKSB7XG4gICAgdGhpcy5yZWdpb24gPSByZWdpb25cbiAgICB0aGlzLm5hbWVzcGFjZSA9IG5hbWVzcGFjZVxuICAgIHRoaXMubGFtYmRhTmFtZSA9IGxhbWJkYU5hbWVcbiAgfVxuXG4gIGdlbmVyYXRlV2lkZ2V0cygpOiBXaWRnZXRbXSB7XG4gICAgY29uc3QgY2FjaGVIaXRNaXNzV2lkZ2V0cyA9IHRoaXMuZ2VuZXJhdGVDYWNoZUhpdE1pc3NNZXRyaWNzV2lkZ2V0cygpXG5cbiAgICBjb25zdCBbd2lsZGNhcmRTdHJhdGVnaWVzLCBzdHJhdGVnaWVzXSA9IF8ucGFydGl0aW9uKEFycmF5LmZyb20oQ0FDSEVEX1JPVVRFU19DT05GSUdVUkFUSU9OLnZhbHVlcygpKSwgKHN0cmF0ZWd5KSA9PlxuICAgICAgc3RyYXRlZ3kucGFpci5pbmNsdWRlcygnKicpXG4gICAgKVxuXG4gICAgbGV0IHdpbGRjYXJkU3RyYXRlZ2llc1dpZGdldHM6IFdpZGdldFtdID0gW11cbiAgICBpZiAod2lsZGNhcmRTdHJhdGVnaWVzLmxlbmd0aCA+IDApIHtcbiAgICAgIHdpbGRjYXJkU3RyYXRlZ2llc1dpZGdldHMgPSBfLmZsYXRNYXAod2lsZGNhcmRTdHJhdGVnaWVzLCAoY2FjaGVTdHJhdGVneSkgPT5cbiAgICAgICAgdGhpcy5nZW5lcmF0ZVdpZGdldHNGb3JTdHJhdGVnaWVzKGNhY2hlU3RyYXRlZ3kpXG4gICAgICApXG5cbiAgICAgIHdpbGRjYXJkU3RyYXRlZ2llc1dpZGdldHMudW5zaGlmdCh7XG4gICAgICAgIHR5cGU6ICd0ZXh0JyxcbiAgICAgICAgd2lkdGg6IDI0LFxuICAgICAgICBoZWlnaHQ6IDEsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICBtYXJrZG93bjogYCMgV2lsZGNhcmQgcGFpcnNgLFxuICAgICAgICB9LFxuICAgICAgfSlcbiAgICB9XG5cbiAgICBjb25zdCBzdHJhdGVnaWVzV2lkZ2V0cyA9IF8uZmxhdE1hcChzdHJhdGVnaWVzLCAoY2FjaGVTdHJhdGVneSkgPT4gdGhpcy5nZW5lcmF0ZVdpZGdldHNGb3JTdHJhdGVnaWVzKGNhY2hlU3RyYXRlZ3kpKVxuXG4gICAgcmV0dXJuIGNhY2hlSGl0TWlzc1dpZGdldHMuY29uY2F0KHdpbGRjYXJkU3RyYXRlZ2llc1dpZGdldHMpLmNvbmNhdChzdHJhdGVnaWVzV2lkZ2V0cylcbiAgfVxuXG4gIHByaXZhdGUgZ2VuZXJhdGVDYWNoZUhpdE1pc3NNZXRyaWNzV2lkZ2V0cygpOiBXaWRnZXRbXSB7XG4gICAgcmV0dXJuIFtcbiAgICAgIHtcbiAgICAgICAgdHlwZTogJ3RleHQnLFxuICAgICAgICB3aWR0aDogMjQsXG4gICAgICAgIGhlaWdodDogMSxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgIG1hcmtkb3duOiBgIyBPdmVyYWxsIENhY2hlIEhpdC9NaXNzYCxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIHR5cGU6ICdtZXRyaWMnLFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIGhlaWdodDogNyxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgIHZpZXc6ICd0aW1lU2VyaWVzJyxcbiAgICAgICAgICBzdGFja2VkOiBmYWxzZSxcbiAgICAgICAgICBtZXRyaWNzOiBbXG4gICAgICAgICAgICBbeyBleHByZXNzaW9uOiAnU1VNKE1FVFJJQ1MoKSknLCBsYWJlbDogJ1JlcXVlc3RzJywgaWQ6ICdlMScgfV0sXG4gICAgICAgICAgICBbdGhpcy5uYW1lc3BhY2UsICdHZXRDYWNoZWRSb3V0ZV9oaXRfbGl2ZW1vZGUnLCAnU2VydmljZScsICdSb3V0aW5nQVBJJywgeyBsYWJlbDogJ0NhY2hlIEhpdCcsIGlkOiAnbTEnIH1dLFxuICAgICAgICAgICAgWycuJywgJ0dldENhY2hlZFJvdXRlX21pc3NfbGl2ZW1vZGUnLCAnLicsICcuJywgeyBsYWJlbDogJ0NhY2hlIE1pc3MnLCBpZDogJ20yJyB9XSxcbiAgICAgICAgICBdLFxuICAgICAgICAgIHJlZ2lvbjogdGhpcy5yZWdpb24sXG4gICAgICAgICAgdGl0bGU6ICdDYWNoZSBIaXQsIE1pc3MgYW5kIFRvdGFsIHJlcXVlc3RzIG9mIENhY2hlbW9kZS5MaXZlbW9kZScsXG4gICAgICAgICAgcGVyaW9kOiAzMDAsXG4gICAgICAgICAgc3RhdDogJ1N1bScsXG4gICAgICAgICAgeUF4aXM6IHtcbiAgICAgICAgICAgIGxlZnQ6IHtcbiAgICAgICAgICAgICAgbWluOiAwLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgdHlwZTogJ21ldHJpYycsXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgaGVpZ2h0OiA3LFxuICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgdmlldzogJ3RpbWVTZXJpZXMnLFxuICAgICAgICAgIHN0YWNrZWQ6IGZhbHNlLFxuICAgICAgICAgIG1ldHJpY3M6IFtcbiAgICAgICAgICAgIFt7IGV4cHJlc3Npb246ICdTVU0oTUVUUklDUygpKScsIGxhYmVsOiAnQWxsUmVxdWVzdHMnLCBpZDogJ2UxJywgdmlzaWJsZTogZmFsc2UgfV0sXG4gICAgICAgICAgICBbeyBleHByZXNzaW9uOiAnbTEvZTEgKiAxMDAnLCBsYWJlbDogJ0NhY2hlIEhpdCBSYXRlJywgaWQ6ICdlMicgfV0sXG4gICAgICAgICAgICBbeyBleHByZXNzaW9uOiAnbTIvZTEgKiAxMDAnLCBsYWJlbDogJ0NhY2hlIE1pc3MgUmF0ZScsIGlkOiAnZTMnIH1dLFxuICAgICAgICAgICAgW1xuICAgICAgICAgICAgICB0aGlzLm5hbWVzcGFjZSxcbiAgICAgICAgICAgICAgJ0dldENhY2hlZFJvdXRlX2hpdF9saXZlbW9kZScsXG4gICAgICAgICAgICAgICdTZXJ2aWNlJyxcbiAgICAgICAgICAgICAgJ1JvdXRpbmdBUEknLFxuICAgICAgICAgICAgICB7IGxhYmVsOiAnQ2FjaGUgSGl0JywgaWQ6ICdtMScsIHZpc2libGU6IGZhbHNlIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgWycuJywgJ0dldENhY2hlZFJvdXRlX21pc3NfbGl2ZW1vZGUnLCAnLicsICcuJywgeyBsYWJlbDogJ0NhY2hlIE1pc3MnLCBpZDogJ20yJywgdmlzaWJsZTogZmFsc2UgfV0sXG4gICAgICAgICAgXSxcbiAgICAgICAgICByZWdpb246IHRoaXMucmVnaW9uLFxuICAgICAgICAgIHRpdGxlOiAnQ2FjaGUgSGl0IGFuZCBNaXNzIFJhdGVzIG9mIENhY2hlbW9kZS5MaXZlbW9kZScsXG4gICAgICAgICAgcGVyaW9kOiAzMDAsXG4gICAgICAgICAgc3RhdDogJ1N1bScsXG4gICAgICAgICAgeUF4aXM6IHtcbiAgICAgICAgICAgIGxlZnQ6IHtcbiAgICAgICAgICAgICAgbWluOiAwLFxuICAgICAgICAgICAgICBtYXg6IDEwMCxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIHR5cGU6ICdtZXRyaWMnLFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIGhlaWdodDogNyxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgIHZpZXc6ICd0aW1lU2VyaWVzJyxcbiAgICAgICAgICBzdGFja2VkOiBmYWxzZSxcbiAgICAgICAgICBtZXRyaWNzOiBbXG4gICAgICAgICAgICBbeyBleHByZXNzaW9uOiAnU1VNKE1FVFJJQ1MoKSknLCBsYWJlbDogJ1JlcXVlc3RzJywgaWQ6ICdlMScgfV0sXG4gICAgICAgICAgICBbXG4gICAgICAgICAgICAgIHRoaXMubmFtZXNwYWNlLFxuICAgICAgICAgICAgICAnR2V0Q2FjaGVkUm91dGVfaGl0X3RhcGNvbXBhcmUnLFxuICAgICAgICAgICAgICAnU2VydmljZScsXG4gICAgICAgICAgICAgICdSb3V0aW5nQVBJJyxcbiAgICAgICAgICAgICAgeyBsYWJlbDogJ0NhY2hlIEhpdCcsIGlkOiAnbTEnIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgWycuJywgJ0dldENhY2hlZFJvdXRlX21pc3NfdGFwY29tcGFyZScsICcuJywgJy4nLCB7IGxhYmVsOiAnQ2FjaGUgTWlzcycsIGlkOiAnbTInIH1dLFxuICAgICAgICAgIF0sXG4gICAgICAgICAgcmVnaW9uOiB0aGlzLnJlZ2lvbixcbiAgICAgICAgICB0aXRsZTogJ0NhY2hlIEhpdCwgTWlzcyBhbmQgVG90YWwgcmVxdWVzdHMgb2YgQ2FjaGVtb2RlLlRhcGNvbXBhcmUnLFxuICAgICAgICAgIHBlcmlvZDogMzAwLFxuICAgICAgICAgIHN0YXQ6ICdTdW0nLFxuICAgICAgICAgIHlBeGlzOiB7XG4gICAgICAgICAgICBsZWZ0OiB7XG4gICAgICAgICAgICAgIG1pbjogMCxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIHR5cGU6ICdtZXRyaWMnLFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIGhlaWdodDogNyxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgIHZpZXc6ICd0aW1lU2VyaWVzJyxcbiAgICAgICAgICBzdGFja2VkOiBmYWxzZSxcbiAgICAgICAgICBtZXRyaWNzOiBbXG4gICAgICAgICAgICBbeyBleHByZXNzaW9uOiAnU1VNKE1FVFJJQ1MoKSknLCBsYWJlbDogJ0FsbFJlcXVlc3RzJywgaWQ6ICdlMScsIHZpc2libGU6IGZhbHNlIH1dLFxuICAgICAgICAgICAgW3sgZXhwcmVzc2lvbjogJ20xL2UxICogMTAwJywgbGFiZWw6ICdDYWNoZSBIaXQgUmF0ZScsIGlkOiAnZTInIH1dLFxuICAgICAgICAgICAgW3sgZXhwcmVzc2lvbjogJ20yL2UxICogMTAwJywgbGFiZWw6ICdDYWNoZSBNaXNzIFJhdGUnLCBpZDogJ2UzJyB9XSxcbiAgICAgICAgICAgIFtcbiAgICAgICAgICAgICAgdGhpcy5uYW1lc3BhY2UsXG4gICAgICAgICAgICAgICdHZXRDYWNoZWRSb3V0ZV9oaXRfdGFwY29tcGFyZScsXG4gICAgICAgICAgICAgICdTZXJ2aWNlJyxcbiAgICAgICAgICAgICAgJ1JvdXRpbmdBUEknLFxuICAgICAgICAgICAgICB7IGxhYmVsOiAnQ2FjaGUgSGl0JywgaWQ6ICdtMScsIHZpc2libGU6IGZhbHNlIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgWycuJywgJ0dldENhY2hlZFJvdXRlX21pc3NfdGFwY29tcGFyZScsICcuJywgJy4nLCB7IGxhYmVsOiAnQ2FjaGUgTWlzcycsIGlkOiAnbTInLCB2aXNpYmxlOiBmYWxzZSB9XSxcbiAgICAgICAgICBdLFxuICAgICAgICAgIHJlZ2lvbjogdGhpcy5yZWdpb24sXG4gICAgICAgICAgdGl0bGU6ICdDYWNoZSBIaXQgYW5kIE1pc3MgUmF0ZXMgb2YgY2FjaGVtb2RlLlRhcGNvbXBhcmUnLFxuICAgICAgICAgIHBlcmlvZDogMzAwLFxuICAgICAgICAgIHN0YXQ6ICdTdW0nLFxuICAgICAgICAgIHlBeGlzOiB7XG4gICAgICAgICAgICBsZWZ0OiB7XG4gICAgICAgICAgICAgIG1pbjogMCxcbiAgICAgICAgICAgICAgbWF4OiAxMDAsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICB0eXBlOiAnbWV0cmljJyxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICBoZWlnaHQ6IDcsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICB2aWV3OiAndGltZVNlcmllcycsXG4gICAgICAgICAgc3RhY2tlZDogZmFsc2UsXG4gICAgICAgICAgbWV0cmljczogW1xuICAgICAgICAgICAgW1xuICAgICAgICAgICAgICB0aGlzLm5hbWVzcGFjZSxcbiAgICAgICAgICAgICAgJ1RhcGNvbXBhcmVDYWNoZWRSb3V0ZV9xdW90ZUdhc0FkanVzdGVkRGlmZlBlcmNlbnQnLFxuICAgICAgICAgICAgICAnU2VydmljZScsXG4gICAgICAgICAgICAgICdSb3V0aW5nQVBJJyxcbiAgICAgICAgICAgICAgeyBsYWJlbDogJ01pc3F1b3RlJyB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICBdLFxuICAgICAgICAgIHJlZ2lvbjogdGhpcy5yZWdpb24sXG4gICAgICAgICAgdGl0bGU6ICdUb3RhbCBudW1iZXIgb2YgTWlzcXVvdGVzIGZyb20gVGFwY29tcGFyZScsXG4gICAgICAgICAgcGVyaW9kOiAzMDAsXG4gICAgICAgICAgc3RhdDogJ1NhbXBsZUNvdW50JyxcbiAgICAgICAgICB5QXhpczoge1xuICAgICAgICAgICAgbGVmdDoge1xuICAgICAgICAgICAgICBtaW46IDAsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICB0eXBlOiAnbWV0cmljJyxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICBoZWlnaHQ6IDcsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICB2aWV3OiAndGltZVNlcmllcycsXG4gICAgICAgICAgc3RhY2tlZDogZmFsc2UsXG4gICAgICAgICAgbWV0cmljczogW1xuICAgICAgICAgICAgW3sgZXhwcmVzc2lvbjogJ20yL20xICogMTAwJywgbGFiZWw6ICdNaXNxdW90ZSBSYXRlJywgaWQ6ICdlMScgfV0sXG4gICAgICAgICAgICBbXG4gICAgICAgICAgICAgIHRoaXMubmFtZXNwYWNlLFxuICAgICAgICAgICAgICAnR2V0Q2FjaGVkUm91dGVfaGl0X3RhcGNvbXBhcmUnLFxuICAgICAgICAgICAgICAnU2VydmljZScsXG4gICAgICAgICAgICAgICdSb3V0aW5nQVBJJyxcbiAgICAgICAgICAgICAgeyBsYWJlbDogJ0NhY2hlIEhpdCcsIGlkOiAnbTEnLCB2aXNpYmxlOiBmYWxzZSB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIFtcbiAgICAgICAgICAgICAgJy4nLFxuICAgICAgICAgICAgICAnVGFwY29tcGFyZUNhY2hlZFJvdXRlX3F1b3RlR2FzQWRqdXN0ZWREaWZmUGVyY2VudCcsXG4gICAgICAgICAgICAgICcuJyxcbiAgICAgICAgICAgICAgJy4nLFxuICAgICAgICAgICAgICB7IGxhYmVsOiAnQ2FjaGUgTWlzcycsIGlkOiAnbTInLCBzdGF0OiAnU2FtcGxlQ291bnQnLCB2aXNpYmxlOiBmYWxzZSB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICBdLFxuICAgICAgICAgIHJlZ2lvbjogdGhpcy5yZWdpb24sXG4gICAgICAgICAgdGl0bGU6ICdNaXNxdW90ZSByYXRlIGZyb20gVGFwY29tcGFyZScsXG4gICAgICAgICAgcGVyaW9kOiAzMDAsXG4gICAgICAgICAgc3RhdDogJ1N1bScsXG4gICAgICAgICAgeUF4aXM6IHtcbiAgICAgICAgICAgIGxlZnQ6IHtcbiAgICAgICAgICAgICAgbWluOiAwLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICBdXG4gIH1cblxuICBwcml2YXRlIGdlbmVyYXRlV2lkZ2V0c0ZvclN0cmF0ZWdpZXMoY2FjaGVTdHJhdGVneTogQ2FjaGVkUm91dGVzU3RyYXRlZ3kpOiBXaWRnZXRbXSB7XG4gICAgY29uc3QgcGFpclRyYWRlVHlwZUNoYWluSWQgPSBjYWNoZVN0cmF0ZWd5LnJlYWRhYmxlUGFpclRyYWRlVHlwZUNoYWluSWQoKVxuICAgIGNvbnN0IGdldFF1b3RlQW1vdW50TWV0cmljTmFtZSA9IGBHRVRfUVVPVEVfQU1PVU5UXyR7XG4gICAgICBjYWNoZVN0cmF0ZWd5LnBhaXJcbiAgICB9XyR7Y2FjaGVTdHJhdGVneS50cmFkZVR5cGUudG9VcHBlckNhc2UoKX1fQ0hBSU5fJHtjYWNoZVN0cmF0ZWd5LmNoYWluSWR9YFxuICAgIGNvbnN0IGdldFF1b3RlTGF0ZW5jeU1ldHJpY05hbWUgPSBgR0VUX1FVT1RFX0xBVEVOQ1lfJHtcbiAgICAgIGNhY2hlU3RyYXRlZ3kucGFpclxuICAgIH1fJHtjYWNoZVN0cmF0ZWd5LnRyYWRlVHlwZS50b1VwcGVyQ2FzZSgpfV9DSEFJTl8ke2NhY2hlU3RyYXRlZ3kuY2hhaW5JZH1gXG4gICAgY29uc3QgdG9rZW5JbiA9IGNhY2hlU3RyYXRlZ3kucGFpci5zcGxpdCgnLycpWzBdLnJlcGxhY2UoJyonLCAnVG9rZW5JbicpXG4gICAgY29uc3QgdG9rZW5PdXQgPSBjYWNoZVN0cmF0ZWd5LnBhaXIuc3BsaXQoJy8nKVsxXS5yZXBsYWNlKCcqJywgJ1Rva2VuT3V0JylcblxuICAgIGNvbnN0IHF1b3RlQW1vdW50c01ldHJpY3M6IFdpZGdldFtdID0gW1xuICAgICAge1xuICAgICAgICB0eXBlOiAndGV4dCcsXG4gICAgICAgIHdpZHRoOiAyNCxcbiAgICAgICAgaGVpZ2h0OiAxLFxuICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgbWFya2Rvd246IGAjIENhY2hlZCBSb3V0ZXMgUGVyZm9ybWFuY2UgZm9yICR7cGFpclRyYWRlVHlwZUNoYWluSWR9YCxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIHR5cGU6ICdtZXRyaWMnLFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIGhlaWdodDogOSxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgIHZpZXc6ICd0aW1lU2VyaWVzJyxcbiAgICAgICAgICBzdGFja2VkOiBmYWxzZSxcbiAgICAgICAgICBtZXRyaWNzOiBbXG4gICAgICAgICAgICBbXG4gICAgICAgICAgICAgIHRoaXMubmFtZXNwYWNlLFxuICAgICAgICAgICAgICBnZXRRdW90ZUFtb3VudE1ldHJpY05hbWUsXG4gICAgICAgICAgICAgICdTZXJ2aWNlJyxcbiAgICAgICAgICAgICAgJ1JvdXRpbmdBUEknLFxuICAgICAgICAgICAgICB7IGxhYmVsOiBgJHtjYWNoZVN0cmF0ZWd5LnBhaXJ9LyR7Y2FjaGVTdHJhdGVneS50cmFkZVR5cGUudG9VcHBlckNhc2UoKX0gUXVvdGVzYCB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICBdLFxuICAgICAgICAgIHJlZ2lvbjogdGhpcy5yZWdpb24sXG4gICAgICAgICAgdGl0bGU6IGBOdW1iZXIgb2YgcmVxdWVzdGVkIHF1b3Rlc2AsXG4gICAgICAgICAgcGVyaW9kOiAzMDAsXG4gICAgICAgICAgc3RhdDogJ1NhbXBsZUNvdW50JyxcbiAgICAgICAgICB5QXhpczoge1xuICAgICAgICAgICAgbGVmdDoge1xuICAgICAgICAgICAgICBtaW46IDAsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICB0eXBlOiAnbWV0cmljJyxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICBoZWlnaHQ6IDksXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICB2aWV3OiAndGltZVNlcmllcycsXG4gICAgICAgICAgc3RhY2tlZDogdHJ1ZSxcbiAgICAgICAgICBtZXRyaWNzOiBjYWNoZVN0cmF0ZWd5XG4gICAgICAgICAgICAuYnVja2V0UGFpcnMoKVxuICAgICAgICAgICAgLm1hcCgoYnVja2V0KSA9PiBbXG4gICAgICAgICAgICAgIHRoaXMubmFtZXNwYWNlLFxuICAgICAgICAgICAgICBnZXRRdW90ZUFtb3VudE1ldHJpY05hbWUsXG4gICAgICAgICAgICAgICdTZXJ2aWNlJyxcbiAgICAgICAgICAgICAgJ1JvdXRpbmdBUEknLFxuICAgICAgICAgICAgICB0aGlzLmdlbmVyYXRlU3RhdFdpdGhMYWJlbChidWNrZXQsIGNhY2hlU3RyYXRlZ3kucGFpciwgY2FjaGVTdHJhdGVneS5fdHJhZGVUeXBlKSxcbiAgICAgICAgICAgIF0pLFxuICAgICAgICAgIHJlZ2lvbjogdGhpcy5yZWdpb24sXG4gICAgICAgICAgdGl0bGU6IGBEaXN0cmlidXRpb24gb2YgcXVvdGVzICR7cGFpclRyYWRlVHlwZUNoYWluSWR9YCxcbiAgICAgICAgICBwZXJpb2Q6IDMwMCxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIHR5cGU6ICdtZXRyaWMnLFxuICAgICAgICB3aWR0aDogMjQsXG4gICAgICAgIGhlaWdodDogNixcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgIHZpZXc6ICd0aW1lU2VyaWVzJyxcbiAgICAgICAgICBzdGFja2VkOiBmYWxzZSxcbiAgICAgICAgICBtZXRyaWNzOiBbXG4gICAgICAgICAgICBbXG4gICAgICAgICAgICAgIHRoaXMubmFtZXNwYWNlLFxuICAgICAgICAgICAgICBnZXRRdW90ZUxhdGVuY3lNZXRyaWNOYW1lLFxuICAgICAgICAgICAgICAnU2VydmljZScsXG4gICAgICAgICAgICAgICdSb3V0aW5nQVBJJyxcbiAgICAgICAgICAgICAgeyBzdGF0OiAncDk5Ljk5OScsIGxhYmVsOiBgJHtjYWNoZVN0cmF0ZWd5LnBhaXJ9LyR7Y2FjaGVTdHJhdGVneS50cmFkZVR5cGUudG9VcHBlckNhc2UoKX0gUDk5Ljk5OWAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBbJy4uLicsIHsgc3RhdDogJ3A5OS45OScsIGxhYmVsOiBgJHtjYWNoZVN0cmF0ZWd5LnBhaXJ9LyR7Y2FjaGVTdHJhdGVneS50cmFkZVR5cGUudG9VcHBlckNhc2UoKX0gUDk5Ljk5YCB9XSxcbiAgICAgICAgICAgIFsnLi4uJywgeyBzdGF0OiAncDk5LjknLCBsYWJlbDogYCR7Y2FjaGVTdHJhdGVneS5wYWlyfS8ke2NhY2hlU3RyYXRlZ3kudHJhZGVUeXBlLnRvVXBwZXJDYXNlKCl9IFA5OS45YCB9XSxcbiAgICAgICAgICAgIFsnLi4uJywgeyBzdGF0OiAncDk5JywgbGFiZWw6IGAke2NhY2hlU3RyYXRlZ3kucGFpcn0vJHtjYWNoZVN0cmF0ZWd5LnRyYWRlVHlwZS50b1VwcGVyQ2FzZSgpfSBQOTlgIH1dLFxuICAgICAgICAgICAgWycuLi4nLCB7IHN0YXQ6ICdwOTUnLCBsYWJlbDogYCR7Y2FjaGVTdHJhdGVneS5wYWlyfS8ke2NhY2hlU3RyYXRlZ3kudHJhZGVUeXBlLnRvVXBwZXJDYXNlKCl9IFA5NWAgfV0sXG4gICAgICAgICAgICBbJy4uLicsIHsgc3RhdDogJ3A5MCcsIGxhYmVsOiBgJHtjYWNoZVN0cmF0ZWd5LnBhaXJ9LyR7Y2FjaGVTdHJhdGVneS50cmFkZVR5cGUudG9VcHBlckNhc2UoKX0gUDkwYCB9XSxcbiAgICAgICAgICAgIFsnLi4uJywgeyBzdGF0OiAncDUwJywgbGFiZWw6IGAke2NhY2hlU3RyYXRlZ3kucGFpcn0vJHtjYWNoZVN0cmF0ZWd5LnRyYWRlVHlwZS50b1VwcGVyQ2FzZSgpfSBNZWRpYW5gIH1dLFxuICAgICAgICAgICAgW1xuICAgICAgICAgICAgICAnLi4uJyxcbiAgICAgICAgICAgICAgeyBzdGF0OiAnQXZlcmFnZScsIGxhYmVsOiBgJHtjYWNoZVN0cmF0ZWd5LnBhaXJ9LyR7Y2FjaGVTdHJhdGVneS50cmFkZVR5cGUudG9VcHBlckNhc2UoKX0gQXZlcmFnZWAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBbXG4gICAgICAgICAgICAgICcuLi4nLFxuICAgICAgICAgICAgICB7IHN0YXQ6ICdNaW5pbXVtJywgbGFiZWw6IGAke2NhY2hlU3RyYXRlZ3kucGFpcn0vJHtjYWNoZVN0cmF0ZWd5LnRyYWRlVHlwZS50b1VwcGVyQ2FzZSgpfSBNaW5pbXVtYCB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICBdLFxuICAgICAgICAgIHJlZ2lvbjogdGhpcy5yZWdpb24sXG4gICAgICAgICAgdGl0bGU6IGBMYXRlbmN5IG9mIEFQSSBmb3IgcmVxdWVzdGVkIHBhaXJgLFxuICAgICAgICAgIHBlcmlvZDogMzAwLFxuICAgICAgICAgIHN0YXQ6ICdTYW1wbGVDb3VudCcsXG4gICAgICAgICAgeUF4aXM6IHtcbiAgICAgICAgICAgIGxlZnQ6IHtcbiAgICAgICAgICAgICAgbWluOiAwLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICBdXG5cbiAgICBsZXQgdGFwY29tcGFyZU1ldHJpY3M6IFdpZGdldFtdID0gW11cblxuICAgIGlmIChjYWNoZVN0cmF0ZWd5LndpbGxUYXBjb21wYXJlKSB7XG4gICAgICB0YXBjb21wYXJlTWV0cmljcyA9IHRoaXMuZ2VuZXJhdGVUYXBjb21wYXJlV2lkZ2V0cyh0b2tlbkluLCB0b2tlbk91dCwgcGFpclRyYWRlVHlwZUNoYWluSWQpXG4gICAgfVxuXG4gICAgcmV0dXJuIHF1b3RlQW1vdW50c01ldHJpY3MuY29uY2F0KHRhcGNvbXBhcmVNZXRyaWNzKVxuICB9XG5cbiAgcHJpdmF0ZSBnZW5lcmF0ZVN0YXRXaXRoTGFiZWwoXG4gICAgW21pbiwgbWF4XTogW251bWJlciwgbnVtYmVyXSxcbiAgICBwYWlyOiBzdHJpbmcsXG4gICAgdHJhZGVUeXBlOiBUcmFkZVR5cGVcbiAgKTogeyBzdGF0OiBzdHJpbmc7IGxhYmVsOiBzdHJpbmcgfSB7XG4gICAgY29uc3QgdG9rZW5zID0gcGFpci5zcGxpdCgnLycpXG4gICAgY29uc3QgbWF4Tm9ybWFsaXplZCA9IG1heCA+IDAgPyBtYXgudG9TdHJpbmcoKSA6ICcnXG5cbiAgICBzd2l0Y2ggKHRyYWRlVHlwZSkge1xuICAgICAgY2FzZSBUcmFkZVR5cGUuRVhBQ1RfSU5QVVQ6XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgc3RhdDogYFBSKCR7bWlufToke21heE5vcm1hbGl6ZWR9KWAsXG4gICAgICAgICAgbGFiZWw6IGAke21pbn0gdG8gJHttYXh9ICR7dG9rZW5zWzBdfWAsXG4gICAgICAgIH1cbiAgICAgIGNhc2UgVHJhZGVUeXBlLkVYQUNUX09VVFBVVDpcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBzdGF0OiBgUFIoJHttaW59OiR7bWF4Tm9ybWFsaXplZH0pYCxcbiAgICAgICAgICBsYWJlbDogYCR7bWlufSB0byAke21heH0gJHt0b2tlbnNbMV19YCxcbiAgICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIHByaXZhdGUgZ2VuZXJhdGVUYXBjb21wYXJlV2lkZ2V0cyh0b2tlbkluOiBzdHJpbmcsIHRva2VuT3V0OiBzdHJpbmcsIHBhaXJUcmFkZVR5cGVDaGFpbklkOiBzdHJpbmcpOiBXaWRnZXRbXSB7XG4gICAgLy8gRXNjYXBlIHRoZSBwYWlyVHJhZGVUeXBlQ2hhaW5JZCBpbiBvcmRlciB0byBiZSB1c2VkIGZvciBtYXRjaGluZyBhZ2FpbnN0IHdpbGRjYXJkcyB0b29cbiAgICBjb25zdCBlc2NhcGVkUGFpclRyYWRlVHlwZUNoYWluSWQgPSBwYWlyVHJhZGVUeXBlQ2hhaW5JZFxuICAgICAgLnJlcGxhY2UoL1xcLy9nLCAnXFxcXC8nKSAvLyBFc2NhcGUgZm9yd2FyZCBzbGFzaGVzXG4gICAgICAucmVwbGFjZSgvXFwqL2csICcuKicpIC8vIFJlcGxhY2UgKiB3aXRoIC4qIHRvIG1hdGNoIGFnYWluc3QgYW55IGNoYXJhY3RlciBpbiB0aGUgcGFpclxuXG4gICAgY29uc3Qgd2lkZ2V0OiBXaWRnZXRbXSA9IFtcbiAgICAgIHtcbiAgICAgICAgdHlwZTogJ2xvZycsXG4gICAgICAgIHdpZHRoOiAyNCxcbiAgICAgICAgaGVpZ2h0OiA4LFxuICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgdmlldzogJ3RhYmxlJyxcbiAgICAgICAgICBxdWVyeTogYFNPVVJDRSAnL2F3cy9sYW1iZGEvJHt0aGlzLmxhbWJkYU5hbWV9J1xuICAgICAgICAgICAgfCBmaWVsZHMgQHRpbWVzdGFtcCwgcGFpciwgYW1vdW50IGFzIGFtb3VudE9mJHt0b2tlbklufSwgcXVvdGVEaWZmIGFzIGRpZmZPZiR7dG9rZW5PdXR9LCBxdW90ZURpZmYgKiAoYW1vdW50L3F1b3RlRnJvbUNoYWluKSBhcyBkaWZmSW4ke3Rva2VuSW59VGVybXMsIGRpZmZJbiR7dG9rZW5Jbn1UZXJtcyAvIGFtb3VudCAqIDEwMCBhcyBtaXNxdW90ZVBlcmNlbnQsIHF1b3RlR2FzQWRqdXN0ZWREaWZmIGFzIGRpZmZHYXNBZGp1c3RlZE9mJHt0b2tlbk91dH0sIHF1b3RlR2FzQWRqdXN0ZWREaWZmICogKGFtb3VudC9xdW90ZUdhc0FkanVzdGVkRnJvbUNoYWluKSBhcyBkaWZmR2FzQWRqdXN0ZWRJbiR7dG9rZW5Jbn1UZXJtcywgZGlmZkdhc0FkanVzdGVkSW4ke3Rva2VuSW59VGVybXMgLyBhbW91bnQgKiAxMDAgYXMgbWlzcXVvdGVHYXNBZGp1c3RlZFBlcmNlbnQsIGdhc1VzZWREaWZmLCBvcmlnaW5hbEFtb3VudFxuICAgICAgICAgICAgfCBmaWx0ZXIgbXNnIGxpa2UgJ0NvbXBhcmluZyBxdW90ZXMgYmV0d2VlbiBDaGFpbiBhbmQgQ2FjaGUnIGFuZCBwYWlyIGxpa2UgLyR7ZXNjYXBlZFBhaXJUcmFkZVR5cGVDaGFpbklkfS8gYW5kIHF1b3RlR2FzQWRqdXN0ZWREaWZmICE9IDAgXG4gICAgICAgICAgICB8IHNvcnQgbWlzcXVvdGVHYXNBZGp1c3RlZFBlcmNlbnQgZGVzY2AsXG4gICAgICAgICAgcmVnaW9uOiB0aGlzLnJlZ2lvbixcbiAgICAgICAgICB0aXRsZTogYFF1b3RlIERpZmZlcmVuY2VzIGFuZCBBbW91bnRzIGZvciAke3BhaXJUcmFkZVR5cGVDaGFpbklkfWAsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIF1cblxuICAgIHJldHVybiB3aWRnZXRcbiAgfVxufVxuIl19