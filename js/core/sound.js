import { getState, updateState } from './state.js';
import * as dom from './dom.js';
import * as config from './config.js';
import { toggleReversusTotalBackground } from '../ui/animations.js';

/**
 * Initializes the music player if it hasn't been already.
 */
export const initializeMusic = () => {
    const state = getState();
    if (state.isMusicInitialized) return;
    updateState('isMusicInitialized', true);
    updateMusic();
};

/**
 * Plays a sound effect corresponding to a card name or event.
 * @param {string} effectName - The name of the card, event, or effect.
 */
export const playSoundEffect = (effectName) => {
    const { soundState } = getState();
    if (soundState.muted) return;

    let sfxSrc;
    let player = dom.sfxPlayer;
    const wavEffects = ['conquista', 'confusao', 'campoinverso', 'x', 'destruido', 'xael', 'jogarcarta', 'coracao'];
    
    // Sanitize card names like "Reversus Total"
    const sanitizedEffectName = effectName.toLowerCase().replace(/\s/g, '');

    if (wavEffects.includes(sanitizedEffectName)) {
        sfxSrc = `${sanitizedEffectName}.wav`;
        if (sanitizedEffectName === 'xael' && dom.popupSfxPlayer) {
            player = dom.popupSfxPlayer;
        }
    } else {
        sfxSrc = sanitizedEffectName + '.ogg';
    }

    if (!player) return;
    player.src = sfxSrc;

    let volume = soundState.volume;

    const effectsToBoost = [
        'jogarcarta', 'mais', 'menos', 'sobe', 'desce', 'pula',
        'reversus', 'reversustotal', 'x', 'coracao'
    ];

    if (sanitizedEffectName === 'confusao') {
        // Specific boost for this sound effect based on user feedback.
        volume = Math.min(1.0, soundState.volume * 3.5);
    } else if (effectsToBoost.includes(sanitizedEffectName)) {
        // Boost volume significantly for game-play feedback sounds
        volume = Math.min(1.0, soundState.volume * 2.2); 
    } else if (sanitizedEffectName === 'xael') {
        // Special case for popups, can be same or different
        volume = Math.min(1.0, soundState.volume * 2.0);
    }
    
    player.volume = volume;
    player.play().catch(e => console.error(`Failed to play sound effect: ${sfxSrc}`, e));
};

/**
 * Processes the queue of announcements one by one.
 */
function processAnnouncementQueue() {
    const { isAnnouncing, announcementQueue } = getState();
    if (isAnnouncing || announcementQueue.length === 0) {
        return;
    }

    updateState('isAnnouncing', true);
    const announcement = announcementQueue.shift();

    if (announcement.type === 'inversus-total') {
        playSoundEffect('reversustotal');
    }

    dom.effectAnnouncerEl.textContent = announcement.text;
    dom.effectAnnouncerEl.className = 'effect-announcer-overlay'; // Reset
    dom.effectAnnouncerEl.classList.add(announcement.type);

    dom.effectAnnouncerEl.classList.remove('hidden');

    setTimeout(() => {
        dom.effectAnnouncerEl.classList.add('hidden');
        updateState('isAnnouncing', false);
        // Process the next item in the queue after a short delay
        setTimeout(processAnnouncementQueue, 200);
    }, announcement.duration);
}


/**
 * Displays a large text announcement on the screen for special effects by adding it to a queue.
 * @param {string} text - The text to announce.
 * @param {string} [type='default'] - The type of announcement (e.g., 'positive', 'negative', 'reversus').
 * @param {number} [duration=1500] - The duration of the announcement in milliseconds.
 */
export const announceEffect = (text, type = 'default', duration = 1500) => {
    // Legacy support for calling with card name
    if (type === 'default' && ['Mais', 'Sobe', 'Menos', 'Desce', 'Reversus', 'Reversus Total', 'Pula'].includes(text)) {
        const cardName = text;
        let animationDuration = 1500;

        switch (cardName) {
            case 'Mais': case 'Sobe': type = 'positive'; break;
            case 'Menos': case 'Desce': type = 'negative'; break;
            case 'Reversus': type = 'reversus'; animationDuration = 1800; break;
            case 'Reversus Total':
                toggleReversusTotalBackground(true);
                type = 'reversus-total';
                animationDuration = 2000;
                break;
            case 'Pula': type = 'default'; break; // Keep default yellow
        }
        duration = animationDuration;
    }
    
    const { announcementQueue } = getState();
    announcementQueue.push({ text, type, duration });
    processAnnouncementQueue();
};

/**
 * Plays a specific music track for story mode, optionally looping it.
 * @param {string} track - The filename of the music track.
 * @param {boolean} [loop=true] - Whether the track should loop.
 */
export const playStoryMusic = (track, loop = true) => {
    if (dom.musicPlayer.src && dom.musicPlayer.src.endsWith(track)) return;

    dom.musicPlayer.src = track;
    dom.musicPlayer.loop = loop;
    dom.nextTrackButton.disabled = true;
    updateMusic();
};

/**
 * Stops the current story music and reverts to the default playlist.
 */
export const stopStoryMusic = () => {
    const { currentTrackIndex } = getState();
    dom.nextTrackButton.disabled = false;
    dom.musicPlayer.src = config.MUSIC_TRACKS[currentTrackIndex];
    updateMusic();
};

/**
 * Updates the music player's state (playing/paused, volume) based on the global sound state.
 */
export const updateMusic = () => {
    const { soundState, isMusicInitialized } = getState();
    if (soundState.muted) {
        dom.musicPlayer.pause();
    } else {
        if (isMusicInitialized) {
            dom.musicPlayer.play().catch(e => console.error("Music play failed:", e));
        }
    }
    dom.musicPlayer.volume = soundState.volume;
};

/**
 * Changes the background music to the next track in the playlist.
 */
export const changeTrack = () => {
    let { currentTrackIndex } = getState();
    currentTrackIndex = (currentTrackIndex + 1) % config.MUSIC_TRACKS.length;
    updateState('currentTrackIndex', currentTrackIndex);
    dom.musicPlayer.src = config.MUSIC_TRACKS[currentTrackIndex];
    updateMusic();
};

/**
 * Toggles the mute state for all audio.
 */
export const toggleMute = () => {
    const { soundState } = getState();
    soundState.muted = !soundState.muted;
    dom.muteButton.classList.toggle('muted', soundState.muted);
    dom.muteButton.textContent = soundState.muted ? '▶' : '||';
    updateMusic();
};

/**
 * Sets the volume for all audio.
 * @param {number} value - The volume level (0.0 to 1.0).
 */
export const setVolume = (value) => {
    const { soundState } = getState();
    soundState.volume = value;
    dom.volumeSlider.value = String(value);
    updateMusic();
};