import * as dom from '../core/dom.js';

/**
 * Shows a toast notification for an unlocked achievement.
 * This is now in its own module to prevent circular dependencies.
 * @param {object} achievementData - The data for the unlocked achievement.
 * @param {string} [overrideDescription=''] - An optional override for the description text.
 */
export const showAchievementNotification = (achievementData, overrideDescription = '') => {
    dom.toastText.textContent = `${achievementData.name}: ${overrideDescription || achievementData.description}`;
    dom.achievementUnlockedToast.classList.remove('hidden');

    // Automatically hide after the CSS animation completes.
    setTimeout(() => {
        dom.achievementUnlockedToast.classList.add('hidden');
    }, 4500); // This duration must match the 'toast-in-down-out' animation in index.css.
};
