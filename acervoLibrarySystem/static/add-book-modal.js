console.log('✅ add-book-modal.js CARREGADO');

document.addEventListener('DOMContentLoaded', function() {
    console.log('🔧 Inicializando modal de adicionar livro...');
    
    const addBookModalBtn = document.getElementById('open-add-book-modal');
    const addBookModal = document.getElementById('add-book-modal');
    const closeAddBookModal = document.getElementById('add-book-modal-close');
    const cancelAddBook = document.getElementById('cancel-add-book');
    const addBookForm = document.getElementById('modal-add-book-form');

    if (addBookModalBtn) {
        addBookModalBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            
            addBookModal.style.display = 'flex';
            addBookModal.classList.add('show');
            addBookModal.setAttribute('aria-hidden', 'false');
            
            const firstInput = addBookModal.querySelector('input[type="text"]');
            if (firstInput) {
                setTimeout(() => firstInput.focus(), 100);
            }
        });
    }

    if (closeAddBookModal) {
        closeAddBookModal.addEventListener('click', function() {
            closeAddBookModalHandler();
        });
    }

    if (cancelAddBook) {
        cancelAddBook.addEventListener('click', function() {
            closeAddBookModalHandler();
        });
    }

    if (addBookModal) {
        addBookModal.addEventListener('click', function(e) {
            if (e.target === addBookModal) {
                closeAddBookModalHandler();
            }
        });
    }

    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && addBookModal.classList.contains('show')) {
            closeAddBookModalHandler();
        }
    });

    function closeAddBookModalHandler() {
        addBookModal.classList.remove('show');
        addBookModal.setAttribute('aria-hidden', 'true');
        
        if (addBookForm) {
            addBookForm.reset();
        }
    }

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

            if (!bookData.title || !bookData.author || !bookData.isbn) {
                showNotification('Por favor, preencha todos os campos obrigatórios.', 'error');
                return;
            }

            if (bookData.title.length < 2) {
                showNotification('O título deve ter pelo menos 2 caracteres.', 'error');
                return;
            }

            const isbnClean = bookData.isbn.replace(/[-\s]/g, '');
            if (isbnClean.length < 10) {
                showNotification('O ISBN deve ter pelo menos 10 dígitos.', 'error');
                return;
            }
            if (!/^[0-9X]{10}$|^[0-9]{13}$/.test(isbnClean)) {
                showNotification('ISBN deve ter 10 ou 13 dígitos (pode conter X no final para ISBN-10).', 'error');
                return;
            }

            submitAddBookForm(bookData);
        });
    }

    function submitAddBookForm(bookData) {
        console.log('📚 submitAddBookForm CHAMADO - Início');
        
        const submitBtn = addBookForm.querySelector('button[type="submit"]');
        const originalText = submitBtn.innerHTML;

        if (submitBtn.disabled) {
            console.warn('⚠️ Botão já está desabilitado - ignorando submissão duplicada');
            return;
        }
        
        submitBtn.disabled = true;
        submitBtn.innerHTML = '⏳ Adicionando...';
        
        closeAddBookModalHandler();

        console.log('📤 Enviando requisição para /api/add_book:', bookData);

        fetch('/api/add_book', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(bookData)
        })
        .then(response => {
            console.log('📥 Resposta recebida:', response.status, response.statusText);

            if (!response.ok) {
                return response.json().then(err => {
                    console.error('❌ Erro na resposta:', err);
                    throw new Error(err.error || `Erro HTTP ${response.status}`);
                });
            }
            return response.json();
        })
        .then(data => {
            console.log('✅ Sucesso! Data:', data);
            
            showNotification('Livro adicionado com sucesso!', 'success');
            

            setTimeout(() => {
                console.log('🔄 Recarregando página...');
                window.location.reload();
            }, 1200);
        })
        .catch(error => {
            console.error('❌ Erro capturado:', error);
            
            const errorMessage = error.message || 'Erro desconhecido';
            showNotification(errorMessage, 'error');
            
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalText;
        });
    }

    const isbnInput = document.getElementById('modal-add-isbn');
    if (isbnInput) {
        isbnInput.addEventListener('input', function(e) {
            let value = e.target.value.replace(/[^0-9X]/gi, '').toUpperCase();
            
            if (value.length > 3) {
                if (value.startsWith('978') || value.startsWith('979')) {
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