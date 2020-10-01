import {Bucket} from "@aws-cdk/aws-s3";
import {RestApi} from "@aws-cdk/aws-apigateway";
import {Code} from "@aws-cdk/aws-lambda";
import {Table} from "@aws-cdk/aws-dynamodb";

export class Resources {
    bucket: Bucket;
    api: RestApi;
    code: Code;
    table: Table;
    environment: {}
}