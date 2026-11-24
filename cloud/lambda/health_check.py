import json
import os
import urllib.request

def handler(event, context):
    # Optional lightweight availability check for the StudyCloud API.
    url = os.environ.get("STUDYCLOUD_HEALTH_URL")
    if not url:
        return {"statusCode": 200, "body": json.dumps({"status": "lambda-ready"})}
    try:
        with urllib.request.urlopen(url, timeout=5) as response:
            return {"statusCode": response.status, "body": json.dumps({"api": "reachable"})}
    except Exception as exc:
        return {"statusCode": 503, "body": json.dumps({"api": "unreachable", "error": str(exc)})}
