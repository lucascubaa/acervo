import sqlite3
from datetime import datetime
from pathlib import Path
import time

DB_PATH = Path(r"C:\acervoLibrarySystem-\library.db")

if not DB_PATH.exists():
    print(f"ERROR: Banco de dados não encontrado em {DB_PATH}")
    raise SystemExit(1)

# Tentar abrir conexão com timeout e configurar PRAGMA busy_timeout
conn = sqlite3.connect(str(DB_PATH), timeout=30)
cur = conn.cursor()
cur.execute('PRAGMA busy_timeout = 30000')

# Verificar estrutura da tabela turmas
try:
    cur.execute("SELECT id, name FROM turmas ORDER BY id")
    rows = cur.fetchall()
    if rows:
        print("Turmas atuais:")
        for r in rows:
            print(f"  ID: {r[0]}, Nome: {r[1]}")
    else:
        print("Nenhuma turma encontrada na tabela 'turmas'.")
except Exception as e:
    print("ERROR ao consultar tabela 'turmas':", e)
    conn.close()
    raise

# Inserir Turma 4 e Turma 5 se necessário, com retries
to_add = ['Turma 4', 'Turma 5']
for t in to_add:
    cur.execute('SELECT COUNT(*) FROM turmas WHERE name = ?', (t,))
    if cur.fetchone()[0] == 0:
        retries = 5
        delay = 1
        inserted = False
        for i in range(retries):
            try:
                cur.execute('INSERT INTO turmas (name, created_at) VALUES (?, ?)', (t, datetime.now().isoformat()))
                conn.commit()
                print(f"Inserida: {t}")
                inserted = True
                break
            except sqlite3.OperationalError as e:
                if 'locked' in str(e).lower():
                    print(f"Banco ocupado, tentativa {i+1}/{retries} - aguardando {delay}s...")
                    time.sleep(delay)
                    delay *= 2
                else:
                    print('Erro ao inserir:', e)
                    break
        if not inserted:
            print(f"Falha ao inserir {t} após {retries} tentativas (DB ocupado).")
    else:
        print(f"Já existe: {t}")

# Mostrar resultado final
print('\nTurmas finais:')
cur.execute('SELECT id, name FROM turmas ORDER BY id')
for r in cur.fetchall():
    print(f"  ID: {r[0]}, Nome: {r[1]}")

conn.close()
print('\nConcluído')
