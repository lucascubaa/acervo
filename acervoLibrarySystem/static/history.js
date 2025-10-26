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

// --- estudantes: buscar, renderizar e adicionar ---
function renderStudentsList(students) {
    // renderiza lista onde houver: painel antigo (#students-list) e modal (#students-modal-list)
    const ids = ['students-list', 'students-modal-list'];
    ids.forEach(id => {
        const container = document.getElementById(id);
        if (!container) return;
        if (!students || students.length === 0) {
            container.innerHTML = '<div class="muted">Nenhum aluno cadastrado.</div>';
            return;
        }
        container.innerHTML = '';
        const ul = document.createElement('ul');
        ul.style.paddingLeft = '1rem';
        students.forEach(s => {
            const li = document.createElement('li');
            li.textContent = s.name;
            li.style.marginBottom = '0.25rem';
            ul.appendChild(li);
        });
        container.appendChild(ul);
    });
}

function loadStudents() {
    fetch('/api/students')
        .then(r => { if (!r.ok) throw new Error('Falha ao carregar alunos'); return r.json(); })
        .then(data => {
            renderStudentsList(data || []);
        })
        .catch(err => {
            console.error('Erro ao carregar alunos:', err);
            const container = document.getElementById('students-modal-list');
            if (container) container.innerHTML = '<div class="muted">Erro ao carregar alunos.</div>';
        });
}

function addStudent() {
    const input = document.getElementById('students-modal-new-name');
    if (!input) return;
    const name = (input.value || '').trim();
    if (!name) {
        new Notify().show('Informe o nome do aluno', 'error');
        return;
    }
    const btn = document.getElementById('students-modal-add');
    if (btn) { btn.disabled = true; btn.textContent = 'Adicionando...'; }
    fetch('/api/add_student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name })
    })
    .then(r => r.json().then(j => ({ ok: r.ok, status: r.status, body: j })))
    .then(res => {
        if (!res.ok) {
            console.error('Erro ao adicionar aluno', res);
            new Notify().show(res.body?.error || 'Erro ao adicionar aluno', 'error');
            return;
        }
        new Notify().show('Aluno adicionado', 'success');
        input.value = '';
        loadStudents();
    })
    .catch(err => { console.error('Erro na requisição add_student', err); new Notify().show('Erro ao adicionar aluno', 'error'); })
    .finally(() => { if (btn) { btn.disabled = false; btn.textContent = 'Adicionar'; } });
}

function openStudentsModal() {
    const modal = document.getElementById('students-modal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'false');
    modal.style.display = 'flex';
    // focus input
    const input = document.getElementById('students-modal-new-name');
    if (input) input.focus();
    loadStudents();
}

function closeStudentsModal() {
    const modal = document.getElementById('students-modal');
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    modal.style.display = 'none';
}

// close modal on ESC
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeStudentsModal();
});

function loadHistory() {
    const list = document.getElementById('history-list');
    if (!list) {
        console.error('Elemento #history-list não encontrado.');
        return;
    }

    list.innerHTML = '<div class="loader">Carregando histórico...</div>';

    const searchTerm = document.getElementById('search-history')?.value.toLowerCase().trim() || '';
    const filterType = document.getElementById('filter-type')?.value || 'all';
    const filterCategory = document.getElementById('filter-category')?.value || 'all';
    const sortBy = document.getElementById('sort-by')?.value || 'newest';
    const fromDate = document.getElementById('from-date')?.value || '';
    const toDate = document.getElementById('to-date')?.value || '';
    const pageSize = 10000; // mostrar todos os registros de uma vez
    const page = Number(list.getAttribute('data-page') || 1);

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

            // populate category filter options based on data
            try {
                const categorySelect = document.getElementById('filter-category');
                if (categorySelect) {
                    const cats = Array.from(new Set(all.map(i => (i.category || '').trim()).filter(Boolean))).sort((a,b)=>a.localeCompare(b));
                    // clear existing except 'all'
                    const prev = categorySelect.value || 'all';
                    categorySelect.innerHTML = '<option value="all">Todas categorias</option>' + cats.map(c=>`<option value="${c}">${c}</option>`).join('');
                    // restore previous if exists
                    if (prev && Array.from(categorySelect.options).some(o=>o.value===prev)) categorySelect.value = prev;
                }
            } catch (e) { console.warn('Erro ao popular filtro de categorias', e); }

            if (filterType !== 'all') all = all.filter(i => i._type === filterType);

            if (filterCategory && filterCategory !== 'all') {
                all = all.filter(i => ((i.category || '').toLowerCase() === filterCategory.toLowerCase()));
            }

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

            // apply date filters
            if (fromDate) {
                const f = new Date(fromDate);
                all = all.filter(i => new Date(i.created_at || i.borrow_date || i.return_date || 0) >= f);
            }
            if (toDate) {
                const t = new Date(toDate);
                // include the full day
                t.setHours(23,59,59,999);
                all = all.filter(i => new Date(i.created_at || i.borrow_date || i.return_date || 0) <= t);
            }

            // summary
            const summary = document.getElementById('summary-count');
            if (summary) summary.textContent = all.length;

            // Atualizar estatísticas da sidebar e modal
            const statAdded = document.getElementById('stat-added');
            const statBorrowed = document.getElementById('stat-borrowed');
            const statReturned = document.getElementById('stat-returned');
            if (statAdded) statAdded.textContent = added.length;
            if (statBorrowed) statBorrowed.textContent = borrowed.length;
            if (statReturned) statReturned.textContent = returned.length;

            // Calcular e atualizar taxas
            const totalBooks = added.length;
            const loanRate = document.getElementById('loan-rate');
            const returnRate = document.getElementById('return-rate');
            
            // Taxa de Empréstimo: livros emprestados no momento / total de livros
            if (loanRate && totalBooks > 0) {
                const rate = ((borrowed.length / totalBooks) * 100).toFixed(1);
                loanRate.textContent = `${rate}%`;
            } else if (loanRate) {
                loanRate.textContent = '0%';
            }
            
            // Taxa de Devolução: livros devolvidos / total de empréstimos já feitos
            // Total de empréstimos = devolvidos + ainda emprestados
            const totalLoans = returned.length + borrowed.length;
            if (returnRate && totalLoans > 0) {
                const rate = ((returned.length / totalLoans) * 100).toFixed(1);
                returnRate.textContent = `${rate}%`;
            } else if (returnRate) {
                returnRate.textContent = '0%';
            }

            if (all.length === 0) {
                list.innerHTML = '<div class="no-results">Nenhum registro encontrado.</div>';
                document.getElementById('load-more').style.display = 'none';
                return;
            }

            // pagination: slice the items for the current page
            const start = (page - 1) * pageSize;
            const pageItems = all.slice(start, start + pageSize);

            list.innerHTML = '';
            pageItems.forEach(item => {
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
                const categoryText = item.category ? ` • ${item.category}` : '';
                sub.textContent = `${item.author || 'Desconhecido'}${categoryText} • ISBN: ${item.isbn || 'N/A'}`;
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

            // show/hide load more - sempre oculto para mostrar todos os registros
            const loadMoreBtn = document.getElementById('load-more');
            if (loadMoreBtn) {
                loadMoreBtn.style.display = 'none';
            }

            // store last results for export
            list._lastResults = all;
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
    // carregar lista de alunos e popular UI
    try { loadStudents(); } catch (e) { console.warn('loadStudents falhou', e); }

    // Modal de estatísticas
    const openStatsBtn = document.getElementById('open-stats-modal');
    const statsModal = document.getElementById('stats-modal');
    const closeStatsBtn = document.getElementById('stats-modal-close');
    
    if (openStatsBtn && statsModal) {
        openStatsBtn.addEventListener('click', () => {
            statsModal.setAttribute('aria-hidden', 'false');
            statsModal.style.display = 'flex';
        });
    }
    
    if (closeStatsBtn && statsModal) {
        closeStatsBtn.addEventListener('click', () => {
            statsModal.setAttribute('aria-hidden', 'true');
            statsModal.style.display = 'none';
        });
    }
    
    // Fechar modal ao clicar fora
    if (statsModal) {
        statsModal.addEventListener('click', (e) => {
            if (e.target === statsModal) {
                statsModal.setAttribute('aria-hidden', 'true');
                statsModal.style.display = 'none';
            }
        });
    }

    const searchInput = document.getElementById('search-history');
    const filterSelect = document.getElementById('filter-type');
    const sortSelect = document.getElementById('sort-by');

    if (searchInput) {
        let debounce;
        searchInput.addEventListener('input', () => {
            clearTimeout(debounce);
            debounce = setTimeout(() => {
                // reset page
                const list = document.getElementById('history-list');
                if (list) list.setAttribute('data-page', '1');
                loadHistory();
            }, 250);
        });
    }
    if (filterSelect) filterSelect.addEventListener('change', () => loadHistory());
    if (sortSelect) sortSelect.addEventListener('change', () => loadHistory());
    const categorySelect = document.getElementById('filter-category');
    if (categorySelect) categorySelect.addEventListener('change', () => { document.getElementById('history-list').setAttribute('data-page','1'); loadHistory(); });

    const fromInput = document.getElementById('from-date');
    const toInput = document.getElementById('to-date');
    if (fromInput) fromInput.addEventListener('change', () => { document.getElementById('history-list').setAttribute('data-page','1'); loadHistory(); });
    if (toInput) toInput.addEventListener('change', () => { document.getElementById('history-list').setAttribute('data-page','1'); loadHistory(); });

    const loadMore = document.getElementById('load-more');
    if (loadMore) loadMore.addEventListener('click', () => {
        const list = document.getElementById('history-list');
        const p = Number(list.getAttribute('data-page') || 1) + 1;
        list.setAttribute('data-page', String(p));
        loadHistory();
        // smooth scroll to new items
        setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' }), 200);
    });

    const exportBtn = document.getElementById('export-csv');
    if (exportBtn) exportBtn.addEventListener('click', () => {
        const list = document.getElementById('history-list');
        const scope = document.getElementById('export-scope')?.value || 'filtered';
        let sourceRows = list._lastResults || [];
        if (scope === 'page') {
            const page = Number(list.getAttribute('data-page') || 1);
            const pageSize = 40;
            const start = (page - 1) * pageSize;
            sourceRows = sourceRows.slice(start, start + pageSize);
        } else if (scope === 'all') {
            // fetch raw data again to ensure complete export
            // note: keep it simple and reuse _lastResults if it contains full dataset
            // if _lastResults is a filtered subset, fallback to fetching server
            // here we try to fetch server copy only if sizes mismatch
            // simplest: fetch again and combine
            // implement fetch of all and overwrite sourceRows
            fetch('/api/history')
                .then(r => { if (!r.ok) throw new Error('Erro ao buscar histórico'); return r.json(); })
                .then(data => {
                    const added = (data.added_books || []).map(i => ({...i, _type:'added'}));
                    const borrowed = (data.borrowed_books || []).map(i => ({...i, _type:'borrowed'}));
                    const returned = (data.returned_books || []).map(i => ({...i, _type:'returned'}));
                    sourceRows = added.concat(borrowed, returned);
                    doExport(sourceRows);
                })
                .catch(err => { const n = new Notify(); n.show('Erro ao buscar histórico completo para exportar', 'error'); console.error(err); });
            return;
        }

        if (!sourceRows.length) { const n = new Notify(); n.show('Nada para exportar', 'error'); return; }
        // when exporting filtered results, exclude the date column for readability
        const includeDate = scope !== 'filtered' ? true : false;
        doExport(sourceRows, { includeDate });
    });

    // toggle visibility/disabled state of date inputs depending on export scope
    const exportScope = document.getElementById('export-scope');
    const dateFilters = document.getElementById('date-filters');
    function updateDateInputsByScope() {
        const scope = exportScope?.value || 'filtered';
        if (scope === 'filtered') {
            if (dateFilters) dateFilters.style.display = 'none';
            document.getElementById('from-date').disabled = true;
            document.getElementById('to-date').disabled = true;
        } else {
            if (dateFilters) dateFilters.style.display = 'flex';
            document.getElementById('from-date').disabled = false;
            document.getElementById('to-date').disabled = false;
        }
    }
    if (exportScope) {
        exportScope.addEventListener('change', () => updateDateInputsByScope());
        // initial state
        updateDateInputsByScope();
    }

    // clear filters
    const clearBtn = document.getElementById('clear-filters');
    if (clearBtn) clearBtn.addEventListener('click', () => {
        document.getElementById('search-history').value = '';
        document.getElementById('filter-type').value = 'all';
        document.getElementById('sort-by').value = 'newest';
        document.getElementById('from-date').value = '';
        document.getElementById('to-date').value = '';
        document.getElementById('history-list').setAttribute('data-page','1');
        loadHistory();
    });

    // helper to build and trigger CSV download
    function doExport(rows, opts = { includeDate: true }) {
        const includeDate = !!opts.includeDate;
        const mapped = rows.map(r => {
            const base = {
                type: r._type || r.type || '',
                title: r.title || '',
                author: r.author || '',
                isbn: r.isbn || '',
                student: r.student_name || r.student || '' ,
                fine: r.fine || ''
            };
            if (includeDate) base.date = r.created_at || r.borrow_date || r.return_date || '';
            return base;
        });
        const csv = [Object.keys(mapped[0]).join(',')].concat(mapped.map(r => Object.values(r).map(v => '"'+String(v).replace(/"/g,'""')+'"').join(','))).join('\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'historico_export.csv';
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        const n = new Notify(); n.show('Exportado como historico_export.csv', 'success');
    }

    // Export to server docs folder
    const exportToDocsBtn = document.getElementById('export-to-docs');
    if (exportToDocsBtn) exportToDocsBtn.addEventListener('click', () => {
        const filterType = document.getElementById('filter-type')?.value || 'all';
        const from = document.getElementById('from-date')?.value || null;
        const to = document.getElementById('to-date')?.value || null;
        exportToDocsBtn.disabled = true;
        exportToDocsBtn.textContent = 'Exportando...';
        fetch('/api/history/export_to_docs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: filterType, from_date: from, to_date: to })
        })
            .then(r => { 
                if (!r.ok) throw new Error('Falha ao exportar'); 
                return r.blob(); 
            })
            .then(blob => {
                // Criar URL temporária para o blob
                const url = window.URL.createObjectURL(blob);
                const filename = `historico_biblioteca_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.docx`;
                
                // Fazer download automático
                const link = document.createElement('a');
                link.href = url;
                link.download = filename;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
                
                // Limpar URL temporária
                window.URL.revokeObjectURL(url);
                
                const n = new Notify();
                n.show(`Arquivo ${filename} baixado com sucesso!`, 'success');
                
                console.log('Arquivo Word exportado:', filename);
            })
            .catch(err => { 
                console.error('Erro ao exportar para Word:', err); 
                new Notify().show('Erro ao exportar para Word: ' + err.message, 'error'); 
            })
            .finally(() => { 
                exportToDocsBtn.disabled = false; 
                exportToDocsBtn.textContent = '� Exportar Word'; 
            });
    });

    // botao adicionar aluno
    const addStudentBtn = document.getElementById('add-student-btn');
    if (addStudentBtn) addStudentBtn.addEventListener('click', () => addStudent());

    // permitir Enter no input para adicionar
    const newStudentInput = document.getElementById('new-student-name');
    if (newStudentInput) newStudentInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); addStudent(); }
    });

    // ===== CONTROLE DE FILTROS TOGGLE =====
    const filterToggle = document.getElementById('filter-toggle');
    const filtersContent = document.getElementById('filters-content');
    
    if (filterToggle && filtersContent) {
        filterToggle.addEventListener('click', () => {
            const isExpanded = filterToggle.getAttribute('aria-expanded') === 'true';
            
            if (isExpanded) {
                filtersContent.style.display = 'none';
                filterToggle.setAttribute('aria-expanded', 'false');
            } else {
                filtersContent.style.display = 'block';
                filterToggle.setAttribute('aria-expanded', 'true');
            }
        });
    }

    // Função para contar filtros ativos
    function updateActiveFiltersCount() {
        let count = 0;
        
        const searchInput = document.getElementById('search-history');
        if (searchInput && searchInput.value.trim()) count++;
        
        const filterType = document.getElementById('filter-type');
        if (filterType && filterType.value !== 'all') count++;
        
        const filterCategory = document.getElementById('filter-category');
        if (filterCategory && filterCategory.value !== 'all') count++;
        
        const sortBy = document.getElementById('sort-by');
        if (sortBy && sortBy.value !== 'newest') count++;
        
        const fromDate = document.getElementById('from-date');
        if (fromDate && fromDate.value) count++;
        
        const toDate = document.getElementById('to-date');
        if (toDate && toDate.value) count++;
        
        const badge = document.getElementById('active-filters-count');
        if (badge) {
            badge.textContent = count > 0 ? count : '';
        }
    }

    // Atualizar contagem quando filtros mudarem
    const filterInputs = [
        'search-history',
        'filter-type',
        'filter-category',
        'sort-by',
        'from-date',
        'to-date'
    ];

    filterInputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', updateActiveFiltersCount);
            element.addEventListener('input', updateActiveFiltersCount);
        }
    });

    // Limpar filtros
    const clearFiltersBtn = document.getElementById('clear-filters');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', () => {
            document.getElementById('search-history').value = '';
            document.getElementById('filter-type').value = 'all';
            document.getElementById('filter-category').value = 'all';
            document.getElementById('sort-by').value = 'newest';
            document.getElementById('from-date').value = '';
            document.getElementById('to-date').value = '';
            updateActiveFiltersCount();
            loadHistory();
        });
    }

    // Inicializar contagem
    updateActiveFiltersCount();
});