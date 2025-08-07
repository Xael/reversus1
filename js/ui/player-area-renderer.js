import * as dom from '../core/dom.js';
import * as config from '../core/config.js';
import { getState } from '../core/state.js';
import { getCardImageUrl, renderCard } from './card-renderer.js';

/**
 * Renders a single player's entire area, including header, hand, and play zone.
 * @param {object} player - The player object to render.
 */
export const renderPlayerArea = (player) => {
    const playerEl = document.getElementById(`player-area-${player.id}`);
    if (!playerEl) return;
    
    const { gameState } = getState();
    const pIdNum = parseInt(player.id.split('-')[1]);

    // Apply classes for styling
    playerEl.className = 'player-area'; // Reset
    playerEl.classList.add(`p${pIdNum}-bg`);
    if (player.id === gameState.currentPlayer) playerEl.classList.add('active');
    if (player.isEliminated) playerEl.classList.add('eliminated');

    // Special AI glow effects
    const glowMap = {
        'contravox': 'contravox-glow',
        'versatrix': 'versatrix-glow',
        'reversum': 'reversum-glow'
    };
    if (glowMap[player.aiType]) {
        playerEl.classList.add(glowMap[player.aiType]);
    }
    if (player.aiType === 'necroverso_tutorial') {
        playerEl.classList.add('player-area-necro-tutorial');
    }
    if (player.aiType === 'necroverso_final') {
        playerEl.classList.add('player-area-necro-final');
    }
     if (gameState.isInversusMode) {
        playerEl.classList.add('inversus-bg');
    }
    if(gameState.currentStoryBattle === 'xael_challenge' && player.aiType === 'xael') {
        playerEl.classList.add('xael-portrait-bg');
    }


    const context = player.isHuman ? 'player-hand' : 'ai-hand';
    const handHTML = `<div class="player-hand" id="hand-${player.id}">${player.hand.map(card => renderCard(card, context, player.id)).join('')}</div>`;

    const playZoneSlots = [
        { label: 'Valor 1', card: player.playedCards.value[0] },
        { label: 'Valor 2', card: player.playedCards.value[1] },
        { label: 'Pontuação', card: player.playedCards.effect.find(c => ['Mais', 'Menos', 'Carta da Versatrix', 'NECRO X', 'NECRO X Invertido', 'Estrela Subente'].includes(c.name) || (c.isLocked && ['Mais', 'Menos'].includes(c.lockedEffect)) || (c.name === 'Reversus' && c.reversedEffectType === 'score')) },
        { label: 'Movimento', card: player.playedCards.effect.find(c => ['Sobe', 'Desce', 'Pula'].includes(c.name) || (c.isLocked && ['Sobe', 'Desce'].includes(c.lockedEffect)) || (c.name === 'Reversus' && c.reversedEffectType === 'movement')) },
        { label: 'Reversus T.', card: player.playedCards.effect.find(c => c.name === 'Reversus Total' && !c.isLocked) }
    ];

    const playZoneHTML = `
        <div class="play-zone">
            ${playZoneSlots.map(slot => `
                <div class="play-zone-slot" data-label="${slot.label}">
                    ${slot.card ? renderCard(slot.card, 'play-zone', player.id) : ''}
                </div>
            `).join('')}
        </div>`;
        
    const headerHTML = renderPlayerHeader(player);
    
    playerEl.innerHTML = `
        ${headerHTML}
        ${playZoneHTML}
        ${handHTML}
    `;

    // Add character portrait if applicable AFTER innerHTML is set
    if (gameState.isStoryMode && !player.isHuman) {
        const portraitMap = {
            'necroverso_tutorial': { src: './necroverso.png', class: '' },
            'contravox': { src: './contravox.png', class: 'contravox-portrait' },
            'versatrix': { src: './versatrix.png', class: 'versatrix-portrait' },
            'reversum': { src: './reversum.png', class: 'reversum-portrait' },
            'necroverso_king': { src: './necroverso.png', class: ''},
            'necroverso_final': { src: './necroverso2.png', class: 'final-boss-glow' },
            'narrador': { src: './narrador.png', class: 'effect-glitch' },
            'xael': { src: './xaeldesafio.png', class: 'xael-glow' }
        };
        const portraitInfo = portraitMap[player.aiType];
        if (portraitInfo) {
            const portraitImg = document.createElement('img');
            portraitImg.src = portraitInfo.src;
            portraitImg.className = `player-area-character-portrait ${portraitInfo.class}`;
            playerEl.appendChild(portraitImg);
             if (player.aiType === 'necroverso_tutorial') {
                portraitImg.classList.add('necro-tutorial-portrait');
            }
        }
    }
    if (gameState.isInversusMode && !player.isHuman) {
        const portraitImg = document.createElement('img');
        portraitImg.src = './inversum1.png'; // Start with the first image
        portraitImg.id = 'inversus-character-portrait';
        portraitImg.className = 'inversus-character-portrait';
        playerEl.appendChild(portraitImg);
    }
};

/**
 * Creates the HTML for a player's header area, including name, stats, and status.
 * @param {object} player - The player object.
 * @returns {string} The HTML string for the player header.
 */
function renderPlayerHeader(player) {
    const { gameState } = getState();
    
    const pathDisplay = player.pathId === -1 ? 'N/A' : player.pathId + 1;
    const effectText = [player.effects.score, player.effects.movement]
        .filter(Boolean) // Remove null/undefined effects
        .map(e => e.toUpperCase())
        .join(' / ') || 'Nenhum';
    
    const restoValue = player.resto ? player.resto.value : 'N/A';

    const activeFieldEffect = gameState.activeFieldEffects.find(fe => fe.appliesTo === player.id);

    const nameClasses = ['player-name', `player-${player.id.split('-')[1]}`];
    if (player.aiType === 'necroverso') nameClasses.push('necro');
    if (player.aiType === 'xael') nameClasses.push('xael');
    if (player.aiType === 'necroverso_final') nameClasses.push('final-boss-glow');
    if (gameState.isInversusMode && !player.isHuman) nameClasses.push('inversus-name-glow');

    const revealedIcon = gameState.revealedHands.includes(player.id) ? '<div class="revealed-icon" title="Mão revelada"></div>' : '';

    let heartsOrStarsHTML = '';
    if (gameState.isInversusMode) {
        heartsOrStarsHTML = `<div class="inversus-hearts-container">${'❤'.repeat(player.hearts)}</div>`;
    }
    if (gameState.isKingNecroBattle) {
        heartsOrStarsHTML = `<div class="player-hearts-container" title="Corações restantes">${'❤'.repeat(player.hearts)}</div>`;
    }
    if (gameState.isXaelChallenge) {
        heartsOrStarsHTML = `<div class="player-star-counter" title="Estrelas de Xael">⭐ ${player.stars}</div>`;
    }

    const fieldEffectHTML = activeFieldEffect ? `
        <div class="field-effect-indicator" title="Efeito de campo ativo: ${activeFieldEffect.name}" data-player-id="${player.id}">
            <div class="field-effect-square" style="background-color: ${activeFieldEffect.type === 'positive' ? 'var(--accent-blue)' : 'var(--accent-red)'};"></div>
            <span>Campo</span>
        </div>
    ` : '';

    return `
        <div class="player-header">
            <div class="opponent-header-top">
                 <div class="player-name-container">
                    <span class="${nameClasses.join(' ')}">${player.name}</span>
                    ${revealedIcon}
                </div>
                 <div class="player-header-right">
                    ${heartsOrStarsHTML}
                 </div>
            </div>
            <div class="player-stats">
                 <span class="stat-item" title="Pontuação atual na rodada">Pontuação: <strong>${player.liveScore || 0}</strong></span>
                 <span class="stat-item" title="Carta de Resto para a próxima rodada">Resto: <strong>${restoValue}</strong></span>
                 <span class="stat-item" title="Caminho atual no tabuleiro">Caminho: <strong>${pathDisplay}</strong></span>
                 <span class="stat-item" title="Posição no caminho">Casa: <strong>${player.position}</strong></span>
                 <span class="stat-item" title="Efeitos de carta ativos">Efeito: <strong>${effectText}</strong></span>
                 ${fieldEffectHTML}
            </div>
        </div>
    `;
}