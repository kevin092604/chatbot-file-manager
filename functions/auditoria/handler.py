import json
import os
import uuid
from datetime import datetime, timezone
import logging
import pymssql

logger = logging.getLogger()
logger.setLevel(logging.INFO)

DB_HOST = os.environ["DB_HOST"]
DB_PORT = int(os.environ.get("DB_PORT", "1433"))
DB_NAME = os.environ.get("DB_NAME", "voae")
DB_USER = os.environ["DB_USER"]
DB_PASSWORD = os.environ["DB_PASSWORD"]

_conn = None


def get_conn():
    """Reusa la conexion entre invocaciones warm de Lambda."""
    global _conn
    if _conn is not None:
        try:
            _conn.ping()
            return _conn
        except Exception:
            try:
                _conn.close()
            except Exception:
                pass
            _conn = None

    _conn = pymssql.connect(
        server=DB_HOST,
        port=DB_PORT,
        user=DB_USER,
        password=DB_PASSWORD,
        database=DB_NAME,
        as_dict=True,
        login_timeout=10,
        timeout=15,
    )
    return _conn


def response(status_code, body):
    return {
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
        },
        "body": json.dumps(body, ensure_ascii=False, default=str),
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
    """Escribe un registro de auditoria en SQL Server."""
    item = {
        "id": str(uuid.uuid4()),
        "usuario": registro["usuario"],
        "vicerrectoria": registro["vicerrectoria"],
        "accion": registro["accion"],
        "archivo": registro["archivo"],
        "fecha": datetime.now(timezone.utc),
        "estado": registro.get("estado", "EXITOSO"),
        "detalle": registro.get("detalle", ""),
    }

    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(
            """
            INSERT INTO auditoria
                (id, usuario, vicerrectoria, accion, archivo, fecha, estado, detalle)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (
                item["id"],
                item["usuario"],
                item["vicerrectoria"],
                item["accion"],
                item["archivo"],
                item["fecha"],
                item["estado"],
                item["detalle"],
            ),
        )
    conn.commit()

    logger.info(f"Registro de auditoria creado: {item['id']}")
    item["fecha"] = item["fecha"].isoformat()
    return item


def query_records(vicerrectoria, is_admin, params):
    """Consulta registros de auditoria con filtros opcionales."""
    where = []
    args = []

    if is_admin and not params.get("vicerrectoria"):
        pass  # admin sin filtro: todos
    else:
        target_vice = params.get("vicerrectoria", vicerrectoria) if is_admin else vicerrectoria
        where.append("vicerrectoria = %s")
        args.append(target_vice)

    if params.get("usuario"):
        where.append("usuario = %s")
        args.append(params["usuario"])
    if params.get("accion"):
        where.append("accion = %s")
        args.append(params["accion"])
    if params.get("fecha_desde"):
        where.append("fecha >= %s")
        args.append(params["fecha_desde"])
    if params.get("fecha_hasta"):
        where.append("fecha <= %s")
        args.append(params["fecha_hasta"])

    sql = "SELECT id, usuario, vicerrectoria, accion, archivo, fecha, estado, detalle FROM auditoria"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY fecha DESC"

    conn = get_conn()
    with conn.cursor() as cur:
        cur.execute(sql, tuple(args))
        rows = cur.fetchall()

    for row in rows:
        if isinstance(row.get("fecha"), datetime):
            row["fecha"] = row["fecha"].isoformat()
        if row.get("id") is not None:
            row["id"] = str(row["id"])
    return rows


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
