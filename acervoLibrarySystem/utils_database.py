import sqlite3
from werkzeug.security import generate_password_hash
from datetime import datetime


def verificar_turmas():
    """Verifica e lista todas as turmas no banco de dados"""
    conn = sqlite3.connect('library.db')
    cursor = conn.cursor()
    
    print('Turmas no banco de dados:')
    print('-' * 40)
    cursor.execute('SELECT id, name FROM turmas ORDER BY name')
    turmas = cursor.fetchall()
    
    if turmas:
        for turma in turmas:
            print(f'ID: {turma[0]}, Nome: {turma[1]}')
    else:
        print('Nenhuma turma encontrada.')
    
    conn.close()
    return turmas


def inserir_turmas():
    """Adiciona Turma 4 e Turma 5 ao banco de dados se não existirem"""
    conn = sqlite3.connect('library.db')
    cursor = conn.cursor()
    
    print('Verificando turmas existentes...')
    cursor.execute('SELECT name FROM turmas ORDER BY name')
    turmas_existentes = [row[0] for row in cursor.fetchall()]
    print(f'Turmas encontradas: {turmas_existentes}')
    
    turmas_novas = [
        ('Turma 4', datetime.now().isoformat()),
        ('Turma 5', datetime.now().isoformat())
    ]
    
    print('\nAdicionando novas turmas...')
    for turma_nome, created_at in turmas_novas:
        cursor.execute('SELECT COUNT(*) FROM turmas WHERE name = ?', (turma_nome,))
        if cursor.fetchone()[0] == 0:
            cursor.execute('INSERT INTO turmas (name, created_at) VALUES (?, ?)', (turma_nome, created_at))
            print(f'✓ {turma_nome} adicionada com sucesso!')
        else:
            print(f'- {turma_nome} já existe no banco de dados.')
    
    conn.commit()
    
    print('\nTurmas finais no banco:')
    cursor.execute('SELECT id, name FROM turmas ORDER BY name')
    for row in cursor.fetchall():
        print(f'  ID: {row[0]}, Nome: {row[1]}')
    
    conn.close()
    print('\n✓ Concluído! As turmas foram atualizadas.')


def adicionar_admins():
    """Adiciona os admins 'cuba' e 'Rafaela' ao banco de dados"""
    conn = sqlite3.connect('library.db')
    cursor = conn.cursor()
    
    print('Verificando admins existentes...')
    cursor.execute('SELECT username FROM admins')
    admins_existentes = [row[0] for row in cursor.fetchall()]
    print(f'Admins encontrados: {admins_existentes}')
    
    novos_admins = [
        {
            'username': 'cuba',
            'password': 'cuba123',  
            'created_at': datetime.now().isoformat()
        },
        {
            'username': 'Rafaela',
            'password': 'rafaela123',  
            'created_at': datetime.now().isoformat()
        }
    ]
    
    print('\nAdicionando novos admins...')
    for admin in novos_admins:
        cursor.execute('SELECT COUNT(*) FROM admins WHERE username = ?', (admin['username'],))
        if cursor.fetchone()[0] == 0:
            # Hash da senha
            hashed_password = generate_password_hash(admin['password'])
            
            cursor.execute(
                'INSERT INTO admins (username, password_hash, created_at) VALUES (?, ?, ?)',
                (admin['username'], hashed_password, admin['created_at'])
            )
            print(f"✓ Admin '{admin['username']}' criado com sucesso! (Senha: {admin['password']})")
        else:
            print(f"- Admin '{admin['username']}' já existe no banco de dados.")
    
    conn.commit()
    
    print('\nAdmins finais no banco:')
    cursor.execute('SELECT id, username, created_at FROM admins ORDER BY username')
    for row in cursor.fetchall():
        print(f'  ID: {row[0]}, Username: {row[1]}, Criado em: {row[2]}')
    
    conn.close()
    
    print('\n✓ Concluído! Os admins foram atualizados.')
    print('\nSenhas padrão criadas:')
    print('  - cuba: cuba123')
    print('  - Rafaela: rafaela123')


def criar_usuarios_padrao():
    """Cria usuários administradores padrão no sistema"""
    conn = sqlite3.connect('library.db')
    cursor = conn.cursor()
    
    usuarios = [
        ('lucas', 'lucas123'),
        ('admin', 'admin123'),
        ('teste', 'teste123'),
        ('biblioteca', 'biblioteca2025'),
    ]
    
    print('=' * 60)
    print('CRIANDO USUÁRIOS ADMINISTRADORES NO SISTEMA')
    print('=' * 60)
    
    for username, password in usuarios:
        cursor.execute('SELECT id FROM admins WHERE username = ?', (username,))
        if cursor.fetchone():
            print(f'⚠️  Usuário "{username}" já existe - pulando...')
            continue
        
        password_hash = generate_password_hash(password)
        
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


def verificar_admins():
    """Lista todos os admins cadastrados"""
    conn = sqlite3.connect('library.db')
    cursor = conn.cursor()
    
    print('Admins no banco de dados:')
    print('-' * 40)
    cursor.execute('SELECT id, username, created_at FROM admins ORDER BY username')
    admins = cursor.fetchall()
    
    if admins:
        for admin in admins:
            print(f'ID: {admin[0]}, Username: {admin[1]}, Criado em: {admin[2]}')
    else:
        print('Nenhum admin encontrado.')
    
    conn.close()
    return admins


def menu():
    """Menu interativo para executar as funções"""
    print('\n' + '='*50)
    print('UTILITÁRIOS DO BANCO DE DADOS - Sistema Acervo')
    print('='*50)
    print('\nEscolha uma opção:')
    print('1. Verificar turmas')
    print('2. Inserir Turma 4 e Turma 5')
    print('3. Verificar admins')
    print('4. Adicionar admins (cuba e Rafaela)')
    print('5. Criar usuários padrão (lucas, admin, teste, biblioteca)')
    print('6. Executar tudo')
    print('0. Sair')
    print('-'*50)
    
    escolha = input('\nDigite o número da opção: ').strip()
    
    print('\n')
    if escolha == '1':
        verificar_turmas()
    elif escolha == '2':
        inserir_turmas()
    elif escolha == '3':
        verificar_admins()
    elif escolha == '4':
        adicionar_admins()
    elif escolha == '5':
        criar_usuarios_padrao()
    elif escolha == '6':
        print('Executando todas as operações...\n')
        print('\n--- VERIFICANDO TURMAS ---')
        verificar_turmas()
        print('\n--- INSERINDO TURMAS 4 E 5 ---')
        inserir_turmas()
        print('\n--- VERIFICANDO ADMINS ---')
        verificar_admins()
        print('\n--- ADICIONANDO ADMINS ---')
        adicionar_admins()
        print('\n--- CRIANDO USUÁRIOS PADRÃO ---')
        criar_usuarios_padrao()
    elif escolha == '0':
        print('Saindo...')
        return
    else:
        print('Opção inválida!')
    
    print('\n')


if __name__ == '__main__':
    menu()
