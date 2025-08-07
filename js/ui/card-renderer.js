
import { getState } from '../core/state.js';

/**
 * Gets the image URL for a given card.
 * @param {object} card - The card object.
 * @param {boolean} isHidden - Whether the card should be rendered face-down.
 * @returns {string} The URL of the card image.
 */
export const getCardImageUrl = (card, isHidden) => {
    if (isHidden) {
        return card.type === 'value' ? 'verso_valor.png' : 'verso_efeito.png';
    }
    if (card.name === 'NECRO X') {
        return 'cartanecroverso.png';
    }
    if (card.name === 'Carta da Versatrix') {
        return 'cartaversatrix.png';
    }
    const cardNameSanitized = card.name.toString().toLowerCase().replace(/\s/g, '');
    return `frente_${cardNameSanitized}.png`;
};

/**
 * Creates the HTML for a single card.
 * @param {object} card - The card object to render.
 * @param {string} context - The context in which the card is being rendered (e.g., 'player-hand', 'play-zone').
 * @param {string} playerId - The ID of the player associated with the card.
 * @returns {string} The HTML string for the card.
 */
export const renderCard = (card, context, playerId) => {
    const { gameState } = getState();
    const isHumanPlayer = playerId === 'player-1';
    const classList = ['card', card.type];
    const isHidden = context === 'ai-hand' && !gameState.revealedHands.includes(playerId) && !(gameState.isXaelChallenge && playerId !== 'player-1');
    const isCardObscuredByContravox = isHumanPlayer && context === 'player-hand' && gameState.player1CardsObscured;

    let isCardDisabled = false;
    if (isHumanPlayer && context === 'player-hand' && card.type === 'value') {
        const player = gameState.players[playerId];
        const valueCardsInHandCount = player.hand.filter(c => c.type === 'value').length;
        
        // A value card is disabled if:
        // 1. It's the last one in hand (or there are none).
        // 2. A value card has already been played THIS TURN.
        isCardDisabled = valueCardsInHandCount <= 1 || player.playedValueCardThisTurn;
    }
    if (isHumanPlayer && gameState.tutorialEffectCardsLocked && card.type === 'effect') {
        isCardDisabled = true;
    }

    if (isHumanPlayer && context === 'player-hand' && gameState.selectedCard?.id === card.id) classList.push('selected');
    if (isCardDisabled) classList.push('disabled');
    if (context === 'modal') classList.push('modal-card');
    
    if (card.name === 'Reversus Total') {
        classList.push('reversus-total-card');
        if (playerId === 'player-1') {
            classList.push('reversus-total-glow');
        }
    }
    
    if (card.isLocked) {
        classList.push('locked');
    }
    
    if (context === 'play-zone' && card.casterId) {
        const caster = gameState.players[card.casterId];
        if (caster && caster.aiType === 'necroverso') {
            classList.push('necro-glow');
        }
    }
    
    let cardTitle = '';
    if (isCardObscuredByContravox && card.type === 'effect') {
        cardTitle = 'title="Não é possível saber qual efeito será aplicado..."';
    }

    let cardStyle;
    if (isCardObscuredByContravox) {
        cardStyle = `style="background-image: url('cartacontravox.png');"`;
    } else {
        cardStyle = `style="background-image: url('${getCardImageUrl(card, isHidden)}');"`;
    }
    
    const maximizeButtonHTML = !isHidden && !isCardObscuredByContravox ? '<div class="card-maximize-button" title="Ver carta"></div>' : '';

    return `<div class="${classList.join(' ')}" data-card-id="${card.id}" ${cardTitle} ${isCardDisabled ? 'aria-disabled="true"' : ''} ${cardStyle}>
                ${maximizeButtonHTML}
            </div>`;
};