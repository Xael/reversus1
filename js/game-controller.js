

import * as config from './core/config.js';
import * as dom from './core/dom.js';
import { getState, updateState } from './core/state.js';
import { renderAll } from './ui/ui-renderer.js';
import { showSplashScreen } from './ui/splash-screen.js';
import { playStoryMusic, stopStoryMusic } from './core/sound.js';
import { updateLog, shuffle } from './core/utils.js';
import { createDeck } from './game-logic/deck.js';
import { initiateGameStartSequence } from './game-logic/turn-manager.js';
import { generateBoardPaths } from './game-logic/board.js';
import { executeAiTurn } from './ai/ai-controller.js';


/**
 * Updates the in-game timer display, handling normal and countdown modes.
 */
export const updateGameTimer = () => {
    const { gameStartTime, gameState, gameTimerInterval } = getState();
    if (!gameStartTime || !gameState) return;
    
    const elapsed = Math.floor((Date.now() - gameStartTime) / 1000);
    gameState.elapsedSeconds = elapsed; // Persist elapsed time for snapshots

    if (gameState.currentStoryBattle === 'necroverso_final') {
        const totalSeconds = 20 * 60; // 20 minutes countdown
        const remaining = totalSeconds - elapsed;
        
        if (remaining <= 0) {
            dom.gameTimerContainerEl.textContent = '00:00';
            if(gameTimerInterval) clearInterval(gameTimerInterval);
            updateState('gameTimerInterval', null);
            // Dispatch event only once
            if (gameState.gamePhase !== 'game_over') {
                document.dispatchEvent(new CustomEvent('storyWinLoss', { detail: { battle: 'necroverso_final', won: false, reason: 'time' } }));
            }
            return;
        }

        // Warning class is now set at the start of the game
        const minutes = Math.floor(remaining / 60).toString().padStart(2, '0');
        const seconds = (remaining % 60).toString().padStart(2, '0');
        dom.gameTimerContainerEl.textContent = `${minutes}:${seconds}`;
    } else {
        const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
        const seconds = (elapsed % 60).toString().padStart(2, '0');
        dom.gameTimerContainerEl.textContent = `${minutes}:${seconds}`;
    }
};

/**
 * Displays a fullscreen announcement for final bosses.
 * @param {string} text - The dialogue text.
 * @param {string} imageSrc - The source URL for the character image.
 */
const showFullscreenAnnounce = async (text, imageSrc) => {
    return new Promise(resolve => {
        dom.fullscreenAnnounceModal.classList.remove('hidden');
        dom.fullscreenAnnounceModal.classList.add('psychedelic-bg');
        dom.fullscreenAnnounceImage.src = imageSrc;
        dom.fullscreenAnnounceText.textContent = text;
        
        setTimeout(() => {
            dom.fullscreenAnnounceModal.classList.add('hidden');
            dom.fullscreenAnnounceModal.classList.remove('psychedelic-bg');
            resolve();
        }, 5000); // Show for 5 seconds
    });
};

/**
 * Initializes a new game with the specified mode and options.
 */
export const initializeGame = async (mode, options) => {
    Object.assign(config.PLAYER_CONFIG, structuredClone(config.originalPlayerConfig));
    updateState('reversusTotalIndividualFlow', false); // Reset flow state
    
    // Handle overrides from either PvP lobby or Story Mode
    const overrides = options.story ? options.story.overrides : options.overrides;
    if (overrides) {
        for (const id in overrides) {
            if (config.PLAYER_CONFIG[id]) {
                Object.assign(config.PLAYER_CONFIG[id], overrides[id]);
            }
        }
    }
    
    let playerIdsInGame, numPlayers, modeText, isStoryMode = false, isFinalBoss = false, storyBattle = null, storyBattleType = null, isInversusMode = false, isXaelChallenge = false;
    let isKingNecroBattle = false;

    if (mode === 'inversus') {
        isInversusMode = true;
        numPlayers = 2;
        playerIdsInGame = config.MASTER_PLAYER_IDS.slice(0, numPlayers);
        modeText = 'Modo Inversus';
        dom.splashScreenEl.classList.add('hidden');
        playStoryMusic('inversus.ogg');

        // Clear previous interval if any
        const { inversusAnimationInterval } = getState();
        if (inversusAnimationInterval) clearInterval(inversusAnimationInterval);

        const inversusImages = ['inversum1.png', 'inversum2.png', 'inversum3.png'];
        let imageIndex = 0;
        const intervalId = setInterval(() => {
            const imgEl = document.getElementById('inversus-character-portrait');
            if (imgEl) {
                imageIndex = (imageIndex + 1) % inversusImages.length;
                imgEl.src = inversusImages[imageIndex];
            }
        }, 2000); // Change image every 2 seconds
        updateState('inversusAnimationInterval', intervalId);
    } else if (options.story) {
        isStoryMode = true;
        storyBattle = options.story.battle;
        if (options.story.playerIds) {
            playerIdsInGame = options.story.playerIds;
        } else {
            // Fallback for lobby-initiated story battles that respect lobby player count
            playerIdsInGame = config.MASTER_PLAYER_IDS.slice(0, options.numPlayers);
        }
        numPlayers = playerIdsInGame.length;
        storyBattleType = options.story.type || null;
        isFinalBoss = storyBattle === 'necroverso_final' || storyBattle === 'necroverso_king';
        isKingNecroBattle = storyBattle === 'necroverso_king';
        isXaelChallenge = storyBattle === 'xael_challenge';
        
        switch(storyBattle) {
            case 'contravox': modeText = 'Modo História: Contravox'; playStoryMusic('contravox.ogg'); break;
            case 'versatrix': modeText = 'Modo História: Versatrix'; playStoryMusic('versatrix.ogg'); break;
            case 'reversum': modeText = 'Modo História: Rei Reversum'; playStoryMusic('reversum.ogg'); break;
            case 'necroverso_king': modeText = 'Modo História: Rei Necroverso'; playStoryMusic('necroverso.ogg'); break;
            case 'necroverso_final': modeText = 'Modo História: Necroverso Final'; playStoryMusic('necroversofinal.ogg'); break;
            case 'narrador': modeText = 'Batalha Secreta: Narrador'; playStoryMusic('narrador.ogg'); break;
            case 'xael_challenge': modeText = 'Desafio: Xael'; playStoryMusic('xaeldesafio.ogg'); break;
            default: modeText = `Modo História: ${storyBattle}`; stopStoryMusic();
        }
    } else {
        numPlayers = options.numPlayers;
        playerIdsInGame = config.MASTER_PLAYER_IDS.slice(0, numPlayers);
        modeText = mode === 'solo' ? `Solo (${numPlayers}p)` : 'Duplas';
        stopStoryMusic();
    }

    // Clear any leftover complex state
    updateState('pathSelectionResolver', null);
    
    // Announce final boss battles before showing the game screen
    if (storyBattle === 'necroverso_king') {
        await showFullscreenAnnounce("Será capaz de vencer este desafio contra nós três?", 'necroversorevelado.png');
    } else if (storyBattle === 'necroverso_final') {
        await showFullscreenAnnounce("Nem mesmo com ajuda da Versatrix poderá me derrotar, eu dominarei o Inversum e consumirei TUDO", 'necroversorevelado.png');
    }


    dom.gameSetupModal.classList.add('hidden');
    dom.storyModeModalEl.classList.add('hidden');
    dom.pvpRoomListModal.classList.add('hidden');
    dom.pvpLobbyModal.classList.add('hidden');
    dom.appContainerEl.classList.remove('blurred', 'hidden');
    dom.reversusTotalIndicatorEl.classList.add('hidden');
    dom.debugButton.classList.remove('hidden');
    dom.boardEl.classList.remove('inverted'); // Reset board direction
    dom.boardEl.classList.toggle('final-battle-board', isFinalBoss);
    dom.boardEl.classList.toggle('board-rotating', isFinalBoss); // Add rotation class for the king battle as well
    
    // Apply narrator monitor effect
    dom.appContainerEl.classList.toggle('effect-monitor', storyBattle === 'narrador');

    const state = getState();
    if (!isStoryMode && !isInversusMode) {
        stopStoryMusic();
        updateState('currentTrackIndex', 0);
        dom.musicPlayer.src = config.MUSIC_TRACKS[state.currentTrackIndex];
    }
    
    dom.gameTimerContainerEl.classList.remove('countdown-warning');
    if (storyBattle === 'necroverso_final') {
        dom.gameTimerContainerEl.classList.add('countdown-warning');
    }
    if (state.gameTimerInterval) clearInterval(state.gameTimerInterval);
    updateState('gameStartTime', Date.now());
    updateGameTimer();
    updateState('gameTimerInterval', setInterval(updateGameTimer, 1000));
    
    const valueDeck = shuffle(createDeck(config.VALUE_DECK_CONFIG, 'value'));
    const effectDeck = shuffle(createDeck(config.EFFECT_DECK_CONFIG, 'effect'));

    const players = Object.fromEntries(
        playerIdsInGame.map((id, index) => {
            const playerObject = {
                ...config.PLAYER_CONFIG[id],
                id,
                aiType: config.PLAYER_CONFIG[id].aiType || 'default',
                pathId: isInversusMode ? -1 : index,
                position: 1,
                hand: [],
                resto: null,
                nextResto: null,
                effects: { score: null, movement: null },
                playedCards: { value: [], effect: [] },
                playedValueCardThisTurn: false,
                targetPathForPula: null,
                liveScore: 0,
                status: 'neutral', // neutral, winning, losing
                isEliminated: false,
            };
            if (isInversusMode) {
                playerObject.hearts = 10;
                playerObject.maxHearts = 10;
            }
            if (isKingNecroBattle) {
                playerObject.hearts = 2;
                playerObject.maxHearts = 3;
            }
             if (storyBattle === 'narrador' && id === 'player-2') {
                playerObject.narratorAbilities = {
                    confusion: true,
                    reversus: true,
                    necroX: true
                };
            }
            if (isXaelChallenge) {
                playerObject.stars = 0;
                playerObject.hasXaelStarPower = (id === 'player-1');
                playerObject.xaelStarPowerCooldown = 0;
            }
            return [id, playerObject];
        })
    );
    
    const boardPaths = generateBoardPaths({ storyBattle, isFinalBoss, isXaelChallenge, isKingNecroBattle });
    if (!isFinalBoss && !isInversusMode && !isXaelChallenge) {
        playerIdsInGame.forEach((id, index) => { 
            if(boardPaths[index]) boardPaths[index].playerId = id; 
        });
    }

    const gameState = {
        players,
        playerIdsInGame,
        decks: { value: valueDeck, effect: effectDeck },
        discardPiles: { value: [], effect: [] },
        boardPaths,
        gamePhase: 'setup',
        gameMode: mode,
        gameOptions: options,
        isStoryMode,
        isInversusMode,
        isFinalBoss,
        isKingNecroBattle,
        isXaelChallenge,
        necroversoHearts: 3,
        currentStoryBattle: storyBattle,
        storyBattleType: storyBattleType,
        currentPlayer: 'player-1',
        reversusTotalActive: false,
        inversusTotalAbilityActive: false,
        turn: 1,
        selectedCard: null,
        reversusTarget: null,
        pulaTarget: null,
        fieldEffectTargetingInfo: null,
        log: [],
        activeFieldEffects: [],
        revealedHands: [],
        consecutivePasses: 0,
        initialDrawCards: null,
        contravoxAbilityUses: 3,
        versatrixSwapActive: false,
        versatrixPowerDisabled: false,
        reversumAbilityUsedThisRound: false,
        necroXUsedThisRound: false,
        dialogueState: { spokenLines: new Set() },
        player1CardsObscured: false,
        xaelChallengeOffered: false,
        xaelChallengeStarted: false,
        elapsedSeconds: 0,
    };
    
    if (isKingNecroBattle) {
        gameState.kingBattlePathColors = ['blue', 'red', 'green', 'yellow', 'black', 'white'];
    }
    
    if (gameState.currentStoryBattle === 'necroverso_king' && getState().achievements.has('versatrix_card_collected')) {
        const versatrixCard = { id: Date.now() + Math.random(), type: 'effect', name: 'Carta da Versatrix', cooldown: 0 };
        players['player-1'].hand.push(versatrixCard);
        updateLog("A bênção da Versatrix está com você. Uma carta especial foi adicionada à sua mão.");
    }

    updateState('gameState', gameState);

    if (dom.leftScoreBox && dom.rightScoreBox) {
        if (isInversusMode || isKingNecroBattle) {
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
    opponentsContainer.innerHTML = playerIdsInGame.filter(id => id !== 'player-1').map(id => createPlayerAreaHTML(id)).join('');

    updateLog(`Bem-vindo ao Reversus! Modo: ${modeText}.`);
    if(mode === 'duo' && !isStoryMode) updateLog("Equipe Azul/Verde (Você & Jogador 3) vs. Equipe Vermelho/Amarelo (Jogador 2 & Jogador 4)");
    
    renderAll();
    
    await initiateGameStartSequence();
};

export function restartLastDuel() {
    const { lastStoryGameOptions } = getState();
    if (!lastStoryGameOptions) {
        console.error("No last duel info found to restart from.");
        showSplashScreen();
        return;
    }
    updateLog("Retornando ao duelo anterior...");
    // Clear modals and overlays before restarting
    dom.gameOverModal.classList.add('hidden');
    dom.cosmicGlowOverlay.classList.add('hidden');

    // Call initializeGame with the saved options
    const { mode, options } = lastStoryGameOptions;
    initializeGame(mode, options);
}

export function setupPvpRooms() {
    const rooms = [];
    for (let i = 1; i <= 12; i++) {
        rooms.push({
            id: i,
            name: `Sala ${i}`,
            players: Math.floor(Math.random() * 5),
            mode: i % 3 === 0 ? 'Duo (2v2)' : 'Solo (1v3)',
            password: i === 12 ? 'Final' : null
        });
    }
    updateState('pvpRooms', rooms);
}