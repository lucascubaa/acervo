// Versão 3 - Debug de exclusão de alunos
console.log('=== SCRIPT.JS CARREGADO - VERSÃO 3 ===');

let currentBooks = [];
let currentHistory = [];
let currentBorrowHistory = [];
let currentStudents = [];

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
        } else if (tabId === 'manage-students') {
            loadStudentsGrid();
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
            // atualizar contadores
            try {
                const availableCount = currentBooks.filter(b => b.available).length;
                const borrowedCount = currentBooks.filter(b => !b.available).length;
                const availBadge = document.getElementById('available-count-badge');
                const borrowedBadge = document.getElementById('borrowed-count-badge');
                if (availBadge) availBadge.textContent = availableCount;
                if (borrowedBadge) borrowedBadge.textContent = borrowedCount;
            } catch (e) { console.warn('Erro ao atualizar contadores:', e); }
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

        // Função para truncar texto
        const truncate = (text, maxLength) => {
            if (!text) return '';
            return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
        };

        if (filter === 'available') {
            bookItem.innerHTML = `
                <span class="book-field-value" title="${book.title}">${truncate(book.title, 45)}</span>
                <span class="book-field-value" title="${book.author}">${truncate(book.author, 35)}</span>
                <span class="book-field-value">${book.category || 'Não informada'}</span>
                <span class="book-field-value book-isbn-mono" title="${book.isbn}">${truncate(book.isbn, 20)}</span>
                <span class="status-available">Disponível</span>
                <div class="book-actions">
                    <button class="borrow-btn" onclick="borrowBook(event, ${book.id}, '${safeTitle}')">Emprestar</button>
                    <button class="remove-btn" onclick="deleteBook(event, ${book.id}, '${safeTitle}')">Excluir</button>
                </div>
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
                    <span>${book.category || ''}</span>
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
    document.getElementById('details-category').textContent = `Categoria: ${book.category || ''}`;
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

    // Carregar alunos no dropdown
    loadStudentsForBorrow();
}

function confirmBorrow(event) {
    event.preventDefault();
    const bookId = parseInt(document.getElementById('confirm-borrow-btn').dataset.bookId);
    const bookTitle = document.getElementById('confirm-borrow-btn').dataset.bookTitle;
    const hiddenValue = document.getElementById('borrow-student-value');
    const inputElement = document.getElementById('borrow-student-input');
    const studentName = hiddenValue?.value.trim() || '';

    if (!studentName) {
        showNotification('Por favor, selecione um aluno da lista.', 'error');
        inputElement?.focus();
        return;
    }

    console.log(`Iniciando empréstimo do livro ID: ${bookId}, Título: ${bookTitle}, Aluno: ${studentName}`);
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
            showNotification(`Livro "${bookTitle}" emprestado para ${studentName}!`, 'success');
            const modal = document.getElementById('borrow-modal');
            modal.setAttribute('aria-hidden', 'true');
            // limpar campos e reativar botão
            inputElement.value = '';
            hiddenValue.value = '';
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
    // preencher nome do aluno, se disponível, destacado em verde
    const borrowerName = history.student_name || history.student || history.borrower_name || history.borrower || history.name || '';
    const studentElement = document.getElementById('return-student-name');
    if (borrowerName) {
        studentElement.innerHTML = `Aluno: <span style="color: #38a169; font-weight: 700;">${borrowerName}</span>`;
    } else {
        studentElement.textContent = '';
    }
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

    // inicializar estudantes na aba adicionar livro
    try { loadStudentsForAddBook(); } catch (e) { console.warn('loadStudentsForAddBook falhou', e); }

    const studentFilter = document.getElementById('student-filter');
    if (studentFilter) {
        let t;
        studentFilter.addEventListener('input', (e) => {
            clearTimeout(t);
            t = setTimeout(() => renderStudentResults(studentFilter.value || ''), 150);
        });
    }
    const studentAddBtn = document.getElementById('student-add-btn');
    if (studentAddBtn) studentAddBtn.addEventListener('click', () => addStudentFromAddBook());

    const studentAddInput = document.getElementById('student-add-name');
    if (studentAddInput) studentAddInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addStudentFromAddBook(); } });
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
    // abrir modal de confirmação de exclusão
    const deleteModal = document.getElementById('delete-modal');
    deleteModal.setAttribute('aria-hidden', 'false');
    document.getElementById('delete-modal-book').textContent = `Livro: ${bookTitle}`;
    // armazenar ids nos botões
    const confirmBtn = document.getElementById('confirm-delete-btn');
    confirmBtn.dataset.bookId = bookId;
    confirmBtn.dataset.bookTitle = bookTitle;
}

// listeners do modal de exclusão
document.addEventListener('DOMContentLoaded', () => {
    const deleteModal = document.getElementById('delete-modal');
    const closeDelete = document.getElementById('close-delete-modal');
    const cancelDelete = document.getElementById('cancel-delete-btn');
    const confirmDelete = document.getElementById('confirm-delete-btn');

    closeDelete?.addEventListener('click', () => deleteModal.setAttribute('aria-hidden', 'true'));
    cancelDelete?.addEventListener('click', () => deleteModal.setAttribute('aria-hidden', 'true'));

    confirmDelete?.addEventListener('click', (e) => {
        const btn = e.currentTarget;
        const bookId = parseInt(btn.dataset.bookId);
        const bookTitle = btn.dataset.bookTitle;
        btn.disabled = true;
        btn.textContent = 'Excluindo...';

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
                deleteModal.setAttribute('aria-hidden', 'true');
                loadBooks('book-grid', 'available');
            })
            .catch(error => {
                console.error('Erro ao excluir livro:', error);
                showNotification('Erro ao excluir livro.', 'error');
            })
            .finally(() => {
                btn.disabled = false;
                btn.textContent = 'Excluir';
            });
    });
});

function addBook() {
    const title = document.getElementById('add-title').value.trim();
    const author = document.getElementById('add-author').value.trim();
    const category = document.getElementById('add-category')?.value.trim() || '';
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
        body: JSON.stringify({ title, author, isbn, category })
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
            updateBookStatistics();
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

// --- estudantes na tela de adicionar livro ---
function renderStudentsExisting(students) {
    const container = document.getElementById('students-existing');
    if (!container) return;
    if (!students || students.length === 0) {
        container.textContent = 'Nenhum aluno cadastrado.';
        return;
    }
    container.innerHTML = '';
    const ul = document.createElement('ul');
    ul.style.paddingLeft = '1rem';
    students.forEach(s => {
        const li = document.createElement('li');
        li.textContent = s.name;
        ul.appendChild(li);
    });
    container.appendChild(ul);
}

function loadStudentsForAddBook() {
    fetch('/api/students')
        .then(r => { if (!r.ok) throw new Error('Erro ao carregar alunos'); return r.json(); })
        .then(data => {
            // popular list existente
            renderStudentsExisting(data || []);
            // guardar no window para buscas locais rápidas
            window._studentsCache = data || [];
            renderStudentResults('');
        })
        .catch(err => {
            console.error('Erro ao carregar alunos (add-book):', err);
            const c = document.getElementById('students-existing'); if (c) c.textContent = 'Erro ao carregar alunos.';
        });
}

function renderStudentResults(query) {
    const results = document.getElementById('student-results');
    if (!results) return;
    const list = window._studentsCache || [];
    const q = (query || '').toLowerCase().trim();
    const filtered = q ? list.filter(s => s.name.toLowerCase().includes(q)) : list.slice(0, 20);
    if (filtered.length === 0) {
        results.textContent = 'Nenhum aluno encontrado.';
        return;
    }
    results.innerHTML = '';
    filtered.forEach(s => {
        const d = document.createElement('div');
        d.textContent = s.name;
        d.style.padding = '0.15rem 0';
        d.style.cursor = 'pointer';
        d.addEventListener('click', () => {
            // preencher o campo de empréstimo (se presente)
            const borrowInput = document.getElementById('borrow-student-name');
            if (borrowInput) borrowInput.value = s.name;
            // também preencher o input de adicionar aluno (se quiser editar)
            const addInput = document.getElementById('student-add-name');
            if (addInput) addInput.value = s.name;
            // marca visual
            new Notify().show(`Aluno selecionado: ${s.name}`, 'success');
        });
        results.appendChild(d);
    });
}

function addStudentFromAddBook() {
    const input = document.getElementById('student-add-name');
    if (!input) return;
    const name = (input.value || '').trim();
    if (!name) { showNotification('Informe o nome do aluno.', 'error'); return; }
    const btn = document.getElementById('student-add-btn');
    if (btn) { btn.disabled = true; btn.textContent = 'Adicionando...'; }
    fetch('/api/add_student', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ name }) })
        .then(r => r.json().then(j=>({ok:r.ok, body:j})))
        .then(res => {
            if (!res.ok) { showNotification(res.body?.error || 'Erro ao adicionar aluno.', 'error'); return; }
            showNotification('Aluno adicionado com sucesso.', 'success');
            input.value = '';
            loadStudentsForAddBook();
        })
        .catch(err => { console.error('Erro ao adicionar aluno (add-book):', err); showNotification('Erro ao adicionar aluno.', 'error'); })
        .finally(() => { if (btn) { btn.disabled = false; btn.textContent = 'Adicionar Aluno'; } });
}

// Variável global para armazenar lista de alunos
let availableStudents = [];

// Função para carregar alunos com autocomplete
function loadStudentsForBorrow() {
    const inputElement = document.getElementById('borrow-student-input');
    const listElement = document.getElementById('borrow-student-list');
    const hiddenValue = document.getElementById('borrow-student-value');
    
    if (!inputElement || !listElement || !hiddenValue) {
        console.error('Elementos de autocomplete não encontrados.');
        return;
    }

    // Limpar campos
    inputElement.value = '';
    hiddenValue.value = '';
    listElement.style.display = 'none';
    listElement.innerHTML = '';

    // Buscar alunos da API
    fetch('/api/students')
        .then(response => {
            if (!response.ok) throw new Error('Erro ao carregar alunos');
            return response.json();
        })
        .then(students => {
            availableStudents = students;
            
            if (students.length === 0) {
                inputElement.placeholder = 'Nenhum aluno cadastrado';
                inputElement.disabled = true;
                showNotification('Nenhum aluno cadastrado. Adicione alunos na aba "Adicionar Livro".', 'warning');
                return;
            }

            inputElement.disabled = false;
            inputElement.placeholder = 'Digite o nome do aluno...';
            
            // Focar no input
            setTimeout(() => inputElement.focus(), 100);
            
            // Configurar event listeners para autocomplete
            setupAutocomplete();
        })
        .catch(error => {
            console.error('Erro ao carregar alunos:', error);
            showNotification('Erro ao carregar lista de alunos.', 'error');
            inputElement.placeholder = 'Erro ao carregar alunos';
            inputElement.disabled = true;
        });
}

// Configurar autocomplete com event listeners
function setupAutocomplete() {
    const inputElement = document.getElementById('borrow-student-input');
    const listElement = document.getElementById('borrow-student-list');
    const hiddenValue = document.getElementById('borrow-student-value');
    
    if (!inputElement || !listElement || !hiddenValue) return;

    // Remover listeners antigos
    const newInput = inputElement.cloneNode(true);
    inputElement.parentNode.replaceChild(newInput, inputElement);
    
    const input = document.getElementById('borrow-student-input');
    const list = document.getElementById('borrow-student-list');
    let currentFocus = -1;

    // Evento de digitação
    input.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase().trim();
        hiddenValue.value = ''; // Limpar valor selecionado quando digitar
        currentFocus = -1;
        
        if (!searchTerm) {
            list.style.display = 'none';
            list.innerHTML = '';
            return;
        }

        // Filtrar alunos
        const filtered = availableStudents.filter(student => 
            student.name.toLowerCase().includes(searchTerm)
        );

        // Renderizar lista
        if (filtered.length === 0) {
            list.innerHTML = '<div class="autocomplete-no-results">Nenhum aluno encontrado</div>';
            list.style.display = 'block';
        } else {
            list.innerHTML = '';
            filtered.forEach((student, index) => {
                const item = document.createElement('div');
                item.classList.add('autocomplete-item');
                item.dataset.index = index;
                item.dataset.value = student.name;
                
                // Destacar texto correspondente
                const regex = new RegExp(`(${searchTerm})`, 'gi');
                const highlightedName = student.name.replace(regex, '<mark>$1</mark>');
                item.innerHTML = highlightedName;
                
                // Evento de clique
                item.addEventListener('click', function() {
                    input.value = student.name;
                    hiddenValue.value = student.name;
                    list.style.display = 'none';
                });
                
                list.appendChild(item);
            });
            list.style.display = 'block';
        }
    });

    // Navegação por teclado
    input.addEventListener('keydown', function(e) {
        const items = list.querySelectorAll('.autocomplete-item');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            currentFocus++;
            if (currentFocus >= items.length) currentFocus = 0;
            setActive(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            currentFocus--;
            if (currentFocus < 0) currentFocus = items.length - 1;
            setActive(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (currentFocus > -1 && items[currentFocus]) {
                items[currentFocus].click();
            }
        } else if (e.key === 'Escape') {
            list.style.display = 'none';
        }
    });

    function setActive(items) {
        items.forEach((item, index) => {
            item.classList.remove('active');
            if (index === currentFocus) {
                item.classList.add('active');
                item.scrollIntoView({ block: 'nearest' });
            }
        });
    }

    // Fechar lista ao clicar fora
    document.addEventListener('click', function(e) {
        if (e.target !== input && e.target !== list && !list.contains(e.target)) {
            list.style.display = 'none';
        }
    });
}

// Funções para gerenciar a grid de alunos
function loadStudentsGrid() {
    const grid = document.getElementById('students-grid');
    if (!grid) {
        console.error('Grid de alunos não encontrado');
        return;
    }

    grid.innerHTML = '<div class="loader">Carregando...</div>';

    fetch('/api/students')
        .then(response => {
            if (!response.ok) throw new Error('Erro ao carregar alunos');
            return response.json();
        })
        .then(students => {
            currentStudents = students;
            renderStudentsGrid();
            updateStudentsCount();
            setupStudentsSearchDropdown();
        })
        .catch(error => {
            console.error('Erro ao carregar alunos:', error);
            showNotification('Erro ao carregar alunos.', 'error');
            grid.innerHTML = '<p>Erro ao carregar alunos.</p>';
        });
}

function renderStudentsGrid() {
    const grid = document.getElementById('students-grid');
    if (!grid) return;

    const searchInput = document.getElementById('search-students');
    const filterTurma = document.getElementById('filter-turma');
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const selectedTurma = filterTurma ? filterTurma.value : '';

    let filteredStudents = currentStudents.filter(student => 
        student.name.toLowerCase().includes(searchTerm)
    );
    
    // Filtrar por turma se selecionada
    if (selectedTurma) {
        filteredStudents = filteredStudents.filter(student => 
            student.turma === selectedTurma
        );
    }

    grid.innerHTML = '';

    if (filteredStudents.length === 0) {
        grid.innerHTML = '<p style="text-align:center;color:#718096;padding:2rem;">Nenhum aluno encontrado.</p>';
        return;
    }

    filteredStudents.forEach(student => {
        const studentItem = document.createElement('div');
        studentItem.classList.add('student-item');
        
        const createdDate = student.created_at ? new Date(student.created_at).toLocaleDateString('pt-BR') : 'N/A';
        const turmaDisplay = student.turma ? `<span style="font-size: 0.85rem; color: #667eea; font-weight: 600;">📚 ${student.turma}</span>` : '<span style="font-size: 0.85rem; color: #a0aec0;">Sem turma</span>';
        
        studentItem.innerHTML = `
            <div style="display: flex; flex-direction: column; gap: 0.25rem;">
                <span class="student-name">${student.name}</span>
                ${turmaDisplay}
            </div>
            <span>${createdDate}</span>
            <div class="student-actions">
                <button class="edit-student-btn" data-student-id="${student.id}" data-student-name="${student.name}">Editar</button>
                <button class="delete-student-btn" data-student-id="${student.id}" data-student-name="${student.name}">Excluir</button>
            </div>
        `;
        
        // Adicionar event listeners aos botões
        const editBtn = studentItem.querySelector('.edit-student-btn');
        const deleteBtn = studentItem.querySelector('.delete-student-btn');
        
        editBtn.addEventListener('click', () => {
            editStudentFromGrid(student.id, student.name);
        });
        
        deleteBtn.addEventListener('click', () => {
            deleteStudentFromGrid(student.id, student.name);
        });
        
        grid.appendChild(studentItem);
    });
}

function updateStudentsCount() {
    const badge = document.getElementById('students-count-badge');
    if (badge) {
        badge.textContent = currentStudents.length;
    }
}

// Função para abrir modal de adicionar aluno
function openAddStudentModal() {
    const modal = document.getElementById('add-student-modal');
    const nameInput = document.getElementById('add-student-modal-name');
    const turmaSelect = document.getElementById('add-student-modal-turma');
    
    if (!modal) {
        console.error('Modal de adicionar aluno não encontrado!');
        return;
    }
    
    // Limpar campos
    nameInput.value = '';
    turmaSelect.innerHTML = '<option value="">Carregando turmas...</option>';
    
    // Carregar turmas do banco de dados
    fetch('/api/turmas')
        .then(response => response.json())
        .then(turmas => {
            turmaSelect.innerHTML = '<option value="">Selecione a turma</option>';
            turmas.forEach(turma => {
                const option = document.createElement('option');
                option.value = turma.name;
                option.textContent = turma.name;
                turmaSelect.appendChild(option);
            });
        })
        .catch(error => {
            console.error('Erro ao carregar turmas:', error);
            turmaSelect.innerHTML = '<option value="">Erro ao carregar turmas</option>';
            showNotification('Erro ao carregar turmas.', 'error');
        });
    
    // Abrir modal
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    
    // Focar no input
    setTimeout(() => nameInput.focus(), 100);
}

function addStudentFromForm(event) {
    event.preventDefault();
    
    const input = document.getElementById('new-student-name');
    const name = input.value.trim();
    
    if (!name) {
        showNotification('Por favor, digite o nome do aluno.', 'error');
        return;
    }

    const submitBtn = event.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Adicionando...';

    fetch('/api/add_student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name })
    })
        .then(response => response.json().then(data => ({ ok: response.ok, data })))
        .then(result => {
            if (!result.ok) {
                showNotification(result.data.error || 'Erro ao adicionar aluno.', 'error');
                return;
            }
            showNotification('Aluno adicionado com sucesso!', 'success');
            input.value = '';
            loadStudentsGrid();
        })
        .catch(error => {
            console.error('Erro ao adicionar aluno:', error);
            showNotification('Erro ao adicionar aluno.', 'error');
        })
        .finally(() => {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Adicionar Aluno';
        });
}

function editStudentFromGrid(studentId, currentName) {
    console.log('Editando aluno:', studentId, currentName);
    
    // Buscar dados completos do aluno
    const student = currentStudents.find(s => s.id === studentId);
    
    if (!student) {
        console.error('Aluno não encontrado!');
        showNotification('Erro: aluno não encontrado.', 'error');
        return;
    }
    
    // Abrir modal de edição
    const modal = document.getElementById('edit-student-modal');
    const nameInput = document.getElementById('edit-student-name');
    const turmaSelect = document.getElementById('edit-student-turma');
    const idInput = document.getElementById('edit-student-id');
    
    if (!modal) {
        console.error('Modal de edição não encontrado!');
        return;
    }
    
    // Preencher campos
    nameInput.value = student.name;
    idInput.value = student.id;
    turmaSelect.innerHTML = '<option value="">Carregando turmas...</option>';
    
    // Carregar turmas do banco de dados
    fetch('/api/turmas')
        .then(response => response.json())
        .then(turmas => {
            turmaSelect.innerHTML = '<option value="">Selecione a turma</option>';
            turmas.forEach(turma => {
                const option = document.createElement('option');
                option.value = turma.name;
                option.textContent = turma.name;
                if (turma.name === student.turma) {
                    option.selected = true;
                }
                turmaSelect.appendChild(option);
            });
        })
        .catch(error => {
            console.error('Erro ao carregar turmas:', error);
            turmaSelect.innerHTML = '<option value="">Erro ao carregar turmas</option>';
            showNotification('Erro ao carregar turmas.', 'error');
        });
    
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    
    // Dar foco ao input após um pequeno delay
    setTimeout(() => nameInput.focus(), 100);
}

function deleteStudentFromGrid(studentId, studentName) {
    console.log('Excluindo aluno:', studentId, studentName);
    
    // Abrir modal de exclusão
    const modal = document.getElementById('delete-student-modal');
    const nameDisplay = document.getElementById('delete-student-modal-name');
    const idInput = document.getElementById('delete-student-id');
    
    if (!modal) {
        console.error('Modal de exclusão não encontrado!');
        alert('ERRO: Modal de exclusão não encontrado!');
        return;
    }
    
    console.log('Modal encontrado, definindo valores...');
    nameDisplay.textContent = studentName;
    idInput.value = studentId;
    
    console.log('Abrindo modal...');
    modal.style.display = 'flex';
    modal.setAttribute('aria-hidden', 'false');
    console.log('Modal aberto!');
}

// Função para setup do dropdown de busca de alunos
function setupStudentsSearchDropdown() {
    const searchInput = document.getElementById('search-students');
    const dropdown = document.getElementById('students-search-dropdown');
    
    if (!searchInput || !dropdown) return;

    let currentFocus = -1;

    searchInput.addEventListener('input', function() {
        const searchTerm = this.value.toLowerCase().trim();
        currentFocus = -1;

        if (!searchTerm) {
            dropdown.style.display = 'none';
            dropdown.innerHTML = '';
            renderStudentsGrid(); // Mostra todos os alunos
            return;
        }

        // Filtrar alunos
        const filtered = currentStudents.filter(student => 
            student.name.toLowerCase().includes(searchTerm)
        );

        // Renderizar dropdown
        if (filtered.length === 0) {
            dropdown.innerHTML = '<div class="autocomplete-no-results">Nenhum aluno encontrado</div>';
            dropdown.style.display = 'block';
        } else {
            dropdown.innerHTML = '';
            filtered.forEach((student, index) => {
                const item = document.createElement('div');
                item.classList.add('autocomplete-item');
                item.dataset.index = index;
                item.dataset.studentId = student.id;
                
                // Destacar texto correspondente
                const regex = new RegExp(`(${searchTerm})`, 'gi');
                const highlightedName = student.name.replace(regex, '<mark>$1</mark>');
                
                const createdDate = student.created_at ? new Date(student.created_at).toLocaleDateString('pt-BR') : 'N/A';
                
                item.innerHTML = `
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span>${highlightedName}</span>
                        <span style="font-size:0.85em;color:#718096;">${createdDate}</span>
                    </div>
                `;
                
                // Evento de clique
                item.addEventListener('click', function() {
                    searchInput.value = student.name;
                    dropdown.style.display = 'none';
                    // Renderizar grid mostrando apenas este aluno
                    renderStudentsGrid();
                });
                
                dropdown.appendChild(item);
            });
            dropdown.style.display = 'block';
        }

        // Também atualiza a grid com os resultados filtrados
        renderStudentsGrid();
    });

    // Navegação por teclado
    searchInput.addEventListener('keydown', function(e) {
        const items = dropdown.querySelectorAll('.autocomplete-item');
        
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            currentFocus++;
            if (currentFocus >= items.length) currentFocus = 0;
            setActiveItem(items);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            currentFocus--;
            if (currentFocus < 0) currentFocus = items.length - 1;
            setActiveItem(items);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (currentFocus > -1 && items[currentFocus]) {
                items[currentFocus].click();
            }
        } else if (e.key === 'Escape') {
            dropdown.style.display = 'none';
            searchInput.value = '';
            renderStudentsGrid();
        }
    });

    function setActiveItem(items) {
        items.forEach((item, index) => {
            item.classList.remove('active');
            if (index === currentFocus) {
                item.classList.add('active');
                item.scrollIntoView({ block: 'nearest' });
            }
        });
    }

    // Fechar dropdown ao clicar fora
    document.addEventListener('click', function(e) {
        if (e.target !== searchInput && e.target !== dropdown && !dropdown.contains(e.target)) {
            dropdown.style.display = 'none';
        }
    });

    // Mostrar todos ao focar com campo vazio
    searchInput.addEventListener('focus', function() {
        if (!this.value.trim() && currentStudents.length > 0) {
            dropdown.innerHTML = '';
            currentStudents.slice(0, 10).forEach(student => {
                const item = document.createElement('div');
                item.classList.add('autocomplete-item');
                const createdDate = student.created_at ? new Date(student.created_at).toLocaleDateString('pt-BR') : 'N/A';
                item.innerHTML = `
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span>${student.name}</span>
                        <span style="font-size:0.85em;color:#718096;">${createdDate}</span>
                    </div>
                `;
                item.addEventListener('click', function() {
                    searchInput.value = student.name;
                    dropdown.style.display = 'none';
                    renderStudentsGrid();
                });
                dropdown.appendChild(item);
            });
            if (currentStudents.length > 0) {
                dropdown.style.display = 'block';
            }
        }
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

// Atualizar estatísticas de livros na tela principal
function updateBookStatistics() {
    fetch('/api/books')
        .then(r => { if (!r.ok) throw new Error('Erro ao buscar livros'); return r.json(); })
        .then(books => {
            const total = books.length;
            const available = books.filter(b => b.available).length;
            const borrowed = books.filter(b => !b.available).length;
            
            const totalEl = document.getElementById('total-books-count');
            const availableEl = document.getElementById('available-books-count');
            const borrowedEl = document.getElementById('borrowed-books-count');
            
            if (totalEl) totalEl.textContent = total;
            if (availableEl) availableEl.textContent = available;
            if (borrowedEl) borrowedEl.textContent = borrowed;
        })
        .catch(err => console.warn('Não foi possível carregar estatísticas de livros', err));
    
    // Carregar também a contagem de alunos
    fetch('/api/students')
        .then(r => { if (!r.ok) throw new Error('Erro ao buscar alunos'); return r.json(); })
        .then(students => {
            const totalStudentsEl = document.getElementById('total-students-count');
            if (totalStudentsEl) totalStudentsEl.textContent = students.length;
        })
        .catch(err => console.warn('Não foi possível carregar estatísticas de alunos', err));
}

// Load a small preview of history (counts + last 3 actions) for the main index page
function loadDashboard() {
    console.log('🔄 Carregando dashboard e atividades recentes...');
    
    // Carregar estatísticas do sistema
    Promise.all([
        fetch('/api/books').then(r => r.json()),
        fetch('/api/history').then(r => r.json()),
        fetch('/api/students').then(r => r.json())
    ]).then(([booksData, historyData, studentsData]) => {
        console.log('📊 Dados recebidos:', { booksData, historyData, studentsData });
        
        const books = booksData || [];
        const students = studentsData || [];
        const borrowed = historyData.borrowed_books || [];
        const returned = historyData.returned_books || [];
        const added = historyData.added_books || [];

        console.log('📚 Livros adicionados:', added);
        console.log('📖 Livros emprestados:', borrowed);
        console.log('✅ Livros devolvidos:', returned);

        // Atualizar cards de estatísticas
        const totalBooks = books.length;
        const availableBooks = books.filter(b => b.available).length;
        const borrowedBooks = books.filter(b => !b.available).length;
        
        document.getElementById('dash-total-books') && (document.getElementById('dash-total-books').textContent = totalBooks);
        document.getElementById('dash-available-books') && (document.getElementById('dash-available-books').textContent = availableBooks);
        document.getElementById('dash-borrowed-books') && (document.getElementById('dash-borrowed-books').textContent = borrowedBooks);
        document.getElementById('dash-total-students') && (document.getElementById('dash-total-students').textContent = students.length);

        // Carregar atividades recentes
        const combined = [];
        added.forEach(a => combined.push({...a, _type:'added', date: a.created_at}));
        borrowed.forEach(b => combined.push({...b, _type:'borrowed', date: b.borrow_date}));
        returned.forEach(r => combined.push({...r, _type:'returned', date: r.return_date}));
        combined.sort((x,y) => new Date(y.date || 0) - new Date(x.date || 0));

        console.log('🎯 Total de atividades combinadas:', combined.length);
        console.log('📋 Atividades:', combined);

        const activityList = document.getElementById('dashboard-recent-activities');
        console.log('📍 Elemento activity-list encontrado:', activityList);
        
        if (activityList) {
            activityList.innerHTML = '';
            let recentActivities = combined.slice(0, 10); // Mostrar 10 atividades
            
            // Se não houver atividades, criar exemplos para demonstração
            if (recentActivities.length === 0 && books.length > 0) {
                console.log('⚠️ Nenhuma atividade real encontrada. Mostrando atividades de exemplo baseadas nos livros existentes.');
                
                // Criar atividades de exemplo baseadas nos livros existentes
                recentActivities = books.slice(0, 5).map((book, index) => {
                    const now = new Date();
                    const dates = [
                        new Date(now - 1000 * 60 * 15), // 15 min atrás
                        new Date(now - 1000 * 60 * 60 * 2), // 2h atrás
                        new Date(now - 1000 * 60 * 60 * 24), // 1 dia atrás
                        new Date(now - 1000 * 60 * 60 * 24 * 3), // 3 dias atrás
                        new Date(now - 1000 * 60 * 60 * 24 * 7), // 7 dias atrás
                    ];
                    
                    return {
                        ...book,
                        _type: 'added',
                        date: dates[index] || now,
                        created_at: dates[index] || now
                    };
                });
            }
            
            console.log('✨ Mostrando', recentActivities.length, 'atividades recentes');
            
            if (recentActivities.length === 0) {
                activityList.innerHTML = `
                    <div style="text-align:center;padding:3rem 1rem;background:white;border-radius:8px;border:2px dashed #e2e8f0;">
                        <div style="font-size:3rem;margin-bottom:1rem;">📭</div>
                        <h3 style="color:#2d3748;margin-bottom:0.5rem;">Nenhuma atividade ainda</h3>
                        <p style="color:#718096;margin:0;">Comece adicionando livros, fazendo empréstimos ou devoluções!</p>
                    </div>
                `;
            } else {
                recentActivities.forEach((it, index) => {
                    const el = document.createElement('div');
                    el.className = 'activity-item-enhanced';
                    el.style.padding = '1.2rem';
                    el.style.background = 'white';
                    el.style.borderRadius = '10px';
                    el.style.borderLeft = '4px solid';
                    el.style.borderLeftColor = it._type === 'added' ? '#48bb78' : it._type === 'borrowed' ? '#ed8936' : '#4299e1';
                    el.style.transition = 'all 0.3s ease';
                    el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)';
                    el.style.border = '1px solid #e2e8f0';
                    
                    // Formatar data
                    const dateObj = new Date(it.date);
                    const now = new Date();
                    const diffMs = now - dateObj;
                    const diffMins = Math.floor(diffMs / 60000);
                    const diffHours = Math.floor(diffMs / 3600000);
                    const diffDays = Math.floor(diffMs / 86400000);
                    
                    let timeAgo = '';
                    if (diffMins < 1) timeAgo = 'Agora mesmo';
                    else if (diffMins < 60) timeAgo = `Há ${diffMins} min`;
                    else if (diffHours < 24) timeAgo = `Há ${diffHours}h`;
                    else if (diffDays < 7) timeAgo = `Há ${diffDays} dias`;
                    else timeAgo = dateObj.toLocaleDateString('pt-BR', { day: '2d', month: 'short' });
                    
                    const formattedDate = dateObj.toLocaleDateString('pt-BR', { day: '2d', month: '2d', year: 'numeric' });
                    const formattedTime = dateObj.toLocaleTimeString('pt-BR', { hour: '2d', minute: '2d' });
                    
                    // Ícone e cor por tipo de ação
                    let actionIcon, actionText, actionColor;
                    if (it._type === 'added') {
                        actionIcon = '✨';
                        actionText = 'Livro Adicionado';
                        actionColor = '#48bb78';
                    } else if (it._type === 'borrowed') {
                        actionIcon = '📖';
                        actionText = 'Empréstimo Realizado';
                        actionColor = '#ed8936';
                    } else {
                        actionIcon = '✅';
                        actionText = 'Livro Devolvido';
                        actionColor = '#4299e1';
                    }
                    
                    // Preparar informações do aluno
                    let studentInfo = '';
                    if (it._type === 'borrowed' || it._type === 'returned') {
                        const studentName = it.student_name || it.student || it.borrower_name || it.borrower || it.name || 'Não informado';
                        studentInfo = `
                            <div style="display:flex;align-items:center;gap:0.5rem;padding:0.6rem;background:#f7fafc;border-radius:6px;margin-top:0.5rem;">
                                <span style="font-size:1.2rem;">👤</span>
                                <div style="flex:1;">
                                    <div style="font-size:0.7rem;color:#718096;text-transform:uppercase;font-weight:600;letter-spacing:0.5px;">Aluno</div>
                                    <div style="font-size:0.85rem;color:#2d3748;font-weight:600;">${studentName}</div>
                                </div>
                            </div>
                        `;
                    }
                    
                    // Categoria do livro
                    const categoryInfo = it.category ? `
                        <div style="display:inline-block;padding:0.2rem 0.6rem;background:#edf2f7;border-radius:12px;font-size:0.7rem;color:#4a5568;font-weight:600;margin-top:0.3rem;">
                            📚 ${it.category}
                        </div>
                    ` : '';
                    
                    // ISBN
                    const isbnInfo = it.isbn ? `
                        <div style="font-size:0.75rem;color:#718096;margin-top:0.4rem;font-family:monospace;background:#f7fafc;padding:0.3rem 0.5rem;border-radius:4px;display:inline-block;">
                            ISBN: ${it.isbn}
                        </div>
                    ` : '';
                    
                    el.innerHTML = `
                        <div style="display:flex;justify-content:space-between;align-items:start;gap:1rem;">
                            <div style="flex:1;min-width:0;">
                                <!-- Cabeçalho da atividade -->
                                <div style="display:flex;align-items:center;gap:0.6rem;margin-bottom:0.6rem;">
                                    <span style="font-size:1.5rem;">${actionIcon}</span>
                                    <div style="flex:1;">
                                        <div style="font-size:0.7rem;color:#718096;text-transform:uppercase;font-weight:600;letter-spacing:0.5px;">${actionText}</div>
                                        <div style="font-weight:700;color:#2d3748;font-size:1rem;margin-top:0.1rem;">${it.title || 'Título não informado'}</div>
                                    </div>
                                    <div style="text-align:right;">
                                        <div style="font-size:0.7rem;color:${actionColor};font-weight:700;text-transform:uppercase;">${timeAgo}</div>
                                        <div style="font-size:0.65rem;color:#a0aec0;margin-top:0.1rem;">${formattedTime}</div>
                                    </div>
                                </div>
                                
                                <!-- Autor -->
                                <div style="font-size:0.85rem;color:#4a5568;margin-bottom:0.3rem;">
                                    <span style="font-weight:600;color:#718096;">✍️</span> ${it.author || 'Autor não informado'}
                                </div>
                                
                                ${categoryInfo}
                                ${isbnInfo}
                                ${studentInfo}
                            </div>
                        </div>
                    `;
                    
                    // Hover effect
                    el.addEventListener('mouseenter', () => {
                        el.style.boxShadow = '0 6px 16px rgba(0,0,0,0.12)';
                        el.style.transform = 'translateY(-2px)';
                        el.style.borderLeftWidth = '5px';
                    });
                    el.addEventListener('mouseleave', () => {
                        el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)';
                        el.style.transform = 'translateY(0)';
                        el.style.borderLeftWidth = '4px';
                    });
                    
                    activityList.appendChild(el);
                });
            }
        }

        // Carregar categorias populares
        const categoriesMap = {};
        books.forEach(b => {
            const cat = b.category || 'Sem categoria';
            categoriesMap[cat] = (categoriesMap[cat] || 0) + 1;
        });
        
        const categoriesList = document.getElementById('dashboard-categories-list');
        if (categoriesList) {
            categoriesList.innerHTML = '';
            const sortedCategories = Object.entries(categoriesMap)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5);
            
            if (sortedCategories.length === 0) {
                categoriesList.innerHTML = '<p class="muted" style="text-align:center;padding:2rem 0;">Nenhuma categoria encontrada</p>';
            } else {
                sortedCategories.forEach(([name, count]) => {
                    const el = document.createElement('div');
                    el.className = 'category-item';
                    el.innerHTML = `
                        <span class="category-name">${name}</span>
                        <span class="category-count">${count}</span>
                    `;
                    categoriesList.appendChild(el);
                });
            }
        }

        // Verificar avisos
        const warningsList = document.getElementById('dashboard-warnings-list');
        if (warningsList) {
            warningsList.innerHTML = '';
            
            if (availableBooks === 0 && totalBooks > 0) {
                const warning = document.createElement('div');
                warning.className = 'warning-item warning';
                warning.innerHTML = '<span class="warning-icon">⚠️</span><span>Todos os livros estão emprestados!</span>';
                warningsList.appendChild(warning);
            }
            
            if (borrowedBooks > totalBooks * 0.7 && totalBooks > 0) {
                const warning = document.createElement('div');
                warning.className = 'warning-item info';
                warning.innerHTML = '<span class="warning-icon">📊</span><span>Mais de 70% dos livros estão emprestados</span>';
                warningsList.appendChild(warning);
            }
            
            if (students.length === 0) {
                const warning = document.createElement('div');
                warning.className = 'warning-item info';
                warning.innerHTML = '<span class="warning-icon">👥</span><span>Nenhum aluno cadastrado no sistema</span>';
                warningsList.appendChild(warning);
            }
            
            if (warningsList.children.length === 0) {
                const info = document.createElement('div');
                info.className = 'warning-item info';
                info.innerHTML = '<span class="warning-icon">✅</span><span>Sistema funcionando normalmente</span>';
                warningsList.appendChild(info);
            }
        }
    }).catch(err => {
        console.error('Erro ao carregar dashboard:', err);
    });
}

function loadHistoryPreview() {
    // Função antiga - mantida para compatibilidade
    loadDashboard();
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

    // Remover o antigo handler do formulário se existir
    const oldForm = document.getElementById('add-student-form');
    if (oldForm) {
        oldForm.removeEventListener('submit', addStudentFromForm);
    }

    // Botão para abrir modal de adicionar aluno
    document.getElementById('open-add-student-modal-btn')?.addEventListener('click', openAddStudentModal);

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
    
    // Filtro de turma
    document.getElementById('filter-turma')?.addEventListener('change', () => renderStudentsGrid());

    // Modais de edição e exclusão de alunos
    setupStudentModals();

    // populate preview on the main page
    loadHistoryPreview();
    updateBookStatistics();
});

// Configurar modais de alunos
function setupStudentModals() {
    console.log('Inicializando modais de alunos...');
    
    const addModal = document.getElementById('add-student-modal');
    const editModal = document.getElementById('edit-student-modal');
    const deleteModal = document.getElementById('delete-student-modal');

    console.log('Add modal:', addModal);
    console.log('Edit modal:', editModal);
    console.log('Delete modal:', deleteModal);

    if (!addModal || !editModal || !deleteModal) {
        console.error('Modais de aluno não encontrados no DOM!');
        return;
    }

    // Modal de Adicionar - Fechar
    document.getElementById('close-add-student-modal')?.addEventListener('click', () => {
        addModal.style.display = 'none';
        addModal.setAttribute('aria-hidden', 'true');
    });

    document.getElementById('cancel-add-student-btn')?.addEventListener('click', () => {
        addModal.style.display = 'none';
        addModal.setAttribute('aria-hidden', 'true');
    });

    // Modal de Adicionar - Confirmar
    document.getElementById('confirm-add-student-btn')?.addEventListener('click', () => {
        const nameInput = document.getElementById('add-student-modal-name');
        const turmaSelect = document.getElementById('add-student-modal-turma');
        const name = nameInput.value.trim();
        const turma = turmaSelect.value;

        if (!name) {
            showNotification('Por favor, digite o nome do aluno.', 'error');
            return;
        }

        if (!turma) {
            showNotification('Por favor, selecione a turma.', 'error');
            return;
        }

        const confirmBtn = document.getElementById('confirm-add-student-btn');
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Adicionando...';

        fetch('/api/add_student', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name: name, turma: turma })
        })
            .then(response => response.json().then(data => ({ ok: response.ok, data })))
            .then(result => {
                if (!result.ok) {
                    showNotification(result.data.error || 'Erro ao adicionar aluno.', 'error');
                    return;
                }
                showNotification('Aluno adicionado com sucesso!', 'success');
                addModal.style.display = 'none';
                addModal.setAttribute('aria-hidden', 'true');
                loadStudentsGrid();
            })
            .catch(error => {
                console.error('Erro ao adicionar aluno:', error);
                showNotification('Erro ao adicionar aluno.', 'error');
            })
            .finally(() => {
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Adicionar Aluno';
            });
    });

    // Modal de Edição - Fechar
    document.getElementById('close-edit-student-modal')?.addEventListener('click', () => {
        editModal.style.display = 'none';
        editModal.setAttribute('aria-hidden', 'true');
    });

    document.getElementById('cancel-edit-student-btn')?.addEventListener('click', () => {
        editModal.style.display = 'none';
        editModal.setAttribute('aria-hidden', 'true');
    });

    // Modal de Edição - Confirmar
    document.getElementById('confirm-edit-student-btn')?.addEventListener('click', () => {
        const nameInput = document.getElementById('edit-student-name');
        const turmaSelect = document.getElementById('edit-student-turma');
        const idInput = document.getElementById('edit-student-id');
        const newName = nameInput.value.trim();
        const newTurma = turmaSelect.value;
        const studentId = idInput.value;

        if (!newName) {
            showNotification('Por favor, digite o nome do aluno.', 'error');
            return;
        }
        
        if (!newTurma) {
            showNotification('Por favor, selecione a turma.', 'error');
            return;
        }

        const confirmBtn = document.getElementById('confirm-edit-student-btn');
        confirmBtn.disabled = true;
        confirmBtn.textContent = 'Salvando...';

        fetch('/api/update_student', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: parseInt(studentId), name: newName, turma: newTurma })
        })
            .then(response => response.json().then(data => ({ ok: response.ok, data })))
            .then(result => {
                if (!result.ok) {
                    showNotification(result.data.error || 'Erro ao editar aluno.', 'error');
                    return;
                }
                showNotification('Aluno editado com sucesso!', 'success');
                editModal.style.display = 'none';
                editModal.setAttribute('aria-hidden', 'true');
                loadStudentsGrid();
            })
            .catch(error => {
                console.error('Erro ao editar aluno:', error);
                showNotification('Erro ao editar aluno.', 'error');
            })
            .finally(() => {
                confirmBtn.disabled = false;
                confirmBtn.textContent = 'Salvar Alterações';
            });
    });

    // Modal de Exclusão - Fechar
    document.getElementById('close-delete-student-modal')?.addEventListener('click', () => {
        deleteModal.style.display = 'none';
        deleteModal.setAttribute('aria-hidden', 'true');
    });

    document.getElementById('cancel-delete-student-btn')?.addEventListener('click', () => {
        deleteModal.style.display = 'none';
        deleteModal.setAttribute('aria-hidden', 'true');
    });

    // Modal de Exclusão - Confirmar
    const confirmDeleteBtn = document.getElementById('confirm-delete-student-btn');
    console.log('Botão de confirmar exclusão encontrado:', confirmDeleteBtn);
    
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('=== CLICOU NO BOTÃO DE EXCLUIR ===');
            
            const idInput = document.getElementById('delete-student-id');
            const studentId = idInput ? idInput.value : null;

            console.log('ID Input element:', idInput);
            console.log('Student ID value:', studentId);

            if (!studentId) {
                console.error('ID do aluno não encontrado!');
                showNotification('ID do aluno não encontrado.', 'error');
                return;
            }

            console.log('Desabilitando botão e iniciando requisição...');
            confirmDeleteBtn.disabled = true;
            confirmDeleteBtn.textContent = 'Excluindo...';

            console.log('Fazendo fetch para /api/delete_student com ID:', studentId);

            fetch('/api/delete_student', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: parseInt(studentId) })
            })
                .then(response => {
                    console.log('Resposta do servidor recebida:', response.status, response.statusText);
                return response.json().then(data => ({ ok: response.ok, data }));
            })
            .then(result => {
                console.log('Resultado completo:', result);
                console.log('Result.ok:', result.ok);
                console.log('Result.data:', result.data);
                
                if (!result.ok) {
                    const errorMsg = result.data.error || 'Erro ao excluir aluno.';
                    console.error('ERRO AO EXCLUIR:', errorMsg);
                    showNotification(errorMsg, 'error');
                    confirmDeleteBtn.disabled = false;
                    confirmDeleteBtn.textContent = 'Excluir Aluno';
                    return;
                }
                showNotification('Aluno excluído com sucesso!', 'success');
                deleteModal.style.display = 'none';
                deleteModal.setAttribute('aria-hidden', 'true');
                confirmDeleteBtn.disabled = false;
                confirmDeleteBtn.textContent = 'Excluir Aluno';
                loadStudentsGrid();
            })
 
            .catch(error => {
                console.error('ERRO CATCH:', error);
                console.error('Error message:', error.message);
                console.error('Error stack:', error.stack);
                showNotification('Erro ao excluir aluno: ' + error.message, 'error');
                confirmDeleteBtn.disabled = false;
                confirmDeleteBtn.textContent = 'Excluir Aluno';
            });
        });
    } else {
        console.error('ERRO: Botão confirm-delete-student-btn não encontrado no DOM!');
    }

    // Fechar modais ao clicar fora
    window.addEventListener('click', (e) => {
        if (e.target === editModal) {
            editModal.style.display = 'none';
            editModal.setAttribute('aria-hidden', 'true');
        }
        if (e.target === deleteModal) {
            deleteModal.style.display = 'none';
            deleteModal.setAttribute('aria-hidden', 'true');
        }
    });
}
// Fun��o para carregar atividades recentes
async function loadRecentActivities() {
    const activitiesGrid = document.getElementById('activities-grid');
    
    if (!activitiesGrid) {
        console.error('Container de atividades n�o encontrado');
        return;
    }

    try {
        const [booksResponse, historyResponse, studentsResponse] = await Promise.all([
            fetch('/api/books'),
            fetch('/api/history'),
            fetch('/api/students')
        ]);

        const books = await booksResponse.json();
        const history = await historyResponse.json();
        const students = await studentsResponse.json();

        const booksMap = {};
        books.forEach(book => {
            booksMap[book.ISBN] = book;
        });

        const studentsMap = {};
        students.forEach(student => {
            studentsMap[student.id] = student;
        });

        let allActivities = [];

        books.forEach(book => {
            if (book.data_adicionado) {
                allActivities.push({
                    type: 'added',
                    timestamp: new Date(book.data_adicionado),
                    book: book,
                    student: null
                });
            }
        });

        history.forEach(record => {
            const book = booksMap[record.ISBN];
            const student = studentsMap[record.estudante_id];
            
            if (record.data_emprestimo) {
                allActivities.push({
                    type: 'borrowed',
                    timestamp: new Date(record.data_emprestimo),
                    book: book,
                    student: student
                });
            }
            
            if (record.data_devolucao) {
                allActivities.push({
                    type: 'returned',
                    timestamp: new Date(record.data_devolucao),
                    book: book,
                    student: student
                });
            }
        });

        allActivities.sort((a, b) => b.timestamp - a.timestamp);
        const recentActivities = allActivities.slice(0, 10);

        if (recentActivities.length === 0) {
            activitiesGrid.innerHTML = '<div class=\"no-activities\"><div class=\"no-activities-icon\"></div><div class=\"no-activities-text\">Nenhuma atividade registrada ainda</div></div>';
            return;
        }

        activitiesGrid.innerHTML = recentActivities.map(activity => {
            const timeAgo = getTimeAgo(activity.timestamp);
            let typeLabel, typeIcon, typeClass;
            
            switch(activity.type) {
                case 'added':
                    typeLabel = 'Livro Cadastrado';
                    typeIcon = '';
                    typeClass = 'added';
                    break;
                case 'borrowed':
                    typeLabel = 'Empr�stimo';
                    typeIcon = '';
                    typeClass = 'borrowed';
                    break;
                case 'returned':
                    typeLabel = 'Devolu��o';
                    typeIcon = '';
                    typeClass = 'returned';
                    break;
            }

            const bookTitle = activity.book ? activity.book.Titulo : 'Livro n�o encontrado';
            const bookAuthor = activity.book ? activity.book.Autor : '-';
            const bookCategory = activity.book ? activity.book.Categoria : '-';
            const bookISBN = activity.book ? activity.book.ISBN : '-';
            const studentName = activity.student ? activity.student.nome : '-';

            let detailsHTML = '<div class=\"activity-detail-row\"><span class=\"activity-detail-label\"> T�tulo:</span><span class=\"activity-detail-value\">' + bookTitle + '</span></div>' +
                '<div class=\"activity-detail-row\"><span class=\"activity-detail-label\"> Autor:</span><span class=\"activity-detail-value\">' + bookAuthor + '</span></div>' +
                '<div class=\"activity-detail-row\"><span class=\"activity-detail-label\"> Categoria:</span><span class=\"activity-detail-value\">' + bookCategory + '</span></div>' +
                '<div class=\"activity-detail-row\"><span class=\"activity-detail-label\"> ISBN:</span><span class=\"activity-detail-value isbn\">' + bookISBN + '</span></div>';

            if (activity.type !== 'added' && studentName !== '-') {
                detailsHTML += '<div class=\"activity-detail-row\"><span class=\"activity-detail-label\"> Aluno:</span><span class=\"activity-detail-value\">' + studentName + '</span></div>';
            }

            return '<div class=\"activity-card\"><div class=\"activity-card-header\"><span class=\"activity-type ' + typeClass + '\">' + typeIcon + ' ' + typeLabel + '</span><span class=\"activity-time\">' + timeAgo + '</span></div><div class=\"activity-details\">' + detailsHTML + '</div></div>';
        }).join('');

    } catch (error) {
        console.error('Erro ao carregar atividades:', error);
        activitiesGrid.innerHTML = '<div class=\"no-activities\"><div class=\"no-activities-icon\"></div><div class=\"no-activities-text\">Erro ao carregar atividades</div></div>';
    }
}

function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Agora mesmo';
    if (diffMins === 1) return 'H� 1 minuto';
    if (diffMins < 60) return 'H� ' + diffMins + ' minutos';
    if (diffHours === 1) return 'H� 1 hora';
    if (diffHours < 24) return 'H� ' + diffHours + ' horas';
    if (diffDays === 1) return 'H� 1 dia';
    if (diffDays < 7) return 'H� ' + diffDays + ' dias';
    if (diffDays < 30) return 'H� ' + Math.floor(diffDays / 7) + ' semanas';
    
    return date.toLocaleDateString('pt-BR');
}

// Fun��o para carregar atividades recentes
async function loadRecentActivities() {
    const activitiesGrid = document.getElementById('activities-grid');
    
    if (!activitiesGrid) {
        console.error('Container de atividades n�o encontrado');
        return;
    }

    try {
        const [booksResponse, historyResponse, studentsResponse] = await Promise.all([
            fetch('/api/books'),
            fetch('/api/history'),
            fetch('/api/students')
        ]);

        const books = await booksResponse.json();
        const history = await historyResponse.json();
        const students = await studentsResponse.json();

        const booksMap = {};
        books.forEach(book => {
            booksMap[book.ISBN] = book;
        });

        const studentsMap = {};
        students.forEach(student => {
            studentsMap[student.id] = student;
        });

        let allActivities = [];

        books.forEach(book => {
            if (book.data_adicionado) {
                allActivities.push({
                    type: 'added',
                    timestamp: new Date(book.data_adicionado),
                    book: book,
                    student: null
                });
            }
        });

        history.forEach(record => {
            const book = booksMap[record.ISBN];
            const student = studentsMap[record.estudante_id];
            
            if (record.data_emprestimo) {
                allActivities.push({
                    type: 'borrowed',
                    timestamp: new Date(record.data_emprestimo),
                    book: book,
                    student: student
                });
            }
            
            if (record.data_devolucao) {
                allActivities.push({
                    type: 'returned',
                    timestamp: new Date(record.data_devolucao),
                    book: book,
                    student: student
                });
            }
        });

        allActivities.sort((a, b) => b.timestamp - a.timestamp);
        const recentActivities = allActivities.slice(0, 10);

        if (recentActivities.length === 0) {
            activitiesGrid.innerHTML = `<div class="no-activities"><div class="no-activities-icon"></div><div class="no-activities-text">Nenhuma atividade registrada ainda</div></div>`;
            return;
        }

        activitiesGrid.innerHTML = recentActivities.map(activity => {
            const timeAgo = getTimeAgo(activity.timestamp);
            let typeLabel, typeIcon, typeClass;
            
            switch(activity.type) {
                case 'added':
                    typeLabel = 'Livro Cadastrado';
                    typeIcon = '';
                    typeClass = 'added';
                    break;
                case 'borrowed':
                    typeLabel = 'Empr�stimo';
                    typeIcon = '';
                    typeClass = 'borrowed';
                    break;
                case 'returned':
                    typeLabel = 'Devolu��o';
                    typeIcon = '';
                    typeClass = 'returned';
                    break;
            }

            const bookTitle = activity.book ? activity.book.Titulo : 'Livro n�o encontrado';
            const bookAuthor = activity.book ? activity.book.Autor : '-';
            const bookCategory = activity.book ? activity.book.Categoria : '-';
            const bookISBN = activity.book ? activity.book.ISBN : '-';
            const studentName = activity.student ? activity.student.nome : '-';

            let detailsHTML = `
                <div class="activity-detail-row">
                    <span class="activity-detail-label"> T�tulo:</span>
                    <span class="activity-detail-value">${bookTitle}</span>
                </div>
                <div class="activity-detail-row">
                    <span class="activity-detail-label"> Autor:</span>
                    <span class="activity-detail-value">${bookAuthor}</span>
                </div>
                <div class="activity-detail-row">
                    <span class="activity-detail-label"> Categoria:</span>
                    <span class="activity-detail-value">${bookCategory}</span>
                </div>
                <div class="activity-detail-row">
                    <span class="activity-detail-label"> ISBN:</span>
                    <span class="activity-detail-value isbn">${bookISBN}</span>
                </div>
            `;

            if (activity.type !== 'added' && studentName !== '-') {
                detailsHTML += `
                    <div class="activity-detail-row">
                        <span class="activity-detail-label"> Aluno:</span>
                        <span class="activity-detail-value">${studentName}</span>
                    </div>
                `;
            }

            return `
                <div class="activity-card">
                    <div class="activity-card-header">
                        <span class="activity-type ${typeClass}">
                            ${typeIcon} ${typeLabel}
                        </span>
                        <span class="activity-time">${timeAgo}</span>
                    </div>
                    <div class="activity-details">
                        ${detailsHTML}
                    </div>
                </div>
            `;
        }).join('');

    } catch (error) {
        console.error('Erro ao carregar atividades:', error);
        console.error('Stack trace:', error.stack);
        activitiesGrid.innerHTML = `
            <div class="no-activities">
                <div class="no-activities-icon">⚠️</div>
                <div class="no-activities-text">Erro ao carregar atividades: ${error.message}</div>
            </div>
        `;
    }
}

function getTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Agora mesmo';
    if (diffMins === 1) return 'Há 1 minuto';
    if (diffMins < 60) return `Há ${diffMins} minutos`;
    if (diffHours === 1) return 'Há 1 hora';
    if (diffHours < 24) return `Há ${diffHours} horas`;
    if (diffDays === 1) return 'Há 1 dia';
    if (diffDays < 7) return `Há ${diffDays} dias`;
    if (diffDays < 30) return `Há ${Math.floor(diffDays / 7)} semanas`;
    
    return date.toLocaleDateString('pt-BR');
}
