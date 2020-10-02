import json
import boto3
import os
import pprint
import base64
import uuid

bucket = os.getenv("Bucket")
topic = os.getenv('Topic')
topicArn = os.getenv('TopicArn')

s3client = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")
rekog = boto3.client("rekognition")
sns = boto3.client('sns')
translate = boto3.client(service_name='translate', use_ssl=True)

table = dynamodb.Table(os.getenv("Table"))

emotions_threshold = 0.5
confidence = {
    'Smile': 80.0,
    'Gender': 80.0,
    'EyesOpen': 70.0,
    'Beard': 75.0
}


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
        "ProcessStage": "1 -> upload",
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
    def compress_result(faceObjArr):
        def get_property(face_details, property):
            print("\tget_property property: \t{}, "
                  "face_details[prop]: \t{} "
                  "confidence[prop]: \t{}".format(property,
                                                  face_details[property],
                                                  confidence[property]))
            if face_details[property]['Confidence'] > confidence[property]:
                return face_details[property]['Value']
            return 'Unknown'

        def get_emotions(face_details):
            result = []
            for emotion in face_details['Emotions']:
                if emotion['Confidence'] > emotions_threshold:
                    result.append(emotion['Type'])
            return result

        face_details = faceObjArr['FaceDetails']

        output = []
        for face in face_details:
            print("'face': {}".format(face))
            print('confidence ', confidence)
            f = {}
            try:
                f = {"Emotions": get_emotions(face)}
                for key in confidence:
                    f[key] = get_property(face, key)
            except:
                f['err'] = 'Error in processing face'
            output.append(f)

        return output

    print(event)

    try:
        for j in event["Records"]:
            records = json.loads(j["body"])
            print('"records:" {}'.format(records))
            for i in records["Records"]:
                bucket = i["s3"]["bucket"]["name"]
                key = i["s3"]["object"]["key"]

                result = rekog.detect_faces(
                    Image={'S3Object': {'Bucket': bucket, 'Name': key}},
                    Attributes=['ALL']
                )
                print("'faceDetected': {}".format(result))
                compressed = compress_result(result)
                print("'compressed': {}".format(compressed))

                table.update_item(
                    Key={
                        "ID": key
                    },
                    UpdateExpression="set #s = :r, ProcessStage = :s",
                    ExpressionAttributeValues={
                        ":r": compressed,
                        ":s": "2 -> face_detected",
                    },
                    ExpressionAttributeNames={
                        "#s": "FaceDetection"
                    }
                )

                sns.publish(
                    TopicArn=topic,
                    Message={
                        "Key": key,
                        "Bucket": bucket
                    },
                )

    except KeyError as err:
        print("Error: {}".format(err))

    return True


def text_processing(event, context):
    print("text_processing")
    print(event)
    print(context)
    return True
