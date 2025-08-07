import { getState } from '../core/state.js';
import * as dom from '../core/dom.js';
import * as config from '../core/config.js';

/**
 * Calculates live scores for all players and determines their winning/losing status for UI rendering.
 * Also updates the side score boxes based on game mode.
 */
export function updateLiveScoresAndWinningStatus() {
    const { gameState } = getState();
    if (!gameState) return;

    // --- Part 1: Calculate live scores for all players ---
    const scores = {};
    gameState.playerIdsInGame.forEach(id => {
        const player = gameState.players[id];
        let score = player.playedCards.value.reduce((sum, card) => sum + card.value, 0);

        // Apply temporary effects for live scoring
        const effect = player.effects.score;
        let restoValue = player.resto ? player.resto.value : 0;
        
        const restoMaiorEffect = gameState.activeFieldEffects.find(fe => fe.name === 'Resto Maior' && fe.appliesTo === id);
        if(restoMaiorEffect) restoValue = 10;
        const restoMenorEffect = gameState.activeFieldEffects.find(fe => fe.name === 'Resto Menor' && fe.appliesTo === id);
        if(restoMenorEffect) restoValue = 2;

        if (effect === 'Mais') score += restoValue;
        if (effect === 'Menos') score -= restoValue;
        
        player.liveScore = score;
        scores[id] = score;
    });

    // --- Part 2: Determine winning/losing status for each player and update UI ---
    // Clear previous statuses
    dom.leftScoreStatus.textContent = '';
    dom.leftScoreStatus.className = 'side-score-status';
    dom.rightScoreStatus.textContent = '';
    dom.rightScoreStatus.className = 'side-score-status';

    const activePlayers = gameState.playerIdsInGame.filter(id => !gameState.players[id].isEliminated);
    const sortedPlayers = [...activePlayers].sort((a, b) => scores[b] - scores[a]);
    
    if (sortedPlayers.length > 1) {
        const highestScore = scores[sortedPlayers[0]];
        const lowestScore = scores[sortedPlayers[sortedPlayers.length - 1]];

        activePlayers.forEach(id => {
            if (highestScore > lowestScore) {
                if (scores[id] === highestScore) gameState.players[id].status = 'winning';
                else if (scores[id] === lowestScore) gameState.players[id].status = 'losing';
                else gameState.players[id].status = 'neutral';
            } else {
                gameState.players[id].status = 'neutral';
            }
        });
    } else if (sortedPlayers.length === 1) {
        // If only one player is left, they are neutral.
        gameState.players[sortedPlayers[0]].status = 'neutral';
    }


    // --- Part 3: Update side score boxes and their statuses ---
    const player1 = gameState.players['player-1'];
    const opponents = gameState.playerIdsInGame.filter(id => id !== 'player-1' && !gameState.players[id].isEliminated);

    // Hide boxes if there are no opponents (e.g., loading state)
    if (opponents.length === 0) {
        dom.leftScoreBox.classList.add('hidden');
        dom.rightScoreBox.classList.add('hidden');
        return;
    }

    // Always show and update the human player's score box (left)
    dom.leftScoreBox.classList.remove('hidden');
    dom.leftScoreBox.className = 'side-score-box player-1-score'; // Always blue
    dom.leftScoreValue.textContent = scores['player-1'] || 0;
    // Update P1 Status text
    if (player1.status === 'winning') {
        dom.leftScoreStatus.textContent = 'Ganhando';
        dom.leftScoreStatus.classList.add('winning');
    } else if (player1.status === 'losing') {
        dom.leftScoreStatus.textContent = 'Perdendo';
        dom.leftScoreStatus.classList.add('losing');
    }

    // Show the right score box
    dom.rightScoreBox.classList.remove('hidden');

    // Handle duo mode score display for side box and header
    if (gameState.gameMode === 'duo') {
        const teamA_Ids = gameState.currentStoryBattle === 'necroverso_final' ? ['player-1', 'player-4'] : config.TEAM_A;
        const teamB_Ids = gameState.currentStoryBattle === 'necroverso_final' ? ['player-2', 'player-3'] : config.TEAM_B;
        
        let teamAScore = 0;
        teamA_Ids.forEach(id => { if (gameState.players[id]) teamAScore += gameState.players[id].liveScore; });
        
        let teamBScore = 0;
        teamB_Ids.forEach(id => { if (gameState.players[id]) teamBScore += gameState.players[id].liveScore; });
        
        dom.rightScoreBox.className = 'side-score-box player-2-score';
        dom.rightScoreValue.textContent = teamBScore;
        
        // Update Right Status Text for Team B
        if (teamBScore > teamAScore) {
            dom.rightScoreStatus.textContent = 'Ganhando';
            dom.rightScoreStatus.classList.add('winning');
        } else if (teamBScore < teamAScore) {
            dom.rightScoreStatus.textContent = 'Perdendo';
            dom.rightScoreStatus.classList.add('losing');
        }

        dom.teamScoresContainer.classList.remove('hidden');
        let teamAHeartsHTML = '', teamBHeartsHTML = '';
        if (gameState.currentStoryBattle === 'necroverso_final') {
            const teamAHearts = (gameState.players['player-1']?.hearts || 0) + (gameState.players['player-4']?.hearts || 0);
            const teamBHearts = (gameState.players['player-2']?.hearts || 0) + (gameState.players['player-3']?.hearts || 0);
            teamAHeartsHTML = `<span class="header-hearts">${'❤'.repeat(teamAHearts)}</span>`;
            teamBHeartsHTML = `<span class="header-hearts">${'❤'.repeat(teamBHearts)}</span>`;
        }
        dom.teamScoresContainer.innerHTML = `
            <div class="team-score team-a"><span>Equipe Azul: ${teamAScore}</span>${teamAHeartsHTML}</div>
            <div class="team-score team-b"><span>Equipe Vermelha: ${teamBScore}</span>${teamBHeartsHTML}</div>
        `;
    } else { // Solo modes (1v1, 1v2, 1v3)
        dom.teamScoresContainer.classList.add('hidden'); // Hide header scores in solo

        const winningOpponentId = opponents.sort((a, b) => scores[b] - scores[a])[0];
        if (winningOpponentId) {
            const opponentPlayer = gameState.players[winningOpponentId];
            const opponentPIdNum = parseInt(opponentPlayer.id.split('-')[1]);
            
            dom.rightScoreBox.className = `side-score-box player-${opponentPIdNum}-score`;
            dom.rightScoreValue.textContent = scores[winningOpponentId] || 0;

            // Update Right Status Text for the displayed opponent
            if (opponentPlayer.status === 'winning') {
                dom.rightScoreStatus.textContent = 'Ganhando';
                dom.rightScoreStatus.classList.add('winning');
            } else if (opponentPlayer.status === 'losing') {
                dom.rightScoreStatus.textContent = 'Perdendo';
                dom.rightScoreStatus.classList.add('losing');
            }
        } else {
            dom.rightScoreBox.classList.add('hidden');
        }
    }
}