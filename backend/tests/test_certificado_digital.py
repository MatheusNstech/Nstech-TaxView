"""Certificado digital A1: leitura do PFX, enviar, baixar e remover."""
from __future__ import annotations

from datetime import UTC, date, datetime, timedelta
from types import SimpleNamespace

import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives.serialization import BestAvailableEncryption, pkcs12
from cryptography.x509.oid import NameOID
from fastapi.testclient import TestClient

from app.core.auth import AuthUser, get_current_user, get_db_client
from app.main import app
from app.services import certificado_digital
from app.services.empresas_painel import montar_grupos
from tests import test_certidoes as base
from tests.test_certidoes import ADMIN, FILIAL, MATRIZ, USER, _empresas
from tests.test_cartao_cnpj import _Bucket

SENHA = "s3nh@ 1234"
VALIDO_ATE = datetime(2027, 3, 10, 12, 0, tzinfo=UTC)


def _pfx(cn: str, senha: str = SENHA, san_cnpj: str | None = None) -> bytes:
    key = ec.generate_private_key(ec.SECP256R1())
    nome = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, cn)])
    emissor = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "AC TESTE RFB v5")])
    builder = (
        x509.CertificateBuilder()
        .subject_name(nome)
        .issuer_name(emissor)
        .public_key(key.public_key())
        .serial_number(0xABC123)
        .not_valid_before(VALIDO_ATE - timedelta(days=365))
        .not_valid_after(VALIDO_ATE)
    )
    if san_cnpj:
        valor = b"\x04" + bytes([len(san_cnpj)]) + san_cnpj.encode()
        builder = builder.add_extension(
            x509.SubjectAlternativeName([x509.OtherName(x509.ObjectIdentifier("2.16.76.1.3.3"), valor)]),
            critical=False,
        )
    cert = builder.sign(key, hashes.SHA256())
    return pkcs12.serialize_key_and_certificates(
        b"cert", key, cert, None, BestAvailableEncryption(senha.encode())
    )


class _Query(base._Query):
    def execute(self):
        if self.acao and self.acao[0] == "upsert":
            novo = self.acao[1]
            rows = self.client.rows[self.table]
            rows[:] = [r for r in rows if r["empresa_id"] != novo["empresa_id"]]
            rows.append(dict(novo))
            return SimpleNamespace(data=[dict(novo)])
        return super().execute()


class _Client:
    def __init__(self, certificados: list[dict] | None = None, files: dict[str, bytes] | None = None):
        self.rows = {
            "empresas": _empresas(),
            "empresa_certidoes": [],
            "empresa_certificados": certificados or [],
        }
        self.bucket = _Bucket(files or {})
        self.storage = SimpleNamespace(from_=lambda _name: self.bucket)

    def table(self, name):
        return _Query(self, name)


def _chamar(client: _Client, user: AuthUser, method: str, empresa_id: str, **kw):
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db_client] = lambda: client
    try:
        return TestClient(app).request(method, f"/api/empresas/{empresa_id}/certificado", **kw)
    finally:
        app.dependency_overrides.clear()


def _enviar(client: _Client, user: AuthUser, empresa_id: str, content: bytes, senha: str = SENHA):
    return _chamar(
        client,
        user,
        "POST",
        empresa_id,
        files={"file": ("BGM senha 1234.pfx", content, "application/x-pkcs12")},
        data={"senha": senha},
    )


def _certificado_salvo(**extra) -> dict:
    return {
        "empresa_id": MATRIZ,
        "path": certificado_digital.storage_path(MATRIZ),
        "titular": "BGMRODOTEC",
        "cnpj": "05074351000160",
        "emissor": "AC TESTE RFB v5",
        "numero_serie": "ABC123",
        "valido_de": "2026-03-10T12:00:00+00:00",
        "valido_ate": "2027-03-10T12:00:00+00:00",
        "atualizado_em": "2026-10-14T13:00:00Z",
        **extra,
    }


def test_le_os_dados_do_pfx():
    dados = certificado_digital.ler_pfx(_pfx("BGMRODOTEC TECNOLOGIA:05074351000160"), SENHA)
    assert dados["titular"] == "BGMRODOTEC TECNOLOGIA"
    assert dados["cnpj"] == "05074351000160"
    assert dados["emissor"] == "AC TESTE RFB v5"
    assert dados["numero_serie"] == "ABC123"
    assert dados["valido_ate"] == VALIDO_ATE


def test_le_o_cnpj_do_san_quando_o_cn_nao_traz():
    dados = certificado_digital.ler_pfx(_pfx("BGMRODOTEC", san_cnpj="05074351000160"), SENHA)
    assert dados["cnpj"] == "05074351000160"


def test_senha_errada():
    with pytest.raises(ValueError, match="Senha incorreta"):
        certificado_digital.ler_pfx(_pfx("X:05074351000160"), "outra")


def test_envio_grava_pfx_e_dados_sem_a_senha():
    client = _Client()
    resp = _enviar(client, ADMIN, MATRIZ, _pfx("BGMRODOTEC:05074351000160"))
    assert resp.status_code == 200
    assert resp.json()["valido_ate"].startswith("2027-03-10")
    [row] = client.rows["empresa_certificados"]
    assert row["cnpj"] == "05074351000160"
    assert SENHA not in str(row)
    assert list(client.bucket.files) == [certificado_digital.storage_path(MATRIZ)]


def test_envio_com_senha_errada_nao_grava():
    client = _Client()
    resp = _enviar(client, ADMIN, MATRIZ, _pfx("BGMRODOTEC:05074351000160"), senha="errada")
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Senha incorreta ou arquivo inválido"
    assert client.bucket.files == {}


def test_rejeita_certificado_de_outro_cnpj():
    client = _Client()
    resp = _enviar(client, ADMIN, FILIAL, _pfx("BGMRODOTEC:05074351000160"))
    assert resp.status_code == 400
    assert "05.074.351/0001-60" in resp.json()["detail"]
    assert client.rows["empresa_certificados"] == []


def test_usuario_comum_nao_envia_nem_remove():
    path = certificado_digital.storage_path(MATRIZ)
    client = _Client([_certificado_salvo()], {path: b"pfx"})
    assert _enviar(client, USER, MATRIZ, _pfx("BGMRODOTEC:05074351000160")).status_code == 403
    assert _chamar(client, USER, "DELETE", MATRIZ).status_code == 403
    assert client.bucket.files == {path: b"pfx"}


def test_novo_envio_substitui_o_anterior():
    path = certificado_digital.storage_path(MATRIZ)
    client = _Client([_certificado_salvo(numero_serie="ANTIGO")], {path: b"antigo"})
    assert _enviar(client, ADMIN, MATRIZ, _pfx("BGMRODOTEC:05074351000160")).status_code == 200
    [row] = client.rows["empresa_certificados"]
    assert row["numero_serie"] == "ABC123"
    assert client.bucket.files[path] != b"antigo"


def test_usuario_comum_baixa_com_nome_padronizado():
    path = certificado_digital.storage_path(MATRIZ)
    client = _Client([_certificado_salvo()], {path: b"pfx-bytes"})
    resp = _chamar(client, USER, "GET", MATRIZ)
    assert resp.status_code == 200
    assert resp.content == b"pfx-bytes"
    assert resp.headers["content-type"] == "application/x-pkcs12"
    assert resp.headers["content-disposition"] == (
        'attachment; filename="Certificado - 05.074.351-0001-60.pfx"'
    )


def test_sem_certificado_da_404():
    assert _chamar(_Client(), USER, "GET", MATRIZ).status_code == 404


def test_remover_apaga_arquivo_e_registro():
    path = certificado_digital.storage_path(MATRIZ)
    client = _Client([_certificado_salvo()], {path: b"pfx"})
    assert _chamar(client, ADMIN, "DELETE", MATRIZ).status_code == 204
    assert client.bucket.files == {}
    assert client.rows["empresa_certificados"] == []


def test_painel_mostra_o_certificado_na_unidade_sem_o_path():
    [grupo] = montar_grupos(
        _empresas(), [], [], date(2026, 10, 14), [], [_certificado_salvo()]
    )
    assert grupo["matriz"]["certificado"]["valido_ate"] == "2027-03-10T12:00:00+00:00"
    assert "path" not in grupo["matriz"]["certificado"]
    assert grupo["filiais"][0]["certificado"] is None
