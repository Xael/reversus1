import { getState, updateState } from '../core/state.js';
import * as config from '../core/config.js';
import * as dom from '../core/dom.js';
import { updateLog, dealCard, shuffle } from '../core/utils.js';
import { renderAll } from '../ui/ui-renderer.js';
import { showGameOver } from '../ui/ui-renderer.js';
import { animateNecroX } from '../ui/animations.js';
import { playSoundEffect, announceEffect } from '../core/sound.js';
import { applyEffect } from '../game-logic/card-effects.js';
import { advanceToNextPlayer } from '../game-logic/turn-manager.js';


/**
 * Triggers the secret Xael challenge popup if conditions are met.
 * This is now a centralized function.
 */
export function triggerXaelChallengePopup() {
    const { gameState } = getState();
    if (gameState.isStoryMode && !gameState.xaelChallengeOffered && !gameState.xaelChallengeStarted && !gameState.isInversusMode) {
        gameState.xaelChallengeOffered = true; // Mark as offered to prevent repeats
        setTimeout(() => {
            playSoundEffect('xael');
            dom.xaelPopup.classList.remove('hidden');
            updateLog("Um Desafiante secreto apareceu!");
             // Add this to auto-hide the popup if not clicked
            setTimeout(() => {
                if (!dom.xaelPopup.classList.contains('hidden')) {
                    dom.xaelPopup.classList.add('hidden');
                }
            }, 4000); // Increased duration from 2s to 4s
        }, 1000); // 1 second delay
    }
}


/**
 * Triggers Necroverso's "NECRO X" ability.
 * @param {object} caster - The Necroverso player object.
 */
export async function triggerNecroX(caster) {
    const { gameState } = getState();
    gameState.necroXUsedThisRound = true;
    updateLog({ type: 'dialogue', speaker: caster.aiType, message: `${caster.name}: "Essa é a minha melhor carta!"` });

    playSoundEffect('x');
    document.body.classList.add('screen-shaking');
    animateNecroX();

    // Remove shake class after animation
    setTimeout(() => {
        document.body.classList.remove('screen-shaking');
    }, 400); // Match CSS animation duration

    await new Promise(res => setTimeout(res, 1000)); // Wait for drama

    const necroXCard = { id: Date.now() + Math.random(), type: 'effect', name: 'NECRO X', casterId: caster.id };
    
    const scoreEffectCategory = ['Mais', 'Menos', 'NECRO X', 'NECRO X Invertido', 'Carta da Versatrix'];
    const oldScoreCardIndex = caster.playedCards.effect.findIndex(c => scoreEffectCategory.includes(c.name));

    if (oldScoreCardIndex !== -1) {
        // Replace existing score card
        const discardedCard = caster.playedCards.effect.splice(oldScoreCardIndex, 1, necroXCard)[0];
        gameState.discardPiles.effect.push(discardedCard);
    } else {
        // Add new score card
        caster.playedCards.effect.push(necroXCard);
    }
    
    applyEffect(necroXCard, caster.id, caster.name);
    renderAll();
}

/**
 * Checks for and triggers special abilities based on where a pawn lands.
 * This is called at the end of a round after all movements are calculated.
 * @param {object} player The player whose landing position is being checked.
 */
export async function checkAndTriggerPawnLandingAbilities(player) {
    const { gameState } = getState();
    if (!gameState.isStoryMode) return;

    // --- Contravox Ability: !OÃSUFNOC ---
    // This ability triggers if player 1 lands on space 3, 6, or 9.
    const isContravoxBattle = gameState.currentStoryBattle === 'contravox';
    const isPlayer1 = player.id === 'player-1';
    const triggerPositions = [3, 6, 9];
    const isOnTriggerPosition = triggerPositions.includes(player.position);

    if (isContravoxBattle && isPlayer1 && isOnTriggerPosition) {
        if (gameState.contravoxAbilityUses > 0) {
            gameState.player1CardsObscured = true;
            gameState.contravoxAbilityUses--;
            playSoundEffect('confusao');
            announceEffect('!OÃSUFNOC', 'reversus');
            updateLog({ type: 'dialogue', speaker: 'contravox', message: 'Contravox: "!oãçurtsnoc ed sateL"' });
            updateLog(`A habilidade do Contravox foi ativada! Suas cartas foram obscurecidas para a próxima rodada.`);
        }
    }
}


/**
 * Triggers special effects when a player lands on a colored space.
 * This is now more robust and handles all special space types.
 */
export async function triggerFieldEffects() {
    const { gameState } = getState();
    const originalCurrentPlayer = gameState.currentPlayer;

    for (const id of gameState.playerIdsInGame) {
        const player = gameState.players[id];
        if (player.isEliminated || player.pathId === -1) continue;

        const path = gameState.boardPaths[player.pathId];
        if (!path || player.position < 1 || player.position > path.spaces.length) continue;
        
        const space = path.spaces[player.position - 1];

        if (space && !space.isUsed) {
            let instantEffectProcessed = false;

            // Handle space color effects that happen immediately
            switch (space.color) {
                case 'black': {
                    instantEffectProcessed = true;
                    space.isUsed = true;
                     // Special logic for the final battle
                    if (gameState.currentStoryBattle === 'necroverso_final' && player.aiType === 'necroverso_final') {
                        gameState.necroversoHearts--;
                        playSoundEffect('coracao');
                        announceEffect('💔', 'heartbreak', 1500);
                        updateLog(`O time Necroverso perdeu um coração! Restam: ${gameState.necroversoHearts}. ${player.name} foi movido para o início.`);
                        player.position = 1; // Move back to start
                        if (gameState.necroversoHearts <= 0) {
                            // This check is now redundant as turn-manager handles it, but good for safety
                            document.dispatchEvent(new CustomEvent('storyWinLoss', { detail: { battle: 'necroverso_final', won: true } }));
                            return; // Game over, stop all processing
                        }
                    } else {
                        // Original elimination logic for everyone else
                        playSoundEffect('destruido');
                        updateLog(`Jogador ${player.name} foi consumido por um buraco negro na casa ${space.id}!`);
                        player.isEliminated = true;
                        
                        // Check for player team loss in final battle
                        if (gameState.currentStoryBattle === 'necroverso_final') {
                             const playerTeamIds = ['player-1', 'player-4'];
                             const isPlayerTeamEliminated = playerTeamIds.every(pId => gameState.players[pId] && gameState.players[pId].isEliminated);
                             if (isPlayerTeamEliminated) {
                                document.dispatchEvent(new CustomEvent('storyWinLoss', { detail: { battle: 'necroverso_final', won: false } }));
                                return; // Game over, stop all processing
                             }
                        }

                        // Check for standard game over if only one player is left
                        const remainingPlayers = gameState.playerIdsInGame.filter(pId => !gameState.players[pId].isEliminated);
                        if (remainingPlayers.length <= 1 && gameState.isStoryMode) {
                            gameState.gamePhase = 'game_over';
                            const player1Won = remainingPlayers.includes('player-1');
                            document.dispatchEvent(new CustomEvent('storyWinLoss', { detail: { battle: gameState.currentStoryBattle, won: player1Won } }));
                            return; // Stop all further processing
                        }

                        if (id === gameState.currentPlayer) {
                           await advanceToNextPlayer();
                        }
                    }
                    break;
                }
                case 'yellow':
                    const isVersatrixPlayer = player.aiType === 'versatrix';
                    updateLog(`${player.name} parou na casa de Versatrix!`);
                    if (isVersatrixPlayer) {
                        player.position = Math.min(config.WINNING_POSITION, player.position + 1);
                        updateLog('Sendo Versatrix, ela avança uma casa!');
                    } else {
                        player.position = Math.max(1, player.position - 1);
                        updateLog('Como não é Versatrix, volta uma casa!');
                    }
                    dom.versatrixFieldModal.classList.remove('hidden');
                    await new Promise(resolve => {
                        const handler = () => {
                            dom.versatrixFieldContinueButton.removeEventListener('click', handler);
                            dom.versatrixFieldModal.classList.add('hidden');
                            resolve();
                        };
                        dom.versatrixFieldContinueButton.addEventListener('click', handler);
                    });
                    space.isUsed = true;
                    instantEffectProcessed = true;
                    break;

                case 'star':
                    playSoundEffect('conquista');
                    player.stars = (player.stars || 0) + 1;
                    updateLog(`Jogador ${player.name} coletou uma estrela! Total: ${player.stars}`);
                    space.isUsed = true;
                    instantEffectProcessed = true;
                    break;
            }

            // Then, handle named effects (Blue/Red) if no other effect happened
            if (space.effectName && !instantEffectProcessed) {
                const isPositive = space.color === 'blue';
                updateLog(`Jogador ${player.name} parou em uma casa ${isPositive ? 'azul' : 'vermelha'}! Efeito: ${space.effectName}`);
                
                dom.fieldEffectCardEl.className = `field-effect-card ${isPositive ? 'positive' : 'negative'}`;
                dom.fieldEffectNameEl.textContent = space.effectName;
                dom.fieldEffectDescriptionEl.textContent = isPositive ? config.POSITIVE_EFFECTS[space.effectName] : config.NEGATIVE_EFFECTS[space.effectName];
                dom.fieldEffectModal.classList.remove('hidden');
                
                await new Promise(resolve => {
                    const handler = () => {
                        dom.fieldEffectContinueButton.removeEventListener('click', handler);
                        dom.fieldEffectModal.classList.add('hidden');
                        resolve();
                    };
                    dom.fieldEffectContinueButton.addEventListener('click', handler);
                });

                // Add to active effects for round-end calculations
                gameState.activeFieldEffects.push({
                    name: space.effectName, type: isPositive ? 'positive' : 'negative', appliesTo: player.id
                });
                
                // --- IMMEDIATE ACTIONS ---
                switch (space.effectName) {
                    case 'Reversus Total':
                        gameState.reversusTotalActive = true;
                        dom.reversusTotalIndicatorEl.classList.remove('hidden');
                        dom.appContainerEl.classList.add('reversus-total-active');
                        playSoundEffect('reversustotal');
                        updateLog("O efeito Reversus Total foi ativado pelo campo!");
                        triggerXaelChallengePopup();
                        break;
                    case 'Jogo Aberto':
                        if (isPositive) {
                            gameState.revealedHands = gameState.playerIdsInGame.filter(pId => pId !== player.id && !gameState.players[pId].isEliminated);
                        } else {
                            gameState.revealedHands.push(player.id);
                        }
                        updateLog(`Jogo Aberto! Mãos reveladas nesta rodada.`);
                        break;
                    case 'Carta Menor':
                    case 'Carta Maior': {
                        const valueCards = player.hand.filter(c => c.type === 'value');
                        if (valueCards.length > 0) {
                            const sorted = valueCards.sort((a, b) => a.value - b.value);
                            const cardToDiscard = space.effectName === 'Carta Menor' ? sorted[0] : sorted[sorted.length - 1];
                            const cardIndex = player.hand.findIndex(c => c.id === cardToDiscard.id);
                            if (cardIndex > -1) {
                                player.hand.splice(cardIndex, 1);
                                gameState.discardPiles.value.push(cardToDiscard);
                                const newCard = dealCard('value');
                                if (newCard) player.hand.push(newCard);
                                updateLog(`${player.name} descartou ${cardToDiscard.value} e comprou uma nova carta.`);
                            }
                        }
                        break;
                    }
                    case 'Total Revesus Nada!': {
                        if (gameState.gameMode === 'duo') {
                            // Player who landed on the space discards 1 random effect card
                            const effectCards = player.hand.filter(c => c.type === 'effect');
                            if (effectCards.length > 0) {
                                const cardToDiscard = shuffle(effectCards)[0];
                                const cardIndex = player.hand.findIndex(c => c.id === cardToDiscard.id);
                                if (cardIndex > -1) {
                                    player.hand.splice(cardIndex, 1);
                                    gameState.discardPiles.effect.push(cardToDiscard);
                                    updateLog(`${player.name} descartou ${cardToDiscard.name} por efeito de campo.`);
                                }
                            }
                            // Find partner and make them discard until they have 1 effect card
                            const teamIds = config.TEAM_A.includes(player.id) ? config.TEAM_A : config.TEAM_B;
                            const partnerId = teamIds.find(id => id !== player.id);
                            const partner = gameState.players[partnerId];
                            if (partner) {
                                let partnerEffectCards = partner.hand.filter(c => c.type === 'effect');
                                while (partnerEffectCards.length > 1) {
                                     const cardToDiscard = partnerEffectCards.pop(); // discard from the end
                                     const cardIndex = partner.hand.findIndex(c => c.id === cardToDiscard.id);
                                     if (cardIndex > -1) {
                                        partner.hand.splice(cardIndex, 1);
                                        gameState.discardPiles.effect.push(cardToDiscard);
                                        updateLog(`${partner.name} descartou ${cardToDiscard.name} por efeito de campo.`);
                                     }
                                }
                            }
                        } else { // Solo mode
                            const effectCardsToDiscard = player.hand.filter(c => c.type === 'effect');
                            player.hand = player.hand.filter(c => c.type !== 'effect');
                            gameState.discardPiles.effect.push(...effectCardsToDiscard);
                            updateLog(`${player.name} descartou todas as ${effectCardsToDiscard.length} cartas de efeito.`);
                        }
                        break;
                    }
                    // Effects like 'Troca Justa' are too complex without new UI and are skipped for now.
                    // They will be stored in activeFieldEffects but won't have an immediate action.
                }
                space.isUsed = true;
            }
        }
    }
    // Restore the current player in case it was changed by elimination
    gameState.currentPlayer = originalCurrentPlayer;
    renderAll();
}


/**
 * Makes an AI player "speak" a line of dialogue based on the game situation.
 * @param {object} player - The AI player object.
 */
export async function tryToSpeak(player) {
    const { gameState } = getState();
    const aiType = player.aiType;

    // Do not speak if this AI type has no dialogue configured
    if (!config.AI_DIALOGUE[aiType] || (!config.AI_DIALOGUE[aiType].winning && !config.AI_DIALOGUE[aiType].losing)) {
        return;
    }

    // Determine if the player is generally winning or losing based on board position
    const otherPlayerPositions = gameState.playerIdsInGame
        .filter(id => id !== player.id && !gameState.players[id].isEliminated)
        .map(id => gameState.players[id].position);
    
    if (otherPlayerPositions.length === 0) return; // No one else to compare to

    const avgOpponentPosition = otherPlayerPositions.reduce((a, b) => a + b, 0) / otherPlayerPositions.length;
    const status = player.position > avgOpponentPosition ? 'winning' : 'losing';
    const lines = config.AI_DIALOGUE[aiType][status];

    if (lines && lines.length > 0) {
        // Find a line that hasn't been said yet
        let lineToSay = lines.find(line => !gameState.dialogueState.spokenLines.has(`${aiType}-${line}`));
        
        // If all lines for this status have been said, reset them for this character and status
        if (!lineToSay) {
            lines.forEach(line => gameState.dialogueState.spokenLines.delete(`${aiType}-${line}`));
            lineToSay = lines[0]; // Say the first one again
        }
        
        if (lineToSay) {
            updateLog({ type: 'dialogue', speaker: aiType, message: `${player.name}: "${lineToSay}"` });
            gameState.dialogueState.spokenLines.add(`${aiType}-${lineToSay}`);
            await new Promise(res => setTimeout(res, 500));
        }
    }
}