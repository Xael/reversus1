/**
 * Creates a deck of cards based on a configuration object.
 * @param {Array<object>} config - The configuration for the deck.
 * @param {string} cardType - The type of card ('value' or 'effect').
 * @returns {Array<object>} A new array of card objects.
 */
export const createDeck = (config, cardType) => {
    let idCounter = 0;
    return config.flatMap(item => Array.from({ length: item.count }, () => {
        const cardData = 'value' in item ? { name: item.value, value: item.value } : { name: item.name };
        return { id: Date.now() + Math.random() + idCounter++, type: cardType, ...cardData };
    }));
};