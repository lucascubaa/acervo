function goBackToSystem() {
    try {
        window.location.href = '/';
    } catch (error) {
        console.error('Erro ao redirecionar para a página inicial:', error);
        const notify = new Notify();
        notify.show('Erro ao voltar para o sistema.', 'error');
    }
}

function formatFine(amount) {
    return amount.toFixed(2).replace('.', ',');
}

function loadHistory() {
    const historyList = document.getElementById('history-list');
    if (historyList) {
        console.warn('Elemento com ID history-list encontrado, mas não é usado. Verifique history.html.');
    }

    const grids = [
        { id: 'added-books', title: 'Livros Adicionados' },
        { id: 'borrowed-books', title: 'Livros Emprestados' },
        { id: 'returned-books', title: 'Livros Devolvidos' }
    ];

    grids.forEach(grid => {
        const element = document.getElementById(grid.id);
        if (!element) {
            console.warn(`Grid com ID ${grid.id} não encontrado.`);
        } else {
            element.innerHTML = '<div class="loader">Carregando...</div>';
        }
    });

    fetch('/api/history')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.json();
        })
        .then(data => {
            const sections = [
                { 
                    id: 'added-books', 
                    data: data.added_books || [], 
                    title: 'Livros Adicionados', 
                    fields: ['title', 'author', 'isbn', 'borrow_count'] 
                },
                { 
                    id: 'borrowed-books', 
                    data: data.borrowed_books || [], 
                    title: 'Livros Emprestados', 
                    fields: ['title', 'author', 'isbn', 'borrow_date'] 
                },
                { 
                    id: 'returned-books', 
                    data: data.returned_books || [], 
                    title: 'Livros Devolvidos', 
                    fields: ['title', 'author', 'isbn', 'return_date', 'fine'] 
                }
            ];

            const searchTerm = document.getElementById('section-search')?.value.toLowerCase().trim() || '';

            sections.forEach(section => {
                const grid = document.getElementById(section.id);
                if (!grid) return;

                grid.innerHTML = '';
                const filteredData = section.data.filter(item =>
                    (item.title?.toLowerCase().includes(searchTerm) || '') ||
                    (item.author?.toLowerCase().includes(searchTerm) || '') ||
                    (item.isbn?.toLowerCase().includes(searchTerm) || '')
                );

                if (filteredData.length === 0) {
                    grid.innerHTML = `<p>Nenhum registro encontrado para ${section.title.toLowerCase()}.</p>`;
                    return;
                }

                filteredData.forEach(item => {
                    const historyItem = document.createElement('div');
                    historyItem.classList.add('history-item');
                    let content = `
                        <span>${item.title || 'Desconhecido'}</span>
                        <span>${item.author || 'Desconhecido'}</span>
                        <span>${item.isbn || 'N/A'}</span>
                    `;
                    if (section.fields.includes('borrow_date')) {
                        content += `<span>${item.borrow_date ? new Date(item.borrow_date).toLocaleDateString('pt-BR') : 'N/A'}</span>`;
                    }
                    if (section.fields.includes('return_date')) {
                        content += `<span>${item.return_date ? new Date(item.return_date).toLocaleDateString('pt-BR') : 'Não devolvido'}</span>`;
                    }
                    if (section.fields.includes('fine')) {
                        content += `<span class="fine-amount">${item.fine ? `R$${formatFine(item.fine)}` : 'R$0,00'}</span>`;
                    }
                    if (section.fields.includes('borrow_count')) {
                        content += `<span>${item.borrow_count || 0} vezes emprestado</span>`;
                    }
                    historyItem.innerHTML = content;
                    grid.appendChild(historyItem);
                });
            });
        })
        .catch(error => {
            console.error('Erro ao carregar histórico:', error);
            const notify = new Notify();
            notify.show('Erro ao carregar histórico.', 'error');
            grids.forEach(grid => {
                const element = document.getElementById(grid.id);
                if (element) {
                    element.innerHTML = '<p>Erro ao carregar histórico.</p>';
                }
            });
        });
}

document.addEventListener('DOMContentLoaded', () => {
    loadHistory();
    const searchInput = document.getElementById('section-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => loadHistory());
    } else {
        console.warn('Input de busca com ID section-search não encontrado.');
    }
});