import json
import boto3
import os
import pprint
import base64
import uuid

bucket = os.getenv("Bucket")

s3client = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")
rekog = boto3.client("rekognition")

table = dynamodb.Table(os.getenv("Table"))


def get_public_url(bucket, key):
    return "https://s3.us-east-1.amazonaws.com/{}/{}".format(bucket, key)


def upload(event, context):
    uid = str(uuid.uuid4()) + ".png"

    request_body = json.loads(event['body'], strict=False)

    s3client.put_object(
        Bucket=bucket,
        Key=uid,
        Body=base64.b64decode(request_body["file"]),
        ACL="public-read"
    )

    print("Saved file {} as {}".format(request_body["name"], uid))

    table.put_item(Item={
        "ID": uid,
        "FileName": request_body["name"],
        "ProcessStage": "uploaded",
        "URL": get_public_url(bucket, uid)
    })

    body = {
        "url": get_public_url(bucket, uid)
    }
    response = {
        "statusCode": 200,
        "body": json.dumps(body)
    }

    return response


def face_detection(event, context):
    print(event)
    print(context)

    for j in event["Records"]:
        records = json.loads(j["body"])
        for i in records["Records"]:
            bucket = i["s3"]["bucket"]["name"]
            key = i["s3"]["object"]["key"]

            response = rekog.detect_faces(
                Image={'S3Object': {'Bucket': bucket, 'Name': photo}},
                Attributes=['ALL']
            )
            print("FaceDetected: {}".format(response))

    return True
