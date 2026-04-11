import json
import os
import boto3
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

DOCS_BUCKET = os.environ["DOCS_BUCKET"]
BEDROCK_SYNC_FUNCTION = os.environ["BEDROCK_SYNC_FUNCTION"]
AUDITORIA_FUNCTION = os.environ["AUDITORIA_FUNCTION"]

s3_client = boto3.client("s3")
lambda_client = boto3.client("lambda")


def get_claims(event):
    """Extrae usuario y vicerrectoria del JWT validado por API Gateway."""
    try:
        claims = event["requestContext"]["authorizer"]["claims"]
        usuario = claims["email"]
        groups = claims.get("cognito:groups", "")
        # cognito:groups puede venir como string "voae" o "[voae, admin]"
        if isinstance(groups, list):
            vicerrectoria = groups[0]
        else:
            vicerrectoria = groups.strip("[]").split(",")[0].strip()
        is_admin = "admin" in groups
        return usuario, vicerrectoria, is_admin
    except (KeyError, IndexError):
        return None, None, False


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


def invoke_async(function_name, payload):
    """Invoca otra Lambda de forma asincrona. No bloquea ni afecta la respuesta."""
    try:
        client = lambda_client
        client.invoke(
            FunctionName=function_name,
            InvocationType="Event",
            Payload=json.dumps(payload),
        )
    except Exception as e:
        logger.warning(f"Error invocando {function_name}: {e}")


def trigger_sync():
    invoke_async(BEDROCK_SYNC_FUNCTION, {
        "action": "sync",
    })


def trigger_audit(usuario, vicerrectoria, accion, archivo, estado, detalle=""):
    invoke_async(AUDITORIA_FUNCTION, {
        "action": "write",
        "registro": {
            "usuario": usuario,
            "vicerrectoria": vicerrectoria,
            "accion": accion,
            "archivo": archivo,
            "estado": estado,
            "detalle": detalle,
        },
    })


def validate_access(vicerrectoria, key, is_admin):
    """Verifica que el archivo pertenece a la carpeta de la vicerrectoria."""
    if is_admin:
        return True
    return key.startswith(f"{vicerrectoria}/")


def list_files(event, usuario, vicerrectoria, is_admin):
    s3 = s3_client
    prefix = "" if is_admin else f"{vicerrectoria}/"

    result = s3.list_objects_v2(Bucket=DOCS_BUCKET, Prefix=prefix)
    files = []
    for obj in result.get("Contents", []):
        key = obj["Key"]
        if key.endswith(".md"):
            files.append({
                "key": key,
                "size": obj["Size"],
                "last_modified": obj["LastModified"].isoformat(),
            })

    return response(200, {"files": files})


def get_file(event, usuario, vicerrectoria, is_admin):
    params = event.get("queryStringParameters") or {}
    key = params.get("key", "")

    if not key:
        return response(400, {"error": "key es requerido"})

    if not validate_access(vicerrectoria, key, is_admin):
        return response(403, {"error": "No tienes acceso a este archivo"})

    s3 = s3_client
    try:
        obj = s3.get_object(Bucket=DOCS_BUCKET, Key=key)
        content = obj["Body"].read().decode("utf-8")
        return response(200, {"key": key, "content": content})
    except Exception:
        return response(404, {"error": "Archivo no encontrado"})


def upload_file(event, usuario, vicerrectoria, is_admin):
    body = json.loads(event.get("body", "{}"))
    filename = body.get("filename", "")
    content = body.get("content", "")

    if not filename or not content:
        return response(400, {"error": "filename y content son requeridos"})

    if not filename.endswith(".md"):
        return response(400, {"error": "Solo se permiten archivos .md"})

    # Admin puede elegir la vicerrectoria destino
    target_vice = body.get("vicerrectoria", vicerrectoria) if is_admin else vicerrectoria
    key = f"{target_vice}/{filename}"

    s3 = s3_client

    # Verificar que no exista
    existing = s3.list_objects_v2(Bucket=DOCS_BUCKET, Prefix=key, MaxKeys=1)
    if existing.get("KeyCount", 0) > 0:
        return response(409, {"error": f"El archivo {filename} ya existe. Usa PUT para actualizar."})

    s3.put_object(
        Bucket=DOCS_BUCKET,
        Key=key,
        Body=content.encode("utf-8"),
        ContentType="text/markdown",
    )

    trigger_sync()
    trigger_audit(usuario, target_vice, "CREAR", key, "EXITOSO")

    return response(201, {"message": f"Archivo {key} creado", "key": key})


def update_file(event, usuario, vicerrectoria, is_admin):
    body = json.loads(event.get("body", "{}"))
    key = body.get("key", "")
    content = body.get("content", "")

    if not key:
        return response(400, {"error": "key es requerido"})

    if not validate_access(vicerrectoria, key, is_admin):
        return response(403, {"error": "No tienes acceso a este archivo"})

    if not content:
        return response(400, {"error": "content es requerido"})

    s3 = s3_client

    # Verificar que exista
    existing = s3.list_objects_v2(Bucket=DOCS_BUCKET, Prefix=key, MaxKeys=1)
    if existing.get("KeyCount", 0) == 0:
        return response(404, {"error": "Archivo no encontrado"})

    s3.put_object(
        Bucket=DOCS_BUCKET,
        Key=key,
        Body=content.encode("utf-8"),
        ContentType="text/markdown",
    )

    trigger_sync()
    key_vice = key.split("/")[0] if "/" in key else vicerrectoria
    trigger_audit(usuario, key_vice, "ACTUALIZAR", key, "EXITOSO")

    return response(200, {"message": f"Archivo {key} actualizado", "key": key})


def delete_file(event, usuario, vicerrectoria, is_admin):
    body = json.loads(event.get("body", "{}"))
    key = body.get("key", "")

    if not key:
        return response(400, {"error": "key es requerido"})

    if not validate_access(vicerrectoria, key, is_admin):
        return response(403, {"error": "No tienes acceso a este archivo"})

    s3 = s3_client

    # Verificar que exista
    existing = s3.list_objects_v2(Bucket=DOCS_BUCKET, Prefix=key, MaxKeys=1)
    if existing.get("KeyCount", 0) == 0:
        return response(404, {"error": "Archivo no encontrado"})

    s3.delete_object(Bucket=DOCS_BUCKET, Key=key)

    trigger_sync()
    key_vice = key.split("/")[0] if "/" in key else vicerrectoria
    trigger_audit(usuario, key_vice, "ELIMINAR", key, "EXITOSO")

    return response(200, {"message": f"Archivo {key} eliminado"})


HANDLERS = {
    ("GET", "/files"): list_files,
    ("GET", "/files/detail"): get_file,
    ("POST", "/files"): upload_file,
    ("PUT", "/files/detail"): update_file,
    ("DELETE", "/files/detail"): delete_file,
}


def lambda_handler(event, context):
    logger.info(f"Event: {json.dumps(event)}")

    usuario, vicerrectoria, is_admin = get_claims(event)
    if not usuario:
        return response(401, {"error": "No autorizado"})

    method = event["httpMethod"]
    resource = event["resource"]
    handler_key = (method, resource)

    handler = HANDLERS.get(handler_key)
    if not handler:
        return response(404, {"error": "Ruta no encontrada"})

    try:
        return handler(event, usuario, vicerrectoria, is_admin)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        trigger_audit(usuario, vicerrectoria, method, resource, "ERROR", str(e))
        return response(500, {"error": "Error interno del servidor"})
