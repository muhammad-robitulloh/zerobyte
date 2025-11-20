document.addEventListener('DOMContentLoaded', () => {
    const typingTextElement = document.getElementById('typing-text');
    const words = ["systems", "ai", "automation", "devtools"];
    let wordIndex = 0;
    let charIndex = 0;
    let isDeleting = false;

    function type() {
        const currentWord = words[wordIndex];
        
        if (isDeleting) {
            typingTextElement.textContent = currentWord.substring(0, charIndex - 1);
            charIndex--;
        } else {
            typingTextElement.textContent = currentWord.substring(0, charIndex + 1);
            charIndex++;
        }

        if (!isDeleting && charIndex === currentWord.length) {
            isDeleting = true;
            setTimeout(type, 1500); // Pause at end of word
        } else if (isDeleting && charIndex === 0) {
            isDeleting = false;
            wordIndex = (wordIndex + 1) % words.length;
            setTimeout(type, 500); // Pause before new word
        } else {
            const typingSpeed = isDeleting ? 75 : 150;
            setTimeout(type, typingSpeed);
        }
    }

    type();

    // Arcana AI Mock Response Logic
    const chatOutput = document.getElementById('chat-output');
    const aiInput = document.getElementById('ai-input');
    const aiSendBtn = document.getElementById('ai-send-btn');

    function addMessage(sender, message) {
        const messageElement = document.createElement('p');
        messageElement.innerHTML = `<strong>${sender}:</strong> ${message}`;
        chatOutput.appendChild(messageElement);
        chatOutput.scrollTop = chatOutput.scrollHeight; // Auto-scroll to bottom
    }

    function getArcanaResponse(input) {
        input = input.toLowerCase();
        if (input.includes("hello") || input.includes("hi")) {
            return "Greetings, user. How may I assist you?";
        } else if (input.includes("your name")) {
            return "I am Arcana, an AI designed to assist with your queries.";
        } else if (input.includes("capabilities") || input.includes("can you do")) {
            return "I can process natural language, provide information, and simulate various computational tasks. What would you like to explore?";
        } else if (input.includes("creator")) {
            return "I was designed by the ZeroByte team.";
        } else if (input.includes("time")) {
            const now = new Date();
            return `The current time is ${now.toLocaleTimeString()}.`;
        } else {
            return "I'm still learning, but I'll do my best to understand. Can you rephrase?";
        }
    }

    function sendChatMessage() {
        const userMessage = aiInput.value.trim();
        if (userMessage) {
            addMessage("You", userMessage);
            aiInput.value = '';

            setTimeout(() => {
                const aiResponse = getArcanaResponse(userMessage);
                addMessage("Arcana AI", aiResponse);
            }, 1000); // Simulate AI thinking time
        }
    }

    aiSendBtn.addEventListener('click', sendChatMessage);
    aiInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });

    addMessage("Arcana AI", "Hello! I am Arcana AI. How can I help you today?");
});
