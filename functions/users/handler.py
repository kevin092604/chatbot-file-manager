import json
import os
import boto3
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

USER_POOL_ID = os.environ["USER_POOL_ID"]

cognito = boto3.client("cognito-idp")


def get_claims(event):
    try:
        claims = event["requestContext"]["authorizer"]["claims"]
        usuario = claims["email"]
        groups = claims.get("cognito:groups", "")
        is_admin = "admin" in groups
        return usuario, is_admin
    except (KeyError, IndexError):
        return None, False


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


# --- Usuarios ---

def list_users(event, usuario):
    result = cognito.list_users(UserPoolId=USER_POOL_ID, Limit=60)
    users = []
    for u in result.get("Users", []):
        attrs = {a["Name"]: a["Value"] for a in u.get("Attributes", [])}
        # Obtener grupos del usuario
        groups_result = cognito.admin_list_groups_for_user(
            Username=u["Username"], UserPoolId=USER_POOL_ID
        )
        grupos = [g["GroupName"] for g in groups_result.get("Groups", [])]
        users.append({
            "username": u["Username"],
            "email": attrs.get("email", u["Username"]),
            "status": u["UserStatus"],
            "enabled": u["Enabled"],
            "grupos": grupos,
        })
    return response(200, {"users": users})


def create_user(event, usuario):
    body = json.loads(event.get("body", "{}"))
    email = body.get("email", "").strip()
    temp_password = body.get("temp_password", "").strip()
    grupo = body.get("grupo", "").strip()

    if not email or not temp_password:
        return response(400, {"error": "email y temp_password son requeridos"})

    try:
        result = cognito.admin_create_user(
            UserPoolId=USER_POOL_ID,
            Username=email,
            TemporaryPassword=temp_password,
            UserAttributes=[{"Name": "email", "Value": email}],
            MessageAction="SUPPRESS",  # No enviar email de bienvenida de Cognito
        )
        username = result["User"]["Username"]

        if grupo:
            cognito.admin_add_user_to_group(
                UserPoolId=USER_POOL_ID,
                Username=username,
                GroupName=grupo,
            )

        return response(201, {"message": f"Usuario {email} creado", "username": username})
    except cognito.exceptions.UsernameExistsException:
        return response(409, {"error": "El usuario ya existe"})
    except cognito.exceptions.InvalidPasswordException as e:
        return response(400, {"error": f"Contrasena invalida: {str(e)}"})


def delete_user(event, usuario):
    body = json.loads(event.get("body", "{}"))
    username = body.get("username", "").strip()
    if not username:
        return response(400, {"error": "username es requerido"})
    if username == usuario:
        return response(400, {"error": "No puedes eliminar tu propio usuario"})
    try:
        cognito.admin_delete_user(UserPoolId=USER_POOL_ID, Username=username)
        return response(200, {"message": f"Usuario {username} eliminado"})
    except cognito.exceptions.UserNotFoundException:
        return response(404, {"error": "Usuario no encontrado"})


# --- Grupos ---

def list_groups(event, usuario):
    result = cognito.list_groups(UserPoolId=USER_POOL_ID, Limit=60)
    groups = [
        {"name": g["GroupName"], "description": g.get("Description", "")}
        for g in result.get("Groups", [])
    ]
    return response(200, {"groups": groups})


def create_group(event, usuario):
    body = json.loads(event.get("body", "{}"))
    name = body.get("name", "").strip()
    description = body.get("description", "").strip()

    if not name:
        return response(400, {"error": "name es requerido"})

    try:
        cognito.create_group(
            UserPoolId=USER_POOL_ID,
            GroupName=name,
            Description=description,
        )
        return response(201, {"message": f"Grupo {name} creado"})
    except cognito.exceptions.GroupExistsException:
        return response(409, {"error": "El grupo ya existe"})


def delete_group(event, usuario):
    body = json.loads(event.get("body", "{}"))
    name = body.get("name", "").strip()
    if not name:
        return response(400, {"error": "name es requerido"})
    try:
        cognito.delete_group(UserPoolId=USER_POOL_ID, GroupName=name)
        return response(200, {"message": f"Grupo {name} eliminado"})
    except cognito.exceptions.ResourceNotFoundException:
        return response(404, {"error": "Grupo no encontrado"})


# --- Membresía ---

def add_user_to_group(event, usuario):
    body = json.loads(event.get("body", "{}"))
    username = body.get("username", "").strip()
    grupo = body.get("grupo", "").strip()

    if not username or not grupo:
        return response(400, {"error": "username y grupo son requeridos"})

    try:
        existing = cognito.admin_list_groups_for_user(
            Username=username, UserPoolId=USER_POOL_ID
        )
        if existing.get("Groups"):
            nombres = [g["GroupName"] for g in existing["Groups"]]
            return response(409, {"error": f"El usuario ya pertenece al grupo '{nombres[0]}'. Quítalo primero."})

        cognito.admin_add_user_to_group(
            UserPoolId=USER_POOL_ID, Username=username, GroupName=grupo
        )
        return response(200, {"message": f"Usuario {username} agregado a {grupo}"})
    except cognito.exceptions.UserNotFoundException:
        return response(404, {"error": "Usuario no encontrado"})
    except cognito.exceptions.ResourceNotFoundException:
        return response(404, {"error": "Grupo no encontrado"})


def remove_user_from_group(event, usuario):
    body = json.loads(event.get("body", "{}"))
    username = body.get("username", "").strip()
    grupo = body.get("grupo", "").strip()

    if not username or not grupo:
        return response(400, {"error": "username y grupo son requeridos"})

    try:
        cognito.admin_remove_user_from_group(
            UserPoolId=USER_POOL_ID, Username=username, GroupName=grupo
        )
        return response(200, {"message": f"Usuario {username} removido de {grupo}"})
    except cognito.exceptions.UserNotFoundException:
        return response(404, {"error": "Usuario no encontrado"})


HANDLERS = {
    ("GET",    "/users"):              list_users,
    ("POST",   "/users"):              create_user,
    ("DELETE", "/users"):              delete_user,
    ("GET",    "/groups"):             list_groups,
    ("POST",   "/groups"):             create_group,
    ("DELETE", "/groups"):             delete_group,
    ("POST",   "/users/groups"):       add_user_to_group,
    ("DELETE", "/users/groups"):       remove_user_from_group,
}


def lambda_handler(event, context):
    logger.info(f"Event: {json.dumps(event)}")

    usuario, is_admin = get_claims(event)
    if not usuario:
        return response(401, {"error": "No autorizado"})
    if not is_admin:
        return response(403, {"error": "Solo administradores pueden acceder"})

    method = event["httpMethod"]
    resource = event["resource"]
    handler = HANDLERS.get((method, resource))

    if not handler:
        return response(404, {"error": "Ruta no encontrada"})

    try:
        return handler(event, usuario)
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return response(500, {"error": "Error interno del servidor"})
