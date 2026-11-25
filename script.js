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


// ---- Difficulty settings ----
// points = rounds survived x points per round

const DIFFICULTIES = {

    easy: {
        label: 'EASY', color: '#22c55e',
        points: 5, time: 1.4, ramp: 0.10, minSpeed: 0.7,
        hint: 'Simpler rounds · more time · 5 points per round',
        allow: (i) =>
            i.type !== 'press_triple' &&
            i.type !== 'color_green' &&
            !i.text.startsWith('IGNORE')
    },

    medium: {
        label: 'MEDIUM', color: '#eab308',
        points: 10, time: 1.0, ramp: 0.20, minSpeed: 0.5,
        hint: 'Standard rounds · 10 points per round',
        allow: () => true
    },

    hard: {
        label: 'HARD', color: '#ef4444',
        points: 20, time: 0.8, ramp: 0.20, minSpeed: 0.4,
        hint: 'All the tricks · less time · 20 points per round',
        allow: () => true
    }

};

let selectedDifficulty = 'easy';

try {

    const savedDifficulty =
        localStorage.getItem('buttonPanicDifficulty');

    if (savedDifficulty && DIFFICULTIES[savedDifficulty]) {
        selectedDifficulty = savedDifficulty;
    }

} catch (error) {
    console.warn("Local storage unavailable");
}

let activeDifficulty = selectedDifficulty;

let roundsWon = 0;

let currentSessionId = null;

let currentUser = null;

let currentProfile = null;

function bestKey(difficulty) {
    return 'buttonPanicBest_' + difficulty;
}

function loadHighScore(difficulty) {

    try {

        let value = localStorage.getItem(bestKey(difficulty));

        // Your old single high score used 10 points per round = Medium
        if (value === null && difficulty === 'medium') {
            value = localStorage.getItem('buttonPanicBest');
        }

        return Number(value || 0);

    } catch (error) {

        return 0;

    }

}

highScore = loadHighScore(selectedDifficulty);

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

const stepJoin = document.getElementById('stepJoin');

const stepWaiting = document.getElementById('stepWaiting');

const stepResults = document.getElementById('stepResults');

const stepCode = document.getElementById('stepCode');


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

    const pool = instructionsList.filter(
        DIFFICULTIES[activeDifficulty].allow
    );

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

    const cfg = DIFFICULTIES[activeDifficulty];

    const speedFactor = Math.max(
        cfg.minSpeed,
        1 - (roundsWon * cfg.ramp)
    );

    // Holding needs 1 second, so never go below 1.5s for HOLD rounds
    const floorTime =
        currentInstruction.type === 'hold' ? 1500 : 600;

    roundTime = Math.max(
        floorTime,
        currentInstruction.duration * cfg.time * speedFactor
    );


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

        roundsWon++;

        score = roundsWon * DIFFICULTIES[activeDifficulty].points;

        scoreEl.textContent = score;


        // Update solo high score

        if (!currentChallengeId && score > highScore) {

            highScore = score;

            highScoreEl.textContent = highScore;

            try {

                localStorage.setItem(bestKey(activeDifficulty), highScore);

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

    // Friend challenges always use Medium
    activeDifficulty =
        currentChallengeId ? 'medium' : selectedDifficulty;

    highScore = loadHighScore(activeDifficulty);

    highScoreEl.textContent = highScore;

    updateModeBadge();


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


    if (currentChallengeId) {

        submitChallengeResults();

        return;

    }


    finalScoreEl.textContent = score;

    recordSoloResult();


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
    startSoloGame
);


document.getElementById('restartBtn').addEventListener(
    'click',
    startSoloGame
);


// ======================================================
// 19. CHALLENGE MODAL MANAGEMENT
// ======================================================

function showModalStep(step) {

    [
        stepCreate,
        stepShare,
        stepJoin,
        stepWaiting,
        stepResults,
        stepCode

    ].forEach(s => {

        s.classList.add('hidden');

    });


    step.classList.remove('hidden');

    prefillNicknames(step);

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

            const code = 'BP-' + Math.floor(
                1000 + Math.random() * 9000
            );


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


            // WhatsApp sharing

            document.getElementById('whatsappShareBtn').onclick =
                () => {

                    const message = encodeURIComponent(
                        `I challenge you to Button Panic! 🚨\n\n` +
                        `Challenge Code: ${code}\n\n` +
                        `Play here: ${shareUrl}`
                    );


                    window.open(
                        `https://api.whatsapp.com/send?text=${message}`,
                        '_blank'
                    );

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


    // Return to solo menu

    document.getElementById('rematchBtn').onclick =
        () => {

            window.location.href =
                window.location.pathname;

        };

}


// ======================================================
// 26B. DIFFICULTY, ACCOUNTS, PROFILE, RANKS, JOIN WITH CODE
// ======================================================

function byId(id) {
    return document.getElementById(id);
}

function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), ms)
        )
    ]);
}


// ---------- Mode badge ----------

function updateModeBadge() {

    if (currentChallengeId) {

        modeBadge.textContent = "⚔️ MULTIPLAYER CHALLENGE · MEDIUM";
        modeBadge.style.color = "#eab308";

    } else {

        const cfg = DIFFICULTIES[activeDifficulty];

        modeBadge.textContent = "SOLO · " + cfg.label;
        modeBadge.style.color = cfg.color;

    }

}


// ---------- Difficulty selector ----------

const diffButtons = document.querySelectorAll('.diff-btn');

function renderDifficulty() {

    diffButtons.forEach(btn => {
        btn.classList.toggle(
            'selected',
            btn.dataset.diff === selectedDifficulty
        );
    });

    byId('diffHint').textContent =
        DIFFICULTIES[selectedDifficulty].hint;

    activeDifficulty = selectedDifficulty;

    highScore = loadHighScore(selectedDifficulty);

    highScoreEl.textContent = highScore;

    updateModeBadge();

}

diffButtons.forEach(btn => {

    btn.addEventListener('click', () => {

        selectedDifficulty = btn.dataset.diff;

        try {
            localStorage.setItem(
                'buttonPanicDifficulty',
                selectedDifficulty
            );
        } catch (error) { /* ignore */ }

        renderDifficulty();

    });

});

renderDifficulty();


// ---------- Start a solo game (ranked when signed in) ----------

async function startSoloGame() {

    // A plain solo game is never a friend challenge
    currentChallengeId = null;
    currentSeed = null;
    currentPlayerSlot = 'player_a';
    currentSessionId = null;

    clearInterval(opponentCheckInterval);
    clearTimeout(opponentCheckTimeout);

    const buttons = [byId('startBtn'), byId('restartBtn')];

    buttons.forEach(b => { b.disabled = true; });

    if (currentUser && supabaseClient) {

        try {

            const { data, error } = await withTimeout(
                supabaseClient.rpc('bp_start_game', {
                    p_difficulty: selectedDifficulty
                }),
                5000
            );

            if (error) throw error;

            currentSessionId = data;

        } catch (error) {

            console.warn("Ranked game could not start:", error);

            currentSessionId = null;

        }

    }

    buttons.forEach(b => { b.disabled = false; });

    startGame();

}


// ---------- Save a solo result to the ranks ----------

async function recordSoloResult() {

    const msg = byId('rankMessage');

    if (!currentUser) {
        msg.textContent = "Sign in to save your scores to the ranks.";
        return;
    }

    if (!currentSessionId || !supabaseClient) {
        msg.textContent =
            "This game was not ranked (the server could not be reached when it started).";
        return;
    }

    const sessionId = currentSessionId;

    currentSessionId = null;

    msg.textContent = "Saving your score…";

    try {

        const { data, error } = await withTimeout(
            supabaseClient.rpc('bp_finish_game', {
                p_session: sessionId,
                p_rounds: roundsWon
            }),
            8000
        );

        if (error) throw error;

        if (!data || !data.accepted) {
            msg.textContent =
                "This score could not be verified, so it was not counted.";
        } else if (data.points === 0) {
            msg.textContent =
                "No rounds survived, so no points this time.";
        } else {
            msg.textContent =
                "✅ +" + data.points + " points saved to the ranks!";
        }

    } catch (error) {

        console.error("Saving score failed:", error);

        msg.textContent =
            "Could not save your score: " +
            (error.message || "please try again.");

    }

}


// ---------- Nickname prefill ----------

function prefillNicknames(step) {

    if (!currentProfile || !currentProfile.username) return;

    const name = String(currentProfile.username).slice(0, 15);

    if (step === stepCreate && !byId('playerNickname').value) {
        byId('playerNickname').value = name;
    }

    if (step === stepJoin && !byId('joinNickname').value) {
        byId('joinNickname').value = name;
    }

}


// ---------- Generic close buttons ----------

document.querySelectorAll('[data-close]').forEach(btn => {

    btn.addEventListener('click', () => {

        btn.closest('.overlay').classList.add('hidden');

    });

});


// ---------- Accounts ----------

let authMode = 'signin';

function updateAuthPill() {

    const pill = byId('authPill');

    if (currentUser) {

        pill.textContent =
            "👤 " + ((currentProfile && currentProfile.username) || "Player");

    } else {

        pill.textContent = "👤 Guest · Sign in";

    }

}

async function refreshUser(session) {

    currentUser = session ? session.user : null;

    currentProfile = null;

    updateAuthPill();

    if (currentUser && supabaseClient) {

        try {

            const { data, error } = await supabaseClient.rpc('bp_my_profile');

            if (error) throw error;

            currentProfile = data;

        } catch (error) {

            console.warn("Could not load profile:", error);

        }

        updateAuthPill();

    }

}

function setAuthMode(mode) {

    authMode = mode;

    const signup = mode === 'signup';

    byId('authTitle').textContent =
        signup ? "👤 Create account" : "👤 Sign in";

    byId('authSubmitBtn').textContent =
        signup ? "Create account" : "Sign in";

    byId('authToggleBtn').textContent =
        signup ? "Already have an account? Sign in"
               : "New here? Create an account";

    byId('authUsername').classList.toggle('hidden', !signup);

    byId('authPassword').autocomplete =
        signup ? 'new-password' : 'current-password';

    byId('authMessage').textContent = '';

}

function showAuthMessage(text, ok) {

    const el = byId('authMessage');

    el.textContent = text;

    el.classList.toggle('ok', !!ok);

}

function openAuthModal() {

    setAuthMode('signin');

    byId('authModal').classList.remove('hidden');

}

byId('authToggleBtn').addEventListener('click', () => {

    setAuthMode(authMode === 'signin' ? 'signup' : 'signin');

});

byId('authSubmitBtn').addEventListener('click', async () => {

    if (!supabaseClient) {
        showAuthMessage("Cannot reach the server right now.");
        return;
    }

    const email = byId('authEmail').value.trim();
    const password = byId('authPassword').value;
    const username = byId('authUsername').value.trim();

    if (!email.includes('@')) {
        showAuthMessage("Enter a valid email.");
        return;
    }

    if (password.length < 6) {
        showAuthMessage("Password must be at least 6 characters.");
        return;
    }

    if (authMode === 'signup' && !/^[A-Za-z0-9_]{3,15}$/.test(username)) {
        showAuthMessage(
            "Username: 3-15 letters, numbers or underscores."
        );
        return;
    }

    const submit = byId('authSubmitBtn');

    submit.disabled = true;

    showAuthMessage("Please wait…", true);

    try {

        if (authMode === 'signup') {

            const { data, error } = await supabaseClient.auth.signUp({
                email: email,
                password: password,
                options: { data: { username: username } }
            });

            if (error) throw error;

            if (!data.session) {

                setAuthMode('signin');

                showAuthMessage(
                    "Account created! Check your email to confirm it, then sign in.",
                    true
                );

                return;

            }

        } else {

            const { error } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) throw error;

        }

        byId('authPassword').value = '';

        byId('authModal').classList.add('hidden');

    } catch (error) {

        showAuthMessage(error.message || "Something went wrong.");

    } finally {

        submit.disabled = false;

    }

});

byId('authPill').addEventListener('click', () => {

    if (currentUser) {
        openProfile();
    } else {
        openAuthModal();
    }

});


// ---------- Profile and trophies ----------

const TROPHIES = [

    { icon: '🥉', name: 'First Steps',
      desc: 'Finish your first ranked game',
      test: p => p.games >= 1 },

    { icon: '🎯', name: 'Warmed Up',
      desc: 'Survive 10 rounds in one game',
      test: p => p.best_rounds >= 10 },

    { icon: '🔥', name: 'On Fire',
      desc: 'Survive 25 rounds in one game',
      test: p => p.best_rounds >= 25 },

    { icon: '💪', name: 'Hard Hero',
      desc: 'Score 100+ in one Hard game',
      test: p => p.best_hard >= 100 },

    { icon: '💯', name: 'Point Collector',
      desc: 'Earn 1,000 points in total',
      test: p => p.total_points >= 1000 },

    { icon: '👑', name: 'Top 10',
      desc: 'Reach the global top 10',
      test: p => p.rank && p.rank <= 10 }

];

function makeEl(tag, className, text) {

    const el = document.createElement(tag);

    if (className) el.className = className;

    if (text !== undefined) el.textContent = text;

    return el;

}

function statCell(value, label) {

    const cell = makeEl('div', 'stat-cell');

    cell.appendChild(makeEl('b', '', String(value)));

    cell.appendChild(makeEl('span', '', label));

    return cell;

}

function renderProfile(p) {

    const body = byId('profileBody');

    body.replaceChildren();

    body.appendChild(makeEl('div', 'profile-name', p.username));

    const grid = makeEl('div', 'stat-grid');

    grid.appendChild(statCell(p.rank ? '#' + p.rank : '-', 'Global rank'));
    grid.appendChild(statCell(p.total_points, 'Total points'));
    grid.appendChild(statCell(p.games, 'Games'));
    grid.appendChild(statCell(p.best_rounds, 'Best rounds'));
    grid.appendChild(statCell(p.best_easy, 'Best easy'));
    grid.appendChild(statCell(p.best_medium, 'Best medium'));
    grid.appendChild(statCell(p.best_hard, 'Best hard'));

    body.appendChild(grid);

    body.appendChild(makeEl('div', 'trophy-title', 'TROPHIES'));

    const trophies = makeEl('div', 'trophy-grid');

    TROPHIES.forEach(t => {

        const unlocked = !!t.test(p);

        const card = makeEl('div', 'trophy' + (unlocked ? '' : ' locked'));

        card.appendChild(makeEl('span', 'icon', t.icon));
        card.appendChild(makeEl('b', '', t.name));
        card.appendChild(makeEl('span', '', t.desc));

        trophies.appendChild(card);

    });

    body.appendChild(trophies);

    const out = makeEl('button', 'menu-btn wide', 'SIGN OUT');

    out.addEventListener('click', async () => {

        try {
            await supabaseClient.auth.signOut();
        } catch (error) {
            console.warn("Sign out failed:", error);
        }

        byId('profileModal').classList.add('hidden');

    });

    body.appendChild(out);

}

async function openProfile() {

    const body = byId('profileBody');

    byId('profileModal').classList.remove('hidden');

    body.replaceChildren();

    if (!currentUser) {

        body.appendChild(makeEl('p', '',
            "You're playing as a guest. Sign in to save your scores, earn trophies and appear in the ranks."));

        const btn = makeEl('button', 'start-btn', 'Sign in');

        btn.addEventListener('click', () => {
            byId('profileModal').classList.add('hidden');
            openAuthModal();
        });

        body.appendChild(btn);

        return;

    }

    body.appendChild(makeEl('p', '', 'Loading…'));

    try {

        const { data, error } = await withTimeout(
            supabaseClient.rpc('bp_my_profile'),
            8000
        );

        if (error) throw error;

        if (!data) throw new Error('No profile');

        currentProfile = data;

        updateAuthPill();

        renderProfile(data);

    } catch (error) {

        console.error("Profile failed:", error);

        body.replaceChildren(makeEl('p', 'form-message',
            "Could not load your profile right now."));

    }

}

byId('profileBtn').addEventListener('click', openProfile);


// ---------- Leaderboard ----------

let lbPeriod = 'global';

async function loadLeaderboard(period) {

    lbPeriod = period;

    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.classList.toggle('selected', tab.dataset.period === period);
    });

    const list = byId('lbList');
    const status = byId('lbStatus');

    list.replaceChildren();

    status.textContent = "Loading…";

    if (!supabaseClient) {
        status.textContent = "Cannot reach the server right now.";
        return;
    }

    try {

        const { data, error } = await withTimeout(
            supabaseClient.rpc('bp_leaderboard', { p_period: period }),
            8000
        );

        if (error) throw error;

        if (period !== lbPeriod) return;

        const rows = data || [];

        status.textContent =
            rows.length ? "" : "No scores yet. Be the first!";

        rows.forEach(row => {

            const el = makeEl('div', 'lb-row' + (row.is_me ? ' me' : ''));

            const rank = Number(row.rank);

            const medal = rank === 1 ? '🥇'
                        : rank === 2 ? '🥈'
                        : rank === 3 ? '🥉'
                        : '#' + rank;

            el.appendChild(makeEl('span', 'lb-rank', medal));
            el.appendChild(makeEl('span', 'lb-name', row.username));
            el.appendChild(makeEl('span', 'lb-pts', row.points + ' pts'));

            list.appendChild(el);

        });

    } catch (error) {

        console.error("Leaderboard failed:", error);

        if (period === lbPeriod) {
            status.textContent = "Could not load the ranks right now.";
        }

    }

}

byId('ranksBtn').addEventListener('click', () => {

    byId('ranksModal').classList.remove('hidden');

    loadLeaderboard(lbPeriod);

});

document.querySelectorAll('.tab-btn').forEach(tab => {

    tab.addEventListener('click', () => {

        loadLeaderboard(tab.dataset.period);

    });

});


// ---------- Join with code ----------

byId('joinCodeBtn').addEventListener('click', () => {

    byId('codeMessage').textContent = '';

    challengeModal.classList.remove('hidden');

    showModalStep(stepCode);

});

byId('findChallengeBtn').addEventListener('click', async () => {

    const msg = byId('codeMessage');

    let code = byId('joinCodeInput').value
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '');

    if (/^\d{4}$/.test(code)) code = 'BP-' + code;

    if (!/^BP-\d{4}$/.test(code)) {
        msg.textContent = "Enter a code like BP-1234.";
        return;
    }

    if (!supabaseClient) {
        msg.textContent = "Cannot reach the server right now.";
        return;
    }

    const button = byId('findChallengeBtn');

    button.disabled = true;

    msg.textContent = "Looking…";

    try {

        const { data: challenges, error } = await withTimeout(
            supabaseClient
                .from('challenges')
                .select('id, seed, challenge_code')
                .eq('challenge_code', code)
                .limit(5),
            8000
        );

        if (error) throw error;

        if (!challenges || challenges.length === 0) {
            msg.textContent = "No challenge found with that code.";
            return;
        }

        const ids = challenges.map(c => c.id);

        const { data: taken, error: takenError } = await withTimeout(
            supabaseClient
                .from('challenge_participants')
                .select('challenge_id, player_slot')
                .in('challenge_id', ids),
            8000
        );

        if (takenError) throw takenError;

        const takenIds = new Set(
            (taken || [])
                .filter(p => p.player_slot === 'player_b')
                .map(p => p.challenge_id)
        );

        const open = challenges.find(c => !takenIds.has(c.id));

        if (!open) {
            msg.textContent = "That challenge already has two players.";
            return;
        }

        currentChallengeId = open.id;
        currentSeed = Number(open.seed);
        currentPlayerSlot = 'player_b';

        updateModeBadge();

        msg.textContent = '';

        showModalStep(stepJoin);

    } catch (error) {

        console.error("Finding challenge failed:", error);

        msg.textContent =
            "Could not look up that code: " +
            (error.message || "please try again.");

    } finally {

        button.disabled = false;

    }

});


// ---------- Menu button on the game-over screen ----------

byId('menuBtn').addEventListener('click', () => {

    gameOverOverlay.classList.add('hidden');

    startOverlay.classList.remove('hidden');

    renderDifficulty();

});


// ---------- Watch sign-in state ----------

if (supabaseClient && supabaseClient.auth) {

    supabaseClient.auth.onAuthStateChange((event, session) => {

        // Run later so we never call Supabase from inside its own callback
        setTimeout(() => refreshUser(session), 0);

    });

}


// ======================================================
// 27. INITIALIZE GAME
// ======================================================

readChallengeLink();


console.log("🚨 BUTTON PANIC GAME ENGINE LOADED SUCCESSFULLY!");// ======================================================
// BUTTON PANIC! 🚨
// COMPLETE GAME ENGINE
// ======================================================


// ======================================================
// 1. SUPABASE INITIALIZATION
// ======================================================

const SUPABASE_URL = 'https://vzehtaigujsdlexzvais.supabase.co';

const SUPABASE_ANON_KEY = 'sb_publishable_MFVbyq7BLYggFxiTOanlZw_zmcdPghr';

let supabase = null;

try {
    if (window.supabase) {
        supabase = window.supabase.createClient(
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


// ---- Difficulty settings ----
// points = rounds survived x points per round

const DIFFICULTIES = {

    easy: {
        label: 'EASY', color: '#22c55e',
        points: 5, time: 1.4, ramp: 0.10, minSpeed: 0.7,
        hint: 'Simpler rounds · more time · 5 points per round',
        allow: (i) =>
            i.type !== 'press_triple' &&
            i.type !== 'color_green' &&
            !i.text.startsWith('IGNORE')
    },

    medium: {
        label: 'MEDIUM', color: '#eab308',
        points: 10, time: 1.0, ramp: 0.20, minSpeed: 0.5,
        hint: 'Standard rounds · 10 points per round',
        allow: () => true
    },

    hard: {
        label: 'HARD', color: '#ef4444',
        points: 20, time: 0.8, ramp: 0.20, minSpeed: 0.4,
        hint: 'All the tricks · less time · 20 points per round',
        allow: () => true
    }

};

let selectedDifficulty = 'easy';

try {

    const savedDifficulty =
        localStorage.getItem('buttonPanicDifficulty');

    if (savedDifficulty && DIFFICULTIES[savedDifficulty]) {
        selectedDifficulty = savedDifficulty;
    }

} catch (error) {
    console.warn("Local storage unavailable");
}

let activeDifficulty = selectedDifficulty;

let roundsWon = 0;

let currentSessionId = null;

let currentUser = null;

let currentProfile = null;

function bestKey(difficulty) {
    return 'buttonPanicBest_' + difficulty;
}

function loadHighScore(difficulty) {

    try {

        let value = localStorage.getItem(bestKey(difficulty));

        // Your old single high score used 10 points per round = Medium
        if (value === null && difficulty === 'medium') {
            value = localStorage.getItem('buttonPanicBest');
        }

        return Number(value || 0);

    } catch (error) {

        return 0;

    }

}

highScore = loadHighScore(selectedDifficulty);

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

const stepJoin = document.getElementById('stepJoin');

const stepWaiting = document.getElementById('stepWaiting');

const stepResults = document.getElementById('stepResults');

const stepCode = document.getElementById('stepCode');


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

    const pool = instructionsList.filter(
        DIFFICULTIES[activeDifficulty].allow
    );

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

    const cfg = DIFFICULTIES[activeDifficulty];

    const speedFactor = Math.max(
        cfg.minSpeed,
        1 - (roundsWon * cfg.ramp)
    );

    // Holding needs 1 second, so never go below 1.5s for HOLD rounds
    const floorTime =
        currentInstruction.type === 'hold' ? 1500 : 600;

    roundTime = Math.max(
        floorTime,
        currentInstruction.duration * cfg.time * speedFactor
    );


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

        roundsWon++;

        score = roundsWon * DIFFICULTIES[activeDifficulty].points;

        scoreEl.textContent = score;


        // Update solo high score

        if (!currentChallengeId && score > highScore) {

            highScore = score;

            highScoreEl.textContent = highScore;

            try {

                localStorage.setItem(bestKey(activeDifficulty), highScore);

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

    // Friend challenges always use Medium
    activeDifficulty =
        currentChallengeId ? 'medium' : selectedDifficulty;

    highScore = loadHighScore(activeDifficulty);

    highScoreEl.textContent = highScore;

    updateModeBadge();


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


    if (currentChallengeId) {

        submitChallengeResults();

        return;

    }


    finalScoreEl.textContent = score;

    recordSoloResult();


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
    startSoloGame
);


document.getElementById('restartBtn').addEventListener(
    'click',
    startSoloGame
);


// ======================================================
// 19. CHALLENGE MODAL MANAGEMENT
// ======================================================

function showModalStep(step) {

    [
        stepCreate,
        stepShare,
        stepJoin,
        stepWaiting,
        stepResults,
        stepCode

    ].forEach(s => {

        s.classList.add('hidden');

    });


    step.classList.remove('hidden');

    prefillNicknames(step);

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


        if (!supabase) {

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

            const code = 'BP-' + Math.floor(
                1000 + Math.random() * 9000
            );


            // Create challenge in Supabase

            const { data: challenge, error } = await supabase

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
                await supabase

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


            // WhatsApp sharing

            document.getElementById('whatsappShareBtn').onclick =
                () => {

                    const message = encodeURIComponent(
                        `I challenge you to Button Panic! 🚨\n\n` +
                        `Challenge Code: ${code}\n\n` +
                        `Play here: ${shareUrl}`
                    );


                    window.open(
                        `https://api.whatsapp.com/send?text=${message}`,
                        '_blank'
                    );

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


        if (!supabase || !currentChallengeId) {

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

            const { data: challenge, error } = await supabase

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

            const { error: joinError } = await supabase

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


    if (!supabase || !currentChallengeId) {

        document.getElementById(
            'waitingMessage'
        ).textContent =
            "Unable to connect to the challenge server.";

        return;

    }


    try {

        // Submit player's score

        const { data, error } = await supabase

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
                await supabase

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


    // Return to solo menu

    document.getElementById('rematchBtn').onclick =
        () => {

            window.location.href =
                window.location.pathname;

        };

}


// ======================================================
// 26B. DIFFICULTY, ACCOUNTS, PROFILE, RANKS, JOIN WITH CODE
// ======================================================

function byId(id) {
    return document.getElementById(id);
}

function withTimeout(promise, ms) {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), ms)
        )
    ]);
}


// ---------- Mode badge ----------

function updateModeBadge() {

    if (currentChallengeId) {

        modeBadge.textContent = "⚔️ MULTIPLAYER CHALLENGE · MEDIUM";
        modeBadge.style.color = "#eab308";

    } else {

        const cfg = DIFFICULTIES[activeDifficulty];

        modeBadge.textContent = "SOLO · " + cfg.label;
        modeBadge.style.color = cfg.color;

    }

}


// ---------- Difficulty selector ----------

const diffButtons = document.querySelectorAll('.diff-btn');

function renderDifficulty() {

    diffButtons.forEach(btn => {
        btn.classList.toggle(
            'selected',
            btn.dataset.diff === selectedDifficulty
        );
    });

    byId('diffHint').textContent =
        DIFFICULTIES[selectedDifficulty].hint;

    activeDifficulty = selectedDifficulty;

    highScore = loadHighScore(selectedDifficulty);

    highScoreEl.textContent = highScore;

    updateModeBadge();

}

diffButtons.forEach(btn => {

    btn.addEventListener('click', () => {

        selectedDifficulty = btn.dataset.diff;

        try {
            localStorage.setItem(
                'buttonPanicDifficulty',
                selectedDifficulty
            );
        } catch (error) { /* ignore */ }

        renderDifficulty();

    });

});

renderDifficulty();


// ---------- Start a solo game (ranked when signed in) ----------

async function startSoloGame() {

    // A plain solo game is never a friend challenge
    currentChallengeId = null;
    currentSeed = null;
    currentPlayerSlot = 'player_a';
    currentSessionId = null;

    clearInterval(opponentCheckInterval);
    clearTimeout(opponentCheckTimeout);

    const buttons = [byId('startBtn'), byId('restartBtn')];

    buttons.forEach(b => { b.disabled = true; });

    if (currentUser && supabase) {

        try {

            const { data, error } = await withTimeout(
                supabase.rpc('bp_start_game', {
                    p_difficulty: selectedDifficulty
                }),
                5000
            );

            if (error) throw error;

            currentSessionId = data;

        } catch (error) {

            console.warn("Ranked game could not start:", error);

            currentSessionId = null;

        }

    }

    buttons.forEach(b => { b.disabled = false; });

    startGame();

}


// ---------- Save a solo result to the ranks ----------

async function recordSoloResult() {

    const msg = byId('rankMessage');

    if (!currentUser) {
        msg.textContent = "Sign in to save your scores to the ranks.";
        return;
    }

    if (!currentSessionId || !supabase) {
        msg.textContent =
            "This game was not ranked (the server could not be reached when it started).";
        return;
    }

    const sessionId = currentSessionId;

    currentSessionId = null;

    msg.textContent = "Saving your score…";

    try {

        const { data, error } = await withTimeout(
            supabase.rpc('bp_finish_game', {
                p_session: sessionId,
                p_rounds: roundsWon
            }),
            8000
        );

        if (error) throw error;

        if (!data || !data.accepted) {
            msg.textContent =
                "This score could not be verified, so it was not counted.";
        } else if (data.points === 0) {
            msg.textContent =
                "No rounds survived, so no points this time.";
        } else {
            msg.textContent =
                "✅ +" + data.points + " points saved to the ranks!";
        }

    } catch (error) {

        console.error("Saving score failed:", error);

        msg.textContent =
            "Could not save your score: " +
            (error.message || "please try again.");

    }

}


// ---------- Nickname prefill ----------

function prefillNicknames(step) {

    if (!currentProfile || !currentProfile.username) return;

    const name = String(currentProfile.username).slice(0, 15);

    if (step === stepCreate && !byId('playerNickname').value) {
        byId('playerNickname').value = name;
    }

    if (step === stepJoin && !byId('joinNickname').value) {
        byId('joinNickname').value = name;
    }

}


// ---------- Generic close buttons ----------

document.querySelectorAll('[data-close]').forEach(btn => {

    btn.addEventListener('click', () => {

        btn.closest('.overlay').classList.add('hidden');

    });

});


// ---------- Accounts ----------

let authMode = 'signin';

function updateAuthPill() {

    const pill = byId('authPill');

    if (currentUser) {

        pill.textContent =
            "👤 " + ((currentProfile && currentProfile.username) || "Player");

    } else {

        pill.textContent = "👤 Guest · Sign in";

    }

}

async function refreshUser(session) {

    currentUser = session ? session.user : null;

    currentProfile = null;

    updateAuthPill();

    if (currentUser && supabase) {

        try {

            const { data, error } = await supabase.rpc('bp_my_profile');

            if (error) throw error;

            currentProfile = data;

        } catch (error) {

            console.warn("Could not load profile:", error);

        }

        updateAuthPill();

    }

}

function setAuthMode(mode) {

    authMode = mode;

    const signup = mode === 'signup';

    byId('authTitle').textContent =
        signup ? "👤 Create account" : "👤 Sign in";

    byId('authSubmitBtn').textContent =
        signup ? "Create account" : "Sign in";

    byId('authToggleBtn').textContent =
        signup ? "Already have an account? Sign in"
               : "New here? Create an account";

    byId('authUsername').classList.toggle('hidden', !signup);

    byId('authPassword').autocomplete =
        signup ? 'new-password' : 'current-password';

    byId('authMessage').textContent = '';

}

function showAuthMessage(text, ok) {

    const el = byId('authMessage');

    el.textContent = text;

    el.classList.toggle('ok', !!ok);

}

function openAuthModal() {

    setAuthMode('signin');

    byId('authModal').classList.remove('hidden');

}

byId('authToggleBtn').addEventListener('click', () => {

    setAuthMode(authMode === 'signin' ? 'signup' : 'signin');

});

byId('authSubmitBtn').addEventListener('click', async () => {

    if (!supabase) {
        showAuthMessage("Cannot reach the server right now.");
        return;
    }

    const email = byId('authEmail').value.trim();
    const password = byId('authPassword').value;
    const username = byId('authUsername').value.trim();

    if (!email.includes('@')) {
        showAuthMessage("Enter a valid email.");
        return;
    }

    if (password.length < 6) {
        showAuthMessage("Password must be at least 6 characters.");
        return;
    }

    if (authMode === 'signup' && !/^[A-Za-z0-9_]{3,15}$/.test(username)) {
        showAuthMessage(
            "Username: 3-15 letters, numbers or underscores."
        );
        return;
    }

    const submit = byId('authSubmitBtn');

    submit.disabled = true;

    showAuthMessage("Please wait…", true);

    try {

        if (authMode === 'signup') {

            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: { data: { username: username } }
            });

            if (error) throw error;

            if (!data.session) {

                setAuthMode('signin');

                showAuthMessage(
                    "Account created! Check your email to confirm it, then sign in.",
                    true
                );

                return;

            }

        } else {

            const { error } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (error) throw error;

        }

        byId('authPassword').value = '';

        byId('authModal').classList.add('hidden');

    } catch (error) {

        showAuthMessage(error.message || "Something went wrong.");

    } finally {

        submit.disabled = false;

    }

});

byId('authPill').addEventListener('click', () => {

    if (currentUser) {
        openProfile();
    } else {
        openAuthModal();
    }

});


// ---------- Profile and trophies ----------

const TROPHIES = [

    { icon: '🥉', name: 'First Steps',
      desc: 'Finish your first ranked game',
      test: p => p.games >= 1 },

    { icon: '🎯', name: 'Warmed Up',
      desc: 'Survive 10 rounds in one game',
      test: p => p.best_rounds >= 10 },

    { icon: '🔥', name: 'On Fire',
      desc: 'Survive 25 rounds in one game',
      test: p => p.best_rounds >= 25 },

    { icon: '💪', name: 'Hard Hero',
      desc: 'Score 100+ in one Hard game',
      test: p => p.best_hard >= 100 },

    { icon: '💯', name: 'Point Collector',
      desc: 'Earn 1,000 points in total',
      test: p => p.total_points >= 1000 },

    { icon: '👑', name: 'Top 10',
      desc: 'Reach the global top 10',
      test: p => p.rank && p.rank <= 10 }

];

function makeEl(tag, className, text) {

    const el = document.createElement(tag);

    if (className) el.className = className;

    if (text !== undefined) el.textContent = text;

    return el;

}

function statCell(value, label) {

    const cell = makeEl('div', 'stat-cell');

    cell.appendChild(makeEl('b', '', String(value)));

    cell.appendChild(makeEl('span', '', label));

    return cell;

}

function renderProfile(p) {

    const body = byId('profileBody');

    body.replaceChildren();

    body.appendChild(makeEl('div', 'profile-name', p.username));

    const grid = makeEl('div', 'stat-grid');

    grid.appendChild(statCell(p.rank ? '#' + p.rank : '-', 'Global rank'));
    grid.appendChild(statCell(p.total_points, 'Total points'));
    grid.appendChild(statCell(p.games, 'Games'));
    grid.appendChild(statCell(p.best_rounds, 'Best rounds'));
    grid.appendChild(statCell(p.best_easy, 'Best easy'));
    grid.appendChild(statCell(p.best_medium, 'Best medium'));
    grid.appendChild(statCell(p.best_hard, 'Best hard'));

    body.appendChild(grid);

    body.appendChild(makeEl('div', 'trophy-title', 'TROPHIES'));

    const trophies = makeEl('div', 'trophy-grid');

    TROPHIES.forEach(t => {

        const unlocked = !!t.test(p);

        const card = makeEl('div', 'trophy' + (unlocked ? '' : ' locked'));

        card.appendChild(makeEl('span', 'icon', t.icon));
        card.appendChild(makeEl('b', '', t.name));
        card.appendChild(makeEl('span', '', t.desc));

        trophies.appendChild(card);

    });

    body.appendChild(trophies);

    const out = makeEl('button', 'menu-btn wide', 'SIGN OUT');

    out.addEventListener('click', async () => {

        try {
            await supabase.auth.signOut();
        } catch (error) {
            console.warn("Sign out failed:", error);
        }

        byId('profileModal').classList.add('hidden');

    });

    body.appendChild(out);

}

async function openProfile() {

    const body = byId('profileBody');

    byId('profileModal').classList.remove('hidden');

    body.replaceChildren();

    if (!currentUser) {

        body.appendChild(makeEl('p', '',
            "You're playing as a guest. Sign in to save your scores, earn trophies and appear in the ranks."));

        const btn = makeEl('button', 'start-btn', 'Sign in');

        btn.addEventListener('click', () => {
            byId('profileModal').classList.add('hidden');
            openAuthModal();
        });

        body.appendChild(btn);

        return;

    }

    body.appendChild(makeEl('p', '', 'Loading…'));

    try {

        const { data, error } = await withTimeout(
            supabase.rpc('bp_my_profile'),
            8000
        );

        if (error) throw error;

        if (!data) throw new Error('No profile');

        currentProfile = data;

        updateAuthPill();

        renderProfile(data);

    } catch (error) {

        console.error("Profile failed:", error);

        body.replaceChildren(makeEl('p', 'form-message',
            "Could not load your profile right now."));

    }

}

byId('profileBtn').addEventListener('click', openProfile);


// ---------- Leaderboard ----------

let lbPeriod = 'global';

async function loadLeaderboard(period) {

    lbPeriod = period;

    document.querySelectorAll('.tab-btn').forEach(tab => {
        tab.classList.toggle('selected', tab.dataset.period === period);
    });

    const list = byId('lbList');
    const status = byId('lbStatus');

    list.replaceChildren();

    status.textContent = "Loading…";

    if (!supabase) {
        status.textContent = "Cannot reach the server right now.";
        return;
    }

    try {

        const { data, error } = await withTimeout(
            supabase.rpc('bp_leaderboard', { p_period: period }),
            8000
        );

        if (error) throw error;

        if (period !== lbPeriod) return;

        const rows = data || [];

        status.textContent =
            rows.length ? "" : "No scores yet. Be the first!";

        rows.forEach(row => {

            const el = makeEl('div', 'lb-row' + (row.is_me ? ' me' : ''));

            const rank = Number(row.rank);

            const medal = rank === 1 ? '🥇'
                        : rank === 2 ? '🥈'
                        : rank === 3 ? '🥉'
                        : '#' + rank;

            el.appendChild(makeEl('span', 'lb-rank', medal));
            el.appendChild(makeEl('span', 'lb-name', row.username));
            el.appendChild(makeEl('span', 'lb-pts', row.points + ' pts'));

            list.appendChild(el);

        });

    } catch (error) {

        console.error("Leaderboard failed:", error);

        if (period === lbPeriod) {
            status.textContent = "Could not load the ranks right now.";
        }

    }

}

byId('ranksBtn').addEventListener('click', () => {

    byId('ranksModal').classList.remove('hidden');

    loadLeaderboard(lbPeriod);

});

document.querySelectorAll('.tab-btn').forEach(tab => {

    tab.addEventListener('click', () => {

        loadLeaderboard(tab.dataset.period);

    });

});


// ---------- Join with code ----------

byId('joinCodeBtn').addEventListener('click', () => {

    byId('codeMessage').textContent = '';

    challengeModal.classList.remove('hidden');

    showModalStep(stepCode);

});

byId('findChallengeBtn').addEventListener('click', async () => {

    const msg = byId('codeMessage');

    let code = byId('joinCodeInput').value
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '');

    if (/^\d{4}$/.test(code)) code = 'BP-' + code;

    if (!/^BP-\d{4}$/.test(code)) {
        msg.textContent = "Enter a code like BP-1234.";
        return;
    }

    if (!supabase) {
        msg.textContent = "Cannot reach the server right now.";
        return;
    }

    const button = byId('findChallengeBtn');

    button.disabled = true;

    msg.textContent = "Looking…";

    try {

        const { data: challenges, error } = await withTimeout(
            supabase
                .from('challenges')
                .select('id, seed, challenge_code')
                .eq('challenge_code', code)
                .limit(5),
            8000
        );

        if (error) throw error;

        if (!challenges || challenges.length === 0) {
            msg.textContent = "No challenge found with that code.";
            return;
        }

        const ids = challenges.map(c => c.id);

        const { data: taken, error: takenError } = await withTimeout(
            supabase
                .from('challenge_participants')
                .select('challenge_id, player_slot')
                .in('challenge_id', ids),
            8000
        );

        if (takenError) throw takenError;

        const takenIds = new Set(
            (taken || [])
                .filter(p => p.player_slot === 'player_b')
                .map(p => p.challenge_id)
        );

        const open = challenges.find(c => !takenIds.has(c.id));

        if (!open) {
            msg.textContent = "That challenge already has two players.";
            return;
        }

        currentChallengeId = open.id;
        currentSeed = Number(open.seed);
        currentPlayerSlot = 'player_b';

        updateModeBadge();

        msg.textContent = '';

        showModalStep(stepJoin);

    } catch (error) {

        console.error("Finding challenge failed:", error);

        msg.textContent =
            "Could not look up that code: " +
            (error.message || "please try again.");

    } finally {

        button.disabled = false;

    }

});


// ---------- Menu button on the game-over screen ----------

byId('menuBtn').addEventListener('click', () => {

    gameOverOverlay.classList.add('hidden');

    startOverlay.classList.remove('hidden');

    renderDifficulty();

});


// ---------- Watch sign-in state ----------

if (supabase && supabase.auth) {

    supabase.auth.onAuthStateChange((event, session) => {

        // Run later so we never call Supabase from inside its own callback
        setTimeout(() => refreshUser(session), 0);

    });

}


// ======================================================
// 27. INITIALIZE GAME
// ======================================================

readChallengeLink();


console.log("🚨 BUTTON PANIC GAME ENGINE LOADED SUCCESSFULLY!");
