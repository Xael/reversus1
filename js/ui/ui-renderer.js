import * as dom from '../core/dom.js';
import { getState, updateState } from '../core/state.js';
import { updateLiveScoresAndWinningStatus } from '../game-logic/score.js';
import { renderPlayerArea } from './player-area-renderer.js';
import { renderBoard } from './board-renderer.js';
import { grantAchievement } from '../core/achievements.js';
import { showSplashScreen } from './splash-screen.js';

/**
 * Updates the UI for Xael's Star Power ability.
 */
export const updateXaelStarPowerUI = () => {
    const { gameState } = getState();
    if (!gameState || !gameState.isXaelChallenge) {
        dom.xaelStarPowerButton.classList.add('hidden');
        return;
    }

    const player = gameState.players['player-1'];
    if (player && player.hasXaelStarPower) {
        dom.xaelStarPowerButton.classList.remove('hidden');
        const isOnCooldown = player.xaelStarPowerCooldown > 0;
        dom.xaelStarPowerButton.disabled = isOnCooldown;
        dom.xaelStarPowerButton.classList.toggle('cooldown', isOnCooldown);
        dom.xaelStarPowerButton.title = isOnCooldown 
            ? `Poder Estelar (Recarregando por mais ${player.xaelStarPowerCooldown} rodada(s))`
            : 'Poder Estelar do Xael (Revela mãos)';
    } else {
        dom.xaelStarPowerButton.classList.add('hidden');
    }
};


/**
 * Renders all dynamic UI components of the game.
 */
export const renderAll = () => {
    const { gameState } = getState();
    if (!gameState) return;
    
    // Render each player's area
    gameState.playerIdsInGame.forEach(id => renderPlayerArea(gameState.players[id]));

    // Render the game board and pawns
    renderBoard();

    // Update the action buttons based on the current state
    updateActionButtons();

    // Update live scores and side panel statuses
    updateLiveScoresAndWinningStatus();
    
    // Update Xael's Star Power button if in that challenge
    if (gameState.isXaelChallenge) {
        updateXaelStarPowerUI();
    }
};

/**
 * Enables/disables action buttons based on game state. The turn message is handled by overlays.
 */
export const updateActionButtons = () => {
    const { gameState } = getState();
    if (!gameState) return;

    const currentPlayer = gameState.players[gameState.currentPlayer];
    const player1 = gameState.players['player-1'];

    const isHumanTurn = currentPlayer.isHuman && gameState.gamePhase === 'playing';
    const hasSelectedCard = !!gameState.selectedCard;

    // Logic for enabling/disabling the end turn button
    const valueCardsInHandCount = player1.hand.filter(c => c.type === 'value').length;
    // Player MUST play a value card if they have >1 and haven't played one this turn.
    const mustPlayValueCard = valueCardsInHandCount > 1 && !player1.playedValueCardThisTurn;

    dom.playButton.disabled = !isHumanTurn || !hasSelectedCard;
    dom.endTurnButton.disabled = !isHumanTurn || mustPlayValueCard;
};

/**
 * Displays and then hides the "Sua Vez" indicator.
 */
export async function showTurnIndicator() {
    return new Promise(resolve => {
        dom.turnAnnounceModal.classList.remove('hidden');
        setTimeout(() => {
            dom.turnAnnounceModal.classList.add('hidden');
            resolve();
        }, 3000); // Increased duration to 3 seconds
    });
}

/**
 * Shows the round summary modal with scores and winner information.
 */
export async function showRoundSummaryModal(winners, finalScores) {
    const { gameState } = getState();

    dom.roundSummaryTitle.textContent = `Fim da Rodada ${gameState.turn}`;
    
    const winnerNames = winners.map(id => gameState.players[id].name).join(' e ');
    dom.roundSummaryWinnerText.textContent = winners.length > 0 ? `Vencedor(es): ${winnerNames}` : "A rodada empatou!";
    
    dom.roundSummaryScoresEl.innerHTML = gameState.playerIdsInGame.map(id => {
        const player = gameState.players[id];
        return `
            <div class="summary-player-score ${winners.includes(id) ? 'is-winner' : ''}">
                <span class="summary-player-name">${player.name}</span>
                <span class="summary-player-final-score">${finalScores[id] || 0}</span>
            </div>
        `;
    }).join('');

    dom.roundSummaryModal.classList.remove('hidden');
    return new Promise(resolve => {
        const button = dom.nextRoundButton;
        const clickHandler = () => {
            dom.roundSummaryModal.classList.add('hidden');
            button.removeEventListener('click', clickHandler);
            clearTimeout(timeoutId);
            resolve();
        };
        const timeoutId = setTimeout(clickHandler, 5000); // Auto-advance after 5s
        button.addEventListener('click', clickHandler);
    });
}

/**
 * Shows the game over screen with a custom message and button.
 * @param {string} message - The message to display (e.g., who won).
 * @param {string} [title="Fim de Jogo!"] - The title for the modal.
 * @param {object} [buttonOptions={}] - Options for the button.
 * @param {string} [buttonOptions.text='Jogar Novamente'] - The text for the button.
 * @param {string} [buttonOptions.action='restart'] - The action for the button ('restart' or 'menu').
 */
export const showGameOver = (message, title = "Fim de Jogo!", buttonOptions = {}) => {
    const { text = 'Jogar Novamente', action = 'restart' } = buttonOptions;

    dom.gameOverTitle.textContent = title;
    dom.gameOverMessage.textContent = message;
    
    dom.restartButton.textContent = text;
    dom.restartButton.dataset.action = action; // Set data attribute for handler

    dom.gameOverModal.classList.remove('hidden');
    
    const { gameTimerInterval } = getState();
    if(gameTimerInterval) clearInterval(gameTimerInterval);
    updateState('gameTimerInterval', null);

    // Grant first win/defeat achievement on regular game over
    const { gameState } = getState();
    if (gameState && !gameState.isStoryMode && action === 'restart') {
        const player1Won = message.includes(gameState.players['player-1'].name);
        grantAchievement(player1Won ? 'first_win' : 'first_defeat');

        // Grant "Quick Duel Win" achievement
        if (player1Won && gameState.gameMode === 'solo' && gameState.playerIdsInGame.length === 2) {
            grantAchievement('quick_duel_win');
        }
    }
};