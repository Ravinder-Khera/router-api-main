import { ChainId } from '@uniswap/sdk-core';
import * as cdk from 'aws-cdk-lib';
import * as aws_cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import _ from 'lodash';
import { QuoteAmountsWidgetsFactory } from '../../lib/dashboards/quote-amounts-widgets-factory';
import { SUPPORTED_CHAINS } from '../../lib/handlers/injector-sor';
import { CachedRoutesWidgetsFactory } from '../../lib/dashboards/cached-routes-widgets-factory';
import { ID_TO_NETWORK_NAME } from '@uniswap/smart-order-router/build/main/util/chains';
export const NAMESPACE = 'Uniswap';
export class RoutingDashboardStack extends cdk.NestedStack {
    constructor(scope, name, props) {
        super(scope, name, props);
        const { apiName, routingLambdaName, poolCacheLambdaNameArray, ipfsPoolCacheLambdaName } = props;
        const region = cdk.Stack.of(this).region;
        const TESTNETS = [
            ChainId.ARBITRUM_GOERLI,
            ChainId.POLYGON_MUMBAI,
            ChainId.GOERLI,
            ChainId.SEPOLIA,
            ChainId.CELO_ALFAJORES,
        ];
        const MAINNETS = SUPPORTED_CHAINS.filter((chain) => !TESTNETS.includes(chain));
        // No CDK resource exists for contributor insights at the moment so use raw CloudFormation.
        const REQUESTED_QUOTES_RULE_NAME = 'RequestedQuotes';
        const REQUESTED_QUOTES_BY_CHAIN_RULE_NAME = 'RequestedQuotesByChain';
        new cdk.CfnResource(this, 'QuoteContributorInsights', {
            type: 'AWS::CloudWatch::InsightRule',
            properties: {
                RuleBody: JSON.stringify({
                    Schema: {
                        Name: 'CloudWatchLogRule',
                        Version: 1,
                    },
                    AggregateOn: 'Count',
                    Contribution: {
                        Filters: [
                            {
                                Match: '$.tokenPairSymbol',
                                IsPresent: true,
                            },
                        ],
                        Keys: ['$.tokenPairSymbol'],
                    },
                    LogFormat: 'JSON',
                    LogGroupNames: [`/aws/lambda/${routingLambdaName}`],
                }),
                RuleName: REQUESTED_QUOTES_RULE_NAME,
                RuleState: 'ENABLED',
            },
        });
        new cdk.CfnResource(this, 'QuoteByChainContributorInsights', {
            type: 'AWS::CloudWatch::InsightRule',
            properties: {
                RuleBody: JSON.stringify({
                    Schema: {
                        Name: 'CloudWatchLogRule',
                        Version: 1,
                    },
                    AggregateOn: 'Count',
                    Contribution: {
                        Filters: [
                            {
                                Match: '$.tokenPairSymbolChain',
                                IsPresent: true,
                            },
                        ],
                        Keys: ['$.tokenPairSymbolChain'],
                    },
                    LogFormat: 'JSON',
                    LogGroupNames: [`/aws/lambda/${routingLambdaName}`],
                }),
                RuleName: REQUESTED_QUOTES_BY_CHAIN_RULE_NAME,
                RuleState: 'ENABLED',
            },
        });
        const poolCacheLambdaMetrics = [];
        poolCacheLambdaNameArray.forEach((poolCacheLambdaName) => {
            poolCacheLambdaMetrics.push(['AWS/Lambda', `${poolCacheLambdaName}Errors`, 'FunctionName', poolCacheLambdaName]);
            poolCacheLambdaMetrics.push(['.', `${poolCacheLambdaName}Invocations`, '.', '.']);
        });
        const perChainWidgetsForRoutingDashboard = _.flatMap([MAINNETS, TESTNETS], (chains) => [
            {
                height: 8,
                width: 24,
                type: 'metric',
                properties: {
                    metrics: chains.map((chainId) => [
                        NAMESPACE,
                        `GET_QUOTE_REQUESTED_CHAINID: ${chainId}`,
                        'Service',
                        'RoutingAPI',
                        { id: `mreqc${chainId}`, label: `Requests on ${ID_TO_NETWORK_NAME(chainId)}` },
                    ]),
                    view: 'timeSeries',
                    stacked: false,
                    region,
                    stat: 'Sum',
                    period: 300,
                    title: 'Requests by Chain',
                    setPeriodToTimeRange: true,
                    yAxis: {
                        left: {
                            showUnits: false,
                            label: 'Requests',
                        },
                    },
                },
            },
            {
                type: 'metric',
                width: 12,
                height: 8,
                properties: {
                    view: 'timeSeries',
                    stacked: false,
                    metrics: _.flatMap(chains, (chainId) => [
                        [
                            NAMESPACE,
                            `GET_QUOTE_LATENCY_CHAIN_${chainId}`,
                            'Service',
                            'RoutingAPI',
                            { stat: 'p99.99', label: `${ID_TO_NETWORK_NAME(chainId)} P99.99` },
                        ],
                        ['...', { stat: 'p99.9', label: `${ID_TO_NETWORK_NAME(chainId)} P99.9` }],
                        ['...', { stat: 'p99', label: `${ID_TO_NETWORK_NAME(chainId)} P99` }],
                    ]),
                    region,
                    title: `P99.X Latency by Chain`,
                    period: 300,
                    setPeriodToTimeRange: true,
                    stat: 'SampleCount',
                    yAxis: {
                        left: {
                            min: 0,
                            showUnits: false,
                            label: 'Milliseconds',
                        },
                    },
                },
            },
            {
                type: 'metric',
                width: 12,
                height: 8,
                properties: {
                    view: 'timeSeries',
                    stacked: false,
                    metrics: _.flatMap(chains, (chainId) => [
                        [
                            NAMESPACE,
                            `GET_QUOTE_LATENCY_CHAIN_${chainId}`,
                            'Service',
                            'RoutingAPI',
                            { stat: 'p95', label: `${ID_TO_NETWORK_NAME(chainId)} P95` },
                        ],
                        ['...', { stat: 'p90', label: `${ID_TO_NETWORK_NAME(chainId)} P90` }],
                    ]),
                    region,
                    title: `P95 & P90 Latency by Chain`,
                    period: 300,
                    setPeriodToTimeRange: true,
                    stat: 'SampleCount',
                    yAxis: {
                        left: {
                            min: 0,
                            showUnits: false,
                            label: 'Milliseconds',
                        },
                    },
                },
            },
            {
                type: 'metric',
                width: 12,
                height: 8,
                properties: {
                    view: 'timeSeries',
                    stacked: false,
                    metrics: _.flatMap(chains, (chainId) => [
                        [
                            NAMESPACE,
                            `GET_QUOTE_LATENCY_CHAIN_${chainId}`,
                            'Service',
                            'RoutingAPI',
                            { stat: 'p50', label: `${ID_TO_NETWORK_NAME(chainId)} Median` },
                        ],
                        ['...', { stat: 'Average', label: `${ID_TO_NETWORK_NAME(chainId)} Average` }],
                    ]),
                    region,
                    title: `Average and Median Latency by Chain`,
                    period: 300,
                    setPeriodToTimeRange: true,
                    stat: 'SampleCount',
                    yAxis: {
                        left: {
                            min: 0,
                            showUnits: false,
                            label: 'Milliseconds',
                        },
                    },
                },
            },
            {
                type: 'metric',
                width: 12,
                height: 8,
                properties: {
                    view: 'timeSeries',
                    stacked: false,
                    metrics: _.flatMap(chains, (chainId) => [
                        [
                            NAMESPACE,
                            `GET_QUOTE_LATENCY_CHAIN_${chainId}`,
                            'Service',
                            'RoutingAPI',
                            { stat: 'Minimum', label: `${ID_TO_NETWORK_NAME(chainId)} Minimum` },
                        ],
                    ]),
                    region,
                    title: `Minimum Latency by Chain`,
                    period: 300,
                    setPeriodToTimeRange: true,
                    stat: 'SampleCount',
                    yAxis: {
                        left: {
                            min: 0,
                            showUnits: false,
                            label: 'Milliseconds',
                        },
                    },
                },
            },
            {
                height: 8,
                width: 12,
                type: 'metric',
                properties: {
                    metrics: _.flatMap(chains, (chainId) => [
                        [
                            {
                                expression: `(m200c${chainId} / (mreqc${chainId} - m400c${chainId})) * 100`,
                                label: `Success Rate on ${ID_TO_NETWORK_NAME(chainId)}`,
                                id: `e1c${chainId}`,
                            },
                        ],
                        [
                            NAMESPACE,
                            `GET_QUOTE_REQUESTED_CHAINID: ${chainId}`,
                            'Service',
                            'RoutingAPI',
                            { id: `mreqc${chainId}`, label: `Requests on Chain ${chainId}`, visible: false },
                        ],
                        [
                            '.',
                            `GET_QUOTE_200_CHAINID: ${chainId}`,
                            '.',
                            '.',
                            { id: `m200c${chainId}`, label: `2XX Requests on Chain ${chainId}`, visible: false },
                        ],
                        [
                            '.',
                            `GET_QUOTE_400_CHAINID: ${chainId}`,
                            '.',
                            '.',
                            { id: `m400c${chainId}`, label: `4XX Errors on Chain ${chainId}`, visible: false },
                        ],
                    ]),
                    view: 'timeSeries',
                    stacked: false,
                    region,
                    stat: 'Sum',
                    period: 300,
                    title: 'Success Rates by Chain',
                    setPeriodToTimeRange: true,
                    yAxis: {
                        left: {
                            showUnits: false,
                            label: '%',
                        },
                    },
                },
            },
            {
                height: 8,
                width: 12,
                type: 'metric',
                properties: {
                    metrics: _.flatMap(chains, (chainId) => [
                        [
                            {
                                expression: `(m200c${chainId} / mreqc${chainId}) * 100`,
                                label: `Success Rate (w. 4XX) on ${ID_TO_NETWORK_NAME(chainId)}`,
                                id: `e1c${chainId}`,
                            },
                        ],
                        [
                            NAMESPACE,
                            `GET_QUOTE_REQUESTED_CHAINID: ${chainId}`,
                            'Service',
                            'RoutingAPI',
                            { id: `mreqc${chainId}`, label: `Requests on Chain ${chainId}`, visible: false },
                        ],
                        [
                            '.',
                            `GET_QUOTE_200_CHAINID: ${chainId}`,
                            '.',
                            '.',
                            { id: `m200c${chainId}`, label: `2XX Requests on Chain ${chainId}`, visible: false },
                        ],
                    ]),
                    view: 'timeSeries',
                    stacked: false,
                    region,
                    stat: 'Sum',
                    period: 300,
                    title: 'Success Rates (w. 4XX) by Chain',
                    setPeriodToTimeRange: true,
                    yAxis: {
                        left: {
                            showUnits: false,
                            label: '%',
                        },
                    },
                },
            },
            {
                height: 8,
                width: 12,
                type: 'metric',
                properties: {
                    metrics: _.flatMap(chains, (chainId) => [
                        [
                            {
                                expression: `(m500c${chainId} / mreqc${chainId}) * 100`,
                                label: `5XX Error Rate on ${ID_TO_NETWORK_NAME(chainId)}`,
                                id: `e1c${chainId}`,
                            },
                        ],
                        [
                            NAMESPACE,
                            `GET_QUOTE_REQUESTED_CHAINID: ${chainId}`,
                            'Service',
                            'RoutingAPI',
                            { id: `mreqc${chainId}`, label: `Requests on Chain ${chainId}`, visible: false },
                        ],
                        [
                            '.',
                            `GET_QUOTE_500_CHAINID: ${chainId}`,
                            '.',
                            '.',
                            { id: `m500c${chainId}`, label: `5XX Errors on Chain ${chainId}`, visible: false },
                        ],
                    ]),
                    view: 'timeSeries',
                    stacked: false,
                    region,
                    stat: 'Sum',
                    period: 300,
                    title: '5XX Error Rates by Chain',
                    setPeriodToTimeRange: true,
                    yAxis: {
                        left: {
                            showUnits: false,
                            label: '%',
                        },
                    },
                },
            },
            {
                height: 8,
                width: 12,
                type: 'metric',
                properties: {
                    metrics: _.flatMap(chains, (chainId) => [
                        [
                            {
                                expression: `(m400c${chainId} / mreqc${chainId}) * 100`,
                                label: `4XX Error Rate on ${ID_TO_NETWORK_NAME(chainId)}`,
                                id: `e2c${chainId}`,
                            },
                        ],
                        [
                            NAMESPACE,
                            `GET_QUOTE_REQUESTED_CHAINID: ${chainId}`,
                            'Service',
                            'RoutingAPI',
                            { id: `mreqc${chainId}`, label: `Requests on Chain ${chainId}`, visible: false },
                        ],
                        [
                            '.',
                            `GET_QUOTE_400_CHAINID: ${chainId}`,
                            '.',
                            '.',
                            { id: `m400c${chainId}`, label: `4XX Errors on Chain ${chainId}`, visible: false },
                        ],
                    ]),
                    view: 'timeSeries',
                    stacked: false,
                    region,
                    stat: 'Sum',
                    period: 300,
                    title: '4XX Error Rates by Chain',
                    setPeriodToTimeRange: true,
                    yAxis: {
                        left: {
                            showUnits: false,
                            label: '%',
                        },
                    },
                },
            },
        ]);
        new aws_cloudwatch.CfnDashboard(this, 'RoutingAPIDashboard', {
            dashboardName: `RoutingDashboard`,
            dashboardBody: JSON.stringify({
                periodOverride: 'inherit',
                widgets: perChainWidgetsForRoutingDashboard.concat([
                    {
                        height: 6,
                        width: 24,
                        type: 'metric',
                        properties: {
                            metrics: [
                                ['AWS/ApiGateway', 'Count', 'ApiName', apiName, { label: 'Requests' }],
                                ['.', '5XXError', '.', '.', { label: '5XXError Responses', color: '#ff7f0e' }],
                                ['.', '4XXError', '.', '.', { label: '4XXError Responses', color: '#2ca02c' }],
                            ],
                            view: 'timeSeries',
                            stacked: false,
                            region,
                            stat: 'Sum',
                            period: 300,
                            title: 'Total Requests/Responses',
                        },
                    },
                    {
                        height: 6,
                        width: 24,
                        type: 'metric',
                        properties: {
                            metrics: [
                                [
                                    {
                                        expression: 'm1 * 100',
                                        label: '5XX Error Rate',
                                        id: 'e1',
                                        color: '#ff7f0e',
                                    },
                                ],
                                [
                                    {
                                        expression: 'm2 * 100',
                                        label: '4XX Error Rate',
                                        id: 'e2',
                                        color: '#2ca02c',
                                    },
                                ],
                                [
                                    'AWS/ApiGateway',
                                    '5XXError',
                                    'ApiName',
                                    'Routing API',
                                    { id: 'm1', label: '5XXError', visible: false },
                                ],
                                ['.', '4XXError', '.', '.', { id: 'm2', visible: false }],
                            ],
                            view: 'timeSeries',
                            stacked: false,
                            region,
                            stat: 'Average',
                            period: 300,
                            title: '5XX/4XX Error Rates',
                            setPeriodToTimeRange: true,
                            yAxis: {
                                left: {
                                    showUnits: false,
                                    label: '%',
                                },
                            },
                        },
                    },
                    {
                        height: 6,
                        width: 24,
                        type: 'metric',
                        properties: {
                            metrics: [['AWS/ApiGateway', 'Latency', 'ApiName', apiName]],
                            view: 'timeSeries',
                            stacked: false,
                            region,
                            period: 300,
                            stat: 'p90',
                            title: 'Latency p90',
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
                                [NAMESPACE, 'QuotesFetched', 'Service', 'RoutingAPI'],
                                [NAMESPACE, 'V3QuotesFetched', 'Service', 'RoutingAPI'],
                                [NAMESPACE, 'V2QuotesFetched', 'Service', 'RoutingAPI'],
                                [NAMESPACE, 'MixedQuotesFetched', 'Service', 'RoutingAPI'],
                            ],
                            region,
                            title: 'p90 Quotes Fetched Per Swap',
                            period: 300,
                            stat: 'p90',
                        },
                    },
                    {
                        type: 'metric',
                        width: 24,
                        height: 6,
                        properties: {
                            view: 'timeSeries',
                            stacked: false,
                            insightRule: {
                                maxContributorCount: 25,
                                orderBy: 'Sum',
                                ruleName: REQUESTED_QUOTES_RULE_NAME,
                            },
                            legend: {
                                position: 'bottom',
                            },
                            region,
                            title: 'Requested Quotes',
                            period: 300,
                            stat: 'Sum',
                        },
                    },
                    {
                        type: 'metric',
                        width: 24,
                        height: 6,
                        properties: {
                            view: 'timeSeries',
                            stacked: false,
                            insightRule: {
                                maxContributorCount: 25,
                                orderBy: 'Sum',
                                ruleName: REQUESTED_QUOTES_BY_CHAIN_RULE_NAME,
                            },
                            legend: {
                                position: 'bottom',
                            },
                            region,
                            title: 'Requested Quotes By Chain',
                            period: 300,
                            stat: 'Sum',
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
                                [NAMESPACE, 'MixedAndV3AndV2SplitRoute', 'Service', 'RoutingAPI'],
                                [NAMESPACE, 'MixedAndV3SplitRoute', 'Service', 'RoutingAPI'],
                                [NAMESPACE, 'MixedAndV2SplitRoute', 'Service', 'RoutingAPI'],
                                [NAMESPACE, 'MixedSplitRoute', 'Service', 'RoutingAPI'],
                                [NAMESPACE, 'MixedRoute', 'Service', 'RoutingAPI'],
                                [NAMESPACE, 'V3AndV2SplitRoute', 'Service', 'RoutingAPI'],
                                [NAMESPACE, 'V3SplitRoute', 'Service', 'RoutingAPI'],
                                [NAMESPACE, 'V3Route', 'Service', 'RoutingAPI'],
                                [NAMESPACE, 'V2SplitRoute', 'Service', 'RoutingAPI'],
                                [NAMESPACE, 'V2Route', 'Service', 'RoutingAPI'],
                            ],
                            region,
                            title: 'Types of routes returned across all chains',
                            period: 300,
                            stat: 'Sum',
                        },
                    },
                    {
                        type: 'metric',
                        width: 24,
                        height: 6,
                        properties: {
                            view: 'timeSeries',
                            stacked: false,
                            metrics: _.flatMap(SUPPORTED_CHAINS, (chainId) => [
                                [NAMESPACE, `MixedAndV3AndV2SplitRouteForChain${chainId}`, 'Service', 'RoutingAPI'],
                                [NAMESPACE, `MixedAndV3SplitRouteForChain${chainId}`, 'Service', 'RoutingAPI'],
                                [NAMESPACE, `MixedAndV2SplitRouteForChain${chainId}`, 'Service', 'RoutingAPI'],
                                [NAMESPACE, `MixedSplitRouteForChain${chainId}`, 'Service', 'RoutingAPI'],
                                [NAMESPACE, `MixedRouteForChain${chainId}`, 'Service', 'RoutingAPI'],
                                [NAMESPACE, `V3AndV2SplitRouteForChain${chainId}`, 'Service', 'RoutingAPI'],
                                [NAMESPACE, `V3SplitRouteForChain${chainId}`, 'Service', 'RoutingAPI'],
                                [NAMESPACE, `V3RouteForChain${chainId}`, 'Service', 'RoutingAPI'],
                                [NAMESPACE, `V2SplitRouteForChain${chainId}`, 'Service', 'RoutingAPI'],
                                [NAMESPACE, `V2RouteForChain${chainId}`, 'Service', 'RoutingAPI'],
                            ]),
                            region,
                            title: 'Types of V3 routes returned by chain',
                            period: 300,
                            stat: 'Sum',
                        },
                    },
                    {
                        type: 'metric',
                        width: 24,
                        height: 6,
                        properties: {
                            metrics: _.flatMap(SUPPORTED_CHAINS, (chainId) => [
                                ['Uniswap', `QuoteFoundForChain${chainId}`, 'Service', 'RoutingAPI'],
                                ['Uniswap', `QuoteRequestedForChain${chainId}`, 'Service', 'RoutingAPI'],
                            ]),
                            view: 'timeSeries',
                            stacked: false,
                            stat: 'Sum',
                            period: 300,
                            region,
                            title: 'Quote Requested/Found by Chain',
                        },
                    },
                    {
                        height: 12,
                        width: 24,
                        type: 'metric',
                        properties: {
                            metrics: [
                                [NAMESPACE, 'TokenListLoad', 'Service', 'RoutingAPI', { color: '#c5b0d5' }],
                                ['.', 'GasPriceLoad', '.', '.', { color: '#17becf' }],
                                ['.', 'V3PoolsLoad', '.', '.', { color: '#e377c2' }],
                                ['.', 'V2PoolsLoad', '.', '.', { color: '#e377c2' }],
                                ['.', 'V3SubgraphPoolsLoad', '.', '.', { color: '#1f77b4' }],
                                ['.', 'V2SubgraphPoolsLoad', '.', '.', { color: '#bf77b4' }],
                                ['.', 'V3QuotesLoad', '.', '.', { color: '#2ca02c' }],
                                ['.', 'MixedQuotesLoad', '.', '.', { color: '#fefa63' }],
                                ['.', 'V2QuotesLoad', '.', '.', { color: '#7f7f7f' }],
                                ['.', 'FindBestSwapRoute', '.', '.', { color: '#d62728' }],
                            ],
                            view: 'timeSeries',
                            stacked: true,
                            region,
                            stat: 'p90',
                            period: 300,
                            title: 'Latency Breakdown',
                        },
                    },
                    {
                        type: 'metric',
                        width: 24,
                        height: 9,
                        properties: {
                            view: 'timeSeries',
                            stacked: false,
                            metrics: [
                                [NAMESPACE, 'V3top2directswappool', 'Service', 'RoutingAPI'],
                                ['.', 'V3top2ethquotetokenpool', '.', '.'],
                                ['.', 'V3topbytvl', '.', '.'],
                                ['.', 'V3topbytvlusingtokenin', '.', '.'],
                                ['.', 'V3topbytvlusingtokeninsecondhops', '.', '.'],
                                ['.', 'V2topbytvlusingtokenout', '.', '.'],
                                ['.', 'V3topbytvlusingtokenoutsecondhops', '.', '.'],
                                ['.', 'V3topbybasewithtokenin', '.', '.'],
                                ['.', 'V3topbybasewithtokenout', '.', '.'],
                            ],
                            region: region,
                            title: 'p95 V3 Top N Pools Used From Sources in Best Route',
                            stat: 'p95',
                        },
                    },
                    {
                        type: 'metric',
                        width: 24,
                        height: 9,
                        properties: {
                            view: 'timeSeries',
                            stacked: false,
                            metrics: [
                                [NAMESPACE, 'V2top2directswappool', 'Service', 'RoutingAPI'],
                                ['.', 'V2top2ethquotetokenpool', '.', '.'],
                                ['.', 'V2topbytvl', '.', '.'],
                                ['.', 'V2topbytvlusingtokenin', '.', '.'],
                                ['.', 'V2topbytvlusingtokeninsecondhops', '.', '.'],
                                ['.', 'V2topbytvlusingtokenout', '.', '.'],
                                ['.', 'V2topbytvlusingtokenoutsecondhops', '.', '.'],
                                ['.', 'V2topbybasewithtokenin', '.', '.'],
                                ['.', 'V2topbybasewithtokenout', '.', '.'],
                            ],
                            region: region,
                            title: 'p95 V2 Top N Pools Used From Sources in Best Route',
                            stat: 'p95',
                        },
                    },
                    {
                        type: 'metric',
                        width: 24,
                        height: 9,
                        properties: {
                            view: 'timeSeries',
                            stacked: false,
                            metrics: [
                                ['AWS/Lambda', 'ProvisionedConcurrentExecutions', 'FunctionName', routingLambdaName],
                                ['.', 'ConcurrentExecutions', '.', '.'],
                                ['.', 'ProvisionedConcurrencySpilloverInvocations', '.', '.'],
                            ],
                            region: region,
                            title: 'Routing Lambda Provisioned Concurrency',
                            stat: 'Average',
                        },
                    },
                    {
                        type: 'metric',
                        width: 24,
                        height: 9,
                        properties: {
                            view: 'timeSeries',
                            stacked: false,
                            metrics: [
                                ...poolCacheLambdaMetrics,
                                ...(ipfsPoolCacheLambdaName
                                    ? [
                                        ['AWS/Lambda', 'Errors', 'FunctionName', ipfsPoolCacheLambdaName],
                                        ['.', 'Invocations', '.', '.'],
                                    ]
                                    : []),
                            ],
                            region: region,
                            title: 'Pool Cache Lambda Error/Invocations',
                            stat: 'Sum',
                        },
                    },
                ]),
            }),
        });
        const quoteAmountsWidgets = new QuoteAmountsWidgetsFactory(NAMESPACE, region);
        new aws_cloudwatch.CfnDashboard(this, 'RoutingAPITrackedPairsDashboard', {
            dashboardName: 'RoutingAPITrackedPairsDashboard',
            dashboardBody: JSON.stringify({
                periodOverride: 'inherit',
                widgets: quoteAmountsWidgets.generateWidgets(),
            }),
        });
        const cachedRoutesWidgets = new CachedRoutesWidgetsFactory(NAMESPACE, region, routingLambdaName);
        new aws_cloudwatch.CfnDashboard(this, 'CachedRoutesPerformanceDashboard', {
            dashboardName: 'CachedRoutesPerformanceDashboard',
            dashboardBody: JSON.stringify({
                periodOverride: 'inherit',
                widgets: cachedRoutesWidgets.generateWidgets(),
            }),
        });
        new aws_cloudwatch.CfnDashboard(this, 'RoutingAPIQuoteProviderDashboard', {
            dashboardName: `RoutingQuoteProviderDashboard`,
            dashboardBody: JSON.stringify({
                periodOverride: 'inherit',
                widgets: [
                    {
                        height: 6,
                        width: 24,
                        y: 0,
                        x: 0,
                        type: 'metric',
                        properties: {
                            metrics: [[NAMESPACE, 'QuoteApproxGasUsedPerSuccessfulCall', 'Service', 'RoutingAPI']],
                            view: 'timeSeries',
                            stacked: false,
                            region,
                            stat: 'Average',
                            period: 300,
                            title: 'Approx gas used by each call',
                        },
                    },
                    {
                        height: 6,
                        width: 24,
                        y: 6,
                        x: 0,
                        type: 'metric',
                        properties: {
                            metrics: [
                                [NAMESPACE, 'QuoteTotalCallsToProvider', 'Service', 'RoutingAPI'],
                                ['.', 'QuoteExpectedCallsToProvider', '.', '.'],
                                ['.', 'QuoteNumRetriedCalls', '.', '.'],
                                ['.', 'QuoteNumRetryLoops', '.', '.'],
                            ],
                            view: 'timeSeries',
                            stacked: false,
                            region,
                            stat: 'Average',
                            period: 300,
                            title: 'Number of retries to provider needed to get quote',
                        },
                    },
                    {
                        height: 6,
                        width: 24,
                        y: 12,
                        x: 0,
                        type: 'metric',
                        properties: {
                            metrics: [
                                [NAMESPACE, 'QuoteOutOfGasExceptionRetry', 'Service', 'RoutingAPI'],
                                ['.', 'QuoteSuccessRateRetry', '.', '.'],
                                ['.', 'QuoteBlockHeaderNotFoundRetry', '.', '.'],
                                ['.', 'QuoteTimeoutRetry', '.', '.'],
                                ['.', 'QuoteUnknownReasonRetry', '.', '.'],
                                ['.', 'QuoteBlockConflictErrorRetry', '.', '.'],
                            ],
                            view: 'timeSeries',
                            stacked: false,
                            region,
                            period: 300,
                            stat: 'Sum',
                            title: 'Number of requests that retried in the quote provider',
                        },
                    },
                ],
            }),
        });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicm91dGluZy1kYXNoYm9hcmQtc3RhY2suanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9iaW4vc3RhY2tzL3JvdXRpbmctZGFzaGJvYXJkLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxtQkFBbUIsQ0FBQTtBQUMzQyxPQUFPLEtBQUssR0FBRyxNQUFNLGFBQWEsQ0FBQTtBQUNsQyxPQUFPLEtBQUssY0FBYyxNQUFNLDRCQUE0QixDQUFBO0FBRTVELE9BQU8sQ0FBQyxNQUFNLFFBQVEsQ0FBQTtBQUN0QixPQUFPLEVBQUUsMEJBQTBCLEVBQUUsTUFBTSxvREFBb0QsQ0FBQTtBQUMvRixPQUFPLEVBQUUsZ0JBQWdCLEVBQUUsTUFBTSxpQ0FBaUMsQ0FBQTtBQUNsRSxPQUFPLEVBQUUsMEJBQTBCLEVBQUUsTUFBTSxvREFBb0QsQ0FBQTtBQUMvRixPQUFPLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxvREFBb0QsQ0FBQTtBQUV2RixNQUFNLENBQUMsTUFBTSxTQUFTLEdBQUcsU0FBUyxDQUFBO0FBa0JsQyxNQUFNLE9BQU8scUJBQXNCLFNBQVEsR0FBRyxDQUFDLFdBQVc7SUFDeEQsWUFBWSxLQUFnQixFQUFFLElBQVksRUFBRSxLQUE0QjtRQUN0RSxLQUFLLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQTtRQUV6QixNQUFNLEVBQUUsT0FBTyxFQUFFLGlCQUFpQixFQUFFLHdCQUF3QixFQUFFLHVCQUF1QixFQUFFLEdBQUcsS0FBSyxDQUFBO1FBQy9GLE1BQU0sTUFBTSxHQUFHLEdBQUcsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQTtRQUV4QyxNQUFNLFFBQVEsR0FBRztZQUNmLE9BQU8sQ0FBQyxlQUFlO1lBQ3ZCLE9BQU8sQ0FBQyxjQUFjO1lBQ3RCLE9BQU8sQ0FBQyxNQUFNO1lBQ2QsT0FBTyxDQUFD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QixFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUM7Z0NBQ3BDLENBQUMsR0FBRyxFQUFFLHlCQUF5QixFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUM7Z0NBQzFDLENBQUMsR0FBRyxFQUFFLDhCQUE4QixFQUFFLEdBQUcsRUFBRSxHQUFHLENBQUM7NkJBQ2hEOzRCQUNELElBQUksRUFBRSxZQUFZOzRCQUNsQixPQUFPLEVBQUUsS0FBSzs0QkFDZCxNQUFNOzRCQUNOLE1BQU0sRUFBRSxHQUFHOzRCQUNYLElBQUksRUFBRSxLQUFLOzRCQUNYLEtBQUssRUFBRSx1REFBdUQ7eUJBQy9EO3FCQUNGO2lCQUNGO2FBQ0YsQ0FBQztTQUNILENBQUMsQ0FBQTtJQUNKLENBQUM7Q0FDRiIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IENoYWluSWQgfSBmcm9tICdAdW5pc3dhcC9zZGstY29yZSdcbmltcG9ydCAqIGFzIGNkayBmcm9tICdhd3MtY2RrLWxpYidcbmltcG9ydCAqIGFzIGF3c19jbG91ZHdhdGNoIGZyb20gJ2F3cy1jZGstbGliL2F3cy1jbG91ZHdhdGNoJ1xuaW1wb3J0IHsgQ29uc3RydWN0IH0gZnJvbSAnY29uc3RydWN0cydcbmltcG9ydCBfIGZyb20gJ2xvZGFzaCdcbmltcG9ydCB7IFF1b3RlQW1vdW50c1dpZGdldHNGYWN0b3J5IH0gZnJvbSAnLi4vLi4vbGliL2Rhc2hib2FyZHMvcXVvdGUtYW1vdW50cy13aWRnZXRzLWZhY3RvcnknXG5pbXBvcnQgeyBTVVBQT1JURURfQ0hBSU5TIH0gZnJvbSAnLi4vLi4vbGliL2hhbmRsZXJzL2luamVjdG9yLXNvcidcbmltcG9ydCB7IENhY2hlZFJvdXRlc1dpZGdldHNGYWN0b3J5IH0gZnJvbSAnLi4vLi4vbGliL2Rhc2hib2FyZHMvY2FjaGVkLXJvdXRlcy13aWRnZXRzLWZhY3RvcnknXG5pbXBvcnQgeyBJRF9UT19ORVRXT1JLX05BTUUgfSBmcm9tICdAdW5pc3dhcC9zbWFydC1vcmRlci1yb3V0ZXIvYnVpbGQvbWFpbi91dGlsL2NoYWlucydcblxuZXhwb3J0IGNvbnN0IE5BTUVTUEFDRSA9ICdVbmlzd2FwJ1xuXG5leHBvcnQgdHlwZSBMYW1iZGFXaWRnZXQgPSB7XG4gIHR5cGU6IHN0cmluZ1xuICB4OiBudW1iZXJcbiAgeTogbnVtYmVyXG4gIHdpZHRoOiBudW1iZXJcbiAgaGVpZ2h0OiBudW1iZXJcbiAgcHJvcGVydGllczogeyB2aWV3OiBzdHJpbmc7IHN0YWNrZWQ6IGJvb2xlYW47IG1ldHJpY3M6IHN0cmluZ1tdW107IHJlZ2lvbjogc3RyaW5nOyB0aXRsZTogc3RyaW5nOyBzdGF0OiBzdHJpbmcgfVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIFJvdXRpbmdEYXNoYm9hcmRQcm9wcyBleHRlbmRzIGNkay5OZXN0ZWRTdGFja1Byb3BzIHtcbiAgYXBpTmFtZTogc3RyaW5nXG4gIHJvdXRpbmdMYW1iZGFOYW1lOiBzdHJpbmdcbiAgcG9vbENhY2hlTGFtYmRhTmFtZUFycmF5OiBzdHJpbmdbXVxuICBpcGZzUG9vbENhY2hlTGFtYmRhTmFtZT86IHN0cmluZ1xufVxuXG5leHBvcnQgY2xhc3MgUm91dGluZ0Rhc2hib2FyZFN0YWNrIGV4dGVuZHMgY2RrLk5lc3RlZFN0YWNrIHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgbmFtZTogc3RyaW5nLCBwcm9wczogUm91dGluZ0Rhc2hib2FyZFByb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIG5hbWUsIHByb3BzKVxuXG4gICAgY29uc3QgeyBhcGlOYW1lLCByb3V0aW5nTGFtYmRhTmFtZSwgcG9vbENhY2hlTGFtYmRhTmFtZUFycmF5LCBpcGZzUG9vbENhY2hlTGFtYmRhTmFtZSB9ID0gcHJvcHNcbiAgICBjb25zdCByZWdpb24gPSBjZGsuU3RhY2sub2YodGhpcykucmVnaW9uXG5cbiAgICBjb25zdCBURVNUTkVUUyA9IFtcbiAgICAgIENoYWluSWQuQVJCSVRSVU1fR09FUkxJLFxuICAgICAgQ2hhaW5JZC5QT0xZR09OX01VTUJBSSxcbiAgICAgIENoYWluSWQuR09FUkxJLFxuICAgICAgQ2hhaW5JZC5TRVBPTElBLFxuICAgICAgQ2hhaW5JZC5DRUxPX0FMRkFKT1JFUyxcbiAgICBdXG5cbiAgICBjb25zdCBNQUlOTkVUUyA9IFNVUFBPUlRFRF9DSEFJTlMuZmlsdGVyKChjaGFpbikgPT4gIVRFU1RORVRTLmluY2x1ZGVzKGNoYWluKSlcblxuICAgIC8vIE5vIENESyByZXNvdXJjZSBleGlzdHMgZm9yIGNvbnRyaWJ1dG9yIGluc2lnaHRzIGF0IHRoZSBtb21lbnQgc28gdXNlIHJhdyBDbG91ZEZvcm1hdGlvbi5cbiAgICBjb25zdCBSRVFVRVNURURfUVVPVEVTX1JVTEVfTkFNRSA9ICdSZXF1ZXN0ZWRRdW90ZXMnXG4gICAgY29uc3QgUkVRVUVTVEVEX1FVT1RFU19CWV9DSEFJTl9SVUxFX05BTUUgPSAnUmVxdWVzdGVkUXVvdGVzQnlDaGFpbidcbiAgICBuZXcgY2RrLkNmblJlc291cmNlKHRoaXMsICdRdW90ZUNvbnRyaWJ1dG9ySW5zaWdodHMnLCB7XG4gICAgICB0eXBlOiAnQVdTOjpDbG91ZFdhdGNoOjpJbnNpZ2h0UnVsZScsXG4gICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgIFJ1bGVCb2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgU2NoZW1hOiB7XG4gICAgICAgICAgICBOYW1lOiAnQ2xvdWRXYXRjaExvZ1J1bGUnLFxuICAgICAgICAgICAgVmVyc2lvbjogMSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIEFnZ3JlZ2F0ZU9uOiAnQ291bnQnLFxuICAgICAgICAgIENvbnRyaWJ1dGlvbjoge1xuICAgICAgICAgICAgRmlsdGVyczogW1xuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgTWF0Y2g6ICckLnRva2VuUGFpclN5bWJvbCcsXG4gICAgICAgICAgICAgICAgSXNQcmVzZW50OiB0cnVlLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIEtleXM6IFsnJC50b2tlblBhaXJTeW1ib2wnXSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIExvZ0Zvcm1hdDogJ0pTT04nLFxuICAgICAgICAgIExvZ0dyb3VwTmFtZXM6IFtgL2F3cy9sYW1iZGEvJHtyb3V0aW5nTGFtYmRhTmFtZX1gXSxcbiAgICAgICAgfSksXG4gICAgICAgIFJ1bGVOYW1lOiBSRVFVRVNURURfUVVPVEVTX1JVTEVfTkFNRSxcbiAgICAgICAgUnVsZVN0YXRlOiAnRU5BQkxFRCcsXG4gICAgICB9LFxuICAgIH0pXG5cbiAgICBuZXcgY2RrLkNmblJlc291cmNlKHRoaXMsICdRdW90ZUJ5Q2hhaW5Db250cmlidXRvckluc2lnaHRzJywge1xuICAgICAgdHlwZTogJ0FXUzo6Q2xvdWRXYXRjaDo6SW5zaWdodFJ1bGUnLFxuICAgICAgcHJvcGVydGllczoge1xuICAgICAgICBSdWxlQm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIFNjaGVtYToge1xuICAgICAgICAgICAgTmFtZTogJ0Nsb3VkV2F0Y2hMb2dSdWxlJyxcbiAgICAgICAgICAgIFZlcnNpb246IDEsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBBZ2dyZWdhdGVPbjogJ0NvdW50JyxcbiAgICAgICAgICBDb250cmlidXRpb246IHtcbiAgICAgICAgICAgIEZpbHRlcnM6IFtcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIE1hdGNoOiAnJC50b2tlblBhaXJTeW1ib2xDaGFpbicsXG4gICAgICAgICAgICAgICAgSXNQcmVzZW50OiB0cnVlLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIEtleXM6IFsnJC50b2tlblBhaXJTeW1ib2xDaGFpbiddLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgTG9nRm9ybWF0OiAnSlNPTicsXG4gICAgICAgICAgTG9nR3JvdXBOYW1lczogW2AvYXdzL2xhbWJkYS8ke3JvdXRpbmdMYW1iZGFOYW1lfWBdLFxuICAgICAgICB9KSxcbiAgICAgICAgUnVsZU5hbWU6IFJFUVVFU1RFRF9RVU9URVNfQllfQ0hBSU5fUlVMRV9OQU1FLFxuICAgICAgICBSdWxlU3RhdGU6ICdFTkFCTEVEJyxcbiAgICAgIH0sXG4gICAgfSlcblxuICAgIGNvbnN0IHBvb2xDYWNoZUxhbWJkYU1ldHJpY3M6IHN0cmluZ1tdW10gPSBbXVxuICAgIHBvb2xDYWNoZUxhbWJkYU5hbWVBcnJheS5mb3JFYWNoKChwb29sQ2FjaGVMYW1iZGFOYW1lKSA9PiB7XG4gICAgICBwb29sQ2FjaGVMYW1iZGFNZXRyaWNzLnB1c2goWydBV1MvTGFtYmRhJywgYCR7cG9vbENhY2hlTGFtYmRhTmFtZX1FcnJvcnNgLCAnRnVuY3Rpb25OYW1lJywgcG9vbENhY2hlTGFtYmRhTmFtZV0pXG4gICAgICBwb29sQ2FjaGVMYW1iZGFNZXRyaWNzLnB1c2goWycuJywgYCR7cG9vbENhY2hlTGFtYmRhTmFtZX1JbnZvY2F0aW9uc2AsICcuJywgJy4nXSlcbiAgICB9KVxuXG4gICAgY29uc3QgcGVyQ2hhaW5XaWRnZXRzRm9yUm91dGluZ0Rhc2hib2FyZDogYW55W10gPSBfLmZsYXRNYXAoW01BSU5ORVRTLCBURVNUTkVUU10sIChjaGFpbnMpID0+IFtcbiAgICAgIHtcbiAgICAgICAgaGVpZ2h0OiA4LFxuICAgICAgICB3aWR0aDogMjQsXG4gICAgICAgIHR5cGU6ICdtZXRyaWMnLFxuICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgbWV0cmljczogY2hhaW5zLm1hcCgoY2hhaW5JZCkgPT4gW1xuICAgICAgICAgICAgTkFNRVNQQUNFLFxuICAgICAgICAgICAgYEdFVF9RVU9URV9SRVFVRVNURURfQ0hBSU5JRDogJHtjaGFpbklkfWAsXG4gICAgICAgICAgICAnU2VydmljZScsXG4gICAgICAgICAgICAnUm91dGluZ0FQSScsXG4gICAgICAgICAgICB7IGlkOiBgbXJlcWMke2NoYWluSWR9YCwgbGFiZWw6IGBSZXF1ZXN0cyBvbiAke0lEX1RPX05FVFdPUktfTkFNRShjaGFpbklkKX1gIH0sXG4gICAgICAgICAgXSksXG4gICAgICAgICAgdmlldzogJ3RpbWVTZXJpZXMnLFxuICAgICAgICAgIHN0YWNrZWQ6IGZhbHNlLFxuICAgICAgICAgIHJlZ2lvbixcbiAgICAgICAgICBzdGF0OiAnU3VtJyxcbiAgICAgICAgICBwZXJpb2Q6IDMwMCxcbiAgICAgICAgICB0aXRsZTogJ1JlcXVlc3RzIGJ5IENoYWluJyxcbiAgICAgICAgICBzZXRQZXJpb2RUb1RpbWVSYW5nZTogdHJ1ZSxcbiAgICAgICAgICB5QXhpczoge1xuICAgICAgICAgICAgbGVmdDoge1xuICAgICAgICAgICAgICBzaG93VW5pdHM6IGZhbHNlLFxuICAgICAgICAgICAgICBsYWJlbDogJ1JlcXVlc3RzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIHR5cGU6ICdtZXRyaWMnLFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIGhlaWdodDogOCxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgIHZpZXc6ICd0aW1lU2VyaWVzJyxcbiAgICAgICAgICBzdGFja2VkOiBmYWxzZSxcbiAgICAgICAgICBtZXRyaWNzOiBfLmZsYXRNYXAoY2hhaW5zLCAoY2hhaW5JZCkgPT4gW1xuICAgICAgICAgICAgW1xuICAgICAgICAgICAgICBOQU1FU1BBQ0UsXG4gICAgICAgICAgICAgIGBHRVRfUVVPVEVfTEFURU5DWV9DSEFJTl8ke2NoYWluSWR9YCxcbiAgICAgICAgICAgICAgJ1NlcnZpY2UnLFxuICAgICAgICAgICAgICAnUm91dGluZ0FQSScsXG4gICAgICAgICAgICAgIHsgc3RhdDogJ3A5OS45OScsIGxhYmVsOiBgJHtJRF9UT19ORVRXT1JLX05BTUUoY2hhaW5JZCl9IFA5OS45OWAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBbJy4uLicsIHsgc3RhdDogJ3A5OS45JywgbGFiZWw6IGAke0lEX1RPX05FVFdPUktfTkFNRShjaGFpbklkKX0gUDk5LjlgIH1dLFxuICAgICAgICAgICAgWycuLi4nLCB7IHN0YXQ6ICdwOTknLCBsYWJlbDogYCR7SURfVE9fTkVUV09SS19OQU1FKGNoYWluSWQpfSBQOTlgIH1dLFxuICAgICAgICAgIF0pLFxuICAgICAgICAgIHJlZ2lvbixcbiAgICAgICAgICB0aXRsZTogYFA5OS5YIExhdGVuY3kgYnkgQ2hhaW5gLFxuICAgICAgICAgIHBlcmlvZDogMzAwLFxuICAgICAgICAgIHNldFBlcmlvZFRvVGltZVJhbmdlOiB0cnVlLFxuICAgICAgICAgIHN0YXQ6ICdTYW1wbGVDb3VudCcsXG4gICAgICAgICAgeUF4aXM6IHtcbiAgICAgICAgICAgIGxlZnQ6IHtcbiAgICAgICAgICAgICAgbWluOiAwLFxuICAgICAgICAgICAgICBzaG93VW5pdHM6IGZhbHNlLFxuICAgICAgICAgICAgICBsYWJlbDogJ01pbGxpc2Vjb25kcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAge1xuICAgICAgICB0eXBlOiAnbWV0cmljJyxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICBoZWlnaHQ6IDgsXG4gICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICB2aWV3OiAndGltZVNlcmllcycsXG4gICAgICAgICAgc3RhY2tlZDogZmFsc2UsXG4gICAgICAgICAgbWV0cmljczogXy5mbGF0TWFwKGNoYWlucywgKGNoYWluSWQpID0+IFtcbiAgICAgICAgICAgIFtcbiAgICAgICAgICAgICAgTkFNRVNQQUNFLFxuICAgICAgICAgICAgICBgR0VUX1FVT1RFX0xBVEVOQ1lfQ0hBSU5fJHtjaGFpbklkfWAsXG4gICAgICAgICAgICAgICdTZXJ2aWNlJyxcbiAgICAgICAgICAgICAgJ1JvdXRpbmdBUEknLFxuICAgICAgICAgICAgICB7IHN0YXQ6ICdwOTUnLCBsYWJlbDogYCR7SURfVE9fTkVUV09SS19OQU1FKGNoYWluSWQpfSBQOTVgIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgWycuLi4nLCB7IHN0YXQ6ICdwOTAnLCBsYWJlbDogYCR7SURfVE9fTkVUV09SS19OQU1FKGNoYWluSWQpfSBQOTBgIH1dLFxuICAgICAgICAgIF0pLFxuICAgICAgICAgIHJlZ2lvbixcbiAgICAgICAgICB0aXRsZTogYFA5NSAmIFA5MCBMYXRlbmN5IGJ5IENoYWluYCxcbiAgICAgICAgICBwZXJpb2Q6IDMwMCxcbiAgICAgICAgICBzZXRQZXJpb2RUb1RpbWVSYW5nZTogdHJ1ZSxcbiAgICAgICAgICBzdGF0OiAnU2FtcGxlQ291bnQnLFxuICAgICAgICAgIHlBeGlzOiB7XG4gICAgICAgICAgICBsZWZ0OiB7XG4gICAgICAgICAgICAgIG1pbjogMCxcbiAgICAgICAgICAgICAgc2hvd1VuaXRzOiBmYWxzZSxcbiAgICAgICAgICAgICAgbGFiZWw6ICdNaWxsaXNlY29uZHMnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgdHlwZTogJ21ldHJpYycsXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgaGVpZ2h0OiA4LFxuICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgdmlldzogJ3RpbWVTZXJpZXMnLFxuICAgICAgICAgIHN0YWNrZWQ6IGZhbHNlLFxuICAgICAgICAgIG1ldHJpY3M6IF8uZmxhdE1hcChjaGFpbnMsIChjaGFpbklkKSA9PiBbXG4gICAgICAgICAgICBbXG4gICAgICAgICAgICAgIE5BTUVTUEFDRSxcbiAgICAgICAgICAgICAgYEdFVF9RVU9URV9MQVRFTkNZX0NIQUlOXyR7Y2hhaW5JZH1gLFxuICAgICAgICAgICAgICAnU2VydmljZScsXG4gICAgICAgICAgICAgICdSb3V0aW5nQVBJJyxcbiAgICAgICAgICAgICAgeyBzdGF0OiAncDUwJywgbGFiZWw6IGAke0lEX1RPX05FVFdPUktfTkFNRShjaGFpbklkKX0gTWVkaWFuYCB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIFsnLi4uJywgeyBzdGF0OiAnQXZlcmFnZScsIGxhYmVsOiBgJHtJRF9UT19ORVRXT1JLX05BTUUoY2hhaW5JZCl9IEF2ZXJhZ2VgIH1dLFxuICAgICAgICAgIF0pLFxuICAgICAgICAgIHJlZ2lvbixcbiAgICAgICAgICB0aXRsZTogYEF2ZXJhZ2UgYW5kIE1lZGlhbiBMYXRlbmN5IGJ5IENoYWluYCxcbiAgICAgICAgICBwZXJpb2Q6IDMwMCxcbiAgICAgICAgICBzZXRQZXJpb2RUb1RpbWVSYW5nZTogdHJ1ZSxcbiAgICAgICAgICBzdGF0OiAnU2FtcGxlQ291bnQnLFxuICAgICAgICAgIHlBeGlzOiB7XG4gICAgICAgICAgICBsZWZ0OiB7XG4gICAgICAgICAgICAgIG1pbjogMCxcbiAgICAgICAgICAgICAgc2hvd1VuaXRzOiBmYWxzZSxcbiAgICAgICAgICAgICAgbGFiZWw6ICdNaWxsaXNlY29uZHMnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgdHlwZTogJ21ldHJpYycsXG4gICAgICAgIHdpZHRoOiAxMixcbiAgICAgICAgaGVpZ2h0OiA4LFxuICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgdmlldzogJ3RpbWVTZXJpZXMnLFxuICAgICAgICAgIHN0YWNrZWQ6IGZhbHNlLFxuICAgICAgICAgIG1ldHJpY3M6IF8uZmxhdE1hcChjaGFpbnMsIChjaGFpbklkKSA9PiBbXG4gICAgICAgICAgICBbXG4gICAgICAgICAgICAgIE5BTUVTUEFDRSxcbiAgICAgICAgICAgICAgYEdFVF9RVU9URV9MQVRFTkNZX0NIQUlOXyR7Y2hhaW5JZH1gLFxuICAgICAgICAgICAgICAnU2VydmljZScsXG4gICAgICAgICAgICAgICdSb3V0aW5nQVBJJyxcbiAgICAgICAgICAgICAgeyBzdGF0OiAnTWluaW11bScsIGxhYmVsOiBgJHtJRF9UT19ORVRXT1JLX05BTUUoY2hhaW5JZCl9IE1pbmltdW1gIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIF0pLFxuICAgICAgICAgIHJlZ2lvbixcbiAgICAgICAgICB0aXRsZTogYE1pbmltdW0gTGF0ZW5jeSBieSBDaGFpbmAsXG4gICAgICAgICAgcGVyaW9kOiAzMDAsXG4gICAgICAgICAgc2V0UGVyaW9kVG9UaW1lUmFuZ2U6IHRydWUsXG4gICAgICAgICAgc3RhdDogJ1NhbXBsZUNvdW50JyxcbiAgICAgICAgICB5QXhpczoge1xuICAgICAgICAgICAgbGVmdDoge1xuICAgICAgICAgICAgICBtaW46IDAsXG4gICAgICAgICAgICAgIHNob3dVbml0czogZmFsc2UsXG4gICAgICAgICAgICAgIGxhYmVsOiAnTWlsbGlzZWNvbmRzJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGhlaWdodDogOCxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICB0eXBlOiAnbWV0cmljJyxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgIG1ldHJpY3M6IF8uZmxhdE1hcChjaGFpbnMsIChjaGFpbklkKSA9PiBbXG4gICAgICAgICAgICBbXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBleHByZXNzaW9uOiBgKG0yMDBjJHtjaGFpbklkfSAvIChtcmVxYyR7Y2hhaW5JZH0gLSBtNDAwYyR7Y2hhaW5JZH0pKSAqIDEwMGAsXG4gICAgICAgICAgICAgICAgbGFiZWw6IGBTdWNjZXNzIFJhdGUgb24gJHtJRF9UT19ORVRXT1JLX05BTUUoY2hhaW5JZCl9YCxcbiAgICAgICAgICAgICAgICBpZDogYGUxYyR7Y2hhaW5JZH1gLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIFtcbiAgICAgICAgICAgICAgTkFNRVNQQUNFLFxuICAgICAgICAgICAgICBgR0VUX1FVT1RFX1JFUVVFU1RFRF9DSEFJTklEOiAke2NoYWluSWR9YCxcbiAgICAgICAgICAgICAgJ1NlcnZpY2UnLFxuICAgICAgICAgICAgICAnUm91dGluZ0FQSScsXG4gICAgICAgICAgICAgIHsgaWQ6IGBtcmVxYyR7Y2hhaW5JZH1gLCBsYWJlbDogYFJlcXVlc3RzIG9uIENoYWluICR7Y2hhaW5JZH1gLCB2aXNpYmxlOiBmYWxzZSB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIFtcbiAgICAgICAgICAgICAgJy4nLFxuICAgICAgICAgICAgICBgR0VUX1FVT1RFXzIwMF9DSEFJTklEOiAke2NoYWluSWR9YCxcbiAgICAgICAgICAgICAgJy4nLFxuICAgICAgICAgICAgICAnLicsXG4gICAgICAgICAgICAgIHsgaWQ6IGBtMjAwYyR7Y2hhaW5JZH1gLCBsYWJlbDogYDJYWCBSZXF1ZXN0cyBvbiBDaGFpbiAke2NoYWluSWR9YCwgdmlzaWJsZTogZmFsc2UgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBbXG4gICAgICAgICAgICAgICcuJyxcbiAgICAgICAgICAgICAgYEdFVF9RVU9URV80MDBfQ0hBSU5JRDogJHtjaGFpbklkfWAsXG4gICAgICAgICAgICAgICcuJyxcbiAgICAgICAgICAgICAgJy4nLFxuICAgICAgICAgICAgICB7IGlkOiBgbTQwMGMke2NoYWluSWR9YCwgbGFiZWw6IGA0WFggRXJyb3JzIG9uIENoYWluICR7Y2hhaW5JZH1gLCB2aXNpYmxlOiBmYWxzZSB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICBdKSxcbiAgICAgICAgICB2aWV3OiAndGltZVNlcmllcycsXG4gICAgICAgICAgc3RhY2tlZDogZmFsc2UsXG4gICAgICAgICAgcmVnaW9uLFxuICAgICAgICAgIHN0YXQ6ICdTdW0nLFxuICAgICAgICAgIHBlcmlvZDogMzAwLFxuICAgICAgICAgIHRpdGxlOiAnU3VjY2VzcyBSYXRlcyBieSBDaGFpbicsXG4gICAgICAgICAgc2V0UGVyaW9kVG9UaW1lUmFuZ2U6IHRydWUsXG4gICAgICAgICAgeUF4aXM6IHtcbiAgICAgICAgICAgIGxlZnQ6IHtcbiAgICAgICAgICAgICAgc2hvd1VuaXRzOiBmYWxzZSxcbiAgICAgICAgICAgICAgbGFiZWw6ICclJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGhlaWdodDogOCxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICB0eXBlOiAnbWV0cmljJyxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgIG1ldHJpY3M6IF8uZmxhdE1hcChjaGFpbnMsIChjaGFpbklkKSA9PiBbXG4gICAgICAgICAgICBbXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBleHByZXNzaW9uOiBgKG0yMDBjJHtjaGFpbklkfSAvIG1yZXFjJHtjaGFpbklkfSkgKiAxMDBgLFxuICAgICAgICAgICAgICAgIGxhYmVsOiBgU3VjY2VzcyBSYXRlICh3LiA0WFgpIG9uICR7SURfVE9fTkVUV09SS19OQU1FKGNoYWluSWQpfWAsXG4gICAgICAgICAgICAgICAgaWQ6IGBlMWMke2NoYWluSWR9YCxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBbXG4gICAgICAgICAgICAgIE5BTUVTUEFDRSxcbiAgICAgICAgICAgICAgYEdFVF9RVU9URV9SRVFVRVNURURfQ0hBSU5JRDogJHtjaGFpbklkfWAsXG4gICAgICAgICAgICAgICdTZXJ2aWNlJyxcbiAgICAgICAgICAgICAgJ1JvdXRpbmdBUEknLFxuICAgICAgICAgICAgICB7IGlkOiBgbXJlcWMke2NoYWluSWR9YCwgbGFiZWw6IGBSZXF1ZXN0cyBvbiBDaGFpbiAke2NoYWluSWR9YCwgdmlzaWJsZTogZmFsc2UgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBbXG4gICAgICAgICAgICAgICcuJyxcbiAgICAgICAgICAgICAgYEdFVF9RVU9URV8yMDBfQ0hBSU5JRDogJHtjaGFpbklkfWAsXG4gICAgICAgICAgICAgICcuJyxcbiAgICAgICAgICAgICAgJy4nLFxuICAgICAgICAgICAgICB7IGlkOiBgbTIwMGMke2NoYWluSWR9YCwgbGFiZWw6IGAyWFggUmVxdWVzdHMgb24gQ2hhaW4gJHtjaGFpbklkfWAsIHZpc2libGU6IGZhbHNlIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIF0pLFxuICAgICAgICAgIHZpZXc6ICd0aW1lU2VyaWVzJyxcbiAgICAgICAgICBzdGFja2VkOiBmYWxzZSxcbiAgICAgICAgICByZWdpb24sXG4gICAgICAgICAgc3RhdDogJ1N1bScsXG4gICAgICAgICAgcGVyaW9kOiAzMDAsXG4gICAgICAgICAgdGl0bGU6ICdTdWNjZXNzIFJhdGVzICh3LiA0WFgpIGJ5IENoYWluJyxcbiAgICAgICAgICBzZXRQZXJpb2RUb1RpbWVSYW5nZTogdHJ1ZSxcbiAgICAgICAgICB5QXhpczoge1xuICAgICAgICAgICAgbGVmdDoge1xuICAgICAgICAgICAgICBzaG93VW5pdHM6IGZhbHNlLFxuICAgICAgICAgICAgICBsYWJlbDogJyUnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIHtcbiAgICAgICAgaGVpZ2h0OiA4LFxuICAgICAgICB3aWR0aDogMTIsXG4gICAgICAgIHR5cGU6ICdtZXRyaWMnLFxuICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgbWV0cmljczogXy5mbGF0TWFwKGNoYWlucywgKGNoYWluSWQpID0+IFtcbiAgICAgICAgICAgIFtcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIGV4cHJlc3Npb246IGAobTUwMGMke2NoYWluSWR9IC8gbXJlcWMke2NoYWluSWR9KSAqIDEwMGAsXG4gICAgICAgICAgICAgICAgbGFiZWw6IGA1WFggRXJyb3IgUmF0ZSBvbiAke0lEX1RPX05FVFdPUktfTkFNRShjaGFpbklkKX1gLFxuICAgICAgICAgICAgICAgIGlkOiBgZTFjJHtjaGFpbklkfWAsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgW1xuICAgICAgICAgICAgICBOQU1FU1BBQ0UsXG4gICAgICAgICAgICAgIGBHRVRfUVVPVEVfUkVRVUVTVEVEX0NIQUlOSUQ6ICR7Y2hhaW5JZH1gLFxuICAgICAgICAgICAgICAnU2VydmljZScsXG4gICAgICAgICAgICAgICdSb3V0aW5nQVBJJyxcbiAgICAgICAgICAgICAgeyBpZDogYG1yZXFjJHtjaGFpbklkfWAsIGxhYmVsOiBgUmVxdWVzdHMgb24gQ2hhaW4gJHtjaGFpbklkfWAsIHZpc2libGU6IGZhbHNlIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgICAgW1xuICAgICAgICAgICAgICAnLicsXG4gICAgICAgICAgICAgIGBHRVRfUVVPVEVfNTAwX0NIQUlOSUQ6ICR7Y2hhaW5JZH1gLFxuICAgICAgICAgICAgICAnLicsXG4gICAgICAgICAgICAgICcuJyxcbiAgICAgICAgICAgICAgeyBpZDogYG01MDBjJHtjaGFpbklkfWAsIGxhYmVsOiBgNVhYIEVycm9ycyBvbiBDaGFpbiAke2NoYWluSWR9YCwgdmlzaWJsZTogZmFsc2UgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgXSksXG4gICAgICAgICAgdmlldzogJ3RpbWVTZXJpZXMnLFxuICAgICAgICAgIHN0YWNrZWQ6IGZhbHNlLFxuICAgICAgICAgIHJlZ2lvbixcbiAgICAgICAgICBzdGF0OiAnU3VtJyxcbiAgICAgICAgICBwZXJpb2Q6IDMwMCxcbiAgICAgICAgICB0aXRsZTogJzVYWCBFcnJvciBSYXRlcyBieSBDaGFpbicsXG4gICAgICAgICAgc2V0UGVyaW9kVG9UaW1lUmFuZ2U6IHRydWUsXG4gICAgICAgICAgeUF4aXM6IHtcbiAgICAgICAgICAgIGxlZnQ6IHtcbiAgICAgICAgICAgICAgc2hvd1VuaXRzOiBmYWxzZSxcbiAgICAgICAgICAgICAgbGFiZWw6ICclJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIH0sXG4gICAgICB7XG4gICAgICAgIGhlaWdodDogOCxcbiAgICAgICAgd2lkdGg6IDEyLFxuICAgICAgICB0eXBlOiAnbWV0cmljJyxcbiAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgIG1ldHJpY3M6IF8uZmxhdE1hcChjaGFpbnMsIChjaGFpbklkKSA9PiBbXG4gICAgICAgICAgICBbXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICBleHByZXNzaW9uOiBgKG00MDBjJHtjaGFpbklkfSAvIG1yZXFjJHtjaGFpbklkfSkgKiAxMDBgLFxuICAgICAgICAgICAgICAgIGxhYmVsOiBgNFhYIEVycm9yIFJhdGUgb24gJHtJRF9UT19ORVRXT1JLX05BTUUoY2hhaW5JZCl9YCxcbiAgICAgICAgICAgICAgICBpZDogYGUyYyR7Y2hhaW5JZH1gLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIFtcbiAgICAgICAgICAgICAgTkFNRVNQQUNFLFxuICAgICAgICAgICAgICBgR0VUX1FVT1RFX1JFUVVFU1RFRF9DSEFJTklEOiAke2NoYWluSWR9YCxcbiAgICAgICAgICAgICAgJ1NlcnZpY2UnLFxuICAgICAgICAgICAgICAnUm91dGluZ0FQSScsXG4gICAgICAgICAgICAgIHsgaWQ6IGBtcmVxYyR7Y2hhaW5JZH1gLCBsYWJlbDogYFJlcXVlc3RzIG9uIENoYWluICR7Y2hhaW5JZH1gLCB2aXNpYmxlOiBmYWxzZSB9LFxuICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIFtcbiAgICAgICAgICAgICAgJy4nLFxuICAgICAgICAgICAgICBgR0VUX1FVT1RFXzQwMF9DSEFJTklEOiAke2NoYWluSWR9YCxcbiAgICAgICAgICAgICAgJy4nLFxuICAgICAgICAgICAgICAnLicsXG4gICAgICAgICAgICAgIHsgaWQ6IGBtNDAwYyR7Y2hhaW5JZH1gLCBsYWJlbDogYDRYWCBFcnJvcnMgb24gQ2hhaW4gJHtjaGFpbklkfWAsIHZpc2libGU6IGZhbHNlIH0sXG4gICAgICAgICAgICBdLFxuICAgICAgICAgIF0pLFxuICAgICAgICAgIHZpZXc6ICd0aW1lU2VyaWVzJyxcbiAgICAgICAgICBzdGFja2VkOiBmYWxzZSxcbiAgICAgICAgICByZWdpb24sXG4gICAgICAgICAgc3RhdDogJ1N1bScsXG4gICAgICAgICAgcGVyaW9kOiAzMDAsXG4gICAgICAgICAgdGl0bGU6ICc0WFggRXJyb3IgUmF0ZXMgYnkgQ2hhaW4nLFxuICAgICAgICAgIHNldFBlcmlvZFRvVGltZVJhbmdlOiB0cnVlLFxuICAgICAgICAgIHlBeGlzOiB7XG4gICAgICAgICAgICBsZWZ0OiB7XG4gICAgICAgICAgICAgIHNob3dVbml0czogZmFsc2UsXG4gICAgICAgICAgICAgIGxhYmVsOiAnJScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIF0pXG5cbiAgICBuZXcgYXdzX2Nsb3Vkd2F0Y2guQ2ZuRGFzaGJvYXJkKHRoaXMsICdSb3V0aW5nQVBJRGFzaGJvYXJkJywge1xuICAgICAgZGFzaGJvYXJkTmFtZTogYFJvdXRpbmdEYXNoYm9hcmRgLFxuICAgICAgZGFzaGJvYXJkQm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBwZXJpb2RPdmVycmlkZTogJ2luaGVyaXQnLFxuICAgICAgICB3aWRnZXRzOiBwZXJDaGFpbldpZGdldHNGb3JSb3V0aW5nRGFzaGJvYXJkLmNvbmNhdChbXG4gICAgICAgICAge1xuICAgICAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgICAgICAgd2lkdGg6IDI0LFxuICAgICAgICAgICAgdHlwZTogJ21ldHJpYycsXG4gICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIG1ldHJpY3M6IFtcbiAgICAgICAgICAgICAgICBbJ0FXUy9BcGlHYXRld2F5JywgJ0NvdW50JywgJ0FwaU5hbWUnLCBhcGlOYW1lLCB7IGxhYmVsOiAnUmVxdWVzdHMnIH1dLFxuICAgICAgICAgICAgICAgIFsnLicsICc1WFhFcnJvcicsICcuJywgJy4nLCB7IGxhYmVsOiAnNVhYRXJyb3IgUmVzcG9uc2VzJywgY29sb3I6ICcjZmY3ZjBlJyB9XSxcbiAgICAgICAgICAgICAgICBbJy4nLCAnNFhYRXJyb3InLCAnLicsICcuJywgeyBsYWJlbDogJzRYWEVycm9yIFJlc3BvbnNlcycsIGNvbG9yOiAnIzJjYTAyYycgfV0sXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIHZpZXc6ICd0aW1lU2VyaWVzJyxcbiAgICAgICAgICAgICAgc3RhY2tlZDogZmFsc2UsXG4gICAgICAgICAgICAgIHJlZ2lvbixcbiAgICAgICAgICAgICAgc3RhdDogJ1N1bScsXG4gICAgICAgICAgICAgIHBlcmlvZDogMzAwLFxuICAgICAgICAgICAgICB0aXRsZTogJ1RvdGFsIFJlcXVlc3RzL1Jlc3BvbnNlcycsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgICAgICAgd2lkdGg6IDI0LFxuICAgICAgICAgICAgdHlwZTogJ21ldHJpYycsXG4gICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIG1ldHJpY3M6IFtcbiAgICAgICAgICAgICAgICBbXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIGV4cHJlc3Npb246ICdtMSAqIDEwMCcsXG4gICAgICAgICAgICAgICAgICAgIGxhYmVsOiAnNVhYIEVycm9yIFJhdGUnLFxuICAgICAgICAgICAgICAgICAgICBpZDogJ2UxJyxcbiAgICAgICAgICAgICAgICAgICAgY29sb3I6ICcjZmY3ZjBlJyxcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICBbXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIGV4cHJlc3Npb246ICdtMiAqIDEwMCcsXG4gICAgICAgICAgICAgICAgICAgIGxhYmVsOiAnNFhYIEVycm9yIFJhdGUnLFxuICAgICAgICAgICAgICAgICAgICBpZDogJ2UyJyxcbiAgICAgICAgICAgICAgICAgICAgY29sb3I6ICcjMmNhMDJjJyxcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgICBbXG4gICAgICAgICAgICAgICAgICAnQVdTL0FwaUdhdGV3YXknLFxuICAgICAgICAgICAgICAgICAgJzVYWEVycm9yJyxcbiAgICAgICAgICAgICAgICAgICdBcGlOYW1lJyxcbiAgICAgICAgICAgICAgICAgICdSb3V0aW5nIEFQSScsXG4gICAgICAgICAgICAgICAgICB7IGlkOiAnbTEnLCBsYWJlbDogJzVYWEVycm9yJywgdmlzaWJsZTogZmFsc2UgfSxcbiAgICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICAgIFsnLicsICc0WFhFcnJvcicsICcuJywgJy4nLCB7IGlkOiAnbTInLCB2aXNpYmxlOiBmYWxzZSB9XSxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgdmlldzogJ3RpbWVTZXJpZXMnLFxuICAgICAgICAgICAgICBzdGFja2VkOiBmYWxzZSxcbiAgICAgICAgICAgICAgcmVnaW9uLFxuICAgICAgICAgICAgICBzdGF0OiAnQXZlcmFnZScsXG4gICAgICAgICAgICAgIHBlcmlvZDogMzAwLFxuICAgICAgICAgICAgICB0aXRsZTogJzVYWC80WFggRXJyb3IgUmF0ZXMnLFxuICAgICAgICAgICAgICBzZXRQZXJpb2RUb1RpbWVSYW5nZTogdHJ1ZSxcbiAgICAgICAgICAgICAgeUF4aXM6IHtcbiAgICAgICAgICAgICAgICBsZWZ0OiB7XG4gICAgICAgICAgICAgICAgICBzaG93VW5pdHM6IGZhbHNlLFxuICAgICAgICAgICAgICAgICAgbGFiZWw6ICclJyxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGhlaWdodDogNixcbiAgICAgICAgICAgIHdpZHRoOiAyNCxcbiAgICAgICAgICAgIHR5cGU6ICdtZXRyaWMnLFxuICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICBtZXRyaWNzOiBbWydBV1MvQXBpR2F0ZXdheScsICdMYXRlbmN5JywgJ0FwaU5hbWUnLCBhcGlOYW1lXV0sXG4gICAgICAgICAgICAgIHZpZXc6ICd0aW1lU2VyaWVzJyxcbiAgICAgICAgICAgICAgc3RhY2tlZDogZmFsc2UsXG4gICAgICAgICAgICAgIHJlZ2lvbixcbiAgICAgICAgICAgICAgcGVyaW9kOiAzMDAsXG4gICAgICAgICAgICAgIHN0YXQ6ICdwOTAnLFxuICAgICAgICAgICAgICB0aXRsZTogJ0xhdGVuY3kgcDkwJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAnbWV0cmljJyxcbiAgICAgICAgICAgIHdpZHRoOiAyNCxcbiAgICAgICAgICAgIGhlaWdodDogNixcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgdmlldzogJ3RpbWVTZXJpZXMnLFxuICAgICAgICAgICAgICBzdGFja2VkOiBmYWxzZSxcbiAgICAgICAgICAgICAgbWV0cmljczogW1xuICAgICAgICAgICAgICAgIFtOQU1FU1BBQ0UsICdRdW90ZXNGZXRjaGVkJywgJ1NlcnZpY2UnLCAnUm91dGluZ0FQSSddLFxuICAgICAgICAgICAgICAgIFtOQU1FU1BBQ0UsICdWM1F1b3Rlc0ZldGNoZWQnLCAnU2VydmljZScsICdSb3V0aW5nQVBJJ10sXG4gICAgICAgICAgICAgICAgW05BTUVTUEFDRSwgJ1YyUXVvdGVzRmV0Y2hlZCcsICdTZXJ2aWNlJywgJ1JvdXRpbmdBUEknXSxcbiAgICAgICAgICAgICAgICBbTkFNRVNQQUNFLCAnTWl4ZWRRdW90ZXNGZXRjaGVkJywgJ1NlcnZpY2UnLCAnUm91dGluZ0FQSSddLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICByZWdpb24sXG4gICAgICAgICAgICAgIHRpdGxlOiAncDkwIFF1b3RlcyBGZXRjaGVkIFBlciBTd2FwJyxcbiAgICAgICAgICAgICAgcGVyaW9kOiAzMDAsXG4gICAgICAgICAgICAgIHN0YXQ6ICdwOTAnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHR5cGU6ICdtZXRyaWMnLFxuICAgICAgICAgICAgd2lkdGg6IDI0LFxuICAgICAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICB2aWV3OiAndGltZVNlcmllcycsXG4gICAgICAgICAgICAgIHN0YWNrZWQ6IGZhbHNlLFxuICAgICAgICAgICAgICBpbnNpZ2h0UnVsZToge1xuICAgICAgICAgICAgICAgIG1heENvbnRyaWJ1dG9yQ291bnQ6IDI1LFxuICAgICAgICAgICAgICAgIG9yZGVyQnk6ICdTdW0nLFxuICAgICAgICAgICAgICAgIHJ1bGVOYW1lOiBSRVFVRVNURURfUVVPVEVTX1JVTEVfTkFNRSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgbGVnZW5kOiB7XG4gICAgICAgICAgICAgICAgcG9zaXRpb246ICdib3R0b20nLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICByZWdpb24sXG4gICAgICAgICAgICAgIHRpdGxlOiAnUmVxdWVzdGVkIFF1b3RlcycsXG4gICAgICAgICAgICAgIHBlcmlvZDogMzAwLFxuICAgICAgICAgICAgICBzdGF0OiAnU3VtJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAnbWV0cmljJyxcbiAgICAgICAgICAgIHdpZHRoOiAyNCxcbiAgICAgICAgICAgIGhlaWdodDogNixcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgdmlldzogJ3RpbWVTZXJpZXMnLFxuICAgICAgICAgICAgICBzdGFja2VkOiBmYWxzZSxcbiAgICAgICAgICAgICAgaW5zaWdodFJ1bGU6IHtcbiAgICAgICAgICAgICAgICBtYXhDb250cmlidXRvckNvdW50OiAyNSxcbiAgICAgICAgICAgICAgICBvcmRlckJ5OiAnU3VtJyxcbiAgICAgICAgICAgICAgICBydWxlTmFtZTogUkVRVUVTVEVEX1FVT1RFU19CWV9DSEFJTl9SVUxFX05BTUUsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIGxlZ2VuZDoge1xuICAgICAgICAgICAgICAgIHBvc2l0aW9uOiAnYm90dG9tJyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgcmVnaW9uLFxuICAgICAgICAgICAgICB0aXRsZTogJ1JlcXVlc3RlZCBRdW90ZXMgQnkgQ2hhaW4nLFxuICAgICAgICAgICAgICBwZXJpb2Q6IDMwMCxcbiAgICAgICAgICAgICAgc3RhdDogJ1N1bScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgdHlwZTogJ21ldHJpYycsXG4gICAgICAgICAgICB3aWR0aDogMjQsXG4gICAgICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIHZpZXc6ICd0aW1lU2VyaWVzJyxcbiAgICAgICAgICAgICAgc3RhY2tlZDogZmFsc2UsXG4gICAgICAgICAgICAgIG1ldHJpY3M6IFtcbiAgICAgICAgICAgICAgICBbTkFNRVNQQUNFLCAnTWl4ZWRBbmRWM0FuZFYyU3BsaXRSb3V0ZScsICdTZXJ2aWNlJywgJ1JvdXRpbmdBUEknXSxcbiAgICAgICAgICAgICAgICBbTkFNRVNQQUNFLCAnTWl4ZWRBbmRWM1NwbGl0Um91dGUnLCAnU2VydmljZScsICdSb3V0aW5nQVBJJ10sXG4gICAgICAgICAgICAgICAgW05BTUVTUEFDRSwgJ01peGVkQW5kVjJTcGxpdFJvdXRlJywgJ1NlcnZpY2UnLCAnUm91dGluZ0FQSSddLFxuICAgICAgICAgICAgICAgIFtOQU1FU1BBQ0UsICdNaXhlZFNwbGl0Um91dGUnLCAnU2VydmljZScsICdSb3V0aW5nQVBJJ10sXG4gICAgICAgICAgICAgICAgW05BTUVTUEFDRSwgJ01peGVkUm91dGUnLCAnU2VydmljZScsICdSb3V0aW5nQVBJJ10sXG4gICAgICAgICAgICAgICAgW05BTUVTUEFDRSwgJ1YzQW5kVjJTcGxpdFJvdXRlJywgJ1NlcnZpY2UnLCAnUm91dGluZ0FQSSddLFxuICAgICAgICAgICAgICAgIFtOQU1FU1BBQ0UsICdWM1NwbGl0Um91dGUnLCAnU2VydmljZScsICdSb3V0aW5nQVBJJ10sXG4gICAgICAgICAgICAgICAgW05BTUVTUEFDRSwgJ1YzUm91dGUnLCAnU2VydmljZScsICdSb3V0aW5nQVBJJ10sXG4gICAgICAgICAgICAgICAgW05BTUVTUEFDRSwgJ1YyU3BsaXRSb3V0ZScsICdTZXJ2aWNlJywgJ1JvdXRpbmdBUEknXSxcbiAgICAgICAgICAgICAgICBbTkFNRVNQQUNFLCAnVjJSb3V0ZScsICdTZXJ2aWNlJywgJ1JvdXRpbmdBUEknXSxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgcmVnaW9uLFxuICAgICAgICAgICAgICB0aXRsZTogJ1R5cGVzIG9mIHJvdXRlcyByZXR1cm5lZCBhY3Jvc3MgYWxsIGNoYWlucycsXG4gICAgICAgICAgICAgIHBlcmlvZDogMzAwLFxuICAgICAgICAgICAgICBzdGF0OiAnU3VtJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAnbWV0cmljJyxcbiAgICAgICAgICAgIHdpZHRoOiAyNCxcbiAgICAgICAgICAgIGhlaWdodDogNixcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgdmlldzogJ3RpbWVTZXJpZXMnLFxuICAgICAgICAgICAgICBzdGFja2VkOiBmYWxzZSxcbiAgICAgICAgICAgICAgbWV0cmljczogXy5mbGF0TWFwKFNVUFBPUlRFRF9DSEFJTlMsIChjaGFpbklkOiBDaGFpbklkKSA9PiBbXG4gICAgICAgICAgICAgICAgW05BTUVTUEFDRSwgYE1peGVkQW5kVjNBbmRWMlNwbGl0Um91dGVGb3JDaGFpbiR7Y2hhaW5JZH1gLCAnU2VydmljZScsICdSb3V0aW5nQVBJJ10sXG4gICAgICAgICAgICAgICAgW05BTUVTUEFDRSwgYE1peGVkQW5kVjNTcGxpdFJvdXRlRm9yQ2hhaW4ke2NoYWluSWR9YCwgJ1NlcnZpY2UnLCAnUm91dGluZ0FQSSddLFxuICAgICAgICAgICAgICAgIFtOQU1FU1BBQ0UsIGBNaXhlZEFuZFYyU3BsaXRSb3V0ZUZvckNoYWluJHtjaGFpbklkfWAsICdTZXJ2aWNlJywgJ1JvdXRpbmdBUEknXSxcbiAgICAgICAgICAgICAgICBbTkFNRVNQQUNFLCBgTWl4ZWRTcGxpdFJvdXRlRm9yQ2hhaW4ke2NoYWluSWR9YCwgJ1NlcnZpY2UnLCAnUm91dGluZ0FQSSddLFxuICAgICAgICAgICAgICAgIFtOQU1FU1BBQ0UsIGBNaXhlZFJvdXRlRm9yQ2hhaW4ke2NoYWluSWR9YCwgJ1NlcnZpY2UnLCAnUm91dGluZ0FQSSddLFxuICAgICAgICAgICAgICAgIFtOQU1FU1BBQ0UsIGBWM0FuZFYyU3BsaXRSb3V0ZUZvckNoYWluJHtjaGFpbklkfWAsICdTZXJ2aWNlJywgJ1JvdXRpbmdBUEknXSxcbiAgICAgICAgICAgICAgICBbTkFNRVNQQUNFLCBgVjNTcGxpdFJvdXRlRm9yQ2hhaW4ke2NoYWluSWR9YCwgJ1NlcnZpY2UnLCAnUm91dGluZ0FQSSddLFxuICAgICAgICAgICAgICAgIFtOQU1FU1BBQ0UsIGBWM1JvdXRlRm9yQ2hhaW4ke2NoYWluSWR9YCwgJ1NlcnZpY2UnLCAnUm91dGluZ0FQSSddLFxuICAgICAgICAgICAgICAgIFtOQU1FU1BBQ0UsIGBWMlNwbGl0Um91dGVGb3JDaGFpbiR7Y2hhaW5JZH1gLCAnU2VydmljZScsICdSb3V0aW5nQVBJJ10sXG4gICAgICAgICAgICAgICAgW05BTUVTUEFDRSwgYFYyUm91dGVGb3JDaGFpbiR7Y2hhaW5JZH1gLCAnU2VydmljZScsICdSb3V0aW5nQVBJJ10sXG4gICAgICAgICAgICAgIF0pLFxuICAgICAgICAgICAgICByZWdpb24sXG4gICAgICAgICAgICAgIHRpdGxlOiAnVHlwZXMgb2YgVjMgcm91dGVzIHJldHVybmVkIGJ5IGNoYWluJyxcbiAgICAgICAgICAgICAgcGVyaW9kOiAzMDAsXG4gICAgICAgICAgICAgIHN0YXQ6ICdTdW0nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHR5cGU6ICdtZXRyaWMnLFxuICAgICAgICAgICAgd2lkdGg6IDI0LFxuICAgICAgICAgICAgaGVpZ2h0OiA2LFxuICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICBtZXRyaWNzOiBfLmZsYXRNYXAoU1VQUE9SVEVEX0NIQUlOUywgKGNoYWluSWQ6IENoYWluSWQpID0+IFtcbiAgICAgICAgICAgICAgICBbJ1VuaXN3YXAnLCBgUXVvdGVGb3VuZEZvckNoYWluJHtjaGFpbklkfWAsICdTZXJ2aWNlJywgJ1JvdXRpbmdBUEknXSxcbiAgICAgICAgICAgICAgICBbJ1VuaXN3YXAnLCBgUXVvdGVSZXF1ZXN0ZWRGb3JDaGFpbiR7Y2hhaW5JZH1gLCAnU2VydmljZScsICdSb3V0aW5nQVBJJ10sXG4gICAgICAgICAgICAgIF0pLFxuICAgICAgICAgICAgICB2aWV3OiAndGltZVNlcmllcycsXG4gICAgICAgICAgICAgIHN0YWNrZWQ6IGZhbHNlLFxuICAgICAgICAgICAgICBzdGF0OiAnU3VtJyxcbiAgICAgICAgICAgICAgcGVyaW9kOiAzMDAsXG4gICAgICAgICAgICAgIHJlZ2lvbixcbiAgICAgICAgICAgICAgdGl0bGU6ICdRdW90ZSBSZXF1ZXN0ZWQvRm91bmQgYnkgQ2hhaW4nLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGhlaWdodDogMTIsXG4gICAgICAgICAgICB3aWR0aDogMjQsXG4gICAgICAgICAgICB0eXBlOiAnbWV0cmljJyxcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgbWV0cmljczogW1xuICAgICAgICAgICAgICAgIFtOQU1FU1BBQ0UsICdUb2tlbkxpc3RMb2FkJywgJ1NlcnZpY2UnLCAnUm91dGluZ0FQSScsIHsgY29sb3I6ICcjYzViMGQ1JyB9XSxcbiAgICAgICAgICAgICAgICBbJy4nLCAnR2FzUHJpY2VMb2FkJywgJy4nLCAnLicsIHsgY29sb3I6ICcjMTdiZWNmJyB9XSxcbiAgICAgICAgICAgICAgICBbJy4nLCAnVjNQb29sc0xvYWQnLCAnLicsICcuJywgeyBjb2xvcjogJyNlMzc3YzInIH1dLFxuICAgICAgICAgICAgICAgIFsnLicsICdWMlBvb2xzTG9hZCcsICcuJywgJy4nLCB7IGNvbG9yOiAnI2UzNzdjMicgfV0sXG4gICAgICAgICAgICAgICAgWycuJywgJ1YzU3ViZ3JhcGhQb29sc0xvYWQnLCAnLicsICcuJywgeyBjb2xvcjogJyMxZjc3YjQnIH1dLFxuICAgICAgICAgICAgICAgIFsnLicsICdWMlN1YmdyYXBoUG9vbHNMb2FkJywgJy4nLCAnLicsIHsgY29sb3I6ICcjYmY3N2I0JyB9XSxcbiAgICAgICAgICAgICAgICBbJy4nLCAnVjNRdW90ZXNMb2FkJywgJy4nLCAnLicsIHsgY29sb3I6ICcjMmNhMDJjJyB9XSxcbiAgICAgICAgICAgICAgICBbJy4nLCAnTWl4ZWRRdW90ZXNMb2FkJywgJy4nLCAnLicsIHsgY29sb3I6ICcjZmVmYTYzJyB9XSxcbiAgICAgICAgICAgICAgICBbJy4nLCAnVjJRdW90ZXNMb2FkJywgJy4nLCAnLicsIHsgY29sb3I6ICcjN2Y3ZjdmJyB9XSxcbiAgICAgICAgICAgICAgICBbJy4nLCAnRmluZEJlc3RTd2FwUm91dGUnLCAnLicsICcuJywgeyBjb2xvcjogJyNkNjI3MjgnIH1dLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICB2aWV3OiAndGltZVNlcmllcycsXG4gICAgICAgICAgICAgIHN0YWNrZWQ6IHRydWUsXG4gICAgICAgICAgICAgIHJlZ2lvbixcbiAgICAgICAgICAgICAgc3RhdDogJ3A5MCcsXG4gICAgICAgICAgICAgIHBlcmlvZDogMzAwLFxuICAgICAgICAgICAgICB0aXRsZTogJ0xhdGVuY3kgQnJlYWtkb3duJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAnbWV0cmljJyxcbiAgICAgICAgICAgIHdpZHRoOiAyNCxcbiAgICAgICAgICAgIGhlaWdodDogOSxcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgdmlldzogJ3RpbWVTZXJpZXMnLFxuICAgICAgICAgICAgICBzdGFja2VkOiBmYWxzZSxcbiAgICAgICAgICAgICAgbWV0cmljczogW1xuICAgICAgICAgICAgICAgIFtOQU1FU1BBQ0UsICdWM3RvcDJkaXJlY3Rzd2FwcG9vbCcsICdTZXJ2aWNlJywgJ1JvdXRpbmdBUEknXSxcbiAgICAgICAgICAgICAgICBbJy4nLCAnVjN0b3AyZXRocXVvdGV0b2tlbnBvb2wnLCAnLicsICcuJ10sXG4gICAgICAgICAgICAgICAgWycuJywgJ1YzdG9wYnl0dmwnLCAnLicsICcuJ10sXG4gICAgICAgICAgICAgICAgWycuJywgJ1YzdG9wYnl0dmx1c2luZ3Rva2VuaW4nLCAnLicsICcuJ10sXG4gICAgICAgICAgICAgICAgWycuJywgJ1YzdG9wYnl0dmx1c2luZ3Rva2VuaW5zZWNvbmRob3BzJywgJy4nLCAnLiddLFxuICAgICAgICAgICAgICAgIFsnLicsICdWMnRvcGJ5dHZsdXNpbmd0b2tlbm91dCcsICcuJywgJy4nXSxcbiAgICAgICAgICAgICAgICBbJy4nLCAnVjN0b3BieXR2bHVzaW5ndG9rZW5vdXRzZWNvbmRob3BzJywgJy4nLCAnLiddLFxuICAgICAgICAgICAgICAgIFsnLicsICdWM3RvcGJ5YmFzZXdpdGh0b2tlbmluJywgJy4nLCAnLiddLFxuICAgICAgICAgICAgICAgIFsnLicsICdWM3RvcGJ5YmFzZXdpdGh0b2tlbm91dCcsICcuJywgJy4nXSxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgcmVnaW9uOiByZWdpb24sXG4gICAgICAgICAgICAgIHRpdGxlOiAncDk1IFYzIFRvcCBOIFBvb2xzIFVzZWQgRnJvbSBTb3VyY2VzIGluIEJlc3QgUm91dGUnLFxuICAgICAgICAgICAgICBzdGF0OiAncDk1JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAnbWV0cmljJyxcbiAgICAgICAgICAgIHdpZHRoOiAyNCxcbiAgICAgICAgICAgIGhlaWdodDogOSxcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgdmlldzogJ3RpbWVTZXJpZXMnLFxuICAgICAgICAgICAgICBzdGFja2VkOiBmYWxzZSxcbiAgICAgICAgICAgICAgbWV0cmljczogW1xuICAgICAgICAgICAgICAgIFtOQU1FU1BBQ0UsICdWMnRvcDJkaXJlY3Rzd2FwcG9vbCcsICdTZXJ2aWNlJywgJ1JvdXRpbmdBUEknXSxcbiAgICAgICAgICAgICAgICBbJy4nLCAnVjJ0b3AyZXRocXVvdGV0b2tlbnBvb2wnLCAnLicsICcuJ10sXG4gICAgICAgICAgICAgICAgWycuJywgJ1YydG9wYnl0dmwnLCAnLicsICcuJ10sXG4gICAgICAgICAgICAgICAgWycuJywgJ1YydG9wYnl0dmx1c2luZ3Rva2VuaW4nLCAnLicsICcuJ10sXG4gICAgICAgICAgICAgICAgWycuJywgJ1YydG9wYnl0dmx1c2luZ3Rva2VuaW5zZWNvbmRob3BzJywgJy4nLCAnLiddLFxuICAgICAgICAgICAgICAgIFsnLicsICdWMnRvcGJ5dHZsdXNpbmd0b2tlbm91dCcsICcuJywgJy4nXSxcbiAgICAgICAgICAgICAgICBbJy4nLCAnVjJ0b3BieXR2bHVzaW5ndG9rZW5vdXRzZWNvbmRob3BzJywgJy4nLCAnLiddLFxuICAgICAgICAgICAgICAgIFsnLicsICdWMnRvcGJ5YmFzZXdpdGh0b2tlbmluJywgJy4nLCAnLiddLFxuICAgICAgICAgICAgICAgIFsnLicsICdWMnRvcGJ5YmFzZXdpdGh0b2tlbm91dCcsICcuJywgJy4nXSxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgcmVnaW9uOiByZWdpb24sXG4gICAgICAgICAgICAgIHRpdGxlOiAncDk1IFYyIFRvcCBOIFBvb2xzIFVzZWQgRnJvbSBTb3VyY2VzIGluIEJlc3QgUm91dGUnLFxuICAgICAgICAgICAgICBzdGF0OiAncDk1JyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICB0eXBlOiAnbWV0cmljJyxcbiAgICAgICAgICAgIHdpZHRoOiAyNCxcbiAgICAgICAgICAgIGhlaWdodDogOSxcbiAgICAgICAgICAgIHByb3BlcnRpZXM6IHtcbiAgICAgICAgICAgICAgdmlldzogJ3RpbWVTZXJpZXMnLFxuICAgICAgICAgICAgICBzdGFja2VkOiBmYWxzZSxcbiAgICAgICAgICAgICAgbWV0cmljczogW1xuICAgICAgICAgICAgICAgIFsnQVdTL0xhbWJkYScsICdQcm92aXNpb25lZENvbmN1cnJlbnRFeGVjdXRpb25zJywgJ0Z1bmN0aW9uTmFtZScsIHJvdXRpbmdMYW1iZGFOYW1lXSxcbiAgICAgICAgICAgICAgICBbJy4nLCAnQ29uY3VycmVudEV4ZWN1dGlvbnMnLCAnLicsICcuJ10sXG4gICAgICAgICAgICAgICAgWycuJywgJ1Byb3Zpc2lvbmVkQ29uY3VycmVuY3lTcGlsbG92ZXJJbnZvY2F0aW9ucycsICcuJywgJy4nXSxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgcmVnaW9uOiByZWdpb24sXG4gICAgICAgICAgICAgIHRpdGxlOiAnUm91dGluZyBMYW1iZGEgUHJvdmlzaW9uZWQgQ29uY3VycmVuY3knLFxuICAgICAgICAgICAgICBzdGF0OiAnQXZlcmFnZScsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgdHlwZTogJ21ldHJpYycsXG4gICAgICAgICAgICB3aWR0aDogMjQsXG4gICAgICAgICAgICBoZWlnaHQ6IDksXG4gICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIHZpZXc6ICd0aW1lU2VyaWVzJyxcbiAgICAgICAgICAgICAgc3RhY2tlZDogZmFsc2UsXG4gICAgICAgICAgICAgIG1ldHJpY3M6IFtcbiAgICAgICAgICAgICAgICAuLi5wb29sQ2FjaGVMYW1iZGFNZXRyaWNzLFxuICAgICAgICAgICAgICAgIC4uLihpcGZzUG9vbENhY2hlTGFtYmRhTmFtZVxuICAgICAgICAgICAgICAgICAgPyBbXG4gICAgICAgICAgICAgICAgICAgICAgWydBV1MvTGFtYmRhJywgJ0Vycm9ycycsICdGdW5jdGlvbk5hbWUnLCBpcGZzUG9vbENhY2hlTGFtYmRhTmFtZV0sXG4gICAgICAgICAgICAgICAgICAgICAgWycuJywgJ0ludm9jYXRpb25zJywgJy4nLCAnLiddLFxuICAgICAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgICAgICA6IFtdKSxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgcmVnaW9uOiByZWdpb24sXG4gICAgICAgICAgICAgIHRpdGxlOiAnUG9vbCBDYWNoZSBMYW1iZGEgRXJyb3IvSW52b2NhdGlvbnMnLFxuICAgICAgICAgICAgICBzdGF0OiAnU3VtJyxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSksXG4gICAgICB9KSxcbiAgICB9KVxuXG4gICAgY29uc3QgcXVvdGVBbW91bnRzV2lkZ2V0cyA9IG5ldyBRdW90ZUFtb3VudHNXaWRnZXRzRmFjdG9yeShOQU1FU1BBQ0UsIHJlZ2lvbilcbiAgICBuZXcgYXdzX2Nsb3Vkd2F0Y2guQ2ZuRGFzaGJvYXJkKHRoaXMsICdSb3V0aW5nQVBJVHJhY2tlZFBhaXJzRGFzaGJvYXJkJywge1xuICAgICAgZGFzaGJvYXJkTmFtZTogJ1JvdXRpbmdBUElUcmFja2VkUGFpcnNEYXNoYm9hcmQnLFxuICAgICAgZGFzaGJvYXJkQm9keTogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICBwZXJpb2RPdmVycmlkZTogJ2luaGVyaXQnLFxuICAgICAgICB3aWRnZXRzOiBxdW90ZUFtb3VudHNXaWRnZXRzLmdlbmVyYXRlV2lkZ2V0cygpLFxuICAgICAgfSksXG4gICAgfSlcblxuICAgIGNvbnN0IGNhY2hlZFJvdXRlc1dpZGdldHMgPSBuZXcgQ2FjaGVkUm91dGVzV2lkZ2V0c0ZhY3RvcnkoTkFNRVNQQUNFLCByZWdpb24sIHJvdXRpbmdMYW1iZGFOYW1lKVxuICAgIG5ldyBhd3NfY2xvdWR3YXRjaC5DZm5EYXNoYm9hcmQodGhpcywgJ0NhY2hlZFJvdXRlc1BlcmZvcm1hbmNlRGFzaGJvYXJkJywge1xuICAgICAgZGFzaGJvYXJkTmFtZTogJ0NhY2hlZFJvdXRlc1BlcmZvcm1hbmNlRGFzaGJvYXJkJyxcbiAgICAgIGRhc2hib2FyZEJvZHk6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgcGVyaW9kT3ZlcnJpZGU6ICdpbmhlcml0JyxcbiAgICAgICAgd2lkZ2V0czogY2FjaGVkUm91dGVzV2lkZ2V0cy5nZW5lcmF0ZVdpZGdldHMoKSxcbiAgICAgIH0pLFxuICAgIH0pXG5cbiAgICBuZXcgYXdzX2Nsb3Vkd2F0Y2guQ2ZuRGFzaGJvYXJkKHRoaXMsICdSb3V0aW5nQVBJUXVvdGVQcm92aWRlckRhc2hib2FyZCcsIHtcbiAgICAgIGRhc2hib2FyZE5hbWU6IGBSb3V0aW5nUXVvdGVQcm92aWRlckRhc2hib2FyZGAsXG4gICAgICBkYXNoYm9hcmRCb2R5OiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgIHBlcmlvZE92ZXJyaWRlOiAnaW5oZXJpdCcsXG4gICAgICAgIHdpZGdldHM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBoZWlnaHQ6IDYsXG4gICAgICAgICAgICB3aWR0aDogMjQsXG4gICAgICAgICAgICB5OiAwLFxuICAgICAgICAgICAgeDogMCxcbiAgICAgICAgICAgIHR5cGU6ICdtZXRyaWMnLFxuICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICBtZXRyaWNzOiBbW05BTUVTUEFDRSwgJ1F1b3RlQXBwcm94R2FzVXNlZFBlclN1Y2Nlc3NmdWxDYWxsJywgJ1NlcnZpY2UnLCAnUm91dGluZ0FQSSddXSxcbiAgICAgICAgICAgICAgdmlldzogJ3RpbWVTZXJpZXMnLFxuICAgICAgICAgICAgICBzdGFja2VkOiBmYWxzZSxcbiAgICAgICAgICAgICAgcmVnaW9uLFxuICAgICAgICAgICAgICBzdGF0OiAnQXZlcmFnZScsXG4gICAgICAgICAgICAgIHBlcmlvZDogMzAwLFxuICAgICAgICAgICAgICB0aXRsZTogJ0FwcHJveCBnYXMgdXNlZCBieSBlYWNoIGNhbGwnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGhlaWdodDogNixcbiAgICAgICAgICAgIHdpZHRoOiAyNCxcbiAgICAgICAgICAgIHk6IDYsXG4gICAgICAgICAgICB4OiAwLFxuICAgICAgICAgICAgdHlwZTogJ21ldHJpYycsXG4gICAgICAgICAgICBwcm9wZXJ0aWVzOiB7XG4gICAgICAgICAgICAgIG1ldHJpY3M6IFtcbiAgICAgICAgICAgICAgICBbTkFNRVNQQUNFLCAnUXVvdGVUb3RhbENhbGxzVG9Qcm92aWRlcicsICdTZXJ2aWNlJywgJ1JvdXRpbmdBUEknXSxcbiAgICAgICAgICAgICAgICBbJy4nLCAnUXVvdGVFeHBlY3RlZENhbGxzVG9Qcm92aWRlcicsICcuJywgJy4nXSxcbiAgICAgICAgICAgICAgICBbJy4nLCAnUXVvdGVOdW1SZXRyaWVkQ2FsbHMnLCAnLicsICcuJ10sXG4gICAgICAgICAgICAgICAgWycuJywgJ1F1b3RlTnVtUmV0cnlMb29wcycsICcuJywgJy4nXSxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgdmlldzogJ3RpbWVTZXJpZXMnLFxuICAgICAgICAgICAgICBzdGFja2VkOiBmYWxzZSxcbiAgICAgICAgICAgICAgcmVnaW9uLFxuICAgICAgICAgICAgICBzdGF0OiAnQXZlcmFnZScsXG4gICAgICAgICAgICAgIHBlcmlvZDogMzAwLFxuICAgICAgICAgICAgICB0aXRsZTogJ051bWJlciBvZiByZXRyaWVzIHRvIHByb3ZpZGVyIG5lZWRlZCB0byBnZXQgcXVvdGUnLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGhlaWdodDogNixcbiAgICAgICAgICAgIHdpZHRoOiAyNCxcbiAgICAgICAgICAgIHk6IDEyLFxuICAgICAgICAgICAgeDogMCxcbiAgICAgICAgICAgIHR5cGU6ICdtZXRyaWMnLFxuICAgICAgICAgICAgcHJvcGVydGllczoge1xuICAgICAgICAgICAgICBtZXRyaWNzOiBbXG4gICAgICAgICAgICAgICAgW05BTUVTUEFDRSwgJ1F1b3RlT3V0T2ZHYXNFeGNlcHRpb25SZXRyeScsICdTZXJ2aWNlJywgJ1JvdXRpbmdBUEknXSxcbiAgICAgICAgICAgICAgICBbJy4nLCAnUXVvdGVTdWNjZXNzUmF0ZVJldHJ5JywgJy4nLCAnLiddLFxuICAgICAgICAgICAgICAgIFsnLicsICdRdW90ZUJsb2NrSGVhZGVyTm90Rm91bmRSZXRyeScsICcuJywgJy4nXSxcbiAgICAgICAgICAgICAgICBbJy4nLCAnUXVvdGVUaW1lb3V0UmV0cnknLCAnLicsICcuJ10sXG4gICAgICAgICAgICAgICAgWycuJywgJ1F1b3RlVW5rbm93blJlYXNvblJldHJ5JywgJy4nLCAnLiddLFxuICAgICAgICAgICAgICAgIFsnLicsICdRdW90ZUJsb2NrQ29uZmxpY3RFcnJvclJldHJ5JywgJy4nLCAnLiddLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICB2aWV3OiAndGltZVNlcmllcycsXG4gICAgICAgICAgICAgIHN0YWNrZWQ6IGZhbHNlLFxuICAgICAgICAgICAgICByZWdpb24sXG4gICAgICAgICAgICAgIHBlcmlvZDogMzAwLFxuICAgICAgICAgICAgICBzdGF0OiAnU3VtJyxcbiAgICAgICAgICAgICAgdGl0bGU6ICdOdW1iZXIgb2YgcmVxdWVzdHMgdGhhdCByZXRyaWVkIGluIHRoZSBxdW90ZSBwcm92aWRlcicsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9KSxcbiAgICB9KVxuICB9XG59XG4iXX0=