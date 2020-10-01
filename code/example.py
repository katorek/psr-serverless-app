import json

def hello(event, context):
    body = {
        "message": "Hello ther, general Kenobi"
    }

    return {
        "body": json.dumps(body),
        "statusCode": 200
    }
