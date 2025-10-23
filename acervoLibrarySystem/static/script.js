let currentBooks = [];
let currentHistory = [];
let currentBorrowHistory = [];

function showNotification(message, type = 'success') {
    const notify = new Notify();
    notify.show(message, type);
}

function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-link').forEach(link => link.classList.remove('active'));

    const tabElement = document.getElementById(tabId);
    const linkElement = document.querySelector(`.tab-link[data-tab="${tabId}"]`);

    if (tabElement && linkElement) {
        tabElement.classList.add('active');
        linkElement.classList.add('active');
        window.location.hash = tabId;

        if (tabId === 'available-books') {
            loadBooks('book-grid', 'available');
        } else if (tabId === 'borrowed-books') {
            loadBooks('borrowed-grid', 'borrowed');
        } else if (tabId === 'history') {
            loadHistory();
        }
    } else {
        console.error(`Aba ou link não encontrado para ID: ${tabId}`);
        showNotification('Erro ao alternar aba.', 'error');
    }
}

function loadBooks(gridId, filter = 'all') {
    const grid = document.getElementById(gridId);
    if (!grid) {
        console.error(`Grid não encontrado: ${gridId}`);
        return;
    }

    grid.innerHTML = '<div class="loader">Carregando...</div>';

    fetch('/api/books')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            return response.json();
        })
        .then(data => {
            currentBooks = data;
            return fetch('/api/history');
        })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            return response.json();
        })
        .then(data => {
            currentBorrowHistory = data.borrowed_books;
            console.log('Histórico de empréstimos carregado:', currentBorrowHistory);
            renderBooks(gridId, filter);
        })
        .catch(error => {
            console.error('Erro ao carregar livros ou histórico:', error);
            showNotification('Erro ao carregar livros.', 'error');
            grid.innerHTML = '<p>Erro ao carregar livros.</p>';
        });
}

function renderBooks(gridId, filter) {
    const bookGrid = document.getElementById(gridId);
    if (!bookGrid) return;

    bookGrid.innerHTML = '';
    const searchInput = document.getElementById(`search-${gridId === 'book-grid' ? 'books' : 'borrowed'}`);
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';

    const filteredBooks = currentBooks.filter(book => {
        if (filter === 'available' && !book.available) return false;
        if (filter === 'borrowed' && book.available) return false;
        return (
            book.title.toLowerCase().includes(searchTerm) ||
            book.author?.toLowerCase().includes(searchTerm) ||
            book.isbn.toLowerCase().includes(searchTerm)
        );
    });

    if (filteredBooks.length === 0) {
        bookGrid.innerHTML = '<p>Nenhum livro encontrado.</p>';
        return;
    }

    filteredBooks.forEach(book => {
        const bookItem = document.createElement('div');
        bookItem.classList.add('book-item');
        const safeTitle = book.title.replace(/'/g, "\\'");

        if (filter === 'available') {
            bookItem.innerHTML = `
                <span class="book-title" onclick="showBookDetails(${book.id})">${book.title}</span>
                <span>${book.author}</span>
                <span>${book.isbn}</span>
                <span class="status-available">Disponível</span>
                <button class="borrow-btn" onclick="borrowBook(event, ${book.id}, '${safeTitle}')">Emprestar</button>
                <button class="remove-btn" onclick="deleteBook(event, ${book.id}, '${safeTitle}')">Excluir</button>
            `;
        } else if (filter === 'borrowed') {
            const history = currentBorrowHistory.find(h => h.book_id === book.id);
            let borrowDate = 'Não registrado';
            let returnDate = 'Não registrado';
            let fine = 0.0;
                let borrowerName = '';

            if (history && history.borrow_date) {
                borrowDate = new Date(history.borrow_date).toLocaleDateString('pt-BR');
                    // tentar obter nome do aluno a partir de possíveis campos retornados pela API
                    borrowerName = history.student_name || history.student || history.borrower_name || history.borrower || history.name || '';
                if (!history.return_date) {
                    const borrowDateObj = new Date(history.borrow_date);
                    const expectedReturnDate = new Date(borrowDateObj.setDate(borrowDateObj.getDate() + 10));
                    returnDate = expectedReturnDate.toLocaleDateString('pt-BR');
                    const today = new Date();
                    const daysOverdue = Math.max(0, Math.floor((today - expectedReturnDate) / (1000 * 60 * 60 * 24)));
                    fine = daysOverdue * 0.25;
                }
            }

                // montar bloco de informações incluindo nome do aluno quando disponível
                const borrowerHtml = borrowerName ? `<div>Aluno: <strong>${borrowerName}</strong></div>` : '';

                bookItem.innerHTML = `
                    <span class="book-title" onclick="showBookDetails(${book.id})">${book.title}</span>
                    <span>${book.author}</span>
                    <span>${book.isbn}</span>
                    <span class="borrow-info">
                        ${borrowerHtml}
                        <div>Empréstimo: ${borrowDate}</div>
                        <div>Devolução Prevista: ${returnDate}</div>
                        <div>Multa: <span class="fine-amount">R$${formatFine(fine)}</span></div>
                    </span>
                    <button class="return-btn" onclick="returnBook(event, ${book.id}, '${safeTitle}')">Devolver</button>
                `;
        }

        bookGrid.appendChild(bookItem);
    });
}

function formatFine(amount) {
    return amount.toFixed(2).replace('.', ',');
}

function showBookDetails(bookId) {
    const book = currentBooks.find(b => b.id === bookId);
    if (!book) {
        showNotification('Livro não encontrado.', 'error');
        return;
    }
    document.getElementById('details-title').textContent = `Título: ${book.title}`;
    document.getElementById('details-author').textContent = `Autor: ${book.author}`;
    document.getElementById('details-isbn').textContent = `ISBN: ${book.isbn}`;
    document.getElementById('details-status').textContent = `Status: ${book.available ? 'Disponível' : 'Emprestado'}`;
    document.getElementById('book-details-modal').setAttribute('aria-hidden', 'false');
}

function borrowBook(event, bookId, bookTitle) {
    event.stopPropagation();
    const book = currentBooks.find(b => b.id === bookId);
    if (!book) {
        showNotification('Livro não encontrado.', 'error');
        return;
    }

    document.getElementById('borrow-title').textContent = `Título: ${book.title}`;
    document.getElementById('borrow-author').textContent = `Autor: ${book.author}`;
    document.getElementById('borrow-isbn').textContent = `ISBN: ${book.isbn}`;

    const modal = document.getElementById('borrow-modal');
    modal.setAttribute('aria-hidden', 'false');
    document.getElementById('confirm-borrow-btn').dataset.bookId = bookId;
    document.getElementById('confirm-borrow-btn').dataset.bookTitle = bookTitle;

    // foco no input de nome do aluno e limpar valor anterior
    const studentInput = document.getElementById('borrow-student-name');
    if (studentInput) {
        studentInput.value = '';
        setTimeout(() => studentInput.focus(), 100);
    }
}

function confirmBorrow(event) {
    event.preventDefault();
    const bookId = parseInt(document.getElementById('confirm-borrow-btn').dataset.bookId);
    const bookTitle = document.getElementById('confirm-borrow-btn').dataset.bookTitle;
    const studentName = document.getElementById('borrow-student-name')?.value.trim() || '';

    if (!studentName) {
        showNotification('Por favor, informe o nome do aluno.', 'error');
        return;
    }

    console.log(`Iniciando empréstimo do livro ID: ${bookId}, Título: ${bookTitle}`);
    const confirmBtn = document.getElementById('confirm-borrow-btn');
    confirmBtn.disabled = true;
    confirmBtn.textContent = 'Emprestando...';

    fetch('/api/borrow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: bookId, student_name: studentName })
    })
        .then(response => {
            console.log(`Resposta do /api/borrow: Status ${response.status}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            return response.json();
        })
        .then(data => {
            console.log('Empréstimo bem-sucedido:', data);
            showNotification(`Livro "${bookTitle}" emprestado com sucesso!`, 'success');
            const modal = document.getElementById('borrow-modal');
            modal.setAttribute('aria-hidden', 'true');
            // limpar campo e reativar botão
            document.getElementById('borrow-student-name').value = '';
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Emprestar';
            loadBooks('book-grid', 'available');
            loadBooks('borrowed-grid', 'borrowed');
        })
        .catch(error => {
            console.error('Erro ao emprestar livro:', error);
            showNotification('Erro ao emprestar livro.', 'error');
            confirmBtn.disabled = false;
            confirmBtn.textContent = 'Emprestar';
        });
}

function returnBook(event, bookId, bookTitle) {
    event.stopPropagation();
    const book = currentBooks.find(b => b.id === bookId);
    const history = currentBorrowHistory.find(h => h.book_id === bookId);
    if (!book || !history) {
        console.error('Livro ou histórico não encontrado:', { bookId, book, history });
        showNotification('Livro ou histórico não encontrado.', 'error');
        return;
    }

    console.log('Dados do histórico para devolução:', history);

    const borrowDate = new Date(history.borrow_date);
    const expectedReturnDate = new Date(borrowDate);
    expectedReturnDate.setDate(borrowDate.getDate() + 10);
    const today = new Date();
    const daysOverdue = Math.max(0, Math.floor((today - expectedReturnDate) / (1000 * 60 * 60 * 24)));
    const fine = daysOverdue * 0.25;

    document.getElementById('return-title').textContent = `Título: ${book.title}`;
    document.getElementById('return-author').textContent = `Autor: ${book.author}`;
    document.getElementById('return-isbn').textContent = `ISBN: ${book.isbn}`;
    // preencher nome do aluno, se disponível
    const borrowerName = history.student_name || history.student || history.borrower_name || history.borrower || history.name || '';
    document.getElementById('return-student-name').textContent = borrowerName ? `Aluno: ${borrowerName}` : '';
    document.getElementById('return-borrow-date').textContent = `Data de Empréstimo: ${borrowDate.toLocaleDateString('pt-BR')}`;
    document.getElementById('return-expected-date').textContent = `Data Esperada de Devolução: ${expectedReturnDate.toLocaleDateString('pt-BR')}`;
    document.getElementById('return-fine').textContent = `Multa: R$${formatFine(fine)}`;
    const confirmModal = document.getElementById('return-confirm-modal');
    confirmModal.setAttribute('aria-hidden', 'false');

    document.getElementById('confirm-return-btn').dataset.bookId = bookId;
    document.getElementById('confirm-return-btn').dataset.bookTitle = bookTitle;
}

// handlers para fechar/cancelar modais e ESC
document.addEventListener('DOMContentLoaded', () => {
    // borrow modal handlers
    const borrowModal = document.getElementById('borrow-modal');
    document.getElementById('close-borrow-modal')?.addEventListener('click', () => borrowModal.setAttribute('aria-hidden', 'true'));
    document.getElementById('cancel-borrow-btn')?.addEventListener('click', () => borrowModal.setAttribute('aria-hidden', 'true'));

    // return confirm modal handlers
    const returnModal = document.getElementById('return-confirm-modal');
    document.getElementById('close-return-confirm-modal')?.addEventListener('click', () => returnModal.setAttribute('aria-hidden', 'true'));
    document.getElementById('cancel-return-btn')?.addEventListener('click', () => returnModal.setAttribute('aria-hidden', 'true'));

    // fechar com ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            borrowModal?.setAttribute('aria-hidden', 'true');
            returnModal?.setAttribute('aria-hidden', 'true');
        }
    });

    // fechar ao clicar fora do conteúdo
    [borrowModal, returnModal].forEach(modal => {
        modal?.addEventListener('click', (e) => {
            if (e.target === modal) modal.setAttribute('aria-hidden', 'true');
        });
    });
});

function confirmReturn(event) {
    event.preventDefault();
    const bookId = parseInt(document.getElementById('confirm-return-btn').dataset.bookId);
    const bookTitle = document.getElementById('confirm-return-btn').dataset.bookTitle;

    console.log(`Iniciando devolução do livro ID: ${bookId}, Título: ${bookTitle}`);
    fetch('/api/return', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: bookId })
    })
        .then(response => {
            console.log(`Resposta do /api/return: Status ${response.status}`);
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            return response.json();
        })
        .then(data => {
            console.log('Devolução bem-sucedida:', data);
            showNotification(`Livro "${bookTitle}" devolvido com sucesso!`, 'success');
            document.getElementById('return-confirm-modal').setAttribute('aria-hidden', 'true');
            if (data.fine > 0) {
                document.getElementById('modal-book-title').textContent = `Livro: ${bookTitle}`;
                document.getElementById('modal-return-date').textContent = `Data de Devolução: ${new Date(data.return_date).toLocaleDateString('pt-BR')}`;
                document.getElementById('modal-fine').textContent = `Multa: R$${formatFine(data.fine)}`;
                document.getElementById('return-modal').setAttribute('aria-hidden', 'false');
            }
            loadBooks('book-grid', 'available');
            loadBooks('borrowed-grid', 'borrowed');
            loadHistory();
        })
        .catch(error => {
            console.error('Erro ao devolver livro:', error);
            showNotification('Erro ao devolver livro.', 'error');
        });
}

function deleteBook(event, bookId, bookTitle) {
    event.stopPropagation();
    if (!confirm(`Tem certeza que deseja excluir o livro "${bookTitle}"? Esta ação não pode be desfeita.`)) {
        return;
    }

    fetch('/api/delete_book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: bookId })
    })
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            return response.json();
        })
        .then(data => {
            showNotification(`Livro "${bookTitle}" excluído com sucesso!`, 'success');
            loadBooks('book-grid', 'available');
        })
        .catch(error => {
            console.error('Erro ao excluir livro:', error);
            showNotification('Erro ao excluir livro.', 'error');
        });
}

function addBook() {
    const title = document.getElementById('add-title').value.trim();
    const author = document.getElementById('add-author').value.trim();
    const isbn = document.getElementById('add-isbn').value.trim();

    console.log('Tentando adicionar livro:', { title, author, isbn });

    if (!title || !author || !isbn) {
        showNotification('Por favor, preencha todos os campos.', 'error');
        return;
    }

    const cleanIsbn = isbn.replace(/[-\s]/g, '');
    if (!/^\d{10}(\d{3})?$/.test(cleanIsbn)) {
        showNotification('ISBN inválido. Use 10 ou 13 dígitos.', 'error');
        return;
    }

    const submitBtn = document.querySelector('#add-book-form button');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adicionando...';

    fetch('/api/add_book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, author, isbn })
    })
        .then(response => {
            console.log('Resposta do servidor:', response);
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(`HTTP ${response.status}: ${err.error || response.statusText}`);
                });
            }
            return response.json();
        })
        .then(data => {
            showNotification(`Livro "${title}" adicionado com sucesso!`, 'success');
            document.getElementById('add-book-form').reset();
            loadBooks('book-grid', 'available');
        })
        .catch(error => {
            console.error('Erro ao adicionar livro:', error);
            showNotification(`Erro ao adicionar livro: ${error.message}`, 'error');
        })
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Adicionar Livro';
        });
}

function loadHistory() {
    const historyList = document.getElementById('history-list');
    if (!historyList) {
        console.error('Lista de histórico não encontrada.');
        return;
    }

    historyList.innerHTML = '<div class="loader">Carregando...</div>';
    fetch('/api/history')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            return response.json();
        })
        .then(data => {
            currentHistory = data.returned_books.concat(data.borrowed_books);
            console.log('Histórico completo carregado:', currentHistory);
            renderHistory();
        })
        .catch(error => {
            console.error('Erro ao carregar histórico:', error);
            showNotification('Erro ao carregar histórico.', 'error');
            historyList.innerHTML = '<p>Erro ao carregar histórico.</p>';
        });
}

function renderHistory() {
    const historyList = document.getElementById('history-list');
    if (!historyList) return;

    historyList.innerHTML = '';
    const searchTerm = document.getElementById('search-history')?.value.toLowerCase().trim() || '';

    const filteredHistory = currentHistory.filter(item => 
        item.title?.toLowerCase().includes(searchTerm) || 
        item.author?.toLowerCase().includes(searchTerm)
    );

    if (filteredHistory.length === 0) {
        historyList.innerHTML = '<p>Nenhum registro encontrado.</p>';
        return;
    }

    filteredHistory.forEach(item => {
        const historyItem = document.createElement('div');
        historyItem.classList.add('history-item');
        historyItem.innerHTML = `
            <span>${item.title || 'Desconhecido'}</span>
            <span>${item.author || 'Desconhecido'}</span>
            <span>${new Date(item.borrow_date).toLocaleDateString('pt-BR')}</span>
            <span>${item.return_date ? new Date(item.return_date).toLocaleDateString('pt-BR') : 'Não devolvido'}</span>
            <span class="fine-amount">${item.fine ? `R$${formatFine(item.fine)}` : 'R$0,00'}</span>
        `;
        historyList.appendChild(historyItem);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM carregado corretamente. Inicializando sistema...');
    const hash = window.location.hash.slice(1) || 'add-book';
    showTab(hash);

    document.querySelectorAll('.tab-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const tabId = link.getAttribute('data-tab');
            console.log('Clicou na aba:', tabId);
            showTab(tabId);
        });
    });

    document.getElementById('add-book-form')?.addEventListener('submit', (e) => {
        e.preventDefault();
        console.log('Formulário de adicionar livro submetido.');
        addBook();
    });

    document.getElementById('close-return-modal')?.addEventListener('click', () => {
            document.getElementById('return-modal').setAttribute('aria-hidden', 'true');
    });

    document.getElementById('close-details-modal')?.addEventListener('click', () => {
    document.getElementById('book-details-modal').setAttribute('aria-hidden', 'true');
    });

    document.getElementById('close-borrow-modal')?.addEventListener('click', () => {
    document.getElementById('borrow-modal').setAttribute('aria-hidden', 'true');
    });

    document.getElementById('confirm-borrow-btn')?.addEventListener('click', confirmBorrow);

    document.getElementById('close-return-confirm-modal')?.addEventListener('click', () => {
    document.getElementById('return-confirm-modal').setAttribute('aria-hidden', 'true');
    });

    document.getElementById('confirm-return-btn')?.addEventListener('click', confirmReturn);

    document.getElementById('search-books')?.addEventListener('input', () => renderBooks('book-grid', 'available'));
    document.getElementById('search-borrowed')?.addEventListener('input', () => renderBooks('borrowed-grid', 'borrowed'));
    document.getElementById('search-history')?.addEventListener('input', () => renderHistory());
});