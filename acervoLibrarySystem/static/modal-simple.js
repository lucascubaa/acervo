// Modal de Adicionar Livro - Versão Simplificada
console.log('=== CARREGANDO MODAL DE ADICIONAR LIVRO ===');

// Aguardar o DOM carregar
document.addEventListener('DOMContentLoaded', function() {
    // Aguardar um pouco mais para garantir que tudo carregou
    setTimeout(initializeModal, 1000);
});

function initializeModal() {
    console.log('Inicializando modal...');
    
    const addBookModalBtn = document.getElementById('open-add-book-modal');
    const addBookModal = document.getElementById('add-book-modal');
    const closeAddBookModal = document.getElementById('add-book-modal-close');
    const cancelAddBook = document.getElementById('cancel-add-book');
    const addBookForm = document.getElementById('modal-add-book-form');

    console.log('Elementos encontrados:');
    console.log('- Botão abrir:', !!addBookModalBtn);
    console.log('- Modal:', !!addBookModal);
    console.log('- Botão fechar:', !!closeAddBookModal);
    console.log('- Formulário:', !!addBookForm);

    if (!addBookModalBtn || !addBookModal) {
        console.error('ERRO: Elementos essenciais não encontrados!');
        return;
    }

    // Função para abrir o modal
    addBookModalBtn.addEventListener('click', function(e) {
        console.log('>>> BOTÃO CLICADO! <<<');
        e.preventDefault();
        e.stopPropagation();
        
        // Forçar a exibição do modal com CSS inline
        addBookModal.style.cssText = `
            display: flex !important;
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100% !important;
            height: 100% !important;
            z-index: 99999 !important;
            background-color: rgba(0, 0, 0, 0.7) !important;
            align-items: center !important;
            justify-content: center !important;
            backdrop-filter: blur(4px) !important;
        `;
        
        addBookModal.classList.add('show');
        addBookModal.setAttribute('aria-hidden', 'false');
        
        console.log('Modal aberto! Estilo aplicado:', addBookModal.style.cssText);
        
        // Focar no primeiro input
        setTimeout(() => {
            const firstInput = addBookModal.querySelector('input[type="text"]');
            if (firstInput) {
                firstInput.focus();
                console.log('Foco definido no primeiro input');
            }
        }, 200);
    });

    // Função para fechar o modal
    function closeModal() {
        console.log('Fechando modal...');
        addBookModal.style.display = 'none';
        addBookModal.classList.remove('show');
        addBookModal.setAttribute('aria-hidden', 'true');
        
        if (addBookForm) {
            addBookForm.reset();
        }
    }

    // Event listeners para fechar o modal
    if (closeAddBookModal) {
        closeAddBookModal.addEventListener('click', closeModal);
    }

    if (cancelAddBook) {
        cancelAddBook.addEventListener('click', closeModal);
    }

    // Fechar clicando fora do modal
    addBookModal.addEventListener('click', function(e) {
        if (e.target === addBookModal) {
            closeModal();
        }
    });

    // Fechar com a tecla ESC
    document.addEventListener('keydown', function(e) {
        if (e.key === 'Escape' && addBookModal.classList.contains('show')) {
            closeModal();
        }
    });

    // Submissão do formulário
    if (addBookForm) {
        addBookForm.addEventListener('submit', function(e) {
            e.preventDefault();
            console.log('Formulário submetido');
            
            const bookData = {
                title: document.getElementById('modal-add-title').value.trim(),
                author: document.getElementById('modal-add-author').value.trim(),
                category: document.getElementById('modal-add-category').value.trim() || 'Geral',
                isbn: document.getElementById('modal-add-isbn').value.trim()
            };

            console.log('Dados do livro:', bookData);

            // Validação
            if (!bookData.title || !bookData.author || !bookData.isbn) {
                alert('Por favor, preencha todos os campos obrigatórios!');
                return;
            }

            // Enviar dados
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
                console.log('Resposta recebida:', response.status);
                if (!response.ok) {
                    return response.json().then(err => {
                        throw new Error(err.error || `Erro ${response.status}`);
                    });
                }
                return response.json();
            })
            .then(data => {
                console.log('Livro adicionado com sucesso:', data);
                alert('📚 Livro adicionado com sucesso!');
                closeModal();
                
                // Recarregar a página para atualizar tudo
                setTimeout(() => {
                    window.location.reload();
                }, 500);
            })
            .catch(error => {
                console.error('Erro ao adicionar livro:', error);
                alert('Erro ao adicionar livro: ' + error.message);
            })
            .finally(() => {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalText;
            });
        });
    }

    console.log('Modal inicializado com sucesso!');
}