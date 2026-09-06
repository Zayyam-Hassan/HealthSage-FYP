from fastapi import FastAPI
from fastapi.testclient import TestClient

from api.auth_routes import router


class _InsertResult:
    def __init__(self, inserted_id):
        self.inserted_id = inserted_id


class _UsersCollection:
    def __init__(self):
        self.docs = {}

    def find_one(self, query):
        if "_id" in query:
            return self.docs.get(query["_id"])
        if "email" in query:
            email = query["email"]
            disabled = query.get("disabled")
            for doc in self.docs.values():
                if doc["email"] == email and (disabled is None or doc["disabled"] == disabled):
                    return doc
        return None

    def insert_one(self, doc):
        _id = "507f1f77bcf86cd799439011"
        self.docs[_id] = {"_id": _id, **doc}
        return _InsertResult(_id)

    def update_one(self, _query, _update):
        return None


class _DB:
    def __init__(self):
        self.users = _UsersCollection()


def build_client(db):
    app = FastAPI()
    app.include_router(router)
    app.dependency_overrides = {}
    from api.auth_routes import _get_db

    app.dependency_overrides[_get_db] = lambda: db
    return TestClient(app)


def test_signup_success(monkeypatch):
    monkeypatch.setattr("api.auth_routes._hash_password", lambda p: "hashed")
    db = _DB()
    client = build_client(db)
    resp = client.post(
        "/auth/signup",
        json={"email": "a@a.com", "username": "User", "password": "secret123", "role": "patient"},
    )
    assert resp.status_code == 201
    assert resp.json()["email"] == "a@a.com"


def test_signup_existing_email_409(monkeypatch):
    monkeypatch.setattr("api.auth_routes._hash_password", lambda p: "hashed")
    db = _DB()
    db.users.docs["507f1f77bcf86cd799439011"] = {
        "_id": "507f1f77bcf86cd799439011",
        "email": "a@a.com",
        "display_name": "x",
        "role": "patient",
        "hashed_password": "h",
        "avatar_url": None,
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
        "last_login_at": None,
        "disabled": False,
    }
    client = build_client(db)
    resp = client.post(
        "/auth/signup",
        json={"email": "a@a.com", "username": "User", "password": "secret123", "role": "patient"},
    )
    assert resp.status_code == 409


def test_login_not_found_401():
    db = _DB()
    client = build_client(db)
    resp = client.post("/auth/login", json={"email": "no@a.com", "password": "x"})
    assert resp.status_code == 401


def test_login_wrong_password_401(monkeypatch):
    db = _DB()
    db.users.docs["507f1f77bcf86cd799439011"] = {
        "_id": "507f1f77bcf86cd799439011",
        "email": "a@a.com",
        "display_name": "x",
        "role": "patient",
        "hashed_password": "h",
        "avatar_url": None,
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
        "last_login_at": None,
        "disabled": False,
    }
    monkeypatch.setattr("api.auth_routes._verify_password", lambda plain, hashed: False)
    client = build_client(db)
    resp = client.post("/auth/login", json={"email": "a@a.com", "password": "bad"})
    assert resp.status_code == 401


def test_login_success(monkeypatch):
    db = _DB()
    db.users.docs["507f1f77bcf86cd799439011"] = {
        "_id": "507f1f77bcf86cd799439011",
        "email": "a@a.com",
        "display_name": "x",
        "role": "patient",
        "hashed_password": "h",
        "avatar_url": None,
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
        "last_login_at": None,
        "disabled": False,
    }
    monkeypatch.setattr("api.auth_routes._verify_password", lambda plain, hashed: True)
    client = build_client(db)
    resp = client.post("/auth/login", json={"email": "a@a.com", "password": "ok"})
    assert resp.status_code == 200
    assert resp.json()["email"] == "a@a.com"
