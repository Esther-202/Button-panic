// ======================================================
// BUTTON PANIC! 🚨
// COMPLETE GAME ENGINE
// ======================================================


// ======================================================
// 1. SUPABASE INITIALIZATION
// ======================================================

const SUPABASE_URL = 'https://vzehtaigujsdlexzvais.supabase.co';

const SUPABASE_ANON_KEY = 'sb_publishable_MFVbyq7BLYggFxiTOanlZw_zmcdPghr';

let supabaseClient = null;

try {
    if (window.supabase) {
        supabaseClient = window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_ANON_KEY
        );
    }
} catch (error) {
    console.error("Supabase initialization failed:", error);
}


// ======================================================
// 2. AUDIO SYSTEM
// ======================================================

let audioCtx = null;

function playSound(type) {

    try {

        const AudioContextClass =
            window.AudioContext || window.webkitAudioContext;

        if (!AudioContextClass) return;

        if (!audioCtx) {
            audioCtx = new AudioContextClass();
        }

        if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.connect(gain);
        gain.connect(audioCtx.destination);

        const now = audioCtx.currentTime;

        if (type === 'tap') {

            osc.type = 'triangle';

            osc.frequency.setValueAtTime(300, now);

            osc.frequency.exponentialRampToValueAtTime(
                150,
                now + 0.08
            );

            gain.gain.setValueAtTime(0.3, now);

            gain.gain.linearRampToValueAtTime(
                0.01,
                now + 0.08
            );

            osc.start(now);
            osc.stop(now + 0.08);

        }

        else if (type === 'success') {

            osc.type = 'sine';

            osc.frequency.setValueAtTime(523.25, now);

            osc.frequency.setValueAtTime(
                659.25,
                now + 0.08
            );

            gain.gain.setValueAtTime(0.2, now);

            gain.gain.linearRampToValueAtTime(
                0.01,
                now + 0.2
            );

            osc.start(now);
            osc.stop(now + 0.2);

        }

        else if (type === 'fail') {

            osc.type = 'sawtooth';

            osc.frequency.setValueAtTime(180, now);

            osc.frequency.linearRampToValueAtTime(
                80,
                now + 0.3
            );

            gain.gain.setValueAtTime(0.3, now);

            gain.gain.linearRampToValueAtTime(
                0.01,
                now + 0.3
            );

            osc.start(now);
            osc.stop(now + 0.3);
        }

    } catch (error) {

        console.warn("Audio unavailable:", error);

    }
}


// ======================================================
// 3. GAME VARIABLES
// ======================================================

let score = 0;
let lives = 3;

let highScore = 0;

try {
    highScore = Number(
        localStorage.getItem('buttonPanicBest') || 0
    );
} catch (error) {
    console.warn("Local storage unavailable");
}

let currentInstruction = null;

let timer = null;
let holdTimer = null;

let roundTime = 3000;

let pressCount = 0;

let roundResolved = false;

let isHolding = false;

let gameStarted = false;


// Multiplayer variables

let currentChallengeId = null;

let currentSeed = null;

let currentPlayerSlot = 'player_a';

let playerNickname = '';

let rng = Math.random;

let opponentCheckInterval = null;

let opponentCheckTimeout = null;


// ======================================================
// 4. SEEDED RANDOM NUMBER GENERATOR
// ======================================================

function createSeededRNG(seed) {

    let s = seed >>> 0;

    return function() {

        s = (s * 1664525 + 1013904223) >>> 0;

        return s / 4294967296;

    };

}


// ======================================================
// 5. HTML ELEMENTS
// ======================================================

const scoreEl = document.getElementById('score');

const livesEl = document.getElementById('lives');

const highScoreEl = document.getElementById('highScore');

const instructionEl = document.getElementById('instruction');

const timerBar = document.getElementById('timerBar');

const panicBtn = document.getElementById('panicBtn');

const btnLabel = document.getElementById('btnLabel');

const modeBadge = document.getElementById('modeBadge');

const startOverlay = document.getElementById('startOverlay');

const gameOverOverlay = document.getElementById('gameOverOverlay');

const finalScoreEl = document.getElementById('finalScore');

const tauntText = document.getElementById('tauntText');

const challengeModal = document.getElementById('challengeModal');

const stepCreate = document.getElementById('stepCreate');

const stepShare = document.getElementById('stepShare');

const stepCode = document.getElementById('stepCode');

const stepJoin = document.getElementById('stepJoin');

const stepWaiting = document.getElementById('stepWaiting');

const stepResults = document.getElementById('stepResults');


// Check required elements

if (
    !scoreEl ||
    !livesEl ||
    !panicBtn ||
    !instructionEl ||
    !timerBar
) {
    throw new Error(
        "Button Panic: Required HTML elements are missing."
    );
}


// ======================================================
// 6. INITIAL DISPLAY
// ======================================================

highScoreEl.textContent = highScore;

updateLivesDisplay();


// ======================================================
// 7. GAME INSTRUCTIONS
// ======================================================

const taunts = [

    "Your fingers moved faster than your brain! 😂",

    "The button tricked you! 🧠💥",

    "Patience is a virtue... which you lack! ⏳",

    "It literally said DON'T press it! 🤦‍♂️",

    "Nice try! Give it another shot."

];


const instructionsList = [

    {
        text: "PRESS IT!",
        type: "press_single",
        duration: 2500
    },

    {
        text: "DON'T PRESS IT!",
        type: "do_nothing",
        duration: 2200
    },

    {
        text: "PRESS TWICE!",
        type: "press_double",
        duration: 2500
    },

    {
        text: "HOLD IT DOWN!",
        type: "hold",
        duration: 3000
    },

    {
        text: "IGNORE THIS: DON'T PRESS!",
        type: "press_single",
        duration: 2500
    },

    {
        text: "TOUCH WHEN GREEN!",
        type: "color_green",
        duration: 2800
    },

    {
        text: "WHATEVER YOU DO, DON'T TOUCH!",
        type: "do_nothing",
        duration: 2000
    },

    {
        text: "QUICK! TAP IT!",
        type: "press_single",
        duration: 1800
    },

    {
        text: "TRIPLE TAP!",
        type: "press_triple",
        duration: 2800
    }

];


const buttonColors = [

    'red',
    'green',
    'blue',
    'yellow'

];


// ======================================================
// 7b. DIFFICULTY LEVELS
// MEDIUM is the original game, completely unchanged.
// ======================================================

const DIFFICULTIES = {

    easy:   { label: 'EASY',   timeFactor: 1.4, points: 5,  color: '#22c55e' },

    medium: { label: 'MEDIUM', timeFactor: 1,   points: 10, color: '#38bdf8' },

    hard:   { label: 'HARD',   timeFactor: 0.7, points: 20, color: '#ef4444' }

};

// Extra rounds that only appear on HARD
const hardExtraInstructions = [

    { text: "PRESS 4 TIMES!", type: "press_n", count: 4, duration: 2800 },

    { text: "PRESS 5 TIMES!", type: "press_n", count: 5, duration: 3000 },

    { text: "NEVER TOUCH IT!", type: "do_nothing", duration: 1800 }

];

let difficultyKey = 'medium';

let roundsWon = 0;

let gameStartTime = 0;

let clientGameId = null;


// Friend challenges always use MEDIUM so both players get identical rounds
function activeDifficultyKey() {

    return currentChallengeId ? 'medium' : difficultyKey;

}

function activeDifficulty() {

    return DIFFICULTIES[activeDifficultyKey()];

}

function getInstructionPool() {

    const key = activeDifficultyKey();

    if (key === 'easy') {

        return instructionsList.filter(item =>
            ['press_single', 'do_nothing', 'press_double', 'hold'].includes(item.type) &&
            !/^(IGNORE|WHATEVER)/.test(item.text)
        );

    }

    if (key === 'hard') {

        return instructionsList.concat(hardExtraInstructions);

    }

    return instructionsList;

}

function bestScoreKey() {

    const key = activeDifficultyKey();

    return key === 'medium' ? 'buttonPanicBest' : 'buttonPanicBest_' + key;

}

function setDifficulty(key) {

    if (!DIFFICULTIES[key]) return;

    difficultyKey = key;

    try {
        localStorage.setItem('bpDifficulty', key);
    } catch (error) {}

    try {
        highScore = Number(localStorage.getItem(bestScoreKey()) || 0);
    } catch (error) {
        highScore = 0;
    }

    highScoreEl.textContent = highScore;

}

function makeGameId() {

    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();

    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });

}


// ======================================================
// 8. BUTTON COLOR MANAGEMENT
// ======================================================

function setButtonColor(color) {

    panicBtn.classList.remove(
        'red',
        'green',
        'blue',
        'yellow'
    );

    panicBtn.classList.add(color);

}


// ======================================================
// 9. LIVES DISPLAY
// ======================================================

function updateLivesDisplay() {

    livesEl.textContent =
        '❤️'.repeat(Math.max(0, lives));

}


// ======================================================
// 10. TIMER MANAGEMENT
// ======================================================

function stopRoundTimer() {

    clearTimeout(timer);

    clearTimeout(holdTimer);

    timer = null;

    holdTimer = null;

}


function startTimer(duration) {

    timerBar.style.transition = 'none';

    timerBar.style.transform = 'scaleX(1)';

    requestAnimationFrame(() => {

        requestAnimationFrame(() => {

            timerBar.style.transition =
                `transform ${duration}ms linear`;

            timerBar.style.transform = 'scaleX(0)';

        });

    });

    timer = setTimeout(() => {

        evaluateTimeout();

    }, duration);

}


// ======================================================
// 11. START A NEW ROUND
// ======================================================

function startRound() {

    if (!gameStarted) return;

    stopRoundTimer();

    roundResolved = false;

    pressCount = 0;

    isHolding = false;

    panicBtn.classList.remove('pressed');


    // Select instruction

    const pool = getInstructionPool();

    const index = Math.floor(
        rng() * pool.length
    );

    currentInstruction = pool[index];

    instructionEl.textContent =
        currentInstruction.text;


    // Select button color

    if (currentInstruction.type === 'color_green') {

        const colors = [
            'red',
            'blue',
            'yellow',
            'green'
        ];

        const selectedColor = colors[
            Math.floor(rng() * colors.length)
        ];

        setButtonColor(selectedColor);

    } else {

        const randomColor = buttonColors[
            Math.floor(rng() * buttonColors.length)
        ];

        setButtonColor(randomColor);

    }


    // Increase difficulty as score increases

    const speedFactor = Math.max(
        0.5,
        1 - ((roundsWon * 10) * 0.02)
    );

    roundTime =
        currentInstruction.duration *
        speedFactor *
        activeDifficulty().timeFactor;


    // Start timer

    startTimer(roundTime);

}


// ======================================================
// 12. ROUND SUCCESS OR FAILURE
// ======================================================

function resolveRound(success) {

    if (roundResolved || !gameStarted) return;

    roundResolved = true;

    stopRoundTimer();


    if (success) {

        playSound('success');

        score += activeDifficulty().points;

        roundsWon++;

        scoreEl.textContent = score;


        // Update solo high score

        if (!currentChallengeId && score > highScore) {

            highScore = score;

            highScoreEl.textContent = highScore;

            try {

                localStorage.setItem(
                    bestScoreKey(),
                    highScore
                );

            } catch (error) {

                console.warn("Could not save high score");

            }

        }

    } else {

        playSound('fail');

        lives--;

        updateLivesDisplay();

        document.body.classList.add('shake');

        setTimeout(() => {

            document.body.classList.remove('shake');

        }, 300);

    }


    // Check game over

    if (lives <= 0) {

        endGame();

        return;

    }


    // Continue playing

    startRound();

}


// ======================================================
// 13. TIMER EXPIRATION LOGIC
// ======================================================

function evaluateTimeout() {

    if (roundResolved || !gameStarted) return;


    if (currentInstruction.type === 'do_nothing') {

        resolveRound(true);

    }

    else if (currentInstruction.type === 'color_green') {

        const isGreen =
            panicBtn.classList.contains('green');

        resolveRound(!isGreen);

    }

    else {

        resolveRound(false);

    }

}


// ======================================================
// 14. BUTTON PRESS LOGIC
// ======================================================

function handleBtnPress() {

    if (roundResolved || !gameStarted) return;

    playSound('tap');

    pressCount++;


    switch (currentInstruction.type) {


        case 'press_single':

            resolveRound(true);

            break;


        case 'do_nothing':

            resolveRound(false);

            break;


        case 'color_green':

            const isGreen =
                panicBtn.classList.contains('green');

            resolveRound(isGreen);

            break;


        case 'press_double':

            if (pressCount === 2) {

                resolveRound(true);

            }

            break;


        case 'press_triple':

            if (pressCount === 3) {

                resolveRound(true);

            }

            break;


        case 'press_n':

            if (pressCount === currentInstruction.count) {

                resolveRound(true);

            }

            break;


        case 'hold':

            // Holding is handled separately.

            break;


    }

}


// ======================================================
// 15. IMPROVED MOBILE AND DESKTOP BUTTON EVENTS
// ======================================================

panicBtn.style.touchAction = 'none';


panicBtn.addEventListener('pointerdown', (e) => {

    e.preventDefault();

    if (roundResolved || !gameStarted) return;


    panicBtn.classList.add('pressed');


    // Keep tracking the finger or mouse

    try {

        panicBtn.setPointerCapture(e.pointerId);

    } catch (error) {

        console.warn("Pointer capture unavailable");

    }


    // Special HOLD instruction

    if (currentInstruction.type === 'hold') {

        playSound('tap');

        holdTimer = setTimeout(() => {

            if (!roundResolved && gameStarted) {

                isHolding = true;

                resolveRound(true);

            }

        }, 1000);

        return;

    }


    // Normal button instructions

    handleBtnPress();

});


// Release button

function releasePanicButton() {

    panicBtn.classList.remove('pressed');

    if (
        currentInstruction &&
        currentInstruction.type === 'hold' &&
        !isHolding
    ) {

        clearTimeout(holdTimer);

    }

}


panicBtn.addEventListener(
    'pointerup',
    releasePanicButton
);


panicBtn.addEventListener(
    'pointercancel',
    releasePanicButton
);


panicBtn.addEventListener(
    'lostpointercapture',
    releasePanicButton
);


// ======================================================
// 16. START GAME
// ======================================================

function startGame() {

    stopRoundTimer();

    score = 0;

    lives = 3;

    pressCount = 0;

    roundResolved = false;

    isHolding = false;

    gameStarted = true;

    roundsWon = 0;

    gameStartTime = Date.now();

    clientGameId = makeGameId();

    // Show the selected difficulty during solo play
    if (!currentChallengeId) {

        modeBadge.textContent =
            'SOLO MODE · ' + activeDifficulty().label;

        modeBadge.style.color = activeDifficulty().color;

    }


    scoreEl.textContent = '0';

    updateLivesDisplay();


    startOverlay.classList.add('hidden');

    gameOverOverlay.classList.add('hidden');

    challengeModal.classList.add('hidden');


    // Initialize random sequence

    if (currentSeed !== null) {

        rng = createSeededRNG(currentSeed);

    } else {

        rng = Math.random;

    }


    // Start the first round

    startRound();

}


// ======================================================
// 17. END GAME
// ======================================================

function endGame() {

    gameStarted = false;

    stopRoundTimer();

    panicBtn.classList.remove('pressed');


    // Tell the accounts system the game is over (optional add-on)
    try {

        if (window.BPFeatures && window.BPFeatures.onGameEnd) {

            window.BPFeatures.onGameEnd({
                clientGameId: clientGameId,
                difficulty: activeDifficultyKey(),
                mode: currentChallengeId ? 'challenge' : 'solo',
                roundsWon: roundsWon,
                score: score,
                livesLeft: Math.max(0, lives),
                durationMs: Date.now() - gameStartTime,
                challengeId: currentChallengeId
            });

        }

    } catch (error) {

        console.warn("Features hook failed:", error);

    }


    if (currentChallengeId) {

        submitChallengeResults();

        return;

    }


    finalScoreEl.textContent = score;


    const randomTaunt = Math.floor(
        Math.random() * taunts.length
    );

    tauntText.textContent = taunts[randomTaunt];


    gameOverOverlay.classList.remove('hidden');

}


// ======================================================
// 18. GAME BUTTONS
// ======================================================

document.getElementById('startBtn').addEventListener(
    'click',
    startGame
);


document.getElementById('restartBtn').addEventListener(
    'click',
    startGame
);


// ======================================================
// 19. CHALLENGE MODAL MANAGEMENT
// ======================================================

function showModalStep(step) {

    [
        stepCreate,
        stepShare,
        stepCode,
        stepJoin,
        stepWaiting,
        stepResults

    ].forEach(s => {

        s.classList.add('hidden');

    });


    step.classList.remove('hidden');

}


document.getElementById('challengeBtn').addEventListener(
    'click',
    () => {

        challengeModal.classList.remove('hidden');

        showModalStep(stepCreate);

    }
);


document.getElementById('closeModalBtn').addEventListener(
    'click',
    () => {

        challengeModal.classList.add('hidden');

    }
);


// ======================================================
// 20. READ MULTIPLAYER INVITATION LINK
// ======================================================

function readChallengeLink() {

    const params = new URLSearchParams(
        window.location.search
    );

    const challenge = params.get('challenge');

    const slot = params.get('slot');

    const seed = params.get('seed');


    if (!challenge || !slot || seed === null) return;


    const parsedSeed = Number(seed);


    if (
        !Number.isSafeInteger(parsedSeed) ||
        parsedSeed < 0 ||
        parsedSeed > 4294967295 ||
        !['player_a', 'player_b'].includes(slot)
    ) {

        alert("This challenge link is invalid.");

        return;

    }


    currentChallengeId = challenge;

    currentPlayerSlot = slot;

    currentSeed = parsedSeed;


    modeBadge.textContent =
        "⚔️ MULTIPLAYER CHALLENGE";

    modeBadge.style.color = "#eab308";


    challengeModal.classList.remove('hidden');

    showModalStep(stepJoin);

}


// ======================================================
// 20b. JOIN A CHALLENGE USING A CODE
// ======================================================

document.getElementById('joinCodeBtn').addEventListener(
    'click',
    () => {

        challengeModal.classList.remove('hidden');

        showModalStep(stepCode);

    }
);


document.getElementById('findChallengeBtn').addEventListener(
    'click',
    async () => {

        let code = document
            .getElementById('joinCodeInput')
            .value.trim().toUpperCase();

        if (!code) {

            alert("Please enter the challenge code!");

            return;

        }

        if (!code.startsWith('BP-')) code = 'BP-' + code;

        if (!supabaseClient) {

            alert("Unable to connect to the game server. Please try again.");

            return;

        }

        const findButton =
            document.getElementById('findChallengeBtn');

        findButton.disabled = true;

        findButton.textContent = "Searching...";

        try {

            const { data, error } = await supabaseClient

                .from('challenges')

                .select('id, seed')

                .eq('challenge_code', code)

                .order('created_at', { ascending: false })

                .limit(1);

            if (error) throw error;

            if (!data || data.length === 0) {

                throw new Error("No challenge found with that code.");

            }

            currentChallengeId = data[0].id;

            currentSeed = Number(data[0].seed);

            currentPlayerSlot = 'player_b';

            modeBadge.textContent = "⚔️ MULTIPLAYER CHALLENGE";

            modeBadge.style.color = "#eab308";

            showModalStep(stepJoin);

        } catch (error) {

            console.error("Finding challenge failed:", error);

            alert(error.message || "Could not find that challenge.");

        } finally {

            findButton.disabled = false;

            findButton.textContent = "Find Challenge";

        }

    }
);



// ======================================================
// 21. CREATE MULTIPLAYER CHALLENGE
// ======================================================

document.getElementById('createInviteBtn').addEventListener(
    'click',
    async () => {

        const nick = document
            .getElementById('playerNickname')
            .value.trim();


        if (!nick) {

            alert("Please enter your nickname!");

            return;

        }


        if (!supabaseClient) {

            alert(
                "Unable to connect to the game server. Please try again."
            );

            return;

        }


        const createButton =
            document.getElementById('createInviteBtn');

        createButton.disabled = true;

        createButton.textContent = "Creating challenge...";


        try {

            playerNickname = nick;

            currentSeed = Math.floor(
                Math.random() * 1000000
            );

            const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

            let suffix = '';

            for (let i = 0; i < 4; i++) {
                suffix += letters[Math.floor(Math.random() * letters.length)];
            }

            const code = 'BP-' + suffix;


            // Create challenge in Supabase

            const { data: challenge, error } = await supabaseClient

                .from('challenges')

                .insert([{

                    challenge_code: code,

                    seed: currentSeed

                }])

                .select()

                .single();


            if (error) throw error;

            if (!challenge) {

                throw new Error(
                    "Challenge could not be created."
                );

            }


            currentChallengeId = challenge.id;

            currentPlayerSlot = 'player_a';


            // Register Player A

            const { error: participantError } =
                await supabaseClient

                    .from('challenge_participants')

                    .insert([{

                        challenge_id: challenge.id,

                        player_slot: 'player_a',

                        nickname: playerNickname

                    }]);


            if (participantError) {

                throw participantError;

            }


            // Generate invitation link

            const shareUrl =
                `${window.location.origin}${window.location.pathname}` +
                `?challenge=${encodeURIComponent(currentChallengeId)}` +
                `&slot=player_b` +
                `&seed=${currentSeed}`;


            document.getElementById(
                'challengeCodeDisplay'
            ).textContent = code;


            showModalStep(stepShare);


            // Copy challenge code

            document.getElementById('copyCodeBtn').onclick =
                async () => {

                    try {

                        await navigator.clipboard.writeText(code);

                        alert("Code copied: " + code);

                    } catch (error) {

                        window.prompt("Copy your challenge code:", code);

                    }

                };


            // Copy invitation link

            document.getElementById('copyLinkBtn').onclick =
                async () => {

                    try {

                        await navigator.clipboard.writeText(
                            shareUrl
                        );

                        alert("Invitation link copied!");

                    } catch (error) {

                        window.prompt(
                            "Copy your invitation link:",
                            shareUrl
                        );

                    }

                };


        } catch (error) {

            console.error("Challenge creation failed:", error);

            alert(
                "Could not create challenge: " +
                (error.message || "Please try again.")
            );

        } finally {

            createButton.disabled = false;

            createButton.textContent = "Create Invite Link";

        }

    }
);


// ======================================================
// 22. PLAYER A STARTS GAME
// ======================================================

document.getElementById('startPlayerAGame').addEventListener(
    'click',
    () => {

        if (!currentChallengeId) {

            alert("Please create a challenge first.");

            return;

        }

        challengeModal.classList.add('hidden');

        startGame();

    }
);


// ======================================================
// 23. PLAYER B JOINS CHALLENGE
// ======================================================

document.getElementById('acceptChallengeBtn').addEventListener(
    'click',
    async () => {

        const nick = document
            .getElementById('joinNickname')
            .value.trim();


        if (!nick) {

            alert("Please enter your nickname!");

            return;

        }


        if (!supabaseClient || !currentChallengeId) {

            alert("Invalid challenge or server connection.");

            return;

        }


        const acceptButton =
            document.getElementById('acceptChallengeBtn');

        acceptButton.disabled = true;

        acceptButton.textContent = "Joining...";


        try {

            playerNickname = nick;


            // Verify that challenge exists

            const { data: challenge, error } = await supabaseClient

                .from('challenges')

                .select('id, seed')

                .eq('id', currentChallengeId)

                .single();


            if (error) throw error;


            if (!challenge) {

                throw new Error("Challenge not found.");

            }


            if (Number(challenge.seed) !== currentSeed) {

                throw new Error(
                    "Challenge invitation does not match."
                );

            }


            // Register Player B

            const { error: joinError } = await supabaseClient

                .from('challenge_participants')

                .insert([{

                    challenge_id: currentChallengeId,

                    player_slot: 'player_b',

                    nickname: playerNickname

                }]);


            if (joinError) throw joinError;


            currentPlayerSlot = 'player_b';


            modeBadge.textContent =
                "⚔️ MULTIPLAYER CHALLENGE";

            modeBadge.style.color = "#eab308";


            challengeModal.classList.add('hidden');

            startGame();


        } catch (error) {

            console.error("Joining challenge failed:", error);

            alert(
                "Could not join challenge: " +
                (error.message || "Please try again.")
            );

        } finally {

            acceptButton.disabled = false;

            acceptButton.textContent = "Accept & Start!";

        }

    }
);


// ======================================================
// 24. SUBMIT PLAYER RESULTS
// ======================================================

async function submitChallengeResults() {

    challengeModal.classList.remove('hidden');

    showModalStep(stepWaiting);


    document.getElementById(
        'waitingMessage'
    ).textContent =
        "Your turn is done! Waiting for your opponent...";


    if (!supabaseClient || !currentChallengeId) {

        document.getElementById(
            'waitingMessage'
        ).textContent =
            "Unable to connect to the challenge server.";

        return;

    }


    try {

        // Submit player's score

        const { data, error } = await supabaseClient

            .from('challenge_participants')

            .update({

                score: score,

                lives_left: lives

            })

            .match({

                challenge_id: currentChallengeId,

                player_slot: currentPlayerSlot

            })

            .select();


        if (error) throw error;


        if (!data || data.length === 0) {

            throw new Error(
                "Your player record could not be updated. Check database permissions."
            );

        }


        // Start checking opponent

        checkOpponentResults();


    } catch (error) {

        console.error("Score submission failed:", error);

        document.getElementById(
            'waitingMessage'
        ).textContent =
            "Could not submit your score: " + error.message;

    }

}


// ======================================================
// 25. CHECK OPPONENT RESULTS
// ======================================================

async function checkOpponentResults() {

    clearInterval(opponentCheckInterval);

    clearTimeout(opponentCheckTimeout);


    opponentCheckInterval = setInterval(async () => {

        try {

            const { data: participants, error } =
                await supabaseClient

                    .from('challenge_participants')

                    .select('*')

                    .eq('challenge_id', currentChallengeId);


            if (error) throw error;


            if (
                participants &&
                participants.length === 2 &&
                participants.every(
                    p => p.score !== null &&
                         p.score !== undefined
                )
            ) {

                clearInterval(opponentCheckInterval);

                clearTimeout(opponentCheckTimeout);

                displayWinnerScreen(participants);

            }

        } catch (error) {

            console.error(
                "Could not retrieve opponent results:",
                error
            );

        }

    }, 2000);


    // Stop polling after five minutes

    opponentCheckTimeout = setTimeout(() => {

        clearInterval(opponentCheckInterval);

        document.getElementById(
            'waitingMessage'
        ).textContent =
            "Your opponent hasn't finished yet. Please try again later.";

    }, 300000);

}


// ======================================================
// 26. DISPLAY WINNER
// ======================================================

function displayWinnerScreen(participants) {

    const p1 = participants.find(
        p => p.player_slot === 'player_a'
    );

    const p2 = participants.find(
        p => p.player_slot === 'player_b'
    );


    if (!p1 || !p2) return;


    document.getElementById('p1Name').textContent =
        p1.nickname;

    document.getElementById('p1Score').textContent =
        p1.score;

    document.getElementById('p1Lives').textContent =
        p1.lives_left;


    document.getElementById('p2Name').textContent =
        p2.nickname;

    document.getElementById('p2Score').textContent =
        p2.score;

    document.getElementById('p2Lives').textContent =
        p2.lives_left;


    const winnerTitle =
        document.getElementById('winnerText');


    if (Number(p1.score) > Number(p2.score)) {

        winnerTitle.textContent =
            `🏆 ${p1.nickname.toUpperCase()} WINS!`;

    }

    else if (Number(p2.score) > Number(p1.score)) {

        winnerTitle.textContent =
            `🏆 ${p2.nickname.toUpperCase()} WINS!`;

    }

    else {

        winnerTitle.textContent =
            "🤝 IT'S A DRAW!";

    }


    showModalStep(stepResults);


    try {

        if (window.BPFeatures && window.BPFeatures.onChallengeFinished) {

            window.BPFeatures.onChallengeFinished(
                currentChallengeId,
                currentPlayerSlot
            );

        }

    } catch (error) {

        console.warn("Features hook failed:", error);

    }


    // Return to solo menu

    document.getElementById('rematchBtn').onclick =
        () => {

            window.location.href =
                window.location.pathname;

        };

}


// ======================================================
// 27. INITIALIZE GAME
// ======================================================

readChallengeLink();


console.log("🚨 BUTTON PANIC GAME ENGINE LOADED SUCCESSFULLY!");


// ======================================================
// BUTTON PANIC - PHASE 1 FEATURES
// Accounts, player profiles, difficulty menu, leaderboards
// This file only ADDS to the game. It never changes how
// the existing game rounds work.
// ======================================================

(function () {

    'use strict';

    const sb = (typeof supabaseClient !== 'undefined') ? supabaseClient : null;

    const AVATARS = ['🙂', '😎', '🤖', '👾', '🦊', '🐼', '🐯', '🦄', '🐸', '🔥', '⚡', '👑'];

    const DIFF_INFO = {
        easy: 'Simpler rounds · more time · 5 points per round',
        medium: 'The classic game · 10 points per round',
        hard: 'Trickier rounds · less time · 20 points per round'
    };

    // Private address pattern used behind the scenes (players only ever type a username)
    // The domain must really exist (Supabase checks). No emails are ever sent
    // because "Confirm email" is turned off in Supabase.
    const PLAYER_EMAIL_DOMAIN = 'gmail.com';

    // Turns a username into a realistic-looking address: only a-f and 0-9, 6-30 characters,
    // so it passes strict email checks (the same username always gives the same address)
    function hiddenEmail(username) {
        const bytes = new TextEncoder().encode(username.toLowerCase());
        const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        return hex + '@' + PLAYER_EMAIL_DOMAIN;
    }

    const state = { user: null, profile: null };

    let lastSubmit = null;   // { clientGameId, promise }


    // ---------- tiny DOM helper (uses textContent, so names can never inject HTML) ----------

    function h(tag, props, ...kids) {

        const node = document.createElement(tag);

        if (props) {
            Object.keys(props).forEach(k => {
                if (k === 'class') node.className = props[k];
                else if (k === 'text') node.textContent = props[k];
                else if (k.startsWith('on')) node.addEventListener(k.slice(2), props[k]);
                else node.setAttribute(k, props[k]);
            });
        }

        kids.flat().forEach(c => {
            if (c === null || c === undefined) return;
            node.append(c.nodeType ? c : document.createTextNode(String(c)));
        });

        return node;
    }

    function toast(text) {
        const t = h('div', { class: 'bp-toast', text });
        document.body.append(t);
        setTimeout(() => t.remove(), 2600);
    }

    function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }


    // ---------- modal ----------

    const modal = h('div', { class: 'overlay hidden', id: 'bpModal' });
    document.body.append(modal);

    function closeModal() { modal.classList.add('hidden'); }

    function openModal(title, content) {
        modal.replaceChildren(
            h('div', { class: 'modal-card bp-card' },
                h('button', { class: 'close-modal-btn', 'aria-label': 'Close', text: '×', onclick: closeModal }),
                h('h2', { text: title }),
                content
            )
        );
        modal.classList.remove('hidden');
    }

    function avatarPicker(current, onPick) {
        const wrap = h('div', { class: 'bp-avatars' });
        AVATARS.forEach(a => {
            const b = h('button', {
                class: 'bp-av-btn' + (a === current ? ' active' : ''),
                text: a,
                type: 'button',
                onclick: () => {
                    wrap.querySelectorAll('.bp-av-btn').forEach(x => x.classList.remove('active'));
                    b.classList.add('active');
                    onPick(a);
                }
            });
            wrap.append(b);
        });
        return wrap;
    }


    // ---------- account chip ----------

    const chip = h('div', { class: 'bp-chip', id: 'bpChip', onclick: () => state.user ? openProfile() : openAuth('login') });

    function updateChip() {
        chip.replaceChildren();
        if (state.user && state.profile) {
            chip.append(h('span', { class: 'bp-chip-av', text: state.profile.avatar }), h('span', { text: state.profile.username }));
        } else {
            chip.append(h('span', { class: 'bp-chip-av', text: '👤' }), h('span', { text: 'Guest · Sign in' }));
        }
    }


    // ---------- profile loading ----------

    async function refreshProfile() {

        if (!sb || !state.user) {
            state.profile = null;
            updateChip();
            return null;
        }

        try {

            let { data } = await sb.from('profiles').select('*').eq('id', state.user.id).maybeSingle();

            if (!data) {
                await sb.rpc('ensure_my_profile');
                ({ data } = await sb.from('profiles').select('*').eq('id', state.user.id).maybeSingle());
            }

            state.profile = data || null;

        } catch (error) {
            console.warn('Could not load profile:', error);
        }

        updateChip();

        return state.profile;
    }


    // ---------- sign up / log in ----------

    function openAuth(startMode) {

        if (!sb) {
            openModal('Account', h('p', { class: 'bp-sub', text: 'Cannot reach the game server right now. Please try again later.' }));
            return;
        }

        let signup = startMode === 'signup';
        let avatar = AVATARS[0];

        const pass = h('input', { type: 'password', placeholder: 'Password (min 6 characters)', autocomplete: 'current-password' });
        const uname = h('input', { type: 'text', placeholder: 'Username (3-15 letters, numbers, _)', maxlength: '15', autocomplete: 'username', autocapitalize: 'none' });
        const msg = h('div', { class: 'bp-msg' });
        const submit = h('button', { class: 'start-btn', type: 'button' });
        const toggle = h('button', { class: 'bp-link', type: 'button' });

        const signupOnly = h('div', { class: 'bp-col', style: 'width:100%;margin-top:0' },
            h('div', { class: 'bp-sub', text: 'Pick an avatar' }),
            avatarPicker(avatar, a => { avatar = a; })
        );

        function render() {
            signupOnly.classList.toggle('hidden', !signup);
            submit.textContent = signup ? 'Create Account' : 'Log In';
            toggle.textContent = signup ? 'Already have an account? Log in' : 'New here? Create an account';
            pass.setAttribute('autocomplete', signup ? 'new-password' : 'current-password');
            msg.textContent = '';
            msg.className = 'bp-msg';
        }

        toggle.onclick = () => { signup = !signup; render(); };

        submit.onclick = async () => {

            const pw = pass.value;
            const un = uname.value.trim();

            msg.className = 'bp-msg';

            if (!un || !pw) { msg.textContent = 'Please enter your username and password.'; return; }
            if (!/^[A-Za-z0-9_]{3,15}$/.test(un)) { msg.textContent = 'Username must be 3-15 letters, numbers or _'; return; }
            if (signup && pw.length < 6) { msg.textContent = 'Password must be at least 6 characters.'; return; }

            // Players never see this: Supabase needs an email, so we build a private one from the username
            const em = hiddenEmail(un);

            submit.disabled = true;
            const label = submit.textContent;
            submit.textContent = 'Please wait...';

            try {

                if (signup) {

                    const { data: free, error: e1 } = await sb.rpc('username_available', { p_username: un });
                    if (e1) throw e1;
                    if (!free) throw new Error('That username is already taken.');

                    const { data, error } = await sb.auth.signUp({
                        email: em,
                        password: pw,
                        options: { data: { username: un, avatar: avatar } }
                    });
                    if (error) throw error;

                    if (!data.session) {
                        signup = false;
                        render();
                        msg.className = 'bp-msg ok';
                        msg.textContent = 'Account created, but the server still wants email confirmation. Turn off "Confirm email" in Supabase (Authentication > Providers > Email), then log in.';
                        return;
                    }

                    closeModal();
                    toast('Welcome, ' + un + '! 🎉');

                } else {

                    const { error } = await sb.auth.signInWithPassword({ email: em, password: pw });
                    if (error) throw error;

                    closeModal();
                    toast('Logged in ✅');
                }

            } catch (error) {
                const m = error.message || '';
                if (/invalid login/i.test(m)) msg.textContent = 'Wrong username or password.';
                else if (/already (registered|exists)/i.test(m)) msg.textContent = 'That username is already taken.';
                else msg.textContent = m || 'Something went wrong. Please try again.';
            } finally {
                submit.disabled = false;
                if (submit.textContent === 'Please wait...') submit.textContent = label;
            }
        };

        openModal('Player Account',
            h('div', { class: 'bp-col' },
                uname, pass, signupOnly, msg, submit, toggle,
                h('div', { class: 'bp-sub', text: 'No email needed! Just pick a username and password. Remember your password, it cannot be reset.' }),
                h('div', { class: 'bp-sub', text: 'You can still play without an account. An account saves your scores, stats and ranking.' })
            )
        );

        render();
    }


    // ---------- profile ----------

    async function openProfile() {

        if (!state.user) { openAuth('login'); return; }

        const body = h('div', { class: 'bp-col' }, h('div', { class: 'bp-sub', text: 'Loading…' }));
        openModal('My Profile', body);

        await refreshProfile();

        const p = state.profile;

        if (!p) {
            body.replaceChildren(h('div', { class: 'bp-msg', text: 'Could not load your profile.' }));
            return;
        }

        let diffRows = [];
        let history = [];

        try {
            const d = await sb.rpc('get_my_difficulty_stats');
            diffRows = d.data || [];
            const hRes = await sb.from('game_results')
                .select('created_at, difficulty, mode, rounds_won, points, won')
                .order('created_at', { ascending: false })
                .limit(15);
            history = hRes.data || [];
        } catch (error) {
            console.warn('Could not load stats:', error);
        }

        const rate = p.games_played ? Math.round(1000 * p.games_won / p.games_played) / 10 : 0;

        const avatars = avatarPicker(p.avatar, async a => {
            try {
                const { error } = await sb.rpc('set_avatar', { p_avatar: a });
                if (error) throw error;
                await refreshProfile();
                bigAv.textContent = a;
            } catch (e) { toast('Could not change avatar'); }
        });

        const bigAv = h('div', { class: 'bp-big-av', text: p.avatar });

        const byDiff = {};
        diffRows.forEach(r => { byDiff[r.difficulty] = r; });

        const table = h('table', { class: 'bp-table' },
            h('tr', null, h('th', { text: 'Level' }), h('th', { text: 'Games' }), h('th', { text: 'Best' }), h('th', { text: 'Wins' }), h('th', { text: 'Points' })),
            ['easy', 'medium', 'hard'].map(k => {
                const r = byDiff[k];
                return h('tr', null,
                    h('td', { text: cap(k) }),
                    h('td', { text: r ? r.games : 0 }),
                    h('td', { text: r ? r.best_rounds : 0 }),
                    h('td', { text: r ? r.wins : 0 }),
                    h('td', { text: r ? r.total_points : 0 })
                );
            })
        );

        const hist = h('div', { class: 'bp-hist' });
        if (history.length === 0) {
            hist.append(h('div', { text: 'No games saved yet. Play a game while signed in!' }));
        } else {
            history.forEach(g => {
                const when = new Date(g.created_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
                hist.append(h('div', {
                    text: `${g.mode === 'challenge' ? '⚔️' : '🎮'} ${when} · ${g.difficulty.toUpperCase()} · ${g.rounds_won} rounds · +${g.points} pts ${g.won === true ? '🏆' : ''}`
                }));
            });
        }

        body.replaceChildren(
            bigAv,
            h('div', { class: 'bp-username', text: p.username }),
            h('div', { class: 'bp-stats' },
                h('div', { class: 'bp-stat' }, h('b', { text: p.total_points }), h('span', { text: 'Total points' })),
                h('div', { class: 'bp-stat' }, h('b', { text: p.games_played }), h('span', { text: 'Games played' })),
                h('div', { class: 'bp-stat' }, h('b', { text: p.games_won }), h('span', { text: 'Games won' })),
                h('div', { class: 'bp-stat' }, h('b', { text: rate + '%' }), h('span', { text: 'Win rate' }))
            ),
            h('div', { class: 'bp-sub', text: 'Performance by difficulty' }),
            table,
            h('div', { class: 'bp-sub', text: 'Change avatar' }),
            avatars,
            h('div', { class: 'bp-sub', text: 'Recent games' }),
            hist,
            h('div', { class: 'bp-sub', text: 'A solo win = surviving 10 or more rounds.' }),
            h('button', {
                class: 'start-btn secondary-btn',
                text: 'Log Out',
                onclick: async () => { await sb.auth.signOut(); closeModal(); toast('Logged out'); }
            })
        );
    }


    // ---------- leaderboard ----------

    function openLeaderboard() {

        if (!sb) {
            openModal('Leaderboard', h('p', { class: 'bp-sub', text: 'Cannot reach the game server right now. Please try again later.' }));
            return;
        }

        let period = 'global';

        const list = h('div', { class: 'bp-lb' });

        const tabs = ['global', 'weekly', 'monthly'].map(p =>
            h('button', {
                class: 'bp-tab', 'data-p': p, text: cap(p), type: 'button',
                onclick: () => { period = p; load(); }
            })
        );

        async function load() {

            tabs.forEach(t => t.classList.toggle('active', t.getAttribute('data-p') === period));
            list.replaceChildren(h('div', { class: 'bp-sub', text: 'Loading…' }));

            try {

                const { data, error } = await sb.rpc('get_leaderboard', { p_period: period, p_limit: 50 });
                if (error) throw error;

                if (!data || data.length === 0) {
                    list.replaceChildren(h('div', { class: 'bp-sub', text: period === 'global' ? 'No ranked players yet. Be the first!' : 'No games this ' + (period === 'weekly' ? 'week' : 'month') + ' yet.' }));
                    return;
                }

                const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };

                list.replaceChildren(...data.map(r =>
                    h('div', { class: 'bp-row' + (state.user && r.player_id === state.user.id ? ' me' : '') },
                        h('span', { class: 'bp-rank', text: medals[r.player_rank] || ('#' + r.player_rank) }),
                        h('span', { class: 'bp-av', text: r.player_avatar }),
                        h('div', null,
                            h('span', { class: 'bp-name', text: r.player_name }),
                            h('span', { class: 'bp-meta', text: `${r.games} played · ${r.wins} won · ${r.win_rate}%` })
                        ),
                        h('span', { class: 'bp-pts', text: r.points + ' pts' })
                    )
                ));

            } catch (error) {
                list.replaceChildren(h('div', { class: 'bp-msg', text: 'Could not load the leaderboard: ' + (error.message || 'try again') }));
            }
        }

        openModal('🏆 Leaderboard',
            h('div', { class: 'bp-col' },
                h('div', { class: 'bp-tabs' }, tabs),
                list,
                h('div', { class: 'bp-rules', text: 'Ranking rules: points = rounds survived × difficulty (Easy 5, Medium 10, Hard 20). Scores are checked by the server, each game counts once, and only signed-in players are ranked. Weekly starts Monday, monthly on the 1st (UTC).' })
            )
        );

        load();
    }


    // ---------- game hooks (called from script.js) ----------

    function setResultLine(text) {
        const line = document.getElementById('bpResultLine');
        if (line) line.textContent = text;
    }

    async function submitResult(info) {

        const { data, error } = await sb.rpc('submit_game_result', {
            p_client_game_id: info.clientGameId,
            p_difficulty: info.difficulty,
            p_mode: info.mode,
            p_rounds_won: info.roundsWon,
            p_lives_left: info.livesLeft,
            p_duration_ms: info.durationMs,
            p_challenge_id: info.mode === 'challenge' ? info.challengeId : null
        });

        if (error) throw error;

        return data;
    }

    window.BPFeatures = {

        onGameEnd: function (info) {

            setResultLine('');

            if (!sb || !state.user) {
                if (info.mode === 'solo') setResultLine('🔐 Sign in from the menu to save your score and get ranked.');
                return;
            }

            setResultLine('Saving your score…');

            const promise = submitResult(info)
                .then(data => {
                    const label = info.difficulty.toUpperCase();
                    setResultLine(data.duplicate ? 'Score already saved ✅' : `+${data.points} points saved ✅ (${label})`);
                    refreshProfile();
                    return data;
                })
                .catch(error => {
                    setResultLine('Could not save score: ' + (error.message || 'try again'));
                    return null;
                });

            lastSubmit = { clientGameId: info.clientGameId, promise };
        },

        onChallengeFinished: async function (challengeId, slot) {

            if (!sb || !state.user || !lastSubmit) return;

            try {
                await lastSubmit.promise;
                await sb.rpc('mark_challenge_win', { p_client_game_id: lastSubmit.clientGameId, p_slot: slot });
                refreshProfile();
            } catch (error) {
                console.warn('Could not record challenge result:', error);
            }
        }
    };


    // ---------- build the extra menu items ----------

    function buildMenu() {

        const startOverlay = document.getElementById('startOverlay');
        const startBtn = document.getElementById('startBtn');
        const joinBtn = document.getElementById('joinCodeBtn') || document.getElementById('challengeBtn');
        const gameOver = document.getElementById('gameOverOverlay');
        const restartBtn = document.getElementById('restartBtn');

        if (!startOverlay || !startBtn) return;

        // Account chip at the top
        startOverlay.prepend(chip);

        // Difficulty selector above the START button
        let current = 'medium';
        try {
            const saved = localStorage.getItem('bpDifficulty');
            if (['easy', 'medium', 'hard'].includes(saved)) current = saved;
        } catch (e) {}

        const desc = h('div', { class: 'bp-diff-desc' });
        const note = h('div', { class: 'bp-sub', text: 'Friend challenges always use Medium.' });

        const buttons = ['easy', 'medium', 'hard'].map(k =>
            h('button', {
                class: 'bp-diff-btn bp-' + k, 'data-key': k, text: k.toUpperCase(), type: 'button',
                onclick: () => choose(k)
            })
        );

        function choose(k) {
            if (typeof setDifficulty === 'function') setDifficulty(k);
            buttons.forEach(b => b.classList.toggle('active', b.getAttribute('data-key') === k));
            desc.textContent = DIFF_INFO[k];
        }

        startBtn.before(h('div', { class: 'bp-diff' },
            h('div', { class: 'bp-diff-title', text: 'DIFFICULTY' }),
            h('div', { class: 'bp-diff-row' }, buttons),
            desc,
            note
        ));

        choose(current);

        // Profile + Leaderboard buttons
        (joinBtn || startBtn).after(h('div', { class: 'bp-nav-row' },
            h('button', { class: 'bp-nav-btn', type: 'button', text: '👤 PROFILE', onclick: () => state.user ? openProfile() : openAuth('login') }),
            h('button', { class: 'bp-nav-btn', type: 'button', text: '🏆 RANKS', onclick: openLeaderboard })
        ));

        // Game over screen: result line + back to menu
        if (gameOver && restartBtn) {
            restartBtn.before(h('div', { class: 'bp-result', id: 'bpResultLine' }));
            restartBtn.after(h('button', {
                class: 'start-btn secondary-btn', type: 'button', text: '🏠 MAIN MENU',
                onclick: () => {
                    gameOver.classList.add('hidden');
                    startOverlay.classList.remove('hidden');
                }
            }));
        }

        updateChip();
    }


    // ---------- start ----------

    buildMenu();

    if (sb) {

        sb.auth.onAuthStateChange((event, session) => {
            state.user = session ? session.user : null;
            // Never call Supabase directly inside this callback
            setTimeout(refreshProfile, 0);
        });

        sb.auth.getSession().then(({ data }) => {
            if (data && data.session && !state.user) {
                state.user = data.session.user;
                refreshProfile();
            }
        }).catch(() => {});
    }

    console.log('✅ Button Panic Phase 1 features loaded');

})();
