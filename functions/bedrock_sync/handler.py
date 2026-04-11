import json
import os
import boto3
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

KNOWLEDGE_BASE_ID = os.environ["KNOWLEDGE_BASE_ID"]
DATA_SOURCE_ID = os.environ["DATA_SOURCE_ID"]


def lambda_handler(event, context):
    logger.info(f"bedrock_sync invocado: {json.dumps(event)}")

    client = boto3.client("bedrock-agent")

    try:
        resp = client.start_ingestion_job(
            knowledgeBaseId=KNOWLEDGE_BASE_ID,
            dataSourceId=DATA_SOURCE_ID,
        )
        ingestion_job = resp["ingestionJob"]
        logger.info(f"IngestionJob iniciado: {ingestion_job['ingestionJobId']}")

        return {
            "statusCode": 200,
            "body": json.dumps({
                "message": "Sync iniciado",
                "ingestionJobId": ingestion_job["ingestionJobId"],
                "status": ingestion_job["status"],
            }),
        }
    except Exception as e:
        logger.error(f"Error en StartIngestionJob: {e}", exc_info=True)
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(e)}),
        }
