// ========================================
// MODAL DE ADICIONAR LIVRO
// ========================================

document.addEventListener('DOMContentLoaded', function() {
    const addBookModalBtn = document.getElementById('open-add-book-modal');
    const addBookModal = document.getElementById('add-book-modal');
    const closeAddBookModal = document.getElementById('add-book-modal-close');
    const cancelAddBook = document.getElementById('cancel-add-book');
    const addBookForm = document.getElementById('modal-add-book-form');

    // Abrir modal
    if (addBookModalBtn) {
        addBookModalBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            addBookModal.style.display = 'flex';
            addBookModal.classList.add('show');
            addBookModal.setAttribute('aria-hidden', 'false');
            
            // Focar no primeiro input
            const firstInput = addBookModal.querySelector('input[type="text"]');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 100);
            }
        });
    }

    // Fechar modal - botão X
    if (closeAddBookModal) {
        closeAddBookModal.addEventListener('click', function() {
            closeAddBookModalHandler();
        });
    }

    // Fechar modal - botão Cancelar
    if (cancelAddBook) {
        cancelAddBook.addEventListener('click', function() {
            closeAddBookModalHandler();
        });
    }

    // Fechar modal - clique fora
    if (addBookModal) {
        addBookModal.addEventListener('click', function(e) {
            if (e.target === addBookModal) {
                closeAddBookModalHandler();
            }
        });
    }

    // Fechar modal - tecla ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && addBookModal.classList.contains('show')) {
            closeAddBookModalHandler();
        }
    });

    function closeAddBookModalHandler() {
        addBookModal.classList.remove('show');
        addBookModal.setAttribute('aria-hidden', 'true');
        
        // Limpar formulário
        if (addBookForm) {
            addBookForm.reset();
        }
    }

    // Envio do formulário
    if (addBookForm) {
        addBookForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(addBookForm);
            const bookData = {
                title: formData.get('title')?.trim(),
                author: formData.get('author')?.trim(),
                category: formData.get('category')?.trim() || 'Geral',
                isbn: formData.get('isbn')?.trim()
            };

            // Validação básica
            if (!bookData.title || !bookData.author || !bookData.isbn) {
                showNotification('Por favor, preencha todos os campos obrigatórios.', 'error');
                return;
            }

            // Validação de ISBN básica
            const isbnClean = bookData.isbn.replace(/[-\s]/g, '');
            if (!/^[0-9X]{10}$|^[0-9]{13}$/.test(isbnClean)) {
                showNotification('ISBN deve ter 10 ou 13 dígitos (pode conter X no final para ISBN-10).', 'error');
                return;
            }

            // Enviar dados
            submitAddBookForm(bookData);
        });
    }

    function submitAddBookForm(bookData) {
        // Desabilitar botão de envio
        const submitBtn = addBookForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;
        submitBtn.disabled = true;
        submitBtn.innerHTML = '⏳ Adicionando...';

        fetch('/api/add_book', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(bookData)
        })
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(err.error || `HTTP ${response.status}`);
                });
            }
            return response.json();
        })
        .then(data => {
            showNotification('📚 Livro adicionado com sucesso!', 'success');
            closeAddBookModalHandler();
            
            // Atualizar estatísticas se estiver na primeira aba
            if (document.querySelector('#add-book.active')) {
                loadStats();
            }
            
            // Atualizar lista de livros se estiver na aba de livros disponíveis
            if (document.querySelector('#available-books.active')) {
                loadBooks('book-grid', 'available');
            }
        })
        .catch(error => {
            console.error('Erro ao adicionar livro:', error);
            showNotification(`Erro ao adicionar livro: ${error.message}`, 'error');
        })
        .finally(() => {
            // Reabilitar botão
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        });
    }

    // Formatação automática do ISBN
    const isbnInput = document.getElementById('modal-add-isbn');
    if (isbnInput) {
        isbnInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/[^0-9X]/gi, '').toUpperCase();
            
            // Formatação automática para ISBN-13
            if (value.length > 3) {
                if (value.startsWith('978') || value.startsWith('979')) {
                    // ISBN-13: 978-85-123-4567-8
                    value = value.replace(/^(\d{3})(\d{0,2})(\d{0,3})(\d{0,4})(\d{0,1}).*/, 
                        function(match, p1, p2, p3, p4, p5) {
                            let formatted = p1;
                            if (p2) formatted += '-' + p2;
                            if (p3) formatted += '-' + p3;
                            if (p4) formatted += '-' + p4;
                            if (p5) formatted += '-' + p5;
                            return formatted;
                        });
                } else if (value.length <= 10) {
                    // ISBN-10: 85-123-4567-X
                    value = value.replace(/^(\d{0,2})(\d{0,3})(\d{0,4})([0-9X]{0,1}).*/, 
                        function(match, p1, p2, p3, p4) {
                            let formatted = p1;
                            if (p2) formatted += '-' + p2;
                            if (p3) formatted += '-' + p3;
                            if (p4) formatted += '-' + p4;
                            return formatted;
                        });
                }
            }
            
            e.target.value = value;
        });
    }
});