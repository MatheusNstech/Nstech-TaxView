"""Cartão CNPJ das empresas: ver, baixar, enviar e remover."""
from __future__ import annotations

from types import SimpleNamespace
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.auth import AuthUser, get_current_user, get_db_client
from app.main import app
from app.services import cartao_cnpj

ADMIN = AuthUser(id=str(uuid4()), email="a@x.com", access_token="t", role="admin")
USER = AuthUser(id=str(uuid4()), email="u@x.com", access_token="t", role="user")
EMPRESA_ID = str(uuid4())
CNPJ = "05.074.351/0002-41"


def _pdf(texto: str) -> bytes:
    stream = f"BT /F1 12 Tf 72 720 Td ({texto}) Tj ET".encode()
    objs = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        b"/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
        b"<< /Length %d >>\nstream\n" % len(stream) + stream + b"\nendstream",
        b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]
    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for i, obj in enumerate(objs, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % i + obj + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objs) + 1)
    out += b"".join(b"%010d 00000 n \n" % o for o in offsets)
    out += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objs) + 1, xref)
    return bytes(out)


class _Bucket:
    def __init__(self, files: dict[str, bytes]):
        self.files = files

    def download(self, path):
        if path not in self.files:
            raise RuntimeError("not found")
        return self.files[path]

    def upload(self, path, content, _opts=None):
        self.files[path] = content

    def remove(self, paths):
        for p in paths:
            self.files.pop(p, None)


class _Query:
    def __init__(self, client: _Client):
        self.client, self.patch = client, None

    def select(self, *_a, **_k):
        return self

    def eq(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    def update(self, patch):
        self.patch = patch
        return self

    def execute(self):
        if self.patch is not None:
            self.client.empresa.update(self.patch)
        return SimpleNamespace(data=[dict(self.client.empresa)] if self.client.empresa else [])


class _Client:
    def __init__(self, empresa: dict | None, files: dict[str, bytes] | None = None):
        self.empresa = empresa
        self.bucket = _Bucket(files or {})
        self.storage = SimpleNamespace(from_=lambda _name: self.bucket)

    def table(self, _name):
        return _Query(self)


def _empresa(**extra) -> dict:
    return {
        "id": EMPRESA_ID,
        "cnpj": CNPJ,
        "razao_social": "BGMRODOTEC",
        "bu": "TMS",
        "ativa": True,
        "cartao_cnpj_path": None,
        "cartao_cnpj_atualizado_em": None,
        **extra,
    }


def _chamar(client: _Client, user: AuthUser, method: str, sufixo: str = "", **kwargs):
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db_client] = lambda: client
    try:
        return TestClient(app).request(
            method, f"/api/empresas/{EMPRESA_ID}/cartao-cnpj{sufixo}", **kwargs
        )
    finally:
        app.dependency_overrides.clear()


def _enviar(client: _Client, user: AuthUser, content: bytes):
    return _chamar(
        client, user, "POST", files={"file": ("cartao.pdf", content, "application/pdf")}
    )


def test_le_o_cnpj_escrito_no_pdf():
    assert cartao_cnpj.cnpj_do_pdf(_pdf(f"NUMERO DE INSCRICAO {CNPJ} MATRIZ")) == CNPJ
    assert cartao_cnpj.cnpj_do_pdf(b"%PDF-quebrado") is None


def test_ver_e_baixar_o_cartao():
    path = cartao_cnpj.storage_path(EMPRESA_ID)
    client = _Client(_empresa(cartao_cnpj_path=path), {path: b"%PDF-conteudo"})

    ver = _chamar(client, USER, "GET")
    assert ver.status_code == 200
    assert ver.content == b"%PDF-conteudo"
    assert ver.headers["content-type"] == "application/pdf"
    assert ver.headers["content-disposition"].startswith("inline;")

    baixar = _chamar(client, USER, "GET", "?download=true")
    assert baixar.headers["content-disposition"] == (
        'attachment; filename="Cartao CNPJ - 05.074.351-0002-41.pdf"'
    )


def test_empresa_sem_cartao_da_404():
    assert _chamar(_Client(_empresa()), USER, "GET").status_code == 404


def test_admin_envia_o_cartao_da_propria_empresa():
    client = _Client(_empresa())
    content = _pdf(f"NUMERO DE INSCRICAO {CNPJ}")
    resp = _enviar(client, ADMIN, content)
    assert resp.status_code == 200
    path = cartao_cnpj.storage_path(EMPRESA_ID)
    assert client.bucket.files[path] == content
    assert client.empresa["cartao_cnpj_path"] == path
    assert resp.json()["cartao_cnpj_atualizado_em"]


def test_usuario_comum_nao_envia():
    client = _Client(_empresa())
    assert _enviar(client, USER, _pdf(CNPJ)).status_code == 403
    assert client.bucket.files == {}


def test_rejeita_arquivo_que_nao_e_pdf():
    client = _Client(_empresa())
    resp = _enviar(client, ADMIN, b"PK\x03\x04 planilha")
    assert resp.status_code == 400
    assert client.bucket.files == {}


def test_rejeita_cartao_de_outro_cnpj():
    client = _Client(_empresa())
    resp = _enviar(client, ADMIN, _pdf("NUMERO DE INSCRICAO 10.663.651/0001-15"))
    assert resp.status_code == 400
    assert "10.663.651/0001-15" in resp.json()["detail"]
    assert client.bucket.files == {}


def test_remover_apaga_arquivo_e_limpa_colunas():
    path = cartao_cnpj.storage_path(EMPRESA_ID)
    client = _Client(
        _empresa(cartao_cnpj_path=path, cartao_cnpj_atualizado_em="2026-10-14T13:00:00Z"),
        {path: b"%PDF-x"},
    )
    assert _chamar(client, ADMIN, "DELETE").status_code == 204
    assert client.bucket.files == {}
    assert client.empresa["cartao_cnpj_path"] is None
    assert client.empresa["cartao_cnpj_atualizado_em"] is None
