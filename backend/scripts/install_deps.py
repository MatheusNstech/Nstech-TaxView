from pathlib import Path
import subprocess
import sys

root = Path(r"c:\Users\MatheusSilvaOliveira\PycharmProjects\MsCronograma\backend")
venv_py = root / ".venv" / "Scripts" / "python.exe"
if not venv_py.exists():
    subprocess.check_call([sys.executable, "-m", "venv", str(root / ".venv")])
subprocess.check_call([str(venv_py), "-m", "pip", "install", "-r", str(root / "requirements.txt")])
print("deps ok")
