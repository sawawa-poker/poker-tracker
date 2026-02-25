// State
let selectedCards = {
    hole: [null, null], // 2 elements
    board: [null, null, null, null, null] // 5 elements (Flop 1,2,3, Turn, River)
};
let opponentHands = []; // Array of { id, position, cards: [null, null] }

let activeSlot = null; // { type: 'hole' | 'board' | 'opponent', index: number, opponentId?: string, element: DOMElement }
let modalSuit = 's'; // Default suit selection

let bettingActions = {
    preflop: [], // Array of { position: string, action: string, amount?: number }
    flop: [],
    turn: [],
    river: []
};
let activeActionContext = null; // { street: string, position: string }

let history = []; // Array of saved hands

// DOM Elements
const cardSlots = document.querySelectorAll('.card-slot');
const modal = document.getElementById('card-picker-modal');
const closeModalBtn = document.getElementById('close-modal');
const suitBtns = document.querySelectorAll('.suit-btn');
const rankBtns = document.querySelectorAll('.rank-btn');
const clearSlotBtn = document.getElementById('clear-slot-btn');
const saveBtn = document.getElementById('save-btn');
const notesInput = document.getElementById('hand-notes');
const historyList = document.getElementById('history-list');
const playerCountSelect = document.getElementById('player-count');
const myPositionContainer = document.getElementById('my-position-container');
const opponentsContainer = document.getElementById('opponents-container');
const addOpponentBtn = document.getElementById('add-opponent-btn');

// Action Modal Elements
const actionModal = document.getElementById('action-picker-modal');
const closeActionModalBtn = document.getElementById('close-action-modal');
const actionModalTitle = document.getElementById('action-modal-title');
const actionBtns = document.querySelectorAll('.action-btn');
const actionAmountSection = document.getElementById('action-amount-section');
const actionSlider = document.getElementById('action-slider');
const actionSliderVal = document.getElementById('action-slider-val');
const presetBtns = document.querySelectorAll('.preset-btn');
const confirmActionBtn = document.getElementById('confirm-action-btn');

let currentMyPos = 'BTN';

// Suits Mapping
const SUITS = {
    's': { symbol: '♠', colorClass: 'black' },
    'h': { symbol: '♥', colorClass: 'red' },
    'd': { symbol: '♦', colorClass: 'red' },
    'c': { symbol: '♣', colorClass: 'black' }
};

// Positions Mapping by Player Count
const POSITIONS_MAP = {
    2: ['SB/BTN', 'BB'],
    3: ['SB', 'BB', 'BTN'],
    4: ['SB', 'BB', 'CO', 'BTN'],
    5: ['SB', 'BB', 'HJ', 'CO', 'BTN'],
    6: ['SB', 'BB', 'UTG', 'MP', 'CO', 'BTN'],
    7: ['SB', 'BB', 'UTG', 'UTG+1', 'MP', 'CO', 'BTN'],
    8: ['SB', 'BB', 'UTG', 'UTG+1', 'MP', 'HJ', 'CO', 'BTN'],
    9: ['SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'MP', 'HJ', 'CO', 'BTN'],
    10: ['SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'MP1', 'MP2', 'HJ', 'CO', 'BTN']
};

// Initialization
function init() {
    setupEventListeners();

    // Load history from localStorage
    const savedHistory = localStorage.getItem('pokerTrackerHistory');
    if (savedHistory) {
        try {
            history = JSON.parse(savedHistory);
        } catch (e) {
            console.error('Failed to parse history', e);
        }
    }

    renderHistory();
    updatePositionOptions();
}

function updatePositionOptions() {
    const players = parseInt(playerCountSelect.value);
    const positions = POSITIONS_MAP[players] || POSITIONS_MAP[6];

    // Update My Position
    if (!positions.includes(currentMyPos)) {
        currentMyPos = positions.includes('BTN') ? 'BTN' : positions[0];
    }

    myPositionContainer.innerHTML = positions.map(pos =>
        `<button class="pos-btn ${currentMyPos === pos ? 'active' : ''}" data-pos="${pos}">${pos}</button>`
    ).join('');

    // Reattach listeners for my positions
    myPositionContainer.querySelectorAll('.pos-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            currentMyPos = btn.dataset.pos;
            myPositionContainer.querySelectorAll('.pos-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        });
    });

    // Update opponent selects
    renderOpponents();

    // Update Action tracking UI layout based on new positions
    renderActionStreets();
}

function deleteHand(id) {
    history = history.filter(record => record.id !== id);
    localStorage.setItem('pokerTrackerHistory', JSON.stringify(history));
    renderHistory();
}

function setupEventListeners() {
    // Player count change
    playerCountSelect.addEventListener('change', updatePositionOptions);

    // Open modal on slot click
    cardSlots.forEach(slot => {
        slot.addEventListener('click', (e) => {
            const type = slot.dataset.type;
            const index = parseInt(slot.dataset.index);
            openModal(type, index, slot);
        });
    });

    // Close modal
    closeModalBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal();
    });

    // Suit selection
    suitBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            suitBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            modalSuit = btn.dataset.suit;
            updateDisabledRanks();
        });
    });

    // Rank selection (Assigns card to slot)
    rankBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            const rank = btn.dataset.rank;
            selectCard(rank, modalSuit);
        });
    });

    // Clear slot
    clearSlotBtn.addEventListener('click', () => {
        if (activeSlot) {
            clearCard(activeSlot.type, activeSlot.index, activeSlot.opponentId, activeSlot.element);
            closeModal();
        }
    });

    // Opponent Hands
    addOpponentBtn.addEventListener('click', addOpponentRow);

    // Save hand
    saveBtn.addEventListener('click', saveHand);

    // Action Modal Listeners
    closeActionModalBtn.addEventListener('click', closeActionModal);
    actionModal.addEventListener('click', (e) => {
        if (e.target === actionModal) closeActionModal();
    });

    actionBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            actionBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            const action = btn.dataset.action;
            if (action === 'Bet' || action === 'Call' || action === 'All-in') {
                actionAmountSection.classList.remove('hidden');
            } else {
                actionAmountSection.classList.add('hidden');
            }
        });
    });

    actionSlider.addEventListener('input', (e) => {
        actionSliderVal.textContent = `${e.target.value}bb`;
        presetBtns.forEach(b => b.classList.remove('active'));
    });

    presetBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            presetBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Assume 100bb starting depth for simplicity of pot-percentage mock calculation 
            // In a real app we'd track actual pot size. Here we just map logic to slider.
            const val = parseInt(btn.dataset.val);
            actionSlider.value = val;
            actionSliderVal.textContent = `${val}bb`;
        });
    });

    confirmActionBtn.addEventListener('click', saveAction);
}

// Action Tracking Logic
function renderActionStreets() {
    const players = parseInt(playerCountSelect.value);
    const positions = POSITIONS_MAP[players] || POSITIONS_MAP[6];
    const streets = ['preflop', 'flop', 'turn', 'river'];

    // Sort positions by preflop action order for preflop, and postflop order for the rest
    // Standard 6-max Preflop: UTG, MP, CO, BTN, SB, BB
    // Standard 6-max Postflop: SB, BB, UTG, MP, CO, BTN
    // We already have POSITIONS_MAP in postflop order (roughly SB -> BTN).

    streets.forEach(street => {
        const container = document.getElementById(`players-${street}`);
        const logContainer = document.getElementById(`log-${street}`);

        let displayPositions = [...positions];
        if (street === 'preflop') {
            // Move SB and BB to the end
            const blinds = displayPositions.splice(0, 2);
            displayPositions.push(...blinds);
        }

        container.innerHTML = displayPositions.map(pos => {
            // Check if this position has an action recorded in this street
            const existingAction = bettingActions[street].find(a => a.position === pos);
            let btnClass = 'player-action-btn';
            let label = pos;

            if (existingAction) {
                btnClass += ` has-action action-${existingAction.action.toLowerCase()}`;
                label = `${pos}: ${existingAction.action}`;
                if (existingAction.amount) label += ` ${existingAction.amount}bb`;
            }

            return `<button class="${btnClass}" onclick="openActionModal('${street}', '${pos}')">${label}</button>`;
        }).join('');

        // Render logs
        logContainer.innerHTML = bettingActions[street].map(a => {
            let text = `<span style="font-weight:600;">${a.position}</span>: ${a.action}`;
            if (a.amount) text += ` ${a.amount}bb`;
            return `<div class="log-entry">${text} <button onclick="removeAction('${street}', '${a.position}')" style="background:none; border:none; color:var(--card-text-red); font-size:1rem; cursor:pointer; margin-left:4px;">&times;</button></div>`;
        }).join('');
    });
}

function openActionModal(street, position) {
    activeActionContext = { street, position };
    actionModalTitle.textContent = `Action for ${position} (${street})`;

    // Reset modal state
    actionBtns.forEach(b => b.classList.remove('active'));
    actionAmountSection.classList.add('hidden');
    presetBtns.forEach(b => b.classList.remove('active'));
    actionSlider.value = 50;
    actionSliderVal.textContent = '50bb';

    actionModal.classList.remove('hidden');
}

function closeActionModal() {
    actionModal.classList.add('hidden');
    activeActionContext = null;
}

function saveAction() {
    if (!activeActionContext) return;

    const activeBtn = Array.from(actionBtns).find(b => b.classList.contains('active'));
    if (!activeBtn) {
        alert("Please select an action type.");
        return;
    }

    const action = activeBtn.dataset.action;
    let amount = null;

    if (action === 'Bet' || action === 'Call' || action === 'All-in') {
        amount = parseInt(actionSlider.value);
    }

    const { street, position } = activeActionContext;

    // Remove existing action for this position on this street if any
    bettingActions[street] = bettingActions[street].filter(a => a.position !== position);

    // Add new action
    bettingActions[street].push({ position, action, amount });

    renderActionStreets();
    closeActionModal();
}

function removeAction(street, position) {
    bettingActions[street] = bettingActions[street].filter(a => a.position !== position);
    renderActionStreets();
}

function addOpponentRow() {
    const oppId = 'opp_' + Date.now();
    const players = parseInt(playerCountSelect.value);
    const positions = POSITIONS_MAP[players] || POSITIONS_MAP[6];
    const defaultPos = positions.includes('BB') ? 'BB' : positions[0];

    opponentHands.push({ id: oppId, position: defaultPos, cards: [null, null] });
    renderOpponents();

    // Auto open modal for the newly created opponent's first card
    const newSlot = document.querySelector(`.card-slot[data-type="opponent"][data-oppid="${oppId}"][data-index="0"]`);
    if (newSlot) openModal('opponent', 0, newSlot, oppId);
}

function removeOpponentRow(oppId) {
    opponentHands = opponentHands.filter(opp => opp.id !== oppId);
    renderOpponents();
}

function renderOpponents() {
    const players = parseInt(playerCountSelect.value);
    const positions = POSITIONS_MAP[players] || POSITIONS_MAP[6];

    opponentsContainer.innerHTML = opponentHands.map(opp => `
        <div class="opponent-row" data-id="${opp.id}">
            <div class="opponent-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                <span class="stage-label" style="font-weight: 600; color: var(--text-main);">Opponent Position</span>
                <button class="remove-opponent-btn" onclick="removeOpponentRow('${opp.id}')">&times;</button>
            </div>
            <div class="position-button-group opp-pos-group" style="margin-bottom: 0.75rem;">
                ${positions.map(pos => `<button class="pos-btn ${opp.position === pos ? 'active' : ''}" data-pos="${pos}">${pos}</button>`).join('')}
            </div>
            <div class="card-selection-area">
                <div class="card-slot ${opp.cards[0] ? 'filled ' + SUITS[opp.cards[0].suit].colorClass : 'empty'}" data-type="opponent" data-oppid="${opp.id}" data-index="0">
                    ${opp.cards[0] ? `<span class="rank">${opp.cards[0].rank}</span><span class="suit">${SUITS[opp.cards[0].suit].symbol}</span>` : '+'}
                </div>
                <div class="card-slot ${opp.cards[1] ? 'filled ' + SUITS[opp.cards[1].suit].colorClass : 'empty'}" data-type="opponent" data-oppid="${opp.id}" data-index="1">
                    ${opp.cards[1] ? `<span class="rank">${opp.cards[1].rank}</span><span class="suit">${SUITS[opp.cards[1].suit].symbol}</span>` : '+'}
                </div>
            </div>
        </div>
    `).join('');

    // Reattach listeners for new opponent slots and selects
    document.querySelectorAll('.opponent-row').forEach(row => {
        const id = row.dataset.id;
        const oppObj = opponentHands.find(o => o.id === id);

        row.querySelectorAll('.opp-pos-group .pos-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                oppObj.position = btn.dataset.pos;
                row.querySelectorAll('.opp-pos-group .pos-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            });
        });

        row.querySelectorAll('.card-slot').forEach(slot => {
            slot.addEventListener('click', () => {
                openModal('opponent', parseInt(slot.dataset.index), slot, id);
            });
        });
    });
}

// Modal Logic
function openModal(type, index, element, opponentId = null) {
    activeSlot = { type, index, opponentId, element };

    // Update modal title
    const modalTitleEl = document.getElementById('card-modal-title');
    if (modalTitleEl) {
        let title = 'Select Card';
        if (type === 'hole') {
            title = `Hole Card ${index + 1}`;
        } else if (type === 'board') {
            if (index < 3) title = `Flop Card ${index + 1}`;
            else if (index === 3) title = 'Turn Card';
            else if (index === 4) title = 'River Card';
        } else if (type === 'opponent') {
            title = `Opponent Hole ${index + 1}`;
        }
        modalTitleEl.textContent = title;
    }

    // Set active suit button state
    suitBtns.forEach(b => b.classList.remove('active'));
    document.querySelector(`.suit-btn[data-suit="${modalSuit}"]`).classList.add('active');

    let targetCard = null;
    if (type === 'opponent') {
        const opp = opponentHands.find(o => o.id === activeSlot.opponentId);
        if (opp) targetCard = opp.cards[index];
    } else {
        targetCard = selectedCards[type][index];
    }

    // Toggle Clear button visibility
    if (targetCard !== null) {
        clearSlotBtn.classList.remove('hidden');
    } else {
        clearSlotBtn.classList.add('hidden');
    }

    updateDisabledRanks();
    modal.classList.remove('hidden');
}

function closeModal() {
    modal.classList.add('hidden');
    activeSlot = null;
}

function updateDisabledRanks() {
    // Collect all cards
    const oppCards = opponentHands.flatMap(opp => opp.cards).filter(c => c !== null);
    const allSelectedCards = [...selectedCards.hole, ...selectedCards.board, ...oppCards].filter(c => c !== null);

    rankBtns.forEach(btn => {
        const rank = btn.dataset.rank;
        const currentCard = { rank, suit: modalSuit };

        const isAlreadySelected = allSelectedCards.some(
            c => c.rank === currentCard.rank && c.suit === currentCard.suit
        );

        let isCurrentSlotCard = false;
        if (activeSlot) {
            const { type, index, opponentId } = activeSlot;
            let targetCardObj = null;
            if (type === 'opponent') {
                const opp = opponentHands.find(o => o.id === opponentId);
                if (opp) targetCardObj = opp.cards[index];
            } else {
                targetCardObj = selectedCards[type][index];
            }
            if (targetCardObj && targetCardObj.rank === rank && targetCardObj.suit === modalSuit) {
                isCurrentSlotCard = true;
            }
        }

        if (isAlreadySelected && !isCurrentSlotCard) {
            btn.disabled = true;
        } else {
            btn.disabled = false;
        }
    });
}

// Card Selection Logic
function selectCard(rank, suit) {
    if (!activeSlot) return;

    const card = { rank, suit };
    const { type, index, element, opponentId } = activeSlot;

    if (type === 'opponent') {
        const opp = opponentHands.find(o => o.id === opponentId);
        if (opp) opp.cards[index] = card;
    } else {
        selectedCards[type][index] = card;
    }

    renderSlot(element, card);

    closeModal();

    // Auto-advance logic
    if (type === 'hole') {
        if (index === 0) {
            // Auto open hole 2
            const nextSlot = document.querySelector('.card-slot[data-type="hole"][data-index="1"]');
            if (nextSlot && !selectedCards.hole[1]) openModal('hole', 1, nextSlot);
        }
    } else if (type === 'board') {
        if (index < 4) {
            // Auto open next board slot (0 to 1, 1 to 2, 2 to 3, 3 to 4)
            const nextIndex = index + 1;
            const nextSlot = document.querySelector(`.card-slot[data-type="board"][data-index="${nextIndex}"]`);
            if (nextSlot && !selectedCards.board[nextIndex]) openModal('board', nextIndex, nextSlot);
        }
    } else if (type === 'opponent') {
        if (index === 0) {
            const nextSlot = document.querySelector(`.card-slot[data-type="opponent"][data-oppid="${opponentId}"][data-index="1"]`);
            const opp = opponentHands.find(o => o.id === opponentId);
            if (nextSlot && opp && !opp.cards[1]) openModal('opponent', 1, nextSlot, opponentId);
        }
    }
}

function clearCard(type, index, opponentId, element) {
    if (type === 'opponent') {
        const opp = opponentHands.find(o => o.id === opponentId);
        if (opp) opp.cards[index] = null;
    } else {
        selectedCards[type][index] = null;
    }
    element.className = 'card-slot empty';
    element.innerHTML = '+';
}

function renderSlot(element, card) {
    const suitInfo = SUITS[card.suit];
    element.className = `card-slot filled ${suitInfo.colorClass}`;
    element.innerHTML = `
        <span class="rank">${card.rank}</span>
        <span class="suit">${suitInfo.symbol}</span>
    `;
}

// Save & History Logic
function saveHand() {
    // Basic validation: user should have at least hole cards or some notes
    const hasHoleCards = selectedCards.hole.some(c => c !== null);
    const hasNotes = notesInput.value.trim() !== '';

    if (!hasHoleCards && !hasNotes) {
        alert("Please select at least hole cards or enter notes to save a hand.");
        return;
    }

    const handRecord = {
        id: Date.now(),
        date: new Date().toLocaleString(),
        players: parseInt(playerCountSelect.value),
        position: currentMyPos,
        hole: structuredClone(selectedCards.hole),
        board: structuredClone(selectedCards.board),
        opponents: structuredClone(opponentHands),
        actions: structuredClone(bettingActions),
        notes: notesInput.value.trim()
    };

    history.unshift(handRecord); // Add to beginning of array

    // Save to localStorage
    localStorage.setItem('pokerTrackerHistory', JSON.stringify(history));

    renderHistory();
    resetForm();
}

function resetForm() {
    // Reset State
    selectedCards = {
        hole: [null, null],
        board: [null, null, null, null, null]
    };
    opponentHands = [];
    bettingActions = {
        preflop: [], flop: [], turn: [], river: []
    };

    // Reset DOM elements
    document.querySelectorAll('.card-slot[data-type="hole"], .card-slot[data-type="board"]').forEach(slot => {
        slot.className = 'card-slot empty';
        slot.innerHTML = '+';
    });

    renderOpponents();
    renderActionStreets();
    notesInput.value = '';
}

function generateMiniCardHTML(card) {
    if (!card) return '';
    const suitInfo = SUITS[card.suit];
    return `
        <div class="mini-card ${suitInfo.colorClass}">
            <span class="rank">${card.rank}</span>
            <span class="suit">${suitInfo.symbol}</span>
        </div>
    `;
}

function renderHistory() {
    if (history.length === 0) {
        historyList.innerHTML = '<div class="empty-state">No hands recorded yet.</div>';
        return;
    }

    historyList.innerHTML = history.map(record => {
        // Filter out null cards
        const validHole = record.hole.filter(c => c !== null);
        const validBoard = record.board.filter(c => c !== null);

        let holeHTML = validHole.length > 0
            ? `<div class="history-cards-group"><strong>Hole:</strong> ${validHole.map(c => generateMiniCardHTML(c)).join('')}</div>`
            : '';

        let boardHTML = validBoard.length > 0
            ? `<div class="history-cards-group"><strong>Board:</strong> ${validBoard.map(c => generateMiniCardHTML(c)).join('')}</div>`
            : '';

        let oppsHTML = '';
        if (record.opponents && record.opponents.length > 0) {
            const oppsValid = record.opponents.filter(o => o.cards.some(c => c !== null));
            if (oppsValid.length > 0) {
                oppsHTML = `<div class="history-cards-group" style="width:100%; margin-top:0.5rem;"><strong>Opponents:</strong><br/>` +
                    oppsValid.map(o => {
                        const validOppCards = o.cards.filter(c => c !== null);
                        return `<span style="display:inline-flex; align-items:center; margin-right: 1rem;"><span style="color:var(--text-muted); font-size:0.8rem; margin-right:4px;">${o.position}</span> ${validOppCards.map(c => generateMiniCardHTML(c)).join('')}</span>`;
                    }).join('') + `</div>`;
            }
        }

        let actionLogHTML = '';
        if (record.actions) {
            const streets = ['preflop', 'flop', 'turn', 'river'];
            const streetEmoji = { preflop: '🎭', flop: '🃏', turn: '🔥', river: '🌊' };

            streets.forEach(street => {
                if (record.actions[street] && record.actions[street].length > 0) {
                    actionLogHTML += `<div style="margin-top: 0.5rem; font-size: 0.85rem; background: rgba(0,0,0,0.2); padding: 0.5rem; border-radius: 4px; border: 1px solid var(--border-color);">
                        <strong style="color:var(--primary); text-transform: capitalize;">${streetEmoji[street]} ${street}:</strong> 
                        <span style="color: var(--text-muted);">` +
                        record.actions[street].map(a => `<span style="color:var(--text-main); font-weight:500;">${a.position}</span> ${a.action}${a.amount ? ` ${a.amount}bb` : ''}`).join(' → ')
                        + `</span></div>`;
                }
            });
        }

        return `
            <div class="history-item" data-id="${record.id}">
                <div class="history-header">
                    <span>Hand #${record.id.toString().slice(-4)} <span style="color:var(--text-muted); font-size: 0.8rem; margin-left: 8px;">(${record.players || '-'} handed, ${record.position || '-'})</span></span>
                    <div>
                        <span style="margin-right: 10px;">${record.date}</span>
                        <button class="delete-btn" onclick="deleteHand(${record.id})" style="background:none; border:none; color:#ef4444; cursor:pointer;" title="Delete Hand">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                        </button>
                    </div>
                </div>
                <div class="history-cards">
                    ${holeHTML}
                    ${boardHTML}
                    ${oppsHTML}
                </div>
                ${actionLogHTML}
                ${record.notes ? `<div class="history-notes" style="margin-top: 0.75rem;">${record.notes}</div>` : ''}
            </div>
        `;
    }).join('');
}

// Run app
init();
