import * as dom from '../core/dom.js';
import * as config from '../core/config.js';
import { getState } from '../core/state.js';

/**
 * Renders the game board, including paths, spaces, and player pawns.
 */
export const renderBoard = () => {
    const { gameState } = getState();
    if (!gameState) return;
    
    dom.boardEl.innerHTML = ''; // Clear previous board state
    const centerPawnsContainer = document.createElement('div');
    centerPawnsContainer.className = 'board-center-pawns';

    gameState.boardPaths.forEach((path, index) => {
        const pathEl = document.createElement('div');
        pathEl.className = 'player-path';
        pathEl.style.transform = `translateX(-50%) rotate(${index * (360 / config.NUM_PATHS)}deg)`;
        
        path.spaces.forEach(space => {
            const spaceEl = document.createElement('div');
            spaceEl.className = `board-space space-${space.color}`;
            if(space.isUsed) spaceEl.classList.add('used');
            
            // Create a dedicated span for the number to ensure it's rendered correctly.
            const numberEl = document.createElement('span');
            numberEl.className = 'space-number';

            if (space.color === 'star') {
                numberEl.innerHTML = '⭐';
                numberEl.classList.add('star-icon');
            } else {
                numberEl.textContent = space.id;
            }
            spaceEl.appendChild(numberEl);

            if (space.hasHeart) {
                const heartEl = document.createElement('div');
                heartEl.className = 'space-heart';
                heartEl.textContent = '❤';
                spaceEl.appendChild(heartEl);
            }
            
            pathEl.appendChild(spaceEl);
        });
        dom.boardEl.appendChild(pathEl);
    });
    
    // Position pawns after the board structure is fully built.
    const pawnContainerParent = document.createElement('div');
    pawnContainerParent.className = 'board-pawns-overlay';

    gameState.playerIdsInGame.forEach(id => {
        const player = gameState.players[id];
        if (player.isEliminated) return;
        
        const pawnEl = document.createElement('div');
        pawnEl.className = `pawn ${id}`;
        if(player.aiType === 'necroverso_final' || player.aiType === 'necroverso_king' || player.aiType === 'necroverso_tutorial') pawnEl.classList.add('necro');
        if(player.aiType === 'xael') pawnEl.classList.add('xael');

        if (player.position >= config.WINNING_POSITION) {
            centerPawnsContainer.appendChild(pawnEl);
        } else if (player.pathId !== -1) {
            const pathEl = dom.boardEl.children[player.pathId];
            if(pathEl){
                const spaceEl = pathEl.children[player.position - 1];
                // Append the pawn directly to the space element. CSS will handle layering.
                if (spaceEl) {
                    spaceEl.appendChild(pawnEl);
                }
            }
        }
    });

    dom.boardEl.appendChild(centerPawnsContainer);
};