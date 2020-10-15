// import * as cdk from '@aws-cdk/core';
import {AuthorizationType, LambdaIntegration, RestApi} from "@aws-cdk/aws-apigateway";
import {Code, EventInvokeConfig, Function, FunctionProps, IDestination, IFunction, Runtime} from "@aws-cdk/aws-lambda";
import {Bucket} from "@aws-cdk/aws-s3";
import {Aws, CfnOutput, Construct, Duration, SecretValue, Stack, StackProps, Stage, StageProps} from '@aws-cdk/core';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import {CdkPipeline, SimpleSynthAction} from "@aws-cdk/pipelines";
import {AttributeType, BillingMode, Table} from "@aws-cdk/aws-dynamodb";
import {Resources} from "./resources";
import {SqsEventSource} from "@aws-cdk/aws-lambda-event-sources";
import {Queue} from "@aws-cdk/aws-sqs";
import {SqsDestination} from "@aws-cdk/aws-s3-notifications"
import {PolicyStatement} from "@aws-cdk/aws-iam";
import * as sns from '@aws-cdk/aws-sns';
import {LambdaDestination, SnsDestination} from "@aws-cdk/aws-lambda-destinations";
import {LambdaSubscription} from "@aws-cdk/aws-sns-subscriptions";

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

    lambdaProps(code: Code, handlerName: string, environment: {}, onSuccess?: IDestination): FunctionProps {
        return {
            code: code,
            handler: handlerName,
            runtime: Runtime.PYTHON_3_7,
            memorySize: 128,
            environment,
            onSuccess: onSuccess,

        }
    }

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        this.res = this.initResources();
        this.env = {
            Bucket: this.res.bucket.bucketName,
            Table: this.res.table.tableName,
            Topic: this.res.topic.topicName,
            TopicArn: this.res.topic.topicArn,
        }

        this.res.bucket.addObjectCreatedNotification(new SqsDestination(this.res.queue));

        this.initDynamoDBEndpoints();
        this.initUploadStack();
        this.initFaceDetection();
        const textLambda = this.initTextTranslation();
        this.initTextProcessing(textLambda);
    }

    initResources(): Resources {
        return {
            bucket: new Bucket(this, "PsrBucket"),
            api: new RestApi(this, "PsrApi"),
            code: Code.fromAsset("code/"),
            queue: new Queue(this, "Queue", {
                visibilityTimeout: Duration.minutes(5)
            }),
            table: new Table(this, "Table", {
                partitionKey: {
                    name: "ID",
                    type: AttributeType.STRING
                },
                billingMode: BillingMode.PAY_PER_REQUEST
            }),
            topic: new sns.Topic(this, 'PsrTopic')
        }
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

    initFaceDetection() {
        const f_facedetection = new Function(this, "FaceDetectionLambda",
            this.lambdaProps(this.res.code, "psr.face_detection", this.env));
        f_facedetection.addEventSource(new SqsEventSource(this.res.queue, {batchSize: 1}))
        f_facedetection.addToRolePolicy(new PolicyStatement({
            actions: ["rekognition:DetectFaces"],
            resources: ["*"]
        }));
        this.res.table.grantReadWriteData(f_facedetection);
        this.res.topic.grantPublish(f_facedetection);
        new EventInvokeConfig(this, 'SnsPublish', {
            function: f_facedetection,
            onSuccess: new SnsDestination(this.res.topic),
            onFailure: new SnsDestination(this.res.topic)
        });
    }

    initTextTranslation(): IFunction {
        const f_textTranslating = new Function(this, "TextTranslationLambda",
            this.lambdaProps(this.res.code, "psr.text_translating", this.env));
        this.res.table.grantReadWriteData(f_textTranslating);
        f_textTranslating.addToRolePolicy(new PolicyStatement({
            actions: [
                "translate:*",
                "comprehend:DetectDominantLanguage"
            ],
            resources: ["*"]
        }))

        return f_textTranslating;
    }

    initTextProcessing(translateFunction: IFunction) {
        const f_textProcessing = new Function(this, "TextProcessingLambda",
            this.lambdaProps(this.res.code, "psr.text_processing", this.env, new LambdaDestination(translateFunction)));
        this.res.topic.addSubscription(new LambdaSubscription(f_textProcessing));
        this.res.table.grantReadWriteData(f_textProcessing);
        f_textProcessing.addToRolePolicy(new PolicyStatement({
            actions: ["rekognition:DetectText"],
            resources: ["*"]
        }))
    }

    initDynamoDBEndpoints() {
        const f_getAll = new Function(this, "GetAllLambda",
            this.lambdaProps(this.res.code, "psr.get_all", this.env));

        this.res.table.grantReadData(f_getAll);

        const res_get = this.res.api.root.addResource('items')
        res_get.addMethod('GET', new LambdaIntegration(f_getAll), {
            authorizationType: AuthorizationType.NONE
        })
    }
}

