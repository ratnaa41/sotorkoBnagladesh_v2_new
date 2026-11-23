
from datetime import datetime, timedelta, timezone
from typing import Optional
import hashlib

import bcrypt
from jose import JWTError, jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.orm import Session

import models
from database import get_db


# Temporary development secret.
# We will move this to an environment variable in a later step.
SECRET_KEY = "sotorko-bangladesh-dev-secret-change-later"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24

# New password hash format.
# Existing bcrypt hashes will continue to work.
HASH_PREFIX = "sotorko$sha256$"


def _prepare_password(plain: str) -> bytes:
    """
    Pre-hash the password with SHA-256 before bcrypt.
    This avoids bcrypt's 72-byte password limitation.
    """
    return hashlib.sha256(plain.encode("utf-8")).hexdigest().encode("ascii")


def hash_password(plain: str) -> str:
    """
    Create a new password hash.
    """
    prepared = _prepare_password(plain)
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(prepared, salt)

    return HASH_PREFIX + hashed.decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    """
    Verify both:
    1. New SHA-256 + bcrypt hashes.
    2. Existing legacy bcrypt hashes.
    """
    try:
        if hashed.startswith(HASH_PREFIX):
            stored_hash = hashed[len(HASH_PREFIX):].encode("utf-8")
            prepared = _prepare_password(plain)
            return bcrypt.checkpw(prepared, stored_hash)

        # Legacy compatibility:
        # The old implementation truncated passwords to 72 bytes.
        legacy_password = plain.encode("utf-8")[:72]
        stored_hash = hashed.encode("utf-8")

        return bcrypt.checkpw(legacy_password, stored_hash)

    except (ValueError, TypeError, UnicodeError):
        return False


def needs_rehash(hashed: str) -> bool:
    """
    Return True for old hashes that should be upgraded
    after a successful login.
    """
    return not hashed.startswith(HASH_PREFIX)


def create_access_token(
    data: dict,
    expires_delta: Optional[timedelta] = None,
) -> str:
    to_encode = data.copy()

    expire = datetime.now(timezone.utc) + (
        expires_delta
        or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    to_encode.update({"exp": expire})

    return jwt.encode(
        to_encode,
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> models.User:
    token = credentials.credentials

    try:
        payload = jwt.decode(
            token,
            SECRET_KEY,
            algorithms=[ALGORITHM],
        )

        email: str = payload.get("sub")

        if email is None:
            raise HTTPException(
                status_code=401,
                detail="Invalid token",
            )

    except JWTError:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired token",
        )

    user = (
        db.query(models.User)
        .filter(models.User.email == email)
        .first()
    )

    if user is None:
        raise HTTPException(
            status_code=401,
            detail="User not found",
        )

    return user
