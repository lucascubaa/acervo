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
    try {
        return Number(amount || 0).toFixed(2).replace('.', ',');
    } catch (e) {
        return '0,00';
    }
}

function loadHistory() {
    const list = document.getElementById('history-list');
    if (!list) {
        console.error('Elemento #history-list não encontrado.');
        return;
    }

    list.innerHTML = '<div class="loader">Carregando histórico...</div>';

    const searchTerm = document.getElementById('search-history')?.value.toLowerCase().trim() || '';
    const filterType = document.getElementById('filter-type')?.value || 'all';
    const sortBy = document.getElementById('sort-by')?.value || 'newest';

    fetch('/api/history')
        .then(response => {
            if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            return response.json();
        })
        .then(data => {
            const added = (data.added_books || []).map(i => ({...i, _type: 'added'}));
            const borrowed = (data.borrowed_books || []).map(i => ({...i, _type: 'borrowed'}));
            const returned = (data.returned_books || []).map(i => ({...i, _type: 'returned'}));

            let all = added.concat(borrowed, returned);

            if (filterType !== 'all') all = all.filter(i => i._type === filterType);

            if (searchTerm) {
                all = all.filter(item => (
                    (item.title || '').toLowerCase().includes(searchTerm) ||
                    (item.author || '').toLowerCase().includes(searchTerm) ||
                    (item.isbn || '').toLowerCase().includes(searchTerm)
                ));
            }

            if (sortBy === 'newest') {
                all.sort((a,b) => (new Date(b.created_at || b.return_date || b.borrow_date || Date.now())) - (new Date(a.created_at || a.return_date || a.borrow_date || 0)));
            } else if (sortBy === 'oldest') {
                all.sort((a,b) => (new Date(a.created_at || a.return_date || a.borrow_date || 0)) - (new Date(b.created_at || b.return_date || b.borrow_date || Date.now())));
            } else if (sortBy === 'title') {
                all.sort((a,b) => ('' + (a.title || '')).localeCompare(b.title || ''));
            }

            if (all.length === 0) {
                list.innerHTML = '<div class="no-results">Nenhum registro encontrado.</div>';
                return;
            }

            list.innerHTML = '';
            all.forEach(item => {
                const card = document.createElement('div');
                card.className = 'history-card';

                const meta = document.createElement('div');
                meta.className = 'meta';
                const left = document.createElement('div');
                const title = document.createElement('div');
                title.className = 'title';
                title.textContent = item.title || 'Desconhecido';
                const sub = document.createElement('div');
                sub.className = 'sub';
                sub.textContent = `${item.author || 'Desconhecido'} • ISBN: ${item.isbn || 'N/A'}`;
                left.appendChild(title);
                left.appendChild(sub);

                const rightMeta = document.createElement('div');
                rightMeta.className = 'sub';
                const dateInfo = item.return_date || item.borrow_date || item.created_at || '';
                rightMeta.textContent = dateInfo ? new Date(dateInfo).toLocaleDateString('pt-BR') : '';

                meta.appendChild(left);
                meta.appendChild(rightMeta);

                const actions = document.createElement('div');
                actions.className = 'actions';
                const tag = document.createElement('div');
                tag.className = `tag ${item._type}`;
                tag.textContent = item._type === 'added' ? 'Adicionado' : item._type === 'borrowed' ? 'Emprestado' : 'Devolvido';

                if (item._type === 'returned') {
                    const fine = document.createElement('div');
                    fine.className = 'sub';
                    fine.textContent = item.fine ? `Multa: R$${formatFine(item.fine)}` : '';
                    actions.appendChild(fine);
                }

                actions.appendChild(tag);

                card.appendChild(meta);
                card.appendChild(actions);

                card.addEventListener('click', () => {
                    card.animate([{ transform: 'translateY(-4px)' }, { transform: 'translateY(0)' }], { duration: 200 });
                });

                list.appendChild(card);
            });
        })
        .catch(error => {
            console.error('Erro ao carregar histórico:', error);
            const notify = new Notify();
            notify.show('Erro ao carregar histórico.', 'error');
            list.innerHTML = '<div class="no-results">Erro ao carregar histórico.</div>';
        });
}

document.addEventListener('DOMContentLoaded', () => {
    loadHistory();

    const searchInput = document.getElementById('search-history');
    const filterSelect = document.getElementById('filter-type');
    const sortSelect = document.getElementById('sort-by');

    if (searchInput) {
        let debounce;
        searchInput.addEventListener('input', () => {
            clearTimeout(debounce);
            debounce = setTimeout(() => loadHistory(), 250);
        });
    }
    if (filterSelect) filterSelect.addEventListener('change', () => loadHistory());
    if (sortSelect) sortSelect.addEventListener('change', () => loadHistory());
});