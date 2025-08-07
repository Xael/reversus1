import * as dom from '../core/dom.js';
import * as config from '../core/config.js';
import { getState, updateState } from '../core/state.js';
import { shuffle } from '../core/utils.js';
import { playSoundEffect } from '../core/sound.js';

/**
 * Animates a card moving from a starting element (in hand) to a target slot (in a play zone).
 * @param {object} card - The card object being played.
 * @param {HTMLElement} startElement - The card element in the player's hand.
 * @param {string} targetPlayerId - The ID of the player whose play zone is the destination.
 * @param {string} targetSlotLabel - The data-label of the target slot (e.g., 'Valor 1').
 * @returns {Promise<void>} A promise that resolves when the animation is complete.
 */
export async function animateCardPlay(card, startElement, targetPlayerId, targetSlotLabel) {
     return new Promise(resolve => {
        const targetArea = document.getElementById(`player-area-${targetPlayerId}`);
        if (!targetArea) {
            resolve();
            return;
        }
        
        const targetSlot = targetArea.querySelector(`.play-zone-slot[data-label="${targetSlotLabel}"]`);
        if (!startElement || !targetSlot) {
            resolve();
            return;
        }

        const startRect = startElement.getBoundingClientRect();
        const endRect = targetSlot.getBoundingClientRect();

        const clone = document.createElement('div');
        clone.className = 'card card-animation-clone';
        clone.style.backgroundImage = startElement.style.backgroundImage;
        clone.style.width = `${startRect.width}px`;
        clone.style.height = `${startRect.height}px`;
        clone.style.top = `${startRect.top}px`;
        clone.style.left = `${startRect.left}px`;
        
        document.body.appendChild(clone);
        startElement.style.visibility = 'hidden';

        requestAnimationFrame(() => {
            clone.style.top = `${endRect.top}px`;
            clone.style.left = `${endRect.left}px`;
            clone.style.width = `${endRect.width}px`;
            clone.style.height = `${endRect.height}px`;
        });

        setTimeout(() => {
            clone.remove();
            if (startElement) startElement.style.visibility = 'visible';
            resolve();
        }, 600); // Duration must match the transition time in index.css
    });
}

/**
 * Creates a reusable starry background effect.
 * @param {HTMLElement} container - The element to add the stars to.
 * @param {string} [color='#FFFFFF'] - The color of the stars.
 * @param {number} [starCount=100] - The number of stars to generate.
 */
export function createStarryBackground(container, color = '#FFFFFF', starCount = 100) {
    if (!container) return;
    container.innerHTML = ''; // Clear previous stars

    for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        star.className = 'story-bg-star';
        star.style.color = color;
        const startX = `${Math.random() * 100}vw`, startY = `${Math.random() * 100}vh`;
        const endX = `${Math.random() * 100}vw`, endY = `${Math.random() * 100}vh`;
        star.style.setProperty('--start-x', startX);
        star.style.setProperty('--start-y', startY);
        star.style.setProperty('--end-x', endX);
        star.style.setProperty('--end-y', endY);
        star.style.top = startY;
        star.style.left = startX;
        star.style.animationDuration = `${Math.random() * 20 + 15}s`;
        star.style.animationDelay = `-${Math.random() * 35}s`;
        container.appendChild(star);
    }
}

/**
 * Creates the cosmic glow overlay for the Xael challenge.
 */
export function createCosmicGlowOverlay() {
    const container = dom.cosmicGlowOverlay;
    if (!container) return;
    container.innerHTML = ''; // Clear previous particles
    const colors = ['#e63946', '#00b4d8', '#52b788', '#fca311', '#9b5de5', '#f1faee'];
    
    for (let i = 0; i < 70; i++) {
        const particle = document.createElement('div');
        particle.className = 'star-particle';
        const size = Math.random() * 3 + 1;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.top = `${Math.random() * 100}%`;
        particle.style.left = `${Math.random() * 100}%`;
        const color = colors[Math.floor(Math.random() * colors.length)];
        particle.style.setProperty('--primary-color', color);
        particle.style.animationDelay = `${Math.random() * 4}s`;
        particle.style.animationDuration = `${Math.random() * 2 + 2}s`;
        container.appendChild(particle);
    }
    container.classList.remove('hidden');
}

/**
 * Triggers the animation for the Necro X ability.
 */
export const animateNecroX = () => {
    const { gameState } = getState();
    const overlay = document.getElementById('necro-x-animation-overlay');
    const casterImg = document.getElementById('necro-x-caster-img');

    if (overlay && casterImg) {
        casterImg.classList.toggle('final-boss-glow', gameState.isFinalBoss);
        overlay.classList.remove('hidden');
        setTimeout(() => overlay.classList.add('hidden'), 2500);
    }
};

/**
 * Creates and starts the falling animation for the secret Versatrix card on the splash screen.
 * This now uses a chained timeout to create a more reliable loop.
 */
const startVersatrixCardAnimation = () => {
    const { versatrixCardInterval } = getState();
    // Clear any previously running interval to prevent duplicates
    if (versatrixCardInterval) clearInterval(versatrixCardInterval);

    const fallDuration = 15000;
    const pauseDuration = 10000;
    const totalCycle = fallDuration + pauseDuration;

    const createCard = () => {
        // Prevent creating a new card if one is already falling
        if (document.getElementById('secret-versatrix-card')) return;
        
        const card = document.createElement('div');
        card.id = 'secret-versatrix-card';
        card.style.left = `${Math.random() * 80 + 10}vw`; // Avoid edges
        
        dom.splashAnimationContainerEl.appendChild(card);
        
        // Remove the card after its animation finishes
        setTimeout(() => {
            if (card.parentElement) {
                 card.remove();
            }
        }, fallDuration);
    };

    // Create the first card immediately, then set an interval for subsequent cycles
    createCard();
    const interval = setInterval(createCard, totalCycle);
    updateState('versatrixCardInterval', interval);
};


/**
 * Creates and starts the floating items animation for the splash screen or Reversus Total effect.
 * @param {HTMLElement} containerEl - The container element to fill with animated items.
 */
export const initializeFloatingItemsAnimation = (containerEl) => {
    containerEl.innerHTML = '';
    const { achievements } = getState();
    
    // Check for secret card unlock condition
    if (achievements.has('versatrix_win') && !achievements.has('versatrix_card_collected')) {
        startVersatrixCardAnimation();
    }

    // Pool of card images
    const imagePool = [...config.BASE_CARD_IMAGES];
    if (achievements.has('true_end_beta')) {
        imagePool.push(...config.BOSS_CARD_IMAGES);
    }

    // Pool of effect names
    const effectNamePool = config.EFFECT_DECK_CONFIG.map(item => item.name);

    const itemsToCreate = [];
    const totalItems = 30;
    const numCards = 15;

    for (let i = 0; i < totalItems; i++) {
        itemsToCreate.push({ type: i < numCards ? 'card' : 'text' });
    }

    shuffle(itemsToCreate);

    for (const itemConfig of itemsToCreate) {
        const item = document.createElement('div');
        item.classList.add('animated-item');
        
        if (itemConfig.type === 'card') {
            item.classList.add('card-shape');
            const imageUrl = imagePool[Math.floor(Math.random() * imagePool.length)];
            item.style.backgroundImage = `url('./${imageUrl}')`;
            const size = Math.random() * 60 + 50; // 50px to 110px width
            item.style.width = `${size}px`;
            item.style.height = `${size * 1.4}px`;
        } else { // type === 'text'
            item.classList.add('text-shape');
            const effectName = effectNamePool[Math.floor(Math.random() * effectNamePool.length)];
            item.textContent = effectName;
            const fontSize = Math.random() * 1.5 + 1; // 1rem to 2.5rem
            item.style.fontSize = `${fontSize}rem`;


            // Add color classes based on effect name from CSS
            switch (effectName) {
                case 'Mais':
                case 'Sobe':
                    item.classList.add('positive');
                    break;
                case 'Menos':
                case 'Desce':
                    item.classList.add('negative');
                    break;
                case 'Pula':
                    item.classList.add('pula');
                    break;
                case 'Reversus':
                    item.classList.add('reversus');
                    break;
                case 'Reversus Total':
                    item.classList.add('reversus-total');
                    break;
            }
        }

        item.style.left = `${Math.random() * 100}vw`;
        const duration = Math.random() * 25 + 15; // 15-40 seconds
        item.style.animationDuration = `${duration}s`;
        item.style.animationDelay = `-${Math.random() * duration}s`;

        containerEl.appendChild(item);
    }
};

/**
 * Toggles the visibility and animation of the Reversus Total background effect.
 * @param {boolean} isActive - Whether to activate or deactivate the effect.
 */
export const toggleReversusTotalBackground = (isActive) => {
    if (isActive) {
        initializeFloatingItemsAnimation(dom.reversusTotalBgAnimationEl);
        dom.reversusTotalBgAnimationEl.classList.remove('hidden');
    } else {
        dom.reversusTotalBgAnimationEl.classList.add('hidden');
        dom.reversusTotalBgAnimationEl.innerHTML = '';
    }
};

/**
 * Creates a shattering effect for an image element.
 * @param {HTMLElement} imageEl - The image element to shatter.
 * @returns {Promise<void>} A promise that resolves when the animation is complete.
 */
export async function shatterImage(imageEl) {
    if (!imageEl || !imageEl.parentNode) return;
    
    // Play sound immediately
    playSoundEffect('destruido');

    // Wait for the next frame to ensure dimensions are available.
    return new Promise(resolve => {
        requestAnimationFrame(() => {
            const parent = imageEl.parentNode;
            const rect = imageEl.getBoundingClientRect();

            // If the image isn't visible or has no size, we can't shatter it.
            // Just resolve the promise after the sound has had time to play.
            if (rect.width === 0 || rect.height === 0) {
                console.warn('Shatter animation skipped: image has no dimensions.', imageEl);
                setTimeout(resolve, 500); // Give sound time to play
                return;
            }

            // Create a container for the particles at the same position as the image
            const container = document.createElement('div');
            container.className = 'shatter-container';
            container.style.position = 'absolute';
            const parentRect = parent.getBoundingClientRect();
            container.style.left = `${rect.left - parentRect.left}px`;
            container.style.top = `${rect.top - parentRect.top}px`;
            container.style.width = `${rect.width}px`;
            container.style.height = `${rect.height}px`;

            parent.appendChild(container);
            imageEl.style.opacity = '0'; // Hide the original image

            const particles = [];
            const rows = 10, cols = 10;

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const particle = document.createElement('div');
                    particle.className = 'shatter-particle';
                    particle.style.backgroundImage = `url(${imageEl.src})`;
                    particle.style.backgroundPosition = `${c * 100 / (cols - 1)}% ${r * 100 / (rows - 1)}%`;
                    container.appendChild(particle);
                    particles.push(particle);
                }
            }

            // Animate particles flying out in the next frame for performance
            requestAnimationFrame(() => {
                particles.forEach(p => {
                    const x = (Math.random() - 0.5) * window.innerWidth * 1.5;
                    const y = (Math.random() - 0.5) * window.innerHeight * 1.5;
                    const rot = (Math.random() - 0.5) * 720;
                    p.style.transform = `translate(${x}px, ${y}px) rotate(${rot}deg)`;
                    p.style.opacity = '0';
                });
            });

            // Wait for animation to finish then clean up
            setTimeout(() => {
                if (container.parentNode) {
                    container.remove();
                }
                resolve();
            }, 1500); // Corresponds to the animation duration in CSS
        });
    });
}


/**
 * Shows a special victory animation for defeating Inversus.
 */
export function showInversusVictoryAnimation() {
    // Hide game elements
    dom.appContainerEl.classList.add('hidden');
    dom.debugButton.classList.add('hidden');
    dom.gameOverModal.classList.add('hidden');

    // Reuse splash screen elements for the animation
    const containerEl = dom.splashAnimationContainerEl;
    dom.splashScreenEl.classList.remove('hidden');
    containerEl.innerHTML = ''; // Clear previous animations
    dom.splashScreenEl.querySelector('.splash-content').classList.add('hidden'); // Hide buttons/logo
    
    // Create the background
    createStarryBackground(containerEl, '#FFFFFF', 150);

    // Define items for the victory animation
    const victoryCards = config.BOSS_CARD_IMAGES;
    const victoryText = ['OÃSUFNOC', 'CAMPO VERSÁTIL', 'REVERSUS TOTAL', 'NECRO X'];
    const itemsToCreate = [];
    const totalItems = 25;

    for (let i = 0; i < totalItems; i++) {
        itemsToCreate.push({ type: Math.random() > 0.4 ? 'card' : 'text' });
    }
    shuffle(itemsToCreate);

    // Create and animate the items
    for (const itemConfig of itemsToCreate) {
        const item = document.createElement('div');
        item.classList.add('animated-item');

        if (itemConfig.type === 'card') {
            item.classList.add('card-shape');
            const imageUrl = victoryCards[Math.floor(Math.random() * victoryCards.length)];
            item.style.backgroundImage = `url('./${imageUrl}')`;
            const size = Math.random() * 80 + 70; // 70px to 150px
            item.style.width = `${size}px`;
            item.style.height = `${size * 1.4}px`;
        } else {
            item.classList.add('text-shape');
            const effectName = victoryText[Math.floor(Math.random() * victoryText.length)];
            item.textContent = effectName;
            item.style.fontSize = `${Math.random() * 2 + 1.5}rem`; // 1.5rem to 3.5rem
            item.classList.add('reversus-total'); // Use a nice glow effect
        }

        item.style.left = `${Math.random() * 100}vw`;
        const duration = Math.random() * 20 + 10; // 10-30 seconds
        item.style.animationDuration = `${duration}s`;
        item.style.animationDelay = `-${Math.random() * duration}s`;
        containerEl.appendChild(item);
    }

    // Return to main menu after a delay
    setTimeout(() => {
        dom.splashScreenEl.querySelector('.splash-content').classList.remove('hidden');
        document.dispatchEvent(new Event('showSplashScreen'));
    }, 15000); // Show animation for 15 seconds
}
