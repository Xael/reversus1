// A IA do Gemini foi desativada para a lógica do jogo e para o chat, conforme solicitado.
// A lógica do oponente agora é baseada em regras.

/**
 * Retorna uma resposta fixa indicando que o chat de IA está desativado.
 * @returns {Promise<string>} Uma string de resposta.
 */
export async function getAiChatResponse() {
    console.log("Tentativa de chamar getAiChatResponse, mas a IA está desativada.");
    return Promise.resolve("O chat com a IA está temporariamente desativado.");
}