import * as dom from '../core/dom.js';
import { getState } from '../core/state.js';

export const renderPvpRooms = () => {
    const { pvpRooms } = getState();
    dom.pvpRoomGridEl.innerHTML = pvpRooms.map(room => {
        const isSpecial = room.id === 12;
        const colorClass = isSpecial ? 'special-room' : `color-${(room.id % 4) + 1}`;
        const lockIcon = room.password ? '🔒' : '';
        return `
            <div class="room-card ${colorClass}">
                <h3>${room.name} ${lockIcon}</h3>
                <p>Jogadores: ${room.players}/4</p>
                <p>Modo: ${room.mode}</p>
                <button class="control-button pvp-enter-room-button" data-room-id="${room.id}">Entrar</button>
            </div>
        `;
    }).join('');
};

export const updateLobbyUi = (roomId) => {
    const { pvpRooms } = getState();
    const room = pvpRooms.find(r => r.id === roomId);

    const modeMap = { '1 vs 1': 'solo-2p', '1 vs 2': 'solo-3p', '1 vs 3': 'solo-4p', 'Duo (2v2)': 'duo' };
    const modeKey = Object.keys(modeMap).find(key => room.mode.includes(key));
    const selectedMode = modeMap[modeKey] || 'solo-4p';
    
    dom.lobbyGameModeEl.value = selectedMode;

    const numPlayers = { 'solo-2p': 2, 'solo-3p': 3, 'solo-4p': 4, 'duo': 4 }[selectedMode] || 4;
    const isDuo = selectedMode === 'duo';
    
    document.getElementById('lobby-ai-config').classList.remove('hidden');

    // Show/hide AI selectors based on player count
    document.getElementById('lobby-ai-p2-container').classList.toggle('hidden', numPlayers < 2);
    document.getElementById('lobby-ai-p3-container').classList.toggle('hidden', numPlayers < 3);
    document.getElementById('lobby-ai-p4-container').classList.toggle('hidden', numPlayers < 4);

    // Update labels for Duo mode
    document.getElementById('lobby-ai-p2-label').textContent = isDuo ? 'Oponente 1 (I.A.):' : 'Oponente 1 (I.A.):';
    document.getElementById('lobby-ai-p3-label').textContent = isDuo ? 'Aliado 1 (I.A.):' : 'Oponente 2 (I.A.):';

    // Update player slots
    document.getElementById('lobby-player-2').textContent = numPlayers >= 2 ? 'I.A.' : 'Aguardando...';
    document.getElementById('lobby-player-3').textContent = numPlayers >= 3 ? 'I.A.' : 'Aguardando...';
    document.getElementById('lobby-player-4').textContent = numPlayers >= 4 ? 'I.A.' : 'Aguardando...';
};

export const addLobbyChatMessage = (speaker, message) => {
    const messageEl = document.createElement('div');
    messageEl.innerHTML = `<strong>${speaker}:</strong> ${message}`;
    dom.lobbyChatHistoryEl.appendChild(messageEl);
    dom.lobbyChatHistoryEl.scrollTop = dom.lobbyChatHistoryEl.scrollHeight;
};
