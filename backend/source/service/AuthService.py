import os
import hmac
from hashlib import sha256
from fastapi import Header, HTTPException
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

DEMO_USERS = {
 'Maya Chen':'coordinator', 'Alex Rivera':'gate', 'Sam Okafor':'supervisor', 'Priya Shah':'manager'
}
def secret():
    configured = os.environ.get('SESSION_SECRET')
    if configured:
        return configured
    if os.environ.get('VERCEL'):
        raise HTTPException(503, 'Demo authentication is not configured')
    return 'local-development-only-change-me'
def serializer():
    return URLSafeTimedSerializer(secret(),salt='yardline-v1')
def authenticate(name,pin):
    actual=os.environ.get('DEMO_ACCESS_PIN')
    if not actual:
        if os.environ.get('VERCEL'):
            raise HTTPException(503, 'Demo authentication is not configured')
        actual='123456'
    if name not in DEMO_USERS or not hmac.compare_digest(pin,actual):raise HTTPException(401,'Invalid credentials')
    return {'token':serializer().dumps({'name':name,'role':DEMO_USERS[name]}),'user':{'name':name,'role':DEMO_USERS[name]}}
def current_user(authorization: str | None = Header(default=None)):
    if not authorization or not authorization.startswith('Bearer '):raise HTTPException(401,'Sign in to continue')
    try:
        user=serializer().loads(authorization[7:],max_age=86400)
        if user.get('name') not in DEMO_USERS or user.get('role') != DEMO_USERS[user['name']]:raise ValueError()
        return user
    except (BadSignature,SignatureExpired,ValueError):raise HTTPException(401,'Session expired')
def require(user,*roles):
    if user['role'] not in roles:raise HTTPException(403,'Your role cannot perform this action')
