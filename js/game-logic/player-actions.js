

import { getState } from '../core/state.js';
import { updateLog } from '../core/utils.js';
import { renderAll } from '../ui/ui-renderer.js';
import { playSoundEffect } from '../core/sound.js';
import { updateLiveScoresAndWinningStatus } from './score.js';
import { applyEffect } from './card-effects.js';
import { animateCardPlay } from '../ui/animations.js';

/**
 * Handles the entire logic for a player playing a card.
 * @param {object} player - The player object playing the card.
 * @param {object} card - The card object being played.
 * @param {string} targetId - The ID of the target player.
 * @param {string | null} [effectTypeToReverse=null] - For 'Reversus', specifies 'score' or 'movement'.
 * @param {object} [options={}] - Additional options, like for Reversus Total individual lock.
 */
export async function playCard(player, card, targetId, effectTypeToReverse = null, options = {}) {
    const { gameState } = getState();
    playSoundEffect('jogarcarta');
    
    // An action was taken, so the consecutive pass counter resets to 0.
    gameState.consecutivePasses = 0;
    
    // --- Determine animation target and destination ---
    let animationTargetPlayerId = card.type === 'value' ? player.id : targetId;
    let cardDestinationPlayer = gameState.players[animationTargetPlayerId];

    // Global Reversus Total is visually played on the caster
    if (card.name === 'Reversus Total' && !options.isIndividualLock) {
        animationTargetPlayerId = player.id;
        cardDestinationPlayer = player;
    }

    // --- Determine target slot for animation ---
    let targetSlotLabel;
    if (card.type === 'value') {
        targetSlotLabel = player.playedCards.value.length === 0 ? 'Valor 1' : 'Valor 2';
    } else {
        const effectName = options.isIndividualLock ? options.effectNameToApply : card.name;
        if (['Mais', 'Menos', 'NECRO X', 'NECRO X Invertido'].includes(effectName) || (card.name === 'Reversus' && effectTypeToReverse === 'score')) {
            targetSlotLabel = 'Pontuação';
        } else if (['Sobe', 'Desce', 'Pula'].includes(effectName) || (card.name === 'Reversus' && effectTypeToReverse === 'movement')) {
            targetSlotLabel = 'Movimento';
        } else if (card.name === 'Carta da Versatrix') {
            targetSlotLabel = 'Pontuação';
        } else {
            targetSlotLabel = 'Reversus T.'; // For global Reversus Total
        }
    }

    // --- Animate and move card from hand to play zone ---
    const startElement = document.querySelector(`#hand-${player.id} [data-card-id="${card.id}"]`);
    if (startElement) {
        await animateCardPlay(card, startElement, animationTargetPlayerId, targetSlotLabel);
    }
    
    const cardIndexInHand = player.hand.findIndex(c => c.id === card.id);
    if (cardIndexInHand > -1) {
        if (card.name !== 'Carta da Versatrix') {
            player.hand.splice(cardIndexInHand, 1);
        }
    }

    // --- Handle replacing existing effect cards ---
    if (card.type === 'effect') {
        const isIndividualLock = options.isIndividualLock && card.name === 'Reversus Total';
        const effectNameToApply = isIndividualLock ? options.effectNameToApply : card.name;
        
        const scoreEffectCategory = ['Mais', 'Menos', 'NECRO X', 'NECRO X Invertido'];
        const moveEffectCategory = ['Sobe', 'Desce', 'Pula'];
        
        let isScoreEffect = scoreEffectCategory.includes(effectNameToApply);
        let isMoveEffect = moveEffectCategory.includes(effectNameToApply);

        if (card.name === 'Reversus') {
            isScoreEffect = effectTypeToReverse === 'score';
            isMoveEffect = effectTypeToReverse === 'movement';
            card.reversedEffectType = effectTypeToReverse;
        }

        const categoryToCheck = isScoreEffect ? scoreEffectCategory : (isMoveEffect ? moveEffectCategory : null);
        
        if (categoryToCheck && cardDestinationPlayer) {
            const cardToReplaceIndex = cardDestinationPlayer.playedCards.effect.findIndex(c =>
                categoryToCheck.includes(c.name) ||
                (c.isLocked && categoryToCheck.includes(c.lockedEffect)) ||
                (c.name === 'Reversus' && (c.reversedEffectType === (isScoreEffect ? 'score' : 'movement')))
            );
            
            if (cardToReplaceIndex > -1) {
                const [removedCard] = cardDestinationPlayer.playedCards.effect.splice(cardToReplaceIndex, 1);
                gameState.discardPiles.effect.push(removedCard);
            }
        }
    }

    // --- Update player and game state ---
    if (card.type === 'value') {
        player.playedCards.value.push(card);
        player.playedValueCardThisTurn = true;
        player.nextResto = card;
    } else {
         if (card.name !== 'Carta da Versatrix') {
            cardDestinationPlayer.playedCards.effect.push(card);
         }
    }

    if (card.type === 'effect') {
        applyEffect(card, targetId, player.name, effectTypeToReverse, options);
    }
    
    gameState.selectedCard = null;
    gameState.reversusTarget = null;
    gameState.pulaTarget = null;
    
    updateLiveScoresAndWinningStatus();
    renderAll();
}