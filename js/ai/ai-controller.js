

import { getState } from '../core/state.js';
import { updateLog } from '../core/utils.js';
import { renderAll } from '../ui/ui-renderer.js';
import { advanceToNextPlayer } from '../game-logic/turn-manager.js';
import { playCard } from '../game-logic/player-actions.js';
import { tryToSpeak } from '../story/story-abilities.js';

/**
 * Executes a full turn for an AI player with enhanced strategic logic.
 * The AI will play at most one value card and consider playing one effect card per turn.
 * @param {object} player - The AI player object.
 */
export async function executeAiTurn(player) {
    const { gameState } = getState();
    gameState.gamePhase = 'paused';
    renderAll(); // Update UI to show AI is thinking
    await tryToSpeak(player);
    await new Promise(res => setTimeout(res, 1200));

    let playedACard = false;
    try {
        // --- Part 1: Play a value card if necessary ---
        const valueCards = player.hand.filter(c => c.type === 'value');
        if (valueCards.length > 1 && !player.playedValueCardThisTurn) {
            const otherScores = gameState.playerIdsInGame
                .filter(id => id !== player.id && !gameState.players[id].isEliminated)
                .map(id => gameState.players[id].liveScore || 0);
            
            const maxOtherScore = otherScores.length > 0 ? Math.max(...otherScores) : -Infinity;
            const sortedValueCards = [...valueCards].sort((a, b) => a.value - b.value);
            let cardToPlay;

            const potentialWinCard = sortedValueCards[sortedValueCards.length - 1];
            const currentScoreWithResto = player.liveScore + (player.resto?.value || 0);
            
            // A bit of logic to decide which value card to play
            if ((currentScoreWithResto + potentialWinCard.value) > maxOtherScore) {
                cardToPlay = potentialWinCard; // Play high to win
            } else {
                cardToPlay = sortedValueCards[0]; // Play low to save good cards
            }
            
            updateLog(`AI ${player.name}: Jogando a carta de valor ${cardToPlay.name}.`);
            await playCard(player, cardToPlay, player.id);
            await new Promise(res => setTimeout(res, 800));
            playedACard = true;
        }

        // --- Part 2: Consider playing one effect card ---
        const effectCards = player.hand.filter(c => c.type === 'effect');
        if (effectCards.length > 0) {
            let bestMove = { score: -1 };
            const opponents = Object.values(gameState.players).filter(p => p.id !== player.id && !p.isEliminated);
            const leader = opponents.length > 0 ? [...opponents].sort((a, b) => b.liveScore - a.liveScore)[0] : null;

            for (const card of effectCards) {
                // Check for 'Sobe' and 'Mais'
                if (['Mais', 'Sobe'].includes(card.name)) {
                    const isScoreEffect = card.name === 'Mais';
                    const currentEffect = isScoreEffect ? player.effects.score : player.effects.movement;
                    if (currentEffect !== card.name && 25 > bestMove.score) {
                        bestMove = { card, target: player.id, score: 25, reason: "para se ajudar" };
                    }
                }
                // Check for 'Desce' and 'Menos'
                else if (['Menos', 'Desce'].includes(card.name) && leader) {
                    const isScoreEffect = card.name === 'Menos';
                    const categoryToCheck = isScoreEffect ? ['Mais', 'Menos'] : ['Sobe', 'Desce'];
                    const targetSlotLocked = leader.playedCards.effect.some(c => c.isLocked && categoryToCheck.includes(c.lockedEffect));
                    const currentEffect = isScoreEffect ? leader.effects.score : leader.effects.movement;
                    if (!targetSlotLocked && currentEffect !== card.name && 30 > bestMove.score) {
                        bestMove = { card, target: leader.id, score: 30, reason: "para atacar o líder" };
                    }
                }
                // Check for 'Reversus'
                else if (card.name === 'Reversus') {
                    // Defensive use
                    if ((player.effects.score === 'Menos' || player.effects.movement === 'Desce') && 40 > bestMove.score) {
                        const effectType = player.effects.score === 'Menos' ? 'score' : 'movement';
                        bestMove = { card, target: player.id, effectType, score: 40, reason: "para se defender" };
                    }
                    // Offensive use
                    else if (leader && (leader.effects.score === 'Mais' || leader.effects.movement === 'Sobe') && 35 > bestMove.score) {
                        const effectType = leader.effects.score === 'Mais' ? 'score' : 'movement';
                        bestMove = { card, target: leader.id, effectType, score: 35, reason: "para atacar o líder" };
                    }
                }
                // Check for 'Pula'
                else if (card.name === 'Pula' && leader) {
                    const availablePaths = gameState.boardPaths.filter(p => !Object.values(gameState.players).map(pl => pl.pathId).includes(p.id));
                    if (availablePaths.length > 0 && 32 > bestMove.score) {
                        bestMove = { card, target: leader.id, score: 32, reason: "para reposicionar o líder" };
                    }
                }
                // Check for 'Reversus Total'
                else if (card.name === 'Reversus Total') {
                    // Offensive Lock
                    if (leader && leader.effects.score !== 'Menos' && 45 > bestMove.score) {
                        bestMove = { card, target: leader.id, isIndividual: true, effectToLock: 'Menos', score: 45, reason: "para travar um efeito negativo no líder" };
                    } 
                    // Global Use
                    else if (!gameState.reversusTotalActive && 42 > bestMove.score) {
                        bestMove = { card, target: player.id, score: 42, reason: "para virar o jogo" };
                    }
                }
            }

            if (bestMove.score > 0) {
                updateLog(`AI ${player.name}: Decide jogar ${bestMove.card.name} ${bestMove.reason}.`);
                await new Promise(res => setTimeout(res, 800));

                if (bestMove.card.name === 'Pula') {
                    const availablePaths = gameState.boardPaths.filter(p => !Object.values(gameState.players).map(pl => pl.pathId).includes(p.id));
                    const targetPlayer = gameState.players[bestMove.target];
                    targetPlayer.targetPathForPula = availablePaths[0].id; // AI picks the first available
                }
                
                let playOptions = {};
                if (bestMove.isIndividual) {
                    playOptions.isIndividualLock = true;
                    playOptions.effectNameToApply = bestMove.effectToLock;
                }

                await playCard(player, bestMove.card, bestMove.target, bestMove.effectType, playOptions);
                playedACard = true;
            }
        }

        // --- Part 3: Pass the turn ---
        if (!playedACard) {
            updateLog(`AI ${player.name}: Nenhuma jogada estratégica, passando o turno.`);
        } else {
             updateLog(`AI ${player.name}: Finalizou as jogadas e passou o turno.`);
        }
        
        await new Promise(res => setTimeout(res, 1000));
        gameState.consecutivePasses++;

    } catch (error) {
        console.error(`AI turn for ${player.name} failed:`, error);
        updateLog(`AI ${player.name} encontrou um erro e passará o turno.`);
        gameState.consecutivePasses++; // Still counts as a pass even on error
    } finally {
        gameState.gamePhase = 'playing';
        await advanceToNextPlayer();
    }
}