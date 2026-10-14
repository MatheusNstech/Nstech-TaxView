from app.services.pdf_texto import MAX_BYTES, is_pdf, primeiro_cnpj, so_digitos, texto_do_pdf

__all__ = ["BUCKET", "MAX_BYTES", "cnpj_do_pdf", "is_pdf", "nome_arquivo", "so_digitos", "storage_path"]

BUCKET = "cartoes-cnpj"


def storage_path(empresa_id: str) -> str:
    return f"{empresa_id}.pdf"


def nome_arquivo(cnpj: str) -> str:
    return f"Cartao CNPJ - {(cnpj or '').replace('/', '-')}.pdf"


def cnpj_do_pdf(content: bytes) -> str | None:
    """Primeiro CNPJ formatado do texto do PDF (o número de inscrição do cartão)."""
    return primeiro_cnpj(texto_do_pdf(content))
