"""Apply seed SQL files via stdin listing — used with Supabase MCP by the agent."""
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent
ORDER = [
    "master_part_0.sql",
    "master_part_1.sql",
    "master_part_2.sql",
    *[f"seed_ob_{i}.sql" for i in range(6)],
]

if __name__ == "__main__":
    for name in ORDER:
        path = SCRIPTS / name
        print(f"=== {name} size={path.stat().st_size} ===")
