from types import SimpleNamespace

from app.api.routes import empresas


class _Query:
    def __init__(self, client):
        self.client, self.patch, self.ids = client, None, None

    def select(self, *_a):
        return self

    def order(self, *_a, **_k):
        return self

    def range(self, *_a):
        return self

    def update(self, patch):
        self.patch = patch
        return self

    def in_(self, _col, ids):
        self.ids = ids
        return self

    def execute(self):
        if self.patch is not None:
            self.client.updates.append((self.patch, self.ids))
            return SimpleNamespace(data=[])
        return SimpleNamespace(data=self.client.rows)


class _Client:
    def __init__(self, rows):
        self.rows, self.updates = rows, []

    def table(self, _name):
        return _Query(self)


def test_logo_vai_para_as_filiais_da_mesma_raiz(monkeypatch):
    monkeypatch.setattr(empresas, "fetch_all", lambda build: build().execute().data)
    rows = [
        {"id": "m", "cnpj": "06.326.025/0001-66"},
        {"id": "f", "cnpj": "06.326.025/0002-47"},
        {"id": "o", "cnpj": "28.644.310/0001-68"},
        {"id": "x", "cnpj": "LRI190208D94"},
    ]
    client = _Client(rows)
    logo = {"logo_url": "/logos/buonny.png"}

    empresas._propagar_logo_no_grupo(client, rows[0], logo)
    empresas._propagar_logo_no_grupo(client, rows[3], logo)

    assert client.updates == [(logo, ["f"])]
