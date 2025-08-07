import * as dom from '../core/dom.js';
import { getState, updateState } from '../core/state.js';
import { stopStoryMusic, updateMusic } from '../core/sound.js';
import { checkForSavedGame } from '../core/save-load.js';
import { checkAndShowSpecialFeatures } from '../core/achievements.js';
import { initializeFloatingItemsAnimation } from './animations.js';

export const showSplashScreen = () => {
    // Stop any ongoing game logic
    const { gameTimerInterval } = getState();
    if (gameTimerInterval) {
        clearInterval(gameTimerInterval);
        updateState('gameTimerInterval', null);
    }
    
    updateState('gameState', null);
    
    // Stop any special music
    stopStoryMusic();
    updateMusic(); // This will default to the menu music
    
    // Hide all game elements
    dom.appContainerEl.classList.add('hidden');
    dom.debugButton.classList.add('hidden');
    dom.xaelStarPowerButton.classList.add('hidden');

    // Hide all modals
    const modals = document.querySelectorAll('.modal-overlay');
    modals.forEach(modal => modal.classList.add('hidden'));

    // Show splash screen
    dom.splashScreenEl.classList.remove('hidden');
    initializeFloatingItemsAnimation(dom.splashAnimationContainerEl);
    
    // Check for saved game to enable/disable continue button
    checkForSavedGame();
    checkAndShowSpecialFeatures();
};
