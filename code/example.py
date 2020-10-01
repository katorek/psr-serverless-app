import json

def hello(event, context):
    body = {
        "message": "Hello ther, general Kenobi"
    }

    return {
        "body": json.dumps(body),
        "statusCode": 200
    }

def greetings(event, context):
    body = {
        "message": "Greetings !",
        "event": event,
        "context": context
    }
    return {
        "body": json.dumps(body),
        "statusCode": 200
    }
