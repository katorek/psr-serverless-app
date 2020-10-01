// import * as cdk from '@aws-cdk/core';
import {AuthorizationType, LambdaIntegration, RestApi} from "@aws-cdk/aws-apigateway";
import {Code, Function, Runtime} from "@aws-cdk/aws-lambda";
import {Bucket} from "@aws-cdk/aws-s3";
import {CfnOutput, Construct, SecretValue, Stack, StackProps, Stage, StageProps} from '@aws-cdk/core';
import * as codepipeline from '@aws-cdk/aws-codepipeline';
import * as codepipeline_actions from '@aws-cdk/aws-codepipeline-actions';
import {CdkPipeline, SimpleSynthAction} from "@aws-cdk/pipelines";
import {CodeBuildAction} from "@aws-cdk/aws-codepipeline-actions";


export class PsryStack extends Stack {
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
        // buildCommand: 'npm run build',
      })
    });

    // const bucket = new Bucket(this, "Bucket2", {});

    // new Greetings(this, 'Greetings');
    // pipeline.addApplicationStage(new Greetings(this, 'Greetings'), {})
  }
}

export class Greetings extends Stage {
  constructor(scope: Construct, id: string, props?: StageProps) {
    super(scope, id, props);

    // const bucket = new Bucket(this, "Bucket2", {});


    const code = Code.fromAsset("code/");
    const environment = {
      // Bucket: bucket.bucketName,
    };

    const api = new RestApi(this, "Apiv2");
    const res_helloworld = api.root.addResource("hello")
    const res_greetings = api.root.addResource("greetings")

    const f_helloworld = new Function(this, "LambdaHello", {
      code,
      handler: "example.hello",
      runtime: Runtime.PYTHON_3_7,
      memorySize: 128,
      environment
    });

    res_helloworld.addMethod("GET", new LambdaIntegration(f_helloworld), {
      authorizationType: AuthorizationType.NONE
    });

    const f_greetings = new Function(this, "LambdaGreetings", {
      code,
      handler: "example.greetings",
      runtime: Runtime.PYTHON_3_7,
      memorySize: 128,
      environment
    });
    res_greetings.addMethod("GET", new LambdaIntegration(f_greetings), {
      authorizationType: AuthorizationType.NONE
    });

  }
}
