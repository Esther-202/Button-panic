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

    const index = Math.floor(
        rng() * instructionsList.length
    );

    currentInstruction = instructionsList[index];

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
        1 - (score * 0.02)
    );

    roundTime =
        currentInstruction.duration * speedFactor;


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

        score += 10;

        scoreEl.textContent = score;


        // Update solo high score

        if (!currentChallengeId && score > highScore) {

            highScore = score;

            highScoreEl.textContent = highScore;

            try {

                localStorage.setItem(
                    'buttonPanicBest',
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