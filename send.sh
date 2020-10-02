#!/usr/bin/env bash

API_ENDPOINT=$1
FILE=$2

FILENAME=$(basename $FILE)
echo "Uploading file $FILENAME to $API_ENDPOINT"

ENCODED=$(base64 -i $FILE)

JSON="{\"file\": \"$ENCODED\", \"name\": \"$FILENAME\"}"

#curl -X POST -d "$JSON" -H "Content-type: application/json" -v $API_ENDPOINT
echo $JSON | curl -X POST -H "Content-Type: application/json" -d @- $API_ENDPOINT
#curl -X POST -d "$JSON" -H "Content-type: application/json" -v $API_ENDPOINT
