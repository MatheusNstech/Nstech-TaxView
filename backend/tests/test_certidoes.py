"""CND das empresas: leitura do PDF, ver, baixar, enviar e remover."""
from __future__ import annotations

from datetime import date
from types import SimpleNamespace
from uuid import uuid4

from fastapi.testclient import TestClient

from app.core.auth import AuthUser, get_current_user, get_db_client
from app.main import app
from app.services import certidoes
from app.services.empresas_painel import montar_grupos
from tests.test_cartao_cnpj import _Bucket, _pdf

ADMIN = AuthUser(id=str(uuid4()), email="a@x.com", access_token="t", role="admin")
USER = AuthUser(id=str(uuid4()), email="u@x.com", access_token="t", role="user")
MATRIZ, FILIAL = str(uuid4()), str(uuid4())

TEXTO_CND = (
    "MINISTERIO DA FAZENDA CERTIDAO POSITIVA COM EFEITOS DE NEGATIVA DE DEBITOS RELATIVOS AOS "
    "TRIBUTOS FEDERAIS E A DIVIDA ATIVA DA UNIAO Nome: BGMRODOTEC CNPJ: 05.074.351/0001-60 "
    "Esta certidao e valida para o estabelecimento matriz e suas filiais. "
    "Emitida as 13:45:36 do dia 24/07/2026 <hora e data de Brasilia>. Valida ate 20/01/2027. "
    "Codigo de controle da certidao: F93A.DFCD.242C.0394"
)


def _empresas() -> list[dict]:
    return [
        {"id": FILIAL, "cnpj": "05.074.351/0002-41", "razao_social": "BGM RJ", "bu": "TMS", "ativa": True},
        {"id": MATRIZ, "cnpj": "05.074.351/0001-60", "razao_social": "BGM", "bu": "TMS", "ativa": True},
    ]


class _Query:
    def __init__(self, client: _Client, table: str):
        self.client, self.table = client, table
        self.filtros: dict[str, str] = {}
        self.acao: tuple | None = None

    def select(self, *_a, **_k):
        return self

    def order(self, *_a, **_k):
        return self

    def range(self, *_a, **_k):
        return self

    def limit(self, *_a, **_k):
        return self

    def eq(self, col, valor):
        self.filtros[col] = str(valor)
        return self

    def upsert(self, row, **_k):
        self.acao = ("upsert", row)
        return self

    def delete(self):
        self.acao = ("delete",)
        return self

    def _linhas(self):
        return [
            r for r in self.client.rows[self.table]
            if all(str(r.get(k)) == v for k, v in self.filtros.items())
        ]

    def execute(self):
        rows = self.client.rows[self.table]
        if self.acao and self.acao[0] == "upsert":
            novo = self.acao[1]
            rows[:] = [
                r for r in rows
                if (r["empresa_id"], r["esfera"]) != (novo["empresa_id"], novo["esfera"])
            ]
            rows.append(dict(novo))
            return SimpleNamespace(data=[dict(novo)])
        if self.acao and self.acao[0] == "delete":
            alvo = self._linhas()
            rows[:] = [r for r in rows if r not in alvo]
            return SimpleNamespace(data=alvo)
        return SimpleNamespace(data=[dict(r) for r in self._linhas()])


class _Client:
    def __init__(self, certidoes_rows: list[dict] | None = None, files: dict[str, bytes] | None = None):
        self.rows = {"empresas": _empresas(), "empresa_certidoes": certidoes_rows or []}
        self.bucket = _Bucket(files or {})
        self.storage = SimpleNamespace(from_=lambda _name: self.bucket)

    def table(self, name):
        return _Query(self, name)


def _chamar(client: _Client, user: AuthUser, method: str, empresa_id: str, sufixo: str = "", **kw):
    app.dependency_overrides[get_current_user] = lambda: user
    app.dependency_overrides[get_db_client] = lambda: client
    try:
        return TestClient(app).request(
            method, f"/api/empresas/{empresa_id}/certidoes/federal{sufixo}", **kw
        )
    finally:
        app.dependency_overrides.clear()


def _enviar(client: _Client, user: AuthUser, empresa_id: str, content: bytes):
    return _chamar(
        client, user, "POST", empresa_id, files={"file": ("cnd.pdf", content, "application/pdf")}
    )


def _certidao_salva(**extra) -> dict:
    return {
        "empresa_id": MATRIZ,
        "esfera": "federal",
        "path": certidoes.storage_path(MATRIZ, "federal"),
        "situacao": "negativa",
        "emitida_em": "2026-08-30",
        "valida_ate": "2027-02-26",
        "codigo_controle": "AAAA.BBBB.CCCC.DDDD",
        "atualizado_em": "2026-10-14T13:00:00Z",
        **extra,
    }


def test_le_os_dados_da_cnd_federal():
    dados = certidoes.ler_cnd_federal(TEXTO_CND)
    assert dados == {
        "cnpj": "05.074.351/0001-60",
        "situacao": "positiva_efeitos_negativa",
        "emitida_em": date(2026, 7, 24),
        "valida_ate": date(2027, 1, 20),
        "codigo_controle": "F93A.DFCD.242C.0394",
    }
    assert certidoes.ler_cnd_federal("CERTIDAO NEGATIVA DE DEBITOS")["situacao"] == "negativa"


def test_ver_e_baixar_a_cnd_pela_filial():
    path = certidoes.storage_path(MATRIZ, "federal")
    client = _Client([_certidao_salva()], {path: b"%PDF-cnd"})

    ver = _chamar(client, USER, "GET", FILIAL)
    assert ver.status_code == 200
    assert ver.content == b"%PDF-cnd"
    assert ver.headers["content-disposition"].startswith("inline;")

    baixar = _chamar(client, USER, "GET", MATRIZ, "?download=true")
    assert baixar.headers["content-disposition"] == 'attachment; filename="CND Federal - 05.074.351.pdf"'


def test_grupo_sem_cnd_da_404():
    assert _chamar(_Client(), USER, "GET", MATRIZ).status_code == 404


def test_envio_pela_filial_grava_na_matriz_com_os_dados_lidos():
    client = _Client()
    resp = _enviar(client, ADMIN, FILIAL, _pdf(TEXTO_CND))
    assert resp.status_code == 200
    [row] = client.rows["empresa_certidoes"]
    assert row["empresa_id"] == MATRIZ
    assert row["situacao"] == "positiva_efeitos_negativa"
    assert row["valida_ate"] == "2027-01-20"
    assert row["codigo_controle"] == "F93A.DFCD.242C.0394"
    assert certidoes.storage_path(MATRIZ, "federal") in client.bucket.files


def test_usuario_comum_nao_envia_cnd():
    client = _Client()
    assert _enviar(client, USER, MATRIZ, _pdf(TEXTO_CND)).status_code == 403
    assert client.rows["empresa_certidoes"] == []


def test_rejeita_cnd_de_outro_grupo():
    client = _Client()
    outra = TEXTO_CND.replace("05.074.351/0001-60", "10.663.651/0001-15")
    resp = _enviar(client, ADMIN, MATRIZ, _pdf(outra))
    assert resp.status_code == 400
    assert "10.663.651/0001-15" in resp.json()["detail"]
    assert client.bucket.files == {}


def test_remover_apaga_arquivo_e_registro():
    path = certidoes.storage_path(MATRIZ, "federal")
    client = _Client([_certidao_salva()], {path: b"%PDF-cnd"})
    assert _chamar(client, ADMIN, "DELETE", FILIAL).status_code == 204
    assert client.bucket.files == {}
    assert client.rows["empresa_certidoes"] == []


def test_painel_mostra_a_cnd_da_matriz_no_grupo():
    [grupo] = montar_grupos(_empresas(), [], [], date(2026, 10, 14), [_certidao_salva()])
    assert grupo["matriz"]["id"] == MATRIZ
    assert [c["esfera"] for c in grupo["certidoes"]] == ["federal"]
