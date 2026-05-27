/**
 * ==========================================================================
 * 🌌 Gemini Enterprise - Assistant Space Hub Client-Side Core
 * ==========================================================================
 */

document.addEventListener("DOMContentLoaded", () => {
    // UI Selectors
    const projectBadge = document.getElementById("project-id");
    const connectionStatus = document.getElementById("connection-status");
    const statusText = document.getElementById("status-text");
    const enginesList = document.getElementById("engines-list");
    const sessionsList = document.getElementById("sessions-list");
    const chatMessages = document.getElementById("chat-messages");
    const chatHeaderName = document.getElementById("active-engine-name");
    const chatHeaderDesc = document.getElementById("active-engine-desc");
    const sessionBadge = document.getElementById("session-badge");
    const activeSessionIdText = document.getElementById("active-session-id");
    const thinkingIndicator = document.getElementById("thinking-indicator");
    const thinkingText = document.getElementById("thinking-text");
    const quickPromptsBar = document.getElementById("quick-prompts-bar");
    const chatInputBar = document.getElementById("chat-input-bar");
    const chatForm = document.getElementById("chat-form");
    const inputQuery = document.getElementById("input-query");
    const btnSend = document.getElementById("btn-send");
    const btnNewChat = document.getElementById("btn-new-chat");
    const btnToggleDev = document.getElementById("btn-toggle-dev");
    const devPanel = document.getElementById("developer-panel");
    const datastoresDeck = document.getElementById("datastores-deck");
    const termRequest = document.getElementById("term-request");
    const termResponse = document.getElementById("term-response");
    const termStatusDot = document.getElementById("term-status-dot");

    // Citation Hovercard selectors
    const hovercard = document.getElementById("citation-hovercard");
    const hovercardTitle = document.getElementById("hovercard-title");
    const hovercardDomain = document.getElementById("hovercard-domain");
    const hovercardSnippet = document.getElementById("hovercard-snippet");
    const hovercardDatastore = document.getElementById("hovercard-datastore-name");
    const hovercardLink = document.getElementById("hovercard-link");

    // Global State management
    let activeProjectId = "";
    let activeEngine = null;
    let activeSessionPath = null; // Session resource path on GCP
    let conversations = {}; // In-memory session logs: { sessionPath: { title, engineId, turns: [ { role, text, citations, ... } ] } }
    let hovercardTimeout = null;
    let discoveredEnginesArray = []; // Tracks original engine listings data store mappings

    // Load active sessions from sessionStorage for premium state continuity
    try {
        const savedData = sessionStorage.getItem("space_hub_conversations");
        if (savedData) {
            conversations = JSON.parse(savedData);
        }
    } catch (e) {
        console.error("Failed to load saved sessions:", e);
    }

    // Initialize application: Discover GCP engines and populate state
    initApp();

    async function initApp() {
        setConnectionState("authenticating", "Discovering Engines...");
        try {
            const res = await fetch("/api/engines");
            if (!res.ok) throw new Error("Failed to contact server BFF");
            const data = await res.json();
            
            activeProjectId = data.project_id;
            projectBadge.textContent = activeProjectId;
            discoveredEnginesArray = data.engines; // Cache mapped databases list
            
            renderEnginesList(data.engines);
            renderSessionsList();
            setConnectionState("connected", "Connected");
        } catch (e) {
            console.error("Initialization error:", e);
            setConnectionState("disconnected", "Server Error");
            showSystemMessage("System connection failure. Please make sure server.py is running on localhost and authenticated via gcloud CLI.");
        }
    }

    function setConnectionState(state, text) {
        connectionStatus.className = `connection-status ${state}`;
        statusText.textContent = text;
    }

    // Render discovered search engines in left sidebar
    function renderEnginesList(engines) {
        enginesList.replaceChildren();
        if (!engines || engines.length === 0) {
            const placeholder = document.createElement("div");
            placeholder.className = "list-placeholder";
            placeholder.textContent = "No search or conversational engines found in this GCP project.";
            enginesList.appendChild(placeholder);
            return;
        }

        engines.forEach(eng => {
            const card = document.createElement("div");
            card.className = "engine-card";
            card.id = `engine-card-${eng.id}`;
            
            const header = document.createElement("div");
            header.className = "engine-card-header";
            
            const title = document.createElement("div");
            title.className = "engine-card-title";
            title.textContent = eng.display_name;
            header.appendChild(title);
            
            const badge = document.createElement("span");
            badge.className = "engine-card-badge";
            badge.textContent = eng.solution_type === "SOLUTION_TYPE_SEARCH" ? "Search" : "Chat";
            header.appendChild(badge);
            
            card.appendChild(header);
            
            const desc = document.createElement("div");
            desc.className = "engine-card-id";
            desc.textContent = `ID: ${eng.id}`;
            card.appendChild(desc);
            
            card.addEventListener("click", () => selectEngine(eng));
            enginesList.appendChild(card);
        });
    }

    // Target selecting an engine from sidebar
    function selectEngine(eng) {
        // Toggle selected styling
        document.querySelectorAll(".engine-card").forEach(el => el.classList.remove("active"));
        const card = document.getElementById(`engine-card-${eng.id}`);
        if (card) card.classList.add("active");
        
        activeEngine = eng;
        
        // Recover datastores list if loaded from session mock
        if (!eng.data_store_ids && discoveredEnginesArray) {
            const matchedEng = discoveredEnginesArray.find(e => e.id === eng.id);
            if (matchedEng) {
                eng.data_store_ids = matchedEng.data_store_ids;
            }
        }
        
        // Render data stores list under Developer panel
        renderEngineDataStores(eng.data_store_ids);
        
        // Update header details
        chatHeaderName.textContent = eng.display_name;
        chatHeaderDesc.textContent = `Engine ID: ${eng.id} | Solution Type: ${eng.solution_type.replace("SOLUTION_TYPE_", "")}`;
        
        // Enable typing controller inputs
        chatInputBar.classList.remove("disabled");
        inputQuery.disabled = false;
        inputQuery.placeholder = `Ask ${eng.display_name} anything...`;
        btnSend.disabled = false;
        quickPromptsBar.classList.remove("hidden");
        
        // Setup fresh session automatically if no session has been loaded
        if (!activeSessionPath || conversations[activeSessionPath]?.engineId !== eng.id) {
            setupNewSession();
        }
    }

    // Establish a brand new local session mapping
    function setupNewSession() {
        activeSessionPath = null;
        sessionBadge.classList.add("hidden");
        activeSessionIdText.textContent = "";
        clearChatArea();
        renderSessionsList();
    }

    function clearChatArea() {
        chatMessages.replaceChildren();
        
        // Render welcoming box in chat area
        const welcome = document.createElement("div");
        welcome.className = "welcome-box";
        
        const orb = document.createElement("div");
        orb.className = "welcome-orb";
        orb.textContent = "✨";
        welcome.appendChild(orb);
        
        const h3 = document.createElement("h3");
        h3.className = "welcome-title";
        h3.textContent = activeEngine ? `Ready to explore ${activeEngine.display_name}` : "Welcome to Assistant Space Hub";
        welcome.appendChild(h3);
        
        const p = document.createElement("p");
        p.textContent = "Explore your organization's private data, documentation, and cloud resources under total protection. Your queries are processed securely through our server-side proxy layer.";
        welcome.appendChild(p);
        
        const inst = document.createElement("div");
        inst.className = "quick-instructions";
        
        const h4 = document.createElement("h4");
        h4.textContent = "Grounding source highlights:";
        inst.appendChild(h4);
        
        const ol = document.createElement("ol");
        [
            "Instant typing real-time streaming",
            "Automatic source documentation citation mapping",
            "Citations and web links fully populated upon stream completion",
            "Local history logging keeps your research separated per engine"
        ].forEach(t => {
            const li = document.createElement("li");
            li.textContent = t;
            ol.appendChild(li);
        });
        
        inst.appendChild(ol);
        welcome.appendChild(inst);
        chatMessages.appendChild(welcome);
    }

    // Render list of local storage active sessions in sidebar
    function renderSessionsList() {
        sessionsList.replaceChildren();
        
        const sessionKeys = Object.keys(conversations);
        if (sessionKeys.length === 0) {
            const placeholder = document.createElement("div");
            placeholder.className = "list-placeholder";
            placeholder.textContent = "No active conversations logged.";
            sessionsList.appendChild(placeholder);
            return;
        }

        // Display in reverse chronological order (latest sessions on top)
        sessionKeys.reverse().forEach(key => {
            const session = conversations[key];
            
            const item = document.createElement("div");
            item.className = "session-item";
            if (activeSessionPath === key) item.classList.add("active");
            
            const text = document.createElement("span");
            text.className = "session-item-text";
            // Render nice title: display title combined with target engine name tag
            text.textContent = session.title || `Session ${key.split("/").pop().slice(0,8)}`;
            item.appendChild(text);
            
            // Delete Session control button
            const btnDelete = document.createElement("button");
            btnDelete.className = "btn-delete-session";
            btnDelete.title = "Terminate and Delete Session";
            btnDelete.innerHTML = `
                <svg viewBox="0 0 24 24" class="svg-icon" style="width: 14px; height: 14px;">
                    <path d="M19,4H15.5L14.5,3H9.5L8.5,4H5V6H19M6,19A2,2 0 0,0 8,21H16A2,2 0 0,0 18,19V7H6V19Z" fill="currentColor"/>
                </svg>
            `;
            
            btnDelete.addEventListener("click", (e) => {
                e.stopPropagation();
                deleteSession(key);
            });
            
            item.appendChild(btnDelete);
            item.addEventListener("click", () => loadSession(key));
            
            sessionsList.appendChild(item);
        });
    }

    // Load active session from local history and rebuild rendering states
    function loadSession(sessionPath) {
        const session = conversations[sessionPath];
        if (!session) return;
        
        activeSessionPath = sessionPath;
        
        // Find correct engine card on left side
        const engCard = document.querySelector(`.engine-card[id$="${session.engineId}"]`);
        if (engCard) {
            // Find engine definition mock block to auto-select
            const engineId = session.engineId;
            const engineName = engCard.querySelector(".engine-card-title").textContent;
            selectEngine({ id: engineId, display_name: engineName, solution_type: "SOLUTION_TYPE_SEARCH", industry_vertical: "GENERIC" });
        }
        
        // Re-display badge
        sessionBadge.classList.remove("hidden");
        const shortId = sessionPath.split("/").pop();
        activeSessionIdText.textContent = shortId;
        
        // Clear chat and populate message loops
        chatMessages.replaceChildren();
        
        session.turns.forEach(turn => {
            appendMessageBubble(turn.role, turn.text, turn.citations, turn.warning);
        });
        
        scrollToBottom();
        renderSessionsList();
    }

    // Delete session from history mapping
    function deleteSession(sessionPath) {
        delete conversations[sessionPath];
        sessionStorage.setItem("space_hub_conversations", JSON.stringify(conversations));
        
        if (activeSessionPath === sessionPath) {
            activeSessionPath = null;
            sessionBadge.classList.add("hidden");
            activeSessionIdText.textContent = "";
            if (activeEngine) {
                clearChatArea();
            }
        }
        renderSessionsList();
    }

    // Auto growing textarea controller for clean UX
    inputQuery.addEventListener("input", () => {
        inputQuery.style.height = "auto";
        inputQuery.style.height = (inputQuery.scrollHeight - 6) + "px";
    });

    // Send button event handler trigger
    chatForm.addEventListener("submit", (e) => {
        e.preventDefault();
        submitUserQuery();
    });

    // Enable submitting via Enter key (excluding Shift+Enter lines)
    inputQuery.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submitUserQuery();
        }
    });

    // Quick starter prompt chips triggers
    document.querySelectorAll(".quick-prompt-chip").forEach(chip => {
        chip.addEventListener("click", () => {
            if (inputQuery.disabled) return;
            inputQuery.value = chip.textContent;
            inputQuery.dispatchEvent(new Event("input"));
            submitUserQuery();
        });
    });

    // Primary new exploration button trigger
    btnNewChat.addEventListener("click", () => {
        if (!activeEngine) {
            showSystemMessage("Please select one of the Discovered Engines on the left first.");
            return;
        }
        setupNewSession();
    });

    // Primary submission orchestration logic
    async function submitUserQuery() {
        const query = inputQuery.value.trim();
        if (!query || !activeEngine) return;
        
        // Clear inputs and auto height bounds
        inputQuery.value = "";
        inputQuery.dispatchEvent(new Event("input"));
        
        // Clear welcome screen on initial message
        if (chatMessages.querySelector(".welcome-box")) {
            chatMessages.replaceChildren();
        }
        
        // Render user message bubble immediately
        appendMessageBubble("user", query);
        scrollToBottom();
        
        // Establish fresh response element card for assistant stream
        const responseRow = document.createElement("div");
        responseRow.className = "message-row assistant";
        
        const responseBubble = document.createElement("div");
        responseBubble.className = "message-bubble thinking-state";
        responseRow.appendChild(responseBubble);
        chatMessages.appendChild(responseRow);
        
        scrollToBottom();
        
        // Setup initial thinking spinner status state
        thinkingIndicator.classList.remove("hidden");
        thinkingText.textContent = "Connecting to GCP streaming cluster...";
        
        // Reset terminals and activate blinking trace indicator orb
        termResponse.replaceChildren();
        termResponse.appendChild(document.createTextNode("// Waiting for API stream responses..."));
        termRequest.replaceChildren();
        termRequest.appendChild(document.createTextNode("// Formatting raw POST request..."));
        termStatusDot.classList.add("active");
        
        // SSE Client Streaming connection logic
        try {
            const response = await fetch("/api/chat", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    engine_id: activeEngine.id,
                    query: query,
                    session: activeSessionPath
                })
            });
            
            if (!response.ok) {
                throw new Error(`BFF server returned code: ${response.status}`);
            }
            
            // Remove full overlay spinner, update indicator to processing status
            thinkingText.textContent = "Processing grounded answer stream...";
            responseBubble.classList.remove("thinking-state");
            
            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = "";
            let accumulatedText = "";
            let finalMetadata = null;
            let finalWarning = null;
            
            // SSE streaming event parser loop
            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                
                // Parse complete SSE events separated by \n\n
                const events = buffer.split("\n\n");
                // Retain incomplete final event back inside buffer
                buffer = events.pop();
                
                for (const event of events) {
                    if (!event.trim()) continue;
                    
                    const lines = event.split("\n");
                    let eventType = "chunk";
                    let dataString = "";
                    
                    for (const line of lines) {
                        if (line.startsWith("event: ")) {
                            eventType = line.slice(7).trim();
                        } else if (line.startsWith("data: ")) {
                            dataString = line.slice(6).trim();
                        }
                    }
                    
                    if (!dataString) continue;
                    
                    try {
                        const parsedData = jsonParseSafe(dataString);
                        
                        if (eventType === "raw_request") {
                            termRequest.replaceChildren();
                            
                            const methodSpan = document.createElement("span");
                            methodSpan.className = "console-method";
                            methodSpan.textContent = parsedData.method;
                            
                            const urlSpan = document.createElement("span");
                            urlSpan.className = "console-url";
                            urlSpan.textContent = ` ${parsedData.url}\n\n`;
                            
                            termRequest.appendChild(methodSpan);
                            termRequest.appendChild(urlSpan);
                            
                            const headersTitle = document.createElement("strong");
                            headersTitle.textContent = "Headers:\n";
                            termRequest.appendChild(headersTitle);
                            
                            const headersText = document.createTextNode(
                                `  Content-Type: ${parsedData.headers["Content-Type"]}\n` +
                                `  Authorization: ${parsedData.headers["Authorization"]}\n\n`
                            );
                            termRequest.appendChild(headersText);
                            
                            const payloadTitle = document.createElement("strong");
                            payloadTitle.textContent = "Payload:\n";
                            termRequest.appendChild(payloadTitle);
                            
                            termRequest.appendChild(createHighlightedJSONDOM(parsedData.payload));
                        } else if (eventType === "raw_response_chunk") {
                            if (termResponse.textContent.startsWith("// Waiting")) {
                                termResponse.replaceChildren();
                            }
                            
                            const rawLine = parsedData.chunk;
                            const textNode = document.createTextNode(rawLine + "\n");
                            termResponse.appendChild(textNode);
                            
                            const terminalBody = termResponse.parentElement;
                            if (terminalBody) {
                                terminalBody.scrollTop = terminalBody.scrollHeight;
                            }
                        } else if (eventType === "chunk" && parsedData.text) {
                            accumulatedText += parsedData.text;
                            // Safe dynamic progressive DOM typing rendering
                            renderSafeBubbleContent(responseBubble, accumulatedText);
                            scrollToBottom();
                        } else if (eventType === "metadata") {
                            finalMetadata = parsedData;
                        } else if (eventType === "warning") {
                            finalWarning = parsedData.message;
                            renderWarningBox(responseBubble, finalWarning);
                        } else if (eventType === "error") {
                            showSystemMessage(`Error: ${parsedData.message}`);
                            responseBubble.textContent = "Exploration failed. See details below.";
                        }
                    } catch (err) {
                        console.error("Error processing SSE block:", err);
                    }
                }
            }
            
            // Stream completely finished parsing! Close indicators
            thinkingIndicator.classList.add("hidden");
            termStatusDot.classList.remove("active");
            
            if (finalMetadata) {
                // If this is a new session path, save it!
                const path = finalMetadata.session;
                if (path && !activeSessionPath) {
                    activeSessionPath = path;
                    sessionBadge.classList.remove("hidden");
                    activeSessionIdText.textContent = path.split("/").pop();
                    
                    // Initialize empty session history loop
                    conversations[activeSessionPath] = {
                        title: query.slice(0, 32) + (query.length > 32 ? "..." : ""),
                        engineId: activeEngine.id,
                        turns: []
                    };
                }
                
                // Assign unique citations IDs and append interactive links
                const customCitations = processCitationsMetadata(finalMetadata.citations);
                
                // Map annotations securely inside message DOM elements
                applyInlineCitationBadges(responseBubble, accumulatedText, finalMetadata.citations, customCitations);
                
                // Append expandable Ground sources footer cards panel
                renderCitationsFooter(responseRow, customCitations);
                
                // Log complete state to Session storage block
                if (activeSessionPath && conversations[activeSessionPath]) {
                    // Update session logs
                    conversations[activeSessionPath].turns.push({
                        role: "user",
                        text: query
                    });
                    conversations[activeSessionPath].turns.push({
                        role: "assistant",
                        text: accumulatedText,
                        citations: customCitations,
                        warning: finalWarning
                    });
                    
                    sessionStorage.setItem("space_hub_conversations", JSON.stringify(conversations));
                    renderSessionsList();
                }
            }
            
        } catch (e) {
            console.error("Streaming error:", e);
            thinkingIndicator.classList.add("hidden");
            termStatusDot.classList.remove("active");
            responseBubble.replaceChildren();
            
            const errSpan = document.createElement("span");
            errSpan.className = "text-danger";
            errSpan.textContent = `Streaming channel failure: ${e.message}. See developer logs.`;
            responseBubble.appendChild(errSpan);
        }
    }

    // Secure JSON Parsing utility
    function jsonParseSafe(str) {
        try {
            return JSON.parse(str);
        } catch (e) {
            // Handle edge cases
            return {};
        }
    }

    // Displays warning message indicators
    function renderWarningBox(bubble, text) {
        const warning = document.createElement("div");
        warning.className = "warning-box";
        warning.innerHTML = `
            <span class="warning-icon" style="font-size: 16px;">⚠️</span>
            <span>${escapeTextHTML(text)}</span>
        `;
        bubble.prepend(warning);
    }

    // System banner alerts fallback
    function showSystemMessage(text) {
        const row = document.createElement("div");
        row.className = "message-row assistant";
        
        const bubble = document.createElement("div");
        bubble.className = "message-bubble";
        bubble.style.border = "1px solid var(--color-danger)";
        bubble.style.background = "rgba(255, 0, 127, 0.05)";
        
        const textNode = document.createElement("strong");
        textNode.style.color = "var(--color-danger)";
        textNode.textContent = "System Alert: ";
        bubble.appendChild(textNode);
        
        const descNode = document.createElement("span");
        descNode.textContent = text;
        bubble.appendChild(descNode);
        
        row.appendChild(bubble);
        chatMessages.appendChild(row);
        scrollToBottom();
    }

    // Appends a static message bubble card in chat view
    function appendMessageBubble(role, text, customCitations = null, warning = null) {
        const row = document.createElement("div");
        row.className = `message-row ${role}`;
        
        const bubble = document.createElement("div");
        bubble.className = "message-bubble";
        
        if (role === "assistant") {
            renderSafeBubbleContent(bubble, text);
            if (warning) renderWarningBox(bubble, warning);
            if (customCitations && customCitations.length > 0) {
                applyInlineCitationBadges(bubble, text, null, customCitations);
                renderCitationsFooter(row, customCitations);
            }
        } else {
            // Simply map query string as clean textContent
            bubble.textContent = text;
        }
        
        row.appendChild(bubble);
        chatMessages.appendChild(row);
    }

    // Scroll chat window smoothly to focus latest messages
    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    /* ==========================================================================
       🛡️ SECURE CUSTOM DOM BUILDER & MARKDOWN PARSING ENGINE
       ========================================================================== */

    function renderSafeBubbleContent(container, rawMarkdownText) {
        container.replaceChildren();
        
        // Handle stream initialization spacing cleanly
        if (!rawMarkdownText.trim()) return;

        // Split by paragraph double-newlines block limits
        const blocks = rawMarkdownText.split("\n\n");
        let activeTableLines = [];

        blocks.forEach((block, index) => {
            const trimmed = block.trim();
            if (!trimmed) return;

            // 1. Markdown Table Recognition
            if (trimmed.startsWith("|")) {
                const lines = trimmed.split("\n");
                renderSafeTable(container, lines);
                return;
            }

            // 2. Headings recognition
            if (trimmed.startsWith("###")) {
                const h3 = document.createElement("h3");
                h3.appendChild(renderInlineElements(trimmed.replace(/^###\s*/, "")));
                container.appendChild(h3);
                return;
            }
            
            if (trimmed.startsWith("##")) {
                const h3 = document.createElement("h3");
                h3.style.fontSize = "17px";
                h3.style.color = "var(--color-blue)";
                h3.appendChild(renderInlineElements(trimmed.replace(/^##\s*/, "")));
                container.appendChild(h3);
                return;
            }

            // 3. Bullet list recognition
            if (trimmed.startsWith("* ") || trimmed.startsWith("- ")) {
                const ul = document.createElement("ul");
                const lines = trimmed.split("\n");
                
                lines.forEach(line => {
                    const li = document.createElement("li");
                    const cleanedLine = line.replace(/^[\*\-]\s*/, "");
                    li.appendChild(renderInlineElements(cleanedLine));
                    ul.appendChild(li);
                });
                
                container.appendChild(ul);
                return;
            }

            // 4. Standard text paragraph fallback
            const p = document.createElement("p");
            p.style.marginBottom = "12px";
            p.appendChild(renderInlineElements(trimmed));
            container.appendChild(p);
        });
    }

    // Inline elements styling parser (bolding, inline code nodes)
    function renderInlineElements(text) {
        const container = document.createDocumentFragment();
        
        // Regex to tokenize bold tags "**", inline backticks "`"
        const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
        const tokens = text.split(tokenRegex);
        
        tokens.forEach(token => {
            if (token.startsWith("**") && token.endsWith("**")) {
                const strong = document.createElement("strong");
                strong.textContent = token.slice(2, -2);
                container.appendChild(strong);
            } else if (token.startsWith("`") && token.endsWith("`")) {
                const code = document.createElement("code");
                code.className = "inline-code-badge";
                code.style.fontFamily = "var(--font-mono)";
                code.style.background = "rgba(255, 255, 255, 0.05)";
                code.style.padding = "2px 6px";
                code.style.borderRadius = "4px";
                code.style.fontSize = "13px";
                code.textContent = token.slice(1, -1);
                container.appendChild(code);
            } else {
                container.appendChild(document.createTextNode(token));
            }
        });
        
        return container;
    }

    // Secure HTML entity escaper
    function escapeTextHTML(str) {
        return str.replace(/&/g, "&amp;")
                  .replace(/</g, "&lt;")
                  .replace(/>/g, "&gt;")
                  .replace(/"/g, "&quot;")
                  .replace(/'/g, "&#039;");
    }

    // Table elements generator targeting 100% node safety bounds
    function renderSafeTable(container, lines) {
        const table = document.createElement("table");
        table.className = "markdown-table";
        
        const thead = document.createElement("thead");
        const tbody = document.createElement("tbody");
        
        let isFirstRow = true;
        
        lines.forEach(line => {
            const trimmedLine = line.trim();
            if (!trimmedLine) return;
            
            // Bypass markdown table separator rows: e.g. |---|---|
            if (/^[|:\-\s]+$/.test(trimmedLine)) return;
            
            const cols = trimmedLine.split("|")
                                     .map(c => c.trim())
                                     .filter((c, index, arr) => index > 0 && index < arr.length - 1);
            
            const tr = document.createElement("tr");
            
            cols.forEach(col => {
                const cell = document.createElement(isFirstRow ? "th" : "td");
                cell.appendChild(renderInlineElements(col));
                tr.appendChild(cell);
            });
            
            if (isFirstRow) {
                thead.appendChild(tr);
                isFirstRow = false;
            } else {
                tbody.appendChild(tr);
            }
        });
        
        table.appendChild(thead);
        table.appendChild(tbody);
        container.appendChild(table);
    }

    /* ==========================================================================
       🧬 CITATIONS & GROUNDING MATCHING ALGORITHM
       ========================================================================== */

    // Map citations array returned by API to assigned custom tags matching standard [1], [2] sequence IDs
    function processCitationsMetadata(rawCitations) {
        const customCitations = [];
        let globalIndex = 1;
        
        if (!rawCitations) return customCitations;
        
        rawCitations.forEach(citation => {
            const refs = citation.references || [];
            const segments = citation.segments || [];
            
            segments.forEach(seg => {
                const targetText = seg.text;
                const indices = seg.referenceIndices || [];
                const matchedSources = [];
                
                indices.forEach(idx => {
                    const sourceDoc = refs[idx];
                    if (!sourceDoc) return;
                    
                    const meta = sourceDoc.documentMetadata || {};
                    const uri = meta.uri || sourceDoc.uri || "";
                    const title = meta.title || sourceDoc.title || "Untitled Source";
                    const domain = meta.domain || new URL(uri).hostname || "GCP Data store";
                    const datastore = sourceDoc.dataStore || meta.document?.split("/dataStores/")?.pop()?.split("/")?.[0] || "Ground source";
                    
                    // Check if duplicate source already recorded
                    let existing = customCitations.find(c => c.uri === uri);
                    if (existing) {
                        matchedSources.push(existing);
                    } else {
                        const newSource = {
                            id: globalIndex++,
                            title: title,
                            uri: uri,
                            domain: domain,
                            datastore: datastore,
                            snippet: targetText
                        };
                        customCitations.push(newSource);
                        matchedSources.push(newSource);
                    }
                });
                
                // Link assigned indices back inside segments tracking list (non-enumerable overlay helper)
                seg._resolvedSources = matchedSources;
            });
        });
        
        return customCitations;
    }

    // Apply inline glowing reference superscript badges inside paragraph text nodes upon completion
    function applyInlineCitationBadges(bubbleElement, fullAnswerText, rawCitations, customCitations) {
        if (!customCitations || customCitations.length === 0) return;
        
        // Target resolving paragraph nodes inside message bubble card
        const childParagraphs = bubbleElement.querySelectorAll("p, li, th, td");
        
        childParagraphs.forEach(node => {
            const nodeText = node.textContent;
            
            // Scan segments list
            customCitations.forEach(source => {
                const cleanSnippet = source.snippet.replace(/^[\*\-]\s*/, "").trim();
                
                // Match snippet sentence context mapping inside text node
                if (nodeText.includes(cleanSnippet)) {
                    // Check if link tag already appended to node to prevent recursion duplicates
                    const matches = node.querySelectorAll(`.citation-link[data-id="${source.id}"]`);
                    if (matches.length > 0) return;
                    
                    // Append superscript interactive icon
                    const badge = document.createElement("span");
                    badge.className = "citation-link";
                    badge.setAttribute("data-id", source.id);
                    badge.textContent = source.id;
                    
                    // Bind Premium Hover Events
                    badge.addEventListener("mouseenter", (e) => triggerHovercardShow(e, source));
                    badge.addEventListener("mouseleave", triggerHovercardHide);
                    
                    node.appendChild(badge);
                }
            });
        });
    }

    // Render Expandable citations drawer panel at the card foot boundary
    function renderCitationsFooter(rowElement, customCitations) {
        if (!customCitations || customCitations.length === 0) return;
        
        const footer = document.createElement("div");
        footer.className = "message-citations";
        
        const toggle = document.createElement("div");
        toggle.className = "citations-toggle";
        
        const arrow = document.createElement("span");
        arrow.className = "citations-arrow";
        arrow.textContent = "▼";
        toggle.appendChild(arrow);
        
        const label = document.createElement("span");
        label.textContent = `Grounded Sources (${customCitations.length} references)`;
        toggle.appendChild(label);
        
        const grid = document.createElement("div");
        grid.className = "citations-grid hidden";
        
        // Populate citations card elements inside grid
        customCitations.forEach(source => {
            const card = document.createElement("a");
            card.href = source.uri || "#";
            card.target = "_blank";
            card.className = "citation-card";
            
            const num = document.createElement("span");
            num.className = "citation-number";
            num.textContent = source.id;
            card.appendChild(num);
            
            const info = document.createElement("div");
            info.className = "citation-info";
            
            const title = document.createElement("span");
            title.className = "citation-title";
            title.textContent = source.title;
            info.appendChild(title);
            
            const dom = document.createElement("span");
            dom.className = "citation-domain";
            dom.textContent = source.domain;
            info.appendChild(dom);
            
            card.appendChild(info);
            grid.appendChild(card);
        });
        
        // Handle expand / collapse action securely
        toggle.addEventListener("click", () => {
            const isExpanded = toggle.classList.toggle("expanded");
            grid.classList.toggle("hidden", !isExpanded);
        });
        
        footer.appendChild(toggle);
        footer.appendChild(grid);
        
        // Append inside bubble wrapper row boundary
        const bubble = rowElement.querySelector(".message-bubble");
        if (bubble) {
            bubble.appendChild(footer);
        }
    }

    /* ==========================================================================
       🎯 PREMIUM FLOATING HOVERCARD INTERACTIVE UTILITY
       ========================================================================== */

    function triggerHovercardShow(e, source) {
        // Cancel any pending hide triggers
        if (hovercardTimeout) clearTimeout(hovercardTimeout);
        
        // Populate hovercard tags securely
        hovercardTitle.textContent = source.title;
        hovercardDomain.textContent = source.domain;
        hovercardSnippet.textContent = source.snippet;
        
        // Clean Datastore ID naming convention display mapping
        const shortDatastoreName = source.datastore.split("_").shift();
        hovercardDatastore.textContent = shortDatastoreName;
        
        if (source.uri) {
            hovercardLink.href = source.uri;
            hovercardLink.classList.remove("hidden");
        } else {
            hovercardLink.classList.add("hidden");
        }
        
        // Calculate dynamic relative coordinate locations
        const badgeRect = e.target.getBoundingClientRect();
        const appLayoutRect = document.getElementById("app-layout").getBoundingClientRect();
        
        // Relocate relative inside layout absolute coordinate mapping limits
        const left = (badgeRect.left - appLayoutRect.left) - 15;
        const bottom = (appLayoutRect.bottom - badgeRect.top) + 8;
        
        hovercard.style.left = `${left}px`;
        hovercard.style.bottom = `${bottom}px`;
        hovercard.style.top = 'auto'; // Disable top alignment bounds
        
        // Unhide overlay
        hovercard.classList.remove("hidden");
    }

    function triggerHovercardHide() {
        // Trigger short delay hide to allow user cursor to traverse boundaries into hovercard panel safely
        hovercardTimeout = setTimeout(() => {
            hovercard.classList.add("hidden");
        }, 250);
    }

    // Connect mouse boundary interactions inside hovercard box container
    hovercard.addEventListener("mouseenter", () => {
        if (hovercardTimeout) clearTimeout(hovercardTimeout);
    });

    hovercard.addEventListener("mouseleave", () => {
        hovercard.classList.add("hidden");
    });

    /* ==========================================================================
       🛠️ DEVELOPER CONTROL PANEL LOGIC & TABS SYSTEM
       ========================================================================== */

    // 1. Panel Slide Toggle Trigger
    btnToggleDev.addEventListener("click", () => {
        const isActive = btnToggleDev.classList.toggle("active");
        devPanel.classList.toggle("hidden", !isActive);
    });

    // 2. Tab Selection Routing
    document.querySelectorAll(".dev-tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            // Remove all active states
            document.querySelectorAll(".dev-tab-btn").forEach(el => el.classList.remove("active"));
            document.querySelectorAll(".dev-tab-content").forEach(el => el.classList.add("hidden"));
            
            // Toggle active state
            btn.classList.add("active");
            const targetTab = btn.getAttribute("data-tab");
            const tabContent = document.getElementById(targetTab);
            if (tabContent) tabContent.classList.remove("hidden");
        });
    });

    // 3. Grounded Data Stores Panel Renderer
    function renderEngineDataStores(dataStoreIds) {
        datastoresDeck.replaceChildren();
        
        if (!dataStoreIds || dataStoreIds.length === 0) {
            const placeholder = document.createElement("div");
            placeholder.className = "list-placeholder";
            placeholder.textContent = "No private data store indexes configured for this engine.";
            datastoresDeck.appendChild(placeholder);
            return;
        }

        dataStoreIds.forEach(dsId => {
            const card = document.createElement("div");
            card.className = "datastore-item-card";
            
            // Dynamic storage types mapping icons
            let icon = "💾"; // Fallback database index card icon
            let typeLabel = "Enterprise Data Index";
            
            const lowerId = dsId.toLowerCase();
            if (lowerId.includes("bucket") || lowerId.includes("gcs")) {
                icon = "📦";
                typeLabel = "Cloud Storage Bucket";
            } else if (lowerId.includes("gmail") || lowerId.includes("mail")) {
                icon = "✉️";
                typeLabel = "Google Mail Connector";
            } else if (lowerId.includes("calendar")) {
                icon = "📅";
                typeLabel = "Google Calendar Link";
            } else if (lowerId.includes("drive")) {
                icon = "📁";
                typeLabel = "Google Drive Federated";
            } else if (lowerId.includes("notion")) {
                icon = "📒";
                typeLabel = "Notion Pages Index";
            } else if (lowerId.includes("dropbox")) {
                icon = "🗂️";
                typeLabel = "Dropbox Files Index";
            } else if (lowerId.includes("people")) {
                icon = "👥";
                typeLabel = "Workspace Directory Search";
            }
            
            const iconBox = document.createElement("div");
            iconBox.className = "ds-icon-box";
            iconBox.textContent = icon;
            card.appendChild(iconBox);
            
            const meta = document.createElement("div");
            meta.className = "ds-meta";
            
            const title = document.createElement("div");
            title.className = "ds-name";
            // Render user friendly labels: strip suffix ID hashes
            const cleanTitle = dsId.split("_").shift();
            title.textContent = cleanTitle;
            meta.appendChild(title);
            
            const type = document.createElement("span");
            type.className = "ds-type";
            type.textContent = typeLabel;
            meta.appendChild(type);
            
            const path = document.createElement("div");
            path.className = "ds-full-path";
            path.textContent = `ID: ${dsId}`;
            meta.appendChild(path);
            
            card.appendChild(meta);
            datastoresDeck.appendChild(card);
        });
    }

    // 4. Dynamic Recursive Highlighter DOM Builder (100% XSS-Safe Text Nodes Insertion)
    function createHighlightedJSONDOM(obj) {
        const fragment = document.createDocumentFragment();
        
        function formatNode(val, indent = 0) {
            const spaces = " ".repeat(indent);
            
            if (val === null) {
                const span = document.createElement("span");
                span.className = "console-key";
                span.textContent = "null";
                return span;
            }
            if (typeof val === "boolean") {
                const span = document.createElement("span");
                span.className = "console-key";
                span.textContent = val ? "true" : "false";
                return span;
            }
            if (typeof val === "number") {
                const span = document.createElement("span");
                span.className = "console-number";
                span.textContent = String(val);
                return span;
            }
            if (typeof val === "string") {
                const span = document.createElement("span");
                span.className = "console-string";
                span.textContent = `"${val}"`;
                return span;
            }
            if (Array.isArray(val)) {
                if (val.length === 0) {
                    return document.createTextNode("[]");
                }
                const container = document.createDocumentFragment();
                container.appendChild(document.createTextNode("[\n"));
                val.forEach((item, idx) => {
                    container.appendChild(document.createTextNode(" ".repeat(indent + 2)));
                    container.appendChild(formatNode(item, indent + 2));
                    if (idx < val.length - 1) {
                        container.appendChild(document.createTextNode(","));
                    }
                    container.appendChild(document.createTextNode("\n"));
                });
                container.appendChild(document.createTextNode(spaces + "]"));
                return container;
            }
            if (typeof val === "object") {
                const keys = Object.keys(val);
                if (keys.length === 0) {
                    return document.createTextNode("{}");
                }
                const container = document.createDocumentFragment();
                container.appendChild(document.createTextNode("{\n"));
                keys.forEach((key, idx) => {
                    container.appendChild(document.createTextNode(" ".repeat(indent + 2)));
                    
                    const keySpan = document.createElement("span");
                    keySpan.className = "console-key";
                    keySpan.textContent = `"${key}"`;
                    container.appendChild(keySpan);
                    
                    container.appendChild(document.createTextNode(": "));
                    container.appendChild(formatNode(val[key], indent + 2));
                    
                    if (idx < keys.length - 1) {
                        container.appendChild(document.createTextNode(","));
                    }
                    container.appendChild(document.createTextNode("\n"));
                });
                container.appendChild(document.createTextNode(spaces + "}"));
                return container;
            }
            return document.createTextNode(String(val));
        }
        
        fragment.appendChild(formatNode(obj));
        return fragment;
    }
});
