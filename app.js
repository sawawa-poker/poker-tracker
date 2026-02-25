// State
let selectedCards = {
    hole: [null, null], // 2 elements
    board: [null, null, null, null, null] // 5 elements (Flop 1,2,3, Turn, River)
};

let activeSlot = null; // { type: 'hole' | 'board', index: number, element: DOMElement }
let modalSuit = 's'; // Default suit selection

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

// Suits Mapping
const SUITS = {
    's': { symbol: '♠', colorClass: 'black' },
    'h': { symbol: '♥', colorClass: 'red' },
    'd': { symbol: '♦', colorClass: 'red' },
    'c': { symbol: '♣', colorClass: 'black' }
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
}

function deleteHand(id) {
    if (confirm('Are you sure you want to delete this hand?')) {
        history = history.filter(record => record.id !== id);
        localStorage.setItem('pokerTrackerHistory', JSON.stringify(history));
        renderHistory();
    }
}

function setupEventListeners() {
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
            clearCard(activeSlot.type, activeSlot.index, activeSlot.element);
            closeModal();
        }
    });

    // Save hand
    saveBtn.addEventListener('click', saveHand);
}

// Modal Logic
function openModal(type, index, element) {
    activeSlot = { type, index, element };

    // Set active suit button state
    suitBtns.forEach(b => b.classList.remove('active'));
    document.querySelector(`.suit-btn[data-suit="${modalSuit}"]`).classList.add('active');

    // Toggle Clear button visibility
    if (selectedCards[type][index] !== null) {
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
    // Disable ranks that are already selected in the current suit across ALL slots
    const allSelectedCards = [...selectedCards.hole, ...selectedCards.board].filter(c => c !== null);

    rankBtns.forEach(btn => {
        const rank = btn.dataset.rank;
        const currentCard = { rank, suit: modalSuit };

        const isAlreadySelected = allSelectedCards.some(
            c => c.rank === currentCard.rank && c.suit === currentCard.suit
        );

        // Don't disable if it's the card currently in the active slot
        const isCurrentSlotCard = activeSlot &&
            selectedCards[activeSlot.type][activeSlot.index] &&
            selectedCards[activeSlot.type][activeSlot.index].rank === rank &&
            selectedCards[activeSlot.type][activeSlot.index].suit === modalSuit;

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
    selectedCards[activeSlot.type][activeSlot.index] = card;

    renderSlot(activeSlot.element, card);
    closeModal();
}

function clearCard(type, index, element) {
    selectedCards[type][index] = null;
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
        hole: structuredClone(selectedCards.hole),
        board: structuredClone(selectedCards.board),
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

    // Reset DOM elements
    document.querySelectorAll('.card-slot').forEach(slot => {
        slot.className = 'card-slot empty';
        slot.innerHTML = '+';
    });

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

        return `
            <div class="history-item" data-id="${record.id}">
                <div class="history-header">
                    <span>Hand #${record.id.toString().slice(-4)}</span>
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
                </div>
                ${record.notes ? `<div class="history-notes">${record.notes}</div>` : ''}
            </div>
        `;
    }).join('');
}

// Run app
init();
