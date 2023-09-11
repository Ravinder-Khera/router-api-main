import * as cdk from 'aws-cdk-lib';
import * as aws_dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';
export interface RoutingDatabaseStackProps extends cdk.NestedStackProps {
}
export declare const DynamoDBTableProps: {
    CacheRouteDynamoDbTable: {
        Name: string;
        PartitionKeyName: string;
        SortKeyName: string;
    };
    V3PoolsDynamoDbTable: {
        Name: string;
        PartitionKeyName: string;
        SortKeyName: string;
    };
    TTLAttributeName: string;
};
export declare class RoutingDatabaseStack extends cdk.NestedStack {
    readonly cachedRoutesDynamoDb: aws_dynamodb.Table;
    readonly cachedV3PoolsDynamoDb: aws_dynamodb.Table;
    constructor(scope: Construct, name: string, props: RoutingDatabaseStackProps);
}
