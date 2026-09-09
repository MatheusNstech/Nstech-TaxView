from __future__ import annotations

from supabase import Client


def run_atrasos_job(client: Client) -> dict:
    result = client.rpc("run_atrasos_diarios").execute().data
    if isinstance(result, dict):
        return result
    return {
        "atualizadas": 0,
        "notificacoes_criadas": 0,
    }
