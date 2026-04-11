import json
import os
import uuid
from datetime import datetime, timezone
import boto3
import logging
from boto3.dynamodb.conditions import Key, Attr

logger = logging.getLogger()
logger.setLevel(logging.INFO)

AUDITORIA_TABLE = os.environ["AUDITORIA_TABLE"]

dynamodb = boto3.resource("dynamodb")


def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
        },
        "body": json.dumps(body, ensure_ascii=False),
    }


def get_claims(event):
    """Extrae usuario y vicerrectoria del JWT (para llamadas via API Gateway)."""
    try:
        claims = event["requestContext"]["authorizer"]["claims"]
        usuario = claims["email"]
        groups = claims.get("cognito:groups", "")
        if isinstance(groups, list):
            vicerrectoria = groups[0]
        else:
            vicerrectoria = groups.strip("[]").split(",")[0].strip()
        is_admin = "admin" in groups
        return usuario, vicerrectoria, is_admin
    except (KeyError, IndexError):
        return None, None, False


def write_record(registro):
    """Escribe un registro de auditoria en DynamoDB."""
    table = dynamodb.Table(AUDITORIA_TABLE)

    item = {
        "id": str(uuid.uuid4()),
        "usuario": registro["usuario"],
        "vicerrectoria": registro["vicerrectoria"],
        "accion": registro["accion"],
        "archivo": registro["archivo"],
        "fecha": datetime.now(timezone.utc).isoformat(),
        "estado": registro.get("estado", "EXITOSO"),
        "detalle": registro.get("detalle", ""),
    }

    table.put_item(Item=item)
    logger.info(f"Registro de auditoria creado: {item['id']}")
    return item


def query_records(vicerrectoria, is_admin, params):
    """Consulta registros de auditoria con filtros opcionales."""
    table = dynamodb.Table(AUDITORIA_TABLE)

    if is_admin and not params.get("vicerrectoria"):
        # Admin sin filtro de vicerrectoria: scan completo
        scan_kwargs = {}
        filter_expressions = []

        if params.get("usuario"):
            filter_expressions.append(Attr("usuario").eq(params["usuario"]))
        if params.get("accion"):
            filter_expressions.append(Attr("accion").eq(params["accion"]))
        if params.get("fecha_desde"):
            filter_expressions.append(Attr("fecha").gte(params["fecha_desde"]))
        if params.get("fecha_hasta"):
            filter_expressions.append(Attr("fecha").lte(params["fecha_hasta"]))

        if filter_expressions:
            combined = filter_expressions[0]
            for expr in filter_expressions[1:]:
                combined = combined & expr
            scan_kwargs["FilterExpression"] = combined

        result = table.scan(**scan_kwargs)
    else:
        # Filtrado por vicerrectoria usando GSI
        target_vice = params.get("vicerrectoria", vicerrectoria) if is_admin else vicerrectoria
        query_kwargs = {
            "IndexName": "vicerrectoria-fecha-index",
            "KeyConditionExpression": Key("vicerrectoria").eq(target_vice),
        }

        # Filtro de rango de fechas en la key condition
        if params.get("fecha_desde") and params.get("fecha_hasta"):
            query_kwargs["KeyConditionExpression"] = (
                Key("vicerrectoria").eq(target_vice)
                & Key("fecha").between(params["fecha_desde"], params["fecha_hasta"])
            )
        elif params.get("fecha_desde"):
            query_kwargs["KeyConditionExpression"] = (
                Key("vicerrectoria").eq(target_vice)
                & Key("fecha").gte(params["fecha_desde"])
            )
        elif params.get("fecha_hasta"):
            query_kwargs["KeyConditionExpression"] = (
                Key("vicerrectoria").eq(target_vice)
                & Key("fecha").lte(params["fecha_hasta"])
            )

        # Filtros adicionales
        filter_expressions = []
        if params.get("usuario"):
            filter_expressions.append(Attr("usuario").eq(params["usuario"]))
        if params.get("accion"):
            filter_expressions.append(Attr("accion").eq(params["accion"]))

        if filter_expressions:
            combined = filter_expressions[0]
            for expr in filter_expressions[1:]:
                combined = combined & expr
            query_kwargs["FilterExpression"] = combined

        query_kwargs["ScanIndexForward"] = False  # Mas recientes primero
        result = table.query(**query_kwargs)

    return result.get("Items", [])


def lambda_handler(event, context):
    logger.info(f"auditoria event: {json.dumps(event)}")

    # Invocacion directa desde otra Lambda (asincrona)
    if "action" in event and event["action"] == "write":
        registro = event["registro"]
        item = write_record(registro)
        return {"statusCode": 200, "body": json.dumps({"id": item["id"]})}

    # Invocacion via API Gateway
    method = event.get("httpMethod")
    if not method:
        return response(400, {"error": "Invocacion invalida"})

    usuario, vicerrectoria, is_admin = get_claims(event)
    if not usuario:
        return response(401, {"error": "No autorizado"})

    if method == "POST":
        body = json.loads(event.get("body", "{}"))
        registro = body.get("registro", body)
        registro.setdefault("usuario", usuario)
        registro.setdefault("vicerrectoria", vicerrectoria)
        item = write_record(registro)
        return response(201, {"message": "Registro creado", "id": item["id"]})

    if method == "GET":
        params = event.get("queryStringParameters") or {}
        records = query_records(vicerrectoria, is_admin, params)
        return response(200, {"registros": records, "total": len(records)})

    return response(405, {"error": "Metodo no permitido"})
