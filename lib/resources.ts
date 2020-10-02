import {Bucket} from "@aws-cdk/aws-s3";
import {RestApi} from "@aws-cdk/aws-apigateway";
import {Code} from "@aws-cdk/aws-lambda";
import {Table} from "@aws-cdk/aws-dynamodb";
import {Queue} from "@aws-cdk/aws-sqs";
import * as sns from "@aws-cdk/aws-sns";
import {Topic} from "@aws-cdk/aws-sns";

export class Resources {
    bucket: Bucket;
    api: RestApi;
    code: Code;
    queue: Queue;
    table: Table;
    topic: Topic;
}