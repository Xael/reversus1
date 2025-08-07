

import { getState, updateState } from '../core/state.js';
import * as dom from '../core/dom.js';
import * as config from '../core/config.js';
import { renderAll, showTurnIndicator, showRoundSummaryModal, showGameOver } from '../ui/ui-renderer.js';
import { renderCard } from '../ui/card-renderer.js';
import { executeAiTurn } from '../ai/ai-controller.js';
import { triggerFieldEffects, checkAndTriggerPawnLandingAbilities } from '../story/story-abilities.js';
import { updateLog, dealCard } from '../core/utils.js';
import { grantAchievement } from '../core/achievements.js';
import { showSplashScreen } from '../ui/splash-screen.js';
import { toggleReversusTotalBackground } from '../ui/animations.js';
import { updateLiveScoresAndWinningStatus } from './score.js';
import { rotateAndApplyKingNecroversoBoardEffects } from './board.js';

/**
 * Initiates the sequence to start a game, beginning with the initial draw.
 */
export async function initiateGameStartSequence() {
    const { gameState } = getState();
    if (gameState.isInversusMode) {
        await startNewRound(true);
        return;
    }
    
    // Skip initial draw for the final battle or Xael challenge
    if (gameState.isFinalBoss || gameState.isXaelChallenge) {
        // Set paths once at the start
        const chosenPaths = new Set();
        const playerIdsToAssign = gameState.playerIdsInGame;
        playerIdsToAssign.forEach(id => {
            let availablePaths = gameState.boardPaths.filter(p => !chosenPaths.has(p.id));
            if (availablePaths.length > 0) {
                let chosenPath = availablePaths[0]; // Simplified for predictability
                gameState.players[id].pathId = chosenPath.id;
                chosenPaths.add(chosenPath.id);
            }
        });
        
        await startNewRound(true);
        return;
    }

    dom.drawStartTitle.textContent = "Sorteio Inicial";
    dom.drawStartResultMessage.textContent = "Sorteando cartas para ver quem começa...";
    
    dom.drawStartCardsContainerEl.innerHTML = gameState.playerIdsInGame.map(id => {
        const player = gameState.players[id];
        return `
            <div class="draw-start-player-slot">
                <span class="player-name ${id}">${player.name}</span>
                <div class="card modal-card" style="background-image: url('./verso_valor.png');" id="draw-card-${id}"></div>
            </div>
        `;
    }).join('');

    dom.drawStartModal.classList.remove('hidden');
    await new Promise(res => setTimeout(res, 1500));
    await drawToStart();
};

async function drawToStart() {
    const { gameState } = getState();
    const drawnCards = {};
    const cardPromises = [];

    // Use a robust for...of loop to handle potential dealing errors
    let dealFailed = false;
    for (const id of gameState.playerIdsInGame) {
        const card = dealCard('value');
        if (!card) {
            console.error(`Falha crítica ao sortear carta para ${id}. Abortando início do jogo.`);
            dealFailed = true;
            break; // Exit the loop immediately
        }
        drawnCards[id] = card;
        const cardEl = document.getElementById(`draw-card-${id}`);
        
        const promise = new Promise(res => {
            setTimeout(() => {
                if(cardEl) cardEl.outerHTML = renderCard(card, 'modal');
                res();
            }, 500 * (cardPromises.length));
        });
        cardPromises.push(promise);
    }

    if (dealFailed) {
        dom.drawStartResultMessage.textContent = "Erro ao distribuir cartas. Tente novamente.";
        updateLog("Erro crítico no sorteio inicial. O jogo não pode começar.");
        setTimeout(showSplashScreen, 3000);
        return;
    }

    await Promise.all(cardPromises);
    await new Promise(res => setTimeout(res, 1500));

    // Create a copy for sorting to avoid modifying the original turn order array
    const sortedPlayers = [...gameState.playerIdsInGame].sort((a, b) => {
        const cardA = drawnCards[a]?.value || 0;
        const cardB = drawnCards[b]?.value || 0;
        return cardB - cardA;
    });
    
    const logParts = gameState.playerIdsInGame.map(id => `${gameState.players[id].name} sacou ${drawnCards[id].name}`);
    updateLog(`Sorteio: ${logParts.join(', ')}.`);
    
    if (sortedPlayers.length < 2 || (drawnCards[sortedPlayers[0]]?.value > drawnCards[sortedPlayers[1]]?.value)) {
        const winner = gameState.players[sortedPlayers[0]];
        gameState.currentPlayer = winner.id;
        gameState.initialDrawCards = drawnCards;
        dom.drawStartResultMessage.textContent = `${winner.name} tirou a carta mais alta e começa!`;
        
        await new Promise(res => setTimeout(res, 2000));
        dom.drawStartModal.classList.add('hidden');
        
        await finalizeGameStart();
    } else {
        dom.drawStartResultMessage.textContent = "Empate! Sorteando novamente...";
        updateLog("Empate! Sacando novas cartas...");
        Object.values(drawnCards).forEach(card => gameState.discardPiles.value.push(card));
        await initiateGameStartSequence();
    }
};

async function finalizeGameStart() {
    const { gameState } = getState();
    
    if (gameState.initialDrawCards) {
        gameState.playerIdsInGame.forEach(id => {
            gameState.players[id].resto = gameState.initialDrawCards[id];
            updateLog(`Resto inicial de ${gameState.players[id].name} é ${gameState.initialDrawCards[id].name}.`);
        });
    }
    
    await startNewRound(true);
};

/**
 * Advances the game to the next player's turn or ends the round.
 */
export async function advanceToNextPlayer() {
    const { gameState } = getState();
    if (gameState.gamePhase !== 'playing') return;

    const activePlayers = gameState.playerIdsInGame.filter(id => !gameState.players[id].isEliminated);
    
    // New round end condition: 2 full rounds of passes
    const endRoundPassCount = activePlayers.length * 2;

    // The round ends if everyone has passed consecutively twice.
    if (activePlayers.length > 0 && gameState.consecutivePasses >= endRoundPassCount) {
        await endRound();
        return;
    }
    
    // Announce the "last call" when one full round of passes is complete.
    if (activePlayers.length > 0 && gameState.consecutivePasses === activePlayers.length) {
        updateLog("ÚLTIMA CHAMADA! Todos os jogadores passaram. A rodada terminará se todos passarem novamente.");
    }

    // --- Find next active player (robustly) ---
    let currentIndex = gameState.playerIdsInGame.indexOf(gameState.currentPlayer);
    let nextIndex = currentIndex;
    let attempts = 0;
    
    // This loop will find the next player who is NOT eliminated.
    // The attempts check prevents an infinite loop if all players are somehow eliminated.
    do {
        nextIndex = (nextIndex + 1) % gameState.playerIdsInGame.length;
        if (++attempts > gameState.playerIdsInGame.length * 2) { // Increased safeguard
            // This should not happen if game end is checked properly, but it's a fail-safe.
            updateLog("Nenhum jogador ativo encontrado. Forçando o fim da rodada.");
            await endRound();
            return;
        }
    } while (gameState.players[gameState.playerIdsInGame[nextIndex]].isEliminated);
    
    gameState.currentPlayer = gameState.playerIdsInGame[nextIndex];
    // --- End of finding next player ---

    const nextPlayer = gameState.players[gameState.currentPlayer];
    nextPlayer.playedValueCardThisTurn = false; // Reset for the new turn

    if (nextPlayer.id === 'player-1') {
        // Decrease Xael Star Power cooldown
        if (gameState.isXaelChallenge && nextPlayer.xaelStarPowerCooldown > 0) {
            nextPlayer.xaelStarPowerCooldown--;
            if (nextPlayer.xaelStarPowerCooldown > 0) {
                updateLog(`Recarga do Poder Estelar: ${nextPlayer.xaelStarPowerCooldown} turnos restantes.`);
            } else {
                updateLog(`Poder Estelar está pronto!`);
            }
        }
    }

    updateLog(`É a vez de ${nextPlayer.name}.`);
    renderAll();

    if (nextPlayer.isHuman) {
        await showTurnIndicator();
    } else {
        executeAiTurn(nextPlayer);
    }
}

async function endRound() {
    const { gameState } = getState();
    if (gameState.gamePhase !== 'playing') return;
    
    gameState.gamePhase = 'resolution';
    renderAll(); // Update UI to show "Fim da rodada!"
    updateLog('Todos os jogadores passaram. Resolvendo a rodada...');
    await calculateScoresAndEndRound();
}


async function startNewRound(isFirstRound = false) {
    const { gameState } = getState();
    if (!isFirstRound) {
        gameState.turn++;
    }
    updateLog(`--- Iniciando Rodada ${gameState.turn} ---`);

    // Reset round-specific states for each player
    gameState.playerIdsInGame.forEach(id => {
        const player = gameState.players[id];
        if (player.isEliminated) return;
        
        // Discard played cards
        gameState.discardPiles.value.push(...player.playedCards.value);
        gameState.discardPiles.effect.push(...player.playedCards.effect);
        player.playedCards = { value: [], effect: [] };

        // Update resto
        if (player.nextResto) {
            player.resto = player.nextResto;
            player.nextResto = null;
        }

        player.effects = { score: null, movement: null };
        player.playedValueCardThisTurn = false;
        player.targetPathForPula = null;

        // Decrease Versatrix Card cooldown per round
        const versatrixCard = player.hand.find(c => c.name === 'Carta da Versatrix');
        if (versatrixCard && versatrixCard.cooldown > 0) {
            versatrixCard.cooldown--;
             if (versatrixCard.cooldown > 0) {
                updateLog(`Recarga da Carta da Versatrix: ${versatrixCard.cooldown} rodadas restantes.`);
            } else {
                updateLog(`A Carta da Versatrix está pronta!`);
            }
        }
    });
    
    // Reset global round states
    gameState.selectedCard = null;
    gameState.reversusTotalActive = false;
    gameState.consecutivePasses = 0;
    gameState.activeFieldEffects = [];
    gameState.revealedHands = [];
    
    toggleReversusTotalBackground(false);
    dom.appContainerEl.classList.remove('reversus-total-active');
    dom.reversusTotalIndicatorEl.classList.add('hidden');

    // Draw cards to replenish hands
    gameState.playerIdsInGame.forEach(id => {
        const player = gameState.players[id];
        if (player.isEliminated) return;
        while (player.hand.filter(c => c.type === 'value').length < config.MAX_VALUE_CARDS_IN_HAND) {
            const newCard = dealCard('value');
            if (newCard) player.hand.push(newCard); else break;
        }
        // Versatrix card doesn't count towards the effect card limit
        while (player.hand.filter(c => c.type === 'effect' && c.name !== 'Carta da Versatrix').length < config.MAX_EFFECT_CARDS_IN_HAND) {
            const newCard = dealCard('effect');
            if (newCard) player.hand.push(newCard); else break;
        }
    });

    // Special Logic for King Necro Battle
    if (gameState.isKingNecroBattle) {
        await rotateAndApplyKingNecroversoBoardEffects(!isFirstRound);
        if (checkGameEnd()) return; // Stop if board effects ended the game
    }

    if (!isFirstRound && !gameState.isKingNecroBattle) { // Don't trigger standard effects on King battle
        await triggerFieldEffects();
        if (checkGameEnd()) return; // Stop if field effects ended the game
    }
    
    gameState.gamePhase = 'playing';
    const currentPlayer = gameState.players[gameState.currentPlayer];
    currentPlayer.playedValueCardThisTurn = false; // Reset for the first player of the round
    updateLog(`É a vez de ${currentPlayer.name}.`);
    
    renderAll();

    if (currentPlayer.isHuman) {
        await showTurnIndicator();
    } else {
        executeAiTurn(currentPlayer);
    }
}

function checkGameEnd() {
    const { gameState } = getState();

    // Specific win/loss condition for the final battle
    if (gameState.currentStoryBattle === 'necroverso_final') {
        if (gameState.necroversoHearts <= 0) {
            gameState.gamePhase = 'game_over';
            document.dispatchEvent(new CustomEvent('storyWinLoss', { detail: { battle: 'necroverso_final', won: true } }));
            return true;
        }
        const playerTeamIds = ['player-1', 'player-4'];
        const isPlayerTeamEliminated = playerTeamIds.every(id => gameState.players[id] && gameState.players[id].isEliminated);
        if (isPlayerTeamEliminated) {
            gameState.gamePhase = 'game_over';
            document.dispatchEvent(new CustomEvent('storyWinLoss', { detail: { battle: 'necroverso_final', won: false } }));
            return true;
        }
    }
    
    // Win by being the last one standing in King Necro battle
    if (gameState.isKingNecroBattle) {
        const activePlayers = gameState.playerIdsInGame.filter(id => !gameState.players[id].isEliminated);
        if (activePlayers.length <= 1) {
            gameState.gamePhase = 'game_over';
            const player1Victorious = activePlayers.length === 1 && activePlayers[0] === 'player-1';
            document.dispatchEvent(new CustomEvent('storyWinLoss', { detail: { battle: gameState.currentStoryBattle, won: player1Victorious } }));
            return true;
        }
    }


    // Standard win condition for all other modes (reaching position 10)
    const gameWinners = gameState.playerIdsInGame.filter(id => !gameState.players[id].isEliminated && gameState.players[id].position >= config.WINNING_POSITION);

    if (gameWinners.length > 0) {
        let actualWinners = [...gameWinners];
        
        if (gameState.isXaelChallenge) {
            const player1 = gameState.players['player-1'];
            const xael = gameState.players['player-2'];
            
            const player1Won = gameWinners.includes('player-1');
            const xaelWon = gameWinners.includes('player-2');

            if (player1Won && xaelWon) {
                // Tie-breaker: most stars. Xael wins ties.
                actualWinners = (player1.stars > xael.stars) ? ['player-1'] : ['player-2'];
            } else if (player1Won) {
                actualWinners = ['player-1'];
            } else if (xaelWon) {
                actualWinners = ['player-2'];
            } else {
                 actualWinners = []; // Should not happen if gameWinners has items
            }
        }
        
        if(actualWinners.length > 0) {
            gameState.gamePhase = 'game_over';
            if (gameState.isStoryMode) {
                 const player1Victorious = gameState.gameMode === 'duo'
                    ? actualWinners.some(id => (gameState.currentStoryBattle === 'necroverso_final' ? ['player-1', 'player-4'] : config.TEAM_A).includes(id))
                    : actualWinners.includes('player-1');
                document.dispatchEvent(new CustomEvent('storyWinLoss', { detail: { battle: gameState.currentStoryBattle, won: player1Victorious } }));
            } else {
                const winnerNames = actualWinners.map(id => gameState.players[id].name).join(' e ');
                showGameOver(`${winnerNames} venceu o jogo!`);
                grantAchievement('first_win');
            }
            return true; // Game has ended
        }
    }
    return false; // Game continues
}


/**
 * Calculates final scores, determines winner, moves pawns, and checks for game over.
 */
async function calculateScoresAndEndRound() {
    const { gameState } = getState();
    const finalScores = {};

    // 0. Reset Contravox flag before checking for new triggers
    gameState.player1CardsObscured = false;

    // 1. Calculate final scores including all effects
    gameState.playerIdsInGame.forEach(id => {
        const p = gameState.players[id];
        if (p.isEliminated) return;

        let score = p.playedCards.value.reduce((sum, card) => sum + card.value, 0);
        let restoValue = p.resto?.value || 0;

        // Check for field effects on resto
        if (gameState.activeFieldEffects.some(fe => fe.name === 'Resto Maior' && fe.appliesTo === id)) restoValue = 10;
        if (gameState.activeFieldEffects.some(fe => fe.name === 'Resto Menor' && fe.appliesTo === id)) restoValue = 2;

        if (p.effects.score === 'Mais') score += restoValue;

        let scoreModifier = 1;
        // Check for Super Exposto before applying Menos
        if (gameState.activeFieldEffects.some(fe => fe.name === 'Super Exposto' && fe.appliesTo === id)) {
            scoreModifier = 2;
             updateLog(`Efeito 'Super Exposto' dobrou o efeito negativo em ${p.name}!`);
        }
        
        if (p.effects.score === 'Menos') score -= (restoValue * scoreModifier);
        if (p.effects.score === 'NECRO X') score += 10;
        if (p.effects.score === 'NECRO X Invertido') score -= 10;

        finalScores[id] = score;
        p.liveScore = score;
    });

    // 2. Determine winner(s)
    let winners = [];
    if (gameState.playerIdsInGame.filter(pId => !gameState.players[pId].isEliminated).length > 0) {
        let highestScore = -Infinity;
        gameState.playerIdsInGame.forEach(id => {
            const p = gameState.players[id];
            if (p.isEliminated) return;
            if (finalScores[id] > highestScore) {
                highestScore = finalScores[id];
                winners = [id];
            } else if (finalScores[id] === highestScore) {
                winners.push(id);
            }
        });
    }

    // 3. Handle tie logic
    if (winners.length > 1) { // A tie exists
        if (gameState.gameMode === 'duo') {
            const teamA_Ids = gameState.currentStoryBattle === 'necroverso_final' ? ['player-1', 'player-4'] : config.TEAM_A;
            const teamB_Ids = gameState.currentStoryBattle === 'necroverso_final' ? ['player-2', 'player-3'] : config.TEAM_B;

            const firstWinnerTeam = teamA_Ids.includes(winners[0]) ? 'A' : 'B';
            const allWinnersOnSameTeam = winners.every(id => 
                (firstWinnerTeam === 'A' && teamA_Ids.includes(id)) || 
                (firstWinnerTeam === 'B' && teamB_Ids.includes(id))
            );
            if (!allWinnersOnSameTeam) {
                winners = []; // Tie between teams
            }
        } else { // Solo mode tie
            winners = []; 
        }
    }
    
    // 4. Log winner and show summary modal
    if (winners.length > 0) {
        const winnerNames = winners.map(id => gameState.players[id].name).join(' e ');
        updateLog(`Vencedor(es) da rodada: ${winnerNames}.`);
    } else {
        updateLog("A rodada terminou em empate. Ninguém avança por pontuação.");
    }
    await showRoundSummaryModal(winners, finalScores);
    
    // 5. Apply pawn movements
    // A. Sobe/Desce/Pula effects and loser field effects first
    for (const id of gameState.playerIdsInGame) {
        const p = gameState.players[id];
        if (p.isEliminated) continue;
        
        let movementModifier = 1;
        // Check for Super Exposto before applying Desce
        if (gameState.activeFieldEffects.some(fe => fe.name === 'Super Exposto' && fe.appliesTo === id)) {
            movementModifier = 2; // Already logged above
        }
        
        const effect = p.effects.movement;
        if (effect === 'Sobe') {
            p.position = Math.min(config.WINNING_POSITION, p.position + 1);
            updateLog(`${p.name} usou 'Sobe' e avançou para a casa ${p.position}.`);
        }
        if (effect === 'Desce') {
            p.position = Math.max(1, p.position - (1 * movementModifier));
            updateLog(`${p.name} usou 'Desce' e voltou para a casa ${p.position}.`);
        }
        if (effect === 'Pula' && p.targetPathForPula !== null) {
            p.pathId = p.targetPathForPula;
            updateLog(`${p.name} foi forçado a pular para o caminho ${p.targetPathForPula + 1}.`);
        }

        // Field effects that apply on end of round
        const isLoser = !winners.includes(id) && winners.length > 0;
        if (isLoser && gameState.activeFieldEffects.some(fe => fe.name === 'Castigo' && fe.appliesTo === id)) {
            p.position = Math.max(1, p.position - 3);
            updateLog(`Efeito 'Castigo' fez ${p.name} voltar 3 casas para a casa ${p.position}.`);
        }
        if (isLoser && gameState.activeFieldEffects.some(fe => fe.name === 'Impulso' && fe.appliesTo === id)) {
            p.position = Math.min(config.WINNING_POSITION, p.position + 1);
            updateLog(`Efeito 'Impulso' fez ${p.name} avançar 1 casa para a casa ${p.position}.`);
        }
    }

    // B. Winner's advance & 'Desafio' field effect
    if (winners.length > 0) {
        winners.forEach(id => {
            const p = gameState.players[id];
            // Check for 'Parada' field effect
            if (gameState.activeFieldEffects.some(fe => fe.name === 'Parada' && fe.appliesTo === id)) {
                updateLog(`Efeito 'Parada' impede ${p.name} de avançar.`);
                return;
            }

            let advanceAmount = 1;
            // Check for 'Desafio' field effect
            if (gameState.activeFieldEffects.some(fe => fe.name === 'Desafio' && fe.appliesTo === id)) {
                // Check if challenge conditions are met (no 'Mais' or 'Sobe')
                if (p.effects.score !== 'Mais' && p.effects.movement !== 'Sobe') {
                    advanceAmount = 3;
                    updateLog(`Efeito 'Desafio' completo! ${p.name} avança 3 casas!`);
                }
            }

            p.position = Math.min(config.WINNING_POSITION, p.position + advanceAmount);
            updateLog(`${p.name} avançou para a casa ${p.position}.`);
        });
    }

    // 6. Check for pawn landing abilities before next round starts
    for (const id of gameState.playerIdsInGame) {
        if (!gameState.players[id].isEliminated) {
            await checkAndTriggerPawnLandingAbilities(gameState.players[id]);
        }
    }
    
    // 7. Check for game win/loss conditions
    if (checkGameEnd()) {
        return; // Stop processing if the game has ended
    }

    // 8. Set next player for the new round
    if (winners.length > 0) {
        // In duo mode, if multiple players from the winning team won, pick the one who comes first in turn order
        const winnerTurnOrder = gameState.playerIdsInGame.filter(pId => winners.includes(pId));
        if (winnerTurnOrder.length > 0) {
            gameState.currentPlayer = winnerTurnOrder[0];
        }
    }
    
    // 9. Start the next round
    await startNewRound();
}