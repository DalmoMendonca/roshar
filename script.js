// Configuration - Get API key from Netlify function or local config
let OPENAI_API_KEY = '';

// Initialize API key
async function initializeAPIKey() {
    // Try local config first (for development)
    if (typeof window !== 'undefined' && window.CONFIG && window.CONFIG.OPENAI_API_KEY) {
        OPENAI_API_KEY = window.CONFIG.OPENAI_API_KEY;
        return;
    }

    // Try Netlify function (for production)
    try {
        const response = await fetch('/.netlify/functions/get-api-key');
        const data = await response.json();
        OPENAI_API_KEY = data.apiKey || '';
    } catch (error) {
        console.error('Failed to get API key:', error);
        OPENAI_API_KEY = '';
    }
}

// API URLs - Using current Responses API
const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const OPENAI_FILES_URL = 'https://api.openai.com/v1/files';

// Bio field mappings
const BIO_FIELDS = [
    'appearance', 'background', 'personality', 'affiliations',
    'catchphrase', 'languageQuirks', 'superstitions', 'diet',
    'secrets', 'characterFlaws', 'whatExcites', 'dynamicGoals',
    'mostWant', 'wontDo'
];

// History tracking for bio fields
const fieldHistory = {};

// Initialize history for each bio field
BIO_FIELDS.forEach(field => {
    fieldHistory[field] = [];
});

// Robust JSON parsing function for AI responses
function parseAIResponse(outputText) {
    if (!outputText || typeof outputText !== 'string') {
        throw new Error('Invalid output text');
    }

    // Clean up the text
    let cleanText = outputText.trim();

    // Remove markdown code blocks if present
    cleanText = cleanText.replace(/^```json\s*/, '').replace(/\s*```$/, '');
    cleanText = cleanText.replace(/^```\s*/, '').replace(/\s*```$/, '');

    // Try multiple parsing strategies
    const strategies = [
        // Strategy 1: Direct JSON.parse
        () => JSON.parse(cleanText),

        // Strategy 2: Fix common escape issues
        () => {
            let fixed = cleanText
                .replace(/\\"/g, '\u0022')  // Replace \" with unicode quote
                .replace(/\\n/g, '\\n')     // Keep newlines escaped
                .replace(/\\t/g, '\\t');    // Keep tabs escaped
            return JSON.parse(fixed);
        },

        // Strategy 3: Replace problematic quotes in dialogue
        () => {
            let fixed = cleanText.replace(
                /"([^"]*\\[^"]*[^"]*?)"/g,
                (match, content) => {
                    // Replace internal quotes with single quotes
                    return '"' + content.replace(/\\"/g, "'").replace(/"/g, "'") + '"';
                }
            );
            return JSON.parse(fixed);
        },

        // Strategy 4: Manual quote fixing for catchphrases and dialogue
        () => {
            let fixed = cleanText.replace(
                /"catchphrase":\s*"([^"]*?)\\+"([^"]*?)"/g,
                '"catchphrase": "$1\'$2"'
            );
            return JSON.parse(fixed);
        }
    ];

    // Try each strategy
    for (let i = 0; i < strategies.length; i++) {
        try {
            const result = strategies[i]();
            console.log('JSON parsing succeeded with strategy ' + (i + 1));
            return result;
        } catch (error) {
            console.log('Strategy ' + (i + 1) + ' failed:', error.message);
            if (i === strategies.length - 1) {
                // Last strategy failed, log the problematic text
                console.error('All parsing strategies failed. Raw text:', cleanText);
                throw new Error(`JSON parsing failed after ${strategies.length} attempts: ${error.message}`);
            }
        }
    }
}

// DOM elements
const generateBioBtn = document.getElementById('generateBio');
const generateImageBtn = document.getElementById('generateImage');
const downloadBioBtn = document.getElementById('downloadBio');
const imageContainer = document.getElementById('imageContainer');
const characterImage = document.getElementById('characterImage');
const helpButton = document.getElementById('helpButton');
const helpModal = document.getElementById('helpModal');
const closeModal = document.getElementById('closeModal');
const refineImageBtn = document.getElementById('refineImage');
const imageInstructions = document.getElementById('imageInstructions');
const referenceImage = document.getElementById('referenceImage');

// Track current version index for each field
const currentVersionIndex = {};
BIO_FIELDS.forEach(field => {
    currentVersionIndex[field] = 0;
});

// Event listeners
generateBioBtn.addEventListener('click', generateBio);
generateImageBtn.addEventListener('click', generateImage);
downloadBioBtn.addEventListener('click', downloadBio);
refineImageBtn.addEventListener('click', refineImage);

// Help modal functionality
helpButton.addEventListener('click', () => {
    helpModal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
});

closeModal.addEventListener('click', () => {
    helpModal.style.display = 'none';
    document.body.style.overflow = 'auto'; // Restore scrolling
});

// Close modal when clicking outside of it
helpModal.addEventListener('click', (e) => {
    if (e.target === helpModal) {
        helpModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
});

// Close modal with Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && helpModal.style.display === 'flex') {
        helpModal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
});

// Initialize alignment grid
const alignmentGrid = document.getElementById('alignmentGrid');
const alignmentInput = document.getElementById('alignment');

if (alignmentGrid && alignmentInput) {
    alignmentGrid.addEventListener('click', (e) => {
        const tile = e.target.closest('.alignment-tile');
        if (!tile) return;

        const alignment = tile.dataset.alignment;
        const isSelected = tile.classList.contains('selected');

        // Clear all selections
        alignmentGrid.querySelectorAll('.alignment-tile').forEach(t => {
            t.classList.remove('selected');
        });

        // If it wasn't selected, select it
        if (!isSelected) {
            tile.classList.add('selected');
            alignmentInput.value = alignment;
        } else {
            // If it was selected, unselect it
            alignmentInput.value = '';
        }
    });
}

// Initialize version controls and field tracking
BIO_FIELDS.forEach(field => {
    const element = document.getElementById(field);
    const prevBtn = document.getElementById(`${field}-prev`);
    const nextBtn = document.getElementById(`${field}-next`);

    if (element && prevBtn && nextBtn) {
        // Track user edits to change visual state (no version creation)
        element.addEventListener('input', () => onFieldEdit(field));

        // Version navigation
        prevBtn.addEventListener('click', () => navigateVersion(field, -1));
        nextBtn.addEventListener('click', () => navigateVersion(field, 1));

        // Add modal expansion for textareas
        if (element.tagName === 'TEXTAREA') {
            addModalExpansion(field, element);
        }
    }
});

// Collect all form data
function collectFormData() {
    const formData = {};

    // Character Sheet fields
    const characterSheetFields = [
        'playerName', 'characterName', 'sex', 'level', 'ancestry', 'alignment',
        'strength', 'speed', 'intellect', 'willpower', 'awareness', 'presence',
        'health', 'focus', 'marks', 'liftingCapacity', 'movement', 'recoveryDie',
        'sensesRange', 'conditionsInjuries', 'expertises', 'talents',
        'weapons', 'armorEquipment', 'connections'
    ];

    characterSheetFields.forEach(field => {
        const element = document.getElementById(field);
        formData[field] = element ? element.value : '';
    });

    // Character Bio fields
    BIO_FIELDS.forEach(field => {
        const element = document.getElementById(field);
        formData[field] = element ? element.value : '';
    });

    return formData;
}

// Upload the Welcome to Roshar PDF (the only one under 32MB limit)
// Note: Using pre-uploaded file ID to avoid repeated uploads

// Generate character bio using OpenAI Responses API
async function generateBio() {
    // Initialize API key if not already done
    if (!OPENAI_API_KEY) {
        await initializeAPIKey();
    }

    if (!OPENAI_API_KEY) {
        alert('API key not configured. Please set your OpenAI API key in the script.');
        return;
    }

    const formData = collectFormData();

    // Show loading state and lock all fields
    generateBioBtn.disabled = true;

    // Show progress indicator
    const progressIndicator = document.getElementById('aiProgress');
    const progressFill = progressIndicator.querySelector('.progress-fill');
    const progressText = progressIndicator.querySelector('.progress-text');
    progressIndicator.style.display = 'block';

    // Start progress animation with time tracking
    let progressDots = 0;
    let elapsedSeconds = 0;
    const startTime = Date.now();
    const progressMessages = [
        'Researching Roshar lore',
        'Analyzing cultural backgrounds',
        'Exploring social structures',
        'Mapping regional details',
        'Investigating historical events',
        'Crafting character elements',
        'Synthesizing final details'
    ];
    let messageIndex = 0;

    const updateProgress = () => {
        progressDots = (progressDots + 1) % 4;
        const dots = '.'.repeat(progressDots);
        const spaces = '\u00A0'.repeat(3 - progressDots);

        elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        const timeDisplay = elapsedSeconds < 60 ? `${elapsedSeconds}s` : `${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s`;

        // Simulate progress (reaches ~80% after 10 minutes, then slows down)
        const progressPercent = Math.min(95, (elapsedSeconds / 600) * 80 + (elapsedSeconds > 600 ? (elapsedSeconds - 600) / 1800 * 15 : 0));

        generateBioBtn.textContent = 'Generating...';
        progressFill.style.width = `${progressPercent}%`;
        progressText.textContent = `${progressMessages[messageIndex]} - ${timeDisplay}`;
    };

    // Update dots every 500ms, message every 4 seconds
    const dotInterval = setInterval(updateProgress, 500);
    const messageInterval = setInterval(() => {
        messageIndex = (messageIndex + 1) % progressMessages.length;
    }, 4000);

    // Store intervals for cleanup
    generateBioBtn.dotInterval = dotInterval;
    generateBioBtn.messageInterval = messageInterval;

    // Start immediately
    updateProgress();

    // Lock all bio fields during generation
    BIO_FIELDS.forEach(field => {
        const element = document.getElementById(field);
        if (element) {
            element.disabled = true;
            element.style.opacity = '0.6';
        }
    });

    try {
        // Use the pre-uploaded Welcome to Roshar PDF file
        const pdfFileIds = ['file-3VQDhPG6m61qHiGuwfFZ2x'];

        console.log('🚀 Initializing Enhanced AI Agent with:');
        console.log('📚 Vector Store: vs_68f837113fb481918c561f76853b87be (3 large PDFs)');
        console.log('📄 Direct File: file-3VQDhPG6m61qHiGuwfFZ2x (Welcome to Roshar)');
        console.log('🧠 Reasoning Level: Medium');
        console.log('🔍 Max Search Results: 15');

        // Update button text to show research phase
        generateBioBtn.textContent = 'Researching...';

        // Create the input for the enhanced agentic AI using Responses API format
        const input = createEnhancedBioInput(formData, pdfFileIds);

        // Debug: Log the input structure
        console.log('📝 API Input structure:', JSON.stringify(input, null, 2));

        let response;
        let attemptCount = 0;
        const maxAttempts = 3;

        // Try the API call with fallback strategies
        while (attemptCount < maxAttempts) {
            attemptCount++;
            let currentInput = input;

            // If this isn't the first attempt, try with fewer files
            if (attemptCount === 2 && pdfFileIds.length > 1) {
                console.log('🔄 Retrying with simplified approach...');
                currentInput = createEnhancedBioInput(formData, [pdfFileIds[0]]);
            } else if (attemptCount === 3) {
                console.log('🔄 Final attempt with core knowledge only...');
                currentInput = createEnhancedBioInput(formData, []);
            }
            // Keep button text simple throughout
            generateBioBtn.textContent = 'Generating...';

            try {
                response = await fetch(OPENAI_RESPONSES_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${OPENAI_API_KEY}`
                    },
                    body: JSON.stringify({
                        model: 'gpt-5',
                        reasoning: { effort: 'medium' },
                        input: currentInput,
                        tools: [
                            {
                                type: "file_search",
                                vector_store_ids: ["vs_68f837113fb481918c561f76853b87be"],
                                max_num_results: 15
                            }
                        ],
                        instructions: `You are an expert Stormlight Archive character creation agent with access to comprehensive worldbuilding materials through both uploaded files and searchable knowledge bases.

🎲 CAMPAIGN CONTEXT - CRITICAL:
- Creating Level 1 characters for the STONEWALKERS ADVENTURE campaign
- Timeline: The EVERSTORM has NOT yet happened - this is pre-everstorm Roshar
- Characters are brand new adventurers who have never used stormlight
- Characters have never been approached by a Spren for a nahel bond
- This is the traditional Roshar before the major upheavals of the later books

🔍 RESEARCH METHODOLOGY:
1. ANALYZE the provided character stats and any existing bio information
2. SEARCH the knowledge base for relevant cultural, geographical, and social information
3. RESEARCH character archetypes, naming conventions, and cultural practices
4. CROSS-REFERENCE findings with uploaded reference documents
5. SYNTHESIZE all information into a cohesive, lore-accurate character

🎯 RESEARCH PRIORITIES:
- Cultural backgrounds and customs relevant to character ancestry/location
- Social structures, hierarchies, and occupations appropriate for Level 1 characters
- Regional characteristics, climate, and geography  
- Historical events that might shape the character's background (pre-everstorm)
- Religious practices, superstitions, and beliefs
- Language patterns, naming conventions, and cultural quirks
- Economic systems, trade, and daily life details
- Appropriate starting backgrounds for new adventurers
- Moral and ethical frameworks that align with the character's alignment

⚡ AGENTIC WORKFLOW:
1. First, search for information about the character's ancestry, region, or any specified background elements
2. Research cultural practices, social norms, and typical character archetypes for that background
3. Look up relevant historical events, conflicts, or social issues that could inform the character's story (remembering this is pre-everstorm)
4. Search for examples of similar characters or cultural elements in the source material
5. Synthesize all research into authentic, detailed character elements appropriate for Level 1 adventurers

🎨 CHARACTER CREATION PRINCIPLES:
- Every detail should feel authentic to pre-everstorm Roshar's culture and magic system
- Characters should be appropriate for Level 1 adventurers starting their journey
- Characters have no prior experience with stormlight or spren bonds
- Include specific cultural details that demonstrate deep knowledge of the setting
- Create meaningful secrets and flaws that could drive interesting storylines
- Ensure character goals and motivations align with traditional Rosharan values and conflicts
- Remember this is the "old world" before the major changes of the everstorm

IMPORTANT: Return ONLY a valid JSON object. Use your research to create rich, detailed, lore-accurate content for Level 1 Stonewalkers Adventure characters.

{
    "appearance": "detailed physical description with cultural/regional specifics",
    "background": "comprehensive history incorporating researched cultural and historical elements", 
    "personality": "character traits reflecting cultural background and personal experiences",
    "affiliations": "specific organizations, groups, or loyalties based on research",
    "catchphrase": "culturally appropriate saying reflecting character's background",
    "languageQuirks": "speech patterns specific to region/culture/background",
    "superstitions": "beliefs and rituals authentic to Rosharan culture",
    "diet": "food preferences reflecting regional availability and cultural norms",
    "secrets": "meaningful secrets that tie into broader world conflicts and lore; at least one minor and one major secret that could shape the story and/or gameplay",
    "characterFlaws": "flaws that create interesting story potential and character growth",
    "whatExcites": "motivations that connect to larger world themes and conflicts",
    "dynamicGoals": "objectives that could evolve with campaign events",
    "mostWant": "desires that reflect both personal and cultural values",
    "wontDo": "moral boundaries shaped by cultural background and personal ethics"
}`
                    })
                });

                if (response.ok) {
                    console.log(`✅ API call successful on attempt ${attemptCount}`);
                    break;
                } else {
                    const errorText = await response.text();
                    console.warn(`❌ Attempt ${attemptCount} failed: ${response.status} - ${errorText}`);
                    if (attemptCount === maxAttempts) {
                        throw new Error(`API request failed after ${maxAttempts} attempts: ${response.status} - ${errorText}`);
                    }
                }
            } catch (error) {
                console.error(`❌ Attempt ${attemptCount} error:`, error);
                if (attemptCount === maxAttempts) {
                    throw error;
                }
            }

            // Wait a bit before retrying
            if (attemptCount < maxAttempts) {
                console.log('⏳ Waiting 1 second before retry...');
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API request failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        // Extract JSON from the response with robust error handling
        let bioData;
        try {
            // Find the message output in the response
            const messageOutput = data.output?.find(item => item.type === 'message');
            if (messageOutput && messageOutput.content && messageOutput.content[0]) {
                bioData = parseAIResponse(messageOutput.content[0].text);
            } else {
                throw new Error('No message content found in response');
            }
        } catch (parseError) {
            console.error('Error parsing response:', parseError);
            console.log('Full response:', data);
            alert('Error parsing AI response. Please try generating again.');
            return;
        }

        // Show completion mesds withiefly
        generateBioBtn.textContent = 'Generated!';

        // Update the bio fields with AI-generated content
        updateBioFields(bioData);
        // Show secondary actions
        generateImageBtn.style.display = 'block';
        downloadBioBtn.style.display = 'block';

    } catch (error) {
        console.error('Error generating bio:', error);
        alert(`Error generating bio: ${error.message}`);
    } finally {
        // Clean up progress intervals and hide indicator
        if (generateBioBtn.dotInterval) {
            clearInterval(generateBioBtn.dotInterval);
            delete generateBioBtn.dotInterval;
        }
        if (generateBioBtn.messageInterval) {
            clearInterval(generateBioBtn.messageInterval);
            delete generateBioBtn.messageInterval;
        }

        // Hide progress indicator
        const progressIndicator = document.getElementById('aiProgress');
        if (progressIndicator) {
            progressIndicator.style.display = 'none';
        }

        // Reset button state and unlock all fields
        generateBioBtn.disabled = false;
        generateBioBtn.textContent = 'Generate Bio';


        BIO_FIELDS.forEach(field => {
            const element = document.getElementById(field);
            if (element) {
                element.disabled = false;
                element.style.opacity = '1';
            }
        });
    }
}

// Create enhanced input for agentic bio generation using Responses API format
function createEnhancedBioInput(formData, pdfFileIds) {
    const content = [
        {
            type: "input_text",
            text: `You are an expert Stormlight Archive character creation agent. Research the knowledge base thoroughly to create an authentic, detailed Level 1 character bio for the STONEWALKERS ADVENTURE campaign based on the following information:

🎲 STONEWALKERS ADVENTURE CHARACTER REQUEST:
⚠️ IMPORTANT: This is a Level 1 character for the pre-everstorm timeline. The everstorm has NOT happened yet. Characters have no stormlight experience or spren bonds.

CHARACTER SHEET:
Player Name: ${formData.playerName || 'Not specified'}
Character Name: ${formData.characterName || 'Not specified'}
Sex: ${formData.sex || 'Not specified'}
Level: ${formData.level || 'Not specified'}
Ancestry: ${formData.ancestry || 'Not specified'}
Alignment: ${formData.alignment || 'Not specified'}

Attributes:
- Strength: ${formData.strength || 'Not specified'}
- Speed: ${formData.speed || 'Not specified'}
- Intellect: ${formData.intellect || 'Not specified'}
- Willpower: ${formData.willpower || 'Not specified'}
- Awareness: ${formData.awareness || 'Not specified'}
- Presence: ${formData.presence || 'Not specified'}

Stats:
- Health: ${formData.health || 'Not specified'}
- Focus: ${formData.focus || 'Not specified'}
- Marks: ${formData.marks || 'Not specified'}
- Lifting Capacity: ${formData.liftingCapacity || 'Not specified'}
- Movement: ${formData.movement || 'Not specified'}
- Recovery Die: ${formData.recoveryDie || 'Not specified'}
- Senses Range: ${formData.sensesRange || 'Not specified'}

Other Details:
- Conditions & Injuries: ${formData.conditionsInjuries || 'None specified'}
- Expertises: ${formData.expertises || 'Not specified'}
- Talents: ${formData.talents || 'Not specified'}
- Weapons: ${formData.weapons || 'Not specified'}
- Armor & Equipment: ${formData.armorEquipment || 'Not specified'}
- Connections: ${formData.connections || 'Not specified'}

🎭 EXISTING CHARACTER ELEMENTS (enhance/expand these):
- Appearance: ${formData.appearance || 'Research and generate based on ancestry/region and Character Sheet details.'}
- Background: ${formData.background || 'Research cultural background and create detailed history, at least 2 paragraphs long'}
- Personality: ${formData.personality || 'Generate based on cultural norms and personal experiences'}
- Affiliations: ${formData.affiliations || 'Research relevant organizations and create connections'}
- Catchphrase: ${formData.catchphrase || 'Create culturally appropriate saying'}
- Language Quirks: ${formData.languageQuirks || 'Research regional speech patterns'}
- Superstitions: ${formData.superstitions || 'Research cultural beliefs and practices'}
- Diet: ${formData.diet || 'Research regional food culture and preferences'}
- Secrets: ${formData.secrets || 'Create meaningful secrets tied to world lore'}
- Character Flaws: ${formData.characterFlaws || 'Generate flaws that create story potential'}
- What Excites: ${formData.whatExcites || 'Connect to broader world themes and conflicts'}
- Dynamic Goals: ${formData.dynamicGoals || 'Create goals that can evolve with campaign'}
- Most Want: ${formData.mostWant || 'Generate desires reflecting cultural values'}
- Won't Do: ${formData.wontDo || 'Create moral boundaries based on background'}

🔍 RESEARCH INSTRUCTIONS:
1. If ancestry is specified, research that culture's customs, appearance, and social norms
2. If no ancestry is given, research various Rosharan cultures and select an appropriate one
3. Look up relevant geographical regions, their characteristics, and how they shape inhabitants
4. Research historical events, conflicts, and social issues that could inform the character's background (PRE-EVERSTORM)
5. Find examples of naming conventions, cultural practices, and typical occupations for Level 1 adventurers
6. Search for information about relevant organizations, religions, or social groups
7. If alignment is specified, ensure character traits, motivations, and moral choices reflect that alignment
8. Remember this character is just starting their adventure - no stormlight powers or spren bonds
9. Use all research to create a character that feels authentically part of the traditional Stormlight Archive world

Generate a comprehensive, research-backed Level 1 character for the Stonewalkers Adventure that demonstrates deep knowledge of pre-everstorm Roshar's cultures, history, and social structures.` }
    ];

    // Add all successfully uploaded PDF files
    if (pdfFileIds && pdfFileIds.length > 0) {
        pdfFileIds.forEach(fileId => {
            content.push({
                type: "input_file",
                file_id: fileId
            });
        });
    }

    return [{
        role: "user",
        content: content
    }];
}

// Handle field edits (visual state only, no version creation)
function onFieldEdit(field) {
    const element = document.getElementById(field);
    if (element) {
        // Remove purple background when user edits
        element.classList.remove('ai-generated');
        element.classList.add('user-edited');
    }
}

// Save AI-generated version with proper original state capture
function saveAIVersionWithOriginal(field, originalValue, aiValue) {
    const history = fieldHistory[field];

    console.log('Saving versions for ' + field + ':', {
        originalValue: '"' + originalValue + '"',
        aiValue: '"' + aiValue + '"',
        historyLength: history.length
    });

    // Always save the original state as version 1 if history is empty
    if (history.length === 0) {
        const version1 = {
            value: originalValue,
            timestamp: new Date(),
            type: originalValue.trim() ? 'user' : 'blank'
        };
        history.push(version1);
        console.log('Added version 1 for ' + field + ':', version1);
    } else {
        // Save original value if it's different from the last saved version
        const lastVersion = history[history.length - 1];
        if (originalValue !== lastVersion.value) {
            const newVersion = {
                value: originalValue,
                timestamp: new Date(),
                type: originalValue.trim() ? 'user' : 'blank'
            };
            history.push(newVersion);
            console.log('Added intermediate version for ' + field + ':', newVersion);
        }
    }

    // Only add AI version if it's different from the last version
    const lastVersion = history[history.length - 1];
    if (aiValue !== lastVersion.value) {
        const aiVersion = {
            value: aiValue,
            timestamp: new Date(),
            type: 'ai'
        };
        history.push(aiVersion);
        console.log('Added AI version for ' + field + ':', aiVersion);
    }

    console.log('Final history for ' + field + ':', history);

    // Update current index to the latest version
    currentVersionIndex[field] = history.length - 1;
    updateVersionControls(field);
}

// Legacy function for backward compatibility
function saveAIVersion(field, value) {
    const element = document.getElementById(field);
    const originalValue = element ? element.value : '';
    saveAIVersionWithOriginal(field, originalValue, value);
}

// Navigate between versions
function navigateVersion(field, direction) {
    const history = fieldHistory[field];
    if (history.length <= 1) return;

    const newIndex = currentVersionIndex[field] + direction;
    if (newIndex >= 0 && newIndex < history.length) {
        currentVersionIndex[field] = newIndex;
        const element = document.getElementById(field);

        // Set value exactly as stored, including empty strings and null
        const storedValue = history[newIndex].value;
        const newValue = storedValue === null || storedValue === undefined ? '' : storedValue;

        console.log('Navigating ' + field + ' to version ' + (newIndex + 1) + ':', {
            storedValue: '"' + storedValue + '"',
            newValue: '"' + newValue + '"',
            type: history[newIndex].type
        });

        // Multiple approaches to ensure the value updates
        element.value = newValue;
        element.setAttribute('value', newValue);

        // Force visual update by triggering multiple events
        element.dispatchEvent(new Event('input', { bubbles: true }));
        element.dispatchEvent(new Event('change', { bubbles: true }));

        // Force DOM update
        requestAnimationFrame(() => {
            element.value = newValue;
            console.log('After requestAnimationFrame, ' + field + ' value is: "' + element.value + '"');
        });

        // Update visual state
        updateFieldVisualState(field, history[newIndex].type);
        updateVersionControls(field);
    }
}

// Update version controls display
function updateVersionControls(field) {
    const history = fieldHistory[field];
    const versionControls = document.getElementById(`${field}-versions`);
    const counter = document.getElementById(`${field}-counter`);
    const prevBtn = document.getElementById(`${field}-prev`);
    const nextBtn = document.getElementById(`${field}-next`);

    if (history.length > 1) {
        versionControls.style.display = 'flex';
        counter.textContent = `${currentVersionIndex[field] + 1}/${history.length}`;

        // Enable/disable navigation buttons
        prevBtn.disabled = currentVersionIndex[field] === 0;
        nextBtn.disabled = currentVersionIndex[field] === history.length - 1;
    } else {
        versionControls.style.display = 'none';
    }
}

// Update visual state of field
function updateFieldVisualState(field, type) {
    const element = document.getElementById(field);

    if (type === 'ai') {
        element.classList.add('ai-generated');
        element.classList.remove('user-edited');
    } else {
        element.classList.remove('ai-generated');
        element.classList.add('user-edited');
    }
}

// Update bio fields with AI-generated content
function updateBioFields(bioData) {
    BIO_FIELDS.forEach(field => {
        if (bioData[field]) {
            const element = document.getElementById(field);

            if (element) {
                // FIRST: Capture the original state before changing anything
                const originalValue = element.value;

                // Save versions in correct order
                saveAIVersionWithOriginal(field, originalValue, bioData[field]);

                // THEN: Update with AI content
                element.value = bioData[field];

                // Update visual state
                updateFieldVisualState(field, 'ai');
            }
        }
    });
}

// Generate character image using GPT-Image-1 via Responses API
async function generateImage() {
    // Initialize API key if not already done
    if (!OPENAI_API_KEY) {
        await initializeAPIKey();
    }

    if (!OPENAI_API_KEY) {
        alert('API key not configured. Please set your OpenAI API key in the script.');
        return;
    }

    const formData = collectFormData();

    generateImageBtn.disabled = true;
    generateImageBtn.textContent = 'Generating...';

    try {
        const imagePrompt = createImagePrompt(formData);

        const response = await fetch(OPENAI_RESPONSES_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-5-nano',
                input: imagePrompt,
                tools: [{
                    type: "image_generation"
                }]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Image generation failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        // Find the image generation result in the output
        const imageOutput = data.output?.find(item => item.type === 'image_generation_call');
        if (imageOutput && imageOutput.result) {
            // Convert base64 to blob URL for display
            const base64Data = imageOutput.result;
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/png' });
            const imageUrl = URL.createObjectURL(blob);

            // Display the generated image
            characterImage.src = imageUrl;
            imageContainer.style.display = 'grid'; //GRID, not BLOCK!!!
        } else {
            throw new Error('No image found in response');
        }

    } catch (error) {
        console.error('Error generating image:', error);
        alert(`Error generating image: ${error.message}`);
    } finally {
        generateImageBtn.disabled = false;
        generateImageBtn.textContent = 'Generate Image';
    }
}

// Create image generation prompt
function createImagePrompt(formData, additionalInstructions = '', hasReference = false) {
    let prompt = `Generate a detailed D&D-style character portrait of ${formData.characterName || 'a character'} from the world of Roshar (Stormlight Archive). A person with ${formData.sex || 'neutral'} features. The character should be depicted in a fantasy art style similar to D&D character portraits, with rich colors and detailed clothing appropriate to the Roshar setting. The background should suggest the world of Roshar with its unique architecture and environment featuring crystalline formations and storm-carved landscapes. High quality, detailed fantasy art, professional illustration style with vibrant colors and dramatic lighting.
    Appearance: ${formData.appearance}
    `;

    if (additionalInstructions) {
        prompt += ` Additional refining requirements: ${additionalInstructions}`;
    }

    if (hasReference) {
        prompt += ` Make the character's facial features and overall appearance resemble the provided reference image while maintaining the fantasy art style.`;
    }

    return prompt;
}

// Refine existing image
async function refineImage() {
    // Initialize API key if not already done
    if (!OPENAI_API_KEY) {
        await initializeAPIKey();
    }

    if (!OPENAI_API_KEY) {
        alert('API key not configured. Please set your OpenAI API key in the script.');
        return;
    }

    const formData = collectFormData();
    const additionalInstructions = imageInstructions.value.trim();
    const referenceFile = referenceImage.files[0];

    if (!additionalInstructions && !referenceFile) {
        alert('Please provide additional instructions or upload a reference image to refine the portrait.');
        return;
    }

    refineImageBtn.disabled = true;
    refineImageBtn.textContent = 'Refining...';

    try {
        const imagePrompt = createImagePrompt(formData, additionalInstructions, !!referenceFile);

        // Prepare the input content
        const content = [
            {
                type: "input_text",
                text: imagePrompt
            }
        ];

        // Add reference image if provided
        if (referenceFile) {
            const base64Image = await fileToBase64(referenceFile);
            content.push({
                type: "input_image",
                image_url: `data:${referenceFile.type};base64,${base64Image}`
            });
        }

        const response = await fetch(OPENAI_RESPONSES_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${OPENAI_API_KEY}`
            },
            body: JSON.stringify({
                model: 'gpt-5-nano',
                input: [{
                    role: "user",
                    content: content
                }],
                tools: [{
                    type: "image_generation"
                }]
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Image refinement failed: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        // Find the image generation result in the output
        const imageOutput = data.output?.find(item => item.type === 'image_generation_call');
        if (imageOutput && imageOutput.result) {
            // Convert base64 to blob URL for display
            const base64Data = imageOutput.result;
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/png' });
            const imageUrl = URL.createObjectURL(blob);

            // Display the refined image
            characterImage.src = imageUrl;

            // Clear the refinement inputs
            imageInstructions.value = '';
            referenceImage.value = '';
        } else {
            throw new Error('No image found in response');
        }

    } catch (error) {
        console.error('Error refining image:', error);
        alert(`Error refining image: ${error.message}`);
    } finally {
        refineImageBtn.disabled = false;
        refineImageBtn.textContent = 'Refine Image';
    }
}

// Helper function to convert file to base64
function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => {
            const base64 = reader.result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = error => reject(error);
    });
}

// Download bio as PDF
async function downloadBio() {
    const formData = collectFormData();

    downloadBioBtn.disabled = true;
    downloadBioBtn.textContent = 'Generating PDF...';

    try {
        // Create PDF using jsPDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        // Set up fonts and colors
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(20);
        doc.setTextColor(44, 90, 160); // Primary color

        // Title
        const title = formData.characterName || 'Character Bio';
        doc.text(title, 105, 20, { align: 'center' });

        // Add character image if available - high quality and properly sized
        let yPosition = 40;
        let imageHeight = 0;
        if (characterImage.src && !characterImage.src.includes('data:')) {
            try {
                // Convert image to base64 for PDF with maximum quality
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                const img = new Image();
                img.crossOrigin = 'anonymous';

                await new Promise((resolve, reject) => {
                    img.onload = () => {
                        // Ultra high quality canvas for crisp PDF images
                        const aspectRatio = img.width / img.height;
                        let canvasWidth = 1200; // Ultra high resolution
                        let canvasHeight = 1200;

                        if (aspectRatio > 1) {
                            canvasHeight = canvasWidth / aspectRatio;
                        } else {
                            canvasWidth = canvasHeight * aspectRatio;
                        }

                        canvas.width = canvasWidth;
                        canvas.height = canvasHeight;

                        // Use high-quality image rendering
                        ctx.imageSmoothingEnabled = true;
                        ctx.imageSmoothingQuality = 'high';
                        ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
                        const imageData = canvas.toDataURL('image/png'); // PNG for maximum quality

                        // Larger, properly sized image for professional look
                        const pdfWidth = 80; // Larger size
                        const pdfHeight = 80 / aspectRatio;
                        imageHeight = pdfHeight;

                        doc.addImage(imageData, 'PNG', 20, yPosition, pdfWidth, pdfHeight);
                        resolve();
                    };
                    img.onerror = reject;
                    img.src = characterImage.src;
                });
            } catch (error) {
                console.log('Could not add image to PDF:', error);
            }
        }

        // Character Sheet Section with proper text wrapping around image
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(139, 69, 19); // Secondary color
        doc.text('Character Sheet', 20, yPosition - 10);
        yPosition += 10;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);

        // Text wrapping around image - calculate positions
        const imageWidth = 80;
        const textStartX = imageHeight > 0 ? 20 + imageWidth + 15 : 20; // Start text to right of image with padding
        const textWidth = 190 - imageWidth - 15; // Remaining width for text
        const imageBottomY = yPosition + imageHeight;

        const characterInfo = [
            `Player: ${formData.playerName || 'N/A'}`,
            `Sex: ${formData.sex || 'N/A'}`,
            `Level: ${formData.level || 'N/A'}`,
            `Ancestry: ${formData.ancestry || 'N/A'}`
        ];

        // Place character info next to image if image exists
        const infoStartX = imageHeight > 0 ? textStartX : 20;
        characterInfo.forEach(info => {
            doc.text(info, infoStartX, yPosition);
            yPosition += 6;
        });

        yPosition += 5;

        // Attributes next to image
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('Attributes', infoStartX, yPosition);
        yPosition += 8;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);

        const attributes = [
            `Strength: ${formData.strength || 'N/A'}`,
            `Speed: ${formData.speed || 'N/A'}`,
            `Intellect: ${formData.intellect || 'N/A'}`,
            `Willpower: ${formData.willpower || 'N/A'}`,
            `Awareness: ${formData.awareness || 'N/A'}`,
            `Presence: ${formData.presence || 'N/A'}`
        ];

        // Display attributes in single column next to image
        attributes.forEach(attr => {
            doc.text(attr, infoStartX, yPosition);
            yPosition += 6;
        });

        // Ensure we're below the image before continuing
        if (imageHeight > 0) {
            yPosition = Math.max(yPosition, imageBottomY + 10);
        }

        // Other stats in full width below image
        yPosition += 10;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.text('Other Details', 20, yPosition);
        yPosition += 8;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);

        const otherStats = [
            `Health: ${formData.health || 'N/A'}`,
            `Focus: ${formData.focus || 'N/A'}`,
            `Marks: ${formData.marks || 'N/A'}`,
            `Lifting Capacity: ${formData.liftingCapacity || 'N/A'}`,
            `Movement: ${formData.movement || 'N/A'}`,
            `Recovery Die: ${formData.recoveryDie || 'N/A'}`,
            `Senses Range: ${formData.sensesRange || 'N/A'}`,
            `Expertises: ${formData.expertises || 'N/A'}`,
            `Talents: ${formData.talents || 'N/A'}`
        ];

        // Display other stats in two columns
        for (let i = 0; i < otherStats.length; i += 2) {
            doc.text(otherStats[i], 20, yPosition);
            if (otherStats[i + 1]) {
                doc.text(otherStats[i + 1], 110, yPosition);
            }
            yPosition += 6;
        }

        yPosition += 10;

        // Add page break before Character Bio
        doc.addPage();
        yPosition = 20;

        // Character Bio Section
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(16);
        doc.setTextColor(139, 69, 19);
        doc.text('Character Bio', 20, yPosition);
        yPosition += 10;

        // Bio fields
        const bioSections = [
            { label: 'Appearance', value: formData.appearance },
            { label: 'Background', value: formData.background },
            { label: 'Personality', value: formData.personality },
            { label: 'Affiliations', value: formData.affiliations },
            { label: 'Catchphrase', value: formData.catchphrase },
            { label: 'Language Quirks', value: formData.languageQuirks },
            { label: 'Superstitions', value: formData.superstitions },
            { label: 'Diet', value: formData.diet },
            { label: 'Secrets', value: formData.secrets },
            { label: 'Character Flaws', value: formData.characterFlaws },
            { label: 'What Excites', value: formData.whatExcites },
            { label: 'Dynamic Goals', value: formData.dynamicGoals },
            { label: 'Most Want', value: formData.mostWant },
            { label: 'Won\'t Do', value: formData.wontDo }
        ];

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        doc.setTextColor(0, 0, 0);

        bioSections.forEach(section => {
            if (section.value && section.value.trim()) {
                // Check if we need a new page
                if (yPosition > 250) {
                    doc.addPage();
                    yPosition = 20;
                }

                // Section label
                doc.setFont('helvetica', 'bold');
                doc.text(`${section.label}:`, 20, yPosition);
                yPosition += 6;

                // Section content with text wrapping
                doc.setFont('helvetica', 'normal');
                const lines = doc.splitTextToSize(section.value, 170);
                doc.text(lines, 20, yPosition);
                yPosition += lines.length * 5 + 5;
            }
        });

        // Save the PDF
        const fileName = `${formData.characterName || 'Character'}_Bio.pdf`;
        doc.save(fileName);

    } catch (error) {
        console.error('Error generating PDF:', error);
        // Fallback to print dialog
        const bioContent = createBioDocument(formData);
        const printWindow = window.open('', '_blank');
        printWindow.document.write(bioContent);
        printWindow.document.close();
        setTimeout(() => {
            printWindow.print();
        }, 500);
    } finally {
        downloadBioBtn.disabled = false;
        downloadBioBtn.textContent = 'Download Bio';
    }
}

// Create formatted bio document
function createBioDocument(formData) {
    const imageHtml = characterImage.src ?
        `<div class="character-image"><img src="${characterImage.src}" alt="Character Portrait" style="max-width: 300px; border-radius: 10px; margin: 20px auto; display: block;"></div>` : '';

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <title>${formData.characterName || 'Character'} Bio</title>
        <style>
            body { font-family: 'Times New Roman', serif; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.6; }
            h1 { color: #2c5aa0; text-align: center; border-bottom: 3px solid #d4af37; padding-bottom: 10px; }
            h2 { color: #8b4513; margin-top: 30px; }
            .section { margin-bottom: 20px; }
            .label { font-weight: bold; color: #2c3e50; }
            .content { margin-left: 20px; margin-bottom: 15px; }
            .character-sheet { background: #f8f9fa; padding: 20px; border-radius: 10px; margin-bottom: 30px; }
            .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
            @media print { body { margin: 0; } }
        </style>
    </head>
    <body>
        <h1>${formData.characterName || 'Character Name'}</h1>
        ${imageHtml}
        
        <div class="character-sheet">
            <h2>Character Sheet</h2>
            <div class="section">
                <div class="label">Player:</div>
                <div class="content">${formData.playerName || 'N/A'}</div>
            </div>
            <div class="section">
                <div class="label">Sex:</div>
                <div class="content">${formData.sex || 'N/A'}</div>
            </div>
            <div class="section">
                <div class="label">Level:</div>
                <div class="content">${formData.level || 'N/A'}</div>
            </div>
            <div class="section">
                <div class="label">Ancestry:</div>
                <div class="content">${formData.ancestry || 'N/A'}</div>
            </div>
            
            <h3>Attributes</h3>
            <div class="stats-grid">
                <div><strong>Strength:</strong> ${formData.strength || 'N/A'}</div>
                <div><strong>Speed:</strong> ${formData.speed || 'N/A'}</div>
                <div><strong>Intellect:</strong> ${formData.intellect || 'N/A'}</div>
                <div><strong>Willpower:</strong> ${formData.willpower || 'N/A'}</div>
                <div><strong>Awareness:</strong> ${formData.awareness || 'N/A'}</div>
                <div><strong>Presence:</strong> ${formData.presence || 'N/A'}</div>
            </div>
        </div>
        
        <h2>Character Bio</h2>
        
        <div class="section">
            <div class="label">Appearance:</div>
            <div class="content">${formData.appearance || 'N/A'}</div>
        </div>
        
        <div class="section">
            <div class="label">Background:</div>
            <div class="content">${formData.background || 'N/A'}</div>
        </div>
        
        <div class="section">
            <div class="label">Personality:</div>
            <div class="content">${formData.personality || 'N/A'}</div>
        </div>
        
        <div class="section">
            <div class="label">Affiliations:</div>
            <div class="content">${formData.affiliations || 'N/A'}</div>
        </div>
        
        <h2>Roleplaying</h2>
        
        <div class="section">
            <div class="label">Catchphrase:</div>
            <div class="content">${formData.catchphrase || 'N/A'}</div>
        </div>
        
        <div class="section">
            <div class="label">Language Quirks:</div>
            <div class="content">${formData.languageQuirks || 'N/A'}</div>
        </div>
        
        <div class="section">
            <div class="label">Superstitions:</div>
            <div class="content">${formData.superstitions || 'N/A'}</div>
        </div>
        
        <div class="section">
            <div class="label">Diet:</div>
            <div class="content">${formData.diet || 'N/A'}</div>
        </div>
        
        <div class="section">
            <div class="label">Secrets:</div>
            <div class="content">${formData.secrets || 'N/A'}</div>
        </div>
        
        <div class="section">
            <div class="label">Character Flaws:</div>
            <div class="content">${formData.characterFlaws || 'N/A'}</div>
        </div>
        
        <div class="section">
            <div class="label">What Excites the Character:</div>
            <div class="content">${formData.whatExcites || 'N/A'}</div>
        </div>
        
        <div class="section">
            <div class="label">Dynamic Character Goals:</div>
            <div class="content">${formData.dynamicGoals || 'N/A'}</div>
        </div>
        
        <div class="section">
            <div class="label">What do I MOST want?:</div>
            <div class="content">${formData.mostWant || 'N/A'}</div>
        </div>
        
        <div class="section">
            <div class="label">What WON'T I do to get what I most want?:</div>
            <div class="content">${formData.wontDo || 'N/A'}</div>
        </div>
    </body>
    </html>`;
}

// Add modal expansion functionality for textareas
function addModalExpansion(field, element) {
    // Create expand button
    const expandBtn = document.createElement('button');
    expandBtn.type = 'button';
    expandBtn.className = 'expand-btn';
    expandBtn.innerHTML = '⤢';
    expandBtn.title = 'Expand to full screen';

    // Insert expand button
    element.parentNode.style.position = 'relative';
    element.parentNode.appendChild(expandBtn);

    expandBtn.addEventListener('click', () => openTextModal(field, element));
}

// Open text editing modal
function openTextModal(field, element) {
    // Create simple modal - just a big textarea with shrink button
    const modal = document.createElement('div');
    modal.className = 'text-modal-overlay';
    modal.innerHTML = `
        <div class="text-modal-content">
            <button class="text-modal-shrink">⤡</button>
            <textarea class="text-modal-textarea">${element.value}</textarea>
        </div>
    `;

    document.body.appendChild(modal);
    document.body.style.overflow = 'hidden';

    const textarea = modal.querySelector('.text-modal-textarea');
    const shrinkBtn = modal.querySelector('.text-modal-shrink');

    // Focus and position cursor at end
    setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }, 100);

    // Real-time sync - no save/cancel needed
    textarea.addEventListener('input', () => {
        element.value = textarea.value;
        onFieldEdit(field);
    });

    // Simple shrink handler
    const closeModal = () => {
        document.body.removeChild(modal);
        document.body.style.overflow = 'auto';
    };

    shrinkBtn.addEventListener('click', closeModal);

    // Close on Escape
    const escapeHandler = (e) => {
        if (e.key === 'Escape') {
            closeModal();
            document.removeEventListener('keydown', escapeHandler);
        }
    };
    document.addEventListener('keydown', escapeHandler);
}