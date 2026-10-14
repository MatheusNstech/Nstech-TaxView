import io
import re

from pypdf import PdfReader

# A Vercel recusa corpos acima de 4,5 MB antes de chegar na API.
MAX_BYTES = 4 * 1024 * 1024

CNPJ_RE = re.compile(r"\d{2}\.\d{3}\.\d{3}/\d{4}-\d{2}")


def so_digitos(cnpj: str | None) -> str:
    return re.sub(r"\D", "", cnpj or "")


def is_pdf(content: bytes) -> bool:
    return content.lstrip()[:5] == b"%PDF-"


def texto_do_pdf(content: bytes, paginas: int = 2) -> str:
    """Texto das primeiras páginas com espaços normalizados; vazio se não der para ler."""
    try:
        reader = PdfReader(io.BytesIO(content))
        texto = " ".join((page.extract_text() or "") for page in reader.pages[:paginas])
    except Exception:  # noqa: BLE001
        return ""
    return re.sub(r"\s+", " ", texto)


def primeiro_cnpj(texto: str) -> str | None:
    achado = CNPJ_RE.search(texto)
    return achado.group(0) if achado else None
