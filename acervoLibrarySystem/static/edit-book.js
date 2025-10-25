// Editar Livro - Modal e Funcionalidades
(function() {
    'use strict';

    // Elementos do DOM
    const openEditBookModalBtn = document.getElementById('open-edit-book-modal');
    const editBookModal = document.getElementById('edit-book-modal');
    const closeEditBookModalBtn = document.getElementById('edit-book-modal-close');
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    const searchBookEditInput = document.getElementById('search-book-edit');
    const searchResultsEdit = document.getElementById('search-results-edit');
    const editFormContainer = document.getElementById('edit-form-container');
    const editBookForm = document.getElementById('edit-book-form');
    const editBookIdInput = document.getElementById('edit-book-id');
    const editingBookTitle = document.getElementById('editing-book-title');

    let allBooks = [];
    let currentEditingBook = null;

    // Abrir modal
    if (openEditBookModalBtn) {
        openEditBookModalBtn.addEventListener('click', function() {
            editBookModal.setAttribute('aria-hidden', 'false');
            searchBookEditInput.value = '';
            searchResultsEdit.style.display = 'none';
            editFormContainer.style.display = 'none';
            searchBookEditInput.focus();
            loadAllBooks();
        });
    }

    // Fechar modal
    if (closeEditBookModalBtn) {
        closeEditBookModalBtn.addEventListener('click', closeModal);
    }

    // Botão cancelar
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', function() {
            editFormContainer.style.display = 'none';
            searchResultsEdit.style.display = 'none';
            searchBookEditInput.value = '';
            searchBookEditInput.focus();
        });
    }

    // Fechar modal ao clicar fora
    if (editBookModal) {
        editBookModal.addEventListener('click', function(e) {
            if (e.target === editBookModal) {
                closeModal();
            }
        });
    }

    function closeModal() {
        editBookModal.setAttribute('aria-hidden', 'true');
        editFormContainer.style.display = 'none';
        searchResultsEdit.style.display = 'none';
        searchBookEditInput.value = '';
        if (editBookForm) editBookForm.reset();
    }

    // Carregar todos os livros
    async function loadAllBooks() {
        try {
            const response = await fetch('/api/books');
            if (!response.ok) throw new Error('Erro ao carregar livros');
            allBooks = await response.json();
        } catch (error) {
            console.error('Erro ao carregar livros:', error);
            showNotification('Erro ao carregar livros', 'error');
        }
    }

    // Buscar livros
    if (searchBookEditInput) {
        searchBookEditInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase().trim();
            
            if (searchTerm.length < 2) {
                searchResultsEdit.style.display = 'none';
                return;
            }

            const filtered = allBooks.filter(book => 
                book.title.toLowerCase().includes(searchTerm) ||
                book.author.toLowerCase().includes(searchTerm) ||
                (book.isbn && book.isbn.toLowerCase().includes(searchTerm))
            );

            if (filtered.length > 0) {
                displaySearchResults(filtered);
            } else {
                searchResultsEdit.innerHTML = '<p style="padding: 1rem; text-align: center; color: #718096;">Nenhum livro encontrado</p>';
                searchResultsEdit.style.display = 'block';
            }
        });
    }

    // Exibir resultados da busca
    function displaySearchResults(books) {
        searchResultsEdit.innerHTML = books.map(book => `
            <div class="search-result-item" data-book-id="${book.id}" style="padding: 0.75rem; border-bottom: 1px solid #e2e8f0; cursor: pointer; transition: background 0.2s;">
                <div style="font-weight: 600; color: #2d3748;">${book.title}</div>
                <div style="font-size: 0.85rem; color: #718096;">
                    <span>📚 ${book.author}</span>
                    ${book.isbn ? ` • ISBN: ${book.isbn}` : ''}
                    ${book.category ? ` • ${book.category}` : ''}
                </div>
            </div>
        `).join('');
        
        searchResultsEdit.style.display = 'block';

        // Adicionar evento de clique nos resultados
        searchResultsEdit.querySelectorAll('.search-result-item').forEach(item => {
            item.addEventListener('click', function() {
                const bookId = parseInt(this.dataset.bookId);
                const book = allBooks.find(b => b.id === bookId);
                if (book) {
                    loadBookForEditing(book);
                }
            });

            item.addEventListener('mouseenter', function() {
                this.style.background = '#f7fafc';
            });

            item.addEventListener('mouseleave', function() {
                this.style.background = 'white';
            });
        });
    }

    // Carregar livro para edição
    function loadBookForEditing(book) {
        currentEditingBook = book;
        
        // Preencher campos do formulário
        document.getElementById('edit-book-id').value = book.id;
        document.getElementById('edit-title').value = book.title;
        document.getElementById('edit-author').value = book.author;
        document.getElementById('edit-isbn').value = book.isbn || '';
        document.getElementById('edit-category').value = book.category || '';
        
        editingBookTitle.textContent = book.title;
        
        // Mostrar formulário e esconder busca
        searchResultsEdit.style.display = 'none';
        editFormContainer.style.display = 'block';
    }

    // Submeter formulário de edição
    if (editBookForm) {
        editBookForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const bookId = document.getElementById('edit-book-id').value;
            const formData = {
                titulo: document.getElementById('edit-title').value.trim(),
                autor: document.getElementById('edit-author').value.trim(),
                isbn: document.getElementById('edit-isbn').value.trim(),
                categoria: document.getElementById('edit-category').value.trim()
            };

            if (!formData.titulo || !formData.autor || !formData.isbn) {
                showNotification('Preencha todos os campos obrigatórios', 'error');
                return;
            }

            try {
                const response = await fetch(`/api/books/${bookId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(formData)
                });

                const data = await response.json();

                if (response.ok) {
                    showNotification(data.message || 'Livro atualizado com sucesso!', 'success');
                    closeModal();
                    
                    // Recarregar lista de livros se a função existir
                    if (typeof loadAvailableBooks === 'function') {
                        loadAvailableBooks();
                    }
                } else {
                    showNotification(data.error || 'Erro ao atualizar livro', 'error');
                }
            } catch (error) {
                console.error('Erro ao atualizar livro:', error);
                showNotification('Erro ao atualizar livro', 'error');
            }
        });
    }

})();
