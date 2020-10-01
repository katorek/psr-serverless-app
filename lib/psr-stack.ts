// import * as cdk from '@aws-cdk/core';
import {AuthorizationType, LambdaIntegration, RestApi} from "@aws-cdk/aws-apigateway";
import {Code, Function, FunctionProps, Runtime} from "@aws-cdk/aws-lambda";
import {Bucket} from "@aws-cdk/aws-s3";
import {CfnOutput, Construct, SecretValue, Stack, StackProps, Stage, StageProps} from '@aws-cdk/core';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import {CdkPipeline, SimpleSynthAction} from "@aws-cdk/pipelines";
import {AttributeType, BillingMode, Table} from "@aws-cdk/aws-dynamodb";
import {Resources} from "./resources";


export class PsrStack extends Stack {
    public readonly urlOutput: CfnOutput;

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        // pipeline
        const sourceArtifact = new codepipeline.Artifact();
        const cloudAssemblyArtifact = new codepipeline.Artifact();

        const pipeline = new CdkPipeline(this, 'Pipeline', {
            pipelineName: 'PsryPipeline',
            cloudAssemblyArtifact,

            sourceAction: new codepipeline_actions.GitHubSourceAction({
                actionName: 'Github',
                output: sourceArtifact,
                oauthToken: SecretValue.secretsManager('github_token'),
                trigger: codepipeline_actions.GitHubTrigger.POLL,
                owner: 'katorek',
                repo: 'psr-serverless-app',
                branch: 'develop'
            }),

            synthAction: SimpleSynthAction.standardNpmSynth({
                sourceArtifact,
                cloudAssemblyArtifact,
                buildCommand: 'npm run build',
            })
        });

        pipeline.addApplicationStage(new PsrApplication(this, 'PsrApplication'), {})
    }
}

export class PsrApplication extends Stage {
    constructor(scope: Construct, id: string, props?: StageProps) {
        super(scope, id, props);
        new PsrApplicationStack(this, 'PsrApplication');
    }
}

export class PsrApplicationStack extends Stack {
    private res: Resources;
    private env: {};

    lambdaProps(code: Code, handlerName: string, environment: {}): FunctionProps {
        return {
            code: code,
            handler: handlerName,
            runtime: Runtime.PYTHON_3_7,
            memorySize: 128,
            environment
        }
    }

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        this.res = {
            bucket: new Bucket(this, "PsrBucket"),
            api: new RestApi(this, "PsrApi"),
            code: Code.fromAsset("code/"),
            table: new Table(this, "Table", {
                partitionKey: {
                    name: "ID",
                    type: AttributeType.STRING
                },
                billingMode: BillingMode.PAY_PER_REQUEST
            }),
        }
        this.env = {
            Bucket: this.res.bucket.bucketName,
            Table: this.res.table.tableName
        }

        this.initUploadStack()
    }

    initUploadStack() {
        const f_upload = new Function(this, "UploadLambda", this.lambdaProps(this.res.code, "psr.upload", this.env));
        const res_upload = this.res.api.root.addResource('upload');

        res_upload.addMethod('POST', new LambdaIntegration(f_upload), {
            authorizationType: AuthorizationType.NONE
        });

        this.res.table.grantWriteData(f_upload);
        this.res.bucket.grantWrite(f_upload);
    }
}

