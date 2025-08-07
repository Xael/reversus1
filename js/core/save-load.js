import { getState, updateState } from './state.js';
import { updateLog } from './utils.js';
import * as dom from './dom.js';
import { renderAll } from '../ui/ui-renderer.js';
import { showSplashScreen } from '../ui/splash-screen.js';
import { executeAiTurn } from '../ai/ai-controller.js';
import { updateGameTimer } from '../game-controller.js';
import { playStoryMusic, stopStoryMusic, initializeMusic } from './sound.js';

const SAVE_KEY = 'reversus-story-save';

export const saveGameState = () => {
    const { gameState, storyState, gameStartTime } = getState();
    if (!gameState || !gameState.isStoryMode) {
        updateLog("Apenas o progresso do Modo História pode ser salvo.");
        return;
    }

    const elapsedSeconds = gameStartTime ? Math.floor((Date.now() - gameStartTime) / 1000) : 0;

    // Create a serializable version of the game state
    const savableGameState = {
        ...gameState,
        dialogueState: {
            ...gameState.dialogueState,
            // Convert Set to Array for JSON serialization
            spokenLines: Array.from(gameState.dialogueState.spokenLines || [])
        }
    };

    const dataToSave = {
        gameState: savableGameState,
        storyState: storyState,
        elapsedSeconds: elapsedSeconds,
    };

    try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(dataToSave));
        updateLog("Jogo salvo com sucesso!");
        dom.saveGameConfirmModal.classList.add('hidden');
        checkForSavedGame();
    } catch (error) {
        console.error("Erro ao salvar o jogo:", error);
        updateLog("Falha ao salvar o jogo. O armazenamento pode estar cheio.");
    }
};

export const loadGameState = () => {
    const savedData = localStorage.getItem(SAVE_KEY);
    if (!savedData) {
        updateLog("Nenhum jogo salvo encontrado.");
        return;
    }

    let data;
    try {
        data = JSON.parse(savedData);
    } catch (error) {
        console.error("Erro ao carregar o jogo salvo:", error);
        updateLog("O arquivo salvo está corrompido e não pôde ser carregado.");
        localStorage.removeItem(SAVE_KEY);
        checkForSavedGame();
        return;
    }
    
    // Convert spokenLines array back to a Set after loading.
    if (data.gameState && data.gameState.dialogueState && Array.isArray(data.gameState.dialogueState.spokenLines)) {
        data.gameState.dialogueState.spokenLines = new Set(data.gameState.dialogueState.spokenLines);
    } else if (data.gameState && data.gameState.dialogueState) {
        // Handle case where it might be missing or corrupted
        data.gameState.dialogueState.spokenLines = new Set();
    }

    initializeMusic();
    updateState('gameState', data.gameState);
    updateState('storyState', data.storyState);
    const { gameState } = getState();
    const savedElapsedSeconds = data.elapsedSeconds || 0;
    
    const newStartTime = Date.now() - (savedElapsedSeconds * 1000);
    updateState('gameStartTime', newStartTime);

    const state = getState();
    if (state.gameTimerInterval) clearInterval(state.gameTimerInterval);
    updateGameTimer();
    updateState('gameTimerInterval', setInterval(updateGameTimer, 1000));

    dom.splashScreenEl.classList.add('hidden');
    dom.appContainerEl.classList.remove('hidden');
    dom.debugButton.classList.remove('hidden');
    dom.boardEl.classList.toggle('inverted', gameState.isFinalBoss);

    // BUG FIX: Ensure score boxes are visible when loading a game
    if (dom.leftScoreBox && dom.rightScoreBox) {
        if (gameState.isInversusMode) {
            dom.leftScoreBox.classList.add('hidden');
            dom.rightScoreBox.classList.add('hidden');
        } else {
            dom.leftScoreBox.classList.remove('hidden');
            dom.rightScoreBox.classList.remove('hidden');
        }
    }

    const player1Container = document.getElementById('player-1-area-container');
    const opponentsContainer = document.getElementById('opponent-zones-container');
    const createPlayerAreaHTML = (id) => `<div class="player-area" id="player-area-${id}"></div>`;
    player1Container.innerHTML = createPlayerAreaHTML('player-1');
    opponentsContainer.innerHTML = gameState.playerIdsInGame.filter(id => id !== 'player-1').map(id => createPlayerAreaHTML(id)).join('');

    if (gameState.isStoryMode && gameState.currentStoryBattle) {
         switch(gameState.currentStoryBattle) {
            case 'contravox': playStoryMusic('contravox.ogg'); break;
            case 'versatrix': playStoryMusic('versatrix.ogg'); break;
            case 'reversum': playStoryMusic('reversum.ogg'); break;
            case 'necroverso_king': playStoryMusic('necroverso.ogg'); break;
            case 'necroverso_final': playStoryMusic('necroversofinal.ogg'); break;
            default: stopStoryMusic();
        }
    }

    updateLog("Jogo carregado com sucesso!");
    renderAll();

    const currentPlayer = gameState.players[gameState.currentPlayer];
    if (currentPlayer && !currentPlayer.isHuman && gameState.gamePhase !== 'resolution' && gameState.gamePhase !== 'game_over') {
        executeAiTurn(currentPlayer);
    }
};

export const checkForSavedGame = () => {
    if (localStorage.getItem(SAVE_KEY)) {
        dom.continueButton.disabled = false;
    } else {
        dom.continueButton.disabled = true;
    }
};

export const deleteSavedGame = () => {
    localStorage.removeItem(SAVE_KEY);
    checkForSavedGame();
};