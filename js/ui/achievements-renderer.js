import * as dom from '../core/dom.js';
import * as config from '../core/config.js';
import { getState } from '../core/state.js';

/**
 * Renders the content of the achievements modal.
 */
export function renderAchievementsModal() {
    const { achievements } = getState();
    const allAchievements = config.ACHIEVEMENTS;

    dom.achievementsGrid.innerHTML = Object.keys(allAchievements).map(id => {
        const achievement = allAchievements[id];
        const isUnlocked = achievements.has(id);
        
        const name = isUnlocked ? achievement.name : '???';
        let description = isUnlocked ? achievement.description : 'Desbloqueie esta conquista para ver os detalhes.';
        
        if (id === 'all_achievements' && isUnlocked) {
            description += ' - Senha da Sala 12: Final';
        }

        return `
            <div class="achievement-card ${isUnlocked ? 'unlocked' : ''}">
                <div class="achievement-icon">🏆</div>
                <h3 class="achievement-name">${name}</h3>
                <p class="achievement-description">${description}</p>
            </div>
        `;
    }).join('');
}
