import sqlite3
from werkzeug.security import generate_password_hash
from datetime import datetime

conn = sqlite3.connect('library.db')
cursor = conn.cursor()

# Criar usuários de teste (username, senha)
usuarios = [
    ('lucas', 'lucas123'),
    ('admin', 'admin123'),
    ('teste', 'teste123'),
    ('biblioteca', 'biblioteca123'),
]

print('=' * 60)
print('CRIANDO USUÁRIOS ADMINISTRADORES NO SISTEMA')
print('=' * 60)

for username, password in usuarios:
    # Verificar se usuário já existe
    cursor.execute('SELECT id FROM admins WHERE username = ?', (username,))
    if cursor.fetchone():
        print(f'⚠️  Usuário "{username}" já existe - pulando...')
        continue
    
    # Hash da senha
    password_hash = generate_password_hash(password)
    
    # Inserir usuário
    cursor.execute('''
        INSERT INTO admins (username, password_hash, created_at) 
        VALUES (?, ?, ?)
    ''', (username, password_hash, datetime.now().isoformat()))
    
    print(f'✅ Usuário criado: {username} / {password}')

conn.commit()

print('\n' + '=' * 60)
print('USUÁRIOS ADMINISTRADORES CADASTRADOS:')
print('=' * 60)

cursor.execute('SELECT username, created_at FROM admins')
for username, created_at in cursor.fetchall():
    print(f'  👤 {username} (criado em: {created_at})')

print('\n' + '=' * 60)
print('CREDENCIAIS PARA LOGIN:')
print('=' * 60)
for username, password in usuarios:
    print(f'  Usuário: {username}')
    print(f'  Senha: {password}')
    print('-' * 40)

conn.close()
