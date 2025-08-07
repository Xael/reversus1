import { getState, updateState } from '../core/state.js';
import { updateLog, dealCard } from '../core/utils.js';
import { playSoundEffect, announceEffect } from '../core/sound.js';
import { toggleReversusTotalBackground } from '../ui/animations.js';
import * as dom from '../core/dom.js';
import { triggerXaelChallengePopup } from '../story/story-abilities.js';
import { renderAll } from '../ui/ui-renderer.js';

export async function applyEffect(card, targetId, casterName, effectTypeToReverse) {
    const { gameState } = getState();
    const target = gameState.players[targetId];
    if (!target) return;

    let effectName;
    // Correctly determine the effect name, especially for locked Reversus Total
    if (card.isLocked) {
        effectName = card.lockedEffect;
    } else {
        effectName = card.name;
    }

    if (gameState.activeFieldEffects.some(fe => fe.name === 'Imunidade' && fe.appliesTo === targetId) && (effectName === 'Menos' || effectName === 'Desce')) {
        updateLog(`${target.name} está imune a ${effectName} nesta rodada!`);
        return;
    }

    const getInverseEffect = (effect) => {
        const map = { 'Mais': 'Menos', 'Menos': 'Mais', 'Sobe': 'Desce', 'Desce': 'Sobe', 'NECRO X': 'NECRO X Invertido', 'NECRO X Invertido': 'NECRO X' };
        return map[effect] || null;
    };

    if (gameState.reversusTotalActive && effectName !== 'Reversus Total') {
        const inverted = getInverseEffect(effectName);
        if (inverted) {
            updateLog(`Reversus Total inverteu ${card.name} para ${inverted}!`);
            effectName = inverted;
        }
    }
    
    // Play sound and announce effect
    const soundToPlay = effectName.toLowerCase().replace(/\s/g, '');
    const effectsWithSounds = ['mais', 'menos', 'sobe', 'desce', 'pula', 'reversus'];

    if (card.isLocked) {
        announceEffect("REVERSUS INDIVIDUAL!", 'reversus');
    } else if (effectsWithSounds.includes(soundToPlay)) {
        setTimeout(() => playSoundEffect(soundToPlay), 100);
        setTimeout(() => announceEffect(effectName), 150);
    } else if (effectName !== 'Carta da Versatrix' && effectName !== 'Reversus Total') {
        setTimeout(() => announceEffect(effectName), 150);
    }


    switch (effectName) {
        case 'Mais': case 'Menos': case 'NECRO X': case 'NECRO X Invertido':
            target.effects.score = effectName;
            break;
        case 'Sobe': case 'Desce': case 'Pula':
            target.effects.movement = effectName;
            break;
        case 'Reversus': {
            // setTimeout(() => announceEffect('Reversus!', 'reversus'), 100); // Already handled above
            const scoreEffectCategory = ['Mais', 'Menos', 'NECRO X', 'NECRO X Invertido', 'Carta da Versatrix'];
            const moveEffectCategory = ['Sobe', 'Desce', 'Pula'];
            
            if (effectTypeToReverse === 'score') {
                const cardIndex = target.playedCards.effect.findIndex(c => scoreEffectCategory.includes(c.name));
                if (cardIndex > -1) {
                    const removedCard = target.playedCards.effect.splice(cardIndex, 1)[0];
                    gameState.discardPiles.effect.push(removedCard);
                }
                target.effects.score = getInverseEffect(target.effects.score);
                updateLog(`${casterName} usou ${card.name} em ${target.name} para reverter efeito de pontuação para ${target.effects.score || 'Nenhum'}.`);
            } else if (effectTypeToReverse === 'movement') {
                const cardIndex = target.playedCards.effect.findIndex(c => moveEffectCategory.includes(c.name));
                 if (cardIndex > -1) {
                    const removedCard = target.playedCards.effect.splice(cardIndex, 1)[0];
                    gameState.discardPiles.effect.push(removedCard);
                }
                if (target.effects.movement === 'Pula') {
                    target.effects.movement = null;
                    updateLog(`${casterName} anulou o efeito 'Pula' de ${target.name} com Reversus!`);
                } else {
                    target.effects.movement = getInverseEffect(target.effects.movement);
                    updateLog(`${casterName} usou ${card.name} em ${target.name} para reverter efeito de movimento para ${target.effects.movement || 'Nenhum'}.`);
                }
            }
            // The card object itself is modified in playCard to be displayed correctly
            break;
        }
        case 'Reversus Total': {
            setTimeout(() => {
                announceEffect('Reversus Total!', 'reversus-total');
                playSoundEffect('reversustotal');
            }, 100);
            toggleReversusTotalBackground(true);
            gameState.reversusTotalActive = true;
            dom.appContainerEl.classList.add('reversus-total-active');
            dom.reversusTotalIndicatorEl.classList.remove('hidden');
            Object.values(gameState.players).forEach(p => {
                const scoreEffectCard = p.playedCards.effect.find(c => ['Mais', 'Menos', 'NECRO X', 'NECRO X Invertido'].includes(c.name) || (c.name === 'Reversus' && c.reversedEffectType === 'score'));
                if (p.effects.score && (!scoreEffectCard || !scoreEffectCard.isLocked)) {
                    p.effects.score = getInverseEffect(p.effects.score);
                }
                const moveEffectCard = p.playedCards.effect.find(c => ['Sobe', 'Desce', 'Pula'].includes(c.name) || (c.name === 'Reversus' && c.reversedEffectType === 'movement'));
                if (p.effects.movement && p.effects.movement !== 'Pula' && (!moveEffectCard || !moveEffectCard.isLocked)) {
                    p.effects.movement = getInverseEffect(p.effects.movement);
                }
            });
            updateLog(`${casterName} ativou o Reversus Total!`);
            
            // XAEL POPUP TRIGGER
            triggerXaelChallengePopup();
            return;
        }
        case 'Carta da Versatrix': {
            // Show info modal
            dom.versatrixCardInfoModal.classList.remove('hidden');
            await new Promise(resolve => {
                const handler = () => {
                    dom.versatrixCardInfoContinueButton.removeEventListener('click', handler);
                    dom.versatrixCardInfoModal.classList.add('hidden');
                    resolve();
                };
                dom.versatrixCardInfoContinueButton.addEventListener('click', handler);
            });

            // Apply the +2 card effect
            for (let i = 0; i < 2; i++) {
                const newCard = dealCard('effect');
                if (newCard) {
                    target.hand.push(newCard);
                }
            }
            updateLog(`${casterName} usou a ${card.name}, comprando 2 cartas de efeito.`);

            // Set cooldown on the card object itself
            card.cooldown = 3; 
            
            // This card is a one-off effect, it doesn't apply a persistent score/movement effect
            // We remove it from the play zone immediately and put it back in the caster's hand
            const cardIndexInPlay = target.playedCards.effect.findIndex(c => c.id === card.id);
            if (cardIndexInPlay > -1) {
                const [removedCard] = target.playedCards.effect.splice(cardIndexInPlay, 1);
                const caster = gameState.players[casterName];
                if(caster) {
                    caster.hand.push(removedCard);
                } else {
                    // Fallback: if caster not found, discard it to prevent card loss
                    gameState.discardPiles.effect.push(removedCard);
                }
            }
            
            renderAll(); // Re-render to show new cards and cooldown
            break;
        }
    }

    if (card.name === 'Pula') {
        updateLog(`${casterName} usou ${card.name} em ${target.name}.`);
    } else if (card.name !== 'Reversus' && card.name !== 'Reversus Total' && card.name !== 'Carta da Versatrix') {
        updateLog(`${casterName} usou ${card.name} em ${target.name} para aplicar o efeito ${effectName}.`);
    }
}