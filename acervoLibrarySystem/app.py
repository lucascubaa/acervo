from flask import Flask, request, jsonify, render_template, send_from_directory, session, redirect, url_for
from flask_cors import CORS
import logging
import sqlite3
from datetime import datetime
import os
import re
from dotenv import load_dotenv
from werkzeug.security import generate_password_hash, check_password_hash
from functools import wraps

# Carregar variáveis de ambiente
load_dotenv()

# Configurar o app
app = Flask(__name__, static_folder='static', template_folder='templates')
CORS(app)
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'supersecretkey')

# Configuração de logging
logging.basicConfig(
    filename='library.log',
    level=logging.INFO,
    format='%(asctime)s:%(levelname)s:%(message)s'
)

def get_db_connection():
    conn = sqlite3.connect('library.db')
    conn.row_factory = sqlite3.Row
    return conn

def init_database():
    """Inicializa o banco de dados criando todas as tabelas necessárias"""
    conn = sqlite3.connect('library.db')
    cursor = conn.cursor()
    
    # Criar tabela de livros
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS livros (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            titulo TEXT NOT NULL,
            autor TEXT NOT NULL,
            isbn TEXT UNIQUE NOT NULL,
            quantidade INTEGER NOT NULL,
            disponivel INTEGER NOT NULL
        )
    ''')
    
    # Criar tabela de alunos
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS alunos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            email TEXT,
            telefone TEXT,
            matricula TEXT
        )
    ''')
    
    # Criar tabela de histórico
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS historico (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            livro_id INTEGER NOT NULL,
            aluno_id INTEGER NOT NULL,
            data_emprestimo TEXT NOT NULL,
            data_devolucao_esperada TEXT NOT NULL,
            data_devolucao TEXT,
            multa REAL DEFAULT 0,
            FOREIGN KEY (livro_id) REFERENCES livros (id),
            FOREIGN KEY (aluno_id) REFERENCES alunos (id)
        )
    ''')
    
    # Criar tabela de admins
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS admins (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL
        )
    ''')
    
    conn.commit()
    conn.close()
    logging.info('Banco de dados inicializado com sucesso')

# Inicializar banco de dados ao iniciar o app
init_database()

# Decorator para proteger rotas
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user_id' not in session:
            return redirect(url_for('login'))
        return f(*args, **kwargs)
    return decorated_function


# ==================== FUNÇÕES HELPER (LÓGICA PYTHON) ====================

def validate_isbn(isbn):
    """Valida formato de ISBN"""
    if not isbn:
        return False
    clean_isbn = re.sub(r'[-\s]', '', isbn)
    return bool(re.match(r'^\d{10}(\d{3})?$', clean_isbn))


def format_date_br(iso_date):
    """Formata data ISO para padrão brasileiro"""
    if not iso_date:
        return ''
    try:
        dt = datetime.fromisoformat(iso_date)
        return dt.strftime('%d/%m/%Y %H:%M')
    except:
        return iso_date


def calculate_fine(borrow_date_str):
    """Calcula multa baseado na data de empréstimo"""
    try:
        borrow_date = datetime.fromisoformat(borrow_date_str)
        days = (datetime.now() - borrow_date).days
        fine = max(0, (days - 10) * 0.25)  # R$0.25 por dia após 10 dias
        return round(fine, 2)
    except:
        return 0.0


def sanitize_input(text):
    """Limpa e sanitiza entrada de texto"""
    if not text:
        return ''
    return text.strip()


def check_book_availability(book_id):
    """Verifica se um livro está disponível"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT available FROM livros WHERE id = ?', (book_id,))
            result = cursor.fetchone()
            return result['available'] if result else False
    except:
        return False


def get_student_active_loans(student_name):
    """Retorna empréstimos ativos de um aluno"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                SELECT COUNT(*) as count 
                FROM "histórico de empréstimo" 
                WHERE student_name = ? AND returnDate IS NULL
            ''', (student_name,))
            result = cursor.fetchone()
            return result['count'] if result else 0
    except:
        return 0

def init_db():
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Criar tabela de administradores
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS admins (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    username TEXT UNIQUE NOT NULL,
                    password_hash TEXT NOT NULL,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Criar admin padrão se não existir
            cursor.execute('SELECT COUNT(*) FROM admins')
            if cursor.fetchone()[0] == 0:
                default_password = 'Biblioteca2025!'
                password_hash = generate_password_hash(default_password)
                cursor.execute('INSERT INTO admins (username, password_hash) VALUES (?, ?)', 
                             ('admin', password_hash))
                conn.commit()
                logging.info(f'Admin padrão criado - Username: admin, Senha: {default_password}')
                print(f'\n{"="*50}')
                print(f'CREDENCIAIS DE ACESSO CRIADAS:')
                print(f'Username: admin')
                print(f'Senha: {default_password}')
                print(f'{"="*50}\n')
            
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT UNIQUE NOT NULL
                )
            ''')

            # Se existirem tabelas antigas, renomear para os novos nomes em português
            cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
            existing_tables = [r[0] for r in cursor.fetchall()]
            # renomear books -> livros
            if 'books' in existing_tables and 'livros' not in existing_tables:
                try:
                    cursor.execute('ALTER TABLE books RENAME TO livros')
                    logging.info('Tabela books renomeada para livros')
                except sqlite3.Error as e:
                    logging.error(f'Erro ao renomear books->livros: {e}')
            # renomear borrowhistory -> "histórico de empréstimo"
            if 'borrowhistory' in existing_tables and 'histórico de empréstimo' not in existing_tables:
                try:
                    cursor.execute('ALTER TABLE borrowhistory RENAME TO "histórico de empréstimo"')
                    logging.info('Tabela borrowhistory renomeada para histórico de empréstimo')
                except sqlite3.Error as e:
                    logging.error(f'Erro ao renomear borrowhistory: {e}')
            # renomear students -> estudantes
            if 'students' in existing_tables and 'estudantes' not in existing_tables:
                try:
                    cursor.execute('ALTER TABLE students RENAME TO estudantes')
                    logging.info('Tabela students renomeada para estudantes')
                except sqlite3.Error as e:
                    logging.error(f'Erro ao renomear students: {e}')

            # Criar a tabela livros se não existir (estrutura esperada)
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS livros (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    author TEXT NOT NULL,
                    isbn TEXT NOT NULL UNIQUE,
                    category TEXT,
                    available BOOLEAN NOT NULL
                )
            ''')

            # Criar a tabela "histórico de empréstimo" se não existir
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS "histórico de empréstimo" (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    bookId INTEGER NOT NULL,
                    userId INTEGER NOT NULL,
                    student_name TEXT,
                    borrowDate TEXT NOT NULL,
                    returnDate TEXT,
                    fine REAL,
                    FOREIGN KEY (bookId) REFERENCES livros(id),
                    FOREIGN KEY (userId) REFERENCES users(id)
                )
            ''')

            # Criar a tabela turmas se não existir
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS turmas (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    created_at TEXT
                )
            ''')
            
            # Inserir turmas padrão se não existirem
            cursor.execute('SELECT COUNT(*) as count FROM turmas')
            if cursor.fetchone()['count'] == 0:
                turmas_padrão = [
                    ('Turma 1', datetime.now().isoformat()),
                    ('Turma 2', datetime.now().isoformat()),
                    ('Turma 3', datetime.now().isoformat())
                ]
                cursor.executemany('INSERT INTO turmas (name, created_at) VALUES (?, ?)', turmas_padrão)
                logging.info('Turmas padrão criadas: Turma 1, Turma 2, Turma 3')
            
            # Criar a tabela estudantes se não existir
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS estudantes (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    turma TEXT,
                    created_at TEXT
                )
            ''')
            
            # Adicionar coluna turma se não existir
            try:
                cursor.execute('PRAGMA table_info("estudantes")')
                cols = [row['name'] for row in cursor.fetchall()]
                if 'turma' not in cols:
                    cursor.execute('ALTER TABLE estudantes ADD COLUMN turma TEXT')
                    logging.info('Coluna turma adicionada à tabela estudantes.')
            except sqlite3.Error as e:
                logging.error(f'Erro ao adicionar coluna turma: {str(e)}')
            
            cursor.execute('INSERT OR IGNORE INTO users (id, email) VALUES (?, ?)', 
                           (1, 'generic@example.com'))
            # (students table removed — kept original schema)
            # Se a coluna student_name não existir na tabela histórica, adiciona-la
            try:
                cursor.execute('PRAGMA table_info("histórico de empréstimo")')
                cols = [row['name'] for row in cursor.fetchall()]
                if 'student_name' not in cols:
                    try:
                        cursor.execute('ALTER TABLE "histórico de empréstimo" ADD COLUMN student_name TEXT')
                        logging.info('Coluna student_name adicionada à tabela histórico de empréstimo.')
                    except sqlite3.Error as e:
                        logging.error(f'Erro ao adicionar coluna student_name: {str(e)}')
            except sqlite3.Error:
                # tabela pode não existir ainda
                pass

            # garantir que a coluna category exista em livros (banco antigo)
            try:
                cursor.execute('PRAGMA table_info(livros)')
                book_cols = [row['name'] for row in cursor.fetchall()]
                if 'category' not in book_cols:
                    try:
                        cursor.execute('ALTER TABLE livros ADD COLUMN category TEXT')
                        logging.info('Coluna category adicionada à tabela livros.')
                    except sqlite3.Error as e:
                        logging.error(f'Erro ao adicionar coluna category: {str(e)}')
            except sqlite3.Error:
                pass
            conn.commit()
            logging.info('Banco de dados inicializado com sucesso.')
    except sqlite3.Error as e:
        logging.error(f'Erro ao inicializar banco de dados: {str(e)}')
    except Exception as e:
        logging.error(f'Erro inesperado ao inicializar banco de dados: {str(e)}')

init_db()

# Rota de Login
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        data = request.get_json() if request.is_json else request.form
        username = data.get('username')
        password = data.get('password')
        
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                cursor.execute('SELECT * FROM admins WHERE username = ?', (username,))
                admin = cursor.fetchone()
                
                if admin and check_password_hash(admin['password_hash'], password):
                    session['user_id'] = admin['id']
                    session['username'] = admin['username']
                    logging.info(f'Login bem-sucedido: {username}')
                    if request.is_json:
                        return jsonify({'success': True, 'message': 'Login realizado com sucesso'}), 200
                    return redirect(url_for('index'))
                else:
                    logging.warning(f'Tentativa de login falhou para: {username}')
                    if request.is_json:
                        return jsonify({'success': False, 'message': 'Usuário ou senha inválidos'}), 401
                    return render_template('login.html', error='Usuário ou senha inválidos')
        except Exception as e:
            logging.error(f'Erro no login: {str(e)}')
            if request.is_json:
                return jsonify({'success': False, 'message': 'Erro ao fazer login'}), 500
            return render_template('login.html', error='Erro ao fazer login')
    
    # Se já estiver logado, redireciona para index
    if 'user_id' in session:
        return redirect(url_for('index'))
    
    return render_template('login.html')

# Rota de Registro
@app.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        data = request.get_json() if request.is_json else request.form
        username = data.get('username')
        password = data.get('password')
        confirm_password = data.get('confirm_password')
        
        # Validações
        if not username or not password or not confirm_password:
            error = 'Todos os campos são obrigatórios'
            if request.is_json:
                return jsonify({'success': False, 'message': error}), 400
            return render_template('register.html', error=error)
        
        if password != confirm_password:
            error = 'As senhas não coincidem'
            if request.is_json:
                return jsonify({'success': False, 'message': error}), 400
            return render_template('register.html', error=error)
        
        if len(password) < 6:
            error = 'A senha deve ter pelo menos 6 caracteres'
            if request.is_json:
                return jsonify({'success': False, 'message': error}), 400
            return render_template('register.html', error=error)
        
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor()
                
                # Verificar se o usuário já existe
                cursor.execute('SELECT id FROM admins WHERE username = ?', (username,))
                if cursor.fetchone():
                    error = 'Nome de usuário já existe'
                    if request.is_json:
                        return jsonify({'success': False, 'message': error}), 400
                    return render_template('register.html', error=error)
                
                # Criar novo usuário
                password_hash = generate_password_hash(password)
                cursor.execute('INSERT INTO admins (username, password_hash) VALUES (?, ?)', 
                             (username, password_hash))
                conn.commit()
                
                logging.info(f'Novo usuário registrado: {username}')
                
                if request.is_json:
                    return jsonify({'success': True, 'message': 'Usuário criado com sucesso! Faça login.'}), 201
                return redirect(url_for('login'))
                
        except Exception as e:
            logging.error(f'Erro no registro: {str(e)}')
            error = 'Erro ao criar usuário'
            if request.is_json:
                return jsonify({'success': False, 'message': error}), 500
            return render_template('register.html', error=error)
    
    # Se já estiver logado, redireciona para index
    if 'user_id' in session:
        return redirect(url_for('index'))
    
    return render_template('register.html')

# Rota de Visualização de Dados (Admin)
@app.route('/admin/view-data')
@login_required
def admin_view_data():
    """Visualizar todos os dados do banco de dados"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Buscar todos os usuários admin
            cursor.execute('SELECT id, username FROM admins ORDER BY id')
            admins = [dict(row) for row in cursor.fetchall()]
            
            # Buscar todos os livros
            cursor.execute('SELECT * FROM livros ORDER BY id')
            livros = [dict(row) for row in cursor.fetchall()]
            
            # Buscar todos os alunos
            cursor.execute('SELECT * FROM alunos ORDER BY id')
            alunos = [dict(row) for row in cursor.fetchall()]
            
            # Buscar todo o histórico
            cursor.execute('''
                SELECT h.*, l.titulo as livro_titulo, a.nome as aluno_nome
                FROM historico h
                LEFT JOIN livros l ON h.livro_id = l.id
                LEFT JOIN alunos a ON h.aluno_id = a.id
                ORDER BY h.id DESC
            ''')
            historico = [dict(row) for row in cursor.fetchall()]
            
            data = {
                'admins': admins,
                'livros': livros,
                'alunos': alunos,
                'historico': historico,
                'total_admins': len(admins),
                'total_livros': len(livros),
                'total_alunos': len(alunos),
                'total_historico': len(historico)
            }
            
            return render_template('admin_view_data.html', data=data)
            
    except Exception as e:
        logging.error(f'Erro ao buscar dados: {str(e)}')
        return jsonify({'error': str(e)}), 500

# Rota de Logout
@app.route('/logout')
def logout():
    username = session.get('username', 'Desconhecido')
    session.clear()
    logging.info(f'Logout: {username}')
    return redirect(url_for('login'))

@app.route('/')
@login_required
def index():
    """Renderiza página principal com dados iniciais"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Buscar estatísticas
            cursor.execute('SELECT COUNT(*) as total FROM livros')
            total_books = cursor.fetchone()['total']
            
            cursor.execute('SELECT COUNT(*) as available FROM livros WHERE available = 1')
            available_books = cursor.fetchone()['available']
            
            cursor.execute('SELECT COUNT(*) as borrowed FROM livros WHERE available = 0')
            borrowed_books = cursor.fetchone()['borrowed']
            
            cursor.execute('SELECT COUNT(*) as total FROM estudantes')
            total_students = cursor.fetchone()['total']
            
            # Buscar turmas
            cursor.execute('SELECT id, name FROM turmas ORDER BY name')
            turmas = [{'id': row['id'], 'name': row['name']} for row in cursor.fetchall()]
            
            stats = {
                'total_books': total_books,
                'available_books': available_books,
                'borrowed_books': borrowed_books,
                'total_students': total_students
            }
            
            return render_template('index.html', stats=stats, turmas=turmas)
    except Exception as e:
        logging.error(f'Erro ao carregar página inicial: {str(e)}')
        return render_template('index.html', stats=None, turmas=[])

# Rota de histórico removida - agora está integrada na aba do sistema principal
# @app.route('/history')
# @login_required
# def history():
#     return render_template('history.html')

@app.route('/docs/<path:filename>')
@login_required
def serve_docs(filename):
    """Serve arquivos exportados da pasta docs"""
    try:
        return send_from_directory('docs', filename, as_attachment=True)
    except Exception as e:
        logging.error(f'Erro ao servir arquivo docs/{filename}: {str(e)}')
        return jsonify({'error': 'Arquivo não encontrado'}), 404

@app.route('/styles/<path:filename>')
def serve_styles(filename):
    """Serve arquivos CSS da pasta styles"""
    try:
        return send_from_directory('styles', filename)
    except Exception as e:
        logging.error(f'Erro ao servir arquivo styles/{filename}: {str(e)}')
        return jsonify({'error': 'Arquivo não encontrado'}), 404

@app.route('/api/books', methods=['GET'])
def get_books():
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM livros')
            books = [dict(book) for book in cursor.fetchall()]
            logging.info('Livros listados com sucesso.')
            return jsonify(books), 200
    except sqlite3.Error as e:
        logging.error(f'Erro ao listar livros: {str(e)}')
        return jsonify({'error': 'Erro ao listar livros'}), 500
    except Exception as e:
        logging.error(f'Erro inesperado ao listar livros: {str(e)}')
        return jsonify({'error': 'Erro ao listar livros'}), 500

@app.route('/api/add_book', methods=['POST'])
def add_book():
    """Adiciona novo livro com validações robustas no backend"""
    try:
        data = request.get_json(silent=True)
        if not data:
            logging.error('Dados JSON inválidos recebidos.')
            return jsonify({'error': 'Dados inválidos ou ausentes'}), 400
        
        # Sanitizar inputs usando helper
        title = sanitize_input(data.get('title'))
        author = sanitize_input(data.get('author'))
        isbn = sanitize_input(data.get('isbn'))
        category = sanitize_input(data.get('category'))
        
        logging.info(f'Tentativa de adicionar livro: title={title}, isbn={isbn}')
        
        # Validações usando helpers
        if not all([title, author, isbn]):
            logging.error('Campos obrigatórios ausentes.')
            return jsonify({'error': 'Todos os campos são obrigatórios'}), 400
        
        if len(title) < 2:
            return jsonify({'error': 'Título deve ter pelo menos 2 caracteres'}), 400
        
        if len(author) < 2:
            return jsonify({'error': 'Autor deve ter pelo menos 2 caracteres'}), 400
        
        # Validar ISBN usando helper
        if not validate_isbn(isbn):
            logging.error(f'ISBN inválido: {isbn}')
            return jsonify({'error': 'ISBN inválido. Use 10 ou 13 dígitos.'}), 400
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT id FROM livros WHERE isbn = ?', (isbn,))
            if cursor.fetchone():
                logging.error(f'ISBN duplicado: {isbn}')
                return jsonify({'error': 'ISBN já cadastrado'}), 400
            cursor.execute('''
                INSERT INTO livros (title, author, isbn, category, available)
                VALUES (?, ?, ?, ?, ?)
            ''', (title, author, isbn, category, True))
            conn.commit()
            logging.info(f'Livro adicionado com sucesso: {title} (ISBN: {isbn})')
            return jsonify({'message': 'Livro adicionado com sucesso'}), 201
    except sqlite3.IntegrityError as e:
        logging.error(f'Erro de integridade ao adicionar livro: {str(e)}')
        return jsonify({'error': 'ISBN já cadastrado'}), 400
    except sqlite3.Error as e:
        logging.error(f'Erro de banco de dados ao adicionar livro: {str(e)}')
        return jsonify({'error': 'Erro ao adicionar livro'}), 500
    except Exception as e:
        logging.error(f'Erro inesperado ao adicionar livro: {str(e)}')
        return jsonify({'error': f'Erro ao adicionar livro: {str(e)}'}), 500


@app.route('/api/update_book', methods=['POST'])
def update_book():
    try:
        data = request.get_json(silent=True)
        if not data:
            logging.error('Dados JSON inválidos recebidos para atualizar livro.')
            return jsonify({'error': 'Dados inválidos ou ausentes'}), 400
        
        book_id = data.get('id')
        title = data.get('title', '').strip()
        author = data.get('author', '').strip()
        isbn = data.get('isbn', '').strip()
        category = data.get('category', '').strip()
        
        logging.info(f'Tentativa de atualizar livro ID={book_id}: title={title}, isbn={isbn}')
        
        if not all([book_id, title, author, isbn]):
            logging.error('Campos obrigatórios ausentes na atualização.')
            return jsonify({'error': 'ID, título, autor e ISBN são obrigatórios'}), 400
        
        clean_isbn = re.sub(r'[-\s]', '', isbn)
        if not re.match(r'^\d{10}(\d{3})?$', clean_isbn):
            logging.error(f'ISBN inválido: {isbn}')
            return jsonify({'error': 'ISBN inválido. Use 10 ou 13 dígitos.'}), 400
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Verificar se o livro existe
            cursor.execute('SELECT id FROM livros WHERE id = ?', (book_id,))
            if not cursor.fetchone():
                logging.error(f'Livro não encontrado: ID={book_id}')
                return jsonify({'error': 'Livro não encontrado'}), 404
            
            # Verificar se ISBN já existe em outro livro
            cursor.execute('SELECT id FROM livros WHERE isbn = ? AND id != ?', (isbn, book_id))
            if cursor.fetchone():
                logging.error(f'ISBN duplicado ao atualizar: {isbn}')
                return jsonify({'error': 'ISBN já cadastrado em outro livro'}), 400
            
            # Atualizar o livro
            cursor.execute('''
                UPDATE livros 
                SET title = ?, author = ?, isbn = ?, category = ?
                WHERE id = ?
            ''', (title, author, isbn, category, book_id))
            conn.commit()
            
            logging.info(f'Livro atualizado com sucesso: ID={book_id}, {title}')
            return jsonify({'message': 'Livro atualizado com sucesso'}), 200
            
    except sqlite3.Error as e:
        logging.error(f'Erro de banco de dados ao atualizar livro: {str(e)}')
        return jsonify({'error': 'Erro ao atualizar livro'}), 500
    except Exception as e:
        logging.error(f'Erro inesperado ao atualizar livro: {str(e)}')
        return jsonify({'error': f'Erro ao atualizar livro: {str(e)}'}), 500

@app.route('/api/books/<int:book_id>', methods=['PUT'])
def update_book_put(book_id):
    """Rota RESTful para atualizar livro"""
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({'error': 'Dados inválidos ou ausentes'}), 400
        
        titulo = data.get('titulo', '').strip()
        autor = data.get('autor', '').strip()
        isbn = data.get('isbn', '').strip()
        categoria = data.get('categoria', '').strip()
        
        logging.info(f'Tentativa de atualizar livro ID={book_id}: titulo={titulo}, isbn={isbn}')
        
        if not all([titulo, autor, isbn]):
            return jsonify({'error': 'Título, autor e ISBN são obrigatórios'}), 400
        
        # Validar ISBN
        clean_isbn = re.sub(r'[-\s]', '', isbn)
        if not re.match(r'^\d{10}(\d{3})?$', clean_isbn):
            return jsonify({'error': 'ISBN inválido. Use 10 ou 13 dígitos.'}), 400
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Verificar se o livro existe
            cursor.execute('SELECT id FROM livros WHERE id = ?', (book_id,))
            if not cursor.fetchone():
                return jsonify({'error': 'Livro não encontrado'}), 404
            
            # Verificar se ISBN já existe em outro livro
            cursor.execute('SELECT id FROM livros WHERE isbn = ? AND id != ?', (isbn, book_id))
            if cursor.fetchone():
                return jsonify({'error': 'ISBN já cadastrado em outro livro'}), 400
            
            # Atualizar o livro
            cursor.execute('''
                UPDATE livros 
                SET title = ?, author = ?, isbn = ?, category = ?
                WHERE id = ?
            ''', (titulo, autor, isbn, categoria, book_id))
            conn.commit()
            
            logging.info(f'Livro atualizado com sucesso: ID={book_id}, {titulo}')
            return jsonify({'message': 'Livro atualizado com sucesso'}), 200
            
    except sqlite3.Error as e:
        logging.error(f'Erro de banco de dados ao atualizar livro: {str(e)}')
        return jsonify({'error': 'Erro ao atualizar livro'}), 500
    except Exception as e:
        logging.error(f'Erro inesperado ao atualizar livro: {str(e)}')
        return jsonify({'error': f'Erro ao atualizar livro: {str(e)}'}), 500


# endpoints para gerenciar alunos (estudantes)
@app.route('/api/students', methods=['GET'])
def get_students():
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT id, name, turma, created_at FROM estudantes ORDER BY name')
            students = [dict(s) for s in cursor.fetchall()]
            return jsonify(students), 200
    except sqlite3.Error as e:
        logging.error(f'Erro ao listar estudantes: {str(e)}')
        return jsonify({'error': 'Erro ao listar estudantes'}), 500
    except Exception as e:
        logging.error(f'Erro inesperado ao listar estudantes: {str(e)}')
        return jsonify({'error': 'Erro ao listar estudantes'}), 500


@app.route('/api/turmas', methods=['GET'])
@login_required
def get_turmas():
    """Retorna a lista de turmas disponíveis"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT id, name FROM turmas ORDER BY name')
            turmas = [{'id': row['id'], 'name': row['name']} for row in cursor.fetchall()]
            return jsonify(turmas), 200
    except sqlite3.Error as e:
        logging.error(f'Erro ao buscar turmas: {str(e)}')
        return jsonify({'error': 'Erro ao buscar turmas'}), 500


@app.route('/api/add_student', methods=['POST'])
def add_student():
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({'error': 'Dados inválidos ou ausentes'}), 400
        name = (data.get('name') or '').strip()
        turma = (data.get('turma') or '').strip()
        if not name:
            logging.info('Tentativa de adicionar aluno sem nome')
            return jsonify({'error': 'Nome do aluno é obrigatório'}), 400
        if not turma:
            return jsonify({'error': 'Turma é obrigatória'}), 400
        with get_db_connection() as conn:
            cursor = conn.cursor()
            # Verificar duplicidade (case-insensitive)
            cursor.execute('SELECT id FROM estudantes WHERE LOWER(name) = LOWER(?)', (name,))
            if cursor.fetchone():
                logging.info(f'Tentativa de adicionar aluno duplicado: {name}')
                return jsonify({'error': 'Aluno com este nome já existe'}), 400
            cursor.execute('INSERT INTO estudantes (name, turma, created_at) VALUES (?, ?, ?)', 
                         (name, turma, datetime.now().isoformat()))
            conn.commit()
            student_id = cursor.lastrowid
            logging.info(f'Aluno adicionado: {name} - Turma: {turma} (id={student_id})')
            return jsonify({'message': 'Aluno adicionado', 'id': student_id, 'name': name, 'turma': turma}), 201
    except sqlite3.IntegrityError as e:
        logging.error(f'Erro de integridade ao adicionar aluno: {str(e)}')
        return jsonify({'error': 'Aluno já existe ou violação de integridade'}), 400
    except sqlite3.Error as e:
        logging.error(f'Erro de banco de dados ao adicionar aluno: {str(e)}')
        return jsonify({'error': 'Erro ao adicionar aluno'}), 500
    except Exception as e:
        logging.error(f'Erro inesperado ao adicionar aluno: {str(e)}')
        return jsonify({'error': 'Erro ao adicionar aluno'}), 500


@app.route('/api/update_student', methods=['POST'])
def update_student():
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({'error': 'Dados inválidos ou ausentes'}), 400
        
        student_id = data.get('id')
        name = (data.get('name') or '').strip()
        turma = (data.get('turma') or '').strip()
        
        if not student_id:
            return jsonify({'error': 'ID do aluno é obrigatório'}), 400
        if not name:
            return jsonify({'error': 'Nome do aluno é obrigatório'}), 400
        if not turma:
            return jsonify({'error': 'Turma é obrigatória'}), 400
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Verificar se o aluno existe
            cursor.execute('SELECT id FROM estudantes WHERE id = ?', (student_id,))
            if not cursor.fetchone():
                return jsonify({'error': 'Aluno não encontrado'}), 404
            
            # Verificar duplicidade de nome (case-insensitive), excluindo o próprio aluno
            cursor.execute('SELECT id FROM estudantes WHERE LOWER(name) = LOWER(?) AND id != ?', (name, student_id))
            if cursor.fetchone():
                return jsonify({'error': 'Já existe outro aluno com este nome'}), 400
            
            cursor.execute('UPDATE estudantes SET name = ?, turma = ? WHERE id = ?', (name, turma, student_id))
            conn.commit()
            
            logging.info(f'Aluno atualizado: id={student_id}, nome={name}, turma={turma}')
            return jsonify({'message': 'Aluno atualizado com sucesso', 'id': student_id, 'name': name, 'turma': turma}), 200
            
    except sqlite3.Error as e:
        logging.error(f'Erro de banco de dados ao atualizar aluno: {str(e)}')
        return jsonify({'error': 'Erro ao atualizar aluno'}), 500
    except Exception as e:
        logging.error(f'Erro inesperado ao atualizar aluno: {str(e)}')
        return jsonify({'error': 'Erro ao atualizar aluno'}), 500


@app.route('/api/delete_student', methods=['POST'])
def delete_student():
    try:
        data = request.get_json(silent=True)
        logging.info(f'Requisição de exclusão recebida: {data}')
        
        if not data:
            logging.warning('Dados inválidos ou ausentes na requisição')
            return jsonify({'error': 'Dados inválidos ou ausentes'}), 400
        
        student_id = data.get('id')
        logging.info(f'ID do aluno a ser excluído: {student_id}')
        
        if not student_id:
            logging.warning('ID do aluno não fornecido')
            return jsonify({'error': 'ID do aluno é obrigatório'}), 400
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Verificar se o aluno existe
            cursor.execute('SELECT name FROM estudantes WHERE id = ?', (student_id,))
            student = cursor.fetchone()
            if not student:
                logging.warning(f'Aluno com ID {student_id} não encontrado')
                return jsonify({'error': 'Aluno não encontrado'}), 404
            
            student_name = student['name']
            logging.info(f'Aluno encontrado: {student_name}')
            
            # Verificar se o aluno tem livros emprestados (usando student_name pois userId não está sendo usado corretamente)
            cursor.execute('''
                SELECT COUNT(*) as count 
                FROM "histórico de empréstimo" 
                WHERE student_name = ? AND returnDate IS NULL
            ''', (student_name,))
            result = cursor.fetchone()
            active_loans = result['count'] if result else 0
            logging.info(f'Livros emprestados ativos: {active_loans}')
            logging.info(f'Query result: {result}')
            
            if active_loans > 0:
                error_msg = f'Não é possível excluir. O aluno possui {active_loans} livro(s) emprestado(s).'
                logging.warning(f'Tentativa de excluir aluno com {active_loans} empréstimos ativos')
                return jsonify({'error': error_msg}), 400
            
            # Excluir o aluno
            cursor.execute('DELETE FROM estudantes WHERE id = ?', (student_id,))
            conn.commit()
            
            logging.info(f'Aluno excluído com sucesso: {student_name} (id={student_id})')
            return jsonify({'message': 'Aluno excluído com sucesso', 'id': student_id}), 200
            
    except sqlite3.Error as e:
        logging.error(f'Erro de banco de dados ao excluir aluno: {str(e)}')
        return jsonify({'error': 'Erro ao excluir aluno'}), 500
    except Exception as e:
        logging.error(f'Erro inesperado ao excluir aluno: {str(e)}')
        return jsonify({'error': 'Erro ao excluir aluno'}), 500


@app.route('/api/borrow', methods=['POST'])
def borrow_book():
    """Registra empréstimo de livro com validações no backend"""
    try:
        data = request.get_json(silent=True)
        if not data:
            logging.error('Dados JSON inválidos recebidos.')
            return jsonify({'error': 'Dados inválidos ou ausentes'}), 400
        
        book_id = data.get('book_id')
        student_name = sanitize_input(data.get('student_name'))
        
        # Validações no backend
        if not book_id:
            return jsonify({'error': 'ID do livro é obrigatório'}), 400
        
        if not student_name:
            return jsonify({'error': 'Nome do aluno é obrigatório'}), 400
        
        # Verificar se livro está disponível usando helper
        if not check_book_availability(book_id):
            logging.error(f'Livro {book_id} não disponível')
            return jsonify({'error': 'Livro não disponível ou não encontrado'}), 400
        
        # Verificar se aluno existe
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT id FROM estudantes WHERE LOWER(name) = LOWER(?)', (student_name,))
            if not cursor.fetchone():
                return jsonify({'error': 'Aluno não cadastrado no sistema'}), 400
            
            # Verificar limite de empréstimos (máximo 3 por aluno)
            active_loans = get_student_active_loans(student_name)
            if active_loans >= 3:
                return jsonify({'error': f'Aluno já possui {active_loans} livros emprestados (limite: 3)'}), 400
            
            # Registrar empréstimo
            cursor.execute('UPDATE livros SET available = ? WHERE id = ?', (False, book_id))
            cursor.execute('''
                INSERT INTO "histórico de empréstimo" (bookId, userId, student_name, borrowDate)
                VALUES (?, ?, ?, ?)
            ''', (book_id, 1, student_name, datetime.now().isoformat()))
            conn.commit()
            logging.info(f'Livro {book_id} emprestado com sucesso.')
            return jsonify({'message': 'Livro emprestado com sucesso'}), 200
    except sqlite3.Error as e:
        logging.error(f'Erro de banco de dados ao emprestar livro: {str(e)}')
        return jsonify({'error': 'Erro ao emprestar livro'}), 500
    except Exception as e:
        logging.error(f'Erro inesperado ao emprestar livro: {str(e)}')
        return jsonify({'error': 'Erro ao emprestar livro'}), 500

@app.route('/api/return', methods=['POST'])
def return_book():
    try:
        data = request.get_json(silent=True)
        if not data:
            logging.error('Dados JSON inválidos recebidos.')
            return jsonify({'error': 'Dados inválidos ou ausentes'}), 400
        book_id = data.get('book_id')
        if not book_id:
            logging.error('ID do livro ausente.')
            return jsonify({'error': 'ID do livro é obrigatório'}), 400
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM "histórico de empréstimo" WHERE bookId = ? AND returnDate IS NULL', (book_id,))
            history = cursor.fetchone()
            if not history:
                logging.error(f'Empréstimo não encontrado para livro {book_id}.')
                return jsonify({'error': 'Empréstimo não encontrado'}), 400
            borrow_date = datetime.fromisoformat(history['borrowDate'])
            return_date = datetime.now()
            days = (return_date - borrow_date).days
            fine = max(0, (days - 10) * 0.25)  # Multa de R$0.25 por dia após 10 dias
            cursor.execute('''
                UPDATE "histórico de empréstimo" SET returnDate = ?, fine = ?
                WHERE id = ?
            ''', (return_date.isoformat(), fine, history['id']))
            cursor.execute('UPDATE livros SET available = ? WHERE id = ?', (True, book_id))
            conn.commit()
            logging.info(f'Livro {book_id} devolvido com sucesso, multa: R${fine:.2f}')
            return jsonify({
                'message': 'Livro devolvido com sucesso',
                'fine': fine,
                'return_date': return_date.isoformat()
            }), 200
    except sqlite3.Error as e:
        logging.error(f'Erro de banco de dados ao devolver livro: {str(e)}')
        return jsonify({'error': 'Erro ao devolver livro'}), 500
    except Exception as e:
        logging.error(f'Erro inesperado ao devolver livro: {str(e)}')
        return jsonify({'error': 'Erro ao devolver livro'}), 500

@app.route('/api/delete_book', methods=['POST'])
def delete_book():
    try:
        data = request.get_json(silent=True)
        if not data:
            logging.error('Dados JSON inválidos recebidos.')
            return jsonify({'error': 'Dados inválidos ou ausentes'}), 400
        book_id = data.get('book_id')
        if not book_id:
            logging.error('ID do livro ausente.')
            return jsonify({'error': 'ID do livro é obrigatório'}), 400
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM livros WHERE id = ? AND available = ?', (book_id, True))
            book = cursor.fetchone()
            if not book:
                logging.error(f'Livro {book_id} não disponível ou não encontrado.')
                return jsonify({'error': 'Livro não disponível ou não encontrado'}), 400
            cursor.execute('DELETE FROM livros WHERE id = ?', (book_id,))
            conn.commit()
            logging.info(f'Livro {book_id} excluído com sucesso.')
            return jsonify({'message': 'Livro excluído com sucesso'}), 200
    except sqlite3.Error as e:
        logging.error(f'Erro de banco de dados ao excluir livro: {str(e)}')
        return jsonify({'error': 'Erro ao excluir livro'}), 500
    except Exception as e:
        logging.error(f'Erro inesperado ao excluir livro: {str(e)}')
        return jsonify({'error': 'Erro ao excluir livro'}), 500

@app.route('/api/history', methods=['GET'])
def get_history():
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            # Livros adicionados (todos os livros com contagem de empréstimos)
            cursor.execute('''
                SELECT b.id, b.title, b.author, b.isbn, b.category, COUNT(bh.id) as borrow_count
                FROM livros b
                LEFT JOIN "histórico de empréstimo" bh ON b.id = bh.bookId
                GROUP BY b.id, b.title, b.author, b.isbn, b.category
            ''')
            added_books = [{
                'id': row['id'],
                'title': row['title'] or 'Desconhecido',
                'author': row['author'] or 'Desconhecido',
                'isbn': row['isbn'] or 'N/A',
                'category': row['category'] or '',
                'borrow_count': row['borrow_count']
            } for row in cursor.fetchall()]
            # Livros emprestados (borrowhistory com returnDate NULL)
            cursor.execute('''
                SELECT bh.id, bh.bookId, bh.borrowDate, bh.returnDate, bh.fine,
                       bh.student_name, b.title, b.author, b.isbn, b.category
                FROM "histórico de empréstimo" bh
                INNER JOIN livros b ON bh.bookId = b.id
                WHERE bh.returnDate IS NULL
            ''')
            borrowed_books = [{
                'id': row['id'],
                'book_id': row['bookId'],
                'title': row['title'] or 'Desconhecido',
                'author': row['author'] or 'Desconhecido',
                'isbn': row['isbn'] or 'N/A',
                'category': row['category'] or '',
                'borrow_date': row['borrowDate'],
                'return_date': row['returnDate'],
                'fine': row['fine'] if row['fine'] is not None else 0.0,
                'student_name': row['student_name'] or ''
            } for row in cursor.fetchall()]
            # Livros devolvidos (borrowhistory com returnDate não NULL)
            cursor.execute('''
                SELECT bh.id, bh.bookId, bh.borrowDate, bh.returnDate, bh.fine,
                       bh.student_name, b.title, b.author, b.isbn, b.category
                FROM "histórico de empréstimo" bh
                INNER JOIN livros b ON bh.bookId = b.id
                WHERE bh.returnDate IS NOT NULL
            ''')
            returned_books = [{
                'id': row['id'],
                'book_id': row['bookId'],
                'title': row['title'] or 'Desconhecido',
                'author': row['author'] or 'Desconhecido',
                'isbn': row['isbn'] or 'N/A',
                'category': row['category'] or '',
                'borrow_date': row['borrowDate'],
                'return_date': row['returnDate'],
                'fine': row['fine'] if row['fine'] is not None else 0.0,
                'student_name': row['student_name'] or ''
            } for row in cursor.fetchall()]
            logging.info('Histórico completo listado com sucesso.')
            return jsonify({
                'added_books': added_books,
                'borrowed_books': borrowed_books,
                'returned_books': returned_books
            }), 200
    except sqlite3.Error as e:
        logging.error(f'Erro de banco de dados ao obter histórico: {str(e)}')
        return jsonify({'error': 'Erro ao obter histórico'}), 500
    except Exception as e:
        logging.error(f'Erro inesperado ao obter histórico: {str(e)}')
        return jsonify({'error': 'Erro ao obter histórico'}), 500


@app.route('/api/history/export_to_docs', methods=['POST'])
def export_history_to_docs():
    try:
        data = request.get_json(silent=True) or {}
        filter_type = data.get('type', 'all')
        from_date = data.get('from_date')
        to_date = data.get('to_date')

        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Buscar livros emprestados e devolvidos
            cursor.execute('''
                SELECT bh.id, bh.bookId, bh.borrowDate, bh.returnDate, bh.fine,
                       bh.student_name, b.title, b.author, b.isbn, b.category
                FROM "histórico de empréstimo" bh
                INNER JOIN livros b ON bh.bookId = b.id
            ''')
            borrow_rows = cursor.fetchall()
            
            items = []
            
            # Processar empréstimos e devoluções
            for row in borrow_rows:
                item = dict(row)
                item['_type'] = 'borrowed' if row['returnDate'] is None else 'returned'
                item['date'] = item.get('returnDate') or item.get('borrowDate', '')
                items.append(item)

            # apply filters
            if filter_type in ('borrowed', 'returned'):
                items = [i for i in items if i['_type'] == filter_type]
            
            # date range
            def in_range(d):
                if not d: return False
                try:
                    dt = datetime.fromisoformat(d)
                except Exception:
                    return False
                if from_date:
                    try:
                        fd = datetime.fromisoformat(from_date)
                        if dt < fd: return False
                    except Exception:
                        pass
                if to_date:
                    try:
                        td = datetime.fromisoformat(to_date)
                        # include entire day
                        td = td.replace(hour=23, minute=59, second=59, microsecond=999999)
                        if dt > td: return False
                    except Exception:
                        pass
                return True

            if from_date or to_date:
                items = [i for i in items if in_range(i.get('date', '') or i.get('borrowDate', '') or i.get('returnDate', ''))]

            # prepare CSV
            if not os.path.exists('docs'):
                os.makedirs('docs')
            filename = f"historico_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
            filepath = os.path.join('docs', filename)
            with open(filepath, 'w', encoding='utf-8-sig', newline='') as f:
                headers = ['Tipo','Título','Autor','ISBN','Categoria','Data','Aluno','Multa']
                f.write(','.join(headers) + '\n')
                for it in items:
                    tipo_label = {
                        'borrowed': 'Emprestado',
                        'returned': 'Devolvido'
                    }.get(it.get('_type', ''), '')
                    
                    d = it.get('date', '') or it.get('borrowDate', '') or it.get('returnDate', '')
                    
                    rowvals = [
                        tipo_label,
                        it.get('title', ''),
                        it.get('author', ''),
                        it.get('isbn', ''),
                        it.get('category', ''),
                        d,
                        it.get('student_name', ''),
                        str(it.get('fine') or '')
                    ]
                    # escape quotes
                    rowvals_esc = ['"' + str(v).replace('"','""') + '"' for v in rowvals]
                    f.write(','.join(rowvals_esc) + '\n')

            logging.info(f'Histórico exportado para docs: {filepath}')
            return jsonify({'path': f'/docs/{filename}', 'filename': filename}), 200
    except Exception as e:
        logging.error(f'Erro ao exportar histórico para docs: {str(e)}')
        return jsonify({'error': 'Erro ao exportar histórico'}), 500


@app.route('/api/statistics', methods=['GET'])
@login_required
def get_statistics():
    """Retorna estatísticas completas calculadas no backend"""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            
            # Livros
            cursor.execute('SELECT COUNT(*) as total FROM livros')
            total_books = cursor.fetchone()['total']
            
            cursor.execute('SELECT COUNT(*) as available FROM livros WHERE available = 1')
            available_books = cursor.fetchone()['available']
            
            cursor.execute('SELECT COUNT(*) as borrowed FROM livros WHERE available = 0')
            borrowed_books = cursor.fetchone()['borrowed']
            
            # Alunos
            cursor.execute('SELECT COUNT(*) as total FROM estudantes')
            total_students = cursor.fetchone()['total']
            
            # Histórico
            cursor.execute('SELECT COUNT(*) as total FROM "histórico de empréstimo"')
            total_loans = cursor.fetchone()['total']
            
            cursor.execute('SELECT COUNT(*) as active FROM "histórico de empréstimo" WHERE returnDate IS NULL')
            active_loans = cursor.fetchone()['active']
            
            cursor.execute('SELECT COUNT(*) as returned FROM "histórico de empréstimo" WHERE returnDate IS NOT NULL')
            returned_loans = cursor.fetchone()['returned']
            
            # Calcular taxas
            loan_rate = 0
            return_rate = 0
            
            if total_books > 0:
                loan_rate = round((borrowed_books / total_books) * 100, 1)
            
            if total_loans > 0:
                return_rate = round((returned_loans / total_loans) * 100, 1)
            
            # Multas totais
            cursor.execute('SELECT SUM(fine) as total_fines FROM "histórico de empréstimo" WHERE fine IS NOT NULL')
            fines_result = cursor.fetchone()
            total_fines = fines_result['total_fines'] if fines_result['total_fines'] else 0
            
            statistics = {
                'books': {
                    'total': total_books,
                    'available': available_books,
                    'borrowed': borrowed_books
                },
                'students': {
                    'total': total_students
                },
                'loans': {
                    'total': total_loans,
                    'active': active_loans,
                    'returned': returned_loans
                },
                'rates': {
                    'loan_rate': loan_rate,
                    'return_rate': return_rate
                },
                'fines': {
                    'total': round(total_fines, 2)
                }
            }
            
            logging.info('Estatísticas calculadas com sucesso')
            return jsonify(statistics), 200
            
    except sqlite3.Error as e:
        logging.error(f'Erro ao calcular estatísticas: {str(e)}')
        return jsonify({'error': 'Erro ao calcular estatísticas'}), 500
    except Exception as e:
        logging.error(f'Erro inesperado ao calcular estatísticas: {str(e)}')
        return jsonify({'error': 'Erro ao calcular estatísticas'}), 500


@app.route('/api/validate_data', methods=['POST'])
@login_required
def validate_data():
    """Valida dados complexos no backend antes de processar"""
    try:
        data = request.get_json(silent=True)
        if not data:
            return jsonify({'valid': False, 'errors': ['Dados inválidos']}), 400
        
        data_type = data.get('type')
        errors = []
        
        # Validação de livro
        if data_type == 'book':
            title = data.get('title', '').strip()
            author = data.get('author', '').strip()
            isbn = data.get('isbn', '').strip()
            
            if not title or len(title) < 2:
                errors.append('Título deve ter pelo menos 2 caracteres')
            if not author or len(author) < 2:
                errors.append('Autor deve ter pelo menos 2 caracteres')
            if not isbn:
                errors.append('ISBN é obrigatório')
            else:
                clean_isbn = re.sub(r'[-\s]', '', isbn)
                if not re.match(r'^\d{10}(\d{3})?$', clean_isbn):
                    errors.append('ISBN deve ter 10 ou 13 dígitos')
                    
                # Verificar duplicidade
                with get_db_connection() as conn:
                    cursor = conn.cursor()
                    book_id = data.get('id')
                    if book_id:
                        cursor.execute('SELECT id FROM livros WHERE isbn = ? AND id != ?', (isbn, book_id))
                    else:
                        cursor.execute('SELECT id FROM livros WHERE isbn = ?', (isbn,))
                    if cursor.fetchone():
                        errors.append('ISBN já cadastrado')
        
        # Validação de aluno
        elif data_type == 'student':
            name = data.get('name', '').strip()
            turma = data.get('turma', '').strip()
            
            if not name or len(name) < 3:
                errors.append('Nome deve ter pelo menos 3 caracteres')
            if not turma:
                errors.append('Turma é obrigatória')
            
            # Verificar duplicidade
            with get_db_connection() as conn:
                cursor = conn.cursor()
                student_id = data.get('id')
                if student_id:
                    cursor.execute('SELECT id FROM estudantes WHERE LOWER(name) = LOWER(?) AND id != ?', (name, student_id))
                else:
                    cursor.execute('SELECT id FROM estudantes WHERE LOWER(name) = LOWER(?)', (name,))
                if cursor.fetchone():
                    errors.append('Aluno com este nome já existe')
        
        if errors:
            return jsonify({'valid': False, 'errors': errors}), 400
        
        return jsonify({'valid': True, 'message': 'Dados válidos'}), 200
        
    except Exception as e:
        logging.error(f'Erro na validação de dados: {str(e)}')
        return jsonify({'valid': False, 'errors': ['Erro ao validar dados']}), 500


if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
