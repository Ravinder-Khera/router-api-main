import * as cdk from 'aws-cdk-lib';
import { SecretValue, Stack, Stage } from 'aws-cdk-lib';
import * as chatbot from 'aws-cdk-lib/aws-chatbot';
import { BuildEnvironmentVariableType } from 'aws-cdk-lib/aws-codebuild';
import { PipelineNotificationEvents } from 'aws-cdk-lib/aws-codepipeline';
import * as sm from 'aws-cdk-lib/aws-secretsmanager';
import { CodeBuildStep, CodePipeline, CodePipelineSource } from 'aws-cdk-lib/pipelines';
import dotenv from 'dotenv';
import 'source-map-support/register';
import { SUPPORTED_CHAINS } from '../lib/handlers/injector-sor';
import { STAGE } from '../lib/util/stage';
import { RoutingAPIStack } from './stacks/routing-api-stack';
dotenv.config();
export class RoutingAPIStage extends Stage {
    constructor(scope, id, props) {
        super(scope, id, props);
        const { jsonRpcProviders, provisionedConcurrency, ethGasStationInfoUrl, chatbotSNSArn, stage, internalApiKey, route53Arn, pinata_key, pinata_secret, hosted_zone, tenderlyUser, tenderlyProject, tenderlyAccessKey, } = props;
        const { url } = new RoutingAPIStack(this, 'RoutingAPI', {
            jsonRpcProviders,
            provisionedConcurrency,
            ethGasStationInfoUrl,
            chatbotSNSArn,
            stage,
            internalApiKey,
            route53Arn,
            pinata_key,
            pinata_secret,
            hosted_zone,
            tenderlyUser,
            tenderlyProject,
            tenderlyAccessKey,
        });
        this.url = url;
    }
}
export class RoutingAPIPipeline extends Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        const code = CodePipelineSource.gitHub('Uniswap/routing-api', 'main', {
            authentication: SecretValue.secretsManager('github-token-2'),
        });
        const synthStep = new CodeBuildStep('Synth', {
            input: code,
            buildEnvironment: {
                environmentVariables: {
                    NPM_TOKEN: {
                        value: 'npm-private-repo-access-token',
                        type: BuildEnvironmentVariableType.SECRETS_MANAGER,
                    },
                },
            },
            commands: [
                'echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc && npm ci',
                'npm run build',
                'npx cdk synth',
            ],
        });
        const pipeline = new CodePipeline(this, 'RoutingAPIPipeline', {
            // The pipeline name
            pipelineName: 'RoutingAPI',
            crossAccountKeys: true,
            synth: synthStep,
        });
        // Secrets are stored in secrets manager in the pipeline account. Accounts we deploy to
        // have been granted permissions to access secrets via resource policies.
        const jsonRpcProvidersSecret = sm.Secret.fromSecretAttributes(this, 'RPCProviderUrls', {
            // The main secrets use our Infura RPC urls
            secretCompleteArn: 'arn:aws:secretsmanager:us-east-2:644039819003:secret:routing-api-rpc-urls-json-primary-ixS8mw',
            /*
            The backup secrets mostly use our Alchemy RPC urls
            However Alchemy does not support Rinkeby, Ropsten, and Kovan
            So those chains are set to our Infura RPC urls
            When switching to the backups,
            we must set the multicall chunk size to 50 so that optimism
            does not bug out on Alchemy's end
            */
            //secretCompleteArn: arn:aws:secretsmanager:us-east-2:644039819003:secret:routing-api-rpc-urls-json-backup-D2sWoe
        });
        const tenderlyCreds = sm.Secret.fromSecretAttributes(this, 'TenderlyCreds', {
            secretCompleteArn: 'arn:aws:secretsmanager:us-east-2:644039819003:secret:tenderly-api-wQaI2R',
        });
        const ethGasStationInfoUrl = sm.Secret.fromSecretAttributes(this, 'ETHGasStationUrl', {
            secretCompleteArn: 'arn:aws:secretsmanager:us-east-2:644039819003:secret:eth-gas-station-info-url-ulGncX',
        });
        const pinataApi = sm.Secret.fromSecretAttributes(this, 'PinataAPI', {
            secretCompleteArn: 'arn:aws:secretsmanager:us-east-2:644039819003:secret:pinata-api-key-UVLAfM',
        });
        const route53Arn = sm.Secret.fromSecretAttributes(this, 'Route53Arn', {
            secretCompleteArn: 'arn:aws:secretsmanager:us-east-2:644039819003:secret:Route53Arn-elRmmw',
        });
        const pinataSecret = sm.Secret.fromSecretAttributes(this, 'PinataSecret', {
            secretCompleteArn: 'arn:aws:secretsmanager:us-east-2:644039819003:secret:pinata-secret-svGaPt',
        });
        const hostedZone = sm.Secret.fromSecretAttributes(this, 'HostedZone', {
            secretCompleteArn: 'arn:aws:secretsmanager:us-east-2:644039819003:secret:hosted-zone-JmPDNV',
        });
        const internalApiKey = sm.Secret.fromSecretAttributes(this, 'internal-api-key', {
            secretCompleteArn: 'arn:aws:secretsmanager:us-east-2:644039819003:secret:routing-api-internal-api-key-Z68NmB',
        });
        // Parse AWS Secret
        let jsonRpcProviders = {};
        SUPPORTED_CHAINS.forEach((chainId) => {
            // TODO: Change this to `JSON_RPC_PROVIDER_${}` to be consistent with SOR
            const key = `WEB3_RPC_${chainId}`;
            jsonRpcProviders[key] = jsonRpcProvidersSecret.secretValueFromJson(key).toString();
        });
        // Beta us-east-2
        const betaUsEast2Stage = new RoutingAPIStage(this, 'beta-us-east-2', {
            env: { account: '145079444317', region: 'us-east-2' },
            jsonRpcProviders: jsonRpcProviders,
            internalApiKey: internalApiKey.secretValue.toString(),
            provisionedConcurrency: 100,
            ethGasStationInfoUrl: ethGasStationInfoUrl.secretValue.toString(),
            stage: STAGE.BETA,
            route53Arn: route53Arn.secretValueFromJson('arn').toString(),
            pinata_key: pinataApi.secretValueFromJson('pinata-api-key').toString(),
            pinata_secret: pinataSecret.secretValueFromJson('secret').toString(),
            hosted_zone: hostedZone.secretValueFromJson('zone').toString(),
            tenderlyUser: tenderlyCreds.secretValueFromJson('tenderly-user').toString(),
            tenderlyProject: tenderlyCreds.secretValueFromJson('tenderly-project').toString(),
            tenderlyAccessKey: tenderlyCreds.secretValueFromJson('tenderly-access-key').toString(),
        });
        const betaUsEast2AppStage = pipeline.addStage(betaUsEast2Stage);
        this.addIntegTests(code, betaUsEast2Stage, betaUsEast2AppStage);
        // Prod us-east-2
        const prodUsEast2Stage = new RoutingAPIStage(this, 'prod-us-east-2', {
            env: { account: '606857263320', region: 'us-east-2' },
            jsonRpcProviders: jsonRpcProviders,
            internalApiKey: internalApiKey.secretValue.toString(),
            provisionedConcurrency: 100,
            ethGasStationInfoUrl: ethGasStationInfoUrl.secretValue.toString(),
            chatbotSNSArn: 'arn:aws:sns:us-east-2:644039819003:SlackChatbotTopic',
            stage: STAGE.PROD,
            route53Arn: route53Arn.secretValueFromJson('arn').toString(),
            pinata_key: pinataApi.secretValueFromJson('pinata-api-key').toString(),
            pinata_secret: pinataSecret.secretValueFromJson('secret').toString(),
            hosted_zone: hostedZone.secretValueFromJson('zone').toString(),
            tenderlyUser: tenderlyCreds.secretValueFromJson('tenderly-user').toString(),
            tenderlyProject: tenderlyCreds.secretValueFromJson('tenderly-project').toString(),
            tenderlyAccessKey: tenderlyCreds.secretValueFromJson('tenderly-access-key').toString(),
        });
        const prodUsEast2AppStage = pipeline.addStage(prodUsEast2Stage);
        this.addIntegTests(code, prodUsEast2Stage, prodUsEast2AppStage);
        const slackChannel = chatbot.SlackChannelConfiguration.fromSlackChannelConfigurationArn(this, 'SlackChannel', 'arn:aws:chatbot::644039819003:chat-configuration/slack-channel/eng-ops-slack-chatbot');
        pipeline.buildPipeline();
        pipeline.pipeline.notifyOn('NotifySlack', slackChannel, {
            events: [PipelineNotificationEvents.PIPELINE_EXECUTION_FAILED],
        });
    }
    addIntegTests(sourceArtifact, routingAPIStage, applicationStage) {
        const testAction = new CodeBuildStep(`IntegTests-${routingAPIStage.stageName}`, {
            projectName: `IntegTests-${routingAPIStage.stageName}`,
            input: sourceArtifact,
            envFromCfnOutputs: {
                UNISWAP_ROUTING_API: routingAPIStage.url,
            },
            buildEnvironment: {
                environmentVariables: {
                    NPM_TOKEN: {
                        value: 'npm-private-repo-access-token',
                        type: BuildEnvironmentVariableType.SECRETS_MANAGER,
                    },
                    ARCHIVE_NODE_RPC: {
                        value: 'archive-node-rpc-url-default-kms',
                        type: BuildEnvironmentVariableType.SECRETS_MANAGER,
                    },
                },
            },
            commands: [
                'echo "//registry.npmjs.org/:_authToken=${NPM_TOKEN}" > .npmrc && npm ci',
                'echo "UNISWAP_ROUTING_API=${UNISWAP_ROUTING_API}" > .env',
                'echo "ARCHIVE_NODE_RPC=${ARCHIVE_NODE_RPC}" >> .env',
                'npm install',
                'npm run build',
                'npm run integ-test',
            ],
        });
        applicationStage.addPost(testAction);
    }
}
const app = new cdk.App();
const jsonRpcProviders = {
    WEB3_RPC_1: process.env.JSON_RPC_PROVIDER_1,
    WEB3_RPC_3: process.env.JSON_RPC_PROVIDER_3,
    WEB3_RPC_4: process.env.JSON_RPC_PROVIDER_4,
    WEB3_RPC_5: process.env.JSON_RPC_PROVIDER_5,
    WEB3_RPC_42: process.env.JSON_RPC_PROVIDER_42,
    WEB3_RPC_10: process.env.JSON_RPC_PROVIDER_10,
    WEB3_RPC_69: process.env.JSON_RPC_PROVIDER_69,
    WEB3_RPC_42161: process.env.JSON_RPC_PROVIDER_42161,
    WEB3_RPC_421611: process.env.JSON_RPC_PROVIDER_421611,
    WEB3_RPC_11155111: process.env.JSON_RPC_PROVIDER_11155111,
    WEB3_RPC_421613: process.env.JSON_RPC_PROVIDER_421613,
    WEB3_RPC_137: process.env.JSON_RPC_PROVIDER_137,
    WEB3_RPC_80001: process.env.JSON_RPC_PROVIDER_80001,
    WEB3_RPC_42220: process.env.JSON_RPC_PROVIDER_42220,
    WEB3_RPC_44787: process.env.JSON_RPC_PROVIDER_44787,
    WEB3_RPC_56: process.env.JSON_RPC_PROVIDER_56,
    WEB3_RPC_43114: process.env.JSON_RPC_PROVIDER_43114,
};
// Local dev stack
new RoutingAPIStack(app, 'RoutingAPIStack', {
    jsonRpcProviders: jsonRpcProviders,
    provisionedConcurrency: process.env.PROVISION_CONCURRENCY ? parseInt(process.env.PROVISION_CONCURRENCY) : 0,
    throttlingOverride: process.env.THROTTLE_PER_FIVE_MINS,
    ethGasStationInfoUrl: process.env.ETH_GAS_STATION_INFO_URL,
    chatbotSNSArn: process.env.CHATBOT_SNS_ARN,
    stage: STAGE.LOCAL,
    internalApiKey: 'test-api-key',
    route53Arn: process.env.ROLE_ARN,
    pinata_key: process.env.PINATA_API_KEY,
    pinata_secret: process.env.PINATA_API_SECRET,
    hosted_zone: process.env.HOSTED_ZONE,
    tenderlyUser: process.env.TENDERLY_USER,
    tenderlyProject: process.env.TENDERLY_PROJECT,
    tenderlyAccessKey: process.env.TENDERLY_ACCESS_KEY,
});
new RoutingAPIPipeline(app, 'RoutingAPIPipelineStack', {
    env: { account: '644039819003', region: 'us-east-2' },
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXBwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vYmluL2FwcC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFDQSxPQUFPLEtBQUssR0FBRyxNQUFNLGFBQWEsQ0FBQTtBQUNsQyxPQUFPLEVBQWEsV0FBVyxFQUFFLEtBQUssRUFBYyxLQUFLLEVBQWMsTUFBTSxhQUFhLENBQUE7QUFDMUYsT0FBTyxLQUFLLE9BQU8sTUFBTSx5QkFBeUIsQ0FBQTtBQUNsRCxPQUFPLEVBQUUsNEJBQTRCLEVBQUUsTUFBTSwyQkFBMkIsQ0FBQTtBQUN4RSxPQUFPLEVBQUUsMEJBQTBCLEVBQUUsTUFBTSw4QkFBOEIsQ0FBQTtBQUN6RSxPQUFPLEtBQUssRUFBRSxNQUFNLGdDQUFnQyxDQUFBO0FBQ3BELE9BQU8sRUFBRSxhQUFhLEVBQUUsWUFBWSxFQUFFLGtCQUFrQixFQUFFLE1BQU0sdUJBQXVCLENBQUE7QUFFdkYsT0FBTyxNQUFNLE1BQU0sUUFBUSxDQUFBO0FBQzNCLE9BQU8sNkJBQTZCLENBQUE7QUFDcEMsT0FBTyxFQUFFLGdCQUFnQixFQUFFLE1BQU0sOEJBQThCLENBQUE7QUFDL0QsT0FBTyxFQUFFLEtBQUssRUFBRSxNQUFNLG1CQUFtQixDQUFBO0FBQ3pDLE9BQU8sRUFBRSxlQUFlLEVBQUUsTUFBTSw0QkFBNEIsQ0FBQTtBQUM1RCxNQUFNLENBQUMsTUFBTSxFQUFFLENBQUE7QUFFZixNQUFNLE9BQU8sZUFBZ0IsU0FBUSxLQUFLO0lBR3hDLFlBQ0UsS0FBZ0IsRUFDaEIsRUFBVSxFQUNWLEtBY0M7UUFFRCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQTtRQUN2QixNQUFNLEVBQ0osZ0JBQWdCLEVBQ2hCLHNCQUFzQixFQUN0QixvQkFBb0IsRUFDcEIsYUFBYSxFQUNiLEtBQUssRUFDTCxjQUFjLEVBQ2QsVUFBVSxFQUNWLFVBQVUsRUFDVixhQUFhLEVBQ2IsV0FBVyxFQUNYLFlBQVksRUFDWixlQUFl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QyxhQUFjO0lBQ3hDLGVBQWUsRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLGdCQUFpQjtJQUM5QyxpQkFBaUIsRUFBRSxPQUFPLENBQUMsR0FBRyxDQUFDLG1CQUFvQjtDQUNwRCxDQUFDLENBQUE7QUFFRixJQUFJLGtCQUFrQixDQUFDLEdBQUcsRUFBRSx5QkFBeUIsRUFBRTtJQUNyRCxHQUFHLEVBQUUsRUFBRSxPQUFPLEVBQUUsY0FBYyxFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUU7Q0FDdEQsQ0FBQyxDQUFBIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ2hhaW5JZCB9IGZyb20gJ0B1bmlzd2FwL3Nkay1jb3JlJ1xuaW1wb3J0ICogYXMgY2RrIGZyb20gJ2F3cy1jZGstbGliJ1xuaW1wb3J0IHsgQ2ZuT3V0cHV0LCBTZWNyZXRWYWx1ZSwgU3RhY2ssIFN0YWNrUHJvcHMsIFN0YWdlLCBTdGFnZVByb3BzIH0gZnJvbSAnYXdzLWNkay1saWInXG5pbXBvcnQgKiBhcyBjaGF0Ym90IGZyb20gJ2F3cy1jZGstbGliL2F3cy1jaGF0Ym90J1xuaW1wb3J0IHsgQnVpbGRFbnZpcm9ubWVudFZhcmlhYmxlVHlwZSB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1jb2RlYnVpbGQnXG5pbXBvcnQgeyBQaXBlbGluZU5vdGlmaWNhdGlvbkV2ZW50cyB9IGZyb20gJ2F3cy1jZGstbGliL2F3cy1jb2RlcGlwZWxpbmUnXG5pbXBvcnQgKiBhcyBzbSBmcm9tICdhd3MtY2RrLWxpYi9hd3Mtc2VjcmV0c21hbmFnZXInXG5pbXBvcnQgeyBDb2RlQnVpbGRTdGVwLCBDb2RlUGlwZWxpbmUsIENvZGVQaXBlbGluZVNvdXJjZSB9IGZyb20gJ2F3cy1jZGstbGliL3BpcGVsaW5lcydcbmltcG9ydCB7IENvbnN0cnVjdCB9IGZyb20gJ2NvbnN0cnVjdHMnXG5pbXBvcnQgZG90ZW52IGZyb20gJ2RvdGVudidcbmltcG9ydCAnc291cmNlLW1hcC1zdXBwb3J0L3JlZ2lzdGVyJ1xuaW1wb3J0IHsgU1VQUE9SVEVEX0NIQUlOUyB9IGZyb20gJy4uL2xpYi9oYW5kbGVycy9pbmplY3Rvci1zb3InXG5pbXBvcnQgeyBTVEFHRSB9IGZyb20gJy4uL2xpYi91dGlsL3N0YWdlJ1xuaW1wb3J0IHsgUm91dGluZ0FQSVN0YWNrIH0gZnJvbSAnLi9zdGFja3Mvcm91dGluZy1hcGktc3RhY2snXG5kb3RlbnYuY29uZmlnKClcblxuZXhwb3J0IGNsYXNzIFJvdXRpbmdBUElTdGFnZSBleHRlbmRzIFN0YWdlIHtcbiAgcHVibGljIHJlYWRvbmx5IHVybDogQ2ZuT3V0cHV0XG5cbiAgY29uc3RydWN0b3IoXG4gICAgc2NvcGU6IENvbnN0cnVjdCxcbiAgICBpZDogc3RyaW5nLFxuICAgIHByb3BzOiBTdGFnZVByb3BzICYge1xuICAgICAganNvblJwY1Byb3ZpZGVyczogeyBbY2hhaW5OYW1lOiBzdHJpbmddOiBzdHJpbmcgfVxuICAgICAgcHJvdmlzaW9uZWRDb25jdXJyZW5jeTogbnVtYmVyXG4gICAgICBldGhHYXNTdGF0aW9uSW5mb1VybDogc3RyaW5nXG4gICAgICBjaGF0Ym90U05TQXJuPzogc3RyaW5nXG4gICAgICBzdGFnZTogc3RyaW5nXG4gICAgICBpbnRlcm5hbEFwaUtleT86IHN0cmluZ1xuICAgICAgcm91dGU1M0Fybj86IHN0cmluZ1xuICAgICAgcGluYXRhX2tleT86IHN0cmluZ1xuICAgICAgcGluYXRhX3NlY3JldD86IHN0cmluZ1xuICAgICAgaG9zdGVkX3pvbmU/OiBzdHJpbmdcbiAgICAgIHRlbmRlcmx5VXNlcjogc3RyaW5nXG4gICAgICB0ZW5kZXJseVByb2plY3Q6IHN0cmluZ1xuICAgICAgdGVuZGVybHlBY2Nlc3NLZXk6IHN0cmluZ1xuICAgIH1cbiAgKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcylcbiAgICBjb25zdCB7XG4gICAgICBqc29uUnBjUHJvdmlkZXJzLFxuICAgICAgcHJvdmlzaW9uZWRDb25jdXJyZW5jeSxcbiAgICAgIGV0aEdhc1N0YXRpb25JbmZvVXJsLFxuICAgICAgY2hhdGJvdFNOU0FybixcbiAgICAgIHN0YWdlLFxuICAgICAgaW50ZXJuYWxBcGlLZXksXG4gICAgICByb3V0ZTUzQXJuLFxuICAgICAgcGluYXRhX2tleSxcbiAgICAgIHBpbmF0YV9zZWNyZXQsXG4gICAgICBob3N0ZWRfem9uZSxcbiAgICAgIHRlbmRlcmx5VXNlcixcbiAgICAgIHRlbmRlcmx5UHJvamVjdCxcbiAgICAgIHRlbmRlcmx5QWNjZXNzS2V5LFxuICAgIH0gPSBwcm9wc1xuXG4gICAgY29uc3QgeyB1cmwgfSA9IG5ldyBSb3V0aW5nQVBJU3RhY2sodGhpcywgJ1JvdXRpbmdBUEknLCB7XG4gICAgICBqc29uUnBjUHJvdmlkZXJzLFxuICAgICAgcHJvdmlzaW9uZWRDb25jdXJyZW5jeSxcbiAgICAgIGV0aEdhc1N0YXRpb25JbmZvVXJsLFxuICAgICAgY2hhdGJvdFNOU0FybixcbiAgICAgIHN0YWdlLFxuICAgICAgaW50ZXJuYWxBcGlLZXksXG4gICAgICByb3V0ZTUzQXJuLFxuICAgICAgcGluYXRhX2tleSxcbiAgICAgIHBpbmF0YV9zZWNyZXQsXG4gICAgICBob3N0ZWRfem9uZSxcbiAgICAgIHRlbmRlcmx5VXNlcixcbiAgICAgIHRlbmRlcmx5UHJvamVjdCxcbiAgICAgIHRlbmRlcmx5QWNjZXNzS2V5LFxuICAgIH0pXG4gICAgdGhpcy51cmwgPSB1cmxcbiAgfVxufVxuXG5leHBvcnQgY2xhc3MgUm91dGluZ0FQSVBpcGVsaW5lIGV4dGVuZHMgU3RhY2sge1xuICBjb25zdHJ1Y3RvcihzY29wZTogQ29uc3RydWN0LCBpZDogc3RyaW5nLCBwcm9wcz86IFN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKVxuXG4gICAgY29uc3QgY29kZSA9IENvZGVQaXBlbGluZVNvdXJjZS5naXRIdWIoJ1VuaXN3YXAvcm91dGluZy1hcGknLCAnbWFpbicsIHtcbiAgICAgIGF1dGhlbnRpY2F0aW9uOiBTZWNyZXRWYWx1ZS5zZWNyZXRzTWFuYWdlcignZ2l0aHViLXRva2VuLTInKSxcbiAgICB9KVxuXG4gICAgY29uc3Qgc3ludGhTdGVwID0gbmV3IENvZGVCdWlsZFN0ZXAoJ1N5bnRoJywge1xuICAgICAgaW5wdXQ6IGNvZGUsXG4gICAgICBidWlsZEVudmlyb25tZW50OiB7XG4gICAgICAgIGVudmlyb25tZW50VmFyaWFibGVzOiB7XG4gICAgICAgICAgTlBNX1RPS0VOOiB7XG4gICAgICAgICAgICB2YWx1ZTogJ25wbS1wcml2YXRlLXJlcG8tYWNjZXNzLXRva2VuJyxcbiAgICAgICAgICAgIHR5cGU6IEJ1aWxkRW52aXJvbm1lbnRWYXJpYWJsZVR5cGUuU0VDUkVUU19NQU5BR0VSLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICAgY29tbWFuZHM6IFtcbiAgICAgICAgJ2VjaG8gXCIvL3JlZ2lzdHJ5Lm5wbWpzLm9yZy86X2F1dGhUb2tlbj0ke05QTV9UT0tFTn1cIiA+IC5ucG1yYyAmJiBucG0gY2knLFxuICAgICAgICAnbnBtIHJ1biBidWlsZCcsXG4gICAgICAgICducHggY2RrIHN5bnRoJyxcbiAgICAgIF0sXG4gICAgfSlcblxuICAgIGNvbnN0IHBpcGVsaW5lID0gbmV3IENvZGVQaXBlbGluZSh0aGlzLCAnUm91dGluZ0FQSVBpcGVsaW5lJywge1xuICAgICAgLy8gVGhlIHBpcGVsaW5lIG5hbWVcbiAgICAgIHBpcGVsaW5lTmFtZTogJ1JvdXRpbmdBUEknLFxuICAgICAgY3Jvc3NBY2NvdW50S2V5czogdHJ1ZSxcbiAgICAgIHN5bnRoOiBzeW50aFN0ZXAsXG4gICAgfSlcblxuICAgIC8vIFNlY3JldHMgYXJlIHN0b3JlZCBpbiBzZWNyZXRzIG1hbmFnZXIgaW4gdGhlIHBpcGVsaW5lIGFjY291bnQuIEFjY291bnRzIHdlIGRlcGxveSB0b1xuICAgIC8vIGhhdmUgYmVlbiBncmFudGVkIHBlcm1pc3Npb25zIHRvIGFjY2VzcyBzZWNyZXRzIHZpYSByZXNvdXJjZSBwb2xpY2llcy5cblxuICAgIGNvbnN0IGpzb25ScGNQcm92aWRlcnNTZWNyZXQgPSBzbS5TZWNyZXQuZnJvbVNlY3JldEF0dHJpYnV0ZXModGhpcywgJ1JQQ1Byb3ZpZGVyVXJscycsIHtcbiAgICAgIC8vIFRoZSBtYWluIHNlY3JldHMgdXNlIG91ciBJbmZ1cmEgUlBDIHVybHNcbiAgICAgIHNlY3JldENvbXBsZXRlQXJuOlxuICAgICAgICAnYXJuOmF3czpzZWNyZXRzbWFuYWdlcjp1cy1lYXN0LTI6NjQ0MDM5ODE5MDAzOnNlY3JldDpyb3V0aW5nLWFwaS1ycGMtdXJscy1qc29uLXByaW1hcnktaXhTOG13JyxcblxuICAgICAgLypcbiAgICAgIFRoZSBiYWNrdXAgc2VjcmV0cyBtb3N0bHkgdXNlIG91ciBBbGNoZW15IFJQQyB1cmxzXG4gICAgICBIb3dldmVyIEFsY2hlbXkgZG9lcyBub3Qgc3VwcG9ydCBSaW5rZWJ5LCBSb3BzdGVuLCBhbmQgS292YW5cbiAgICAgIFNvIHRob3NlIGNoYWlucyBhcmUgc2V0IHRvIG91ciBJbmZ1cmEgUlBDIHVybHNcbiAgICAgIFdoZW4gc3dpdGNoaW5nIHRvIHRoZSBiYWNrdXBzLFxuICAgICAgd2UgbXVzdCBzZXQgdGhlIG11bHRpY2FsbCBjaHVuayBzaXplIHRvIDUwIHNvIHRoYXQgb3B0aW1pc21cbiAgICAgIGRvZXMgbm90IGJ1ZyBvdXQgb24gQWxjaGVteSdzIGVuZFxuICAgICAgKi9cbiAgICAgIC8vc2VjcmV0Q29tcGxldGVBcm46IGFybjphd3M6c2VjcmV0c21hbmFnZXI6dXMtZWFzdC0yOjY0NDAzOTgxOTAwMzpzZWNyZXQ6cm91dGluZy1hcGktcnBjLXVybHMtanNvbi1iYWNrdXAtRDJzV29lXG4gICAgfSlcblxuICAgIGNvbnN0IHRlbmRlcmx5Q3JlZHMgPSBzbS5TZWNyZXQuZnJvbVNlY3JldEF0dHJpYnV0ZXModGhpcywgJ1RlbmRlcmx5Q3JlZHMnLCB7XG4gICAgICBzZWNyZXRDb21wbGV0ZUFybjogJ2Fybjphd3M6c2VjcmV0c21hbmFnZXI6dXMtZWFzdC0yOjY0NDAzOTgxOTAwMzpzZWNyZXQ6dGVuZGVybHktYXBpLXdRYUkyUicsXG4gICAgfSlcblxuICAgIGNvbnN0IGV0aEdhc1N0YXRpb25JbmZvVXJsID0gc20uU2VjcmV0LmZyb21TZWNyZXRBdHRyaWJ1dGVzKHRoaXMsICdFVEhHYXNTdGF0aW9uVXJsJywge1xuICAgICAgc2VjcmV0Q29tcGxldGVBcm46ICdhcm46YXdzOnNlY3JldHNtYW5hZ2VyOnVzLWVhc3QtMjo2NDQwMzk4MTkwMDM6c2VjcmV0OmV0aC1nYXMtc3RhdGlvbi1pbmZvLXVybC11bEduY1gnLFxuICAgIH0pXG5cbiAgICBjb25zdCBwaW5hdGFBcGkgPSBzbS5TZWNyZXQuZnJvbVNlY3JldEF0dHJpYnV0ZXModGhpcywgJ1BpbmF0YUFQSScsIHtcbiAgICAgIHNlY3JldENvbXBsZXRlQXJuOiAnYXJuOmF3czpzZWNyZXRzbWFuYWdlcjp1cy1lYXN0LTI6NjQ0MDM5ODE5MDAzOnNlY3JldDpwaW5hdGEtYXBpLWtleS1VVkxBZk0nLFxuICAgIH0pXG4gICAgY29uc3Qgcm91dGU1M0FybiA9IHNtLlNlY3JldC5mcm9tU2VjcmV0QXR0cmlidXRlcyh0aGlzLCAnUm91dGU1M0FybicsIHtcbiAgICAgIHNlY3JldENvbXBsZXRlQXJuOiAnYXJuOmF3czpzZWNyZXRzbWFuYWdlcjp1cy1lYXN0LTI6NjQ0MDM5ODE5MDAzOnNlY3JldDpSb3V0ZTUzQXJuLWVsUm1tdycsXG4gICAgfSlcblxuICAgIGNvbnN0IHBpbmF0YVNlY3JldCA9IHNtLlNlY3JldC5mcm9tU2VjcmV0QXR0cmlidXRlcyh0aGlzLCAnUGluYXRhU2VjcmV0Jywge1xuICAgICAgc2VjcmV0Q29tcGxldGVBcm46ICdhcm46YXdzOnNlY3JldHNtYW5hZ2VyOnVzLWVhc3QtMjo2NDQwMzk4MTkwMDM6c2VjcmV0OnBpbmF0YS1zZWNyZXQtc3ZHYVB0JyxcbiAgICB9KVxuXG4gICAgY29uc3QgaG9zdGVkWm9uZSA9IHNtLlNlY3JldC5mcm9tU2VjcmV0QXR0cmlidXRlcyh0aGlzLCAnSG9zdGVkWm9uZScsIHtcbiAgICAgIHNlY3JldENvbXBsZXRlQXJuOiAnYXJuOmF3czpzZWNyZXRzbWFuYWdlcjp1cy1lYXN0LTI6NjQ0MDM5ODE5MDAzOnNlY3JldDpob3N0ZWQtem9uZS1KbVBETlYnLFxuICAgIH0pXG5cbiAgICBjb25zdCBpbnRlcm5hbEFwaUtleSA9IHNtLlNlY3JldC5mcm9tU2VjcmV0QXR0cmlidXRlcyh0aGlzLCAnaW50ZXJuYWwtYXBpLWtleScsIHtcbiAgICAgIHNlY3JldENvbXBsZXRlQXJuOiAnYXJuOmF3czpzZWNyZXRzbWFuYWdlcjp1cy1lYXN0LTI6NjQ0MDM5ODE5MDAzOnNlY3JldDpyb3V0aW5nLWFwaS1pbnRlcm5hbC1hcGkta2V5LVo2OE5tQicsXG4gICAgfSlcblxuICAgIC8vIFBhcnNlIEFXUyBTZWNyZXRcbiAgICBsZXQganNvblJwY1Byb3ZpZGVycyA9IHt9IGFzIHsgW2NoYWluSWQ6IHN0cmluZ106IHN0cmluZyB9XG4gICAgU1VQUE9SVEVEX0NIQUlOUy5mb3JFYWNoKChjaGFpbklkOiBDaGFpbklkKSA9PiB7XG4gICAgICAvLyBUT0RPOiBDaGFuZ2UgdGhpcyB0byBgSlNPTl9SUENfUFJPVklERVJfJHt9YCB0byBiZSBjb25zaXN0ZW50IHdpdGggU09SXG4gICAgICBjb25zdCBrZXkgPSBgV0VCM19SUENfJHtjaGFpbklkfWBcbiAgICAgIGpzb25ScGNQcm92aWRlcnNba2V5XSA9IGpzb25ScGNQcm92aWRlcnNTZWNyZXQuc2VjcmV0VmFsdWVGcm9tSnNvbihrZXkpLnRvU3RyaW5nKClcbiAgICB9KVxuXG4gICAgLy8gQmV0YSB1cy1lYXN0LTJcbiAgICBjb25zdCBiZXRhVXNFYXN0MlN0YWdlID0gbmV3IFJvdXRpbmdBUElTdGFnZSh0aGlzLCAnYmV0YS11cy1lYXN0LTInLCB7XG4gICAgICBlbnY6IHsgYWNjb3VudDogJzE0NTA3OTQ0NDMxNycsIHJlZ2lvbjogJ3VzLWVhc3QtMicgfSxcbiAgICAgIGpzb25ScGNQcm92aWRlcnM6IGpzb25ScGNQcm92aWRlcnMsXG4gICAgICBpbnRlcm5hbEFwaUtleTogaW50ZXJuYWxBcGlLZXkuc2VjcmV0VmFsdWUudG9TdHJpbmcoKSxcbiAgICAgIHByb3Zpc2lvbmVkQ29uY3VycmVuY3k6IDEwMCxcbiAgICAgIGV0aEdhc1N0YXRpb25JbmZvVXJsOiBldGhHYXNTdGF0aW9uSW5mb1VybC5zZWNyZXRWYWx1ZS50b1N0cmluZygpLFxuICAgICAgc3RhZ2U6IFNUQUdFLkJFVEEsXG4gICAgICByb3V0ZTUzQXJuOiByb3V0ZTUzQXJuLnNlY3JldFZhbHVlRnJvbUpzb24oJ2FybicpLnRvU3RyaW5nKCksXG4gICAgICBwaW5hdGFfa2V5OiBwaW5hdGFBcGkuc2VjcmV0VmFsdWVGcm9tSnNvbigncGluYXRhLWFwaS1rZXknKS50b1N0cmluZygpLFxuICAgICAgcGluYXRhX3NlY3JldDogcGluYXRhU2VjcmV0LnNlY3JldFZhbHVlRnJvbUpzb24oJ3NlY3JldCcpLnRvU3RyaW5nKCksXG4gICAgICBob3N0ZWRfem9uZTogaG9zdGVkWm9uZS5zZWNyZXRWYWx1ZUZyb21Kc29uKCd6b25lJykudG9TdHJpbmcoKSxcbiAgICAgIHRlbmRlcmx5VXNlcjogdGVuZGVybHlDcmVkcy5zZWNyZXRWYWx1ZUZyb21Kc29uKCd0ZW5kZXJseS11c2VyJykudG9TdHJpbmcoKSxcbiAgICAgIHRlbmRlcmx5UHJvamVjdDogdGVuZGVybHlDcmVkcy5zZWNyZXRWYWx1ZUZyb21Kc29uKCd0ZW5kZXJseS1wcm9qZWN0JykudG9TdHJpbmcoKSxcbiAgICAgIHRlbmRlcmx5QWNjZXNzS2V5OiB0ZW5kZXJseUNyZWRzLnNlY3JldFZhbHVlRnJvbUpzb24oJ3RlbmRlcmx5LWFjY2Vzcy1rZXknKS50b1N0cmluZygpLFxuICAgIH0pXG5cbiAgICBjb25zdCBiZXRhVXNFYXN0MkFwcFN0YWdlID0gcGlwZWxpbmUuYWRkU3RhZ2UoYmV0YVVzRWFzdDJTdGFnZSlcblxuICAgIHRoaXMuYWRkSW50ZWdUZXN0cyhjb2RlLCBiZXRhVXNFYXN0MlN0YWdlLCBiZXRhVXNFYXN0MkFwcFN0YWdlKVxuXG4gICAgLy8gUHJvZCB1cy1lYXN0LTJcbiAgICBjb25zdCBwcm9kVXNFYXN0MlN0YWdlID0gbmV3IFJvdXRpbmdBUElTdGFnZSh0aGlzLCAncHJvZC11cy1lYXN0LTInLCB7XG4gICAgICBlbnY6IHsgYWNjb3VudDogJzYwNjg1NzI2MzMyMCcsIHJlZ2lvbjogJ3VzLWVhc3QtMicgfSxcbiAgICAgIGpzb25ScGNQcm92aWRlcnM6IGpzb25ScGNQcm92aWRlcnMsXG4gICAgICBpbnRlcm5hbEFwaUtleTogaW50ZXJuYWxBcGlLZXkuc2VjcmV0VmFsdWUudG9TdHJpbmcoKSxcbiAgICAgIHByb3Zpc2lvbmVkQ29uY3VycmVuY3k6IDEwMCxcbiAgICAgIGV0aEdhc1N0YXRpb25JbmZvVXJsOiBldGhHYXNTdGF0aW9uSW5mb1VybC5zZWNyZXRWYWx1ZS50b1N0cmluZygpLFxuICAgICAgY2hhdGJvdFNOU0FybjogJ2Fybjphd3M6c25zOnVzLWVhc3QtMjo2NDQwMzk4MTkwMDM6U2xhY2tDaGF0Ym90VG9waWMnLFxuICAgICAgc3RhZ2U6IFNUQUdFLlBST0QsXG4gICAgICByb3V0ZTUzQXJuOiByb3V0ZTUzQXJuLnNlY3JldFZhbHVlRnJvbUpzb24oJ2FybicpLnRvU3RyaW5nKCksXG4gICAgICBwaW5hdGFfa2V5OiBwaW5hdGFBcGkuc2VjcmV0VmFsdWVGcm9tSnNvbigncGluYXRhLWFwaS1rZXknKS50b1N0cmluZygpLFxuICAgICAgcGluYXRhX3NlY3JldDogcGluYXRhU2VjcmV0LnNlY3JldFZhbHVlRnJvbUpzb24oJ3NlY3JldCcpLnRvU3RyaW5nKCksXG4gICAgICBob3N0ZWRfem9uZTogaG9zdGVkWm9uZS5zZWNyZXRWYWx1ZUZyb21Kc29uKCd6b25lJykudG9TdHJpbmcoKSxcbiAgICAgIHRlbmRlcmx5VXNlcjogdGVuZGVybHlDcmVkcy5zZWNyZXRWYWx1ZUZyb21Kc29uKCd0ZW5kZXJseS11c2VyJykudG9TdHJpbmcoKSxcbiAgICAgIHRlbmRlcmx5UHJvamVjdDogdGVuZGVybHlDcmVkcy5zZWNyZXRWYWx1ZUZyb21Kc29uKCd0ZW5kZXJseS1wcm9qZWN0JykudG9TdHJpbmcoKSxcbiAgICAgIHRlbmRlcmx5QWNjZXNzS2V5OiB0ZW5kZXJseUNyZWRzLnNlY3JldFZhbHVlRnJvbUpzb24oJ3RlbmRlcmx5LWFjY2Vzcy1rZXknKS50b1N0cmluZygpLFxuICAgIH0pXG5cbiAgICBjb25zdCBwcm9kVXNFYXN0MkFwcFN0YWdlID0gcGlwZWxpbmUuYWRkU3RhZ2UocHJvZFVzRWFzdDJTdGFnZSlcblxuICAgIHRoaXMuYWRkSW50ZWdUZXN0cyhjb2RlLCBwcm9kVXNFYXN0MlN0YWdlLCBwcm9kVXNFYXN0MkFwcFN0YWdlKVxuXG4gICAgY29uc3Qgc2xhY2tDaGFubmVsID0gY2hhdGJvdC5TbGFja0NoYW5uZWxDb25maWd1cmF0aW9uLmZyb21TbGFja0NoYW5uZWxDb25maWd1cmF0aW9uQXJuKFxuICAgICAgdGhpcyxcbiAgICAgICdTbGFja0NoYW5uZWwnLFxuICAgICAgJ2Fybjphd3M6Y2hhdGJvdDo6NjQ0MDM5ODE5MDAzOmNoYXQtY29uZmlndXJhdGlvbi9zbGFjay1jaGFubmVsL2VuZy1vcHMtc2xhY2stY2hhdGJvdCdcbiAgICApXG5cbiAgICBwaXBlbGluZS5idWlsZFBpcGVsaW5lKClcbiAgICBwaXBlbGluZS5waXBlbGluZS5ub3RpZnlPbignTm90aWZ5U2xhY2snLCBzbGFja0NoYW5uZWwsIHtcbiAgICAgIGV2ZW50czogW1BpcGVsaW5lTm90aWZpY2F0aW9uRXZlbnRzLlBJUEVMSU5FX0VYRUNVVElPTl9GQUlMRURdLFxuICAgIH0pXG4gIH1cblxuICBwcml2YXRlIGFkZEludGVnVGVzdHMoXG4gICAgc291cmNlQXJ0aWZhY3Q6IGNkay5waXBlbGluZXMuQ29kZVBpcGVsaW5lU291cmNlLFxuICAgIHJvdXRpbmdBUElTdGFnZTogUm91dGluZ0FQSVN0YWdlLFxuICAgIGFwcGxpY2F0aW9uU3RhZ2U6IGNkay5waXBlbGluZXMuU3RhZ2VEZXBsb3ltZW50XG4gICkge1xuICAgIGNvbnN0IHRlc3RBY3Rpb24gPSBuZXcgQ29kZUJ1aWxkU3RlcChgSW50ZWdUZXN0cy0ke3JvdXRpbmdBUElTdGFnZS5zdGFnZU5hbWV9YCwge1xuICAgICAgcHJvamVjdE5hbWU6IGBJbnRlZ1Rlc3RzLSR7cm91dGluZ0FQSVN0YWdlLnN0YWdlTmFtZX1gLFxuICAgICAgaW5wdXQ6IHNvdXJjZUFydGlmYWN0LFxuICAgICAgZW52RnJvbUNmbk91dHB1dHM6IHtcbiAgICAgICAgVU5JU1dBUF9ST1VUSU5HX0FQSTogcm91dGluZ0FQSVN0YWdlLnVybCxcbiAgICAgIH0sXG4gICAgICBidWlsZEVudmlyb25tZW50OiB7XG4gICAgICAgIGVudmlyb25tZW50VmFyaWFibGVzOiB7XG4gICAgICAgICAgTlBNX1RPS0VOOiB7XG4gICAgICAgICAgICB2YWx1ZTogJ25wbS1wcml2YXRlLXJlcG8tYWNjZXNzLXRva2VuJyxcbiAgICAgICAgICAgIHR5cGU6IEJ1aWxkRW52aXJvbm1lbnRWYXJpYWJsZVR5cGUuU0VDUkVUU19NQU5BR0VSLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgQVJDSElWRV9OT0RFX1JQQzoge1xuICAgICAgICAgICAgdmFsdWU6ICdhcmNoaXZlLW5vZGUtcnBjLXVybC1kZWZhdWx0LWttcycsXG4gICAgICAgICAgICB0eXBlOiBCdWlsZEVudmlyb25tZW50VmFyaWFibGVUeXBlLlNFQ1JFVFNfTUFOQUdFUixcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICAgIGNvbW1hbmRzOiBbXG4gICAgICAgICdlY2hvIFwiLy9yZWdpc3RyeS5ucG1qcy5vcmcvOl9hdXRoVG9rZW49JHtOUE1fVE9LRU59XCIgPiAubnBtcmMgJiYgbnBtIGNpJyxcbiAgICAgICAgJ2VjaG8gXCJVTklTV0FQX1JPVVRJTkdfQVBJPSR7VU5JU1dBUF9ST1VUSU5HX0FQSX1cIiA+IC5lbnYnLFxuICAgICAgICAnZWNobyBcIkFSQ0hJVkVfTk9ERV9SUEM9JHtBUkNISVZFX05PREVfUlBDfVwiID4+IC5lbnYnLFxuICAgICAgICAnbnBtIGluc3RhbGwnLFxuICAgICAgICAnbnBtIHJ1biBidWlsZCcsXG4gICAgICAgICducG0gcnVuIGludGVnLXRlc3QnLFxuICAgICAgXSxcbiAgICB9KVxuXG4gICAgYXBwbGljYXRpb25TdGFnZS5hZGRQb3N0KHRlc3RBY3Rpb24pXG4gIH1cbn1cblxuY29uc3QgYXBwID0gbmV3IGNkay5BcHAoKVxuXG5jb25zdCBqc29uUnBjUHJvdmlkZXJzID0ge1xuICBXRUIzX1JQQ18xOiBwcm9jZXNzLmVudi5KU09OX1JQQ19QUk9WSURFUl8xISxcbiAgV0VCM19SUENfMzogcHJvY2Vzcy5lbnYuSlNPTl9SUENfUFJPVklERVJfMyEsXG4gIFdFQjNfUlBDXzQ6IHByb2Nlc3MuZW52LkpTT05fUlBDX1BST1ZJREVSXzQhLFxuICBXRUIzX1JQQ181OiBwcm9jZXNzLmVudi5KU09OX1JQQ19QUk9WSURFUl81ISxcbiAgV0VCM19SUENfNDI6IHByb2Nlc3MuZW52LkpTT05fUlBDX1BST1ZJREVSXzQyISxcbiAgV0VCM19SUENfMTA6IHByb2Nlc3MuZW52LkpTT05fUlBDX1BST1ZJREVSXzEwISxcbiAgV0VCM19SUENfNjk6IHByb2Nlc3MuZW52LkpTT05fUlBDX1BST1ZJREVSXzY5ISxcbiAgV0VCM19SUENfNDIxNjE6IHByb2Nlc3MuZW52LkpTT05fUlBDX1BST1ZJREVSXzQyMTYxISxcbiAgV0VCM19SUENfNDIxNjExOiBwcm9jZXNzLmVudi5KU09OX1JQQ19QUk9WSURFUl80MjE2MTEhLFxuICBXRUIzX1JQQ18xMTE1NTExMTogcHJvY2Vzcy5lbnYuSlNPTl9SUENfUFJPVklERVJfMTExNTUxMTEhLFxuICBXRUIzX1JQQ180MjE2MTM6IHByb2Nlc3MuZW52LkpTT05fUlBDX1BST1ZJREVSXzQyMTYxMyEsXG4gIFdFQjNfUlBDXzEzNzogcHJvY2Vzcy5lbnYuSlNPTl9SUENfUFJPVklERVJfMTM3ISxcbiAgV0VCM19SUENfODAwMDE6IHByb2Nlc3MuZW52LkpTT05fUlBDX1BST1ZJREVSXzgwMDAxISxcbiAgV0VCM19SUENfNDIyMjA6IHByb2Nlc3MuZW52LkpTT05fUlBDX1BST1ZJREVSXzQyMjIwISxcbiAgV0VCM19SUENfNDQ3ODc6IHByb2Nlc3MuZW52LkpTT05fUlBDX1BST1ZJREVSXzQ0Nzg3ISxcbiAgV0VCM19SUENfNTY6IHByb2Nlc3MuZW52LkpTT05fUlBDX1BST1ZJREVSXzU2ISxcbiAgV0VCM19SUENfNDMxMTQ6IHByb2Nlc3MuZW52LkpTT05fUlBDX1BST1ZJREVSXzQzMTE0ISxcbn1cblxuLy8gTG9jYWwgZGV2IHN0YWNrXG5uZXcgUm91dGluZ0FQSVN0YWNrKGFwcCwgJ1JvdXRpbmdBUElTdGFjaycsIHtcbiAganNvblJwY1Byb3ZpZGVyczoganNvblJwY1Byb3ZpZGVycyxcbiAgcHJvdmlzaW9uZWRDb25jdXJyZW5jeTogcHJvY2Vzcy5lbnYuUFJPVklTSU9OX0NPTkNVUlJFTkNZID8gcGFyc2VJbnQocHJvY2Vzcy5lbnYuUFJPVklTSU9OX0NPTkNVUlJFTkNZKSA6IDAsXG4gIHRocm90dGxpbmdPdmVycmlkZTogcHJvY2Vzcy5lbnYuVEhST1RUTEVfUEVSX0ZJVkVfTUlOUyxcbiAgZXRoR2FzU3RhdGlvbkluZm9Vcmw6IHByb2Nlc3MuZW52LkVUSF9HQVNfU1RBVElPTl9JTkZPX1VSTCEsXG4gIGNoYXRib3RTTlNBcm46IHByb2Nlc3MuZW52LkNIQVRCT1RfU05TX0FSTixcbiAgc3RhZ2U6IFNUQUdFLkxPQ0FMLFxuICBpbnRlcm5hbEFwaUtleTogJ3Rlc3QtYXBpLWtleScsXG4gIHJvdXRlNTNBcm46IHByb2Nlc3MuZW52LlJPTEVfQVJOLFxuICBwaW5hdGFfa2V5OiBwcm9jZXNzLmVudi5QSU5BVEFfQVBJX0tFWSEsXG4gIHBpbmF0YV9zZWNyZXQ6IHByb2Nlc3MuZW52LlBJTkFUQV9BUElfU0VDUkVUISxcbiAgaG9zdGVkX3pvbmU6IHByb2Nlc3MuZW52LkhPU1RFRF9aT05FISxcbiAgdGVuZGVybHlVc2VyOiBwcm9jZXNzLmVudi5URU5ERVJMWV9VU0VSISxcbiAgdGVuZGVybHlQcm9qZWN0OiBwcm9jZXNzLmVudi5URU5ERVJMWV9QUk9KRUNUISxcbiAgdGVuZGVybHlBY2Nlc3NLZXk6IHByb2Nlc3MuZW52LlRFTkRFUkxZX0FDQ0VTU19LRVkhLFxufSlcblxubmV3IFJvdXRpbmdBUElQaXBlbGluZShhcHAsICdSb3V0aW5nQVBJUGlwZWxpbmVTdGFjaycsIHtcbiAgZW52OiB7IGFjY291bnQ6ICc2NDQwMzk4MTkwMDMnLCByZWdpb246ICd1cy1lYXN0LTInIH0sXG59KVxuIl19