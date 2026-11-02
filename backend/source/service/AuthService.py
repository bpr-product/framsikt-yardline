import os
import hmac
from hashlib import sha256
from fastapi import Header, HTTPException
from itsdangerous import URLSafeTimedSerializer, BadSignature, SignatureExpired

DEMO_USERS = {
 'Maya Chen':'coordinator', 'Alex Rivera':'gate', 'Sam Okafor':'supervisor', 'Priya Shah':'manager'
}
def secret():
    return os.environ.get('SESSION_SECRET') or ('local-development-only-change-me' if not os.environ.get('VERCEL') else '')
def serializer():
    return URLSafeTimedSerializer(secret(),salt='yardline-v1')
def authenticate(name,pin):
    actual=os.environ.get('DEMO_ACCESS_PIN') or ('123456' if not os.environ.get('VERCEL') else '')
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
