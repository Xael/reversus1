import { getState } from '../core/state.js';

export const storyDialogue = {
    'start_necroverso': {
        character: 'Necroverso', image: 'necroverso.png',
        music: 'interlude.ogg',
        text: 'Olá forasteiro... seja bem vindo! Você está no Inversus e eu sou o Necroverso. Se quiser voltar ao seu mundo deverá desafiar os soberanos deste lugar...',
        options: [{ text: 'Desafiar...?', next: 'pre_tutorial_prompt' }]
    },
    'pre_tutorial_prompt': {
        character: 'Necroverso', image: 'necroverso.png',
        text: 'Sim, através de um duelo! Eles jogam um jogo de cartas e tabuleiro chamado REVERSUS. Quer que eu te ensine o básico numa partida?',
        options: [
            { text: 'Sim, por favor.', next: 'tutorial_explain_1' },
            { text: 'Não, eu me viro.', next: 'tutorial_skip' }
        ]
    },
    'tutorial_skip': {
        character: 'Necroverso', image: 'necroverso.png',
        text: 'Provavelmente você é um prodígio... Boa sorte então. Enfrente então o Contravox.',
        isContinue: true,
        next: 'pre_contravox_intro'
    },
    'tutorial_explain_1': {
        character: 'Necroverso', image: 'necroverso.png',
        text: 'Ótimo. A regra principal é: tenha a maior pontuação no final da rodada para avançar no tabuleiro. Simples, certo?',
        next: 'tutorial_explain_2', isContinue: true
    },
    'tutorial_explain_2': {
        character: 'Necroverso', image: 'necroverso.png',
        text: 'Sua pontuação é a soma de duas cartas de VALOR que você joga. Se tiver 2 ou mais cartas de valor, você DEVE jogar uma. Se tiver só uma, ela permanece para a próxima rodada, a sua última carta jogada será seu "Resto".',
        next: 'tutorial_explain_3', isContinue: true
    },
    'tutorial_explain_3': {
        character: 'Necroverso', image: 'necroverso.png',
        text: 'As cartas de EFEITO podem mudar tudo! "Mais" e "Menos" usam o valor do seu "Resto" para aumentar ou diminuir sua pontuação. "Sobe", "Desce" e "Pula"  movem seu peão.',
        next: 'tutorial_explain_4', isContinue: true
    },
    'tutorial_explain_4': {
        character: 'Necroverso', image: 'necroverso.png',
        text: 'As cartas "Reversus" e "Reversus Total" são mais complexas e podem virar o jogo. Você aprenderá o poder delas na prática.',
        next: 'tutorial_explain_5', isContinue: true
    },
    'tutorial_explain_5': {
        character: 'Necroverso', image: 'necroverso.png',
        text: 'Chega de papo. Vamos jogar. Não pense em vencer, apenas em aprender as regras.',
        isEndStory: true,
        startGame: { battle: 'tutorial_necroverso' }
    },
    'tutorial_loss': {
        character: 'Necroverso', image: 'necroverso.png',
        text: 'Parece que você ainda não está pronto. Lembre-se, o objetivo é aprender. Vamos tentar de novo.',
        next: 'tutorial_explain_5', isContinue: true
    },
    'post_tutorial': {
        character: 'Necroverso', image: 'necroverso.png',
        text: 'E com isso finalizamos o tutorial... espero que tenha entendido tudo. Seu primeiro desafio real te aguarda.',
        options: [{ text: "Entendi!", next: 'pre_contravox_intro' }]
    },
    'pre_contravox_intro': {
        character: 'Necroverso', image: 'necroverso3.png',
        text: 'Vou te contar dois segredos sobre o Contravox para te ajudar no seu duelo...',
        options: [{ text: 'Dica é bom', next: 'pre_contravox_hint' }, { text: 'Não quero dicas', next: 'pre_contravox_hint' }]
    },
    'pre_contravox_hint': {
        character: 'Necroverso', image: 'necroverso3.png',
        text: 'Como eu sou legal vou te contar... Contravox é o mais fraco dos três... e ele tem uma habilidade especial... cuidado com ela!',
        options: [{ text: 'Isso era pra ser um segredo?', next: 'start_contravox' }, { text: 'Obrigado', next: 'start_contravox' }]
    },
    'start_contravox': {
        character: 'Contravox', image: 'contravox.png',
        text: '!recnev em áriugesnoc siamaj êcoV',
        options: [{ text: 'Zatanna?', next: 'contravox_end' }, { text: 'Não entendi nada...', next: 'contravox_end' }, { text: 'É hora do duelo!', next: 'contravox_end' }]
    },
    'contravox_end': {
        isEndStory: true,
        startGame: { battle: 'contravox' }
    },
    'post_contravox_victory': {
        character: 'Necroverso', image: 'necroverso.png',
        text: "Incrível... realmente você venceu o Contravox... faltam só mais dois agora, a próxima é Versatrix, mas cuidado... nem tudo é o que parece.",
        next: 'pre_versatrix_intro', isContinue: true
    },
    'pre_versatrix_intro': {
        character: 'Necroverso', image: 'necroverso3.png',
        text: 'A Versatrix é do signo de gêmeos... e ela é... valiosa!',
        options: [{ text: 'Certo... signos...', next: 'start_versatrix_dialogue' }, { text: 'Defina valiosa...', next: 'start_versatrix_dialogue' }]
    },
    'start_versatrix_dialogue': {
        character: 'Versatrix', image: 'versatrix.png',
        text: () => {
            const { achievements } = getState();
            return achievements.has('versatrix_card_collected') 
                ? "Eu tenhoa impressão que já nos encontramos em outra vida..."
                : "Eu não quero perder... mas caso me vença... ainda assim eu te ajudarei...";
        },
        options: () => {
             const { achievements } = getState();
             return achievements.has('versatrix_card_collected')
                ? [{ text: "Talvez...", next: 'versatrix_end_game' }]
                : [
                    { text: "Isto é ouro?", next: 'versatrix_sinto_muito' }, 
                    { text: "Você é solteira?", next: 'versatrix_solteira' }
                  ];
        }
    },
    'versatrix_end_game': {
         isEndStory: true, startGame: { battle: 'versatrix' }
    },
    'versatrix_sinto_muito': {
        character: 'Versatrix', image: 'versatrix.png',
        text: "Talvez ;)",
        isEndStory: true, startGame: { battle: 'versatrix' }
    },
    'versatrix_solteira': {
        character: 'Versatrix', image: 'versatrix.png',
        text: "Ah... seu interesseiro, vamos duelar logo!",
        isEndStory: true, startGame: { battle: 'versatrix' }
    },
    'post_versatrix_victory': {
        character: 'Necroverso', image: 'necroverso.png',
        text: "Agora só falta o mais difícil...",
        options: [{ text: "Quando eu venço eles... o que acontece?", next: 'post_versatrix_ask_return' }]
    },
    'post_versatrix_defeat': {
        character: 'Versatrix', image: 'versatrix.png',
        text: "Não se preocupe... eu vou te ajudar quando chegar o momento certo",
        options: [{ text: "Não entendi... eu perdi?", next: 'post_versatrix_victory' }, { text: "Eu ganhei?", next: 'post_versatrix_victory' }, { text: "Não entendi nada", next: 'post_versatrix_victory' }]
    },
    'post_versatrix_ask_return': {
        character: 'Necroverso', image: 'necroverso.png',
        text: "Você fica mais próximo de voltar ao seu mundo...\nVença o Rei Reversum e eu te darei a chance de retornar ao seu mundo",
        next: 'pre_reversum_intro', isContinue: true
    },
    'pre_reversum_intro': {
        character: 'Necroverso', image: 'necroverso3.png',
        text: 'Duas informações valiosas... ele é o mais poderoso e ele é imune ao vermelho!',
        options: [{ text: 'Isso deveria me ajudar?', next: 'start_reversum' }, { text: 'Espero que isso acabe logo', next: 'start_reversum' }]
    },
    'start_reversum': {
        character: 'Reversum', image: 'reversum.png',
        text: "EU SOU REX REVERSUM TOTEM! CURVE-SE DIANTE DO SEU REI!",
        options: [{ text: "Rex? tipo um cachorro?", next: 'reversum_end' }, { text: "Só quero zerar o jogo...", next: 'reversum_end' }, { text: "Leônidas?", next: 'reversum_end' }]
    },
    'reversum_end': {
        isEndStory: true,
        startGame: { battle: 'reversum' }
    },
    'post_reversum_victory': {
        character: 'Necroverso', image: 'necroversorevelado.png',
        text: "Finalmente com eles derrotados o Inversus me pertence.",
        options: [{ text: "Certo... e nosso acordo?", next: 'final_confrontation_1' }]
    },
    'final_confrontation_1': {
        character: 'Necroverso', image: 'necroversorevelado.png',
        text: "Eu não menti, darei a chance que retorne... porém, se me derrotar.",
        options: [{ 
            text: "Estava fácil demais...", 
            next: () => getState().storyState.lostToVersatrix ? 'versatrix_warning_1' : 'necroverso_king_battle' 
        }]
    },
    'necroverso_king_battle': {
        isEndStory: true,
        startGame: { battle: 'necroverso_king' }
    },
    'post_necroverso_king_victory': {
        character: 'Necroverso', image: 'necroverso2.png',
        text: "Você... me derrotou? Impossível! Mas você ainda não pode voltar. Falta meu teste final.",
        options: [{ text: "...", next: 'versatrix_warning_1' }]
    },
    'versatrix_warning_1': {
        character: 'Versatrix', image: 'versatrix.png',
        text: "Espere! Antes de enfrenta-lo fique sabendo, ele não pode ser vencido chegando apenas ao centro do tabuleiro primeiro... e não se deixe tocar por sua escuridão...",
        options: [{ text: "Escuridão...", next: 'versatrix_warning_2' }, { text: "Eu não sei o que fazer...", next: 'versatrix_warning_2' }]
    },
    'versatrix_warning_2': {
        character: 'Versatrix', image: 'versatrix.png',
        text: "Eu vou te ajudar... juntos venceremos!",
        options: [{ text: "Vamos!", next: 'pre_final_battle' }]
    },
    'pre_final_battle': {
        character: 'Necroverso', image: 'necroverso3.png',
        text: 'Duas dicas pra você... seu tempo acabou e não existe escapatória!',
        options: [{ text: 'Isso não me pareceu uma dica...', next: 'final_battle_final' }, { text: 'Ah saquei!', next: 'final_battle_final' }]
    },
    'final_battle_final': {
        isEndStory: true,
        startGame: { battle: 'necroverso_final' }
    },
    'xael_challenge_intro': {
        character: 'Xael',
        image: 'xaeldesafio.png',
        text: 'Então você aceita meu desafio! As regras aqui são diferentes. O objetivo é chegar à casa 10 com MAIS estrelas do que eu. Colete-as no tabuleiro e use seus efeitos com sabedoria. Pronto?',
        next: 'start_xael_challenge',
        isContinue: true
    },
    'start_xael_challenge': {
        isEndStory: true,
        startGame: { battle: 'xael_challenge' }
    }
};