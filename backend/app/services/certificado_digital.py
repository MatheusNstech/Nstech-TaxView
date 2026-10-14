"""Certificado digital A1 (PFX) das empresas: leitura dos dados e nomes de arquivo."""
from __future__ import annotations

from typing import Any

from cryptography import x509
from cryptography.hazmat.primitives.serialization import pkcs12
from cryptography.x509.oid import NameOID

from app.services.pdf_texto import so_digitos

BUCKET = "certificados"
MAX_BYTES = 1024 * 1024
CONTENT_TYPE = "application/x-pkcs12"
# ICP-Brasil: CNPJ do titular de e-CNPJ no SAN (otherName).
_OID_CNPJ = x509.ObjectIdentifier("2.16.76.1.3.3")


def storage_path(empresa_id: str) -> str:
    return f"{empresa_id}.pfx"


def nome_arquivo(cnpj: str) -> str:
    return f"Certificado - {cnpj.replace('/', '-')}.pfx"


def _cn(nome: x509.Name) -> str | None:
    attrs = nome.get_attributes_for_oid(NameOID.COMMON_NAME)
    return str(attrs[0].value) if attrs else None


def _cnpj_do_san(cert: x509.Certificate) -> str | None:
    try:
        san = cert.extensions.get_extension_for_class(x509.SubjectAlternativeName).value
    except x509.ExtensionNotFound:
        return None
    for nome in san.get_values_for_type(x509.OtherName):
        if nome.type_id == _OID_CNPJ:
            digitos = so_digitos(nome.value.decode("latin-1", errors="ignore"))
            if len(digitos) >= 14:
                return digitos[-14:]
    return None


def _cnpj(cert: x509.Certificate, titular: str | None) -> str | None:
    """No e-CNPJ o CN vem como 'RAZAO SOCIAL:12345678000199'; o SAN cobre o resto."""
    if titular and ":" in titular:
        digitos = so_digitos(titular.rsplit(":", 1)[1])
        if len(digitos) == 14:
            return digitos
    return _cnpj_do_san(cert)


def ler_pfx(conteudo: bytes, senha: str) -> dict[str, Any]:
    try:
        _, cert, _ = pkcs12.load_key_and_certificates(conteudo, senha.encode("utf-8"))
    except (ValueError, TypeError) as exc:
        raise ValueError("Senha incorreta ou arquivo inválido") from exc
    if cert is None:
        raise ValueError("O arquivo não contém um certificado")
    cn = _cn(cert.subject)
    titular = cn.rsplit(":", 1)[0].strip() if cn and ":" in cn else cn
    return {
        "titular": titular,
        "cnpj": _cnpj(cert, cn),
        "emissor": _cn(cert.issuer),
        "numero_serie": format(cert.serial_number, "X"),
        "valido_de": cert.not_valid_before_utc,
        "valido_ate": cert.not_valid_after_utc,
    }
