import * as dom from '../core/dom.js';
import * as config from '../core/config.js';
import { shuffle, updateLog } from '../core/utils.js';
import { getState } from '../core/state.js';
import { renderAll } from '../ui/ui-renderer.js';
import { playSoundEffect, announceEffect } from '../core/sound.js';

/**
 * Generates the paths and spaces for the game board, including special effect spaces.
 * @param {object} options - Options to customize the board.
 * @returns {Array<object>} An array of path objects.
 */
export const generateBoardPaths = (options = {}) => {
    const paths = [];
    const allPositiveEffects = Object.keys(config.POSITIVE_EFFECTS);
    const allNegativeEffects = Object.keys(config.NEGATIVE_EFFECTS);

    // King Necro Battle gets a special board generation
    if (options.isKingNecroBattle) {
        const initialColors = ['blue', 'red', 'green', 'yellow', 'black', 'white'];
        
        for (let i = 0; i < config.NUM_PATHS; i++) {
            const pathColor = initialColors[i];
            const spaces = Array.from({ length: config.BOARD_SIZE }, (_, j) => ({
                id: j + 1, color: pathColor, effectName: null, isUsed: false, hasHeart: false
            }));
            paths.push({ id: i, originalColor: pathColor, spaces });
        }
        
        const availableSpacesForHearts = [];
        const blackPathIndex = initialColors.indexOf('black');

        paths.forEach((path, pathIndex) => {
            if (pathIndex !== blackPathIndex) {
                 path.spaces.forEach((space, spaceIndex) => {
                    if (spaceIndex > 0 && spaceIndex < 8) {
                        availableSpacesForHearts.push({ pathIndex, spaceIndex });
                    }
                });
            }
        });
        
        shuffle(availableSpacesForHearts);
        for (let i = 0; i < 4 && i < availableSpacesForHearts.length; i++) {
            const { pathIndex, spaceIndex } = availableSpacesForHearts[i];
            paths[pathIndex].spaces[spaceIndex].hasHeart = true;
            paths[pathIndex].spaces[spaceIndex].color = 'white';
        }

        return paths;
    }
    
    // Original logic for all other modes
    for (let i = 0; i < config.NUM_PATHS; i++) {
        const spaces = Array.from({ length: config.BOARD_SIZE }, (_, j) => ({
            id: j + 1, color: 'white', effectName: null, isUsed: false
        }));
        
        // Golden Rule: Spaces 1 and 9 are never colored.
        const colorableSpaceIds = Array.from({ length: 7 }, (_, j) => j + 2); // Spaces 2 through 8
        shuffle(colorableSpaceIds);
        let currentSpaceIndex = 0;

        // Black holes for final boss or king battle
        if (options.isFinalBoss) { // necroverso_final only
            const numBlackHoles = Math.random() > 0.5 ? 2 : 1;
            for(let k = 0; k < numBlackHoles && currentSpaceIndex < colorableSpaceIds.length; k++) {
                const spaceToBlacken = spaces.find(s => s.id === colorableSpaceIds[currentSpaceIndex]);
                if (spaceToBlacken) spaceToBlacken.color = 'black';
                currentSpaceIndex++;
            }
        }
        
        // Star spaces for Xael Challenge
        if (options.isXaelChallenge) {
            const numStarSpaces = 1;
            for (let k = 0; k < numStarSpaces && currentSpaceIndex < colorableSpaceIds.length; k++) {
                const spaceToStar = spaces.find(s => s.id === colorableSpaceIds[currentSpaceIndex]);
                if (spaceToStar) spaceToStar.color = 'star';
                currentSpaceIndex++;
            }
        }

        // Red, Blue, and Yellow for Narrator battle
        if (options.storyBattle === 'narrador') {
            const colors = ['red', 'blue', 'yellow'];
            for(let k = 0; k < colors.length && currentSpaceIndex < colorableSpaceIds.length; k++) {
                const spaceToColor = spaces.find(s => s.id === colorableSpaceIds[currentSpaceIndex]);
                if (spaceToColor) {
                    spaceToColor.color = colors[k];
                    // Narrator doesn't use named field effects, just color logic.
                }
                currentSpaceIndex++;
            }
        } else {
             // Blue/Red spaces
            const numBlueRed = options.isFinalBoss ? 1 : config.COLORED_SPACES_PER_PATH;
            for (let k = 0; k < numBlueRed && currentSpaceIndex < colorableSpaceIds.length; k++) {
                const spaceToColor = spaces.find(s => s.id === colorableSpaceIds[currentSpaceIndex]);
                const isReversumBattle = options.storyBattle === 'reversum';
                const isPositive = isReversumBattle ? false : (Math.random() > 0.5);
                 if (spaceToColor) {
                    if (isPositive) {
                        spaceToColor.color = 'blue';
                        spaceToColor.effectName = shuffle([...allPositiveEffects])[0];
                    } else {
                        spaceToColor.color = 'red';
                        spaceToColor.effectName = shuffle([...allNegativeEffects])[0];
                    }
                }
                currentSpaceIndex++;
            }
            
            // Yellow spaces
            const isVersatrixBattle = options.storyBattle === 'versatrix' || options.isFinalBoss;
            if (isVersatrixBattle && currentSpaceIndex < colorableSpaceIds.length) {
                const numYellow = 1;
                 for (let k = 0; k < numYellow && currentSpaceIndex < colorableSpaceIds.length; k++) {
                    const spaceToYellow = spaces.find(s => s.id === colorableSpaceIds[currentSpaceIndex]);
                    if (spaceToYellow) spaceToYellow.color = 'yellow';
                    currentSpaceIndex++;
                 }
            }
        }
        
        const playerId = i < config.MASTER_PLAYER_IDS.length ? config.MASTER_PLAYER_IDS[i] : null;
        paths.push({ id: i, playerId, spaces });
    }
    return paths;
};

/**
 * Rotates the board colors and applies start-of-round effects for the King Necroverso battle.
 * @param {boolean} [shouldRotate=true] - If true, the board colors will rotate before effects are applied.
 */
export async function rotateAndApplyKingNecroversoBoardEffects(shouldRotate = true) {
    const { gameState } = getState();
    if (!gameState.isKingNecroBattle) return;

    if (shouldRotate) {
        updateLog("O tabuleiro do Rei Necroverso gira!");
        const pathColors = gameState.kingBattlePathColors;
        
        // Rotate colors anti-clockwise (left shift)
        const firstColor = pathColors.shift();
        pathColors.push(firstColor);

        // Apply new colors to paths
        gameState.boardPaths.forEach((path, index) => {
            path.spaces.forEach(space => {
                // Only re-color spaces that don't have a heart on them
                if (!space.hasHeart) {
                     space.color = pathColors[index];
                }
            });
        });
    }

    // Apply start-of-round effects based on new path colors
    for (const player of Object.values(gameState.players)) {
        if (player.isEliminated) continue;

        const playerPath = gameState.boardPaths.find(p => p.id === player.pathId);
        if (!playerPath) continue;

        const pathColor = playerPath.spaces[0].color; // Color is consistent across the path (checked at space 1)

        switch (pathColor) {
            case 'black':
                player.hearts = Math.max(0, player.hearts - 1);
                playSoundEffect('coracao');
                announceEffect('💔', 'heartbreak', 1500);
                updateLog(`${player.name} começa no caminho preto e perde 1 coração! Restam: ${player.hearts}.`);
                if (player.hearts === 0) {
                    player.isEliminated = true;
                    updateLog(`${player.name} foi eliminado!`);
                }
                break;
            case 'green':
                 player.player1CardsObscured = true; // Obscure this player's cards
                 playSoundEffect('confusao');
                 announceEffect('!OÃSUFNOC', 'reversus');
                 updateLog(`${player.name} começa no caminho verde e suas cartas foram confundidas!`);
                break;
            case 'yellow':
                const isVersatrixAI = player.aiType === 'versatrix';
                if (!isVersatrixAI) {
                    player.position = Math.max(1, player.position - 1);
                    updateLog(`${player.name} começa no caminho amarelo e recua para a casa ${player.position}.`);
                }
                break;
        }
    }
    
    renderAll();
}