from flask import Flask, request, jsonify, render_template
from flask_cors import CORS
import logging
import sqlite3
from datetime import datetime
import os
import re
from dotenv import load_dotenv

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

def init_db():
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    email TEXT UNIQUE NOT NULL
                )
            ''')
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS books (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    title TEXT NOT NULL,
                    author TEXT NOT NULL,
                    isbn TEXT NOT NULL UNIQUE,
                    available BOOLEAN NOT NULL
                )
            ''')
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS borrowhistory (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    bookId INTEGER NOT NULL,
                    userId INTEGER NOT NULL,
                    student_name TEXT,
                    borrowDate TEXT NOT NULL,
                    returnDate TEXT,
                    fine REAL,
                    FOREIGN KEY (bookId) REFERENCES books(id),
                    FOREIGN KEY (userId) REFERENCES users(id)
                )
            ''')
            cursor.execute('INSERT OR IGNORE INTO users (id, email) VALUES (?, ?)', 
                           (1, 'generic@example.com'))
            # Se a coluna student_name não existir (banco antigo), adiciona-la
            cursor.execute("PRAGMA table_info(borrowhistory)")
            cols = [row['name'] for row in cursor.fetchall()]
            if 'student_name' not in cols:
                try:
                    cursor.execute('ALTER TABLE borrowhistory ADD COLUMN student_name TEXT')
                    logging.info('Coluna student_name adicionada à tabela borrowhistory.')
                except sqlite3.Error as e:
                    logging.error(f'Erro ao adicionar coluna student_name: {str(e)}')
            conn.commit()
            logging.info('Banco de dados inicializado com sucesso.')
    except sqlite3.Error as e:
        logging.error(f'Erro ao inicializar banco de dados: {str(e)}')
    except Exception as e:
        logging.error(f'Erro inesperado ao inicializar banco de dados: {str(e)}')

init_db()

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/history')
def history():
    return render_template('history.html')

@app.route('/api/books', methods=['GET'])
def get_books():
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM books')
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
    try:
        data = request.get_json(silent=True)
        if not data:
            logging.error('Dados JSON inválidos recebidos.')
            return jsonify({'error': 'Dados inválidos ou ausentes'}), 400
        title = data.get('title', '').strip()
        author = data.get('author', '').strip()
        isbn = data.get('isbn', '').strip()
        logging.info(f'Tentativa de adicionar livro: title={title}, isbn={isbn}')
        if not all([title, author, isbn]):
            logging.error('Campos obrigatórios ausentes.')
            return jsonify({'error': 'Todos os campos são obrigatórios'}), 400
        clean_isbn = re.sub(r'[-\s]', '', isbn)
        if not re.match(r'^\d{10}(\d{3})?$', clean_isbn):
            logging.error(f'ISBN inválido: {isbn}')
            return jsonify({'error': 'ISBN inválido. Use 10 ou 13 dígitos.'}), 400
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT id FROM books WHERE isbn = ?', (isbn,))
            if cursor.fetchone():
                logging.error(f'ISBN duplicado: {isbn}')
                return jsonify({'error': 'ISBN já cadastrado'}), 400
            cursor.execute('''
                INSERT INTO books (title, author, isbn, available)
                VALUES (?, ?, ?, ?)
            ''', (title, author, isbn, True))
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

@app.route('/api/borrow', methods=['POST'])
def borrow_book():
    try:
        data = request.get_json(silent=True)
        if not data:
            logging.error('Dados JSON inválidos recebidos.')
            return jsonify({'error': 'Dados inválidos ou ausentes'}), 400
        book_id = data.get('book_id')
        student_name = (data.get('student_name') or '').strip()
        if not book_id:
            logging.error('ID do livro ausente.')
            return jsonify({'error': 'ID do livro é obrigatório'}), 400
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute('SELECT * FROM books WHERE id = ? AND available = ?', (book_id, True))
            book = cursor.fetchone()
            if not book:
                logging.error(f'Livro {book_id} não disponível ou não encontrado.')
                return jsonify({'error': 'Livro não disponível ou não encontrado'}), 400
            cursor.execute('UPDATE books SET available = ? WHERE id = ?', (False, book_id))
            cursor.execute('''
                INSERT INTO borrowhistory (bookId, userId, student_name, borrowDate)
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
            cursor.execute('SELECT * FROM borrowhistory WHERE bookId = ? AND returnDate IS NULL', (book_id,))
            history = cursor.fetchone()
            if not history:
                logging.error(f'Empréstimo não encontrado para livro {book_id}.')
                return jsonify({'error': 'Empréstimo não encontrado'}), 400
            borrow_date = datetime.fromisoformat(history['borrowDate'])
            return_date = datetime.now()
            days = (return_date - borrow_date).days
            fine = max(0, (days - 10) * 0.25)  # Multa de R$0.25 por dia após 10 dias
            cursor.execute('''
                UPDATE borrowhistory SET returnDate = ?, fine = ?
                WHERE id = ?
            ''', (return_date.isoformat(), fine, history['id']))
            cursor.execute('UPDATE books SET available = ? WHERE id = ?', (True, book_id))
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
            cursor.execute('SELECT * FROM books WHERE id = ? AND available = ?', (book_id, True))
            book = cursor.fetchone()
            if not book:
                logging.error(f'Livro {book_id} não disponível ou não encontrado.')
                return jsonify({'error': 'Livro não disponível ou não encontrado'}), 400
            cursor.execute('DELETE FROM books WHERE id = ?', (book_id,))
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
                SELECT b.id, b.title, b.author, b.isbn, COUNT(bh.id) as borrow_count
                FROM books b
                LEFT JOIN borrowhistory bh ON b.id = bh.bookId
                GROUP BY b.id, b.title, b.author, b.isbn
            ''')
            added_books = [{
                'id': row['id'],
                'title': row['title'] or 'Desconhecido',
                'author': row['author'] or 'Desconhecido',
                'isbn': row['isbn'] or 'N/A',
                'borrow_count': row['borrow_count']
            } for row in cursor.fetchall()]
            # Livros emprestados (borrowhistory com returnDate NULL)
            cursor.execute('''
                SELECT bh.id, bh.bookId, bh.borrowDate, bh.returnDate, bh.fine,
                       bh.student_name, b.title, b.author, b.isbn
                FROM borrowhistory bh
                LEFT JOIN books b ON bh.bookId = b.id
                WHERE bh.returnDate IS NULL
            ''')
            borrowed_books = [{
                'id': row['id'],
                'book_id': row['bookId'],
                'title': row['title'] or 'Desconhecido',
                'author': row['author'] or 'Desconhecido',
                'isbn': row['isbn'] or 'N/A',
                'borrow_date': row['borrowDate'],
                'return_date': row['returnDate'],
                'fine': row['fine'] if row['fine'] is not None else 0.0,
                'student_name': row['student_name'] or ''
            } for row in cursor.fetchall()]
            # Livros devolvidos (borrowhistory com returnDate não NULL)
            cursor.execute('''
                SELECT bh.id, bh.bookId, bh.borrowDate, bh.returnDate, bh.fine,
                       bh.student_name, b.title, b.author, b.isbn
                FROM borrowhistory bh
                LEFT JOIN books b ON bh.bookId = b.id
                WHERE bh.returnDate IS NOT NULL
            ''')
            returned_books = [{
                'id': row['id'],
                'book_id': row['bookId'],
                'title': row['title'] or 'Desconhecido',
                'author': row['author'] or 'Desconhecido',
                'isbn': row['isbn'] or 'N/A',
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

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)